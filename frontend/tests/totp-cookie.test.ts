import { describe, it, expect, beforeAll } from 'vitest'
import { signer2FA, verifier2FA } from '@/lib/totp-cookie'

// Audit 2026-10-12, C1 : la preuve 2FA ne doit plus pouvoir être fabriquée à la main.
describe('preuve 2FA signée', () => {
    beforeAll(() => { process.env.TOTP_COOKIE_SECRET = 'secret-de-test' })

    it('accepte le jeton signé pour le même utilisateur et la même portée', async () => {
        const j = await signer2FA('admin', 'u1')
        expect(await verifier2FA('admin', 'u1', j)).toBe(true)
    })
    it("refuse l'ancien cookie « true » posé à la main", async () => {
        expect(await verifier2FA('admin', 'u1', 'true')).toBe(false)
        expect(await verifier2FA('admin', 'u1', undefined)).toBe(false)
    })
    it('refuse le jeton d’un autre utilisateur ou d’une autre portée', async () => {
        const j = await signer2FA('admin', 'u1')
        expect(await verifier2FA('admin', 'u2', j)).toBe(false)
        expect(await verifier2FA('client', 'u1', j)).toBe(false)
    })
    it('refuse un jeton expiré ou modifié', async () => {
        const vieux = await signer2FA('client', 'u1', Date.now() - 9 * 3600 * 1000)
        expect(await verifier2FA('client', 'u1', vieux)).toBe(false)
        const j = await signer2FA('client', 'u1')
        const [exp, sig] = j.split('.')
        expect(await verifier2FA('client', 'u1', `${Number(exp) + 3600}.${sig}`)).toBe(false)
    })
    it('refuse tout sans secret serveur', async () => {
        const j = await signer2FA('admin', 'u1')
        const avant = { a: process.env.TOTP_COOKIE_SECRET, b: process.env.SUPABASE_SERVICE_ROLE_KEY }
        delete process.env.TOTP_COOKIE_SECRET; delete process.env.SUPABASE_SERVICE_ROLE_KEY
        expect(await verifier2FA('admin', 'u1', j)).toBe(false)
        process.env.TOTP_COOKIE_SECRET = avant.a
        if (avant.b) process.env.SUPABASE_SERVICE_ROLE_KEY = avant.b
    })
})
