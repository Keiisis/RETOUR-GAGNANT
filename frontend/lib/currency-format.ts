/* ═══════════════════════════════════════════════════════════
   LE FORMATAGE DES MONTANTS — module PUR, sans aucune dépendance.

   Pourquoi séparé de `lib/currency.ts` : celui-ci importe le client Supabase
   (pour les taux de change en base). L'embarquer dans une route serveur ou un
   générateur de PDF pour la seule mise en forme d'un nombre traînerait tout ce
   code avec lui. Ici : des tables et des fonctions, rien d'autre.

   RÈGLE ABSOLUE. Un montant ne s'affiche JAMAIS sans la devise de SON
   enregistrement. Chaque page qui a réinventé sa propre mise en forme a fini
   par forcer le FCFA — c'est ainsi qu'une facture de 306 $ s'est affichée
   « 306 F CFA » dans le panel agent, chiffre faux dans un registre comptable.
   Une seule table, un seul point d'entrée, aucune copie locale.
═══════════════════════════════════════════════════════════ */

export type CurrencyCode = 'XOF' | 'EUR' | 'USD' | 'GBP' | 'HTG'

export interface CurrencyInfo {
    code: CurrencyCode
    symbol: string
    name: string
    locale: string
    decimals: number
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
    XOF: { code: 'XOF', symbol: 'FCFA', name: 'Franc CFA', locale: 'fr-FR', decimals: 0 },
    EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'fr-FR', decimals: 2 },
    USD: { code: 'USD', symbol: '$', name: 'Dollar US', locale: 'en-US', decimals: 2 },
    GBP: { code: 'GBP', symbol: '£', name: 'Livre Sterling', locale: 'en-GB', decimals: 2 },
    HTG: { code: 'HTG', symbol: 'HTG', name: 'Gourde Haïtienne', locale: 'fr-HT', decimals: 2 },
}

/**
 * Normalise un code de devise venu de la BASE ou d'un formulaire.
 *
 * La colonne `currency` peut valoir `null` (anciens enregistrements), `'FCFA'`
 * (saisie humaine), une casse quelconque, ou un code inconnu. Sans passage par
 * ici, chaque page interprétait ces cas à sa façon — et divergeait.
 */
export function asCurrency(code?: string | null): CurrencyCode {
    const c = String(code || '').trim().toUpperCase()
    if (!c || c === 'FCFA' || c === 'CFA' || c === 'F CFA') return 'XOF'
    return (c in CURRENCIES ? c : 'XOF') as CurrencyCode
}

/** Formate un prix dans une devise CONNUE. */
export const formatPrice = (amount: number, currency: CurrencyCode = 'XOF'): string => {
    const info = CURRENCIES[currency]
    const formatted = new Intl.NumberFormat(info.locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: info.decimals,
    }).format(amount)

    if (currency === 'XOF') return `${formatted} FCFA`
    if (currency === 'EUR') return `${formatted} €`
    if (currency === 'USD') return `$${formatted}`
    if (currency === 'GBP') return `£${formatted}`
    if (currency === 'HTG') return `HTG ${formatted}`
    return `${formatted} ${currency}`
}

/**
 * Formate un montant DANS LA DEVISE DE SON DOCUMENT, à partir du code brut
 * lu en base. C'est CETTE fonction qu'appellent les écrans et les documents.
 */
export const formatMontant = (amount: number, code?: string | null): string =>
    formatPrice(amount, asCurrency(code))
