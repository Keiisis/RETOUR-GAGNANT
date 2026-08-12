import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════
// 🛡️ Server-Side API Auth : Vérifie l'authentification
// et le rôle de l'utilisateur pour les routes API
// ═══════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

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
    request: NextRequest,
    requiredRole?: 'admin' | 'agent'
): Promise<AuthResult> => {
    try {
        // Extraire le token de l'en-tête Authorization ou des cookies
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        let user;
        let isAuthOk = false;

        if (!token) {
            // Utiliser next/cookies via createServerClient
            const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
                cookies: {
                    getAll: () => {
                        return (request as NextRequest).cookies?.getAll() || [];
                    },
                    setAll: () => { }
                }
            })

            const { data, error } = await supabase.auth.getUser()

            if (!error && data?.user) {
                user = data.user;
                isAuthOk = true;
            }
        } else {
            // Avec Bearer token
            const supabase = createClient(supabaseUrl, supabaseAnonKey, {
                global: {
                    headers: { Authorization: `Bearer ${token}` },
                },
            })

            const { data, error } = await supabase.auth.getUser()

            if (!error && data?.user) {
                user = data.user;
                isAuthOk = true;
            }
        }

        if (!isAuthOk || !user) {
            return {
                authenticated: false,
                error: NextResponse.json(
                    { error: 'Non authentifié' },
                    { status: 401 }
                ),
            }
        }

        // Vérifier le rôle si requis, en utilisant LA CLÉ SERVICE ROLE pour bypasser les RLS
        if (requiredRole) {
            const adminSupabase = createClient(supabaseUrl, supabaseServiceKey)

            // Chercher d'abord dans user_profiles, fallback sur user_metadata
            const { data: profile } = await adminSupabase
                .from('user_profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            const role = profile?.role || user.user_metadata?.role || null

            const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin']
            const isAdmin = role && ADMIN_ROLES.includes(role)
            const isAgent = role === 'agent'

            const authorized =
                requiredRole === 'admin' ? isAdmin :
                requiredRole === 'agent' ? (isAgent || isAdmin) :
                false

            if (!authorized) {
                return {
                    authenticated: false,
                    error: NextResponse.json(
                        { error: 'Accès non autorisé' },
                        { status: 403 }
                    ),
                }
            }

            return { authenticated: true, userId: user.id, role: role || 'agent' }
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
