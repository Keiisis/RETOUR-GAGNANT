import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, getEmailTemplates, getEmailConfig } from '@/lib/email';
import { fetchWithGroqRotation, GROQ_KEYS } from '@/lib/groq';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function generateAutoReply(clientName: string, service: string): Promise<string> {
    try {
        if (GROQ_KEYS.length === 0) return 'Votre demande de rendez-vous est bien enregistrée. Notre équipe la traite avec soin.';

        const res = await fetchWithGroqRotation({
            model: 'llama-3.1-8b-instant',
            messages: [
                {
                    role: 'system',
                    content: `Tu es l'assistant de Retour Gagnant Bénin. Génère un court message personnalisé (2-3 phrases max) pour confirmer la réception d'une demande de rendez-vous. Sois chaleureux, rassurant et professionnel. Ne donne AUCUN prix et AUCUNE date (l'agent les confirmera). NE PAS utiliser de markdown.`
                },
                {
                    role: 'user',
                    content: `Le client "${clientName}" a demandé un rendez-vous pour le service "${service}".`
                }
            ],
            temperature: 0.7,
            max_tokens: 150,
        });

        const data = await res.json();
        return data.choices?.[0]?.message?.content || 'Votre demande de rendez-vous est bien enregistrée.';
    } catch {
        return 'Nous avons bien reçu votre demande et notre agent vous confirmera un créneau très prochainement.';
    }
}

// Mapping timeSlot → heure
function mapTimeSlot(timeSlot: string): string {
    const lower = (timeSlot || '').toLowerCase();
    if (lower.includes('matin') || lower.includes('morning') || lower.includes('9h') || lower.includes('10h')) return '09:00';
    if (lower.includes('après-midi') || lower.includes('apres-midi') || lower.includes('afternoon') || lower.includes('13h') || lower.includes('14h')) return '14:00';
    if (lower.includes('soir') || lower.includes('evening') || lower.includes('17h') || lower.includes('18h')) return '17:00';
    // If it looks like a time already (HH:MM)
    if (/^\d{1,2}:\d{2}$/.test(timeSlot)) return timeSlot;
    return '09:00';
}

// Mapping contactMethod → type rdv
function mapContactMethod(contactMethod: string): 'presentiel' | 'visio' | 'telephone' {
    const lower = (contactMethod || '').toLowerCase();
    if (lower.includes('présentiel') || lower.includes('presentiel') || lower.includes('cotonou') || lower.includes('bureau')) return 'presentiel';
    if (lower.includes('meet') || lower.includes('visio') || lower.includes('video') || lower.includes('zoom') || lower.includes('teams')) return 'visio';
    return 'telephone'; // WhatsApp, appel, téléphone, etc.
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { nom, prenom, email, telephone, service, message, date, timeSlot, contactMethod } = body;

        if (!nom || !email) {
            return NextResponse.json({ error: 'Nom et email sont requis.' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const clientName = `${prenom || ''} ${nom}`.trim();

        // Encoder les infos visiteur dans notes (pas de compte, pas de client_id)
        // Format structuré pour que l'agenda agent puisse parser le nom/téléphone
        const notesParts = [`__VISITOR__: ${clientName} | Tel: ${telephone || 'N/A'}`];
        if (message?.trim()) notesParts.push(`---\nMessage: ${message.trim()}`);
        const notesContent = notesParts.join('\n');

        // Sauvegarder dans rdv_requests (table unifiée pour tous les RDV)
        const { data: insertedRdv, error: rdvError } = await supabase
            .from('rdv_requests')
            .insert([{
                client_id: null,
                client_email: email,
                date: date || null,
                heure: mapTimeSlot(timeSlot),
                type: mapContactMethod(contactMethod),
                motif: service || 'Consultation générale',
                notes: notesContent,
                statut: 'en_attente',
            }])
            .select('id')
            .single();

        if (rdvError) throw rdvError;
        const rdvId = insertedRdv?.id || '';

        // Fire-and-forget : emails de confirmation + notification agent
        (async () => {
            try {
                const aiReply = await generateAutoReply(clientName, service || 'Consultation');
                const templates = await getEmailTemplates('fr');

                // Email de confirmation au visiteur (sans CTA "réserver un rdv" — illogique)
                await sendEmail({
                    to: email,
                    subject: `✅ Retour Gagnant — Votre demande de rendez-vous est enregistrée`,
                    html: await templates.rdvConfirmation(clientName, service || 'Consultation', date, timeSlot, contactMethod, aiReply),
                    context: 'rdv_confirmation',
                    relatedId: rdvId,
                });

                // Notification admin/agent — template dédié RDV (sans score Oracle)
                const config = await getEmailConfig();
                if (config.adminEmail) {
                    await sendEmail({
                        to: config.adminEmail,
                        subject: `📅 Nouveau RDV — ${clientName} (${service || 'Consultation'})`,
                        html: await templates.rdvAdminNotification(clientName, email, service || 'Consultation', date, timeSlot, contactMethod),
                        context: 'admin_notification',
                        relatedId: rdvId,
                    });
                }
            } catch (emailErr) {
                console.log('[RDV] Email send failed (non-blocking):', emailErr);
            }
        })();

        return NextResponse.json({ success: true, message: 'Demande de rendez-vous envoyée !' });
    } catch (error) {
        console.error('[RDV POST]', error);
        return NextResponse.json({ error: 'Erreur lors de la soumission.' }, { status: 500 });
    }
}
