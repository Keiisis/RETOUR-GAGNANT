import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, getEmailTemplates } from '@/lib/email';
import { getStaffToLine } from '@/lib/staff-recipients';
import { fetchWithGroqRotation, GROQ_KEYS } from '@/lib/groq';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

async function generateAutoReply(clientName: string, service: string): Promise<string> {
    try {
        if (GROQ_KEYS.length === 0) return 'Votre demande de rendez-vous est bien enregistrée. Notre équipe la traite avec soin.';

        const res = await fetchWithGroqRotation({
            model: 'llama-3.1-8b-instant',
            messages: [
                {
                    role: 'system',
                    content: `Tu es l'assistant de Retour Gagnant Bénin. Génère un court message personnalisé (2-3 phrases max) pour confirmer la réception d'une demande de rendez-vous depuis l'espace client. Sois chaleureux, rassurant et professionnel. Ne donne AUCUN prix et AUCUNE date (l'agent les confirmera). NE PAS utiliser de markdown.`
                },
                {
                    role: 'user',
                    content: `Le client "${clientName}" a soumis une demande de rendez-vous pour "${service}" depuis son espace personnel.`
                }
            ],
            temperature: 0.7,
            max_tokens: 150,
        });

        const data = await res.json();
        return data.choices?.[0]?.message?.content || 'Votre demande est bien enregistrée, notre agent vous contactera sous 24h.';
    } catch {
        return 'Nous avons bien reçu votre demande depuis votre espace client. Notre agent vous confirmera un créneau très prochainement.';
    }
}

export async function POST(req: NextRequest) {
    try {
        const { rdvId, clientName, clientEmail, service, date, heure, type } = await req.json();

        if (!clientEmail || !clientName) {
            return NextResponse.json({ error: 'clientName et clientEmail sont requis.' }, { status: 400 });
        }

        // Notification in-app pour les panels Admin + Agent (fire-and-forget)
        void supabase.from('messages').insert([{
            nom: clientName,
            email: clientEmail,
            sujet: `Nouvelle demande de RDV (espace client) — ${service || 'Consultation'}`,
            message: `${clientName} a demandé un rendez-vous depuis son espace client.\n\nService : ${service || 'Consultation'}\n${date ? `Date souhaitée : ${date} ${heure || ''}\n` : ''}Canal : ${type || 'téléphone'}\n\n→ À traiter dans l'onglet Rendez-vous (Agenda) du panel Agent.`,
            type: 'rdv',
            lu: false,
        }]).then(({ error: msgErr }) => {
            if (msgErr) console.log('[RDV confirm-client] notification in-app échouée (non bloquant):', msgErr.message);
        });

        // Fire-and-forget — ne bloque pas la réponse HTTP
        (async () => {
            try {
                const aiReply = await generateAutoReply(clientName, service || 'Consultation');
                const templates = await getEmailTemplates('fr');

                // Email de confirmation au client (sans CTA "réserver" — déjà fait)
                await sendEmail({
                    to: clientEmail,
                    subject: `✅ Retour Gagnant — Votre rendez-vous est enregistré`,
                    html: await templates.rdvConfirmation(
                        clientName,
                        service || 'Consultation',
                        date || null,
                        heure || 'À définir',
                        type || 'telephone',
                        aiReply
                    ),
                    context: 'rdv_confirmation',
                    relatedId: rdvId || undefined,
                });

                // Notification équipe — 5 destinataires fixes + admin configuré
                const staffTo = await getStaffToLine();
                await sendEmail({
                    to: staffTo,
                    subject: `📅 Nouveau RDV (espace client) — ${clientName} (${service || 'Consultation'})`,
                    html: await templates.rdvAdminNotification(
                        clientName,
                        clientEmail,
                        service || 'Consultation',
                        date || null,
                        heure || 'À définir',
                        type || 'telephone'
                    ),
                    context: 'admin_notification',
                    relatedId: rdvId || undefined,
                });
            } catch (emailErr) {
                console.log('[RDV confirm-client] Email send failed (non-blocking):', emailErr);
            }
        })();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[RDV confirm-client]', error);
        return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
    }
}
