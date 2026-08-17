// ══════════════════════════════════════════════════════════════
//  TVA : source unique
//
//  Règle métier (confirmée) : le prix SAISI est le prix normal, HORS
//  TAXE. La TVA s'AJOUTE dessus. Un service à 100 est facturé 118 au
//  client (100 HT + 18 % = 118 TTC).
//
//  Le taux (18 %) est le taux légal DGI du Bénin : une constante légale,
//  pas un prix. Centralisé ici : un seul endroit à changer si la loi
//  évolue, et une seule formule pour le paiement, le devis, la facture
//  et la comptabilité (jamais de calcul divergent).
// ══════════════════════════════════════════════════════════════

/**
 * Taux de TVA effectif appliqué au client.
 *
 * ⚠️ EXONÉRATION EN COURS (décision 2026-08-17) : Retour Gagnant Bénin est
 * actuellement exonéré de TVA → taux ramené à **0 %**. AUCUNE TVA n'est
 * appliquée, ni sur le site ni sur l'application mobile. Le prix saisi = le
 * prix payé (HT === TTC).
 *
 * Levier unique : remettre `18` ici (et dans `mobile/src/lib/tax.ts`) suffit à
 * réactiver la TVA partout — tous les calculs et libellés dérivent de cette
 * constante et de `TVA_ENABLED` / `TVA_LABEL`. Ne jamais recoder un `0.18` ni
 * un « 18 % » en dur ailleurs.
 */
export const TVA_RATE = 0

/** Vrai seulement quand la TVA s'applique réellement (taux > 0). */
export const TVA_ENABLED = TVA_RATE > 0

/** Libellé de la ligne TVA (« TVA 18 % »), aligné sur le taux effectif. */
export const TVA_LABEL = `TVA ${TVA_RATE} %`

/** Devises sans décimale (le franc CFA se compte à l'unité). */
const ZERO_DECIMAL = new Set(['XOF', 'FCFA', 'XAF', 'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XPF'])

/** Arrondi selon la devise : entier pour le XOF, au centime sinon. */
export function roundMoney(amount: number, currency?: string | null): number {
    const cur = String(currency || 'XOF').toUpperCase()
    return ZERO_DECIMAL.has(cur) ? Math.round(amount) : Math.round(amount * 100) / 100
}

export interface TaxBreakdown {
    /** Base hors taxe (le prix saisi). */
    ht: number
    /** Montant de TVA ajouté. */
    tva: number
    /** Toutes taxes comprises = ce que le client paie. */
    ttc: number
}

/**
 * Décompose un montant HORS TAXE en { ht, tva, ttc }.
 *
 * La TVA et le TTC sont dérivés du HT, puis la TVA est recalculée par
 * différence (ttc − ht) pour garantir `ht + tva === ttc` au centime,
 * quelle que soit la devise. À utiliser sur le TOTAL (pas ligne à ligne)
 * pour éviter toute dérive d'arrondi cumulée.
 *
 *   fromHt(100, 'EUR')  ->  { ht: 100, tva: 18, ttc: 118 }
 *   fromHt(100, 'XOF')  ->  { ht: 100, tva: 18, ttc: 118 }
 */
export function fromHt(htRaw: number, currency?: string | null): TaxBreakdown {
    const ht = roundMoney(htRaw || 0, currency)
    const ttc = roundMoney(ht * (1 + TVA_RATE / 100), currency)
    const tva = roundMoney(ttc - ht, currency)
    return { ht, tva, ttc }
}

/** TTC à partir d'un HT (raccourci quand seul le montant à charger importe). */
export function ttcFromHt(htRaw: number, currency?: string | null): number {
    return fromHt(htRaw, currency).ttc
}
