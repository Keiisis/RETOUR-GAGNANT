// ══════════════════════════════════════════════════════════════
//  AGENT — Édition / suppression de ses paiements (manuels & externes)
//  Route sous /api/agent/* : le middleware l'autorise aux agents (les
//  routes /api/admin/* leur sont interdites). Permet à l'agent de
//  corriger lui-même les DOUBLONS qui faussent la comptabilité.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { isPeriodLocked } from '@/lib/comptaLock'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const body = await request.json()
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: existing } = await supabase.from('paiements_manuels').select('date_paiement').eq('id', id).single()
    if (existing && await isPeriodLocked(supabase, existing.date_paiement)) {
        return NextResponse.json({ error: 'Période clôturée — modification refusée.' }, { status: 423 })
    }

    const patch: Record<string, unknown> = {}
    if (body.montant != null) patch.montant = Number(body.montant)
    if (typeof body.type === 'string') patch.type = body.type
    if ('reference' in body) patch.reference = body.reference || null
    if ('notes' in body) patch.notes = body.notes || null
    if (typeof body.date_paiement === 'string') patch.date_paiement = body.date_paiement
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

    const { error } = await supabase.from('paiements_manuels').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: existing } = await supabase.from('paiements_manuels').select('date_paiement').eq('id', id).single()
    if (existing && await isPeriodLocked(supabase, existing.date_paiement)) {
        return NextResponse.json({ error: 'Période clôturée — suppression refusée.' }, { status: 423 })
    }

    const { error } = await supabase.from('paiements_manuels').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
