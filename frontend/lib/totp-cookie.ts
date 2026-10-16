// Preuve de 2FA pour la session : jeton signé (HMAC-SHA256) lié à l'utilisateur et à une échéance.
// Remplace l'ancien cookie « true » posable à la main (audit 2026-10-12, C1).
import { signerJeton, verifierJeton } from '@/lib/signature-serveur'
import type { RateLimitConfig } from '@/lib/rate-limit'

export type Portee2FA = 'admin' | 'client'
export const COOKIE_2FA: Record<Portee2FA, string> = { admin: 'totp_verified', client: 'client_totp_verified' }
export const DUREE_2FA_S = 8 * 60 * 60

/** Jeton à poser en cookie httpOnly après un code 2FA valide. */
export function signer2FA(portee: Portee2FA, userId: string, maintenantMs = Date.now()): Promise<string> {
    return signerJeton('rgb-2fa-cookie-v1', `${portee}|${userId}`, DUREE_2FA_S, maintenantMs)
}

/** Vrai seulement si le jeton a été signé par le serveur, pour CET utilisateur et cette portée, et n'a pas expiré. */
export function verifier2FA(portee: Portee2FA, userId: string, jeton: string | undefined, maintenantMs = Date.now()): Promise<boolean> {
    if (!userId) return Promise.resolve(false)
    return verifierJeton('rgb-2fa-cookie-v1', `${portee}|${userId}`, jeton, maintenantMs)
}

// Saisie du code (audit E6) : 5 essais par compte sur 10 min, puis blocage 15 min croissant.
// 10^6 codes possibles : sans plafond, un script épuise l'espace en quelques heures.
export const TENTATIVES_2FA: RateLimitConfig = {
    limit: 5,
    window: 10 * 60_000,
    blockDuration: 15 * 60_000,
    blockMultiplier: 2,
    maxBlockDuration: 24 * 60 * 60_000,
}

export const optionsCookie2FA = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: DUREE_2FA_S,
}
