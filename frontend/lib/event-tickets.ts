// ══════════════════════════════════════════════════════════════
//  TICKETS D'ÉVÉNEMENT : génération, signature, rendu.
//
//  Source UNIQUE de la logique de billetterie. Elle vivait uniquement dans
//  /api/events/[id]/register : l'inscription depuis l'application mobile
//  (/api/mobile/events/[id]/register) ne créait donc AUCUN ticket — un client
//  qui achetait son pass depuis le téléphone n'avait rien à présenter à
//  l'entrée. Tout passe désormais par ici.
//
//  ANTI-FRAUDE, à trois niveaux :
//   1. `ticket_code` est UNIQUE en base : un code ne peut pas être dupliqué.
//   2. `qr_data` est signé en HMAC-SHA256 : un QR fabriqué à la main est
//      rejeté à la validation, faute de signature valide.
//   3. la validation fait un UPDATE conditionnel (`is_used = false`) : le
//      premier scan gagne, tout scan suivant est refusé — y compris deux
//      scans simultanés.
// ══════════════════════════════════════════════════════════════
import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'

const TICKET_SECRET = process.env.TICKET_HMAC_SECRET || 'rgb-ticket-secret-2026'

export interface TicketPayload {
    ticket_code: string
    event_id: string
    registration_id: string
}

/** Code lisible et unique : RGB-XXXX-YYYYYYYY. */
export function generateTicketCode(eventSlug: string): string {
    const prefix = (eventSlug || 'RGB').slice(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X')
    const random = crypto.randomBytes(4).toString('hex').toUpperCase()
    return `RGB-${prefix}-${random}`
}

/** Contenu du QR : la charge utile plus sa signature HMAC. */
export function signTicket(payload: TicketPayload): string {
    const hmac = crypto.createHmac('sha256', TICKET_SECRET)
        .update(JSON.stringify(payload)).digest('hex')
    return JSON.stringify({ ...payload, hash: hmac })
}

/** Vérifie la signature d'un QR présenté au scan. */
export function verifyTicketQr(raw: string): { ok: boolean; payload?: TicketPayload } {
    try {
        const parsed = JSON.parse(raw) as TicketPayload & { hash?: string }
        const { hash, ...payload } = parsed
        if (!hash || !payload.ticket_code) return { ok: false }
        const expected = crypto.createHmac('sha256', TICKET_SECRET)
            .update(JSON.stringify({
                ticket_code: payload.ticket_code,
                event_id: payload.event_id,
                registration_id: payload.registration_id,
            })).digest('hex')
        // Comparaison à temps constant : ne fuit pas la signature attendue.
        const a = Buffer.from(hash)
        const b = Buffer.from(expected)
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false }
        return { ok: true, payload }
    } catch {
        return { ok: false }
    }
}

/**
 * Crée le ticket d'une inscription. Idempotent : si l'inscription possède déjà
 * un ticket, on le renvoie au lieu d'en créer un second (un même pass payé ne
 * doit jamais donner deux QR valables).
 */
export async function createTicketForRegistration(
    supabase: SupabaseClient,
    opts: { registrationId: string; eventId: string; eventSlug: string; ticketType?: string },
): Promise<{ ticket_code: string; qr_data: string } | null> {
    const { data: existing } = await supabase
        .from('event_tickets')
        .select('ticket_code, qr_data')
        .eq('registration_id', opts.registrationId)
        .maybeSingle()
    if (existing?.ticket_code) return existing

    // `ticket_code` est UNIQUE : en cas de collision improbable, on réessaie.
    for (let essai = 0; essai < 5; essai++) {
        const ticketCode = generateTicketCode(opts.eventSlug)
        const qrData = signTicket({
            ticket_code: ticketCode,
            event_id: opts.eventId,
            registration_id: opts.registrationId,
        })
        const { data, error } = await supabase
            .from('event_tickets')
            .insert({
                registration_id: opts.registrationId,
                event_id: opts.eventId,
                ticket_code: ticketCode,
                qr_data: qrData,
                ticket_type: opts.ticketType || 'standard',
                is_used: false,
            })
            .select('ticket_code, qr_data')
            .single()

        if (!error && data) return data
        // 23505 = violation d'unicité → nouveau tirage.
        if (error && error.code !== '23505') {
            console.error('[event-tickets] insert', error.message)
            return null
        }
    }
    return null
}

/** QR en data URI PNG, prêt à être inséré dans un design HTML. */
export async function qrDataUri(qrData: string, size = 320): Promise<string> {
    return QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: size,
        color: { dark: '#000000', light: '#FFFFFF' },
    })
}

// ─── RENDU DU TICKET ──────────────────────────────────────────
//
//  Le design est fourni par l'équipe (HTML), stocké en base et éditable :
//  page_sections, page='evenements'. Un modèle GLOBAL (section_key
//  'ticket_template') sert par défaut ; un modèle PAR ÉVÉNEMENT
//  ('ticket_template:<event_id>') le remplace s'il existe.
//
//  Le QR est injecté automatiquement : le design place simplement le marqueur
//  {{QR_CODE}} là où il doit apparaître (dans un src d'image ou un
//  background-image). Les autres marqueurs remplissent les informations.

export interface TicketRenderData {
    ticket_code: string
    qr_uri: string
    full_name: string
    email: string
    phone: string
    ticket_type: string
    event_title: string
    event_date: string
    event_location: string
}

/** Marqueurs remplaçables dans un design de ticket. */
export function ticketPlaceholders(d: TicketRenderData): Record<string, string> {
    return {
        '{{QR_CODE}}': d.qr_uri,
        '{{TICKET_CODE}}': d.ticket_code,
        '{{FULL_NAME}}': d.full_name,
        '{{EMAIL}}': d.email,
        '{{PHONE}}': d.phone,
        '{{TICKET_TYPE}}': d.ticket_type,
        '{{EVENT_TITLE}}': d.event_title,
        '{{EVENT_DATE}}': d.event_date,
        '{{EVENT_LOCATION}}': d.event_location,
    }
}

/** Échappement HTML : le nom d'un invité ne doit jamais devenir du markup. */
function esc(v: string): string {
    return String(v || '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
    ))
}

/**
 * Applique les marqueurs sur un design. Toutes les valeurs sont échappées,
 * SAUF le QR (une data URI, insérée telle quelle dans un src).
 */
export function renderTicketTemplate(template: string, d: TicketRenderData): string {
    let out = template
    for (const [marker, value] of Object.entries(ticketPlaceholders(d))) {
        const safe = marker === '{{QR_CODE}}' ? value : esc(value)
        out = out.split(marker).join(safe)
    }
    return out
}

/**
 * Design par défaut, utilisé tant qu'aucun design n'a été fourni en admin.
 *
 * ⚠️ MISE EN PAGE EN TABLEAUX, PAS EN FLEXBOX. La version précédente reposait
 * sur `display:flex` : Gmail, Outlook (moteur Word) et Yahoo l'ignorent
 * purement et simplement. Les deux colonnes retombaient donc l'une sous
 * l'autre, le QR se retrouvait seul en bas, et le billet arrivait « moche »
 * chez le destinataire alors qu'il s'affichait bien dans un navigateur.
 * Toute évolution de ce gabarit doit rester en `<table>` et en styles INLINE.
 *
 * Le dessin reprend l'objet réel : une souche perforée. À gauche l'invité et
 * son code, à droite le QR détachable — c'est ce que le porteur présente. Les
 * trois couleurs du drapeau tiennent lieu de signature, comme sur les factures
 * de l'agence ; le jaune ne sert qu'une fois, sur la ligne de perforation.
 */
export function defaultTicketTemplate(): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;background:#FFFFFF;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <tr><td style="padding:0">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">
      <tr style="height:7px">
        <td width="46%" style="background:#008751;height:7px;line-height:7px;font-size:0">&nbsp;</td>
        <td width="27%" style="background:#FCD116;height:7px;line-height:7px;font-size:0">&nbsp;</td>
        <td width="27%" style="background:#E8112D;height:7px;line-height:7px;font-size:0">&nbsp;</td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:30px 34px 0">
    <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.20em;text-transform:uppercase;color:#008751">Retour Gagnant Bénin</p>
    <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;font-weight:700;color:#3C3C3C">{{EVENT_TITLE}}</h1>
  </td></tr>

  <tr><td style="padding:18px 34px 0">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-top:1px solid #F0F0F0;border-bottom:1px solid #F0F0F0">
      <tr>
        <td style="padding:14px 0">
          <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#8A8A8A">Date</p>
          <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#3C3C3C">{{EVENT_DATE}}</p>
        </td>
        <td style="padding:14px 0;text-align:right">
          <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#8A8A8A">Lieu</p>
          <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#3C3C3C">{{EVENT_LOCATION}}</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:26px 34px 30px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">
      <tr>
        <td valign="top" style="padding-right:22px">
          <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#8A8A8A">Invité</p>
          <p style="margin:5px 0 20px;font-size:19px;font-weight:700;line-height:1.25;color:#3C3C3C">{{FULL_NAME}}</p>

          <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#8A8A8A">Formule</p>
          <p style="margin:5px 0 20px;font-size:15px;font-weight:700;color:#00643C">{{TICKET_TYPE}}</p>

          <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#8A8A8A">Code du billet</p>
          <p style="margin:5px 0 0;font-family:Consolas,'Courier New',monospace;font-size:17px;font-weight:700;letter-spacing:.04em;color:#3C3C3C">{{TICKET_CODE}}</p>
        </td>

        <td width="1" style="border-left:2px dashed #E4E4E4;font-size:0;line-height:0">&nbsp;</td>

        <td valign="top" width="212" style="padding-left:22px;text-align:center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="190" style="border-collapse:collapse;background:#E6F3ED">
            <tr><td style="padding:12px;text-align:center">
              <img src="{{QR_CODE}}" alt="Code QR du billet" width="166" height="166" style="display:block;width:166px;height:166px;border:0;background:#FFFFFF" />
            </td></tr>
          </table>
          <p style="margin:10px 0 0;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#008751">À présenter à l'entrée</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:16px 34px;background:#F5F5F5;border-top:1px solid #F0F0F0">
    <p style="margin:0;font-size:11px;line-height:1.6;color:#505050">
      Billet nominatif, valable une seule fois. Le premier scan l'invalide : une copie ne laisse pas entrer deux personnes.
    </p>
  </td></tr>
</table>`
}

/** Récupère le design applicable : par événement sinon global sinon défaut. */
export async function getTicketTemplate(
    supabase: SupabaseClient, eventId: string,
): Promise<string> {
    const { data } = await supabase
        .from('page_sections')
        .select('section_key, content')
        .eq('page', 'evenements')
        .in('section_key', ['ticket_template', `ticket_template:${eventId}`])

    const rows = data || []
    const parEvenement = rows.find(r => r.section_key === `ticket_template:${eventId}`)
    const global = rows.find(r => r.section_key === 'ticket_template')
    const html = String(
        (parEvenement?.content as Record<string, unknown> | undefined)?.html
        || (global?.content as Record<string, unknown> | undefined)?.html
        || '',
    ).trim()

    return html || defaultTicketTemplate()
}
