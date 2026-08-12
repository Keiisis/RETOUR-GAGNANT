import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Variables Supabase manquantes')
    }
    return createClient(supabaseUrl, supabaseServiceKey)
}

// GET /api/admin/services/[id] : récupérer un service
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const { id } = await params
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .eq('id', id)
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 404 })
        return NextResponse.json({ service: data })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// PATCH /api/admin/services/[id] : modifier un service
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const { id } = await params
        const supabase = getSupabase()
        const body = await request.json()

        const allowed = [
            'title', 'slug', 'subtitle', 'description',
            'features', 'pricing_options', 'color', 'icon_type',
            'image_url', 'price_display', 'order_index', 'is_active',
        ]
        const updates: Record<string, unknown> = {}
        for (const key of allowed) {
            if (key in body) updates[key] = body[key]
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('services')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ service: data })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// DELETE /api/admin/services/[id] : supprimer un service
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const { id } = await params
        const supabase = getSupabase()

        const { error } = await supabase
            .from('services')
            .delete()
            .eq('id', id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
