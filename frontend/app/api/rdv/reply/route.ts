import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, getEmailTemplates } from '@/lib/email';
import { requireStaff } from '@/lib/api-guard';

/* ══════════════════════════════════════════════════════════════
   RÉPONSE D'UN AGENT À UNE DEMANDE DE RENDEZ-VOUS

   Deux défauts corrigés ici :

   1) La route n'était protégée par RIEN. N'importe qui pouvait la poster et
      faire envoyer un email signé « Retour Gagnant » à l'adresse de son choix.
      Elle exige désormais une session interne (agent ou admin).

   2) La réponse partait UNIQUEMENT par email : ni stockée, ni visible dans
      l'espace client, ni dans l'application mobile. Le client voyait son badge
      de statut changer, mais jamais le message de l'agent. On crée maintenant
      une notification en base rattachée au client : les deux surfaces lisent
      déjà la table `notifications`.

   L'email reste envoyé : il touche le client même hors application.
═══════════════════════════════════════════════════════════════ */

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

export async function POST(req: NextRequest) {
    const garde = await requireStaff(req, 'agent');
    if (!garde.ok) return garde.response!;

    try {
        const { rdvId, clientEmail, clientName, message } = await req.json();

        if (!clientEmail || !message?.trim()) {
            return NextResponse.json({ error: 'Email et message sont requis.' }, { status: 400 });
        }
        const texte = message.trim();

        // ── Notification in-app : la réponse doit se retrouver dans l'espace
        //    client et dans l'application, pas seulement dans la boîte mail. ──
        let notified = false;
        try {
            let clientId: string | null = null;
            if (rdvId) {
                const { data: rdv } = await supabase
                    .from('rdv_requests')
                    .select('client_id')
                    .eq('id', rdvId)
                    .maybeSingle();
                clientId = rdv?.client_id || null;
            }
            // Repli : retrouver le compte par email si la demande n'était pas liée.
            if (!clientId) {
                const { data: prof } = await supabase
                    .from('client_profiles')
                    .select('id')
                    .eq('email', String(clientEmail).trim().toLowerCase())
                    .maybeSingle();
                clientId = prof?.id || null;
            }
            if (clientId) {
                const { error: notifErr } = await supabase.from('notifications').insert({
                    user_id: clientId,
                    title: 'Réponse à votre demande de rendez-vous',
                    body: texte,
                    type: 'rendez-vous',
                    is_read: false,
                });
                notified = !notifErr;
            }
        } catch (e) {
            // Une notification manquée ne doit pas bloquer l'envoi de l'email.
            console.error('[RDV REPLY] notification in-app échouée:', e);
        }

        const templates = await getEmailTemplates('fr');
        const result = await sendEmail({
            to: clientEmail,
            subject: 'Retour Gagnant · Réponse à votre demande de rendez-vous',
            html: await templates.agentReply(clientName || clientEmail, texte, 'fr'),
            context: 'rdv_reply',
            relatedId: rdvId || undefined,
        });

        if (!result.success) {
            // L'email a échoué mais la notification a pu partir : on le dit,
            // plutôt que de laisser croire à un échec total.
            return NextResponse.json(
                { error: result.error || 'Échec de l\'envoi de l\'email.', notified },
                { status: 500 },
            );
        }

        return NextResponse.json({ success: true, notified });
    } catch (error) {
        console.error('[RDV REPLY]', error);
        return NextResponse.json({ error: 'Erreur lors de l\'envoi.' }, { status: 500 });
    }
}
