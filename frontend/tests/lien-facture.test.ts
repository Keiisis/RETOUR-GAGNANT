import { describe, it, expect, beforeAll } from 'vitest'
import { lienFacture, jetonFactureValide } from '@/lib/lien-facture'

// Audit 2026-10-12, C4 : une facture boutique n'est lisible qu'avec un lien signé (ou une session prouvée).
describe('lien de facture signé', () => {
    beforeAll(() => { process.env.SIGNATURE_SECRET = 'secret-de-test-facture' })

    it('le lien de l’email ouvre SA facture', async () => {
        const url = await lienFacture('https://exemple.test', 'cmd-123')
        const t = new URL(url).searchParams.get('t')
        expect(url.startsWith('https://exemple.test/api/invoices/cmd-123?t=')).toBe(true)
        expect(await jetonFactureValide('cmd-123', t)).toBe(true)
    })
    it('le jeton d’une commande n’ouvre pas une autre commande', async () => {
        const t = new URL(await lienFacture('https://exemple.test', 'cmd-123')).searchParams.get('t')
        expect(await jetonFactureValide('cmd-124', t)).toBe(false)
    })
    it('sans jeton, ou jeton forgé : refus', async () => {
        expect(await jetonFactureValide('cmd-123', null)).toBe(false)
        expect(await jetonFactureValide('cmd-123', '9999999999.AAAA')).toBe(false)
    })
})
