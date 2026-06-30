// ═══════════════════════════════════════════════════════════════
// Normalisation multi-devises → XOF (Franc CFA, devise de référence)
// ═══════════════════════════════════════════════════════════════
// Problème corrigé : les KPI compta sommaient `total`/`amount`/`montant`
// à travers EUR/USD/XOF sans conversion (ex. recherche-ancestrale = 250 €).
// Résultat : « 250 + 150000 = 150250 FCFA » → tous les agrégats faux.
//
// Ancrage : le XOF est en parité FIXE avec l'EUR (1 EUR = 655,957 XOF),
// donc EUR↔XOF est EXACT. USD/GBP/HTG fluctuent → taux indicatifs,
// surchargeables via `setRates()` (ex. depuis settings ou une API de change).

export type SupportedCurrency = 'XOF' | 'XAF' | 'EUR' | 'USD' | 'GBP' | 'HTG'

// Taux : combien de XOF pour 1 unité de la devise.
const DEFAULT_RATES: Record<string, number> = {
    XOF: 1,
    XAF: 1,          // parité 1:1 CFA Ouest/Centrale
    EUR: 655.957,    // parité FIXE (exacte)
    USD: 600,        // indicatif (≈ EUR/1.09)
    GBP: 765,        // indicatif
    HTG: 4.5,        // indicatif (gourde haïtienne)
}

let RATES: Record<string, number> = { ...DEFAULT_RATES }

/** Surcharge les taux (ex. au chargement depuis settings/une API de change). */
export function setRates(overrides: Partial<Record<string, number>>) {
    RATES = { ...DEFAULT_RATES }
    for (const [k, v] of Object.entries(overrides)) {
        if (typeof v === 'number' && isFinite(v) && v > 0) RATES[k.toUpperCase()] = v
    }
}

/** Taux courant (XOF pour 1 unité), 1 si devise inconnue (fail-safe non destructif). */
export function rateOf(currency?: string | null): number {
    if (!currency) return 1
    return RATES[currency.toUpperCase()] ?? 1
}

/** Convertit un montant vers XOF. Devise absente/inconnue → traité comme XOF. */
export function toXOF(amount: number | null | undefined, currency?: string | null): number {
    const n = Number(amount)
    if (!isFinite(n)) return 0
    return Math.round(n * rateOf(currency))
}

/** Somme normalisée en XOF d'une liste d'objets {montant, devise}. */
export function sumXOF<T>(
    rows: T[],
    amount: (row: T) => number | null | undefined,
    currency: (row: T) => string | null | undefined,
): number {
    return rows.reduce((s, r) => s + toXOF(amount(r), currency(r)), 0)
}

/**
 * Alimente les taux depuis la table `currencies` (source de vérité projet).
 * `exchange_rate_to_base` = nb de XOF pour 1 unité de la devise.
 * Rafraîchie quotidiennement par /api/cron/exchange-rates depuis une vraie API FX.
 */
export function setRatesFromCurrencies(
    rows: Array<{ code?: string | null; exchange_rate_to_base?: number | string | null; is_base?: boolean | null }>,
) {
    const overrides: Record<string, number> = {}
    for (const r of rows) {
        if (!r.code) continue
        const rate = r.is_base ? 1 : Number(r.exchange_rate_to_base)
        if (isFinite(rate) && rate > 0) overrides[r.code.toUpperCase()] = rate
    }
    if (Object.keys(overrides).length > 0) setRates(overrides)
}

/**
 * Charge les taux réels depuis l'API projet (`/api/settings/currency`) et les
 * applique via setRates(). À appeler au montage des pages compta (côté client).
 * Échec silencieux : on retombe sur les taux par défaut (EUR exact + indicatifs).
 */
export async function loadExchangeRates(): Promise<void> {
    try {
        const res = await fetch('/api/settings/currency')
        if (!res.ok) return
        const rows = await res.json()
        if (Array.isArray(rows)) setRatesFromCurrencies(rows)
    } catch {
        /* taux par défaut conservés */
    }
}
