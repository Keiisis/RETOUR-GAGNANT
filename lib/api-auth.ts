import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════
// 🛡️ Server-Side API Auth — Vérifie l'authentification
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

            const { data: profile } = await adminSupabase
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
    } catch (e) {
        return {
            authenticated: false,
            error: NextResponse.json(
                { error: 'Erreur d\'authentification: ' + (e instanceof Error ? e.message : String(e)) },
                { status: 500 }
            ),
        }
    }
}

