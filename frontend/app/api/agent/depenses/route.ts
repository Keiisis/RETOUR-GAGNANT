// ══════════════════════════════════════════════════════════════
//  AGENT / ADMIN : Édition & suppression des dépenses
//  Route sous /api/agent/* : le middleware l'autorise aux agents ET
//  aux admins (verifyApiAuth('agent') accepte les deux rôles). Permet
//  de corriger un montant, une catégorie, un libellé, ou surtout la
//  DATE EXACTE de la dépense (date_depense) après coup.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit-compta'
import { isPeriodLocked } from '@/lib/comptaLock'

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


// Normalise une date (YYYY-MM-DD ou ISO) en ISO à midi UTC pour éviter
// tout décalage de jour dû au fuseau horaire à l'affichage.
function toDepenseIso(input: string): string | null {
    const s = String(input || '').trim()
    if (!s) return null
    // YYYY-MM-DD → fixé à 12:00:00Z (jour stable quel que soit le fuseau)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00Z`).toISOString()
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d.toISOString()
}

export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceKey)
    const own = await assertOwnership(supabase, 'depenses', id, auth)
    if (own) return NextResponse.json({ error: own }, { status: 403 })

    const { data: existing } = await supabase
        .from('depenses').select('date_depense').eq('id', id).single()
    if (!existing) return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 })

    // Verrou de clôture : sur l'ancienne date ET (si changée) la nouvelle
    if (await isPeriodLocked(supabase, existing.date_depense)) {
        return NextResponse.json({ error: 'Période clôturée : modification refusée.' }, { status: 423 })
    }

    const patch: Record<string, unknown> = {}
    if (typeof body.titre === 'string' && body.titre.trim()) patch.titre = body.titre.trim()
    if (typeof body.categorie === 'string' && body.categorie.trim()) patch.categorie = body.categorie.trim()
    if (body.montant != null) {
        const m = Number(body.montant)
        if (!isFinite(m) || m <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
        patch.montant = m
    }
    if (typeof body.date_depense === 'string') {
        const iso = toDepenseIso(body.date_depense)
        if (!iso) return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
        if (await isPeriodLocked(supabase, iso)) {
            return NextResponse.json({ error: 'Nouvelle période clôturée : modification refusée.' }, { status: 423 })
        }
        patch.date_depense = iso
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

    // Etat AVANT (pour la trace d'audit)
    const { data: avant } = await supabase.from('depenses').select('*').eq('id', id).maybeSingle()

    const { error } = await supabase.from('depenses').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit(supabase, {
        table: 'depenses', recordId: id, action: 'update',
        acteur: { userId: auth.userId, role: auth.role },
        avant: (avant || {}) as Record<string, unknown>,
        apres: { ...(avant || {}), ...patch } as Record<string, unknown>,
    })
    return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceKey)
    const own = await assertOwnership(supabase, 'depenses', id, auth)
    if (own) return NextResponse.json({ error: own }, { status: 403 })
    const { data: existing } = await supabase
        .from('depenses').select('date_depense').eq('id', id).single()
    if (existing && await isPeriodLocked(supabase, existing.date_depense)) {
        return NextResponse.json({ error: 'Période clôturée : suppression refusée.' }, { status: 423 })
    }

    // Copie complete AVANT suppression (seule trace restante)
    const { data: avantSuppr } = await supabase.from('depenses').select('*').eq('id', id).maybeSingle()

    const { error } = await supabase.from('depenses').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit(supabase, {
        table: 'depenses', recordId: id, action: 'delete',
        acteur: { userId: auth.userId, role: auth.role },
        avant: (avantSuppr || {}) as Record<string, unknown>,
    })
    return NextResponse.json({ success: true })
}
