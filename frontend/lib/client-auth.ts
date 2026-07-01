import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

// ══════════════════════════════════════════════════════════════
// Identité du client connecté via la session Supabase (cookies).
// Utilisé par les routes /api/client/* qui ne relèvent pas d'un rôle
// staff (verifyApiAuth) mais d'un simple client authentifié.
// ══════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function getClientUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
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
