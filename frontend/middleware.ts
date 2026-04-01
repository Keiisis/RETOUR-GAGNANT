import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
    extractIp,
    checkRateLimit,
    getRateLimitCategory,
    analyzeRequest,
    getCachedIpBlock,
    setCachedIpBlock,
    logWafEvent,
    trackViolation,
} from '@/lib/waf'

// ═══════════════════════════════════════════════════════
// 🛡️ MIDDLEWARE — Route Protection + WAF (Server-Side)
// Protège les routes /agent/* et /admin/* côté serveur
// WAF : détection SQLi, XSS, path traversal, blocage IP
// ═══════════════════════════════════════════════════════

const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  || ''
const SUPA_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ── Vérifier si une IP est bloquée (cache + Supabase) ─────────
async function isIpBlocked(ip: string): Promise<boolean> {
    // 1. Cache mémoire (TTL 5 min)
    const cached = getCachedIpBlock(ip)
    if (cached !== null) return cached

    // 2. Supabase (service role)
    if (!SUPA_URL || !SUPA_KEY) return false
    try {
        const res = await fetch(
            `${SUPA_URL}/rest/v1/ip_blocks?ip=eq.${encodeURIComponent(ip)}&unblocked_at=is.null&select=ip&limit=1`,
            {
                headers: {
                    apikey: SUPA_KEY,
                    Authorization: `Bearer ${SUPA_KEY}`,
                },
            }
        )
        const rows = await res.json() as Array<unknown>
        const blocked = Array.isArray(rows) && rows.length > 0
        setCachedIpBlock(ip, blocked)
        return blocked
    } catch {
        return false // En cas d'erreur réseau → ne pas bloquer
    }
}

// ── Réponse bloquée ───────────────────────────────────────────
function blockedResponse(reason: string, status = 403): NextResponse {
    return new NextResponse(
        JSON.stringify({ error: reason }),
        {
            status,
            headers: { 'Content-Type': 'application/json' },
        }
    )
}

export async function middleware(request: NextRequest) {
    const response = NextResponse.next({
        request: { headers: request.headers },
    })

    // ─── Security Headers ───
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()')

    const pathname  = request.nextUrl.pathname
    const ip        = extractIp(request.headers)
    const userAgent = request.headers.get('user-agent') || ''

    // ─── 1. Vérification IP bloquée ───
    if (ip !== 'unknown' && await isIpBlocked(ip)) {
        if (SUPA_URL && SUPA_KEY) {
            logWafEvent({
                ip, method: request.method, path: pathname,
                userAgent, threatType: 'blocked_ip',
                detail: 'IP dans la liste de blocage',
                supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
            })
        }
        return blockedResponse('Accès refusé.', 403)
    }

    // ─── 2. Rate Limiting ───
    const rlCategory = getRateLimitCategory(pathname)
    if (checkRateLimit(ip, rlCategory)) {
        if (SUPA_URL && SUPA_KEY) {
            logWafEvent({
                ip, method: request.method, path: pathname,
                userAgent, threatType: 'rate_limit',
                detail: `Catégorie: ${rlCategory}`,
                supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
            })
            trackViolation(ip, SUPA_URL, SUPA_KEY)
        }
        return blockedResponse('Trop de requêtes. Réessayez dans quelques instants.', 429)
    }

    // ─── 3. Analyse WAF (SQLi, XSS, Path Traversal, UA suspect) ───
    const searchParams = request.nextUrl.searchParams.toString()
    const threat = analyzeRequest(request.method, pathname, searchParams, userAgent)

    if (threat.blocked && threat.threatType) {
        if (SUPA_URL && SUPA_KEY) {
            logWafEvent({
                ip, method: request.method, path: pathname,
                userAgent, threatType: threat.threatType,
                detail: threat.detail,
                supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
            })
            trackViolation(ip, SUPA_URL, SUPA_KEY)
        }
        return blockedResponse('Requête bloquée par le pare-feu applicatif.', 403)
    }

    // ─── Skip login and public auth pages (no auth needed) ───
    if (
        pathname === '/agent/login' ||
        pathname === '/admin/login' ||
        pathname === '/admin/reset-password' ||
        pathname === '/client/login' ||
        pathname === '/client/register' ||
        pathname === '/client/reset-password'
    ) {
        return response
    }

    // ─── Only protect /agent/*, /admin/*, /client/* routes ───
    const isAgentRoute  = pathname.startsWith('/agent')
    const isAdminRoute  = pathname.startsWith('/admin')
    const isClientRoute = pathname.startsWith('/client')

    if (!isAgentRoute && !isAdminRoute && !isClientRoute) {
        return response
    }

    // ─── Auth Check ───
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
                        // Restaurer les security headers
                        supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
                        supabaseResponse.headers.set('X-Frame-Options', 'DENY')
                        supabaseResponse.headers.set('X-XSS-Protection', '1; mode=block')
                        supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
                        supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()')
                        cookiesToSet.forEach(({ name, value, options }) => {
                            supabaseResponse.cookies.set(name, value, options)
                        })
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
                    .forEach(cookie => { redirectRes.cookies.delete(cookie.name) })
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

        // Fix Vercel httpOnly cookie compatibility
        request.cookies.getAll()
            .filter(c => c.name.startsWith('sb-'))
            .forEach(cookie => {
                supabaseResponse.cookies.set(cookie.name, cookie.value, {
                    path: '/',
                    httpOnly: false,
                    secure: true,
                    sameSite: 'lax' as const,
                    maxAge: 60 * 60 * 24 * 365,
                })
            })

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceKey) {
            console.warn('Middleware: SUPABASE_SERVICE_ROLE_KEY manquante, vérification de rôle ignorée')
            return supabaseResponse
        }

        const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

        const [clientRes, agentRes] = await Promise.all([
            adminSupabase.from('client_profiles').select('id').eq('id', user.id).maybeSingle(),
            adminSupabase.from('user_profiles').select('role').eq('id', user.id).maybeSingle(),
        ])
        const clientProfile = clientRes.data
        const agentProfile  = agentRes.data

        // ─── Espace Client ────────────────────────────────────────
        if (isClientRoute) {
            if (agentProfile) return redirectTo(new URL('/client/login?error=unauthorized', request.url))
            if (!clientProfile) return redirectTo(new URL('/client/login?error=no-profile', request.url))
            return supabaseResponse
        }

        if (!agentProfile) {
            const loginUrl = isAdminRoute ? '/admin/login?error=unauthorized' : '/agent/login?error=unauthorized'
            return redirectTo(new URL(loginUrl, request.url))
        }

        // ─── Strict Role Isolation ────────────────────────────────
        const role = agentProfile.role
        const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin']

        if (isAdminRoute && !ADMIN_ROLES.includes(role)) {
            return redirectTo(new URL('/admin/login?error=unauthorized', request.url))
        }
        if (isAgentRoute && role !== 'agent') {
            return redirectTo(new URL('/agent/login?error=unauthorized', request.url))
        }

        // ─── 2FA Check pour les admins ────────────────────────────
        // Si le cookie totp_verified est absent → rediriger vers la vérification 2FA
        if (isAdminRoute && ADMIN_ROLES.includes(role)) {
            const totpVerified = request.cookies.get('totp_verified')?.value

            // Pages exclues du check 2FA
            const is2FAPage = pathname === '/admin/2fa' || pathname.startsWith('/admin/2fa/')

            if (!is2FAPage && totpVerified !== 'true') {
                // Vérifier si cet admin a la 2FA activée
                const { data: totpRow } = await adminSupabase
                    .from('totp_secrets')
                    .select('enabled')
                    .eq('user_id', user.id)
                    .maybeSingle()

                if (totpRow?.enabled) {
                    // Rediriger vers la page de vérification 2FA
                    const redirect2FA = new URL('/admin/2fa', request.url)
                    redirect2FA.searchParams.set('next', pathname)
                    return redirectTo(redirect2FA)
                }
            }
        }

        return supabaseResponse
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('Middleware catch:', message)
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
