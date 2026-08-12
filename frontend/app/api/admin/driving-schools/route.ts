// ══════════════════════════════════════════════════════════════
//  ADMIN : Auto-écoles partenaires (Permis de Conduire) : CRUD complet
//  Toutes les écritures passent ici (service role) : la table est en RLS
//  lecture seule côté public. Aucune donnée codée en dur. Prix + durée
//  entièrement pilotés depuis ici.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const db = () => createClient(supabaseUrl, serviceKey)

const MISSING_TABLE = "Table « driving_schools » absente. Exécutez la migration supabase/migrations/20260812_driving_schools.sql dans l'éditeur SQL Supabase."

function arr<T>(v: unknown): T[] {
    return Array.isArray(v) ? (v as T[]) : []
}

/** Champs autorisés en écriture (liste blanche stricte). */
function sanitize(body: Record<string, unknown>) {
    const out: Record<string, unknown> = {}
    if (typeof body.nom === 'string') out.nom = body.nom.trim()
    if ('ville' in body) out.ville = String(body.ville || '').trim() || null
    if ('description' in body) out.description = String(body.description || '').trim() || null
    if ('photo_url' in body) out.photo_url = String(body.photo_url || '').trim() || null
    if ('duration' in body) out.duration = String(body.duration || '').trim() || null
    if ('telephone' in body) out.telephone = String(body.telephone || '').trim() || null
    if ('email' in body) out.email = String(body.email || '').trim().toLowerCase() || null
    if ('features' in body) out.features = arr(body.features)
    if ('price_eur' in body) {
        const n = Number(body.price_eur)
        out.price_eur = isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
    }
    if ('is_active' in body) out.is_active = !!body.is_active
    if ('order_index' in body) {
        const n = Number(body.order_index)
        out.order_index = isFinite(n) ? Math.round(n) : 0
    }
    return out
}

// GET : liste complète (actives + inactives)
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const { data, error } = await db()
        .from('driving_schools').select('*')
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false })
    if (error) {
        const missing = error.message?.includes('driving_schools')
        return NextResponse.json({ error: missing ? MISSING_TABLE : error.message }, { status: missing ? 503 : 500 })
    }
    return NextResponse.json({ schools: data || [] })
}

// POST : création
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const patch = sanitize(body)
    if (!patch.nom) return NextResponse.json({ error: "Le nom de l'auto-école est obligatoire." }, { status: 400 })

    const { data, error } = await db().from('driving_schools').insert(patch).select('id').single()
    if (error) {
        const missing = error.message?.includes('driving_schools')
        return NextResponse.json({ error: missing ? MISSING_TABLE : error.message }, { status: missing ? 503 : 500 })
    }
    return NextResponse.json({ success: true, id: data.id })
}

// PATCH : mise à jour
export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const patch = sanitize(body)
    patch.updated_at = new Date().toISOString()
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

    const { error } = await db().from('driving_schools').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

// DELETE : suppression
export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await db().from('driving_schools').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
