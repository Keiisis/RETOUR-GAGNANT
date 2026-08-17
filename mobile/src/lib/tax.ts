// Miroir de frontend/lib/tax.ts.
// ⚠️ EXONÉRATION EN COURS (2026-08-17) : Retour Gagnant Bénin est exonéré de TVA
// → taux 0 %. Aucune TVA appliquée sur mobile (comme sur le web). Prix saisi =
// prix payé. Remettre 18 ici ET dans frontend/lib/tax.ts pour réactiver.
export const TVA_RATE = 0

/** Vrai seulement quand la TVA s'applique réellement (taux > 0). */
export const TVA_ENABLED = TVA_RATE > 0

/** Libellé de la ligne TVA, aligné sur le taux effectif. */
export const TVA_LABEL = `TVA ${TVA_RATE}%`

/** TTC = HT + TVA. Pour XOF (zéro décimale), on arrondit à l'entier. */
export function ttcFromHt(htXof: number): number {
    const ht = Number(htXof) || 0
    if (ht <= 0) return 0
    return Math.round(ht * (1 + TVA_RATE / 100))
}

/** Montant de TVA seul (TTC − HT), cohérent avec ttcFromHt. */
export function tvaFromHt(htXof: number): number {
    return ttcFromHt(htXof) - (Number(htXof) || 0)
}
