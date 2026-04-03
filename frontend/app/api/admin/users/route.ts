import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    if (!serviceKey) return NextResponse.json({ error: 'Service key manquante' }, { status: 500 })

    const supabase = createClient(supabaseUrl, serviceKey)

    // Récupère users auth + profils agents/admins + IDs clients
    const [authRes, profilesRes, clientIdsRes] = await Promise.all([
        supabase.auth.admin.listUsers({ perPage: 500 }),
        supabase.from('user_profiles').select('id, full_name, role, is_active, last_seen_at, created_at'),
        supabase.from('client_profiles').select('id'),
    ])

    if (authRes.error) return NextResponse.json({ error: authRes.error.message }, { status: 500 })

    const profileMap  = new Map((profilesRes.data || []).map(p => [p.id, p]))
    // Set des IDs clients pour exclusion stricte
    const clientIdSet = new Set((clientIdsRes.data || []).map((c: { id: string }) => c.id))

    const VALID_ROLES = ['agent', 'admin', 'super_admin', 'superadmin', 'ceo']

    const users = authRes.data.users
        .filter(u => {
            // Exclure les clients purs : dans client_profiles ET pas dans user_profiles
            if (clientIdSet.has(u.id) && !profileMap.has(u.id)) return false

            // Inclure si user_profiles avec rôle valide
            const profile = profileMap.get(u.id)
            if (profile && VALID_ROLES.includes(profile.role)) return true

            // Inclure si user_metadata.role valide (agents créés avant user_profiles — ex: Nadjath)
            const metaRole = u.user_metadata?.role
            if (metaRole && VALID_ROLES.includes(metaRole)) return true

            return false
        })
        .map(u => {
            const profile = profileMap.get(u.id)
            // Priorité : last_sign_in_at de Supabase Auth (mis à jour automatiquement
            // à chaque connexion), puis last_seen_at de user_profiles (notre ping).
            // Cela affiche la vraie dernière connexion sans attendre de ping.
            const lastSeen = u.last_sign_in_at || profile?.last_seen_at || null
            return {
                id: u.id,
                email: u.email,
                full_name: profile?.full_name || u.user_metadata?.full_name || 'Sans nom',
                role: profile?.role || u.user_metadata?.role || 'agent',
                is_active: profile?.is_active ?? true,
                last_seen_at: lastSeen,
                created_at: u.created_at,
            }
        })

    return NextResponse.json({ users })
}
