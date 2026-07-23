// ══════════════════════════════════════════════════════════════
//  TAUX DE CHANGE — LECTURE SERVEUR FIABLE
//  Problème corrigé : lib/currency.ts garde les taux dans un cache
//  de module avec une garde d'1 h. En serverless, chaque instance a
//  SON cache → deux requêtes simultanées pouvaient convertir avec des
//  taux différents (montants facturés divergents).
//  Ici : lecture de la table `currencies` avec un cache TRÈS court
//  (30 s) et repli sur la parité fixe BCEAO pour l'EUR uniquement.
// ══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const TTL_MS = 30_000
// Seul repli admis : la parité EUR/XOF est FIXE (BCEAO, inchangeable).
// Aucune autre devise n'a de repli — mieux vaut refuser que facturer faux.
const FIXED_EUR_XOF = 655.957

let cache: { at: number; rates: Record<string, number> } | null = null

function db() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    )
}

/** Taux « 1 unité de devise = N XOF », lus en base (cache 30 s). */
export async function getRatesXOF(): Promise<Record<string, number>> {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.rates

    const rates: Record<string, number> = { XOF: 1, FCFA: 1, EUR: FIXED_EUR_XOF }
    try {
        const { data } = await db().from('currencies').select('code, exchange_rate_to_base, is_base')
        for (const c of data || []) {
            const code = String(c.code || '').toUpperCase()
            const r = c.is_base ? 1 : Number(c.exchange_rate_to_base)
            if (code && isFinite(r) && r > 0) rates[code] = r
        }
    } catch {
        // Repli silencieux : seules XOF et EUR restent fiables
    }
    cache = { at: Date.now(), rates }
    return rates
}

/**
 * Convertit un montant vers le XOF.
 * Renvoie `null` si le taux de la devise est inconnu — l'appelant DOIT
 * traiter ce cas plutôt que de facturer un montant approximatif.
 */
export async function toXOFStrict(amount: number, currency?: string | null): Promise<number | null> {
    const cur = String(currency || 'XOF').toUpperCase()
    const n = Number(amount)
    if (!isFinite(n)) return null
    const rates = await getRatesXOF()
    const rate = rates[cur]
    if (!rate || !isFinite(rate) || rate <= 0) return null
    return Math.round(n * rate)
}

/** Variante non bloquante : renvoie le montant tel quel si le taux manque. */
export async function toXOFLoose(amount: number, currency?: string | null): Promise<number> {
    const v = await toXOFStrict(amount, currency)
    return v === null ? Math.round(Number(amount) || 0) : v
}
