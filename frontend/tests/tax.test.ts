// ══════════════════════════════════════════════════════════════
//  TESTS — TVA en sus (source unique)
//
//  Le prix saisi est HORS TAXE ; la TVA s'ajoute. Ces tests verrouillent
//  l'invariant qui porte tout : ce que le client paie (TTC) = HT + TVA,
//  au centime, et le meme calcul sert au paiement, au devis et a la
//  facture — jamais de divergence.
// ══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { fromHt, ttcFromHt, roundMoney, TVA_RATE } from '@/lib/tax'

describe('TVA en sus', () => {
    it('ajoute 18 % au prix saisi (100 -> 118)', () => {
        const r = fromHt(100, 'EUR')
        expect(r.ht).toBe(100)
        expect(r.tva).toBe(18)
        expect(r.ttc).toBe(118)
    })

    it('le taux est bien 18 %', () => {
        expect(TVA_RATE).toBe(18)
    })

    it('garantit ht + tva === ttc, quelle que soit la devise', () => {
        for (const cur of ['XOF', 'EUR', 'USD', 'GBP']) {
            for (const ht of [1, 50, 260, 337, 12345, 99999, 100.5, 84.75]) {
                const r = fromHt(ht, cur)
                expect(r.ht + r.tva).toBeCloseTo(r.ttc, 2)
            }
        }
    })

    it('XOF : montants entiers (aucune décimale)', () => {
        const r = fromHt(15000, 'XOF')
        expect(Number.isInteger(r.ht)).toBe(true)
        expect(Number.isInteger(r.tva)).toBe(true)
        expect(Number.isInteger(r.ttc)).toBe(true)
        expect(r.ttc).toBe(17700) // 15000 * 1.18
    })

    it('EUR : arrondi au centime', () => {
        const r = fromHt(337, 'EUR')
        expect(r.ttc).toBe(397.66) // 337 * 1.18
        expect(r.tva).toBe(60.66)
    })

    it('ttcFromHt = le TTC de fromHt', () => {
        expect(ttcFromHt(260, 'EUR')).toBe(fromHt(260, 'EUR').ttc)
        expect(ttcFromHt(50, 'EUR')).toBe(59) // 50 * 1.18
    })

    it('roundMoney respecte la devise', () => {
        expect(roundMoney(1.005, 'EUR')).toBeCloseTo(1.0, 2)
        expect(roundMoney(17699.9, 'XOF')).toBe(17700)
    })

    it('0 reste 0', () => {
        const r = fromHt(0, 'XOF')
        expect(r.ht).toBe(0); expect(r.tva).toBe(0); expect(r.ttc).toBe(0)
    })
})
