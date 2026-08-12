// ══════════════════════════════════════════════════════════════
//  ADMIN : Catégories de permis (prix + durée) : CRUD complet
//  Écritures en service_role. C'est ici que se règlent les PRIX FIXES du
//  permis, par catégorie. Aucune donnée codée en dur.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const db = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const MISSING_TABLE = "Table « permis_types » absente. Exécutez la migration supabase/migrations/20260813_permis_types.sql dans l'éditeur SQL Supabase."

function sanitize(body: Record<string, unknown>) {
    const out: Record<string, unknown> = {}
    if (typeof body.category === 'string') out.category = body.category.trim()
    if (typeof body.label === 'string') out.label = body.label.trim()
    if ('description' in body) out.description = String(body.description || '').trim() || null
    if ('duration' in body) out.duration = String(body.duration || '').trim() || null
    if ('age_min' in body) {
        const n = Number(body.age_min)
        out.age_min = isFinite(n) && n > 0 ? Math.round(n) : null
    }
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

export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const { data, error } = await db()
        .from('permis_types').select('*')
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false })
    if (error) {
        const missing = error.message?.includes('permis_types')
        return NextResponse.json({ error: missing ? MISSING_TABLE : error.message }, { status: missing ? 503 : 500 })
    }
    return NextResponse.json({ types: data || [] })
}

export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const patch = sanitize(body)
    if (!patch.category || !patch.label) return NextResponse.json({ error: 'La catégorie et l’intitulé sont obligatoires.' }, { status: 400 })

    const { data, error } = await db().from('permis_types').insert(patch).select('id').single()
    if (error) {
        const missing = error.message?.includes('permis_types')
        return NextResponse.json({ error: missing ? MISSING_TABLE : error.message }, { status: missing ? 503 : 500 })
    }
    return NextResponse.json({ success: true, id: data.id })
}

export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const patch = sanitize(body)
    patch.updated_at = new Date().toISOString()
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

    const { error } = await db().from('permis_types').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await db().from('permis_types').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
