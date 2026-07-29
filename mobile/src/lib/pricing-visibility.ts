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
            // `fetch` ne lève PAS sur un 4xx/5xx : sans ce test, une réponse
            // { error: "Accès refusé." } passait pour un réglage absent et on
            // retombait sur « prix visible » — l'inverse de ce qu'il faut.
            if (!res.ok) return false
            const json = await res.json().catch(() => null)
            const settings = json?.settings
            if (!settings || typeof settings !== 'object') return false

            const global = settings.services_show_calculator
            const legacy = settings.passeport_show_calculator
            // On n'affiche un tarif QUE si le réglage l'autorise explicitement.
            // Toute autre situation (clé absente, valeur inattendue, panne)
            // masque le prix : mieux vaut taire un montant que d'en annoncer
            // un que le site n'affiche pas.
            if (global === 'true') return true
            if (global === undefined && legacy === 'true') return true
            return false
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
