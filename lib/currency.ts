// ═══════════════════════════════════════════════════════════
// SYSTÈME DE DEVISES — XOF (FCFA), EUR (€), USD ($)
// Conversion automatique selon la localisation
// ═══════════════════════════════════════════════════════════

export type CurrencyCode = 'XOF' | 'EUR' | 'USD'

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
}

// Taux de conversion de base (1 EUR = ...)
// Le FCFA est arrimé à l'Euro : 1 EUR = 655.957 XOF (taux fixe)
const BASE_RATES: Record<CurrencyCode, number> = {
    EUR: 1,
    XOF: 655.957,
    USD: 1.08, // approximation — sera mis à jour
}

const cachedRates: Record<CurrencyCode, number> = { ...BASE_RATES }
let lastFetch = 0

/**
 * Met à jour les taux depuis une API gratuite (fallback aux taux fixes)
 */
export const refreshRates = async (): Promise<void> => {
    // Refresh max toutes les 6h
    if (Date.now() - lastFetch < 6 * 3600 * 1000) return
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/EUR', { next: { revalidate: 21600 } })
        if (res.ok) {
            const data = await res.json()
            if (data.rates) {
                cachedRates.USD = data.rates.USD || BASE_RATES.USD
                cachedRates.XOF = data.rates.XOF || BASE_RATES.XOF
                lastFetch = Date.now()
            }
        }
    } catch {
        // fallback silencieux aux taux fixes
    }
}

/**
 * Convertit un montant d'une devise à une autre
 */
export const convertCurrency = (amount: number, from: CurrencyCode, to: CurrencyCode): number => {
    if (from === to) return amount
    // Convertir en EUR d'abord (base), puis vers la devise cible
    const inEur = amount / cachedRates[from]
    const result = inEur * cachedRates[to]
    return CURRENCIES[to].decimals === 0 ? Math.round(result) : Math.round(result * 100) / 100
}

/**
 * Formate un prix avec le symbole de sa devise
 */
export const formatPrice = (amount: number, currency: CurrencyCode = 'XOF'): string => {
    const info = CURRENCIES[currency]
    const formatted = new Intl.NumberFormat(info.locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: info.decimals,
    }).format(amount)

    if (currency === 'XOF') return `${formatted} FCFA`
    if (currency === 'EUR') return `${formatted} €`
    if (currency === 'USD') return `$${formatted}`
    return `${formatted} ${currency}`
}

/**
 * Formate un prix avec conversion + affichage multi-devises
 * Ex: "164 000 FCFA" ou "$250" selon la devise de l'utilisateur
 */
export const formatPriceConverted = (
    amount: number,
    baseCurrency: CurrencyCode,
    displayCurrency: CurrencyCode
): string => {
    const converted = convertCurrency(amount, baseCurrency, displayCurrency)
    return formatPrice(converted, displayCurrency)
}

/**
 * Détecte la devise préférée selon la timezone/locale du navigateur
 */
export const detectUserCurrency = (): CurrencyCode => {
    if (typeof window === 'undefined') return 'XOF'

    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
        const lang = navigator.language || ''

        // Zones Afrique de l'Ouest (FCFA)
        const xofZones = ['Africa/Porto-Novo', 'Africa/Cotonou', 'Africa/Dakar', 'Africa/Bamako',
            'Africa/Ouagadougou', 'Africa/Abidjan', 'Africa/Niamey', 'Africa/Lome',
            'Africa/Bissau', 'Africa/Conakry']
        if (xofZones.some(z => tz.includes(z.split('/')[1]))) return 'XOF'

        // Zones Europe
        if (tz.startsWith('Europe/') || lang.startsWith('fr-FR') || lang.startsWith('de') ||
            lang.startsWith('it') || lang.startsWith('es-ES') || lang.startsWith('nl') ||
            lang.startsWith('pt-PT')) return 'EUR'

        // Zones USD
        if (tz.startsWith('America/') || lang.startsWith('en-US')) return 'USD'

        // Fallback : si francophone → XOF (diaspora africaine)
        if (lang.startsWith('fr')) return 'XOF'

        return 'USD'
    } catch {
        return 'XOF'
    }
}

/**
 * Retourne les taux actuels pour affichage
 */
export const getCurrentRates = () => ({ ...cachedRates })
