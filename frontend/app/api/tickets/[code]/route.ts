// ══════════════════════════════════════════════════════════════
//  GET /api/tickets/[code] : le BILLET rendu, QR compris.
//
//  Le design du billet est fourni par l'équipe et stocké en base (voir
//  lib/event-tickets → getTicketTemplate) : global, ou spécifique à un
//  événement. Le QR est injecté AUTOMATIQUEMENT à l'emplacement du marqueur
//  {{QR_CODE}} du design, en data URI — le billet reste donc un fichier
//  autonome, affichable et téléchargeable hors ligne.
//
//  ?format=html  (défaut) page complète, imprimable / « Enregistrer en PDF »
//  ?format=png   image du QR seul (utile pour un aperçu compact)
//
//  Le code du billet fait office de secret de consultation : il est aléatoire
//  (4 octets) et ne révèle que les informations du porteur. Aucune donnée
//  d'autres invités n'est accessible.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTicketTemplate, renderTicketTemplate, qrDataUri } from '@/lib/event-tickets'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const dateFr = (iso?: string | null) => iso
    ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })
    : ''

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    const { code } = await params
    const ticketCode = decodeURIComponent(code || '').trim()
    if (!ticketCode) return NextResponse.json({ error: 'Code manquant.' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const format = (searchParams.get('format') || 'html').toLowerCase()

    const { data: ticket } = await supabase
        .from('event_tickets')
        .select('ticket_code, qr_data, ticket_type, is_used, used_at, event_id, registration_id')
        .eq('ticket_code', ticketCode)
        .maybeSingle()

    if (!ticket) return NextResponse.json({ error: 'Billet introuvable.' }, { status: 404 })

    const qrUri = await qrDataUri(ticket.qr_data, 420)
    if (format === 'png') {
        const base64 = qrUri.split(',')[1] || ''
        return new NextResponse(Buffer.from(base64, 'base64'), {
            headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300' },
        })
    }

    const [{ data: reg }, { data: event }] = await Promise.all([
        supabase.from('event_registrations')
            .select('full_name, email, phone, client_id')
            .eq('id', ticket.registration_id).maybeSingle(),
        supabase.from('events')
            .select('title, start_date, location')
            .eq('id', ticket.event_id).maybeSingle(),
    ])

    // Le nom peut vivre sur le profil client (inscription mobile) plutôt que
    // sur l'inscription elle-même : on complète depuis le profil si besoin.
    let fullName = String(reg?.full_name || '').trim()
    let email = String(reg?.email || '').trim()
    let phone = String(reg?.phone || '').trim()
    if ((!fullName || !email) && reg?.client_id) {
        const { data: cp } = await supabase
            .from('client_profiles')
            .select('nom, prenom, email, phone')
            .eq('id', reg.client_id).maybeSingle()
        if (cp) {
            fullName = fullName || `${cp.prenom || ''} ${cp.nom || ''}`.trim()
            email = email || String(cp.email || '')
            phone = phone || String(cp.phone || '')
        }
    }

    const template = await getTicketTemplate(supabase, ticket.event_id)
    const corps = renderTicketTemplate(template, {
        ticket_code: ticket.ticket_code,
        qr_uri: qrUri,
        full_name: fullName || 'Invité',
        email,
        phone,
        ticket_type: ticket.ticket_type === 'vip' ? 'VIP' : 'Standard',
        event_title: String(event?.title || 'Événement'),
        event_date: dateFr(event?.start_date),
        event_location: String(event?.location || ''),
    })

    const usedBanner = ticket.is_used
        ? `<div style="max-width:720px;margin:0 auto 14px;padding:12px 16px;border-radius:12px;background:#FDECEA;border:1px solid #E8112D;color:#8A1020;font:600 13px ui-sans-serif,system-ui,sans-serif">
             Ce billet a déjà été scanné${ticket.used_at ? ` le ${dateFr(ticket.used_at)}` : ''}. Il n'est plus valable pour entrer.
           </div>` : ''

    const html = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Billet ${ticket.ticket_code}</title>
<style>
  body { margin:0; padding:24px 16px; background:#F3F6F4; }
  @media print { body { background:#fff; padding:0 } .no-print { display:none } }
  .no-print { max-width:720px; margin:0 auto 14px; display:flex; gap:8px; justify-content:flex-end }
  .no-print button { border:0; border-radius:999px; padding:10px 18px; font:700 13px ui-sans-serif,system-ui,sans-serif; background:#008751; color:#fff; cursor:pointer }
</style>
</head><body>
${usedBanner}
<div class="no-print"><button onclick="window.print()">Télécharger / Imprimer</button></div>
${corps}
</body></html>`

    return new NextResponse(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'private, no-store',
        },
    })
}
