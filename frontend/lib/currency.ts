import { supabase } from '@/lib/supabase'
import type { LangCode } from '@/lib/translation/constants'

// ═══════════════════════════════════════════════════════════
// SYSTÈME DE DEVISES ERP (DB-BACKED) : XOF (FCFA), EUR (€), USD ($)
// Conversion automatique synchronisée avec l'ERP
// Devise affichée = f(langue active) : mapping ci-dessous
// ═══════════════════════════════════════════════════════════

export type CurrencyCode = 'XOF' | 'EUR' | 'USD' | 'GBP' | 'HTG'

// ── Mapping Langue → Devises ──────────────────────────────
// fr, es, cr → XOF (FCFA) par défaut, EUR disponible
// en, pt → USD ($) uniquement
// ht → HTG (Gourde) uniquement
export const LANG_CURRENCY_CONFIG: Record<LangCode, {
    default: CurrencyCode
    allowed: CurrencyCode[]
}> = {
    fr: { default: 'EUR', allowed: ['EUR', 'XOF'] },
    es: { default: 'EUR', allowed: ['EUR', 'XOF'] },
    cr: { default: 'EUR', allowed: ['EUR', 'XOF'] },
    en: { default: 'USD', allowed: ['USD'] },
    pt: { default: 'USD', allowed: ['USD'] },
    ht: { default: 'HTG', allowed: ['HTG', 'USD'] },
}

/** Retourne la devise par défaut pour une langue donnée */
export function getCurrencyForLang(lang: LangCode): CurrencyCode {
    return LANG_CURRENCY_CONFIG[lang]?.default || 'XOF'
}

/** Retourne les devises autorisées pour une langue donnée */
export function getAllowedCurrencies(lang: LangCode): CurrencyCode[] {
    return LANG_CURRENCY_CONFIG[lang]?.allowed || ['XOF', 'EUR']
}

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

// Taux de conversion de base (1 XOF = ... XOF, 1 EUR = 655.957 XOF) 
// Ces taux sont des fallbacks si la BD est indisponible.
// Tout est calculé par rapport à la devise de BASE (XOF).
const BASE_RATES_TO_XOF: Record<CurrencyCode, number> = {
    XOF: 1,
    EUR: 655.957,
    USD: 600.00, // Sera remplacé par la DB
    GBP: 760.00, // Sera remplacé par la DB
    HTG: 4.2591, // 80 000 XOF ≈ HTG 18 783 (vérifié Mai 2026 : sera remplacé par la DB)
}

const cachedRates: Record<CurrencyCode, number> = { ...BASE_RATES_TO_XOF }
let lastFetch = 0

/**
 * Invalide le cache et force le rechargement des taux depuis la DB au prochain appel.
 * À appeler après une sauvegarde depuis l'admin.
 */
export const forceRefreshRates = async (): Promise<void> => {
    lastFetch = 0
    await refreshRates()
}

/**
 * Met à jour les taux depuis la table Supabase `currencies`
 */
export const refreshRates = async (): Promise<void> => {
    // Refresh max toutes les heures
    if (Date.now() - lastFetch < 3600 * 1000) return
    try {
        const { data, error } = await supabase
            .from('currencies')
            .select('code, exchange_rate_to_base')

        if (!error && data && data.length > 0) {
            for (const row of data) {
                if (row.code in cachedRates) {
                    cachedRates[row.code as CurrencyCode] = Number(row.exchange_rate_to_base)
                }
            }
            lastFetch = Date.now()
        }
    } catch {
        // fallback silencieux aux taux par défaut
        console.warn('Erreur chargement devises DB, utilisation du cache/fallback.')
    }
}

/**
 * Convertit un montant d'une devise à une autre en passant par le XOF.
 * 
 * Ex: EUR -> USD => (EUR * Taux_EUR_to_XOF) / Taux_USD_to_XOF
 */
export const convertCurrency = (amount: number, from: CurrencyCode, to: CurrencyCode): number => {
    if (from === to) return amount
    
    // Convertir de "from" vers "XOF"
    const amountInXOF = amount * cachedRates[from]
    
    // Convertir de "XOF" vers "to"
    const result = amountInXOF / cachedRates[to]

    // Arrondi au-dessus (ceil) pour que la reconversion couvre toujours le montant XOF original
    return CURRENCIES[to].decimals === 0 ? Math.ceil(result) : Number(Math.ceil(Number(result + 'e2')) + 'e-2')
}

/**
 * Formate un prix avec le symbole de sa devise locale.
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
    if (currency === 'GBP') return `£${formatted}`
    if (currency === 'HTG') return `HTG ${formatted}`
    return `${formatted} ${currency}`
}

/**
 * Formate un prix avec conversion + affichage multi-devises
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

        // Haïti → HTG (Gourde)
        if (tz.includes('Port-au-Prince') || tz.includes('Port_au_Prince')) return 'HTG'

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
 * Retourne les taux actuels (exprimés en multiplicateur vers le XOF)
 */
export const getCurrentRates = () => ({ ...cachedRates })

/**
 * Version synchrone pour le rendu immédiat (Utilise le cache local s'il existe, ou le fallback)
 * À utiliser dans des composants React où l'async n'est pas idéal.
 */
export function formatCurrencySync(amount: number, currencyCode: CurrencyCode): string {
    const symbol = CURRENCIES[currencyCode]?.symbol || currencyCode
    
    if (currencyCode === 'XOF') {
        return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${symbol}`
    }
    return `${amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$& ')} ${symbol}`
}

export function convertFromBaseSync(amountBase: number, targetCurrency: CurrencyCode): number {
    const rate = cachedRates[targetCurrency] || 1

    if (targetCurrency === 'XOF') return Math.round(amountBase)
    return Number((amountBase / rate).toFixed(2))
}

// ═══════════════════════════════════════════════════════════
// CONVERSION AVEC MARGE : pour les paiements multi-devises
// Marge 3% pour couvrir les frais de conversion et de traitement
// ═══════════════════════════════════════════════════════════

export const CONVERSION_MARGIN = 0.06

/**
 * Calcule le montant à envoyer à la passerelle avec la marge de 6%.
 * La marge est TOUJOURS appliquée, quelle que soit la devise.
 * XOF → XOF : montant × 1.06
 * XOF → EUR/USD/GBP : taux de conversion × 1.06
 */
export const convertWithMargin = (amountXOF: number, to: CurrencyCode): number => {
    // Marge appliquée sur TOUS les paiements (frais de service 6%)
    if (to === 'XOF') return Math.round(amountXOF * (1 + CONVERSION_MARGIN))
    const raw = convertCurrency(amountXOF, 'XOF', to)
    return Number((raw * (1 + CONVERSION_MARGIN)).toFixed(2))
}

/**
 * Formate un montant XOF converti avec marge dans la devise cible.
 * Ex: formatPriceWithMargin(150000, 'EUR') → "235,93 €"
 */
export const formatPriceWithMargin = (amountXOF: number, to: CurrencyCode): string => {
    return formatPrice(convertWithMargin(amountXOF, to), to)
}
