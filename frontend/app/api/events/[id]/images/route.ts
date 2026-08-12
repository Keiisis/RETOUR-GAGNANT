import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseKey) throw new Error('Supabase config missing')
    return createClient(supabaseUrl, supabaseKey)
}

// POST /api/events/[id]/images : add image to gallery
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyApiAuth(req, 'admin')
    if (!auth.authenticated) return auth.error!
    try {
        const { id: eventId } = await params
        const supabase = getSupabase()
        const { url, alt_text, sort_order } = await req.json()

        if (!url) return NextResponse.json({ error: 'URL requise' }, { status: 400 })

        const { data, error } = await supabase
            .from('event_images')
            .insert({ event_id: eventId, url, alt_text: alt_text || '', sort_order: sort_order || 0 })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ image: data }, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// DELETE /api/events/[id]/images?image_id=xxx : remove image
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyApiAuth(req, 'admin')
    if (!auth.authenticated) return auth.error!
    try {
        const { id: eventId } = await params
        const supabase = getSupabase()
        const { searchParams } = new URL(req.url)
        const imageId = searchParams.get('image_id')

        if (!imageId) return NextResponse.json({ error: 'image_id requis' }, { status: 400 })

        const { error } = await supabase
            .from('event_images')
            .delete()
            .eq('id', imageId)
            .eq('event_id', eventId)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
