import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
    extractIp,
    checkRateLimit,
    getRateLimitCategory,
    analyzeRequestFast,
    checkGeoBlock,
    getCachedIpBlock,
    setCachedIpBlock,
    logWafEvent,
    trackViolation,
    setWafConfig,
    setCustomRulesCache,
    getCustomRulesCache,
    checkIpTrustScore,
    checkSubnetBanned,
    isHoneypotPath,
    triggerHoneypot,
    updateIpMemory,
    createAlert,
    type ThreatType,
} from '@/lib/waf'

// ═══════════════════════════════════════════════════════════════
// 🛡️ MIDDLEWARE — WAF OWASP CRS + Auth Protection
// ═══════════════════════════════════════════════════════════════
//
// ARCHITECTURE DE SÉCURITÉ (ordre strict) :
//
//  0. WAF_EMERGENCY_BYPASS → passe auth uniquement, WAF désactivé
//  1. Chemins login/reset/2fa → accès immédiat, zéro check
//  2. IP bloquée → 403 (sauf chemins login)
//  3. Géo-blocage → 403
//  4. Rate Limiting → 429
//  5. WAF CRS → UNIQUEMENT sur chemins non-panel (API, public)
//     Les panels /admin, /agent, /client sont protégés par auth
//     WAF sur ces chemins = 100% faux positifs sur routes légitimes
//  6. Auth Supabase + rôles
//
// PANELS INTERNES : /admin/*, /agent/*, /client/*
//   → Jamais bloqués par WAF CRS (URL générée par l'app)
//   → Protégés par l'auth Supabase (étape 6)
//
// ACTIVATION D'URGENCE : WAF_EMERGENCY_BYPASS=true dans .env
//   → Désactive tous les checks WAF, garde l'auth
// ═══════════════════════════════════════════════════════════════

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL  || ''
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ── Chemins qui bypass ABSOLUMENT tout (même IP bloquée) ──────
const ABSOLUTE_BYPASS = [
    '/admin/login',
    '/admin/reset-password',
    '/admin/2fa',
    '/agent/login',
    '/agent/reset-password',
    '/client/login',
    '/client/register',
    '/client/reset-password',
    '/client/forgot-password',
    '/ceo/login',
    '/ceo/reset-password',
]

function isAbsoluteBypass(pathname: string): boolean {
    return ABSOLUTE_BYPASS.some(p => pathname === p || pathname.startsWith(p + '?'))
}

// ── Charger config WAF + règles custom depuis Supabase ────────
async function refreshWafConfig(): Promise<void> {
    const { stale } = getCustomRulesCache()
    if (!stale || !SUPA_URL || !SUPA_KEY) return

    try {
        const [configRes, rulesRes] = await Promise.all([
            fetch(`${SUPA_URL}/rest/v1/waf_config?select=key,value`, {
                headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
            }),
            fetch(`${SUPA_URL}/rest/v1/waf_rules?enabled=eq.true&select=*`, {
                headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
            }),
        ])

        if (configRes.ok) {
            const rows = await configRes.json() as Array<{ key: string; value: string }>
            if (Array.isArray(rows)) {
                const map = Object.fromEntries(rows.map(r => [r.key, r.value]))
                setWafConfig({
                    paranoiaLevel:    parseInt(map['paranoia_level'] || '1') || 1,
                    blockedCountries: map['blocked_countries'] ? JSON.parse(map['blocked_countries']) : [],
                    whitelistedIps:   map['whitelisted_ips']   ? JSON.parse(map['whitelisted_ips'])   : [],
                    whitelistedPaths: map['whitelisted_paths'] ? JSON.parse(map['whitelisted_paths']) : [],
                    enabled:          map['enabled'] !== 'false',
                })
            }
        }

        if (rulesRes.ok) {
            const rules = await rulesRes.json()
            if (Array.isArray(rules)) setCustomRulesCache(rules)
        }
    } catch { /* silencieux */ }
}

// ── Vérifier blocage IP ───────────────────────────────────────
async function isIpBlocked(ip: string): Promise<boolean> {
    const cached = getCachedIpBlock(ip)
    if (cached !== null) return cached
    if (!SUPA_URL || !SUPA_KEY) return false
    try {
        const res = await fetch(
            `${SUPA_URL}/rest/v1/ip_blocks?ip=eq.${encodeURIComponent(ip)}&unblocked_at=is.null&select=ip&limit=1`,
            { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
        )
        const rows = await res.json() as Array<unknown>
        const blocked = Array.isArray(rows) && rows.length > 0
        setCachedIpBlock(ip, blocked)
        return blocked
    } catch { return false }
}

function wafBlock(reason: string, status = 403): NextResponse {
    return new NextResponse(JSON.stringify({ error: reason }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

// ══════════════════════════════════════════════════════════════
export async function middleware(request: NextRequest) {
    const response = NextResponse.next({ request: { headers: request.headers } })

    // ─── Security Headers (toujours appliqués) ───────────────
    const secHeaders: Record<string, string> = {
        'X-Content-Type-Options':    'nosniff',
        'X-Frame-Options':           'SAMEORIGIN',
        'X-XSS-Protection':          '1; mode=block',
        'Referrer-Policy':           'strict-origin-when-cross-origin',
        'Permissions-Policy':        'camera=(), microphone=(self), geolocation=()',
    }
    Object.entries(secHeaders).forEach(([k, v]) => response.headers.set(k, v))

    const pathname  = request.nextUrl.pathname
    const ip        = extractIp(request.headers)
    const userAgent = request.headers.get('user-agent') || ''
    const method    = request.method

    // ─── 0. WAF EMERGENCY BYPASS ─────────────────────────────
    // Définir WAF_EMERGENCY_BYPASS=true dans Vercel → désactive tout le WAF
    // L'auth Supabase reste active pour protéger les données
    const emergencyBypass = process.env.WAF_EMERGENCY_BYPASS === 'true'

    // ─── 1. ABSOLUTE BYPASS (login, reset, 2fa) ──────────────
    // Ces chemins ne doivent JAMAIS être bloqués — même IP bloquée
    // → L'admin doit toujours pouvoir se reconnecter
    if (isAbsoluteBypass(pathname)) {
        return response
    }

    // ─── Refresh config WAF (async, non bloquant) ────────────
    if (!emergencyBypass) {
        refreshWafConfig().catch(() => {})
    }

    // ─── 2. HONEYPOT — Ban immédiat si chemin piège ──────────
    // Ces chemins ne sont jamais accédés légitimement — uniquement par des bots/scanners
    if (!emergencyBypass && isHoneypotPath(pathname)) {
        if (SUPA_URL && SUPA_KEY) triggerHoneypot(ip, pathname, SUPA_URL, SUPA_KEY)
        return wafBlock('Not Found.', 404)   // Retourner 404 pour ne pas alerter le hacker
    }

    // ─── 3. IP BLOQUÉE + TRUST SCORE + SOUS-RÉSEAU ───────────
    //
    // IMPORTANT : Les panels internes (/admin/*, /agent/*, /client/*, /ceo/*)
    // sont EXEMPTÉS du check IP bloquée.
    // Raison : Ces panels sont protégés par l'auth Supabase (étape 6).
    //
    const isInternalPanelPath = (
        pathname.startsWith('/admin') ||
        pathname.startsWith('/agent') ||
        pathname.startsWith('/client') ||
        pathname.startsWith('/ceo')
    )

    if (!emergencyBypass && !isInternalPanelPath) {
        // 3a. Check sous-réseau banni (en mémoire, ultra-rapide)
        if (checkSubnetBanned(ip)) {
            return wafBlock('Accès refusé.', 403)
        }

        // 3b. Check IP bloquée (cache + Supabase)
        if (ip !== 'unknown' && await isIpBlocked(ip)) {
            if (SUPA_URL && SUPA_KEY) logWafEvent({
                ip, method, path: pathname, userAgent,
                threatType: 'blocked_ip', detail: 'IP dans la liste de blocage',
                supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
            })
            return wafBlock('Accès refusé.', 403)
        }

        // 3c. Check trust score (mémoire comportementale)
        // Si trust_score < seuil → blocage autonome sans attendre N violations
        if (ip !== 'unknown' && SUPA_URL && SUPA_KEY) {
            const { trusted } = await checkIpTrustScore(ip, SUPA_URL, SUPA_KEY)
            if (!trusted) {
                logWafEvent({
                    ip, method, path: pathname, userAgent,
                    threatType: 'blocked_ip', detail: 'Trust score insuffisant (mémoire comportementale)',
                    supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                })
                return wafBlock('Accès refusé.', 403)
            }
        }
    } else if (!emergencyBypass && isInternalPanelPath) {
        // Pour les panels : vérifier uniquement le sous-réseau banni
        if (checkSubnetBanned(ip)) {
            return wafBlock('Accès refusé.', 403)
        }
    }

    // ─── 4b. GÉO-BLOCAGE ─────────────────────────────────────
    if (!emergencyBypass) {
        const geo = checkGeoBlock(request.headers)
        if (geo.blocked) {
            if (SUPA_URL && SUPA_KEY) logWafEvent({
                ip, method, path: pathname, userAgent,
                threatType: 'geo_block', detail: `Pays bloqué: ${geo.country}`,
                supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
            })
            return wafBlock('Accès non autorisé depuis votre région.', 403)
        }
    }

    // ─── 4. RATE LIMITING ────────────────────────────────────
    if (!emergencyBypass) {
        const rlCategory = getRateLimitCategory(pathname)
        if (checkRateLimit(ip, rlCategory)) {
            if (SUPA_URL && SUPA_KEY) {
                logWafEvent({
                    ip, method, path: pathname, userAgent,
                    threatType: 'rate_limit', detail: `Catégorie: ${rlCategory}`,
                    supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                })
                trackViolation(ip, SUPA_URL, SUPA_KEY, { threatType: 'rate_limit' })
            }
            return wafBlock('Trop de requêtes. Réessayez dans quelques instants.', 429)
        }
    }

    // ─── 5. WAF CRS ANALYSIS ─────────────────────────────────
    //
    // RÈGLE D'OR : Les panels internes /admin/*, /agent/*, /client/*
    // sont EXEMPTÉS du scan WAF CRS car :
    //   1. Leurs URLs sont générées par l'application (routing Next.js)
    //   2. Ils sont protégés par l'auth Supabase (étape 6)
    //   3. Le WAF CRS sur ces URLs = 100% faux positifs
    //      (UUIDs, mots "create/update/delete" dans les routes REST)
    //
    // Le WAF CRS RESTE actif sur :
    //   - User-Agent (détection scanners)
    //   - Query strings avec contenu suspect
    //
    if (!emergencyBypass) {
        if (isInternalPanelPath) {
            // Pour les panels internes : scanner le User-Agent uniquement
            // (détection bots/scanners qui ciblent les panels admin)
            const verdict = analyzeRequestFast(method, '', '', userAgent)
            if (verdict.blocked) {
                if (SUPA_URL && SUPA_KEY) {
                    logWafEvent({
                        ip, method, path: pathname, userAgent,
                        threatType: verdict.topThreat as ThreatType || 'scanner_detection',
                        detail: verdict.matches.slice(0, 3).map(m =>
                            `[R${m.ruleId}:${m.target}] ${m.description} — "${m.snippet}"`
                        ).join(' | '),
                        score: verdict.score,
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                    // Pas de trackViolation pour les panels — évite auto-blocage des admins
                }
                return wafBlock('Accès refusé — outil de scanning détecté.', 403)
            }
        } else {
            // Pour les autres chemins (public, autres APIs) : scan complet
            const searchParams = request.nextUrl.searchParams.toString()
            const verdict = analyzeRequestFast(method, pathname, searchParams, userAgent)
            if (verdict.blocked) {
                const topMatch  = verdict.matches[0]
                const detailStr = verdict.matches.slice(0, 3).map(m =>
                    `[R${m.ruleId}:${m.target}] ${m.description} — "${m.snippet}"`
                ).join(' | ')

                if (SUPA_URL && SUPA_KEY) {
                    logWafEvent({
                        ip, method, path: pathname, userAgent,
                        threatType: verdict.topThreat as ThreatType || 'sql_injection',
                        detail: detailStr,
                        score: verdict.score,
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                    trackViolation(ip, SUPA_URL, SUPA_KEY, {
                        threatType:  verdict.topThreat || 'waf_block',
                        payloadHash: topMatch?.snippet
                            ? Buffer.from(topMatch.snippet.slice(0, 64)).toString('base64').slice(0, 32)
                            : undefined,
                        snippet:     topMatch?.snippet?.slice(0, 120),
                    })
                }
                return wafBlock('Requête bloquée par le pare-feu applicatif.', 403)
            }

            // Récompenser les IPs légitimes (trust score +1 en arrière-plan)
            if (SUPA_URL && SUPA_KEY && ip !== 'unknown') {
                updateIpMemory({ ip, isAttack: false, supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY })
            }
        }
    }

    // ─── 6. AUTH SUPABASE ─────────────────────────────────────
    const isAgentRoute  = pathname.startsWith('/agent')
    const isAdminRoute  = pathname.startsWith('/admin')
    const isClientRoute = pathname.startsWith('/client')
    const isCeoRoute    = pathname.startsWith('/ceo')
    if (!isAgentRoute && !isAdminRoute && !isClientRoute && !isCeoRoute) return response

    let supabaseResponse = response

    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll: () => request.cookies.getAll(),
                    setAll: (cookiesToSet) => {
                        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                        supabaseResponse = NextResponse.next({ request })
                        Object.entries(secHeaders).forEach(([k, v]) => supabaseResponse.headers.set(k, v))
                        cookiesToSet.forEach(({ name, value, options }) =>
                            supabaseResponse.cookies.set(name, value, options))
                    },
                },
            }
        )

        const { data: { user }, error: userError } = await supabase.auth.getUser()

        const redirectTo = (url: URL) => {
            const redirectRes = NextResponse.redirect(url)
            if (url.pathname.includes('/login')) {
                request.cookies.getAll()
                    .filter(c => c.name.startsWith('sb-'))
                    .forEach(cookie => redirectRes.cookies.delete(cookie.name))
            }
            supabaseResponse.cookies.getAll().forEach(cookie => {
                redirectRes.cookies.set(cookie.name, cookie.value, cookie)
            })
            return redirectRes
        }

        if (userError || !user) {
            const loginUrl = isAdminRoute ? '/admin/login'
                : isClientRoute ? '/client/login'
                : isCeoRoute ? '/ceo/login'
                : '/agent/login'
            return redirectTo(new URL(loginUrl, request.url))
        }

        // Fix Vercel httpOnly cookie
        request.cookies.getAll()
            .filter(c => c.name.startsWith('sb-'))
            .forEach(cookie => {
                supabaseResponse.cookies.set(cookie.name, cookie.value, {
                    path: '/', httpOnly: false, secure: true,
                    sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 7,
                })
            })

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceKey) return supabaseResponse

        const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

        const [clientRes, agentRes] = await Promise.all([
            adminSupabase.from('client_profiles').select('id').eq('id', user.id).maybeSingle(),
            adminSupabase.from('user_profiles').select('role').eq('id', user.id).maybeSingle(),
        ])
        const clientProfile = clientRes.data
        const agentProfile  = agentRes.data

        // Espace Client
        if (isClientRoute) {
            if (agentProfile) return redirectTo(new URL('/client/login?error=unauthorized', request.url))
            if (!clientProfile) return redirectTo(new URL('/client/login?error=no-profile', request.url))
            return supabaseResponse
        }

        if (!agentProfile) {
            const loginUrl = isAdminRoute ? '/admin/login?error=unauthorized'
                : isCeoRoute ? '/ceo/login?error=unauthorized'
                : '/agent/login?error=unauthorized'
            return redirectTo(new URL(loginUrl, request.url))
        }

        // Isolation stricte des rôles
        const role = agentProfile.role
        const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin', 'ceo']

        if (isAdminRoute && !ADMIN_ROLES.includes(role)) {
            return redirectTo(new URL('/admin/login?error=unauthorized', request.url))
        }
        if (isAgentRoute && role !== 'agent') {
            return redirectTo(new URL('/agent/login?error=unauthorized', request.url))
        }
        // CEO panel : uniquement le rôle 'ceo'
        if (isCeoRoute && role !== 'ceo') {
            return redirectTo(new URL('/ceo/login?error=unauthorized', request.url))
        }

        // ─── 2FA Check admins ────────────────────────────────
        if (isAdminRoute && ADMIN_ROLES.includes(role)) {
            const totpVerified = request.cookies.get('totp_verified')?.value
            const is2FAPage    = pathname.startsWith('/admin/2fa')

            if (!is2FAPage && totpVerified !== 'true') {
                const { data: totpRow } = await adminSupabase
                    .from('totp_secrets')
                    .select('enabled')
                    .eq('user_id', user.id)
                    .maybeSingle()

                if (totpRow?.enabled) {
                    const redirect2FA = new URL('/admin/2fa', request.url)
                    // next validé côté client dans /admin/2fa/page.tsx
                    const safeNext = /^\/admin\/[a-zA-Z0-9/_-]*$/.test(pathname) ? pathname : '/admin/dashboard'
                    redirect2FA.searchParams.set('next', safeNext)
                    return redirectTo(redirect2FA)
                }
            }
        }

        return supabaseResponse
    } catch (err: unknown) {
        console.error('Middleware catch:', err instanceof Error ? err.message : err)
        return response
    }
}

export const config = {
    matcher: [
        '/agent/:path*',
        '/admin/:path*',
        '/client/:path*',
        '/ceo/:path*',
    ],
}
