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

// PATCH /api/admin/email-templates/[id] : modifier un template
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
        if (body.name !== undefined) allowed.name = body.name
        if (body.slug !== undefined) allowed.slug = body.slug
        if (body.subject !== undefined) allowed.subject = body.subject
        if (body.html_body !== undefined) allowed.html_body = body.html_body
        if (body.variables !== undefined) allowed.variables = body.variables
        allowed.updated_at = new Date().toISOString()

        const { data, error } = await supabase
            .from('email_templates')
            .update(allowed)
            .eq('id', id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ template: data })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// DELETE /api/admin/email-templates/[id] : supprimer un template
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
            .from('email_templates')
            .delete()
            .eq('id', id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
