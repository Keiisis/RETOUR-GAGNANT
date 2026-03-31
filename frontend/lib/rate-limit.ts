/**
 * ═══════════════════════════════════════════════════════════════════
 * Rate Limiter — Sliding Window In-Memory
 * ═══════════════════════════════════════════════════════════════════
 *
 * Algorithme : Sliding Window Counter (plus précis que Fixed Window).
 *   - Fixed Window : un attaquant peut envoyer 2× la limite en chevauchant
 *     deux fenêtres consécutives. Le sliding window élimine ce vecteur.
 *   - Chaque requête est horodatée. Seules les requêtes dans [now - window, now]
 *     sont comptées. Les anciennes sont purgées automatiquement.
 *
 * Escalade progressive des blocages :
 *   - 1ère violation : blockDuration de base
 *   - 2ème violation : blockDuration × blockMultiplier
 *   - n-ème violation : min(blockDuration × blockMultiplier^(n-1), maxBlockDuration)
 *   → Un attaquant persistant est bloqué exponentiellement plus longtemps.
 *
 * Portée :
 *   Ce module est en mémoire (Map JavaScript). Sur Vercel serverless,
 *   chaque instance Node.js "chaude" (warm) partage ce Map entre requêtes.
 *   Une instance froide repart de zéro — c'est le seul angle mort.
 *
 *   Pour une protection distribuée inter-instances (multi-région), utiliser
 *   Upstash Redis avec @upstash/ratelimit. Cette implémentation couvre les
 *   cas d'usage courants (bots, scrapers, spam checkout) sans dépendance externe.
 *
 * Nettoyage mémoire :
 *   Les entrées expirées sont purgées toutes les 2 min (CLEANUP_INTERVAL).
 *   Taille maximale du store (MAX_STORE_SIZE) : au-delà, les entrées les plus
 *   anciennes sont évincées pour prévenir les fuites mémoire en cas d'attaque
 *   par flood d'IPs uniques (IP rotation).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface Entry {
    /** Horodatages (ms) des requêtes dans la fenêtre courante */
    timestamps: number[]
    /** Timestamp (ms) jusqu'auquel l'IP est bloquée (undefined si non bloquée) */
    blockedUntil?: number
    /** Compteur de violations pour l'escalade progressive */
    violations: number
    /** Dernière activité (ms) — utilisé pour l'éviction LRU */
    lastSeen: number
}

export interface RateLimitConfig {
    /** Nombre maximum de requêtes autorisées par fenêtre */
    limit: number
    /** Durée de la fenêtre glissante (ms) */
    window: number
    /** Durée initiale de blocage après dépassement (ms) */
    blockDuration: number
    /** Multiplicateur exponentiel du blocage à chaque nouvelle violation (défaut: 2) */
    blockMultiplier?: number
    /** Plafond de la durée de blocage, quelle que soit l'escalade (ms) */
    maxBlockDuration?: number
}

export interface RateLimitResult {
    /** true si la requête est autorisée */
    allowed: boolean
    /** Requêtes restantes dans la fenêtre courante */
    remaining: number
    /** Limite totale configurée */
    limit: number
    /** Timestamp (ms) de réinitialisation de la fenêtre courante */
    resetAt: number
    /** Si bloqué : secondes à attendre avant de réessayer */
    retryAfter?: number
}

// ─── Store en mémoire ─────────────────────────────────────────────────────────

const store = new Map<string, Entry>()

/** Taille maximale du store (protection contre les attaques par flood d'IPs uniques) */
const MAX_STORE_SIZE = 50_000

/** Intervalle de nettoyage des entrées expirées (ms) */
const CLEANUP_INTERVAL = 2 * 60_000

let lastCleanup = Date.now()

/**
 * Purge les entrées expirées pour prévenir les fuites mémoire.
 * Si le store dépasse MAX_STORE_SIZE, évince les entrées les plus anciennes (LRU).
 */
function pruneStore(now: number): void {
    if (now - lastCleanup < CLEANUP_INTERVAL) return
    lastCleanup = now

    for (const [key, entry] of store.entries()) {
        const isBlocked = entry.blockedUntil !== undefined && entry.blockedUntil > now
        const hasRecentTimestamps = entry.timestamps.length > 0
        if (!isBlocked && !hasRecentTimestamps) {
            store.delete(key)
        }
    }

    // Éviction LRU si le store est toujours trop grand après le nettoyage
    if (store.size > MAX_STORE_SIZE) {
        const sorted = [...store.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen)
        const toDelete = sorted.slice(0, store.size - MAX_STORE_SIZE)
        for (const [key] of toDelete) store.delete(key)
    }
}

// ─── Fonction principale ──────────────────────────────────────────────────────

/**
 * Vérifie si une requête est autorisée selon les règles de rate limiting.
 *
 * @param key        Clé unique — recommandé : `"endpoint:ip"` (ex: `"checkout:1.2.3.4"`)
 * @param config     Configuration des limites pour cet endpoint
 * @returns          Résultat avec `allowed`, `remaining`, `retryAfter`
 */
export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now()
    pruneStore(now)

    const windowStart = now - config.window
    const entry: Entry = store.get(key) ?? { timestamps: [], violations: 0, lastSeen: now }
    entry.lastSeen = now

    // ── Vérifier si l'IP est actuellement bloquée ──────────────────────────
    if (entry.blockedUntil !== undefined && entry.blockedUntil > now) {
        const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000)
        store.set(key, entry)
        return {
            allowed: false,
            remaining: 0,
            limit: config.limit,
            resetAt: entry.blockedUntil,
            retryAfter,
        }
    }

    // ── Sliding window : purger les timestamps hors fenêtre ────────────────
    entry.timestamps = entry.timestamps.filter(t => t > windowStart)

    const resetAt = entry.timestamps.length > 0
        ? entry.timestamps[0] + config.window
        : now + config.window

    // ── Limite atteinte → bloquer avec escalade progressive ───────────────
    if (entry.timestamps.length >= config.limit) {
        entry.violations += 1

        const multiplier = config.blockMultiplier ?? 2
        // Escalade : blockDuration × multiplier^(violations - 1)
        const rawBlock = config.blockDuration * Math.pow(multiplier, entry.violations - 1)
        const cap = config.maxBlockDuration ?? rawBlock
        const effectiveBlock = Math.min(rawBlock, cap)

        entry.blockedUntil = now + effectiveBlock
        store.set(key, entry)

        return {
            allowed: false,
            remaining: 0,
            limit: config.limit,
            resetAt: entry.blockedUntil,
            retryAfter: Math.ceil(effectiveBlock / 1000),
        }
    }

    // ── Requête autorisée ──────────────────────────────────────────────────
    entry.timestamps.push(now)
    // Réinitialiser le compteur de violations si la clé n'a plus été bloquée
    // depuis un cycle complet (donne une seconde chance aux utilisateurs légitimes)
    if (entry.blockedUntil === undefined) {
        entry.violations = Math.max(0, entry.violations - 1)
    }
    delete entry.blockedUntil
    store.set(key, entry)

    return {
        allowed: true,
        remaining: config.limit - entry.timestamps.length,
        limit: config.limit,
        resetAt,
    }
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

/**
 * Extrait l'adresse IP réelle du client depuis les headers HTTP.
 *
 * Priorité :
 *  1. `x-real-ip`       — défini par Vercel avec l'IP réelle du client
 *  2. `x-forwarded-for` — premier IP de la chaîne (client original)
 *  3. `'unknown'`        — fallback (rate limiting toujours actif via cette clé)
 *
 * NOTE : sur Vercel, `x-real-ip` est injecté par l'infrastructure et non
 * spoofable par le client. `x-forwarded-for` peut l'être si le serveur
 * n'est pas derrière un reverse proxy de confiance.
 */
export function getClientIp(request: Request): string {
    const realIp = request.headers.get('x-real-ip')?.trim()
    if (realIp) return realIp

    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) {
        const first = forwarded.split(',')[0].trim()
        if (first) return first
    }

    return 'unknown'
}

/**
 * Génère les headers HTTP standard pour le rate limiting.
 * Suit les conventions RateLimit (RFC 6585 + IETF draft-ietf-httpapi-ratelimit-headers).
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    }
    if (result.retryAfter !== undefined) {
        headers['Retry-After'] = String(result.retryAfter)
    }
    return headers
}

// ─── Configurations prédéfinies par endpoint ──────────────────────────────────

/**
 * Création de commande : /api/checkout
 *
 * Un utilisateur légitime crée rarement plus de 3-4 commandes en 5 min
 * (tentatives de paiement successives après échec).
 * Limite : 10 / 5 min, blocage 15 min (×2 à chaque violation, max 2h).
 */
export const CHECKOUT_LIMIT: RateLimitConfig = {
    limit: 10,
    window: 5 * 60_000,           // 5 minutes
    blockDuration: 15 * 60_000,   // 15 min au premier dépassement
    blockMultiplier: 2,            // 30 min, 1h, 2h...
    maxBlockDuration: 2 * 60 * 60_000, // max 2 heures
}

/**
 * Routes de paiement secondaires (Stripe intent, PayPal create/capture, Zeyow confirm).
 *
 * Appelées une fois par session de paiement.
 * Limite : 15 / 5 min, blocage 10 min (×2, max 1h).
 */
export const PAYMENT_ROUTE_LIMIT: RateLimitConfig = {
    limit: 15,
    window: 5 * 60_000,           // 5 minutes
    blockDuration: 10 * 60_000,   // 10 min
    blockMultiplier: 2,
    maxBlockDuration: 60 * 60_000, // max 1 heure
}

/**
 * Vérification de paiement : /api/checkout/verify
 *
 * Le frontend peut légitimement appeler verify plusieurs fois (retry après échec).
 * Limite : 20 / minute, blocage 5 min (×2, max 30 min).
 */
export const VERIFY_LIMIT: RateLimitConfig = {
    limit: 20,
    window: 60_000,               // 1 minute
    blockDuration: 5 * 60_000,    // 5 min
    blockMultiplier: 2,
    maxBlockDuration: 30 * 60_000, // max 30 min
}

/**
 * Formulaire de contact : /api/contact
 *
 * Un utilisateur légitime envoie 1-2 messages max par session.
 * Limite stricte pour protéger le quota email et la DB.
 * Limite : 3 / 15 min, blocage 30 min (×3, max 24h).
 */
export const CONTACT_LIMIT: RateLimitConfig = {
    limit: 3,
    window: 15 * 60_000,          // 15 minutes
    blockDuration: 30 * 60_000,   // 30 min
    blockMultiplier: 3,            // 90 min, 4h30, 13h30...
    maxBlockDuration: 24 * 60 * 60_000, // max 24 heures
}
