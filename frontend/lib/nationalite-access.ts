// ══════════════════════════════════════════════════════════════
//  Accès ADMIN à l'onglet DEMANDES DE NATIONALITÉ.
//
//  Les agents ont une vue réduite de l'onglet. L'agent désigné ici reçoit
//  l'interface admin complète (lecture, édition, création, suppression,
//  invitations, réinitialisation des pièces) : Nadjath TIAMIOU.
//
//  Pour ouvrir l'accès à un autre agent un jour : ajouter son id ici.
// ══════════════════════════════════════════════════════════════

/** Agent(s) ayant les droits admin sur l'onglet Nationalité. */
export const NATIONALITE_AGENT_IDS = [
    'bc0f9750-3737-4817-9690-ff9bd4d4270d', // Nadjath RGB (tiamiounadjathrgb@gmail.com)
]

export function isNationaliteAgent(userId?: string | null): boolean {
    return !!userId && NATIONALITE_AGENT_IDS.includes(userId)
}
