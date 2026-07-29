/* ═══════════════════════════════════════════════════════════
   AFFICHAGE DES TARIFS — même règle que le site public

   Le site ne montre PAS les prix sur les fiches de prestation : le réglage
   `services_show_calculator` vaut 'false' en base, ce qui masque le
   calculateur et toute mention tarifaire. Le parcours attendu est la prise
   de rendez-vous, pendant laquelle le devis se construit.

   L'app mobile affichait « À partir de 50 000 FCFA » alors que la page web
   correspondante n'affiche aucun montant : deux surfaces, deux discours.
   Ce module rétablit la règle unique.

   Exception documentée côté web (décision du 2026-07-03) : la Consultation
   Fa affiche ses tarifs (550 / 780 €) même quand le réglage global est
   désactivé, parce que la réservation se règle en ligne.
═══════════════════════════════════════════════════════════ */

import { fetchWithTimeout } from './fetch'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

/** Prestations qui affichent leurs tarifs quel que soit le réglage global. */
const ALWAYS_PRICED = new Set(['consultation-fa-racines'])

let cached: boolean | null = null
let inFlight: Promise<boolean> | null = null

/**
 * Le réglage global autorise-t-il l'affichage des tarifs ?
 * Par prudence, en cas d'échec réseau on renvoie `false` : mieux vaut taire
 * un prix que d'en annoncer un que le site n'affiche pas.
 */
export async function pricingEnabled(): Promise<boolean> {
    if (cached !== null) return cached
    if (inFlight) return inFlight

    inFlight = (async () => {
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/settings/frontend`, { timeoutMs: 8000 })
            const json = await res.json().catch(() => ({}))
            const global = json?.settings?.services_show_calculator
            const legacy = json?.settings?.passeport_show_calculator
            // Le toggle global a priorité, exactement comme sur le web.
            if (global === 'false') return false
            if (global === undefined && legacy === 'false') return false
            return true
        } catch {
            return false
        } finally {
            inFlight = null
        }
    })()

    cached = await inFlight
    return cached
}

/** Doit-on afficher un tarif pour CETTE prestation ? */
export function showPriceFor(slug: string | null | undefined, globalEnabled: boolean): boolean {
    if (ALWAYS_PRICED.has(String(slug || ''))) return true
    return globalEnabled
}
