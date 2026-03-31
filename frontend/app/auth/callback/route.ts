import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ══════════════════════════════════════════════════════════════════
// GET /auth/callback?code=XXX&next=/client/auth-confirm
//
// Route Handler qui échange le code PKCE contre une session Supabase.
// Déclenché après que Supabase vérifie un lien de confirmation d'email.
// ══════════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const next = requestUrl.searchParams.get('next') || '/client/auth-confirm'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

    if (code) {
        try {
            const cookieStore = await cookies()

            const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        getAll: () => cookieStore.getAll(),
                        setAll: (cookiesToSet) => {
                            cookiesToSet.forEach(({ name, value, options }) => {
                                cookieStore.set(name, value, options)
                            })
                        },
                    },
                }
            )

            const { error } = await supabase.auth.exchangeCodeForSession(code)

            if (error) {
                console.error('[auth/callback] exchangeCodeForSession error:', error.message)
                return NextResponse.redirect(new URL('/client/login?error=confirmation_failed', siteUrl))
            }

            // Succès : rediriger vers la page de confirmation
            return NextResponse.redirect(new URL(next, siteUrl))
        } catch (err) {
            console.error('[auth/callback] unexpected error:', err)
            return NextResponse.redirect(new URL('/client/login?error=confirmation_failed', siteUrl))
        }
    }

    // Pas de code → rediriger vers auth-confirm quand même
    // (flow implicite : Supabase a déjà défini les tokens en hash côté client)
    return NextResponse.redirect(new URL(next, siteUrl))
}
