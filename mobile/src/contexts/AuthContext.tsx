import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { lire, ecrire, supprimer } from '../lib/stockage'
import { oublierClient } from '../lib/db/base'
import { oublierMemoireDuClient } from '../lib/memoire'
import { supabase } from '../config/supabase'
import { registerPushToken, clearPushToken } from '../utils/pushToken'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
const TWOFA_UNTIL_KEY = '@rg_2fa_verified_until'
const TWOFA_WINDOW_MS = 8 * 60 * 60 * 1000 // 8 h, comme le web

/* ═══════════════════════════════════════════════════════════
   Auth Context : Session management + Profile management
═══════════════════════════════════════════════════════════ */

export interface UserProfile {
    id: string
    prenom: string
    nom: string
    email: string
    role: 'client' | 'agent' | 'admin' | 'ceo'
    avatar_url?: string
    avatar_type?: string
    avatar_preset?: string
    phone?: string
    ville?: string
    pays?: string
    push_token?: string
}

interface AuthState {
    session: Session | null
    user: User | null
    loading: boolean
    profile: UserProfile | null
    twoFactorRequired: boolean
}

interface AuthContextType extends AuthState {
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
    signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<{ error: Error | null }>
    signOut: () => Promise<void>
    resetPassword: (email: string) => Promise<{ error: Error | null }>
    updateProfile: (data: Partial<UserProfile>) => Promise<{ error: Error | null }>
    refreshProfile: () => Promise<void>
    verifyTwoFactor: (code: string) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AuthState>({
        session: null,
        user: null,
        loading: true,
        profile: null,
        twoFactorRequired: false,
    })

    // Vérifie si le client a la 2FA active et n'a pas validé récemment.
    const checkTwoFactor = async (session: Session | null) => {
        const token = session?.access_token
        if (!token) { setState(prev => ({ ...prev, twoFactorRequired: false })); return }
        try {
            const res = await fetch(`${API_BASE}/api/client/2fa/status`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const json = await res.json().catch(() => ({}))
            if (!json?.enabled) { setState(prev => ({ ...prev, twoFactorRequired: false })); return }
            const until = lire(TWOFA_UNTIL_KEY)
            const stillValid = until && Date.now() < Number(until)
            setState(prev => ({ ...prev, twoFactorRequired: !stillValid }))
        } catch {
            // Fail-open : en cas d'erreur réseau on ne verrouille pas (évite le blocage total)
            setState(prev => ({ ...prev, twoFactorRequired: false }))
        }
    }

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setState(prev => ({
                ...prev,
                session,
                user: session?.user ?? null,
                loading: false,
            }))
            if (session?.user) {
                fetchProfile(session.user)
                registerPushToken(session.user.id).catch(() => {})
                checkTwoFactor(session)
            }
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setState(prev => ({
                ...prev,
                session,
                user: session?.user ?? null,
                loading: false,
            }))
            /* Rafraîchissement horaire du jeton : même personne, même profil.
               Relire le profil, réenregistrer le jeton push et revérifier la
               2FA à chaque fois ne servait à rien (et pouvait redemander la
               permission de notifier). */
            if (event === 'TOKEN_REFRESHED') return
            if (session?.user) {
                fetchProfile(session.user)
                registerPushToken(session.user.id).catch(() => {})
                checkTwoFactor(session)
            } else {
                setState(prev => ({ ...prev, profile: null, twoFactorRequired: false }))
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    /* Profil minimal tiré de la SESSION : sans ligne client_profiles (compte
       créé hors app, ligne effacée) ou hors réseau, `profile` restait `null`
       pour toujours — et chaque écran qui commence par `if (!profile) return`
       tournait sans fin ou restait vide. L'identité (id, email) est celle du
       jeton, donc exactement celle que les règles RLS reconnaissent. */
    const profilDepuisSession = (user: User): UserProfile => {
        const meta = (user.user_metadata || {}) as Record<string, unknown>
        return {
            id: user.id,
            email: String(user.email || '').toLowerCase(),
            prenom: typeof meta.prenom === 'string' ? meta.prenom : '',
            nom: typeof meta.nom === 'string' ? meta.nom : '',
            phone: typeof meta.phone === 'string' ? meta.phone : undefined,
            role: 'client',
        }
    }

    const fetchProfile = async (user: User) => {
        try {
            const { data, error } = await supabase
                .from('client_profiles')
                .select('id, prenom, nom, email, phone, ville, pays, avatar_url, avatar_type, avatar_preset, push_token')
                .eq('id', user.id)
                .maybeSingle()

            if (!error && data) {
                setState(prev => ({
                    ...prev,
                    profile: {
                        ...data,
                        // Email de la session si la ligne n'en porte pas : c'est lui
                        // que les règles RLS comparent (rgb_email_session()).
                        email: data.email || String(user.email || '').toLowerCase(),
                        role: 'client',
                        avatar_url: data.avatar_url ?? undefined,
                        // Lu en base : l'interrupteur « notifications » reflète
                        // enfin l'état réel au lieu d'être toujours éteint.
                        push_token: data.push_token ?? undefined,
                    } as UserProfile,
                }))
                return
            }
            // Pas de ligne (ou erreur) : on garde l'existant, sinon la session.
            setState(prev => ({ ...prev, profile: prev.profile ?? profilDepuisSession(user) }))
        } catch {
            setState(prev => ({ ...prev, profile: prev.profile ?? profilDepuisSession(user) }))
        }
    }

    const signIn = async (email: string, password: string) => {
        try {
            // Plus de journal de `data` : il contenait la session complète
            // (jeton d'accès ET jeton de rafraîchissement) en clair dans les logs.
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            return { error: error as Error | null }
        } catch (e: any) {
            return { error: e instanceof Error ? e : new Error('Erreur de connexion') }
        }
    }

    const signUp = async (email: string, password: string, metadata?: Record<string, unknown>) => {
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: metadata },
            })
            return { error: error as Error | null }
        } catch (e: any) {
            return { error: e instanceof Error ? e : new Error('Erreur de connexion') }
        }
    }

    const signOut = async () => {
        try {
            if (state.user?.id) {
                await clearPushToken(state.user.id).catch(() => {})
            }
            supprimer(TWOFA_UNTIL_KEY)
            /* Les données personnelles quittent le téléphone avec le compte :
               sur un appareil partagé, le suivant ne doit pas retrouver les
               dossiers et factures du précédent dans la base locale. */
            await oublierClient(state.user?.id)
            /* Les reponses mises en memoire (accueil, paiements, commandes,
               rendez-vous, propositions) portent l'identifiant du compte :
               elles partent avec lui. Le catalogue public reste. */
            if (state.user?.id) oublierMemoireDuClient(state.user.id)
            await supabase.auth.signOut()
        } catch (e) {
            console.error('Sign out error:', e)
        }
        setState({ session: null, user: null, loading: false, profile: null, twoFactorRequired: false })
    }

    // Valide le code 2FA à la connexion (mobile). Mémorise la validation 8 h.
    const verifyTwoFactor = async (code: string) => {
        const token = state.session?.access_token
        if (!token) return { error: new Error('Session expirée') }
        try {
            const res = await fetch(`${API_BASE}/api/client/2fa/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ code, action: 'login' }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) return { error: new Error(json?.error || 'Code incorrect') }
            ecrire(TWOFA_UNTIL_KEY, String(Date.now() + TWOFA_WINDOW_MS))
            setState(prev => ({ ...prev, twoFactorRequired: false }))
            return { error: null }
        } catch (e: any) {
            return { error: e instanceof Error ? e : new Error('Erreur réseau') }
        }
    }

    const resetPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        return { error: error as Error | null }
    }

    const updateProfile = async (data: Partial<UserProfile>) => {
        if (!state.user?.id) return { error: new Error('Non authentifié') }

        const { role: _role, ...brut } = data
        /* `undefined` disparaît du JSON envoyé à PostgREST : vider un champ
           (téléphone effacé, push_token retiré) ne changeait RIEN en base alors
           que l'écran annonçait « mis à jour ». Une clé présente mais vide
           devient donc `null`, seule valeur qui efface réellement. */
        const updateData: Record<string, unknown> = Object.fromEntries(
            Object.entries(brut).map(([k, v]) => [k, v === undefined ? null : v]),
        )

        /* `.select('id')` : sous RLS, une mise à jour qui ne touche AUCUNE ligne
           ne renvoie pas d'erreur. Sans ce retour, un profil absent donnait un
           faux « Profil mis à jour ». On crée alors la ligne (règle
           client_profiles_proprietaire : id = auth.uid()). */
        const { data: lignes, error } = await supabase
            .from('client_profiles')
            .update(updateData)
            .eq('id', state.user.id)
            .select('id')

        let erreur: Error | null = error as Error | null
        if (!erreur && (!lignes || lignes.length === 0)) {
            const { error: errInsert } = await supabase
                .from('client_profiles')
                .insert({ id: state.user.id, email: String(state.user.email || '').toLowerCase(), ...updateData })
            erreur = errInsert as Error | null
        }

        if (!erreur) {
            setState(prev => ({
                ...prev,
                profile: prev.profile ? { ...prev.profile, ...data } : prev.profile,
            }))
        }

        return { error: erreur }
    }

    const refreshProfile = async () => {
        if (state.user) {
            await fetchProfile(state.user)
        }
    }

    return (
        <AuthContext.Provider value={{
            ...state,
            signIn, signUp, signOut, resetPassword,
            updateProfile, refreshProfile, verifyTwoFactor,
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used within an AuthProvider')
    return context
}
