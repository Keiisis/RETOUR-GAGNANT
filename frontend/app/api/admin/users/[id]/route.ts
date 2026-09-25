import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/* Audit du 25/09/2026 : `role` acceptait n'importe quelle chaîne, un
   administrateur pouvait se rétrograder ou se supprimer lui-même (perte du
   dernier accès admin), ou retirer un super-admin. */
const ROLES_VALIDES = ['admin', 'super_admin', 'superadmin', 'ceo', 'agent', 'client']
const ROLES_SUPER = ['super_admin', 'superadmin', 'ceo']
const MDP_MIN = 10

async function roleDe(supabase: SupabaseClient, id: string): Promise<string> {
    const { data } = await supabase.from('user_profiles').select('role').eq('id', id).maybeSingle()
    return String((data as { role?: string } | null)?.role || '')
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    if (!serviceKey) return NextResponse.json({ error: 'Service key manquante' }, { status: 500 })

    const { id } = await params
    const body = await request.json()
    const supabase = createClient(supabaseUrl, serviceKey)

    if (body.role !== undefined && !ROLES_VALIDES.includes(String(body.role))) {
        return NextResponse.json({ error: `Rôle inconnu : ${body.role}` }, { status: 400 })
    }
    if (id === auth.userId && (body.role !== undefined || body.is_active === false)) {
        return NextResponse.json({ error: 'Vous ne pouvez pas modifier votre propre rôle ni désactiver votre propre compte.' }, { status: 400 })
    }
    const cible = await roleDe(supabase, id)
    if ((ROLES_SUPER.includes(cible) || ROLES_SUPER.includes(String(body.role || ''))) && !ROLES_SUPER.includes(String(auth.role || ''))) {
        return NextResponse.json({ error: 'Seul un super-administrateur peut modifier un super-administrateur.' }, { status: 403 })
    }
    if (body.password && String(body.password).length < MDP_MIN) {
        return NextResponse.json({ error: `Mot de passe trop court (${MDP_MIN} caractères minimum).` }, { status: 400 })
    }

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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    if (!serviceKey) return NextResponse.json({ error: 'Service key manquante' }, { status: 500 })

    const { id } = await params
    const supabase = createClient(supabaseUrl, serviceKey)

    if (id === auth.userId) {
        return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, { status: 400 })
    }
    if (ROLES_SUPER.includes(await roleDe(supabase, id)) && !ROLES_SUPER.includes(String(auth.role || ''))) {
        return NextResponse.json({ error: 'Seul un super-administrateur peut supprimer un super-administrateur.' }, { status: 403 })
    }

    // Supprimer le profil d'abord
    await supabase.from('user_profiles').delete().eq('id', id)

    // Supprimer l'auth user
    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}
