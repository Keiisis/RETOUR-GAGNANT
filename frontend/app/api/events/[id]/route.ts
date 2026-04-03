import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseKey) throw new Error('Supabase config missing')
    return createClient(supabaseUrl, supabaseKey)
}

// GET single event
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const supabase = getSupabase()

        const { data, error } = await supabase
            .from('events')
            .select('*, event_images(id, url, alt_text, sort_order)')
            .eq('id', id)
            .single()

        if (error || !data) return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 })
        return NextResponse.json({ event: data })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// PUT update event
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyApiAuth(req, 'admin')
    if (!auth.authenticated) return auth.error!
    try {
        const { id } = await params
        const supabase = getSupabase()
        const body = await req.json()

        const { data, error } = await supabase
            .from('events')
            .update({ ...body, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ event: data })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// DELETE event
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyApiAuth(req, 'admin')
    if (!auth.authenticated) return auth.error!
    try {
        const { id } = await params
        const supabase = getSupabase()

        const { error } = await supabase.from('events').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
