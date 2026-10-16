// ══════════════════════════════════════════════════════════════
//  TESTS — correctifs d'audit E4 (rôle), E5 (jeton RGPD), M9 (cron)
// ══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { roleAutorise } from '@/lib/api-auth'
import { makeRgpdToken, verifyRgpdToken } from '@/lib/rgpd/token'
import { egalTempsConstant, requireCron } from '@/lib/api-guard'

const envInitial = { ...process.env }
beforeEach(() => { process.env = { ...envInitial } })
afterEach(() => { process.env = { ...envInitial } })

describe('E4 : rôle lu en base uniquement, refus par défaut', () => {
    it('admin : seuls les rôles administrateur passent', () => {
        for (const r of ['admin', 'super_admin', 'superadmin']) expect(roleAutorise(r, 'admin')).toBe(true)
        expect(roleAutorise('agent', 'admin')).toBe(false)
        expect(roleAutorise('client', 'admin')).toBe(false)
    })

    it('agent : agent et administrateurs passent', () => {
        expect(roleAutorise('agent', 'agent')).toBe(true)
        expect(roleAutorise('admin', 'agent')).toBe(true)
        expect(roleAutorise('client', 'agent')).toBe(false)
    })

    it('pas de profil (rôle absent ou non textuel) = refus', () => {
        for (const r of [null, undefined, '', 0, {}, ['admin']]) {
            expect(roleAutorise(r, 'admin')).toBe(false)
            expect(roleAutorise(r, 'agent')).toBe(false)
        }
    })

    it('verifyApiAuth ne lit plus user_metadata', () => {
        const src = readFileSync(join(process.cwd(), 'lib', 'api-auth.ts'), 'utf-8')
        expect(src).not.toMatch(/user_metadata\s*\?*\.\s*role/)
    })
})

describe('E5 : jeton RGPD sans secret codé en dur', () => {
    const SECRETS = ['RGPD_TOKEN_SECRET', 'CRON_SECRET', 'SIGNATURE_SECRET', 'TOTP_COOKIE_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']
    const sansSecret = () => { for (const k of SECRETS) delete process.env[k] }

    it('aucun secret serveur : émission refusée (exception)', () => {
        sansSecret()
        expect(() => makeRgpdToken('a@b.fr')).toThrow()
    })

    it('aucun secret serveur : un jeton forgé avec l’ancienne constante est refusé', async () => {
        const crypto = await import('node:crypto')
        const b = Buffer.from(`victime@exemple.fr|${Date.now() + 3600_000}`).toString('base64url')
        const sig = crypto.createHmac('sha256', 'rgpd-dev-secret-change-me').update(b).digest('base64url')
        sansSecret()
        expect(verifyRgpdToken(`${b}.${sig}`)).toBeNull()
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-serveur-test'
        expect(verifyRgpdToken(`${b}.${sig}`)).toBeNull()
    })

    it('la constante a disparu du code', () => {
        const src = readFileSync(join(process.cwd(), 'lib', 'rgpd', 'token.ts'), 'utf-8')
        expect(src).not.toContain("'rgpd-dev-secret-change-me'")
    })

    it('repli sur la chaîne serveur (SIGNATURE_SECRET) : aller-retour valide', () => {
        sansSecret()
        process.env.SIGNATURE_SECRET = 'secret-signature-test'
        expect(verifyRgpdToken(makeRgpdToken('A@B.fr'))).toEqual({ email: 'a@b.fr' })
    })

    it('variable dédiée prioritaire : un jeton signé avec RGPD_TOKEN_SECRET reste valide si d’autres secrets apparaissent', () => {
        sansSecret()
        process.env.RGPD_TOKEN_SECRET = 'dedie'
        const jeton = makeRgpdToken('x@y.fr')
        process.env.SIGNATURE_SECRET = 'autre'
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'autre-encore'
        expect(verifyRgpdToken(jeton)).toEqual({ email: 'x@y.fr' })
        process.env.RGPD_TOKEN_SECRET = 'change'
        expect(verifyRgpdToken(jeton)).toBeNull()
    })
})

describe('M9 : secret cron comparé en temps constant', () => {
    it('egalTempsConstant : égalité exacte seulement', () => {
        expect(egalTempsConstant('abc', 'abc')).toBe(true)
        expect(egalTempsConstant('abd', 'abc')).toBe(false)
        expect(egalTempsConstant('ab', 'abc')).toBe(false)
        expect(egalTempsConstant('abcd', 'abc')).toBe(false)
        expect(egalTempsConstant('', 'abc')).toBe(false)
        expect(egalTempsConstant('abc\0', 'abc')).toBe(false)
    })

    it('requireCron n’utilise plus === sur le secret', () => {
        const src = readFileSync(join(process.cwd(), 'lib', 'api-guard.ts'), 'utf-8')
        const corps = src.slice(src.indexOf('export function requireCron'))
        expect(corps).not.toMatch(/===\s*secret|secret\s*===/)
        expect(corps).toContain('egalTempsConstant')
    })

    it('requireCron : bon secret accepté (Bearer ou x-cron-secret), préfixe refusé', () => {
        process.env.CRON_SECRET = 'secret-cron-test'
        const appel = (h: Record<string, string>) => requireCron(new Request('https://x.test/api/cron/t', { headers: h }))
        expect(appel({ authorization: 'Bearer secret-cron-test' })).toBeNull()
        expect(appel({ 'x-cron-secret': 'secret-cron-test' })).toBeNull()
        expect(appel({ authorization: 'Bearer secret-cron' })?.status).toBe(401)
        expect(appel({ 'x-cron-secret': 'secret-cron-test-plus' })?.status).toBe(401)
    })
})
