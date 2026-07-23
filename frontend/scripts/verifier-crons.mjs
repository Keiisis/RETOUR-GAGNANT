#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════
//  VÉRIFICATION DES TÂCHES PLANIFIÉES
//
//  Appelle chaque cron déclaré dans vercel.json avec le CRON_SECRET et
//  rapporte ce qu'il répond réellement. Un cron mort renvoyait jusqu'ici
//  un 401 silencieux, indiscernable d'une tentative d'accès.
//
//  Usage :
//    node scripts/verifier-crons.mjs           # local (localhost:3000)
//    node scripts/verifier-crons.mjs --prod    # production
//
//  ATTENTION — ce script EXÉCUTE réellement les tâches. Sur ces routes,
//  GET n'est pas une sonde : c'est le déclencheur, celui-là même
//  qu'utilise Vercel Cron. Certaines tâches envoient de vrais e-mails
//  (relances de factures, paniers abandonnés). C'est le prix d'une
//  vérification honnête : la seule preuve qu'un cron fonctionne est
//  de le voir tourner.
//
//  Lancez-le de préférence juste après l'heure planifiée, quand la tâche
//  vient de tourner et n'a donc plus rien à envoyer.
// ══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = join(ICI, '..')

const args = process.argv.slice(2)
const prod = args.includes('--prod')

// ── Secret : depuis l'environnement, sinon depuis .env.local ──
function lireSecret() {
    if (process.env.CRON_SECRET) return process.env.CRON_SECRET
    try {
        const env = readFileSync(join(RACINE, '.env.local'), 'utf-8')
        const m = env.match(/^CRON_SECRET=(.*)$/m)
        return m ? m[1].trim() : ''
    } catch {
        return ''
    }
}

const secret = lireSecret()
if (!secret) {
    console.error('CRON_SECRET introuvable (ni dans l’environnement, ni dans .env.local).')
    process.exit(1)
}

const base = prod
    ? (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj')
    : 'http://localhost:3000'

const { crons } = JSON.parse(readFileSync(join(RACINE, 'vercel.json'), 'utf-8'))

console.log(`\nCible : ${base}`)
console.log('Les tâches sont RÉELLEMENT exécutées.\n')

let ok = 0
let ko = 0

for (const { path, schedule } of crons) {
    const url = `${base}${path}`
    const debut = Date.now()
    let verdict

    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${secret}` },
            // Une tâche lourde (purge, KPI hebdomadaire) peut être longue.
            signal: AbortSignal.timeout(120_000),
        })
        const ms = Date.now() - debut
        const corps = await res.text()

        if (res.status === 503 && corps.includes('CRON_SECRET')) {
            verdict = `503 — CRON_SECRET absent CÔTÉ SERVEUR`
            ko++
        } else if (res.status === 401 || res.status === 403) {
            verdict = `${res.status} — secret refusé (celui du serveur diffère)`
            ko++
        } else if (res.ok) {
            verdict = `${res.status} OK (${ms} ms)`
            ok++
        } else {
            verdict = `${res.status} — ${corps.slice(0, 120)}`
            ko++
        }
    } catch (e) {
        verdict = `injoignable — ${e.message}`
        ko++
    }

    console.log(`  ${path.padEnd(42)} ${String(schedule).padEnd(12)} ${verdict}`)
}

console.log(`\n${ok} fonctionnel(s), ${ko} en échec sur ${crons.length}.\n`)

if (ko > 0) {
    console.log('Si « CRON_SECRET absent CÔTÉ SERVEUR » : ajoutez la variable dans')
    console.log('Vercel › Settings › Environment Variables (Production), puis redéployez.')
}

process.exit(ko > 0 ? 1 : 0)
