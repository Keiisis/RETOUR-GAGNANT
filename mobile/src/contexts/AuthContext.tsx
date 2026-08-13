import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
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
            const until = await AsyncStorage.getItem(TWOFA_UNTIL_KEY)
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
                fetchProfile(session.user.id)
                registerPushToken(session.user.id).catch(() => {})
                checkTwoFactor(session)
            }
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setState(prev => ({
                ...prev,
                session,
                user: session?.user ?? null,
                loading: false,
            }))
            if (session?.user) {
                fetchProfile(session.user.id)
                registerPushToken(session.user.id).catch(() => {})
                checkTwoFactor(session)
            } else {
                setState(prev => ({ ...prev, profile: null, twoFactorRequired: false }))
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('client_profiles')
                .select('id, prenom, nom, email, phone, ville, pays, avatar_url, avatar_type, avatar_preset')
                .eq('id', userId)
                .single()

            if (!error && data) {
                setState(prev => ({
                    ...prev,
                    profile: {
                        ...data,
                        role: 'client',
                        avatar_url: data.avatar_url ?? undefined,
                        push_token: undefined,
                    } as UserProfile,
                }))
            }
        } catch {
            // Profil introuvable : pas bloquant
        }
    }

    const signIn = async (email: string, password: string) => {
        try {
            const { error, data } = await supabase.auth.signInWithPassword({ email, password })
            console.log('Login attempt:', email, data, error)
            return { error: error as Error | null }
        } catch (e: any) {
            console.error('Login error:', e)
            return { error: e }
        }
    }

    const signUp = async (email: string, password: string, metadata?: Record<string, unknown>) => {
        try {
            const { error, data } = await supabase.auth.signUp({
                email,
                password,
                options: { data: metadata },
            })
            console.log('Register attempt:', email, data, error)
            return { error: error as Error | null }
        } catch (e: any) {
            console.error('Register error:', e)
            return { error: e }
        }
    }

    const signOut = async () => {
        try {
            if (state.user?.id) {
                await clearPushToken(state.user.id).catch(() => {})
            }
            await AsyncStorage.removeItem(TWOFA_UNTIL_KEY).catch(() => {})
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
            await AsyncStorage.setItem(TWOFA_UNTIL_KEY, String(Date.now() + TWOFA_WINDOW_MS))
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

        const { role: _role, ...updateData } = data
        const { error } = await supabase
            .from('client_profiles')
            .update(updateData)
            .eq('id', state.user.id)

        if (!error) {
            setState(prev => ({
                ...prev,
                profile: prev.profile ? { ...prev.profile, ...data } : prev.profile,
            }))
        }

        return { error: error as Error | null }
    }

    const refreshProfile = async () => {
        if (state.user?.id) {
            await fetchProfile(state.user.id)
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
