// ══════════════════════════════════════════════════════════════
//  Garde des ACTIONS SERVEUR ('use server').
//
//  Une action serveur est une route HTTP comme une autre : n'importe qui peut
//  l'appeler, connecté ou non, dès lors qu'elle est importée par une page.
//  Celles des propositions de séjour (`app/actions/ai-proposals.ts`) lisaient
//  et réécrivaient les prix avec la clé service SANS vérifier qui appelait.
//
//  exigerEquipe() lit la session dans les cookies et le rôle dans
//  `user_profiles` ; elle LÈVE une erreur si l'appelant n'est pas de l'équipe.
// ══════════════════════════════════════════════════════════════
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseServeur } from '@/lib/supabase-serveur'

const ROLES_ADMIN = ['admin', 'super_admin', 'superadmin', 'ceo']
const ROLES_EQUIPE = [...ROLES_ADMIN, 'agent']

export interface Equipier { userId: string; role: string; isAdmin: boolean }

export async function exigerEquipe(niveau: 'agent' | 'admin' = 'agent'): Promise<Equipier> {
    const jar = await cookies()
    const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: { getAll: () => jar.getAll(), setAll: () => { /* lecture seule */ } },
    })
    const { data } = await sb.auth.getUser()
    const userId = data?.user?.id
    if (!userId) throw new Error('Non authentifié')

    const { data: profil } = await supabaseServeur.from('user_profiles').select('role').eq('id', userId).maybeSingle()
    const role = String(profil?.role || '')
    const autorises = niveau === 'admin' ? ROLES_ADMIN : ROLES_EQUIPE
    if (!autorises.includes(role)) throw new Error('Accès réservé à l’équipe')
    return { userId, role, isAdmin: ROLES_ADMIN.includes(role) }
}
