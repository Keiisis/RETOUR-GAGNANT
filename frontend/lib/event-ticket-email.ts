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
import { billetEnPdf, billetEnPng } from './event-ticket-render'
import {
    getTicketTemplate, renderTicketTemplate, qrDataUri, defaultTicketTemplate,
} from './event-tickets'

const CID_QR = 'qr-billet-rgb'
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

/**
 * Le design personnalisé enregistré en admin est-il utilisable EN EMAIL ?
 *
 * Le gabarit stocké dans `page_sections` (posé le 2026-08-18) est un vrai
 * travail de mise en page — mais pensé pour la PAGE WEB du billet : bloc
 * `<style>`, variables CSS (`--ink`), `display:flex`, encoches de perforation
 * en `radial-gradient`. Impeccable dans un navigateur, illisible dans une boîte
 * mail : Outlook ignore flex et les variables CSS, et l'application Gmail
 * supprime le `<style>` pour les comptes non-Gmail. Le billet arrivait donc
 * decompose, ce qui est exactement le « il est moche » constate.
 *
 * On n'ECRASE PAS ce design : il reste servi tel quel sur /api/tickets/[code].
 * L'email, lui, exige des `<table>` et des styles inline — s'il en manque, on
 * bascule sur le gabarit email par defaut. Un design personnalise ECRIT pour
 * l'email (tableaux, styles inline) passe donc le controle et sera respecte.
 */
function utilisableEnEmail(html: string): boolean {
    if (!html.trim()) return false
    if (/<style[\s>]/i.test(html)) return false          // souvent supprime
    if (/display\s*:\s*(flex|grid)/i.test(html)) return false // ignore par Outlook
    if (/var\(--/.test(html)) return false               // variables CSS non supportees
    if (!/<table/i.test(html)) return false              // pas de mise en page fiable
    return true
}

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
            /* `address` N'EXISTE PAS sur `events` (verifie en base le
               2026-08-21). La demander faisait echouer la requete ENTIERE :
               `event` revenait vide, et le billet partait avec « Evenement »
               en guise de titre, sans date ni lieu. Une colonne de trop coute
               ici tout le contenu utile du message. */
            supabase.from('events')
                .select('title, start_date, location')
                .eq('id', ticket.event_id).maybeSingle(),
        ])

        const destinataire = String(reg?.email || '').trim()
        if (!destinataire) return { ok: false, erreur: 'aucun email sur l’inscription' }

        const lieu = String(event?.location || '')

        /* Le QR part en pièce jointe inline ; le gabarit reçoit `cid:` à la
           place de la data URI. `renderTicketTemplate` n'échappe pas ce
           marqueur, il est donc inséré tel quel dans le `src`. */
        const qrUri = await qrDataUri(String(ticket.qr_data), 420)
        const personnalise = await getTicketTemplate(supabase, String(ticket.event_id))
        const gabarit = utilisableEnEmail(personnalise) ? personnalise : defaultTicketTemplate()
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

        const prenom = String(reg?.full_name || '').trim().split(' ')[0]

        /* Enveloppe en TABLEAUX elle aussi, pour la meme raison que le billet :
           un `div` centre par `margin:auto` ne se centre pas dans Outlook. La
           largeur 600 px est la seule qui tienne dans tous les volets de
           lecture sans declencher de zoom arriere sur telephone. */
        const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Votre billet</title></head>
<body style="margin:0;padding:0;background:#EDF1EF;-webkit-text-size-adjust:100%">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#EDF1EF">
  <tr><td align="center" style="padding:28px 12px 34px">

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;border-collapse:collapse">
      <tr><td style="padding:0 6px 20px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
        <p style="margin:0;font-size:16px;line-height:1.65;color:#3C3C3C">
          ${prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
        </p>
        <p style="margin:10px 0 0;font-size:16px;line-height:1.65;color:#505050">
          Votre place pour <strong style="color:#3C3C3C">${String(event?.title || 'l’événement')}</strong>
          est réservée. Votre billet est ci-dessous — présentez le code QR à l’entrée,
          depuis ce message ou imprimé.
        </p>
      </td></tr>
    </table>

    ${billet}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;border-collapse:collapse">
      <tr><td align="center" style="padding:22px 6px 0">
        <!-- Vers la VERSION WEB du billet : c'est la, et seulement la, que vit
             le design complet (perforation decoupee, arete tricolore) qu'aucune
             boite mail ne sait afficher. Le lien porte le code du billet, qui
             fait office de cle — comme une carte d'embarquement. -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
          <tr><td style="background:#008751;padding:14px 28px" align="center">
            <a href="${SITE}/api/tickets/${encodeURIComponent(String(ticket.ticket_code))}"
               style="display:inline-block;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:.02em">
              Voir et imprimer mon billet
            </a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 6px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
        <p style="margin:0;font-size:12px;line-height:1.7;color:#8A8A8A">
          Vous retrouvez ce billet à tout moment dans l’application Retour Gagnant Bénin,
          onglet Événements. Une question sur votre place ? Répondez simplement à ce message.
        </p>
      </td></tr>
    </table>

  </td></tr>
</table>
</body></html>`

        /* Les pièces jointes.
           · le QR en INLINE (`cid`), pour que le billet du corps s'affiche ;
           · le billet complet en PDF, et en PNG.
           Le PDF est ce qu'on garde, imprime et présente — comme chez toute
           billetterie. Le PNG répond à un usage local très concret : on
           l'envoie par WhatsApp.
           Un échec de rendu ne doit PAS empêcher l'envoi : le corps du message
           porte déjà le billet et le code. On joint ce qu'on a pu produire. */
        const pieces: Array<{ filename: string; content: string; contentType?: string; cid?: string }> = [{
            filename: `qr-${ticket.ticket_code}.png`,
            content: qrUri,
            contentType: 'image/png',
            cid: CID_QR,
        }]

        try {
            const donnees = {
                ticket_code: String(ticket.ticket_code),
                full_name: String(reg?.full_name || 'Invité'),
                email: destinataire,
                phone: String(reg?.phone || ''),
                ticket_type: ticket.ticket_type === 'vip' ? 'VIP' : 'Standard',
                event_title: String(event?.title || 'Événement'),
                event_date: dateLongue(event?.start_date),
                event_location: lieu,
                qr_uri: qrUri,
            }
            const [pdf, png] = await Promise.all([billetEnPdf(donnees), billetEnPng(donnees)])
            pieces.push(
                { filename: `billet-${ticket.ticket_code}.pdf`, content: pdf.toString('base64'), contentType: 'application/pdf' },
                { filename: `billet-${ticket.ticket_code}.png`, content: png.toString('base64'), contentType: 'image/png' },
            )
        } catch (e) {
            console.error('[billet email] rendu PDF/PNG impossible :', e)
        }

        const envoi = await sendEmail({
            to: destinataire,
            subject: `Votre billet — ${String(event?.title || 'Événement')}`,
            html,
            context: 'event_ticket',
            relatedId: registrationId,
            attachments: pieces,
        })

        return envoi.success ? { ok: true } : { ok: false, erreur: envoi.error }
    } catch (e) {
        return { ok: false, erreur: e instanceof Error ? e.message : 'erreur inconnue' }
    }
}
