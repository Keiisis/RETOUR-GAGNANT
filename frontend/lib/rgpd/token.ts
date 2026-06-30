// ══════════════════════════════════════════════════════════════
// RGPD — Jeton de vérification de propriété d'email (stateless, HMAC)
//
// Le self-service public n'affiche/n'efface JAMAIS de données sur simple
// saisie d'un email (sinon n'importe qui pourrait lire/effacer les données
// d'autrui — Art. 12.6 RGPD impose de vérifier l'identité du demandeur).
//
// On émet un jeton signé envoyé PAR EMAIL : seul le propriétaire de la boîte
// peut le récupérer. Aucune table requise (signature HMAC + expiration).
// ══════════════════════════════════════════════════════════════

import crypto from 'crypto'

const SECRET =
    process.env.RGPD_TOKEN_SECRET ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'rgpd-dev-secret-change-me'

const DEFAULT_TTL_MS = 60 * 60 * 1000 // 1 heure

function sign(payload: string): string {
    return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
}

/** Émet un jeton lié à un email, valable `ttlMs`. */
export function makeRgpdToken(email: string, ttlMs: number = DEFAULT_TTL_MS): string {
    const payload = `${email.toLowerCase().trim()}|${Date.now() + ttlMs}`
    const b = Buffer.from(payload).toString('base64url')
    return `${b}.${sign(b)}`
}

/** Vérifie un jeton ; retourne l'email si valide et non expiré, sinon null. */
export function verifyRgpdToken(token: string): { email: string } | null {
    try {
        const [b, sig] = String(token || '').split('.')
        if (!b || !sig) return null
        const expected = sign(b)
        const a = Buffer.from(sig)
        const e = Buffer.from(expected)
        if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) return null
        const [email, exp] = Buffer.from(b, 'base64url').toString('utf8').split('|')
        if (!email || !exp || Date.now() > Number(exp)) return null
        return { email }
    } catch {
        return null
    }
}
