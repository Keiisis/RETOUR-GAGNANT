// ══════════════════════════════════════════════════════════════
//  Moyens de règlement acceptés hors passerelle en ligne (création
//  manuelle d'un dossier de nationalité : /api/admin/nationalite).
//  Déplacé hors du fichier route.ts : Next.js n'y admet que les handlers.
// ══════════════════════════════════════════════════════════════

/** Moyens de règlement acceptés hors passerelle en ligne. */
export const MOYENS_PAIEMENT = {
    /* Demande sans frais depuis l'agrément (nov. 2026) : cas par défaut.
       Rien n'est encaissé, donc aucune facture. */
    gratuit: 'Gratuit (agence agréée)',
    momo: 'Mobile Money',
    rib: 'Virement bancaire (RIB)',
    kkiapay: 'Kkiapay',
    taptap: 'TapTap Send',
    especes: 'Espèces',
    autre: 'Autre',
    /* Dossier offert : aucune somme n est encaissee, donc aucune facture.
       Present dans la liste pour que le moyen soit NOMME plutot que devine. */
    invitation: "Code d'invitation (offert)",
} as const

export type MoyenPaiement = keyof typeof MOYENS_PAIEMENT
