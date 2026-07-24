// ══════════════════════════════════════════════════════════════
//  GARDE D'API UNIFIÉE
//
//  Toute route qui utilise SUPABASE_SERVICE_ROLE_KEY contourne la RLS :
//  la base ne la protège plus, seule la route le fait. Ce module donne
//  les deux seules gardes légitimes :
//
//   • requireStaff()  — la route pilote l'argent ou les données internes
//                       → session admin/agent obligatoire
//   • guardPublic()   — la route est publique PAR CONCEPTION (formulaire,
//                       avis, traduction) → pas d'identité, mais un débit
//                       plafonné + analyse de corps, pour que « public »
//                       ne veuille pas dire « illimité ».
//
//  Règle : une route service-role sans l'une des deux est un défaut.
//  Le test tests/api-guards.test.ts le vérifie à chaque commit.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import {
    rateLimit,
    getClientIp,
    rateLimitHeaders,
    type RateLimitConfig,
} from '@/lib/rate-limit'
import { scanRequestBody } from '@/lib/waf'

// ─── Profils de débit pour les routes publiques ───────────────
// Calibrés sur l'usage humain réel, pas sur une valeur ronde :
// un visiteur qui dépasse ces seuils n'est pas un visiteur.

/** Formulaire public écrivant en base (RDV, devis, lead, avis). */
export const PUBLIC_FORM_LIMIT: RateLimitConfig = {
    limit: 5,
    window: 10 * 60_000,
    blockDuration: 30 * 60_000,
    blockMultiplier: 3,
    maxBlockDuration: 24 * 60 * 60_000,
}

/** Route consommant un modèle IA payant (Groq, Gemini) — coût par appel. */
export const AI_LIMIT: RateLimitConfig = {
    limit: 20,
    window: 5 * 60_000,
    blockDuration: 15 * 60_000,
    blockMultiplier: 2,
    maxBlockDuration: 2 * 60 * 60_000,
}

/** Traduction : appelée en rafale au chargement d'une page, donc large. */
export const TRANSLATE_LIMIT: RateLimitConfig = {
    limit: 60,
    window: 60_000,
    blockDuration: 5 * 60_000,
    blockMultiplier: 2,
    maxBlockDuration: 30 * 60_000,
}

/** Compteur/télémétrie (vues d'article, tracking) — volumineux mais trivial. */
export const TELEMETRY_LIMIT: RateLimitConfig = {
    limit: 120,
    window: 60_000,
    blockDuration: 5 * 60_000,
    blockMultiplier: 2,
    maxBlockDuration: 30 * 60_000,
}

/**
 * Dépôt de fichiers par un client.
 *
 * Le dossier nationalité demande 11 pièces justificatives : une limite de
 * formulaire classique bloquerait un client légitime au milieu de son
 * envoi. On plafonne haut, mais on plafonne.
 */
export const UPLOAD_LIMIT: RateLimitConfig = {
    limit: 40,
    window: 15 * 60_000,
    blockDuration: 15 * 60_000,
    blockMultiplier: 2,
    maxBlockDuration: 2 * 60 * 60_000,
}

/** Messagerie support en direct : un échange normal est bavard. */
export const CHAT_LIMIT: RateLimitConfig = {
    limit: 30,
    window: 5 * 60_000,
    blockDuration: 10 * 60_000,
    blockMultiplier: 2,
    maxBlockDuration: 60 * 60_000,
}

/** Envoi d'e-mail déclenché par un anonyme — protège le quota SMTP. */
export const EMAIL_LIMIT: RateLimitConfig = {
    limit: 3,
    window: 15 * 60_000,
    blockDuration: 60 * 60_000,
    blockMultiplier: 3,
    maxBlockDuration: 24 * 60 * 60_000,
}

// ─── Garde publique ───────────────────────────────────────────

/**
 * Plafonne le débit d'une route publique.
 *
 * Retourne une réponse 429 prête à renvoyer, ou `null` si la requête passe.
 * La clé combine le nom de la route et l'IP : saturer le formulaire de RDV
 * ne doit pas bloquer la newsletter pour le même visiteur.
 *
 *   const trop = guardPublic(request, 'rendez-vous', PUBLIC_FORM_LIMIT)
 *   if (trop) return trop
 */
export function guardPublic(
    request: Request,
    route: string,
    config: RateLimitConfig = PUBLIC_FORM_LIMIT,
): NextResponse | null {
    const ip = getClientIp(request)
    const result = rateLimit(`${route}:${ip}`, config)
    if (result.allowed) return null

    return NextResponse.json(
        {
            error: 'Trop de requêtes. Réessayez dans quelques minutes.',
            retryAfter: result.retryAfter,
        },
        { status: 429, headers: rateLimitHeaders(result) },
    )
}

/**
 * Garde publique complète : débit + analyse structurelle du corps.
 *
 * Renvoie `{ rejection }` non nul dès qu'un des deux refuse, et `body`
 * déjà parsé — la route NE DOIT PAS refaire `request.json()`, le flux
 * ayant été consommé.
 */
export async function guardPublicBody(
    request: Request,
    route: string,
    config: RateLimitConfig = PUBLIC_FORM_LIMIT,
): Promise<{ body: unknown; rejection: NextResponse | null }> {
    const trop = guardPublic(request, route, config)
    if (trop) return { body: undefined, rejection: trop }

    const { body, rejection } = await scanRequestBody(request)
    return { body, rejection }
}

// ─── Garde interne ────────────────────────────────────────────

export interface StaffGuard {
    ok: boolean
    userId?: string
    role?: string
    /** Réponse 401/403 à renvoyer telle quelle si `ok` est faux. */
    response?: NextResponse
    /** true si le rôle fait partie des rôles administrateurs. */
    isAdmin: boolean
}

const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin']

/**
 * Exige une session interne.
 *
 * `'agent'` accepte les agents ET les admins (un admin peut tout ce que
 * peut un agent) ; `'admin'` n'accepte que les rôles administrateurs.
 * `isAdmin` est renvoyé pour le cloisonnement : un agent ne voit que ses
 * propres écritures, un admin voit toutes celles de l'équipe.
 *
 *   const g = await requireStaff(request, 'agent')
 *   if (!g.ok) return g.response!
 *   if (!g.isAdmin) query = query.eq('agent_id', g.userId)
 */
export async function requireStaff(
    // `Request` et non `NextRequest` : beaucoup de routes du projet sont
    // typées avec le Request standard. verifyApiAuth ne lit que les cookies,
    // présents dans les deux, et fait déjà le cast en interne.
    request: Request,
    role: 'admin' | 'agent' = 'admin',
): Promise<StaffGuard> {
    const auth = await verifyApiAuth(request as NextRequest, role)
    if (!auth.authenticated) {
        return { ok: false, response: auth.error, isAdmin: false }
    }
    return {
        ok: true,
        userId: auth.userId,
        role: auth.role,
        isAdmin: !!auth.role && ADMIN_ROLES.includes(auth.role),
    }
}

// ─── Garde des tâches planifiées ──────────────────────────────

/**
 * Exige le secret de cron.
 *
 * Vercel Cron envoie `Authorization: Bearer $CRON_SECRET`. On accepte aussi
 * `x-cron-secret` pour un déclenchement manuel. Si `CRON_SECRET` n'est pas
 * défini en production, on REFUSE : une variable oubliée ne doit pas ouvrir
 * la route à tout Internet.
 */
export function requireCron(request: Request): NextResponse | null {
    const secret = process.env.CRON_SECRET || ''

    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            // 503 et non 401 : ce n'est pas un appel illégitime, c'est une
            // variable d'environnement manquante. Un cron muet renvoyait le
            // même 401 qu'une attaque — impossible à diagnostiquer dans les
            // logs Vercel. Le message dit quoi faire.
            console.error(
                '[cron] CRON_SECRET absent — tâche planifiée non exécutée. ' +
                'Définissez la variable dans Vercel › Settings › Environment Variables.',
            )
            return NextResponse.json(
                {
                    error: 'CRON_SECRET non configuré — exécution refusée.',
                    remede: 'Ajoutez CRON_SECRET aux variables d’environnement du projet.',
                },
                { status: 503 },
            )
        }
        return null // développement local : on laisse passer
    }

    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    const header = request.headers.get('x-cron-secret')
    if (bearer === secret || header === secret) return null

    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
}
