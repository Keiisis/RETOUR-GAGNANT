// ══════════════════════════════════════════════════════════════
// 🛡️ lib/waf.ts — Façade publique du moteur WAF
// Exposé au middleware + APIs. Garde la compatibilité avec l'ancien
// code tout en branchant sur le nouveau moteur OWASP CRS.
// ══════════════════════════════════════════════════════════════

export type { ThreatType, WafVerdict, RuleMatch, CustomRule } from './waf/engine'
export { analyzeRequest, analyzeRequestFast, checkGeoBlock, verdictSummary, setCustomRulesCache, getCustomRulesCache, setWafConfig, getWafConfig } from './waf/engine'
export { ALL_RULES, RULES_BY_CATEGORY, SEVERITY_SCORES, BLOCK_THRESHOLDS } from './waf/rules'
export type { WafRule, RuleCategory, Severity } from './waf/rules'
export { decode, decodeRequest } from './waf/decoder'

// ── Rate Limiting en mémoire ───────────────────────────────────
interface RateEntry { count: number; window: number }
const rateLimitMap = new Map<string, RateEntry>()

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
    default:  { max: 120, windowMs: 60_000 },
    api:      { max: 60,  windowMs: 60_000 },
    login:    { max: 10,  windowMs: 15 * 60_000 },
    upload:   { max: 20,  windowMs: 60_000 },
    admin:    { max: 200, windowMs: 60_000 },
}

export function checkRateLimit(ip: string, category: keyof typeof RATE_LIMITS = 'default'): boolean {
    const limit = RATE_LIMITS[category] ?? RATE_LIMITS.default
    const key = `${ip}:${category}`
    const now = Date.now()
    const entry = rateLimitMap.get(key)
    if (!entry || now - entry.window > limit.windowMs) {
        rateLimitMap.set(key, { count: 1, window: now })
        return false
    }
    entry.count++
    return entry.count > limit.max
}

export function getRateLimitCategory(pathname: string): keyof typeof RATE_LIMITS {
    if (pathname.includes('/login') || pathname.includes('/register')) return 'login'
    if (pathname.includes('/upload')) return 'upload'
    if (pathname.startsWith('/api/admin')) return 'admin'
    if (pathname.startsWith('/api')) return 'api'
    return 'default'
}

// ── Cache IPs bloquées (TTL 5 min) ────────────────────────────
const blockedIpCache = new Map<string, { blocked: boolean; ts: number }>()
const IP_CACHE_TTL = 5 * 60_000

export function getCachedIpBlock(ip: string): boolean | null {
    const entry = blockedIpCache.get(ip)
    if (!entry) return null
    if (Date.now() - entry.ts > IP_CACHE_TTL) { blockedIpCache.delete(ip); return null }
    return entry.blocked
}

export function setCachedIpBlock(ip: string, blocked: boolean): void {
    blockedIpCache.set(ip, { blocked, ts: Date.now() })
}

export function invalidateIpCache(ip: string): void {
    blockedIpCache.delete(ip)
}

// ── Extraction IP ─────────────────────────────────────────────
export function extractIp(headers: Headers): string {
    return (
        headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headers.get('x-real-ip') ||
        headers.get('cf-connecting-ip') ||
        'unknown'
    )
}

// ── Log WAF event (fire-and-forget) ───────────────────────────
export function logWafEvent(opts: {
    ip: string; method: string; path: string
    userAgent: string; threatType: string
    detail?: string; score?: number
    supabaseUrl: string; serviceKey: string
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
            ip:           payload.ip,
            method:       payload.method,
            path:         payload.path.slice(0, 500),
            user_agent:   payload.userAgent.slice(0, 500),
            threat_type:  payload.threatType,
            threat_detail: (payload.detail || `score=${payload.score ?? '?'}`).slice(0, 500),
        }),
    }).catch(() => {})
}

// ── Auto-block après N violations ────────────────────────────
const violationCounts = new Map<string, number>()
const AUTO_BLOCK_THRESHOLD = 5

export function trackViolation(ip: string, supabaseUrl: string, serviceKey: string): void {
    const count = (violationCounts.get(ip) || 0) + 1
    violationCounts.set(ip, count)
    if (count >= AUTO_BLOCK_THRESHOLD) {
        violationCounts.delete(ip)
        setCachedIpBlock(ip, true)
        fetch(`${supabaseUrl}/rest/v1/ip_blocks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify({
                ip, reason: `Auto-blocage après ${AUTO_BLOCK_THRESHOLD} violations WAF`,
                blocked_by: 'auto', violation_count: count,
            }),
        }).catch(() => {})
    }
}
