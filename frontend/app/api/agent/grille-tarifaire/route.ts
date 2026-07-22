// ══════════════════════════════════════════════════════════════
//  AGENT / ADMIN — Grille tarifaire (lecture + modification)
//  Route sous /api/agent/* : autorisée aux agents ET aux admins.
//  Scoped à la SEULE clé `grilles_tarifaires` de la table settings —
//  contrairement à /api/admin/settings (bloqué aux agents par le
//  middleware ET exposant toutes les clés, dont secrètes).
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const KEY = 'grilles_tarifaires'

function getSupabase() {
    if (!supabaseUrl || !serviceKey) throw new Error('Configuration Supabase manquante')
    return createClient(supabaseUrl, serviceKey)
}

// GET /api/agent/grille-tarifaire → { value: string | null }
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!
    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from('settings').select('value').eq('key', KEY).maybeSingle()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ value: data?.value ?? null })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// PATCH /api/agent/grille-tarifaire { value } → upsert de la grille
export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!
    try {
        const supabase = getSupabase()
        const body = await request.json().catch(() => ({}))
        const value = typeof body.value === 'string' ? body.value : JSON.stringify(body.value ?? [])
        const { data, error } = await supabase
            .from('settings')
            .upsert({ key: KEY, value, category: 'frontend' }, { onConflict: 'key' })
            .select('key, value')
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, setting: data })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
