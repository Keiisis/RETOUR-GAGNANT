// ══════════════════════════════════════════════════════════════
//  Tarifs boutique recalculés côté serveur : livraison et code promo.
//
//  Le navigateur envoyait lui-même ses frais de livraison (n'importe quelle
//  valeur entre 0 et 100 000) et le serveur ne revérifiait ni le minimum de
//  commande ni la validité réelle du coupon. Ces deux fonctions sont la
//  source de vérité serveur ; le navigateur n'en est qu'un affichage.
// ══════════════════════════════════════════════════════════════

/**
 * Barème de livraison par zone (XOF, hors TVA).
 * Copie exacte de ZONE_FEES dans components/boutique/CartCheckoutModal.tsx
 * et PaymentModal.tsx : toute modification doit être faite aux trois endroits.
 */
export const FRAIS_LIVRAISON_ZONE: Record<string, number> = {
    benin: 0,
    'afrique-ouest': 5000,
    europe: 15000,
    international: 25000,
    digital: 0,
}

/**
 * Frais de livraison d'une zone. Zone absente → 0 (pas d'envoi physique).
 * Zone inconnue → null : la commande doit être refusée, pas facturée au hasard.
 */
export function fraisLivraison(zone: unknown): number | null {
    if (zone === undefined || zone === null || zone === '') return 0
    if (typeof zone !== 'string' || !Object.prototype.hasOwnProperty.call(FRAIS_LIVRAISON_ZONE, zone)) return null
    return FRAIS_LIVRAISON_ZONE[zone]
}

/** Colonnes de `coupons` nécessaires à l'évaluation (rien de plus). */
export interface CouponTarif {
    is_active: boolean | null
    expires_at: string | null
    max_uses: number | null
    current_uses: number | null
    min_order_amount: number | null
    discount_type: string | null
    discount_value: number | null
}

export const COLONNES_COUPON = 'id, code, is_active, expires_at, max_uses, current_uses, min_order_amount, discount_type, discount_value'

export type VerdictCoupon =
    | { valide: true; remise: number }
    | { valide: false; erreur: string }

/**
 * Évalue un coupon pour un sous-total HT (XOF) calculé serveur.
 * Remise bornée à [0, sous-total] : un coupon ne rend jamais une commande négative.
 */
export function evaluerCoupon(
    coupon: CouponTarif,
    sousTotalHt: number,
    maintenant: Date = new Date(),
): VerdictCoupon {
    if (!coupon.is_active) return { valide: false, erreur: 'Ce code n\'est plus actif' }
    if (coupon.expires_at && new Date(coupon.expires_at) < maintenant) {
        return { valide: false, erreur: 'Ce code a expiré' }
    }
    if ((coupon.current_uses ?? 0) >= (coupon.max_uses ?? 0)) {
        return { valide: false, erreur: 'Ce code a atteint sa limite d\'utilisation' }
    }
    const minimum = Number(coupon.min_order_amount) || 0
    if (minimum > 0 && sousTotalHt < minimum) {
        return {
            valide: false,
            erreur: `Commande minimum: ${new Intl.NumberFormat('fr-FR').format(minimum)} XOF`,
        }
    }

    const valeur = Math.max(0, Number(coupon.discount_value) || 0)
    const brute = coupon.discount_type === 'percentage'
        ? Math.round(sousTotalHt * valeur / 100)
        : valeur
    return { valide: true, remise: Math.min(brute, Math.max(0, sousTotalHt)) }
}
