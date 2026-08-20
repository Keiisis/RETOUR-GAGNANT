import { NextRequest, NextResponse } from 'next/server'
import { listerTousLesComptes } from '@/lib/auth-lookup'
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
    /* Toutes les pages : a cinq cents comptes, la liste s'arretait la et un
       agent cree apres ce seuil devenait invisible dans le panel. */
    const [comptes, profilesRes, clientIdsRes] = await Promise.all([
        listerTousLesComptes(supabase),
        supabase.from('user_profiles').select('id, full_name, role, is_active, last_seen_at, created_at'),
        supabase.from('client_profiles').select('id'),
    ])

    const profileMap  = new Map((profilesRes.data || []).map(p => [p.id, p]))
    // Set des IDs clients pour exclusion stricte
    const clientIdSet = new Set((clientIdsRes.data || []).map((c: { id: string }) => c.id))

    const VALID_ROLES = ['agent', 'admin', 'super_admin', 'superadmin']

    const users = comptes
        .filter(u => {
            // Exclure les clients purs : dans client_profiles ET pas dans user_profiles
            if (clientIdSet.has(u.id) && !profileMap.has(u.id)) return false

            // Inclure si user_profiles avec rôle valide
            const profile = profileMap.get(u.id)
            if (profile && VALID_ROLES.includes(profile.role)) return true

            // Inclure si user_metadata.role valide (agents créés avant user_profiles : ex: Nadjath)
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
