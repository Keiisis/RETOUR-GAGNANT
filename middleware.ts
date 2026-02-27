import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════
// 🛡️ MIDDLEWARE — Route Protection (Server-Side)
// Protège les routes /agent/* et /admin/* côté serveur
// Rate limiting sur les tentatives de login
// ═══════════════════════════════════════════════════════

// In-memory rate limiting store
const loginAttempts = new Map<string, { count: number; lastReset: number }>()

const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5

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

    // ─── Rate Limiting on Login ───
    if (
        pathname === '/agent/login' &&
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

    // ─── Skip login pages ───
    if (pathname === '/agent/login' || pathname === '/admin/login') {
        return response
    }

    // ─── Protected routes: /agent/* and /admin/* ───
    const isAgentRoute = pathname.startsWith('/agent')
    const isAdminRoute = pathname.startsWith('/admin')

    if (!isAgentRoute && !isAdminRoute) {
        return response
    }

    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll: () => request.cookies.getAll(),
                    setAll: (cookiesToSet) => {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            response.cookies.set(name, value, {
                                ...options,
                                httpOnly: true,
                                secure: process.env.NODE_ENV === 'production',
                                sameSite: 'lax',
                            })
                        })
                    },
                },
            }
        )

        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            const loginUrl = isAdminRoute ? '/admin/login' : '/agent/login'
            return NextResponse.redirect(new URL(loginUrl, request.url))
        }

        // Vérifier le rôle
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!profile) {
            const loginUrl = isAdminRoute ? '/admin/login' : '/agent/login'
            return NextResponse.redirect(new URL(loginUrl, request.url))
        }

        // Agent routes: require 'agent' or 'admin' role
        if (isAgentRoute && profile.role !== 'agent' && profile.role !== 'admin') {
            return NextResponse.redirect(new URL('/agent/login', request.url))
        }

        // Admin routes: require 'admin' role only
        if (isAdminRoute && profile.role !== 'admin') {
            return NextResponse.redirect(new URL('/admin/login', request.url))
        }

        return response
    } catch {
        // On error, redirect to login
        const loginUrl = isAdminRoute ? '/admin/login' : '/agent/login'
        return NextResponse.redirect(new URL(loginUrl, request.url))
    }
}

export const config = {
    matcher: [
        '/agent/:path*',
        '/admin/:path*',
    ],
}
