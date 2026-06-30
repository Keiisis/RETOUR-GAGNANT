import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, getEmailTemplates, getEmailConfig } from '@/lib/email';
import { fetchWithGroqRotation, GROQ_KEYS } from '@/lib/groq';
import { rateLimit, getClientIp, rateLimitHeaders, CONTACT_LIMIT } from '@/lib/rate-limit';
import { withWafGuard } from '@/lib/waf';
import { sendWhatsAppNotification } from '@/lib/whatsapp';
import { trackClient } from '@/lib/classement/track';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Generate a personalized AI auto-reply using Groq
 */
async function generateAutoReply(clientName: string, subject: string, message: string): Promise<string> {
    try {
        if (GROQ_KEYS.length === 0) return 'Votre demande est entre de bonnes mains. Notre équipe d\'experts travaille dessus.';

        const res = await fetchWithGroqRotation({
            model: 'llama-3.1-8b-instant',
            messages: [
                {
                    role: 'system',
                    content: `Tu es l'assistant de Retour Gagnant Bénin. Génère un court message personnalisé (2-3 phrases max) pour accuser réception d'un message client. Sois chaleureux, rassurant et professionnel. Ne donne AUCUN prix. Mentionne que l'équipe va le contacter rapidement. NE PAS utiliser de markdown.`
                },
                {
                    role: 'user',
                    content: `Le client "${clientName}" a envoyé un message avec le sujet "${subject}": "${message}". Génère un accusé de réception personnalisé.`
                }
            ],
            temperature: 0.7,
            max_tokens: 150,
        });

        const data = await res.json();
        return data.choices?.[0]?.message?.content || 'Votre demande est entre de bonnes mains.';
    } catch {
        return 'Nous avons bien reçu votre message et notre équipe vous contactera sous peu.';
    }
}

// Le handler est enveloppé par withWafGuard (analyse de body automatique :
// prototype pollution / RCE / SSRF / DoS) — voir export en bas de fichier.
async function handleContact(req: NextRequest) {
    try {
        // ═══ RATE LIMITING ════════════════════════════════════════════
        // Strict : protège le quota email (Groq + SMTP) et la table messages.
        // 3 messages / 15 min, blocage progressif jusqu'à 24h pour les abus répétés.
        const clientIp = getClientIp(req)
        const rl = rateLimit(`contact:${clientIp}`, CONTACT_LIMIT)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: `Trop de messages envoyés. Réessayez dans ${rl.retryAfter} secondes.` },
                { status: 429, headers: rateLimitHeaders(rl) }
            )
        }

        const body = await req.json();
        const { nom, prenom, email, sujet, message } = body;

        if (!nom || !email || !message) {
            return NextResponse.json(
                { error: 'Nom, email et message sont requis.' },
                { status: 400 }
            );
        }

        // Validation format email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
            return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 })
        }

        // Limites de longueur pour éviter les abus
        if (String(nom).length > 100) return NextResponse.json({ error: 'Nom trop long (max 100 caractères).' }, { status: 400 })
        if (String(email).length > 254) return NextResponse.json({ error: 'Email trop long.' }, { status: 400 })
        if (sujet && String(sujet).length > 200) return NextResponse.json({ error: 'Sujet trop long (max 200 caractères).' }, { status: 400 })
        if (String(message).length > 5000) return NextResponse.json({ error: 'Message trop long (max 5000 caractères).' }, { status: 400 })

        const supabase = createClient(supabaseUrl, supabaseKey);
        const clientName = `${prenom || ''} ${nom}`.trim();

        // 1. Save to Supabase (immediately)
        const { data: insertedMsg, error: supabaseError } = await supabase
            .from('messages')
            .insert([{
                nom,
                prenom: prenom || '',
                email,
                sujet: sujet || 'Contact général',
                message,
                type: 'contact',
                lu: false,
            }])
            .select('id')
            .single();

        if (supabaseError) throw supabaseError;
        const msgId = insertedMsg?.id || '';

        // 2. Fire-and-forget: Auto-reply + Agent notification (don't block the client response)
        (async () => {
            try {
                // Generate AI personalized response
                const aiReply = await generateAutoReply(clientName, sujet || 'Contact', message);

                // Send auto-reply to client
                await sendEmail({
                    to: email,
                    subject: `Retour Gagnant — Nous avons reçu votre message`,
                    html: await (await getEmailTemplates('fr')).autoReply(clientName, aiReply),
                    context: 'auto_reply',
                    relatedId: msgId,
                });

                // Send notification to admin/agents
                const config = await getEmailConfig();
                if (config.adminEmail) {
                    await sendEmail({
                        to: config.adminEmail,
                        subject: `🔔 Nouveau Contact — ${clientName} (${sujet || 'Contact'})`,
                        html: await (await getEmailTemplates('fr')).newLeadNotification(clientName, email, 0, sujet || 'Contact', 'Formulaire de Contact'),
                        context: 'admin_notification',
                        relatedId: msgId,
                    });
                }
            } catch (emailErr) {
                console.log('[CONTACT] Email send failed (non-blocking):', emailErr);
            }

            // Notification WhatsApp automatique (no-op si non configuré)
            try {
                await sendWhatsAppNotification(
                    `🔔 Nouveau message de contact — Retour Gagnant\n` +
                    `De : ${clientName}\n` +
                    `Email : ${email}\n` +
                    `Sujet : ${sujet || 'Contact'}\n` +
                    `Message : ${String(message).slice(0, 300)}`
                );
            } catch (waErr) {
                console.log('[CONTACT] WhatsApp non-blocking:', waErr);
            }

            // Classement Client automatique (CRM)
            await trackClient({ email, full_name: clientName, phone: body?.telephone || null, serviceLabel: sujet, source: 'contact' });
        })();

        // 3. Auto-create Nexus Tracker entry for contact tracking
        const contactRef = `RG-MSG-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`
        supabase.from('dossier_tracking').insert({
            num_dossier: contactRef,
            client_nom: nom,
            client_prenom: prenom || '',
            client_email: email.toLowerCase(),
            service_type: 'Contact / Demande',
            service: 'contact',
            statut: 'reception',
            etapes: [
                { id: 1, label: 'Message reçu', status: 'completed', date: new Date().toISOString().split('T')[0], note: sujet || 'Contact' },
                { id: 2, label: 'Prise en charge par un agent', status: 'pending', date: null, note: '' },
                { id: 3, label: 'Réponse envoyée au client', status: 'pending', date: null, note: '' },
            ],
            progression: 33,
            notes_internes: `Sujet: ${sujet || 'Contact général'}\nMessage: ${message.substring(0, 200)}`,
        }).then(({ error: trackErr }) => {
            if (trackErr) console.error('[TRACKER] Contact track error:', trackErr.message)
        })

        return NextResponse.json({ success: true, message: 'Message envoyé avec succès !' });
    } catch {
        return NextResponse.json(
            { error: 'Erreur lors de l\'envoi du message.' },
            { status: 500 }
        );
    }
}

// Route POST gardée : body-scan WAF automatique avant le handler.
export const POST = withWafGuard(
    handleContact as unknown as (r: Request) => Promise<Response>
);
