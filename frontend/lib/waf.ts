// ══════════════════════════════════════════════════════════════
// 🛡️ WAF — Web Application Firewall (Application Layer)
// Détection SQLi, XSS, Path Traversal + Blocage IP + Rate Limit
// ══════════════════════════════════════════════════════════════

export type ThreatType =
    | 'sql_injection'
    | 'xss'
    | 'path_traversal'
    | 'rate_limit'
    | 'blocked_ip'
    | 'suspicious_ua'

export interface ThreatResult {
    blocked: boolean
    threatType?: ThreatType
    detail?: string
}

// ── Patterns d'attaque ─────────────────────────────────────────
const SQL_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|HAVING|FROM|WHERE)\b)/i,
    /(--|;|\bOR\b\s+['"\d]|'\s*=\s*'|\bAND\b\s+\d+=\d+)/i,
    /(\bxp_|sp_executesql|INFORMATION_SCHEMA|sys\.objects)/i,
    /(SLEEP\s*\(|BENCHMARK\s*\(|WAITFOR\s+DELAY)/i,
]

const XSS_PATTERNS = [
    /<script[\s>]/i,
    /javascript\s*:/i,
    /on(load|error|click|mouse|focus|blur|change|input|submit)\s*=/i,
    /<iframe|<object|<embed|<link.*rel.*import/i,
    /document\.(cookie|write|location)|window\.location/i,
    /eval\s*\(|atob\s*\(|String\.fromCharCode/i,
]

const PATH_TRAVERSAL_PATTERNS = [
    /\.\.[/\\]/,
    /%2e%2e[%/\\]/i,
    /\.(php|asp|aspx|jsp|cgi|pl|sh|bash|cmd|exe|bat|ps1)$/i,
]

const SUSPICIOUS_UA_PATTERNS = [
    /sqlmap|nikto|nessus|masscan|nmap|hydra|burpsuite/i,
    /python-requests\/[01]\./i,
    /go-http-client\/[01]\./i,
    /(curl|wget)\/[0-9].*(\s|$)/i,
]

// ── Rate Limiting en mémoire ───────────────────────────────────
interface RateEntry { count: number; window: number }
const rateLimitMap = new Map<string, RateEntry>()

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
    default:       { max: 120, windowMs: 60_000 },    // 120 req/min
    api:           { max: 60,  windowMs: 60_000 },    // 60 req/min sur /api/*
    login:         { max: 10,  windowMs: 15 * 60_000 }, // 10 essais/15min
    upload:        { max: 20,  windowMs: 60_000 },    // 20 uploads/min
}

export function checkRateLimit(ip: string, category: keyof typeof RATE_LIMITS = 'default'): boolean {
    const limit = RATE_LIMITS[category] || RATE_LIMITS.default
    const key = `${ip}:${category}`
    const now = Date.now()
    const entry = rateLimitMap.get(key)

    if (!entry || now - entry.window > limit.windowMs) {
        rateLimitMap.set(key, { count: 1, window: now })
        return false // pas limité
    }
    entry.count++
    return entry.count > limit.max // true = bloqué
}

// ── Cache des IPs bloquées (TTL 5 min) ────────────────────────
const blockedIpCache = new Map<string, { blocked: boolean; ts: number }>()
const IP_CACHE_TTL = 5 * 60_000 // 5 minutes

export function getCachedIpBlock(ip: string): boolean | null {
    const entry = blockedIpCache.get(ip)
    if (!entry) return null
    if (Date.now() - entry.ts > IP_CACHE_TTL) {
        blockedIpCache.delete(ip)
        return null
    }
    return entry.blocked
}

export function setCachedIpBlock(ip: string, blocked: boolean): void {
    blockedIpCache.set(ip, { blocked, ts: Date.now() })
}

export function invalidateIpCache(ip: string): void {
    blockedIpCache.delete(ip)
}

// ── Analyse de la requête ──────────────────────────────────────
export function analyzeRequest(
    method: string,
    pathname: string,
    searchParams: string,
    userAgent: string
): ThreatResult {
    const fullUrl = pathname + (searchParams ? '?' + searchParams : '')
    const decodedUrl = decodeURIComponent(fullUrl).toLowerCase()

    // Path traversal
    for (const pat of PATH_TRAVERSAL_PATTERNS) {
        if (pat.test(decodedUrl)) {
            return { blocked: true, threatType: 'path_traversal', detail: pat.source.slice(0, 80) }
        }
    }

    // SQL Injection
    for (const pat of SQL_PATTERNS) {
        if (pat.test(decodedUrl)) {
            return { blocked: true, threatType: 'sql_injection', detail: pat.source.slice(0, 80) }
        }
    }

    // XSS
    for (const pat of XSS_PATTERNS) {
        if (pat.test(decodedUrl)) {
            return { blocked: true, threatType: 'xss', detail: pat.source.slice(0, 80) }
        }
    }

    // User-Agent suspect (bloquer seulement les scanners connus)
    for (const pat of SUSPICIOUS_UA_PATTERNS) {
        if (pat.test(userAgent)) {
            return { blocked: true, threatType: 'suspicious_ua', detail: userAgent.slice(0, 100) }
        }
    }

    return { blocked: false }
}

// ── Extraire l'IP réelle ───────────────────────────────────────
export function extractIp(headers: Headers): string {
    return (
        headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headers.get('x-real-ip') ||
        headers.get('cf-connecting-ip') ||
        'unknown'
    )
}

// ── Catégorie de rate limit selon le path ─────────────────────
export function getRateLimitCategory(pathname: string): keyof typeof RATE_LIMITS {
    if (pathname.includes('/login') || pathname.includes('/register')) return 'login'
    if (pathname.includes('/upload')) return 'upload'
    if (pathname.startsWith('/api')) return 'api'
    return 'default'
}

// ── Enregistrement asynchrone dans Supabase ───────────────────
// Fire-and-forget : ne bloque pas la réponse
export function logWafEvent(opts: {
    ip: string
    method: string
    path: string
    userAgent: string
    threatType: ThreatType
    detail?: string
    supabaseUrl: string
    serviceKey: string
}): void {
    const { supabaseUrl, serviceKey, ...payload } = opts
    fetch(`${supabaseUrl}/rest/v1/waf_logs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({
            ip: payload.ip,
            method: payload.method,
            path: payload.path.slice(0, 500),
            user_agent: payload.userAgent.slice(0, 500),
            threat_type: payload.threatType,
            threat_detail: payload.detail?.slice(0, 500) || null,
        }),
    }).catch(() => { /* silencieux */ })
}

// Auto-block après N violations (fire-and-forget)
const AUTO_BLOCK_THRESHOLD = 5
const violationCounts = new Map<string, number>()

export function trackViolation(ip: string, supabaseUrl: string, serviceKey: string): void {
    const count = (violationCounts.get(ip) || 0) + 1
    violationCounts.set(ip, count)

    if (count >= AUTO_BLOCK_THRESHOLD) {
        violationCounts.delete(ip)
        setCachedIpBlock(ip, true)

        // Upsert dans ip_blocks
        fetch(`${supabaseUrl}/rest/v1/ip_blocks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify({
                ip,
                reason: `Auto-blocage après ${AUTO_BLOCK_THRESHOLD} violations`,
                blocked_by: 'auto',
                violation_count: count,
            }),
        }).catch(() => { /* silencieux */ })
    }
}
