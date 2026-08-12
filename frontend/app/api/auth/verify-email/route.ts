import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * GET /api/auth/verify-email?token_hash=XXX&type=signup
 *
 * Point d'entrée pour la confirmation d'email.
 * Le lien envoyé dans l'email pointe ici (et non vers Supabase directement),
 * ce qui évite tout problème de redirection vers localhost.
 *
 * Flux :
 *  1. Extraire token_hash de l'URL
 *  2. Appeler supabase.auth.verifyOtp() côté serveur (SSR client)
 *  3. Les cookies de session sont posés sur la réponse de redirection
 *  4. Redirection vers /client/auth-confirm (compte actif, session ouverte)
 */
export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)
    const token_hash = searchParams.get('token_hash')
    const type = (searchParams.get('type') || 'signup') as 'email' | 'signup'

    if (!token_hash) {
        return NextResponse.redirect(`${origin}/client/login?error=lien-invalide`)
    }

    // Préparer la réponse de redirection en avance : les cookies de session seront
    // attachés dessus par le callback setAll du SSR client.
    const redirectSuccess = `${origin}/client/auth-confirm`
    const redirectError = `${origin}/client/login?error=confirmation-echouee`

    const response = NextResponse.redirect(redirectSuccess)

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => request.cookies.getAll(),
                setAll: (cookiesToSet) => {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        response.cookies.set(name, value, options as any)
                    })
                },
            },
        }
    )

    const { error } = await supabase.auth.verifyOtp({ token_hash, type })

    if (error) {
        console.error('[verify-email] Erreur OTP:', error.message)
        return NextResponse.redirect(redirectError)
    }

    return response
}
