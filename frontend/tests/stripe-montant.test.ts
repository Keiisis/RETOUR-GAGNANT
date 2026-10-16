import { describe, it, expect } from 'vitest'
import { montantStripe, paiementStripeSuffisant } from '@/lib/stripe-montant'

// Audit 2026-10-12, C3 : le montant Stripe ne dépend plus du navigateur.
describe('montant Stripe calculé côté serveur', () => {
    it('XOF : montant de la commande + frais de service, sans centimes', () => {
        expect(montantStripe(500000, 'XOF', 'XOF')).toEqual({ devise: 'XOF', mineur: 530000 })
    })
    it('devise inconnue ou absente : on reste dans la devise de la commande', () => {
        expect(montantStripe(10000, 'XOF', 'BTC').devise).toBe('XOF')
        expect(montantStripe(10000, 'XOF', null).devise).toBe('XOF')
    })
    it('EUR : conversion serveur en centimes, cohérente avec le modal', () => {
        const { devise, mineur } = montantStripe(500000, 'XOF', 'EUR')
        expect(devise).toBe('EUR')
        expect(mineur).toBeGreaterThan(80000)       // ≈ 807,98 € (taux fixe 655,957 + 6 %)
        expect(mineur).toBeLessThan(81000)
    })
    it('le webhook refuse un paiement de 1 € pour une commande de 500 000 FCFA', () => {
        expect(paiementStripeSuffisant(100, 'eur', 500000, 'XOF')).toBe(false)
        expect(paiementStripeSuffisant(1, 'xof', 500000, 'XOF')).toBe(false)
    })
    it('le webhook accepte le montant attendu', () => {
        const { mineur } = montantStripe(500000, 'XOF', 'EUR')
        expect(paiementStripeSuffisant(mineur, 'eur', 500000, 'XOF')).toBe(true)
        expect(paiementStripeSuffisant(530000, 'xof', 500000, 'XOF')).toBe(true)
    })
})
