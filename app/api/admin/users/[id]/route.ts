import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!serviceKey) return NextResponse.json({ error: 'Service key manquante' }, { status: 500 })

    const { id } = await params
    const body = await request.json()
    const supabase = createClient(supabaseUrl, serviceKey)

    const updates: Record<string, unknown> = {}
    if (body.role !== undefined) updates.role = body.role
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.full_name !== undefined) updates.full_name = body.full_name

    const { error } = await supabase.from('user_profiles').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Si on change le mot de passe
    if (body.password) {
        const { error: pwError } = await supabase.auth.admin.updateUserById(id, { password: body.password })
        if (pwError) return NextResponse.json({ error: pwError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!serviceKey) return NextResponse.json({ error: 'Service key manquante' }, { status: 500 })

    const { id } = await params
    const supabase = createClient(supabaseUrl, serviceKey)

    // Supprimer le profil d'abord
    await supabase.from('user_profiles').delete().eq('id', id)

    // Supprimer l'auth user
    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}
