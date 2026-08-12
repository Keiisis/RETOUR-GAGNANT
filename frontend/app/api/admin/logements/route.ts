import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

// Colonnes éditables du catalogue (liste blanche stricte).
const FIELDS = [
    'programme', 'nom', 'type', 'ville', 'site', 'surface_m2', 'chambres',
    'prix_comptant', 'devise', 'mensualite', 'duree_annees', 'formules',
    'description', 'atouts', 'images', 'plan_url', 'visite_url', 'lat', 'lng',
    'disponibilite', 'ordre', 'is_active',
]

function pick(body: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const k of FIELDS) if (k in body) out[k] = body[k]
    return out
}

// GET : liste complète (staff), triée par ordre.
export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!
    const { data, error } = await supabase
        .from('logements')
        .select('*')
        .order('ordre', { ascending: true })
        .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ logements: data || [] })
}

// POST : création.
export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!
    const body = await request.json().catch(() => ({}))
    const row = pick(body)
    const { data, error } = await supabase.from('logements').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, logement: data })
}

// PATCH : mise à jour d'un logement { id, ...champs } OU réordonnancement en lot
// { reorder: [{ id, ordre }] }.
export async function PATCH(request: NextRequest) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!
    const body = await request.json().catch(() => ({}))

    if (Array.isArray(body.reorder)) {
        for (const r of body.reorder) {
            if (r?.id) await supabase.from('logements').update({ ordre: Number(r.ordre) || 0 }).eq('id', r.id)
        }
        return NextResponse.json({ success: true })
    }

    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const row = pick(body)
    row.updated_at = new Date().toISOString()
    const { data, error } = await supabase.from('logements').update(row).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, logement: data })
}

// DELETE ?id=…
export async function DELETE(request: NextRequest) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!
    const id = request.nextUrl.searchParams.get('id') || ''
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const { error } = await supabase.from('logements').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
