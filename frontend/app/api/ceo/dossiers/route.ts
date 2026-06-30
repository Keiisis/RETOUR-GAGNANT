import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquant')
}
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET /api/ceo/dossiers
export async function GET(request: NextRequest) {
    try {
        const supabase = sb()
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const search = searchParams.get('search')

        let query = supabase
            .from('dossier_tracking')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500)

        if (status && status !== 'all') query = query.eq('status', status)
        if (search) query = query.ilike('client_name', `%${search}%`)

        const { data, error } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ dossiers: data || [] })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// PATCH /api/ceo/dossiers — Update status
export async function PATCH(request: NextRequest) {
    try {
        const supabase = sb()
        const body = await request.json()
        const { id, ...updates } = body
        if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })

        const { error } = await supabase
            .from('dossier_tracking')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// POST /api/ceo/dossiers — Create dossier
export async function POST(request: NextRequest) {
    try {
        const supabase = sb()
        const body = await request.json()

        const { data, error } = await supabase
            .from('dossier_tracking')
            .insert(body)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// DELETE /api/ceo/dossiers?id=xxx
export async function DELETE(request: NextRequest) {
    try {
        const supabase = sb()
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })

        const { error } = await supabase.from('dossier_tracking').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}
