import { supabase } from './supabase'

// ══════════════════════════════════════════════════════════════
// En-tête d'authentification pour les appels à /api/mobile/*.
// Le backend dérive l'identité du client de ce jeton (anti-IDOR) :
// il n'accepte plus un client_id fourni en clair dans la requête.
// ══════════════════════════════════════════════════════════════
export async function authHeaders(): Promise<Record<string, string>> {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
    } catch {
        return {}
    }
}
