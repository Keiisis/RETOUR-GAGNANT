import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Variables Supabase manquantes')
    return createClient(supabaseUrl, supabaseServiceKey)
}

// PATCH /api/admin/testimonials/[id] — modifier ou changer le statut
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = getSupabase()
        const body = await request.json()
        const { id } = await params

        const allowed = ['name', 'text', 'photo', 'location', 'rating', 'service', 'approved']
        const updates: Record<string, unknown> = {}
        for (const key of allowed) {
            if (key in body) updates[key] = body[key]
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
        }

        updates.updated_at = new Date().toISOString()

        const { data, error } = await supabase
            .from('testimonials')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ testimonial: data })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// DELETE /api/admin/testimonials/[id] — supprimer un témoignage
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = getSupabase()
        const { id } = await params
        const { error } = await supabase
            .from('testimonials')
            .delete()
            .eq('id', id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
