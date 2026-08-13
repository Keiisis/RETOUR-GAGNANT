// TVA « en sus » (miroir de frontend/lib/tax.ts). Le prix saisi est HORS TAXE ;
// la TVA 18 % s'AJOUTE : le client paie le TTC. Sur mobile, les montants au
// checkout sont en XOF (FCFA, sans décimale) → arrondi entier.
export const TVA_RATE = 18

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
