// Montant Stripe calculé UNIQUEMENT côté serveur, depuis la commande en base (audit 2026-10-12, C3).
// Le navigateur choisit seulement la devise ; le montant ne vient jamais d'un en-tête.
// Même formule que le modal de paiement (convertWithMargin : frais de service de 6 % compris),
// avec les taux de la table `currencies` : le client paie exactement ce que l'écran lui annonçait.
import type { SupabaseClient } from '@supabase/supabase-js'
import { convertWithMargin, setRatesFromCurrencies } from '@/lib/currency-convert'

// Devises sans centimes : Stripe n'applique pas × 100
export const ZERO_DECIMAL = new Set([
    'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
    'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])
export const DEVISES_STRIPE = new Set(['XOF', 'EUR', 'USD', 'GBP', 'HTG'])

/** Charge les taux réels (table `currencies`) avant tout calcul. Échec : taux par défaut. */
export async function chargerTauxServeur(supabase: SupabaseClient): Promise<void> {
    const { data } = await supabase.from('currencies').select('code, exchange_rate_to_base, is_base')
    if (Array.isArray(data)) setRatesFromCurrencies(data)
}

/** Montant à encaisser, en unités mineures Stripe, pour une commande et la devise choisie. */
export function montantStripe(montantCommande: number, deviseCommande: string | null | undefined, deviseChoisie?: string | null) {
    const deCmd = (deviseCommande || 'XOF').toUpperCase()
    const choisie = (deviseChoisie || '').toUpperCase()
    const devise = DEVISES_STRIPE.has(choisie) ? choisie : deCmd
    const montant = convertWithMargin(Number(montantCommande), deCmd, devise)
    const mineur = ZERO_DECIMAL.has(devise) ? Math.round(montant) : Math.round(montant * 100)
    return { devise, mineur }
}

/** Le paiement reçu couvre-t-il la commande ? Tolérance 1 % (arrondis, taux qui bougent entre intention et paiement). */
export function paiementStripeSuffisant(recuMineur: number, deviseRecue: string, montantCommande: number, deviseCommande: string | null | undefined): boolean {
    const { mineur } = montantStripe(montantCommande, deviseCommande, deviseRecue)
    return mineur > 0 && recuMineur >= mineur * 0.99
}
