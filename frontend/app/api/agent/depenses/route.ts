// ══════════════════════════════════════════════════════════════
//  AGENT / ADMIN — Édition & suppression des dépenses
//  Route sous /api/agent/* : le middleware l'autorise aux agents ET
//  aux admins (verifyApiAuth('agent') accepte les deux rôles). Permet
//  de corriger un montant, une catégorie, un libellé, ou surtout la
//  DATE EXACTE de la dépense (date_depense) après coup.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { isPeriodLocked } from '@/lib/comptaLock'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

    const { data: existing } = await supabase
        .from('depenses').select('date_depense').eq('id', id).single()
    if (!existing) return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 })

    // Verrou de clôture : sur l'ancienne date ET (si changée) la nouvelle
    if (await isPeriodLocked(supabase, existing.date_depense)) {
        return NextResponse.json({ error: 'Période clôturée — modification refusée.' }, { status: 423 })
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
            return NextResponse.json({ error: 'Nouvelle période clôturée — modification refusée.' }, { status: 423 })
        }
        patch.date_depense = iso
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

    const { error } = await supabase.from('depenses').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: existing } = await supabase
        .from('depenses').select('date_depense').eq('id', id).single()
    if (existing && await isPeriodLocked(supabase, existing.date_depense)) {
        return NextResponse.json({ error: 'Période clôturée — suppression refusée.' }, { status: 423 })
    }

    const { error } = await supabase.from('depenses').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
