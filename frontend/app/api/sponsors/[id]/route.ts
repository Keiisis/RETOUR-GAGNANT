import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// PUT : mettre à jour un sponsor
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!
    try {
        const { id } = await params
        const body = await request.json()
        const { name, logo_url, website_url, sort_order, is_active } = body

        const updates: Record<string, unknown> = {}
        if (name !== undefined) updates.name = name.trim()
        if (logo_url !== undefined) updates.logo_url = logo_url || null
        if (website_url !== undefined) updates.website_url = website_url || null
        if (sort_order !== undefined) updates.sort_order = sort_order
        if (is_active !== undefined) updates.is_active = is_active

        const { data, error } = await supabase
            .from('sponsors')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ sponsor: data })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

// DELETE : supprimer un sponsor
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!
    try {
        const { id } = await params
        const { error } = await supabase
            .from('sponsors')
            .delete()
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
