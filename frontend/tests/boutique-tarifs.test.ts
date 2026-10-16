import { describe, it, expect } from 'vitest'
import { fraisLivraison, evaluerCoupon, type CouponTarif } from '@/lib/boutique-tarifs'

// Audit 2026-10, F5 : frais de livraison recalculés serveur depuis la zone.
describe('frais de livraison serveur', () => {
    it('barème identique aux modals boutique', () => {
        expect(fraisLivraison('benin')).toBe(0)
        expect(fraisLivraison('afrique-ouest')).toBe(5000)
        expect(fraisLivraison('europe')).toBe(15000)
        expect(fraisLivraison('international')).toBe(25000)
        expect(fraisLivraison('digital')).toBe(0)
    })
    it('zone absente : pas de livraison', () => {
        expect(fraisLivraison(undefined)).toBe(0)
        expect(fraisLivraison(null)).toBe(0)
        expect(fraisLivraison('')).toBe(0)
    })
    it('zone inconnue ou non textuelle : refus (null), jamais un montant inventé', () => {
        expect(fraisLivraison('mars')).toBeNull()
        expect(fraisLivraison('proposal')).toBeNull()
        expect(fraisLivraison('toString')).toBeNull()
        expect(fraisLivraison('__proto__')).toBeNull()
        expect(fraisLivraison(15000)).toBeNull()
    })
})

// Audit 2026-10, E8 : coupon revérifié serveur à la création de commande.
describe('évaluation serveur d’un coupon', () => {
    const base: CouponTarif = {
        is_active: true,
        expires_at: null,
        max_uses: 10,
        current_uses: 0,
        min_order_amount: 0,
        discount_type: 'percentage',
        discount_value: 10,
    }
    const maintenant = new Date('2026-10-15T12:00:00Z')

    it('pourcentage calculé sur le sous-total serveur', () => {
        expect(evaluerCoupon(base, 50000, maintenant)).toEqual({ valide: true, remise: 5000 })
    })
    it('montant fixe borné au sous-total (jamais de total négatif)', () => {
        const fixe = { ...base, discount_type: 'fixed', discount_value: 80000 }
        expect(evaluerCoupon(fixe, 50000, maintenant)).toEqual({ valide: true, remise: 50000 })
    })
    it('pourcentage > 100 borné au sous-total', () => {
        const fou = { ...base, discount_value: 250 }
        expect(evaluerCoupon(fou, 50000, maintenant)).toEqual({ valide: true, remise: 50000 })
    })
    it('valeur négative : aucune remise (pas de majoration)', () => {
        const neg = { ...base, discount_type: 'fixed', discount_value: -5000 }
        expect(evaluerCoupon(neg, 50000, maintenant)).toEqual({ valide: true, remise: 0 })
    })
    it('inactif refusé', () => {
        expect(evaluerCoupon({ ...base, is_active: false }, 50000, maintenant).valide).toBe(false)
    })
    it('expiré refusé, encore valide accepté', () => {
        expect(evaluerCoupon({ ...base, expires_at: '2026-10-14T00:00:00Z' }, 50000, maintenant).valide).toBe(false)
        expect(evaluerCoupon({ ...base, expires_at: '2026-10-16T00:00:00Z' }, 50000, maintenant).valide).toBe(true)
    })
    it('usage maximal atteint refusé', () => {
        expect(evaluerCoupon({ ...base, current_uses: 10 }, 50000, maintenant).valide).toBe(false)
        expect(evaluerCoupon({ ...base, current_uses: 9 }, 50000, maintenant).valide).toBe(true)
    })
    it('minimum de commande appliqué au sous-total serveur', () => {
        const min = { ...base, min_order_amount: 100000 }
        const refus = evaluerCoupon(min, 99999, maintenant)
        expect(refus.valide).toBe(false)
        if (!refus.valide) expect(refus.erreur).toContain('Commande minimum')
        expect(evaluerCoupon(min, 100000, maintenant).valide).toBe(true)
    })
})
