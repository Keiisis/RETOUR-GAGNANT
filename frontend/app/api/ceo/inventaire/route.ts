import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET /api/ceo/inventaire
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const { data, error } = await sb()
            .from('inventory_items')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ items: data || [] })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// PATCH /api/ceo/inventaire
export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const { id, ...updates } = await request.json()
        if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })
        const { error } = await sb().from('inventory_items').update(updates).eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// POST /api/ceo/inventaire
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const body = await request.json()
        const { data, error } = await sb().from('inventory_items').insert(body).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// DELETE /api/ceo/inventaire?id=xxx
export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })
        const { error } = await sb().from('inventory_items').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}
