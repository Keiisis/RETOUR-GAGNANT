// ══════════════════════════════════════════════════════════════
//  Accès à la GESTION LOGEMENT (catalogue + contenu marketing).
//
//  Réservé aux administrateurs ET à UN SEUL agent nommément désigné :
//  Justamielle ALOULA-SAM. Aucun autre agent n'y a accès.
//
//  Pour ouvrir l'accès à un autre agent un jour : ajouter son id ici.
// ══════════════════════════════════════════════════════════════

/** Agent(s) autorisé(s) à gérer le Logement, en plus des admins. */
export const LOGEMENT_AGENT_IDS = [
    'f75318ac-1b21-49b7-b2d2-fa5e1e681f07', // Justamielle ALOULA-SAM
]

export function isLogementAgent(userId?: string | null): boolean {
    return !!userId && LOGEMENT_AGENT_IDS.includes(userId)
}
