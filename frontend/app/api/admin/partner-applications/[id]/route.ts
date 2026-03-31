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

// PATCH /api/admin/partner-applications/[id] — mettre à jour le statut, notes, is_read
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

        const allowed: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (body.status !== undefined) allowed.status = body.status
        if (body.notes !== undefined) allowed.notes = body.notes
        if (body.is_read !== undefined) allowed.is_read = body.is_read

        const { data, error } = await supabase
            .from('partner_applications')
            .update(allowed)
            .eq('id', id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Si on confirme la candidature → créer automatiquement le partenaire
        if (body.status === 'confirmed' && body.create_partner) {
            const app = data
            await supabase.from('partners').insert({
                name: app.company_name,
                description: app.activity_description,
                category: app.category,
                location: app.location,
                website: app.website || '',
                phone: app.phone || '',
                email: app.email || '',
                logo: app.logo_url || '',
                cover_image: app.cover_image_url || '',
                is_premium: false,
                is_active: true,
                sort_order: 999,
                products: [],
            })
        }

        return NextResponse.json({ application: data })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// DELETE /api/admin/partner-applications/[id] — supprimer une candidature
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const supabase = getSupabase()
        const { id } = await params
        const { error } = await supabase.from('partner_applications').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
