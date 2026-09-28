import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { isPeriodLocked } from '@/lib/comptaLock'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Garde 'admin' : enregistrer, modifier ou effacer un encaissement change la
// comptabilité (factures soldées, CA). L'écran est réservé à la direction
// (app/admin/comptabilite) et le middleware refuse déjà les agents ; la
// route acceptait pourtant 'agent' — elle doit tenir seule.
const TYPES = ['virement', 'especes', 'cheque', 'mobile_money', 'carte', 'autre'] // contrainte paiements_manuels_type_check
const DATE_RE = /^\d{4}-\d{2}-\d{2}/
const montantValide = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }

export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json()
    const { document_id, agent_id, type, montant, date_paiement, reference, notes } = body

    if (!montant || !type) {
        return NextResponse.json({ error: 'Champs requis manquants (type, montant)' }, { status: 400 })
    }
    if (montantValide(montant) === null) {
        return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    }
    if (!TYPES.includes(String(type))) {
        return NextResponse.json({ error: `Type invalide (${TYPES.join(', ')})` }, { status: 400 })
    }
    if (date_paiement != null && !DATE_RE.test(String(date_paiement))) {
        return NextResponse.json({ error: 'Date invalide (AAAA-MM-JJ)' }, { status: 400 })
    }

    const isExterne = !document_id && typeof notes === 'string' && /^\[EXTERNE\]/i.test(notes)
    if (!document_id && !isExterne) {
        return NextResponse.json({ error: 'document_id requis pour les paiements non-externes' }, { status: 400 })
    }


    const supabase = createClient(supabaseUrl, serviceKey)

    // LOT 3 : Verrou période clôturée
    const datePaiement = date_paiement || new Date().toISOString().split('T')[0]
    if (await isPeriodLocked(supabase, datePaiement)) {
        return NextResponse.json(
            { error: 'Période clôturée : paiement refusé. Rouvrez la clôture pour modifier.' },
            { status: 423 }
        )
    }

    const { error } = await supabase.from('paiements_manuels').insert({
        document_id: document_id || null,
        agent_id: agent_id || null,
        type,
        montant: Number(montant),
        date_paiement: datePaiement,
        reference: reference || null,
        notes: notes || null,
    })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}

// Édition d'un paiement (montant, type, référence, libellé externe, date)
export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json()
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: existing } = await supabase.from('paiements_manuels').select('date_paiement').eq('id', id).single()
    if (existing && await isPeriodLocked(supabase, existing.date_paiement)) {
        return NextResponse.json({ error: 'Période clôturée : modification refusée.' }, { status: 423 })
    }

    if (!existing) return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 })

    const patch: Record<string, unknown> = {}
    if (body.montant != null) {
        const m = montantValide(body.montant)
        if (m === null) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
        patch.montant = m
    }
    if (typeof body.type === 'string') {
        if (!TYPES.includes(body.type)) return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
        patch.type = body.type
    }
    if ('reference' in body) patch.reference = body.reference || null
    if ('notes' in body) patch.notes = body.notes || null
    if (typeof body.date_paiement === 'string') {
        if (!DATE_RE.test(body.date_paiement)) return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
        // Déplacer un paiement VERS une période close contournait le verrou :
        // seule la date d'origine était contrôlée.
        if (await isPeriodLocked(supabase, body.date_paiement)) {
            return NextResponse.json({ error: 'Période cible clôturée : modification refusée.' }, { status: 423 })
        }
        patch.date_paiement = body.date_paiement
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

    const { error } = await supabase.from('paiements_manuels').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

// Suppression d'un paiement (corrige les doublons qui faussent la compta)
export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: existing } = await supabase.from('paiements_manuels').select('date_paiement').eq('id', id).single()
    if (existing && await isPeriodLocked(supabase, existing.date_paiement)) {
        return NextResponse.json({ error: 'Période clôturée : suppression refusée.' }, { status: 423 })
    }

    const { error } = await supabase.from('paiements_manuels').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
