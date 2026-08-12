// ══════════════════════════════════════════════════════════════
//  DEVIS / FACTURES / AVOIRS : mutation serveur (service key)
//  Les UPDATE/DELETE directs depuis le navigateur sont bloqués par
//  RLS (0 ligne modifiée, sans erreur → faux succès puis retour à
//  l'état d'origine au rafraîchissement). On passe donc par cette
//  route serveur. Sous /api/agent/* : autorisée aux agents ET aux
//  admins (middleware + verifyApiAuth('agent') = agent | admin).
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const EDITABLE = ['client_nom', 'client_prenom', 'client_email', 'client_phone', 'client_adresse',
    'items', 'sous_total', 'total_tva', 'remise', 'total', 'currency', 'notes', 'conditions', 'validite'] as const

export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const body = await request.json()
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceKey)
    const update: Record<string, unknown> = {}

    // Action « marquer payé / impayé »
    if (body.action === 'mark_paid') {
        update.status = 'paye'
        update.payment_method = 'manuel'
        update.paid_at = new Date().toISOString()
    } else if (body.action === 'mark_unpaid') {
        update.status = 'envoye'
        update.paid_at = null
    } else if (typeof body.status === 'string') {
        update.status = body.status
    }

    // Édition de champs (whitelist)
    for (const f of EDITABLE) {
        if (f in body) update[f] = body[f]
    }

    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

    const { data, error } = await supabase
        .from('documents_financiers').update(update).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, document: data })
}

export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceKey)
    // Nettoyer les paiements liés puis supprimer le document
    await supabase.from('paiements_manuels').delete().eq('document_id', id)
    const { error } = await supabase.from('documents_financiers').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
