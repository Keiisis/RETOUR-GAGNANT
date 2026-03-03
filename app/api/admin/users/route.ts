import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
    if (!serviceKey) return NextResponse.json({ error: 'Service key manquante' }, { status: 500 })

    const supabase = createClient(supabaseUrl, serviceKey)

    // Récupère tous les users auth + leurs profils
    const [authRes, profilesRes] = await Promise.all([
        supabase.auth.admin.listUsers({ perPage: 200 }),
        supabase.from('user_profiles').select('id, full_name, role, is_active, last_seen_at, created_at'),
    ])

    if (authRes.error) return NextResponse.json({ error: authRes.error.message }, { status: 500 })

    const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]))

    const users = authRes.data.users.map(u => {
        const profile = profileMap.get(u.id)
        return {
            id: u.id,
            email: u.email,
            full_name: profile?.full_name || u.user_metadata?.full_name || 'Sans nom',
            role: profile?.role || u.user_metadata?.role || 'agent',
            is_active: profile?.is_active ?? true,
            last_seen_at: profile?.last_seen_at || null,
            created_at: u.created_at,
        }
    })

    return NextResponse.json({ users })
}
