// ══════════════════════════════════════════════════════════════
//  TESTS — LOGIQUE MONÉTAIRE CRITIQUE
//  Couvre les régressions qui ont réellement coûté de l'argent :
//   • conversion devise → XOF (montant envoyé à la passerelle)
//   • contrôle anti-sous-paiement multi-devises
//   • lecture des tarifs administrables (aucun prix codé en dur)
//   • numérotation séquentielle (repli déterministe)
//  Exécution : npm run test
// ══════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Doublure Supabase : renvoie les taux réels du projet ─────
const RATES = [
    { code: 'XOF', exchange_rate_to_base: 1, is_base: true },
    { code: 'EUR', exchange_rate_to_base: 655.957, is_base: false },
    { code: 'USD', exchange_rate_to_base: 574.7126, is_base: false },
]

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({
        from: () => ({
            select: async () => ({ data: RATES, error: null }),
        }),
    }),
}))

import { toXOFStrict, toXOFLoose, getRatesXOF } from '@/lib/server-rates'

describe('Conversion vers XOF (montant envoyé à la passerelle)', () => {
    beforeEach(() => { vi.useRealTimers() })

    it('applique la parité fixe EUR/XOF de la BCEAO', async () => {
        // 350 € × 655,957 = 229 584,95 → arrondi 229 585
        expect(await toXOFStrict(350, 'EUR')).toBe(229585)
    })

    it('convertit le dollar au taux réel de la base', async () => {
        expect(await toXOFStrict(100, 'USD')).toBe(Math.round(100 * 574.7126))
    })

    it('laisse le XOF inchangé', async () => {
        expect(await toXOFStrict(9500, 'XOF')).toBe(9500)
    })

    it('traite une devise absente comme XOF par défaut', async () => {
        expect(await toXOFStrict(9500, null)).toBe(9500)
    })

    it('REFUSE une devise inconnue plutôt que de facturer approximativement', async () => {
        expect(await toXOFStrict(100, 'JPY')).toBeNull()
    })

    it('toXOFLoose ne bloque pas mais ne convertit pas non plus', async () => {
        expect(await toXOFLoose(100, 'JPY')).toBe(100)
    })

    it('expose les taux avec XOF comme base', async () => {
        const r = await getRatesXOF()
        expect(r.XOF).toBe(1)
        expect(r.EUR).toBeCloseTo(655.957, 3)
    })
})

describe('Contrôle anti-sous-paiement multi-devises', () => {
    // Reproduit la règle appliquée dans /api/checkout/verify :
    // l'attendu est converti en XOF, tolérance 2%.
    const accepte = async (montantPasserelleXOF: number, total: number, devise: string) => {
        const attendu = await toXOFStrict(total, devise)
        if (attendu === null) return false
        return montantPasserelleXOF >= Math.floor(attendu * 0.98)
    }

    it('rejette le sous-paiement qui passait avant le correctif', async () => {
        // Commande de 337 € : l'ancien code comparait 400 XOF à 337 → accepté.
        expect(await accepte(400, 337, 'EUR')).toBe(false)
    })

    it('accepte le paiement intégral converti', async () => {
        expect(await accepte(221057, 337, 'EUR')).toBe(true)
    })

    it('tolère un écart de 2% (arrondis et frais passerelle)', async () => {
        const exact = (await toXOFStrict(337, 'EUR'))!
        expect(await accepte(Math.floor(exact * 0.99), 337, 'EUR')).toBe(true)
        expect(await accepte(Math.floor(exact * 0.90), 337, 'EUR')).toBe(false)
    })

    it('refuse la validation si le taux est indisponible', async () => {
        expect(await accepte(999999, 100, 'JPY')).toBe(false)
    })
})

// ─── Lecture des tarifs administrables (aucun prix codé en dur) ─
// Réplique exacte du parseur utilisé côté page et côté serveur.
const parseEur = (s: string): number | null => {
    const clean = String(s || '').replace(/[^\d,.]/g, '')
    const m = clean.match(/(\d+(?:[.,]\d+)?)/)
    if (!m) return null
    const n = Number(m[1].replace(',', '.'))
    return isFinite(n) && n > 0 ? n : null
}

describe('Tarifs pilotés depuis l’administration', () => {
    it('lit un tarif simple', () => {
        expect(parseEur('350 €')).toBe(350)
    })

    it('lit un tarif avec séparateur de milliers', () => {
        expect(parseEur('1 200 €')).toBe(1200)
    })

    it('accepte la virgule décimale', () => {
        expect(parseEur('49,50 €')).toBe(49.5)
    })

    it('renvoie null sur un libellé sans montant', () => {
        expect(parseEur('Nous consulter')).toBeNull()
        expect(parseEur('')).toBeNull()
    })

    it('renvoie null sur un montant nul (pas de facturation à 0)', () => {
        expect(parseEur('0 €')).toBeNull()
    })
})

// ─── Numérotation séquentielle ────────────────────────────────
import { formatDocNumber, docPrefix } from '@/lib/document-numbering'

describe('Numérotation des documents (OHADA/DGI)', () => {
    it('produit un numéro séquentiel sur 4 chiffres', () => {
        expect(formatDocNumber('facture', 2026, 2)).toBe('FAC-2026-0002')
        expect(formatDocNumber('devis', 2026, 17)).toBe('DEV-2026-0017')
        expect(formatDocNumber('avoir', 2026, 1)).toBe('AV-2026-0001')
    })

    it('utilise un préfixe distinct par série', () => {
        expect(docPrefix('facture')).toBe('FAC')
        expect(docPrefix('devis')).toBe('DEV')
        expect(docPrefix('avoir')).toBe('AV')
    })

    it('conserve l’ordre lexicographique (indispensable au repli)', () => {
        const nums = [1, 2, 10, 11].map(n => formatDocNumber('facture', 2026, n))
        expect([...nums].sort()).toEqual(nums)
    })
})
