// ══════════════════════════════════════════════════════════════
// 🛡️ lib/waf.ts : WAF Ultime · Défense Active · Cyber-Déception
// ══════════════════════════════════════════════════════════════

export type { ThreatType, WafVerdict, RuleMatch, CustomRule } from './waf/engine'
export { analyzeRequest, analyzeRequestFast, checkGeoBlock, verdictSummary, setCustomRulesCache, getCustomRulesCache, setWafConfig, getWafConfig } from './waf/engine'
export { ALL_RULES, RULES_BY_CATEGORY, SEVERITY_SCORES, BLOCK_THRESHOLDS } from './waf/rules'
export type { WafRule, RuleCategory, Severity } from './waf/rules'
export { decode, decodeRequest } from './waf/decoder'

// ── Nouveaux modules Défense Active ──────────────────────────
export { extractFingerprint, registerFingerprint, detectHeadlessBrowser } from './waf/fingerprint'
export type { FingerprintComponents } from './waf/fingerprint'
export { getDeceptionPayload, buildDeceptionResponse, refreshDeceptionPayloads, logDeceptionInteraction } from './waf/deception'
export type { DeceptionPayload, AttackType } from './waf/deception'
export { calculateTarpitDelay, applyTarpit, parseTarpitFromRPC, getTarpitMetrics } from './waf/tarpit'
export type { TarpitDecision } from './waf/tarpit'

// ── Modules Système Immunitaire (Phase 6-8) ──────────────────
export { scanForSSRF } from './waf/ssrf'
export type { SSRFResult, SSRFCategory } from './waf/ssrf'
export { scanForRCE } from './waf/rce'
export type { RCEResult, RCECategory } from './waf/rce'
export { trackIDORAttempt, checkParameterTampering, persistIDORAttempt } from './waf/idor'
export type { IDORResult, IDORPattern } from './waf/idor'
export { scanForSmuggling } from './waf/smuggling'
export type { SmugglingResult, SmugglingPattern } from './waf/smuggling'
export { checkCanaryInRequest, refreshCanaryCache, reportCanaryTriggered, registerHoneyAccess, generateCanaryToken } from './waf/canary'
export type { CanaryCheckResult, CanaryToken, CanaryTokenType } from './waf/canary'

// ── Robots d'indexation légitimes (anti-désindexation) ──
export { identifierRobot, robotRevendique, ipDansCidr, recupererPlagesOfficielles, SOURCES_PLAGES } from './waf/crawlers'
export type { VerdictRobot } from './waf/crawlers'

// ── CORE PORTABLE (extractible : zéro dépendance framework) ──
// Ces modules forment le cœur du WAF-SDK vendable. Ils ne dépendent
// NI de Next.js NI de Supabase. Voir lib/waf/core/README.md.
export {
    scanBody,
    isInternalHost,
    DEFAULT_SCAN_OPTIONS,
} from './waf/core/body-scanner'
export type {
    BodyScanVerdict,
    BodyScanOptions,
    BodyThreatType,
} from './waf/core/body-scanner'
export {
    verifyOwnership,
} from './waf/core/ownership'
export type {
    OwnershipResolver,
    OwnershipQuery,
    OwnershipResolution,
    OwnershipVerdict,
    OwnershipDecision,
    MissingResourcePolicy,
    VerifyOwnershipOptions,
} from './waf/core/ownership'

// ── ADAPTERS (couche jetable par plateforme) ─────────────────
export {
    createSupabaseOwnershipResolver,
    RGB_RESOURCE_MAP,
} from './waf/adapters/supabase-ownership'
export type { ResourceMap, ResourceMapEntry } from './waf/adapters/supabase-ownership'
export {
    scanRequestBody,
    assertOwnership,
    withWafGuard,
} from './waf/adapters/nextjs'
export type {
    ScanRequestBodyResult,
    ScanRequestBodyOptions,
    AssertOwnershipParams,
    AssertOwnershipResult,
    WafGuardOptions,
} from './waf/adapters/nextjs'

// ── CSRF (origin + double-submit) ──
export { checkOrigin, checkDoubleSubmit, generateCsrfToken, constantTimeEqual } from './waf/core/csrf'
export type { CsrfOriginResult } from './waf/core/csrf'

// ── Upload scanner (polyglotes, double-ext, SVG script, MIME mismatch) ──
export { scanUpload } from './waf/core/upload-scanner'
export type { UploadInput, UploadScanVerdict, UploadThreat } from './waf/core/upload-scanner'

// ── Évaluation RPC centralisée (cerveau décisionnel SQL) ─────
// Appelle waf_evaluate_request dans Supabase pour obtenir
// l'action à prendre : allow | tarpit | deceive | block | honeypot
export interface WafEvalResult {
    action:       'allow' | 'tarpit' | 'deceive' | 'block' | 'honeypot'
    delay_ms:     number
    trust_score:  number
    ip_trust:     number
    fp_trust:     number
    reason:       string
    payload?:     { status_code: number; content_type: string; response_body: string; response_headers: Record<string, string> } | null
    ip_hopper:    boolean
    risk_score?:  number
    velocity_rpm?: number
    attack_class?: string
}

export async function evaluateRequestRPC(opts: {
    ip: string
    path: string
    fingerprintHash: string
    userAgent: string
    method?: string
    supabaseUrl: string
    serviceKey: string
}): Promise<WafEvalResult | null> {
    const { ip, path, fingerprintHash, userAgent, method, supabaseUrl, serviceKey } = opts
    if (!supabaseUrl || !serviceKey || ip === 'unknown') return null

    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/waf_evaluate_request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
                p_ip: ip,
                p_path: path,
                p_fingerprint_hash: fingerprintHash || '',
                p_user_agent: userAgent || '',
                p_method: method || 'GET',
            }),
        })
        if (!res.ok) return null
        const result = await res.json()
        return result as WafEvalResult
    } catch {
        return null // fail-open : si RPC échoue, on laisse passer
    }
}

// ══════════════════════════════════════════════════════════════
// RATE LIMITING EN MÉMOIRE
// ══════════════════════════════════════════════════════════════
interface RateEntry { count: number; window: number }
const rateLimitMap = new Map<string, RateEntry>()

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
    default: { max: 120, windowMs: 60_000 },
    api:     { max: 60,  windowMs: 60_000 },
    login:   { max: 30,  windowMs: 15 * 60_000 },
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
// EXTRACTION IP : Anti-spoofing XFF
// ══════════════════════════════════════════════════════════════
const VALID_IP_RE = /^(?:(?:25[0-5]|2[0-4]\d|\d{1,3})\.){3}(?:25[0-5]|2[0-4]\d|\d{1,3})$|^[0-9a-f:]+$/i

// ── Anti-spoofing IP ──────────────────────────────────────────
// Un attaquant peut envoyer de FAUX en-têtes (x-forwarded-for, x-real-ip…)
// pour usurper une IP (évasion de ban) ou empoisonner l'IP d'un tiers.
// Mitigation : l'opérateur épingle le header AUTORITAIRE : celui que la
// plateforme/CDN contrôle et que le client ne peut pas falsifier : via
// la variable d'env WAF_TRUE_IP_HEADER (ex: 'x-vercel-forwarded-for' sur
// Vercel, 'cf-connecting-ip' derrière Cloudflare). Si défini, on ne fait
// confiance QU'À ce header. Sinon, ordre de repli prudent.
export function extractIp(headers: Headers): string {
    const pinned = process.env.WAF_TRUE_IP_HEADER?.trim().toLowerCase()
    if (pinned) {
        const v = headers.get(pinned)?.split(',')[0]?.trim()
        if (v && VALID_IP_RE.test(v)) return v
        // Header autoritaire absent/invalide → on NE retombe PAS sur des
        // headers spoofables : 'unknown' (le WAF traitera prudemment).
        return 'unknown'
    }

    // Pas de header épinglé : ordre de repli (plateforme d'abord).
    const vercelIp = headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    if (vercelIp && VALID_IP_RE.test(vercelIp)) return vercelIp

    const cfIp = headers.get('cf-connecting-ip')?.trim()
    if (cfIp && VALID_IP_RE.test(cfIp)) return cfIp

    const realIp = headers.get('x-real-ip')?.trim()
    if (realIp && VALID_IP_RE.test(realIp)) return realIp

    const xff = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (xff && VALID_IP_RE.test(xff)) return xff

    return 'unknown'
}

// ══════════════════════════════════════════════════════════════
// 🧠 MÉMOIRE IP : Profil comportemental par IP
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

/**
 * Met en cache un profil IP.
 *
 * `ts` mesure l'ancienneté DEPUIS LA LECTURE EN BASE, pas depuis la dernière
 * écriture. Sans cette distinction, `updateIpMemory()` — appelé à CHAQUE
 * requête — repoussait l'échéance en continu : un score dégradé ne périmait
 * donc jamais tant que du trafic arrivait, et `waf_ip_memory` (la source de
 * vérité, qui pouvait dire « trust 100 / allow ») n'était plus jamais relue.
 * Résultat observé le 2026-08-17 : une IP légitime restait murée en 403
 * « Trust score insuffisant » alors que la base l'autorisait, et chaque
 * rechargement de page entretenait le blocage.
 *
 * `preserveAge` conserve l'horodatage d'origine lors d'une simple mise à jour
 * locale du score : l'entrée périme donc au plus tard IP_MEMORY_TTL après sa
 * lecture, ce qui force une relecture en base. La pénalité reste appliquée
 * pendant ce laps de temps, et un attaquant réel demeure bloqué par la base
 * (la pénalité y est persistée via RPC) — seul le verrouillage RAM indéfini
 * disparaît.
 */
export function setCachedIpProfile(
    ip: string, profile: Omit<IpProfile, 'ts'>, preserveAge = false
): void {
    const previousTs = preserveAge ? ipMemoryCache.get(ip)?.ts : undefined
    ipMemoryCache.set(ip, { ...profile, ts: previousTs ?? Date.now() })
}

// ══════════════════════════════════════════════════════════════
// 🧱 MÉMOIRE COMPORTEMENTALE LOCALE (fail-safe Supabase down)
// ══════════════════════════════════════════════════════════════
// Si Supabase est injoignable, le scoring comportemental DB disparaît
// et le WAF retombait en "fail-open". Cette couche RAM (par instance)
// garantit qu'un RÉCIDIVISTE est bloqué localement même sans DB :
// chaque violation incrémente un compteur à fenêtre glissante ; au-delà
// d'un seuil, l'IP est bloquée en mémoire pour une durée (TTL).
//
// Léger, borné (cap d'entrées + éviction LRU), zéro dépendance.
interface LocalThreat { count: number; firstSeen: number; blockedUntil: number }

const localThreatMem = new Map<string, LocalThreat>()
const LOCAL_WINDOW_MS      = 10 * 60_000   // fenêtre de comptage : 10 min
const LOCAL_BLOCK_THRESHOLD = 5            // 5 violations → blocage local
const LOCAL_BLOCK_TTL_MS   = 30 * 60_000   // blocage local : 30 min
const LOCAL_MEM_MAX        = 10_000        // cap anti-fuite mémoire

function evictIfNeeded(): void {
    if (localThreatMem.size <= LOCAL_MEM_MAX) return
    // Évince les ~10% plus anciens (par firstSeen)
    const entries = [...localThreatMem.entries()].sort((a, b) => a[1].firstSeen - b[1].firstSeen)
    const toDrop = Math.ceil(LOCAL_MEM_MAX * 0.1)
    for (let i = 0; i < toDrop && i < entries.length; i++) localThreatMem.delete(entries[i][0])
}

/** Enregistre une violation locale pour une IP ; renvoie true si seuil atteint. */
export function recordLocalViolation(ip: string): boolean {
    if (!ip || ip === 'unknown') return false
    const now = Date.now()
    let t = localThreatMem.get(ip)
    if (!t || now - t.firstSeen > LOCAL_WINDOW_MS) {
        t = { count: 0, firstSeen: now, blockedUntil: 0 }
    }
    t.count++
    if (t.count >= LOCAL_BLOCK_THRESHOLD) {
        t.blockedUntil = now + LOCAL_BLOCK_TTL_MS
    }
    localThreatMem.set(ip, t)
    evictIfNeeded()
    return t.blockedUntil > now
}

/** L'IP est-elle bloquée localement (récidiviste, mémoire RAM) ? */
export function isLocallyBlocked(ip: string): boolean {
    if (!ip || ip === 'unknown') return false
    const t = localThreatMem.get(ip)
    if (!t) return false
    if (t.blockedUntil > Date.now()) return true
    // expiré : purge si la fenêtre est aussi dépassée
    if (Date.now() - t.firstSeen > LOCAL_WINDOW_MS && t.blockedUntil <= Date.now()) {
        localThreatMem.delete(ip)
    }
    return false
}

/** Métriques (observabilité). */
export function getLocalThreatMetrics(): { tracked: number; blocked: number } {
    const now = Date.now()
    let blocked = 0
    for (const t of localThreatMem.values()) if (t.blockedUntil > now) blocked++
    return { tracked: localThreatMem.size, blocked }
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
    // preserveAge : mise à jour LOCALE du score, sans repousser la péremption
    // (sinon l'entrée ne périme jamais sous trafic — voir setCachedIpProfile).
    setCachedIpProfile(ip, {
        trust_score:   newScore,
        blocked_count: (cached?.blocked_count ?? 0) + (isAttack ? 1 : 0),
        attack_types:  attackType && cached
            ? [...new Set([...cached.attack_types, attackType])]
            : attackType ? [attackType] : cached?.attack_types ?? [],
    }, true)

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
// 🌐 BAN DE SOUS-RÉSEAU (/24) : Contre-attaque coordonnée
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
            message: `Attaque coordonnée détectée depuis le sous-réseau ${subnet}.0/24 : ${attackers.size} IPs distinctes`,
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
        fetch(`${supabaseUrl}/rest/v1/waf_attack_campaigns`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify({
                signature_hash: payloadHash,
                label:          'Auto-detected Campaign',
                distinct_ips:   ips.size,
                total_events:   ips.size,
                is_active:      true,
            }),
        }).catch(() => {})

        createAlert({
            level: 'critical',
            message: `Campagne d'attaque détectée : même payload depuis ${ips.size} IPs distinctes`,
            context: { payload_hash: payloadHash, source_ips: [...ips] },
            supabaseUrl, serviceKey,
        })
    } else if (ips.size > CAMPAIGN_THRESHOLD) {
        // Mise à jour campagne existante
        fetch(`${supabaseUrl}/rest/v1/waf_attack_campaigns?signature_hash=eq.${encodeURIComponent(payloadHash)}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                Prefer: 'return=minimal',
            },
            body: JSON.stringify({
                distinct_ips:   ips.size,
                total_events:   ips.size,
                last_seen:     new Date().toISOString(),
            }),
        }).catch(() => {})
    }
}

// ══════════════════════════════════════════════════════════════
// 🤖 APPRENTISSAGE AUTOMATIQUE : Règles auto-générées
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
                message: `Règle auto-apprise activée : "${pattern.slice(0, 60)}" : ${existing.count} hits depuis ${existing.ips.size} IPs`,
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
    // ── Nouveaux champs Défense Active ──
    fingerprintHash?: string
    action?: 'allow' | 'block' | 'tarpit' | 'deceive' | 'honeypot'
    responseDelayMs?: number
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
            ip:               payload.ip,
            method:           payload.method,
            path:             payload.path.slice(0, 500),
            user_agent:       payload.userAgent.slice(0, 500),
            threat_type:      payload.threatType,
            threat_detail:    (payload.detail || `score=${payload.score ?? '?'}`).slice(0, 500),
            is_blocked:       payload.action === 'block' || (!payload.action),
            score:            payload.score ?? 0,
            // ── Colonnes Défense Active ──
            fingerprint_hash: payload.fingerprintHash || '',
            action:           payload.action || 'block',
            response_delay_ms: payload.responseDelayMs || 0,
        }),
    }).catch(() => {})
}

// ══════════════════════════════════════════════════════════════
// ⚡ ESCALADE AUTOMATIQUE : Violations progressives
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
// 🍯 HONEYPOT : Leurre pour attracteur d'attaquants
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
 message: `HONEYPOT : IP ${ip} a tenté d'accéder à ${path} : bannissement immédiat`,
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
