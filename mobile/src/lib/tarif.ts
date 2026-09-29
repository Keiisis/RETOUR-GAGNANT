/* ═══════════════════════════════════════════════════════════
   Montant présenté à Kkiapay : une seule règle pour tous les écrans
   de service (nationalité, recherche ancestrale, récap MyAfroOrigins).

   - Le tarif vient TOUJOURS de page_sections (le serveur fait foi) ;
     l'app ne saisit aucun prix.
   - Kkiapay n'encaisse que du XOF. Seule la parité EUR/XOF est FIXE
     (1 EUR = 655,957 XOF) : c'est la seule conversion sûre hors ligne.
     Une devise flottante (USD, GBP…) n'a pas de taux fiable côté
     téléphone : on refuse d'encaisser plutôt que de facturer 250 XOF
     pour 250 $ (même famille d'erreur que l'incident des 0,39 EUR).
   - La TVA s'ajoute au HT (lib/tax, miroir du web — taux effectif lu
     dans ce fichier, 0 % pendant l'exonération).
═══════════════════════════════════════════════════════════ */
import { ttcFromHt } from './tax'

export const EUR_TO_XOF = 655.957

/** Montant HT converti en XOF, ou `null` si la devise n'a pas de parité fixe. */
export function convertirEnXof(montant: number, devise: string | null | undefined): number | null {
    const m = Number(montant)
    if (!isFinite(m) || m <= 0) return null
    const d = String(devise || 'XOF').toUpperCase()
    if (d === 'XOF' || d === 'XAF' || d === 'FCFA') return Math.round(m)
    if (d === 'EUR') return Math.round(m * EUR_TO_XOF)
    return null
}

/** Montant TTC en XOF à présenter à la passerelle, ou `null` si impossible. */
export function montantAEncaisserXof(montant: number, devise: string | null | undefined): number | null {
    const xof = convertirEnXof(montant, devise)
    return xof === null ? null : ttcFromHt(xof)
}
