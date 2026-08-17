// ══════════════════════════════════════════════════════════════
//  GET /api/mobile/events/tickets : les billets du client connecté.
//
//  Alimente l'onglet « Tickets » de l'application. L'identité vient du JETON,
//  jamais d'un paramètre : sans cela, n'importe qui listerait les billets d'un
//  autre client en changeant un identifiant (IDOR).
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileUserId } from '@/lib/mobile-auth'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
    const clientId = await getMobileUserId(req)
    if (!clientId) return NextResponse.json({ error: 'Non authentifié', tickets: [] }, { status: 401 })

    // 1. Les inscriptions du client. La table event_registrations n'a PAS de
    //    client_id (schéma réellement déployé, vérifié en base) : le seul lien
    //    est l'email, que l'on prend sur le profil rattaché au jeton — jamais
    //    sur un paramètre de requête, sinon on lirait les billets d'autrui.
    const { data: cp } = await supabase
        .from('client_profiles').select('email').eq('id', clientId).maybeSingle()
    const email = String(cp?.email || '').trim().toLowerCase()
    if (!email) return NextResponse.json({ tickets: [] })

    const { data: regs, error: regErr } = await supabase
        .from('event_registrations')
        .select('id, event_id, ticket_type, payment_status, created_at')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(100)

    if (regErr) return NextResponse.json({ error: regErr.message, tickets: [] }, { status: 500 })
    const regIds = (regs || []).map(r => r.id)
    if (regIds.length === 0) return NextResponse.json({ tickets: [] })

    // 2. Leurs billets émis.
    const { data: tickets } = await supabase
        .from('event_tickets')
        .select('id, registration_id, event_id, ticket_code, ticket_type, is_used, used_at, created_at')
        .in('registration_id', regIds)

    // 3. Les événements concernés.
    const eventIds = [...new Set((regs || []).map(r => r.event_id))]
    const { data: events } = await supabase
        .from('events')
        .select('id, title, slug, start_date, location, cover_image')
        .in('id', eventIds)

    const eventById = new Map((events || []).map(e => [e.id, e]))

    // On renvoie une entrée par inscription : même sans billet encore émis
    // (paiement en attente), le client doit comprendre où il en est.
    const out = (regs || []).map(r => {
        const t = (tickets || []).find(x => x.registration_id === r.id)
        const e = eventById.get(r.event_id)
        return {
            registration_id: r.id,
            event_id: r.event_id,
            event_title: e?.title || 'Événement',
            event_date: e?.start_date || null,
            event_location: e?.location || null,
            event_cover: e?.cover_image || null,
            ticket_type: t?.ticket_type || r.ticket_type || 'standard',
            payment_status: r.payment_status,
            ticket_code: t?.ticket_code || null,
            is_used: t?.is_used ?? false,
            used_at: t?.used_at || null,
            created_at: r.created_at,
        }
    })

    return NextResponse.json({ tickets: out })
}
