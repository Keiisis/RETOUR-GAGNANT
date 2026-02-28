import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, EMAIL_TEMPLATES, getEmailConfig } from '@/lib/email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Generate a personalized AI auto-reply using Groq
 */
async function generateAutoReply(clientName: string, subject: string, message: string): Promise<string> {
    try {
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) return 'Votre demande est entre de bonnes mains. Notre équipe d\'experts travaille dessus.';

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
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
            }),
        });

        const data = await res.json();
        return data.choices?.[0]?.message?.content || 'Votre demande est entre de bonnes mains.';
    } catch {
        return 'Nous avons bien reçu votre message et notre équipe vous contactera sous peu.';
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { nom, prenom, email, sujet, message } = body;

        if (!nom || !email || !message) {
            return NextResponse.json(
                { error: 'Nom, email et message sont requis.' },
                { status: 400 }
            );
        }

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
                    html: EMAIL_TEMPLATES.autoReply(clientName, aiReply),
                    context: 'auto_reply',
                    relatedId: msgId,
                });

                // Send notification to admin/agents
                const config = await getEmailConfig();
                if (config.adminEmail) {
                    await sendEmail({
                        to: config.adminEmail,
                        subject: `🔔 Nouveau Contact — ${clientName} (${sujet || 'Contact'})`,
                        html: EMAIL_TEMPLATES.newLeadNotification(clientName, email, 0, sujet || 'Contact', 'Formulaire de Contact'),
                        context: 'admin_notification',
                        relatedId: msgId,
                    });
                }
            } catch (emailErr) {
                console.log('[CONTACT] Email send failed (non-blocking):', emailErr);
            }
        })();

        return NextResponse.json({ success: true, message: 'Message envoyé avec succès !' });
    } catch (error) {
        return NextResponse.json(
            { error: 'Erreur lors de l\'envoi du message.' },
            { status: 500 }
        );
    }
}
