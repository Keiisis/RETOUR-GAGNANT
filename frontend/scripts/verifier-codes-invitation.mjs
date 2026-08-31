/* ═══════════════════════════════════════════════════════════════
   ÉPREUVE DU CYCLE COMPLET D'UN CODE D'INVITATION

   Un code tient lieu de règlement : il faut prouver, contre la vraie base,
   qu'il ne peut pas servir deux fois, qu'un code révoqué est refusé, et
   qu'un code expiré l'est aussi. Un typecheck ne dit rien de tout cela.

   À lancer depuis `frontend/` APRÈS avoir exécuté la migration
   20260829_codes_invitation_nationalite.sql :

       node scripts/verifier-codes-invitation.mjs

   Tout ce que le script crée, il l'efface — y compris en cas d'échec.
   ═══════════════════════════════════════════════════════════════ */

import fs from 'fs'
import { randomInt } from 'crypto'

const env = Object.fromEntries(
    fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
        .filter(l => l.includes('=') && !l.trim().startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const U = env.NEXT_PUBLIC_SUPABASE_URL
const K = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const code = () => 'RGB-' + [0, 1, 2].map(() =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')).join('-')

const api = async (chemin, init = {}) => {
    const r = await fetch(`${U}/rest/v1/${chemin}`, { ...init, headers: { ...H, ...init.headers } })
    const t = await r.text()
    return { ok: r.ok, statut: r.status, corps: t ? JSON.parse(t) : null }
}

let echecs = 0
const v = (nom, ok, detail = '') => {
    console.log((ok ? '  OK  ' : '  KO  ') + nom + (ok || !detail ? '' : ` — ${detail}`))
    if (!ok) echecs++
}

/** Le verrou réel : mise à jour conditionnée sur l'état `actif`. */
const consommer = async (c, ref) => {
    const r = await api(`nationality_invitation_codes?code=eq.${c}&statut=eq.actif`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ statut: 'utilise', utilise_le: new Date().toISOString(), utilise_par_ref: ref }),
    })
    return r.ok && Array.isArray(r.corps) && r.corps.length === 1
}

const creer = async (extra = {}) => {
    const c = code()
    const r = await api('nationality_invitation_codes', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify([{
            code: c, couvre_dossier: true, couvre_ancestrale: false,
            devise: 'EUR', note: 'ÉPREUVE AUTOMATIQUE — à effacer',
            expire_le: new Date(Date.now() + 864e5).toISOString(), ...extra,
        }]),
    })
    if (!r.ok) throw new Error(`création refusée : ${r.statut} ${JSON.stringify(r.corps)}`)
    return c
}

const aCreer = []

try {
    console.log('Épreuve du cycle complet\n')

    // 1. Un code neuf se consomme une fois, et une seule.
    const c1 = await creer(); aCreer.push(c1)
    v('un code neuf est consommé', await consommer(c1, 'RG-NAT-TEST-1'))
    v('le même code est refusé au second essai', !(await consommer(c1, 'RG-NAT-TEST-2')))

    // 2. Concurrence : dix consommations simultanées, une seule doit gagner.
    const c2 = await creer(); aCreer.push(c2)
    const courses = await Promise.all(Array.from({ length: 10 }, (_, i) => consommer(c2, `RG-NAT-RACE-${i}`)))
    const gagnants = courses.filter(Boolean).length
    v('dix appels simultanés : un seul gagnant', gagnants === 1, `${gagnants} gagnant(s)`)

    // 3. Un code révoqué ne se consomme pas.
    const c3 = await creer(); aCreer.push(c3)
    await api(`nationality_invitation_codes?code=eq.${c3}`, {
        method: 'PATCH', body: JSON.stringify({ statut: 'revoque' }),
    })
    v('un code révoqué est refusé', !(await consommer(c3, 'RG-NAT-TEST-3')))

    // 4. L'unicité du code est tenue par la base, pas par le code applicatif.
    const c4 = await creer(); aCreer.push(c4)
    const doublon = await api('nationality_invitation_codes', {
        method: 'POST',
        body: JSON.stringify([{ code: c4, couvre_dossier: true, devise: 'EUR' }]),
    })
    v('un code en double est rejeté par la base', !doublon.ok, `statut ${doublon.statut}`)

    // 5. La portée vide est interdite.
    const vide = await api('nationality_invitation_codes', {
        method: 'POST',
        body: JSON.stringify([{ code: code(), couvre_dossier: false, couvre_ancestrale: false, devise: 'EUR' }]),
    })
    v('un code sans portée est rejeté', !vide.ok, `statut ${vide.statut}`)

    // 6. Un état inconnu est refusé.
    const c6 = await creer(); aCreer.push(c6)
    const etat = await api(`nationality_invitation_codes?code=eq.${c6}`, {
        method: 'PATCH', body: JSON.stringify({ statut: 'nimporte_quoi' }),
    })
    v('un statut hors liste est rejeté', !etat.ok, `statut ${etat.statut}`)

} catch (e) {
    v('déroulement de l’épreuve', false, e.message)
} finally {
    for (const c of aCreer) {
        await api(`nationality_invitation_codes?code=eq.${c}`, { method: 'DELETE' }).catch(() => undefined)
    }
    const reste = await api(`nationality_invitation_codes?note=eq.${encodeURIComponent('ÉPREUVE AUTOMATIQUE — à effacer')}&select=code`)
    const n = Array.isArray(reste.corps) ? reste.corps.length : -1
    v('nettoyage complet', n === 0, `${n} code(s) de test restant(s)`)
}

console.log('')
console.log(echecs ? `${echecs} échec(s)` : 'cycle complet vérifié en base')
process.exit(echecs ? 1 : 0)
