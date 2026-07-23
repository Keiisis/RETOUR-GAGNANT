// ══════════════════════════════════════════════════════════════
//  TESTS — JOURNAL DES TACHES PLANIFIEES
//
//  Le journal est un confort de diagnostic, jamais un prerequis :
//  si la table cron_runs n'existe pas encore (migration non appliquee),
//  les relances de factures doivent partir quand meme. C'est ce que
//  ces tests verifient — ils tournent justement table absente.
// ══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { executerCron } from '@/lib/cron-journal'
import { NextResponse } from 'next/server'

const req = (secret: string) => new Request('https://x.test/api/cron/t', {
    headers: { authorization: `Bearer ${secret}` },
})

describe('executerCron avec table cron_runs ABSENTE', () => {
    it('exécute la tâche et renvoie sa réponse malgré la table manquante', async () => {
        process.env.CRON_SECRET = 'test-journal'
        let execute = false
        const res = await executerCron('essai', req('test-journal'), async () => {
            execute = true
            return NextResponse.json({ ok: true, valeur: 42 })
        })
        expect(execute).toBe(true)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true, valeur: 42 })
    })

    it('convertit une exception en 500 au lieu de la laisser remonter', async () => {
        process.env.CRON_SECRET = 'test-journal'
        const res = await executerCron('essai', req('test-journal'), async () => {
            throw new Error('base injoignable')
        })
        expect(res.status).toBe(500)
        expect((await res.json()).detail).toContain('base injoignable')
    })

    it('refuse un mauvais secret sans exécuter la tâche', async () => {
        process.env.CRON_SECRET = 'test-journal'
        let execute = false
        const res = await executerCron('essai', req('faux'), async () => {
            execute = true
            return NextResponse.json({})
        })
        expect(res.status).toBe(401)
        expect(execute).toBe(false)
    })
})
