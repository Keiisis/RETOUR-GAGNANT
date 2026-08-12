// ═══════════════════════════════════════════════════════
// 🛡️ Security Utilities : Fonctions de sécurité partagées
// ═══════════════════════════════════════════════════════

/**
 * Échappe les caractères HTML pour prévenir les attaques XSS.
 * À utiliser dans tout HTML généré côté serveur.
 */
export const escapeHtml = (str: string | null | undefined): string => {
    if (!str) return ''
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
}

/**
 * Valide le format d'un email.
 */
export const isValidEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
}

/**
 * Valide le format d'un numéro de téléphone (international ou Bénin).
 * Accepte : +229XXXXXXXX, 00229XXXXXXXX, 9XXXXXXXX, etc.
 */
export const isValidPhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-().]/g, '')
    return /^\+?[\d]{8,15}$/.test(cleaned)
}

/**
 * Sanitise une chaîne en retirant les caractères dangereux.
 * Préserve les lettres accentuées (français), chiffres, espaces, et ponctuation de base.
 */
export const sanitizeInput = (str: string | null | undefined): string => {
    if (!str) return ''
    return str
        .replace(/<[^>]*>/g, '')        // Retire les tags HTML
        .replace(/[<>{}]/g, '')          // Retire les caractères dangereux restants
        .trim()
        .slice(0, 5000)                  // Limite la taille max
}

// ═══════════════════════════════════════════════════════
// 🕐 API Rate Limiting (in-memory pour serverless)
// ═══════════════════════════════════════════════════════

const rateLimitStore = new Map<string, { count: number, resetAt: number }>()

interface RateLimitConfig {
    windowMs: number      // Durée de la fenêtre en ms
    maxRequests: number   // Nombre max de requêtes par fenêtre
}

/**
 * Vérifie si une IP a dépassé la limite de requêtes.
 * @returns true si limité, false si autorisé
 */
export const isApiRateLimited = (
    ip: string,
    endpoint: string,
    config: RateLimitConfig = { windowMs: 60_000, maxRequests: 10 }
): boolean => {
    const key = `${endpoint}:${ip}`
    const now = Date.now()
    const entry = rateLimitStore.get(key)

    if (!entry || now > entry.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs })
        return false
    }

    entry.count++
    return entry.count > config.maxRequests
}

/**
 * Extrait l'adresse IP d'une requête (supporte les proxys/CDN).
 */
export const getClientIp = (request: Request): string => {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown'
}
