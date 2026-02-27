import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════
// 🛡️ Server-Side API Auth — Vérifie l'authentification
// et le rôle de l'utilisateur pour les routes API
// ═══════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface AuthResult {
    authenticated: boolean
    userId?: string
    role?: string
    error?: NextResponse
}

/**
 * Vérifie l'authentification de l'utilisateur via le cookie de session.
 * Retourne le userId et le rôle si authentifié.
 */
export const verifyApiAuth = async (
    request: NextRequest | Request,
    requiredRole?: 'admin' | 'agent'
): Promise<AuthResult> => {
    try {
        // Extraire le token de l'en-tête Authorization ou des cookies
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) {
            // Essayer via les cookies (pour les appels depuis le navigateur)
            const cookieHeader = request.headers.get('cookie') || ''
            const supabase = createClient(supabaseUrl, supabaseAnonKey, {
                global: {
                    headers: { cookie: cookieHeader },
                },
            })

            const { data: { user }, error } = await supabase.auth.getUser()

            if (error || !user) {
                return {
                    authenticated: false,
                    error: NextResponse.json(
                        { error: 'Non authentifié' },
                        { status: 401 }
                    ),
                }
            }

            // Vérifier le rôle si requis
            if (requiredRole) {
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single()

                if (!profile || (requiredRole === 'admin' && profile.role !== 'admin') ||
                    (requiredRole === 'agent' && profile.role !== 'agent' && profile.role !== 'admin')) {
                    return {
                        authenticated: false,
                        error: NextResponse.json(
                            { error: 'Accès non autorisé' },
                            { status: 403 }
                        ),
                    }
                }

                return { authenticated: true, userId: user.id, role: profile.role }
            }

            return { authenticated: true, userId: user.id }
        }

        // Avec Bearer token
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: { Authorization: `Bearer ${token}` },
            },
        })

        const { data: { user }, error } = await supabase.auth.getUser()

        if (error || !user) {
            return {
                authenticated: false,
                error: NextResponse.json(
                    { error: 'Token invalide' },
                    { status: 401 }
                ),
            }
        }

        if (requiredRole) {
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            if (!profile || (requiredRole === 'admin' && profile.role !== 'admin') ||
                (requiredRole === 'agent' && profile.role !== 'agent' && profile.role !== 'admin')) {
                return {
                    authenticated: false,
                    error: NextResponse.json(
                        { error: 'Accès non autorisé' },
                        { status: 403 }
                    ),
                }
            }

            return { authenticated: true, userId: user.id, role: profile.role }
        }

        return { authenticated: true, userId: user.id }
    } catch {
        return {
            authenticated: false,
            error: NextResponse.json(
                { error: 'Erreur d\'authentification' },
                { status: 500 }
            ),
        }
    }
}
