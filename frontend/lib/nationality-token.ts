import crypto from 'crypto'

/**
 * Jeton signé (HMAC-SHA256) pour reprendre/compléter un dossier de nationalité
 * DÉJÀ PAYÉ, sans nouvelle exigence de paiement.
 *
 * Le jeton EST la preuve d'autorisation : il encode l'id de la fiche
 * `nationality_applications` + une expiration. Impossible à forger sans le
 * secret serveur. Aucune colonne DB nécessaire.
 */
const SECRET =
    process.env.NATIONALITY_RESUME_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'dev-only-insecure-secret'

function b64url(input: Buffer | string): string {
    return Buffer.from(input).toString('base64url')
}

export function signResumeToken(applicationId: string, ttlDays = 30): string {
    const payload = { id: applicationId, exp: Date.now() + ttlDays * 24 * 60 * 60 * 1000 }
    const body = b64url(JSON.stringify(payload))
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
    return `${body}.${sig}`
}

export function verifyResumeToken(token: string): { id: string } | null {
    try {
        if (!token || typeof token !== 'string' || !token.includes('.')) return null
        const [body, sig] = token.split('.')
        if (!body || !sig) return null
        const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
        const a = Buffer.from(sig)
        const b = Buffer.from(expected)
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
        if (!payload?.id || !payload?.exp || Date.now() > Number(payload.exp)) return null
        return { id: String(payload.id) }
    } catch {
        return null
    }
}
