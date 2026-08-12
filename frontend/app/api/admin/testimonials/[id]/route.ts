import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Variables Supabase manquantes')
    return createClient(supabaseUrl, supabaseServiceKey)
}

// PATCH /api/admin/testimonials/[id] : modifier ou changer le statut
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await verifyApiAuth(request, 'admin')
        if (!auth.authenticated) return auth.error!
        const supabase = getSupabase()
        const body = await request.json()
        const { id } = await params

        const allowed = ['name', 'text', 'rating', 'service', 'approved']
        const updates: Record<string, unknown> = {}
        for (const key of allowed) {
            if (key in body) updates[key] = body[key]
        }

        if ('photo_url' in body) {
            updates.photo = body.photo_url || null
        } else if ('photo' in body) {
            updates.photo = body.photo || null
        }

        // Handle location and role combining if either is provided
        if ('location' in body || 'role' in body) {
            const existingRes = await supabase
                .from('testimonials')
                .select('location')
                .eq('id', id)
                .maybeSingle()
            
            let existingLocation = existingRes.data?.location || ''
            let existingRole = ''
            if (existingLocation.includes(' | ')) {
                const parts = existingLocation.split(' | ')
                existingLocation = parts[0]
                existingRole = parts[1]
            }

            const newLocation = 'location' in body ? (body.location || '') : existingLocation
            const newRole = 'role' in body ? (body.role || '') : existingRole

            updates.location = newRole ? `${newLocation} | ${newRole}` : newLocation
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('testimonials')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        const testimonial = data ? {
            ...data,
            location: data.location && data.location.includes(' | ') ? data.location.split(' | ')[0] : (data.location || 'Bénin'),
            role: data.location && data.location.includes(' | ') ? data.location.split(' | ')[1] : 'Client',
            photo_url: data.photo
        } : null
        return NextResponse.json({ testimonial })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}


// DELETE /api/admin/testimonials/[id] : supprimer un témoignage
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await verifyApiAuth(request, 'admin')
        if (!auth.authenticated) return auth.error!
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
