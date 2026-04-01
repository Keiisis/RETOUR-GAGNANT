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
    type ThreatType,
} from '@/lib/waf'

// ═══════════════════════════════════════════════════════════════
// 🛡️ MIDDLEWARE — WAF OWASP CRS + Auth Protection
// WAF : scoring anomalies, 500+ règles, décodage multi-couches,
//       géo-blocage, body inspection, custom rules DB
// ═══════════════════════════════════════════════════════════════

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL  || ''
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ── Charger la config WAF + règles custom depuis Supabase ──────
// Rafraîchi toutes les 60 secondes (TTL cache dans engine.ts)
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
    } catch { /* silencieux — ne pas bloquer la requête */ }
}

// ── Vérifier blocage IP ────────────────────────────────────────
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

    // ─── Security Headers ───
    const secHeaders: Record<string, string> = {
        'X-Content-Type-Options':    'nosniff',
        'X-Frame-Options':           'DENY',
        'X-XSS-Protection':          '1; mode=block',
        'Referrer-Policy':           'strict-origin-when-cross-origin',
        'Permissions-Policy':        'camera=(), microphone=(self), geolocation=()',
    }
    Object.entries(secHeaders).forEach(([k, v]) => response.headers.set(k, v))

    const pathname  = request.nextUrl.pathname
    const ip        = extractIp(request.headers)
    const userAgent = request.headers.get('user-agent') || ''
    const method    = request.method

    // Rafraîchir config WAF (async, non bloquant si stale)
    refreshWafConfig().catch(() => {})

    // ─── 1. Vérification IP bloquée ──────────────────────────
    if (ip !== 'unknown' && await isIpBlocked(ip)) {
        if (SUPA_URL && SUPA_KEY) logWafEvent({
            ip, method, path: pathname, userAgent,
            threatType: 'blocked_ip', detail: 'IP dans la liste de blocage',
            supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
        })
        return wafBlock('Accès refusé.', 403)
    }

    // ─── 2. Géo-blocage ──────────────────────────────────────
    const geo = checkGeoBlock(request.headers)
    if (geo.blocked) {
        if (SUPA_URL && SUPA_KEY) logWafEvent({
            ip, method, path: pathname, userAgent,
            threatType: 'geo_block', detail: `Pays bloqué: ${geo.country}`,
            supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
        })
        return wafBlock('Accès non autorisé depuis votre région.', 403)
    }

    // ─── 3. Rate Limiting ─────────────────────────────────────
    const rlCategory = getRateLimitCategory(pathname)
    if (checkRateLimit(ip, rlCategory)) {
        if (SUPA_URL && SUPA_KEY) {
            logWafEvent({
                ip, method, path: pathname, userAgent,
                threatType: 'rate_limit', detail: `Catégorie: ${rlCategory}`,
                supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
            })
            trackViolation(ip, SUPA_URL, SUPA_KEY)
        }
        return wafBlock('Trop de requêtes. Réessayez dans quelques instants.', 429)
    }

    // ─── 4. Analyse WAF OWASP CRS (URL + query + UA) ─────────
    const searchParams = request.nextUrl.searchParams.toString()
    const verdict = analyzeRequestFast(method, pathname, searchParams, userAgent)

    if (verdict.blocked) {
        if (SUPA_URL && SUPA_KEY) {
            logWafEvent({
                ip, method, path: pathname, userAgent,
                threatType: verdict.topThreat as ThreatType || 'sql_injection',
                detail: verdict.matches.slice(0, 3).map(m => `[${m.ruleId}] ${m.description}`).join(' | '),
                score: verdict.score,
                supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
            })
            trackViolation(ip, SUPA_URL, SUPA_KEY)
        }
        return wafBlock('Requête bloquée par le pare-feu applicatif.', 403)
    }

    // ─── Skip login + public pages ────────────────────────────
    if (
        pathname === '/agent/login'  || pathname === '/admin/login'  ||
        pathname === '/admin/reset-password' || pathname === '/admin/2fa' ||
        pathname === '/client/login' || pathname === '/client/register' ||
        pathname === '/client/reset-password'
    ) {
        return response
    }

    // ─── Only protect /agent/*, /admin/*, /client/* ───────────
    const isAgentRoute  = pathname.startsWith('/agent')
    const isAdminRoute  = pathname.startsWith('/admin')
    const isClientRoute = pathname.startsWith('/client')
    if (!isAgentRoute && !isAdminRoute && !isClientRoute) return response

    // ─── Auth Check ───────────────────────────────────────────
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
                        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
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
            const loginUrl = isAdminRoute ? '/admin/login' : isClientRoute ? '/client/login' : '/agent/login'
            return redirectTo(new URL(loginUrl, request.url))
        }

        // Fix Vercel httpOnly cookie
        request.cookies.getAll()
            .filter(c => c.name.startsWith('sb-'))
            .forEach(cookie => {
                supabaseResponse.cookies.set(cookie.name, cookie.value, {
                    path: '/', httpOnly: false, secure: true,
                    sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 365,
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
            return redirectTo(new URL(isAdminRoute ? '/admin/login?error=unauthorized' : '/agent/login?error=unauthorized', request.url))
        }

        // Strict Role Isolation
        const role = agentProfile.role
        const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin']

        if (isAdminRoute && !ADMIN_ROLES.includes(role)) {
            return redirectTo(new URL('/admin/login?error=unauthorized', request.url))
        }
        if (isAgentRoute && role !== 'agent') {
            return redirectTo(new URL('/agent/login?error=unauthorized', request.url))
        }

        // ─── 2FA Check admins ─────────────────────────────────
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
                    redirect2FA.searchParams.set('next', pathname)
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
    ],
}
