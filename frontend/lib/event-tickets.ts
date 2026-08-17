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

/** Design par défaut, utilisé tant qu'aucun design n'a été fourni en admin. */
export function defaultTicketTemplate(): string {
    return `<div style="width:720px;margin:0 auto;font-family:ui-sans-serif,system-ui,'Segoe UI',Roboto,sans-serif;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 18px 44px rgba(0,0,0,.12)">
  <div style="display:flex;height:6px"><span style="flex:46;background:#008751"></span><span style="flex:27;background:#FCD116"></span><span style="flex:27;background:#E8112D"></span></div>
  <div style="padding:28px 32px 8px">
    <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#008751">Retour Gagnant Bénin</p>
    <h1 style="margin:6px 0 0;font-size:28px;line-height:1.15;color:#17201C">{{EVENT_TITLE}}</h1>
    <p style="margin:8px 0 0;font-size:14px;color:#5E6A64">{{EVENT_DATE}} · {{EVENT_LOCATION}}</p>
  </div>
  <div style="display:flex;gap:28px;align-items:center;padding:24px 32px 32px">
    <div style="flex:1">
      <p style="margin:0;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8A938E">Invité</p>
      <p style="margin:2px 0 14px;font-size:20px;font-weight:800;color:#17201C">{{FULL_NAME}}</p>
      <p style="margin:0;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8A938E">Formule</p>
      <p style="margin:2px 0 14px;font-size:15px;font-weight:700;color:#008751">{{TICKET_TYPE}}</p>
      <p style="margin:0;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8A938E">Code</p>
      <p style="margin:2px 0 0;font-family:ui-monospace,monospace;font-size:16px;font-weight:700;color:#17201C">{{TICKET_CODE}}</p>
    </div>
    <div style="text-align:center">
      <img src="{{QR_CODE}}" alt="QR du billet" style="width:190px;height:190px;display:block;border:1px solid #E4E9E6;border-radius:12px" />
      <p style="margin:8px 0 0;font-size:10px;color:#8A938E">À présenter à l'entrée</p>
    </div>
  </div>
  <div style="padding:14px 32px;background:#F3F6F4;font-size:11px;color:#5E6A64">
    Billet nominatif et valable une seule fois. Toute reproduction est sans effet : le premier scan invalide le billet.
  </div>
</div>`
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
