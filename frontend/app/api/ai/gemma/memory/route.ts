import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

function sb() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
}

// GET : lire toutes les mémoires
export async function GET(req: NextRequest) {
    const garde = await requireStaff(req, 'agent')
    if (!garde.ok) return garde.response!

    const { data, error } = await sb()
        .from('gemma_memory')
        .select('*')
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ memory: data || [] })
}

// POST : ajouter une mémoire
export async function POST(req: NextRequest) {
    const garde = await requireStaff(req, 'agent')
    if (!garde.ok) return garde.response!

    const body = await req.json()
    const { type, content, importance = 3, tags = [] } = body
    if (!content) return NextResponse.json({ error: 'content requis' }, { status: 400 })

    const { data, error } = await sb()
        .from('gemma_memory')
        .insert({ type: type || 'note', content, importance, tags })
        .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ entry: data })
}

// DELETE : supprimer une mémoire
export async function DELETE(req: NextRequest) {
    const garde = await requireStaff(req, 'agent')
    if (!garde.ok) return garde.response!

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await sb().from('gemma_memory').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
