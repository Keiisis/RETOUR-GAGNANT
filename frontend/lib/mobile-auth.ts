import { createClient } from '@supabase/supabase-js'

// ══════════════════════════════════════════════════════════════
// Auth API mobile : dérive l'identité du client depuis le JETON
// (Authorization: Bearer <access_token>), jamais depuis un client_id
// fourni dans la requête. Corrige l'IDOR sur /api/mobile/*.
// ══════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/** Retourne l'id du client authentifié via le Bearer token, ou null. */
export async function getMobileUserId(request: Request): Promise<string | null> {
    const authz = request.headers.get('authorization') || ''
    const token = authz.startsWith('Bearer ') ? authz.slice(7).trim() : ''
    if (!token || !supabaseUrl || !supabaseAnonKey) return null
    try {
        const supa = createClient(supabaseUrl, supabaseAnonKey)
        const { data, error } = await supa.auth.getUser(token)
        if (error || !data?.user) return null
        return data.user.id
    } catch {
        return null
    }
}
