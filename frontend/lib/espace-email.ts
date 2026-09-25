// ══════════════════════════════════════════════════════════════
//  Espace client « /mon-compte » : preuve que le visiteur possède l'adresse.
//
//  Audit du 25/09/2026 : la page lisait dossiers, résultats Oracle, pièces,
//  contrats et commandes avec la clé publique, filtrés sur l'email TAPÉ.
//  Taper l'adresse de quelqu'un suffisait à voir tout son dossier.
//
//  Désormais :
//    1. POST /api/mon-compte/code     → un code à 8 chiffres part par email ;
//       le navigateur reçoit un « défi » signé qui contient l'email, une
//       expiration et l'empreinte du code (jamais le code lui-même).
//    2. POST /api/mon-compte/verifier → défi + code corrects = cookie de
//       session httpOnly `rg_mc` (12 h), signé HMAC.
//    3. Toutes les lectures/écritures passent par le serveur, qui ne croit
//       que l'email du cookie (ou de la session Supabase d'un client connecté).
//
//  Sans état, sans table : tout est signé avec le secret serveur. Encodage
//  HEXADÉCIMAL volontaire (le WAF bloque certaines séquences base64url).
// ══════════════════════════════════════════════════════════════
import crypto from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { getClientUser } from '@/lib/client-auth'

const SECRET =
    process.env.ESPACE_CLIENT_SECRET ||
    process.env.NATIONALITY_RESUME_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'dev-only-insecure-secret'

export const COOKIE_ESPACE = 'rg_mc'
const DUREE_CODE_MS = 10 * 60 * 1000
const DUREE_SESSION_S = 12 * 60 * 60
const HEX = /^[0-9a-f]+$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normaliserEmail(v: unknown): string | null {
    const e = String(v || '').trim().toLowerCase()
    return EMAIL.test(e) && e.length <= 254 ? e : null
}

function hmac(txt: string): string {
    return crypto.createHmac('sha256', SECRET).update(txt).digest('hex')
}

function signer(payload: object): string {
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('hex')
    return `${body}.${hmac(body)}`
}

function lire<T>(jeton: string | null | undefined): T | null {
    if (!jeton) return null
    const [body, sig] = String(jeton).split('.')
    if (!body || !sig || !HEX.test(body) || !HEX.test(sig)) return null
    const attendu = hmac(body)
    if (sig.length !== attendu.length) return null
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(attendu, 'hex'))) return null
    try {
        const p = JSON.parse(Buffer.from(body, 'hex').toString('utf8')) as T & { exp?: number }
        if (!p.exp || p.exp < Date.now()) return null
        return p
    } catch {
        return null
    }
}

/** Nouveau code à envoyer par email + défi signé à rendre au navigateur. */
export function creerDefi(email: string): { code: string; defi: string } {
    const code = String(crypto.randomInt(0, 100_000_000)).padStart(8, '0')
    const exp = Date.now() + DUREE_CODE_MS
    const nonce = crypto.randomBytes(8).toString('hex')
    const defi = signer({ e: email, exp, n: nonce, h: hmac(`code:${email}:${nonce}:${code}`) })
    return { code, defi }
}

/** Email prouvé si le code correspond au défi (non expiré), sinon null. */
export function verifierDefi(defi: string, code: string): string | null {
    const p = lire<{ e: string; n: string; h: string }>(defi)
    const c = String(code || '').replace(/\D/g, '')
    if (!p || c.length !== 8) return null
    const attendu = hmac(`code:${p.e}:${p.n}:${c}`)
    if (attendu.length !== p.h.length) return null
    return crypto.timingSafeEqual(Buffer.from(attendu, 'hex'), Buffer.from(p.h, 'hex')) ? p.e : null
}

/** Pose le cookie de session de l'espace client. */
export function ouvrirSession(res: NextResponse, email: string): void {
    res.cookies.set(COOKIE_ESPACE, signer({ e: email, exp: Date.now() + DUREE_SESSION_S * 1000 }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: DUREE_SESSION_S,
    })
}

export function fermerSession(res: NextResponse): void {
    res.cookies.set(COOKIE_ESPACE, '', { httpOnly: true, path: '/', maxAge: 0 })
}

/**
 * Email PROUVÉ du visiteur : cookie `rg_mc` valide, sinon session Supabase
 * d'un client connecté (web ou mobile). Jamais un email venu du formulaire.
 */
export async function emailProuve(req: NextRequest): Promise<string | null> {
    const p = lire<{ e: string }>(req.cookies.get(COOKIE_ESPACE)?.value)
    if (p?.e) return normaliserEmail(p.e)
    const user = await getClientUser(req)
    return user?.email ? normaliserEmail(user.email) : null
}
