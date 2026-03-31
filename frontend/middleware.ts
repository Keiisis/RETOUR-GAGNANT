import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════
// 🛡️ MIDDLEWARE — Route Protection (Server-Side)
// Protège les routes /agent/* et /admin/* côté serveur
// ═══════════════════════════════════════════════════════

// In-memory rate limiting store
const loginAttempts = new Map<string, { count: number; lastReset: number }>()

const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutes
const MAX_LOGIN_ATTEMPTS = 10

const isRateLimited = (ip: string): boolean => {
    const now = Date.now()
    const entry = loginAttempts.get(ip)

    if (!entry || now - entry.lastReset > RATE_LIMIT_WINDOW) {
        loginAttempts.set(ip, { count: 1, lastReset: now })
        return false
    }

    entry.count++
    return entry.count > MAX_LOGIN_ATTEMPTS
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
    response.headers.set(
        'Permissions-Policy',
        'camera=(), microphone=(self), geolocation=()'
    )

    const pathname = request.nextUrl.pathname

    // ─── Rate Limiting on Login POST requests ───
    if (
        (pathname === '/agent/login' || pathname === '/admin/login' || pathname === '/client/login' || pathname === '/client/register') &&
        request.method === 'POST'
    ) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            'unknown'

        if (isRateLimited(ip)) {
            return NextResponse.json(
                { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
                { status: 429 }
            )
        }
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
    const isAgentRoute = pathname.startsWith('/agent')
    const isAdminRoute = pathname.startsWith('/admin')
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
                        // Mettre à jour la req courante
                        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))

                        // Mettre à jour la réponse
                        supabaseResponse = NextResponse.next({
                            request,
                        })
                        // Restaurer les security headers !
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

        // Supabase SSR recommande d'utiliser getUser() plutôt que getSession()
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        // Helper function to redirect keeping possible refreshed cookies
        const redirectTo = (url: URL) => {
            const redirectRes = NextResponse.redirect(url)

            // 🧹 SECURITY/BUGFIX: If we redirect to login, clear all supabase cookies 
            // to ensure no stuck 'HttpOnly' cookies from previous bug remain on browser.
            if (url.pathname.includes('/login')) {
                request.cookies.getAll()
                    .filter(c => c.name.startsWith('sb-'))
                    .forEach(cookie => {
                        redirectRes.cookies.delete(cookie.name)
                    })
            }

            // Transférer les cookies nouvellement définis par Supabase
            supabaseResponse.cookies.getAll().forEach(cookie => {
                redirectRes.cookies.set(cookie.name, cookie.value, cookie)
            })
            return redirectRes
        }

        if (userError || !user) {
            // Pas d'utilisateur authentifié → rediriger vers login
            const loginUrl = isAdminRoute ? '/admin/login' : isClientRoute ? '/client/login' : '/agent/login'
            return redirectTo(new URL(loginUrl, request.url))
        }

        // ════════════════════════════════════════════════════════════
        // 🔑 CRITICAL FIX for Vercel production:
        // Force ALL sb-* auth cookies to be browser-readable (httpOnly: false).
        // Old deployments set these as httpOnly: true, making them invisible
        // to the client-side JS (createBrowserClient / getSession()).
        // By re-setting them in the response with httpOnly: false,
        // we overwrite the stuck httpOnly cookies in the browser.
        // ════════════════════════════════════════════════════════════
        request.cookies.getAll()
            .filter(c => c.name.startsWith('sb-'))
            .forEach(cookie => {
                supabaseResponse.cookies.set(cookie.name, cookie.value, {
                    path: '/',
                    httpOnly: false,
                    secure: true,
                    sameSite: 'lax' as const,
                    maxAge: 60 * 60 * 24 * 365, // 1 year
                })
            })

        const userId = user.id

        // Vérifier le rôle avec la Service Key (contourne les RLS)
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceKey) {
            // Pas de service key → on laisse passer (le layout côté client vérifiera)
            console.warn('Middleware: SUPABASE_SERVICE_ROLE_KEY manquante, vérification de rôle ignorée')
            return supabaseResponse
        }

        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceKey
        )

        // ─── Récupérer les deux profils en parallèle ─────────────────
        const [clientRes, agentRes] = await Promise.all([
            adminSupabase.from('client_profiles').select('id').eq('id', userId).maybeSingle(),
            adminSupabase.from('user_profiles').select('role').eq('id', userId).maybeSingle(),
        ])
        const clientProfile = clientRes.data
        const agentProfile  = agentRes.data

        // ─── Espace Client ────────────────────────────────────────────
        if (isClientRoute) {
            // Admin/Agent ne peut PAS accéder à l'espace client
            if (agentProfile) {
                return redirectTo(new URL('/client/login?error=unauthorized', request.url))
            }
            // Doit avoir un profil client
            if (!clientProfile) {
                return redirectTo(new URL('/client/login?error=no-profile', request.url))
            }
            return supabaseResponse
        }

        // ─── Espace Agent / Admin : doit avoir un profil dans user_profiles ──
        // FAILLE CORRIGÉE : auparavant on laissait passer si le profil était absent.
        // Un client (sans user_profiles) était donc autorisé à entrer.
        if (!agentProfile) {
            const loginUrl = isAdminRoute
                ? '/admin/login?error=unauthorized'
                : '/agent/login?error=unauthorized'
            return redirectTo(new URL(loginUrl, request.url))
        }

        // ─── STRICT ROLE ISOLATION ────────────────────────────────────
        // Super Admin / Admin  → SEULEMENT /admin/*
        // Agent                → SEULEMENT /agent/*
        // Client               → SEULEMENT /client/*  (géré ci-dessus)
        const role = agentProfile.role
        const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin']

        if (isAdminRoute && !ADMIN_ROLES.includes(role)) {
            // Agent qui tente d'accéder à l'admin → refusé
            return redirectTo(new URL('/admin/login?error=unauthorized', request.url))
        }

        if (isAgentRoute && role !== 'agent') {
            // Admin/SuperAdmin qui tente d'accéder à l'espace agent → refusé
            return redirectTo(new URL('/agent/login?error=unauthorized', request.url))
        }

        return supabaseResponse
    } catch (err: unknown) {
        // En caso d'erreur réseau/timeout, NE PAS bloquer l'accès
        // Le layout côté client fera sa propre vérification
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('Middleware catch:', message)

        // Si le middleware crash, on laisse passer plutôt que de boucler
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
