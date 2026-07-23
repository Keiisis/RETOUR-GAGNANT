// ══════════════════════════════════════════════════════════════
//  TESTS — GARDES DES ROUTES API
//
//  Ce test lit le CODE des routes, pas leur comportement : il est là
//  pour qu'une route ajoutée demain ne réintroduise pas silencieusement
//  la faille corrigée aujourd'hui.
//
//  Règle vérifiée : toute route qui utilise SUPABASE_SERVICE_ROLE_KEY
//  contourne la RLS. La base ne la protège plus — elle doit donc porter
//  elle-même une garde :
//    • une identité   (requireStaff / verifyApiAuth / getClientUser…)
//    • ou un secret   (signature de webhook, CRON_SECRET, jeton signé)
//    • ou un plafond  (guardPublic) si elle est publique par conception
//
//  Une route sans aucune des trois est un défaut, pas un choix.
//  Exécution : npm run test
// ══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { requireCron } from '@/lib/api-guard'

const RACINE = join(process.cwd(), 'app', 'api')

/** Chemins de tous les fichiers route.ts sous app/api. */
function routes(dir = RACINE, acc: string[] = []): string[] {
    for (const nom of readdirSync(dir)) {
        const p = join(dir, nom)
        if (statSync(p).isDirectory()) routes(p, acc)
        else if (nom === 'route.ts') acc.push(p)
    }
    return acc
}

/** 'app/api/settings/currency/route.ts' → '/api/settings/currency' */
const nomRoute = (p: string) =>
    '/api/' + p.split(`api${sep}`)[1].replace(`${sep}route.ts`, '').split(sep).join('/')

// `auth.getUser()` compte : plusieurs routes client vérifient la session
// directement via createServerClient, sans passer par un helper maison.
const IDENTITE = /requireStaff|verifyApiAuth|getClientUser|getMobileUserId|requireAdmin|auth\.getUser\(/
const SECRET = /requireCron|CRON_SECRET|constructEvent|verifySignature|createHmac|timingSafeEqual|verifyRgpdToken|verifyResumeToken|verifyMyafroToken|verifyWebhook/
const PLAFOND = /guardPublic|rateLimit\(|isApiRateLimited/
const MUTATION = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/

interface Info {
    route: string
    serviceRole: boolean
    mutation: boolean
    garde: boolean
}

const analyse: Info[] = routes().map(p => {
    const src = readFileSync(p, 'utf-8')
    return {
        route: nomRoute(p),
        serviceRole: src.includes('SUPABASE_SERVICE_ROLE_KEY'),
        mutation: MUTATION.test(src),
        garde: IDENTITE.test(src) || SECRET.test(src) || PLAFOND.test(src),
    }
})

describe('gardes des routes API', () => {
    it('trouve bien les routes du projet', () => {
        // Garde-fou du test lui-même : si le parcours de fichiers casse,
        // le test passerait « vert » sur une liste vide.
        expect(analyse.length).toBeGreaterThan(100)
        expect(analyse.some(r => r.route === '/api/settings/currency')).toBe(true)
    })

    it('aucune route service-role mutante n’est sans garde', () => {
        const nues = analyse
            .filter(r => r.serviceRole && r.mutation && !r.garde)
            .map(r => r.route)
            .sort()

        expect(
            nues,
            `Ces routes écrivent en base avec la clé service-role sans identité, ` +
            `secret ni plafond de débit. Ajoutez requireStaff() si elles sont ` +
            `internes, ou guardPublic() si elles sont publiques par conception ` +
            `(voir lib/api-guard.ts) :\n  ${nues.join('\n  ')}`,
        ).toEqual([])
    })

    it('les tâches planifiées exigent toutes un secret', () => {
        const crons = analyse.filter(r => r.route.startsWith('/api/cron/'))
        expect(crons.length).toBeGreaterThan(5)

        const sansSecret = crons
            .filter(r => !SECRET.test(readFileSync(
                join(RACINE, ...r.route.replace('/api/', '').split('/'), 'route.ts'),
                'utf-8',
            )))
            .map(r => r.route)

        expect(sansSecret, `Crons sans CRON_SECRET : ${sansSecret.join(', ')}`).toEqual([])
    })

    it('aucun cron ne garde une copie locale de verifyAuth', () => {
        // Chaque cron portait sa propre fonction verifyAuth : 5 d'entre elles
        // se désactivaient si CRON_SECRET manquait, 6 refusaient en silence.
        // Une seule garde, un seul comportement.
        const copies = routes()
            .filter(p => nomRoute(p).startsWith('/api/cron/'))
            .filter(p => /function verifyAuth/.test(readFileSync(p, 'utf-8')))
            .map(nomRoute)

        expect(copies, `Utilisez requireCron() : ${copies.join(', ')}`).toEqual([])
    })

    it('aucun taux de change n’est codé en dur dans une route de paiement', () => {
        // La parité EUR/XOF (655.957) est fixée par la BCEAO : elle a sa place
        // dans lib/server-rates comme unique repli. Partout ailleurs — et pour
        // toute autre devise — le taux se lit dans la table `currencies`.
        const suspects: string[] = []
        for (const p of routes()) {
            const r = nomRoute(p)
            if (!/checkout|payment|paypal|stripe/.test(r)) continue
            const src = readFileSync(p, 'utf-8')
            // Un littéral de taux : une table code-devise → nombre > 100
            if (/\b(USD|GBP|CAD|CHF|HTG)\s*:\s*\d+(\.\d+)?/.test(src)) suspects.push(r)
        }
        expect(
            suspects,
            `Taux codés en dur (utilisez lib/server-rates) : ${suspects.join(', ')}`,
        ).toEqual([])
    })
})

// ══════════════════════════════════════════════════════════════
//  requireCron — comportement exact de la garde des tâches
//
//  C'est ici que se joue « tous les crons fonctionnent » : la garde
//  doit laisser passer Vercel, refuser un inconnu, et surtout NE PAS
//  se désactiver quand la variable manque — l'ancien code faisait
//  exactement l'inverse.
// ══════════════════════════════════════════════════════════════

describe('requireCron', () => {
    const envInitial = { ...process.env }

    beforeEach(() => {
        process.env = { ...envInitial }
    })
    afterEach(() => {
        process.env = { ...envInitial }
    })

    const appel = (headers: Record<string, string> = {}) =>
        requireCron(new Request('https://exemple.test/api/cron/cleanup', { headers }))

    it('laisse passer Vercel Cron (Authorization: Bearer <secret>)', () => {
        process.env.CRON_SECRET = 'secret-de-test'
        expect(appel({ authorization: 'Bearer secret-de-test' })).toBeNull()
    })

    it('accepte aussi un déclenchement manuel via x-cron-secret', () => {
        process.env.CRON_SECRET = 'secret-de-test'
        expect(appel({ 'x-cron-secret': 'secret-de-test' })).toBeNull()
    })

    it('refuse un mauvais secret (401)', () => {
        process.env.CRON_SECRET = 'secret-de-test'
        expect(appel({ authorization: 'Bearer faux' })?.status).toBe(401)
    })

    it('refuse une requête sans aucun secret (401)', () => {
        process.env.CRON_SECRET = 'secret-de-test'
        expect(appel()?.status).toBe(401)
    })

    it('REFUSE en production si CRON_SECRET est absent (503, pas un passe-droit)', () => {
        // La régression corrigée : `if (CRON_SECRET && ...)` sautait le
        // contrôle quand la variable manquait, ouvrant la tâche à Internet.
        delete process.env.CRON_SECRET
        Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true })

        const refus = appel()
        expect(refus).not.toBeNull()
        expect(refus?.status).toBe(503)
    })

    it('laisse passer en développement local sans secret', () => {
        delete process.env.CRON_SECRET
        Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true })
        expect(appel()).toBeNull()
    })
})
