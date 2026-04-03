// ══════════════════════════════════════════════════════════════
// 🛡️ lib/waf.ts — WAF Autonome · Mémoire · Apprentissage · Contre-attaque
// ══════════════════════════════════════════════════════════════

export type { ThreatType, WafVerdict, RuleMatch, CustomRule } from './waf/engine'
export { analyzeRequest, analyzeRequestFast, checkGeoBlock, verdictSummary, setCustomRulesCache, getCustomRulesCache, setWafConfig, getWafConfig } from './waf/engine'
export { ALL_RULES, RULES_BY_CATEGORY, SEVERITY_SCORES, BLOCK_THRESHOLDS } from './waf/rules'
export type { WafRule, RuleCategory, Severity } from './waf/rules'
export { decode, decodeRequest } from './waf/decoder'

// ══════════════════════════════════════════════════════════════
// RATE LIMITING EN MÉMOIRE
// ══════════════════════════════════════════════════════════════
interface RateEntry { count: number; window: number }
const rateLimitMap = new Map<string, RateEntry>()

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
    default: { max: 120, windowMs: 60_000 },
    api:     { max: 60,  windowMs: 60_000 },
    login:   { max: 10,  windowMs: 15 * 60_000 },
    upload:  { max: 20,  windowMs: 60_000 },
    admin:   { max: 200, windowMs: 60_000 },
}

export function checkRateLimit(ip: string, category: keyof typeof RATE_LIMITS = 'default'): boolean {
    const limit = RATE_LIMITS[category] ?? RATE_LIMITS.default
    const key   = `${ip}:${category}`
    const now   = Date.now()
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

// ══════════════════════════════════════════════════════════════
// CACHE IPs BLOQUÉES (TTL 5 min)
// ══════════════════════════════════════════════════════════════
const blockedIpCache = new Map<string, { blocked: boolean; ts: number }>()
const IP_CACHE_TTL   = 5 * 60_000

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

// ══════════════════════════════════════════════════════════════
// EXTRACTION IP — Anti-spoofing XFF
// ══════════════════════════════════════════════════════════════
const VALID_IP_RE = /^(?:(?:25[0-5]|2[0-4]\d|\d{1,3})\.){3}(?:25[0-5]|2[0-4]\d|\d{1,3})$|^[0-9a-f:]+$/i

export function extractIp(headers: Headers): string {
    const realIp = headers.get('x-real-ip')?.trim()
    if (realIp && VALID_IP_RE.test(realIp)) return realIp

    const cfIp = headers.get('cf-connecting-ip')?.trim()
    if (cfIp && VALID_IP_RE.test(cfIp)) return cfIp

    const vercelIp = headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    if (vercelIp && VALID_IP_RE.test(vercelIp)) return vercelIp

    const xff = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (xff && VALID_IP_RE.test(xff)) return xff

    return 'unknown'
}

// ══════════════════════════════════════════════════════════════
// 🧠 MÉMOIRE IP — Profil comportemental par IP
// Trust score : 0-100 (50=neutre, 0=danger, 100=fiable)
// Persiste dans waf_ip_memory via RPC atomique Supabase
// ══════════════════════════════════════════════════════════════
interface IpProfile {
    trust_score:   number
    blocked_count: number
    attack_types:  string[]
    ts:            number
}

const ipMemoryCache = new Map<string, IpProfile>()
const IP_MEMORY_TTL = 3 * 60_000   // refresh toutes les 3 min

// Seuil de blocage automatique par trust score
const TRUST_AUTO_BLOCK = 15         // trust < 15 → blocage immédiat
const TRUST_PENALTY    = -18        // pénalité par attaque détectée
const TRUST_REWARD     = +1         // bonus par requête légitime

export function getIpProfileFromCache(ip: string): IpProfile | null {
    const p = ipMemoryCache.get(ip)
    if (!p) return null
    if (Date.now() - p.ts > IP_MEMORY_TTL) { ipMemoryCache.delete(ip); return null }
    return p
}

export function setCachedIpProfile(ip: string, profile: Omit<IpProfile, 'ts'>): void {
    ipMemoryCache.set(ip, { ...profile, ts: Date.now() })
}

// Vérification trust score via Supabase (async)
export async function checkIpTrustScore(
    ip: string, supabaseUrl: string, serviceKey: string
): Promise<{ trusted: boolean; score: number }> {
    if (ip === 'unknown' || !supabaseUrl || !serviceKey) return { trusted: true, score: 50 }

    // Cache local d'abord
    const cached = getIpProfileFromCache(ip)
    if (cached) return { trusted: cached.trust_score >= TRUST_AUTO_BLOCK, score: cached.trust_score }

    try {
        const res = await fetch(
            `${supabaseUrl}/rest/v1/waf_ip_memory?ip=eq.${encodeURIComponent(ip)}&select=trust_score,blocked_count,attack_types&limit=1`,
            { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
        )
        if (!res.ok) return { trusted: true, score: 50 }
        const rows = await res.json() as Array<{ trust_score: number; blocked_count: number; attack_types: string[] }>
        if (!Array.isArray(rows) || rows.length === 0) return { trusted: true, score: 50 }

        const profile = rows[0]
        setCachedIpProfile(ip, profile)
        return { trusted: profile.trust_score >= TRUST_AUTO_BLOCK, score: profile.trust_score }
    } catch {
        return { trusted: true, score: 50 }
    }
}

// Mise à jour mémoire IP (fire-and-forget)
export function updateIpMemory(opts: {
    ip: string; isAttack: boolean; attackType?: string
    payloadHash?: string; supabaseUrl: string; serviceKey: string
}): void {
    const { ip, isAttack, attackType, payloadHash, supabaseUrl, serviceKey } = opts
    if (!supabaseUrl || !serviceKey || ip === 'unknown') return

    // Mise à jour cache local immédiate
    const cached = getIpProfileFromCache(ip)
    const newScore = Math.max(0, Math.min(100,
        (cached?.trust_score ?? 50) + (isAttack ? TRUST_PENALTY : TRUST_REWARD)
    ))
    setCachedIpProfile(ip, {
        trust_score:   newScore,
        blocked_count: (cached?.blocked_count ?? 0) + (isAttack ? 1 : 0),
        attack_types:  attackType && cached
            ? [...new Set([...cached.attack_types, attackType])]
            : attackType ? [attackType] : cached?.attack_types ?? [],
    })

    // Persistance async via RPC atomique
    fetch(`${supabaseUrl}/rest/v1/rpc/update_ip_memory`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
            p_ip:           ip,
            p_is_attack:    isAttack,
            p_trust_delta:  isAttack ? TRUST_PENALTY : TRUST_REWARD,
            p_attack_type:  attackType || null,
            p_payload_hash: payloadHash || null,
        }),
    }).catch(() => {})
}

// ══════════════════════════════════════════════════════════════
// 🌐 BAN DE SOUS-RÉSEAU (/24) — Contre-attaque coordonnée
// Si 3+ IPs du même /24 attaquent → bannir tout le sous-réseau
// ══════════════════════════════════════════════════════════════
const subnetAttackers = new Map<string, Set<string>>()
const SUBNET_BAN_THRESHOLD = 3

export function getSubnet24(ip: string): string | null {
    const parts = ip.split('.')
    if (parts.length !== 4) return null
    return `${parts[0]}.${parts[1]}.${parts[2]}`
}

const bannedSubnets = new Set<string>()

export function checkSubnetBanned(ip: string): boolean {
    const subnet = getSubnet24(ip)
    if (!subnet) return false
    return bannedSubnets.has(subnet)
}

export function trackSubnetAttack(
    ip: string, supabaseUrl: string, serviceKey: string
): void {
    const subnet = getSubnet24(ip)
    if (!subnet) return

    if (!subnetAttackers.has(subnet)) subnetAttackers.set(subnet, new Set())
    const attackers = subnetAttackers.get(subnet)!
    attackers.add(ip)

    if (attackers.size >= SUBNET_BAN_THRESHOLD && !bannedSubnets.has(subnet)) {
        bannedSubnets.add(subnet)
        // Alerte critique
        createAlert({
            level: 'critical',
            message: `Attaque coordonnée détectée depuis le sous-réseau ${subnet}.0/24 — ${attackers.size} IPs distinctes`,
            context: { subnet, ips: [...attackers], count: attackers.size },
            supabaseUrl, serviceKey,
        })
        // Bannir chaque IP individuellement dans ip_blocks
        for (const attackerIp of attackers) {
            autoBlockIp(attackerIp, `Attaque sous-réseau coordonnée ${subnet}.0/24`, supabaseUrl, serviceKey)
        }
    }
}

// ══════════════════════════════════════════════════════════════
// 📢 ALERTES TEMPS RÉEL (waf_alerts)
// ══════════════════════════════════════════════════════════════
export function createAlert(opts: {
    level: 'info' | 'warning' | 'critical' | 'nuclear'
    message: string
    context?: Record<string, unknown>
    supabaseUrl: string; serviceKey: string
}): void {
    const { level, message, context, supabaseUrl, serviceKey } = opts
    fetch(`${supabaseUrl}/rest/v1/waf_alerts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({ level, message, context: context || {} }),
    }).catch(() => {})
}

// ══════════════════════════════════════════════════════════════
// 🎯 DÉTECTION DE CAMPAGNES D'ATTAQUE
// Même payload hash depuis plusieurs IPs = attaque organisée
// ══════════════════════════════════════════════════════════════
const campaignHits = new Map<string, Set<string>>()   // hash → Set<ip>
const CAMPAIGN_THRESHOLD = 3

export function trackCampaign(
    payloadHash: string, ip: string, supabaseUrl: string, serviceKey: string
): void {
    if (!payloadHash || ip === 'unknown') return
    if (!campaignHits.has(payloadHash)) campaignHits.set(payloadHash, new Set())
    const ips = campaignHits.get(payloadHash)!
    ips.add(ip)

    if (ips.size === CAMPAIGN_THRESHOLD) {
        // Enregistrer la campagne dans Supabase
        fetch(`${supabaseUrl}/rest/v1/waf_campaigns`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify({
                payload_hash:  payloadHash,
                source_ips:    [...ips],
                blocked_count: ips.size,
                status:        'active',
            }),
        }).catch(() => {})

        createAlert({
            level: 'critical',
            message: `Campagne d'attaque détectée — même payload depuis ${ips.size} IPs distinctes`,
            context: { payload_hash: payloadHash, source_ips: [...ips] },
            supabaseUrl, serviceKey,
        })
    } else if (ips.size > CAMPAIGN_THRESHOLD) {
        // Mise à jour campagne existante
        fetch(`${supabaseUrl}/rest/v1/waf_campaigns?payload_hash=eq.${encodeURIComponent(payloadHash)}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                Prefer: 'return=minimal',
            },
            body: JSON.stringify({
                source_ips:    [...ips],
                blocked_count: ips.size,
                last_seen:     new Date().toISOString(),
            }),
        }).catch(() => {})
    }
}

// ══════════════════════════════════════════════════════════════
// 🤖 APPRENTISSAGE AUTOMATIQUE — Règles auto-générées
// Quand un pattern frappe N fois → règle candidate
// ══════════════════════════════════════════════════════════════
const learnedPatternHits  = new Map<string, { count: number; ips: Set<string>; category: string }>()
const LEARN_ACTIVATE_AT   = 10   // règle activée après 10 hits
const LEARN_CANDIDATE_AT  = 3    // candidate après 3 hits

export function learnAttackPattern(opts: {
    pattern: string; category: string; ip: string; description: string
    supabaseUrl: string; serviceKey: string
}): void {
    const { pattern, category, ip, description, supabaseUrl, serviceKey } = opts
    if (!pattern || pattern.length < 4) return

    const existing = learnedPatternHits.get(pattern)
    if (existing) {
        existing.count++
        existing.ips.add(ip)

        if (existing.count === LEARN_CANDIDATE_AT) {
            // Créer règle candidate (non active)
            fetch(`${supabaseUrl}/rest/v1/waf_learned_rules`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    Prefer: 'resolution=merge-duplicates,return=minimal',
                },
                body: JSON.stringify({
                    pattern, category, description,
                    source_ips:  [...existing.ips],
                    hit_count:   existing.count,
                    confidence:  existing.ips.size / 10,   // 0-1
                    auto_active: false,
                }),
            }).catch(() => {})
        } else if (existing.count >= LEARN_ACTIVATE_AT && existing.ips.size >= 2) {
            // Activer la règle automatiquement
            fetch(`${supabaseUrl}/rest/v1/waf_learned_rules?pattern=eq.${encodeURIComponent(pattern)}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    Prefer: 'return=minimal',
                },
                body: JSON.stringify({
                    hit_count:   existing.count,
                    source_ips:  [...existing.ips],
                    confidence:  Math.min(1, existing.ips.size / 5),
                    auto_active: true,
                    updated_at:  new Date().toISOString(),
                }),
            }).catch(() => {})

            createAlert({
                level: 'info',
                message: `Règle auto-apprise activée : "${pattern.slice(0, 60)}" — ${existing.count} hits depuis ${existing.ips.size} IPs`,
                context: { pattern, category, hit_count: existing.count },
                supabaseUrl, serviceKey,
            })
        }
    } else {
        learnedPatternHits.set(pattern, { count: 1, ips: new Set([ip]), category })
    }
}

// ══════════════════════════════════════════════════════════════
// 🚫 BLOCAGE AUTOMATIQUE IP
// ══════════════════════════════════════════════════════════════
function autoBlockIp(ip: string, reason: string, supabaseUrl: string, serviceKey: string): void {
    setCachedIpBlock(ip, true)
    fetch(`${supabaseUrl}/rest/v1/ip_blocks`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({ ip, reason, blocked_by: 'auto', violation_count: AUTO_BLOCK_THRESHOLD }),
    }).catch(() => {})
}

// ══════════════════════════════════════════════════════════════
// 📝 LOG WAF EVENT
// ══════════════════════════════════════════════════════════════
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
            ip:            payload.ip,
            method:        payload.method,
            path:          payload.path.slice(0, 500),
            user_agent:    payload.userAgent.slice(0, 500),
            threat_type:   payload.threatType,
            threat_detail: (payload.detail || `score=${payload.score ?? '?'}`).slice(0, 500),
            is_blocked:    true,
            score:         payload.score ?? 0,
        }),
    }).catch(() => {})
}

// ══════════════════════════════════════════════════════════════
// ⚡ ESCALADE AUTOMATIQUE — Violations progressives
//
// Niveau 0 → N-1 : log seulement
// Niveau N (5)   : ban IP immédiat + alerte warning
// Niveau 2N (10) : ban sous-réseau /24 + alerte critical
// Niveau 3N (15) : alerte nuclear (menace persistante)
//
// CONTRE-ATTAQUE :
//   - IP bannies → réponses 403 immédiates (0 latence pour l'app)
//   - Sous-réseau banni → bloque tout le /24 automatiquement
//   - Campagnes → détection multi-IP, alerte temps réel
//   - Règles auto-apprises → nouvelles signatures activées auto
//   - Trust score → profil comportemental persistant par IP
// ══════════════════════════════════════════════════════════════
const violationCounts    = new Map<string, number>()
const AUTO_BLOCK_THRESHOLD = 5

export function trackViolation(
    ip: string,
    supabaseUrl: string,
    serviceKey: string,
    opts?: { threatType?: string; payloadHash?: string; snippet?: string }
): void {
    const count = (violationCounts.get(ip) || 0) + 1
    violationCounts.set(ip, count)

    // Mise à jour mémoire IP (trust score -18 par violation)
    updateIpMemory({
        ip, isAttack: true,
        attackType:  opts?.threatType,
        payloadHash: opts?.payloadHash,
        supabaseUrl, serviceKey,
    })

    // Détection campagne si hash fourni
    if (opts?.payloadHash) {
        trackCampaign(opts.payloadHash, ip, supabaseUrl, serviceKey)
    }

    // Apprentissage automatique si snippet fourni
    if (opts?.snippet && opts.snippet.length >= 4) {
        learnAttackPattern({
            pattern:     opts.snippet.slice(0, 200),
            category:    opts.threatType || 'custom_rule',
            ip, description: `Auto-appris depuis ${opts.threatType || 'WAF'}`,
            supabaseUrl, serviceKey,
        })
    }

    // Suivi sous-réseau
    trackSubnetAttack(ip, supabaseUrl, serviceKey)

    // Escalade selon le niveau de violations
    if (count >= AUTO_BLOCK_THRESHOLD) {
        violationCounts.delete(ip)
        autoBlockIp(ip, `Auto-blocage après ${count} violations WAF`, supabaseUrl, serviceKey)

        createAlert({
            level: count >= AUTO_BLOCK_THRESHOLD * 3 ? 'nuclear'
                 : count >= AUTO_BLOCK_THRESHOLD * 2 ? 'critical'
                 : 'warning',
            message: `IP ${ip} bannie après ${count} violations WAF${opts?.threatType ? ` (${opts.threatType})` : ''}`,
            context: { ip, count, threat_type: opts?.threatType, snippet: opts?.snippet?.slice(0, 100) },
            supabaseUrl, serviceKey,
        })
    }
}

// ══════════════════════════════════════════════════════════════
// 🍯 HONEYPOT — Leurre pour attracteur d'attaquants
// Chemins qui semblent "juteux" pour les hackers mais ne sont
// que des pièges → ban immédiat si accédés
// ══════════════════════════════════════════════════════════════
const HONEYPOT_PATHS = new Set([
    '/admin.php', '/wp-admin', '/wp-login.php', '/phpmyadmin',
    '/.env', '/.git/config', '/config.php', '/backup.zip',
    '/shell.php', '/c99.php', '/r57.php', '/adminer.php',
    '/api/v1/debug', '/api/admin/dump', '/server-status',
    '/actuator', '/actuator/env', '/actuator/health',
    '/.well-known/security.txt.bak', '/debug/vars',
    '/xmlrpc.php', '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php',
])

export function isHoneypotPath(pathname: string): boolean {
    if (HONEYPOT_PATHS.has(pathname)) return true
    // Patterns honeypot (PHPshells, exploits courants)
    if (/\.(php|asp|aspx|jsp|cgi|pl|py|rb|sh)$/.test(pathname) && !pathname.startsWith('/api')) return true
    if (/\/(wp-|drupal|joomla|magento|laravel|symfony|django)/.test(pathname)) return true
    if (/\/\.\.(\/|\\)/.test(pathname)) return true   // Path traversal
    return false
}

export function triggerHoneypot(
    ip: string, path: string, supabaseUrl: string, serviceKey: string
): void {
    // Ban immédiat : un chemin honeypot ne peut être accédé que malicieusement
    setCachedIpBlock(ip, true)
    autoBlockIp(ip, `Honeypot déclenché : ${path}`, supabaseUrl, serviceKey)
    updateIpMemory({ ip, isAttack: true, attackType: 'honeypot', supabaseUrl, serviceKey })

    createAlert({
        level: 'critical',
        message: `🍯 HONEYPOT : IP ${ip} a tenté d'accéder à ${path} — bannissement immédiat`,
        context: { ip, path },
        supabaseUrl, serviceKey,
    })

    logWafEvent({
        ip, method: 'GET', path,
        userAgent: 'honeypot-trigger',
        threatType: 'honeypot',
        detail: `Accès au leurre honeypot : ${path}`,
        supabaseUrl, serviceKey,
    })
}
