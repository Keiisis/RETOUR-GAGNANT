import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../config/supabase'
import { registerPushToken, clearPushToken } from '../utils/pushToken'

/* ═══════════════════════════════════════════════════════════
   Auth Context — Session management + Profile management
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
}

interface AuthContextType extends AuthState {
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
    signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<{ error: Error | null }>
    signOut: () => Promise<void>
    resetPassword: (email: string) => Promise<{ error: Error | null }>
    updateProfile: (data: Partial<UserProfile>) => Promise<{ error: Error | null }>
    refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AuthState>({
        session: null,
        user: null,
        loading: true,
        profile: null,
    })

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
            } else {
                setState(prev => ({ ...prev, profile: null }))
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
            // Profil introuvable — pas bloquant
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
            await supabase.auth.signOut()
        } catch (e) {
            console.error('Sign out error:', e)
        }
        setState({ session: null, user: null, loading: false, profile: null })
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
            updateProfile, refreshProfile,
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
