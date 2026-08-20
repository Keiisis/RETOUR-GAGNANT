// ══════════════════════════════════════════════════════════════
//  Retrouver un compte par son adresse — sans balayer toute la base.
//
//  Le motif employé jusqu'ici était `listUsers({ perPage: 1000 })` suivi d'un
//  `.find()` en mémoire. Il a deux défauts, et le second est grave :
//
//    · il télécharge jusqu'à mille comptes pour en lire un ;
//    · il ne regarde QUE LA PREMIÈRE PAGE. Au-delà de mille inscrits, le
//      millier-et-unième devient introuvable. Sur la route de renvoi de
//      confirmation, cela se traduisait par un « succès » silencieux : le
//      client ne reçoit jamais son email, et rien ne le signale.
//
//  Ici, on passe par `client_profiles` — que l'inscription renseigne toujours —
//  pour obtenir l'identifiant, puis on lit le compte par son identifiant. Deux
//  requêtes bornées, quelle que soit la taille de la base.
//
//  Le repli paginé n'existe que pour les comptes créés hors de ce chemin
//  (import, création manuelle en console) : rare, borné, et jamais silencieux.
// ══════════════════════════════════════════════════════════════
import type { SupabaseClient, User } from '@supabase/supabase-js'

/** Garde-fou du repli : au-delà, on préfère répondre « introuvable » qu'occuper
 *  la fonction pendant des minutes. 50 pages de 200 = 10 000 comptes. */
const PAGES_MAX = 50
const TAILLE_PAGE = 200

export async function trouverUtilisateurParEmail(
    supabase: SupabaseClient,
    email: string,
): Promise<User | null> {
    const adresse = String(email || '').toLowerCase().trim()
    if (!adresse) return null

    // 1. Voie nominale : le profil porte l'identifiant du compte.
    const { data: profil } = await supabase
        .from('client_profiles')
        .select('id')
        .ilike('email', adresse)
        .maybeSingle()

    if (profil?.id) {
        const { data } = await supabase.auth.admin.getUserById(profil.id)
        if (data?.user) return data.user
    }

    // 2. Repli : comptes sans profil (import, création en console).
    for (let page = 1; page <= PAGES_MAX; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: TAILLE_PAGE })
        if (error) break
        const lot = data?.users ?? []
        const trouve = lot.find(u => (u.email || '').toLowerCase() === adresse)
        if (trouve) return trouve
        if (lot.length < TAILLE_PAGE) break   // dernière page atteinte
    }

    return null
}

/** Vrai si l'adresse correspond déjà à un compte (création, anti-doublon). */
export async function emailDejaPris(supabase: SupabaseClient, email: string): Promise<boolean> {
    return (await trouverUtilisateurParEmail(supabase, email)) !== null
}

/**
 * Tous les comptes, page après page.
 *
 * `listUsers({ perPage: 500 })` ne rend QUE la première page : passé cinq
 * cents inscrits, un agent créé plus tard disparaissait purement et
 * simplement du panel d'administration. Ici on parcourt jusqu'au bout, avec
 * la même borne de sécurité que la recherche par adresse.
 */
export async function listerTousLesComptes(supabase: SupabaseClient): Promise<User[]> {
    const tous: User[] = []
    for (let page = 1; page <= PAGES_MAX; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: TAILLE_PAGE })
        if (error) break
        const lot = data?.users ?? []
        tous.push(...lot)
        if (lot.length < TAILLE_PAGE) break
    }
    return tous
}
