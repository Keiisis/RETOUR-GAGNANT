// ══════════════════════════════════════════════════════════════
//  AGENT : Édition / suppression de ses paiements (manuels & externes)
//  Route sous /api/agent/* : le middleware l'autorise aux agents (les
//  routes /api/admin/* leur sont interdites). Permet à l'agent de
//  corriger lui-même les DOUBLONS qui faussent la comptabilité.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit-compta'
import { isPeriodLocked } from '@/lib/comptaLock'
import { agentHasComptaAccess } from '@/lib/constants/compta'

/* Comptabilité côté agent : réservée à Ornel (décision du 16/07/2026). La
   règle n'était appliquée que dans le navigateur : n'importe quel agent
   pouvait écrire ici par un appel direct. */
async function accesCompta(auth: { userId?: string; role?: string }): Promise<NextResponse | null> {
    if (['admin', 'super_admin', 'superadmin', 'ceo'].includes(String(auth.role || ''))) return null
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data } = await sb.from('user_profiles').select('email').eq('id', auth.userId || '').maybeSingle()
    return agentHasComptaAccess(data?.email)
        ? null
        : NextResponse.json({ error: 'Comptabilité réservée à l’administration.' }, { status: 403 })
}


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin']
const isAdminRole = (role?: string) => !!role && ADMIN_ROLES.includes(role)

/** Un AGENT ne peut toucher QUE ses propres ecritures ; un ADMIN, toutes. */
async function assertOwnership(
    supabase: SupabaseClient,
    table: string,
    id: string,
    auth: { userId?: string; role?: string },
): Promise<string | null> {
    if (isAdminRole(auth.role)) return null
    const { data } = await supabase.from(table).select('agent_id').eq('id', id).maybeSingle()
    const row = data as { agent_id?: string | null } | null
    if (!row) return 'Introuvable'
    if (!row.agent_id || row.agent_id !== auth.userId) return "Cette ecriture ne vous appartient pas."
    return null
}


/* Enregistrement d'un paiement (sur facture, ou externe sans facture).
   Auparavant inséré depuis le navigateur : la réserve Comptabilité n'était
   alors contrôlée que par l'interface. */
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!
    { const refus = await accesCompta(auth); if (refus) return refus }

    const body = await request.json().catch(() => ({}))
    const montant = Number(body.montant)
    if (!isFinite(montant) || montant <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    const type = String(body.type || '').trim()
    if (!type) return NextResponse.json({ error: 'Mode de paiement requis' }, { status: 400 })
    const datePaiement = String(body.date_paiement || '').trim() || new Date().toISOString().slice(0, 10)
    if (isNaN(new Date(datePaiement).getTime())) return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
    const documentId = body.document_id ? String(body.document_id) : null

    const supabase = createClient(supabaseUrl, serviceKey)
    if (documentId) {
        // Un agent n'encaisse que sur SES documents ; un admin, sur tous.
        const { data: doc } = await supabase.from('documents_financiers').select('id, agent_id').eq('id', documentId).maybeSingle()
        if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
        if (!isAdminRole(auth.role) && doc.agent_id !== auth.userId) {
            return NextResponse.json({ error: 'Ce document ne vous appartient pas.' }, { status: 403 })
        }
    }
    if (await isPeriodLocked(supabase, datePaiement)) {
        return NextResponse.json({ error: 'Période clôturée : enregistrement refusé.' }, { status: 423 })
    }

    const ligne = {
        agent_id: auth.userId,
        document_id: documentId,
        type,
        montant,
        date_paiement: datePaiement,
        reference: body.reference ? String(body.reference) : null,
        notes: body.notes ? String(body.notes) : null,
    }
    const { data, error } = await supabase.from('paiements_manuels').insert(ligne).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit(supabase, {
        table: 'paiements_manuels', recordId: String(data.id), action: 'create',
        acteur: { userId: auth.userId, role: auth.role },
        apres: ligne as Record<string, unknown>,
    })
    return NextResponse.json({ success: true, id: data.id })
}

export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!
    { const refus = await accesCompta(auth); if (refus) return refus }

    const body = await request.json()
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceKey)
    const own = await assertOwnership(supabase, 'paiements_manuels', id, auth)
    if (own) return NextResponse.json({ error: own }, { status: 403 })
    const { data: existing } = await supabase.from('paiements_manuels').select('date_paiement').eq('id', id).single()
    if (existing && await isPeriodLocked(supabase, existing.date_paiement)) {
        return NextResponse.json({ error: 'Période clôturée : modification refusée.' }, { status: 423 })
    }

    const patch: Record<string, unknown> = {}
    if (body.montant != null) patch.montant = Number(body.montant)
    if (typeof body.type === 'string') patch.type = body.type
    if ('reference' in body) patch.reference = body.reference || null
    if ('notes' in body) patch.notes = body.notes || null
    if (typeof body.date_paiement === 'string') patch.date_paiement = body.date_paiement
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

    // Etat AVANT (pour la trace d'audit)
    const { data: avant } = await supabase.from('paiements_manuels').select('*').eq('id', id).maybeSingle()

    const { error } = await supabase.from('paiements_manuels').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit(supabase, {
        table: 'paiements_manuels', recordId: id, action: 'update',
        acteur: { userId: auth.userId, role: auth.role },
        avant: (avant || {}) as Record<string, unknown>,
        apres: { ...(avant || {}), ...patch } as Record<string, unknown>,
    })
    return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!
    { const refus = await accesCompta(auth); if (refus) return refus }

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceKey)
    const own = await assertOwnership(supabase, 'paiements_manuels', id, auth)
    if (own) return NextResponse.json({ error: own }, { status: 403 })
    const { data: existing } = await supabase.from('paiements_manuels').select('date_paiement').eq('id', id).single()
    if (existing && await isPeriodLocked(supabase, existing.date_paiement)) {
        return NextResponse.json({ error: 'Période clôturée : suppression refusée.' }, { status: 423 })
    }

    // Copie complete AVANT suppression (seule trace restante)
    const { data: avantSuppr } = await supabase.from('paiements_manuels').select('*').eq('id', id).maybeSingle()

    const { error } = await supabase.from('paiements_manuels').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit(supabase, {
        table: 'paiements_manuels', recordId: id, action: 'delete',
        acteur: { userId: auth.userId, role: auth.role },
        avant: (avantSuppr || {}) as Record<string, unknown>,
    })
    return NextResponse.json({ success: true })
}
