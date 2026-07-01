import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

// ══════════════════════════════════════════════════════════════
// Identité du client connecté. Accepte DEUX modes d'auth :
//   • Cookies de session (panel web)
//   • Authorization: Bearer <access_token> (app mobile)
// Utilisé par les routes /api/client/* (client authentifié, sans rôle staff).
// ══════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function getClientUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
    // 1. Bearer token (mobile)
    const authz = request.headers.get('authorization') || ''
    const token = authz.startsWith('Bearer ') ? authz.slice(7).trim() : ''
    if (token) {
        try {
            const supa = createClient(supabaseUrl, supabaseAnonKey)
            const { data, error } = await supa.auth.getUser(token)
            if (!error && data?.user) return { id: data.user.id, email: (data.user.email || '').toLowerCase() }
        } catch { /* on tente les cookies ensuite */ }
    }

    // 2. Cookies de session (web)
    try {
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} },
        })
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null
        return { id: user.id, email: (user.email || '').toLowerCase() }
    } catch {
        return null
    }
}
