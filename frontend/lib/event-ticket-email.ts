/* ═══════════════════════════════════════════════════════════
   L'email de confirmation d'inscription à un événement.

   CE QUI MANQUAIT. L'application affiche « Confirmation envoyée par email »
   sous le bouton d'inscription, et la billetterie créait bien l'inscription,
   la facture, le billet et son QR — mais AUCUNE route, ni web ni mobile,
   n'appelait `sendEmail`. Le client ne recevait donc jamais rien, et devait
   rouvrir l'application pour retrouver son billet. Vérifié le 2026-08-21 sur
   `/api/mobile/events` (POST et PATCH) et `/api/events/[id]/register`.

   POURQUOI UN `cid` PLUTÔT QU'UNE `data:` URI. Le billet affiché dans le
   navigateur (`/api/tickets/[code]`) embarque son QR en `data:image/png`. En
   email, Gmail et Outlook suppriment ces images : le destinataire aurait reçu
   un billet au QR cassé, c'est-à-dire inutilisable à l'entrée. L'image voyage
   donc DANS le message, référencée par `cid:`.

   Cette fonction ne jette jamais : un email en échec ne doit pas annuler une
   inscription déjà payée. Elle rend un résultat, que l'appelant journalise.
═══════════════════════════════════════════════════════════ */
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from './email'
import { getTicketTemplate, renderTicketTemplate, qrDataUri } from './event-tickets'

const CID_QR = 'qr-billet-rgb'

function dateLongue(iso?: string | null): string {
    if (!iso) return ''
    try {
        return new Date(iso).toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        })
    } catch { return String(iso) }
}

export async function envoyerBilletParEmail(
    supabase: SupabaseClient,
    registrationId: string,
): Promise<{ ok: boolean; erreur?: string }> {
    try {
        const { data: ticket } = await supabase
            .from('event_tickets')
            .select('ticket_code, qr_data, ticket_type, event_id, registration_id')
            .eq('registration_id', registrationId)
            .maybeSingle()

        if (!ticket) return { ok: false, erreur: 'billet introuvable' }

        const [{ data: reg }, { data: event }] = await Promise.all([
            supabase.from('event_registrations')
                .select('full_name, email, phone')
                .eq('id', registrationId).maybeSingle(),
            supabase.from('events')
                .select('title, start_date, location, address')
                .eq('id', ticket.event_id).maybeSingle(),
        ])

        const destinataire = String(reg?.email || '').trim()
        if (!destinataire) return { ok: false, erreur: 'aucun email sur l’inscription' }

        const lieu = [event?.location, event?.address].filter(Boolean).join(' — ')

        /* Le QR part en pièce jointe inline ; le gabarit reçoit `cid:` à la
           place de la data URI. `renderTicketTemplate` n'échappe pas ce
           marqueur, il est donc inséré tel quel dans le `src`. */
        const qrUri = await qrDataUri(String(ticket.qr_data), 420)
        const gabarit = await getTicketTemplate(supabase, String(ticket.event_id))
        const billet = renderTicketTemplate(gabarit, {
            ticket_code: String(ticket.ticket_code),
            qr_uri: `cid:${CID_QR}`,
            full_name: String(reg?.full_name || 'Invité'),
            email: destinataire,
            phone: String(reg?.phone || ''),
            ticket_type: ticket.ticket_type === 'vip' ? 'VIP' : 'Standard',
            event_title: String(event?.title || 'Événement'),
            event_date: dateLongue(event?.start_date),
            event_location: lieu,
        })

        const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:24px 12px;background:#F3F6F4;font-family:ui-sans-serif,system-ui,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:720px;margin:0 auto">
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3C3C3C">
      Bonjour ${String(reg?.full_name || '').split(' ')[0] || ''},<br />
      votre place pour <strong>${String(event?.title || 'l’événement')}</strong> est confirmée.
      Votre billet est ci-dessous : présentez le QR à l’entrée, depuis ce mail ou imprimé.
    </p>
    ${billet}
    <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#8A8A8A">
      Billet nominatif, valable une seule fois. Vous le retrouvez à tout moment dans
      l’application Retour Gagnant Bénin, onglet Événements.
    </p>
  </div>
</body></html>`

        const envoi = await sendEmail({
            to: destinataire,
            subject: `Votre billet — ${String(event?.title || 'Événement')}`,
            html,
            context: 'event_ticket',
            relatedId: registrationId,
            attachments: [{
                filename: `billet-${ticket.ticket_code}.png`,
                content: qrUri,
                contentType: 'image/png',
                cid: CID_QR,
            }],
        })

        return envoi.success ? { ok: true } : { ok: false, erreur: envoi.error }
    } catch (e) {
        return { ok: false, erreur: e instanceof Error ? e.message : 'erreur inconnue' }
    }
}
