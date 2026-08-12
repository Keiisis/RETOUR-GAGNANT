import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Variables Supabase manquantes (SUPABASE_SERVICE_ROLE_KEY requis)')
    }
    return createClient(supabaseUrl, supabaseServiceKey)
}

// PATCH /api/admin/leads/[id] : modifier un lead (is_contacted, notes, etc.)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const supabase = getSupabase()
        const { id } = await params
        const body = await request.json()

        const allowed: Record<string, unknown> = {}
        if (body.is_contacted !== undefined) allowed.is_contacted = body.is_contacted

        const { data, error } = await supabase
            .from('eligibility_results')
            .update(allowed)
            .eq('id', id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ lead: data })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// DELETE /api/admin/leads/[id] : supprimer un lead
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const supabase = getSupabase()
        const { id } = await params

        const { error } = await supabase
            .from('eligibility_results')
            .delete()
            .eq('id', id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
