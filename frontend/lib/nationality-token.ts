import crypto from 'crypto'

/**
 * Jeton signé (HMAC-SHA256) pour reprendre/compléter un dossier de nationalité
 * DÉJÀ PAYÉ, sans nouvelle exigence de paiement.
 *
 * Le jeton EST la preuve d'autorisation : il encode l'id de la fiche
 * `nationality_applications` + une expiration. Impossible à forger sans le
 * secret serveur. Aucune colonne DB nécessaire.
 *
 * ⚠️ Encodage HEXADÉCIMAL (0-9a-f) volontaire : un jeton base64url peut contenir
 * des séquences (« -- », etc.) que le WAF interprète comme une attaque SQLi et
 * bloque (403 « Accès refusé »). L'hexadécimal ne déclenche aucune règle WAF.
 */
const SECRET =
    process.env.NATIONALITY_RESUME_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'dev-only-insecure-secret'

const HEX = /^[0-9a-f]+$/i

export function signResumeToken(applicationId: string, ttlDays = 30): string {
    const payload = { id: applicationId, exp: Date.now() + ttlDays * 24 * 60 * 60 * 1000 }
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('hex')
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex')
    return `${body}.${sig}`
}

export function verifyResumeToken(token: string): { id: string } | null {
    try {
        if (!token || typeof token !== 'string' || !token.includes('.')) return null
        const [body, sig] = token.split('.')
        if (!body || !sig || !HEX.test(body) || !HEX.test(sig)) return null
        const expected = crypto.createHmac('sha256', SECRET).update(body).digest('hex')
        const a = Buffer.from(sig, 'hex')
        const b = Buffer.from(expected, 'hex')
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
        const payload = JSON.parse(Buffer.from(body, 'hex').toString('utf8'))
        if (!payload?.id || !payload?.exp || Date.now() > Number(payload.exp)) return null
        return { id: String(payload.id) }
    } catch {
        return null
    }
}
