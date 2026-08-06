'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslation, T } from '@/lib/translation'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Envelope as Mail, Lock, CircleNotch as Loader2, ArrowRight, Eye, EyeSlash as EyeOff, WarningCircle as AlertCircle, CheckCircle as CheckCircle2 } from '@phosphor-icons/react';
import AuthBackdrop, { BrandSeal } from '@/components/auth/AuthBackdrop'

import { supabase } from '@/lib/supabase'

const evaluatePasswordStrength = (password: string): { score: number; key: string; color: string } => {
    let score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 1) return { score, key: 'Faible', color: 'bg-red-500' }
    if (score <= 2) return { score, key: 'Moyen', color: 'bg-amber-500' }
    if (score <= 3) return { score, key: 'Bon', color: 'bg-emerald-500' }
    return { score, key: 'Excellent', color: 'bg-emerald-400' }
}

// ═══════════════════════════════════════════
// Login Page
// ═══════════════════════════════════════════

export default function AgentLoginPage() {
    const { t } = useTranslation()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [shake, setShake] = useState(false)
    const [loginSuccess, setLoginSuccess] = useState(false)


    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('error') === 'unauthorized') {
                setError(t('Accès refusé. Ce portail est réservé aux agents accrédités.'));
                // Nettoyer l'URL
                window.history.replaceState({}, '', '/agent/login');
            }
        }
    }, [t])

    const passwordStrength = evaluatePasswordStrength(password)

    const triggerShake = useCallback(() => {
        setShake(true)
        setTimeout(() => setShake(false), 600)
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            })

            if (authError) {
                throw new Error(t('Identifiants incorrects. Veuillez réessayer.'))
            }

            // Force la session à être lue et les cookies à être écrits
            // AVANT de naviguer — c'est la clé pour éviter la boucle middleware
            await supabase.auth.getSession()

            // Success animation
            setLoginSuccess(true)
            // Petit délai pour laisser les cookies se propager côté serveur
            setTimeout(() => {
                window.location.href = '/agent'
            }, 1000)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t('Une erreur est survenue. Veuillez réessayer.')
            setError(message)
            triggerShake()
        } finally {
            if (!loginSuccess) setIsLoading(false)
        }
    }


    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Planter le jeune arbre : le geste quotidien de l'agent sur le terrain. */}
            <AuthBackdrop
                tone="parchment"
                image="/images/agent-login-bg.webp"
                imageAlt=""
                focus="center 50%"
            />

            {/* ═══ Login Card ═══ */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className={cn('w-full max-w-[420px] relative z-10', shake && 'animate-nexus-shake')}
            >
                {/* Logo / Header */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.08, duration: 0.55, ease: [0.34, 1.4, 0.64, 1] }}
                        className="mb-5"
                    >
                        <BrandSeal inner="#F8F5EE">
                            <Shield size={30} strokeWidth={1.75} className="text-[#008751]" />
                        </BrandSeal>
                    </motion.div>

                    <h1 className="font-display text-[32px] leading-none text-[#1F1B16] tracking-tight">
                        <T>Espace agent</T>
                    </h1>
                    <p className="text-[#6B6155] mt-2.5 uppercase tracking-[0.28em] text-[9px] font-semibold">
                        <T>Retour Gagnant Bénin · Bureau opérationnel</T>
                    </p>
                </div>

                {/* Form */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.16, duration: 0.5 }}
                    className="bg-white border border-[#E6DFD1] rounded-2xl p-7 shadow-[0_18px_50px_-24px_rgba(31,27,22,0.35)] relative overflow-hidden"
                >
                    <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-[#008751] via-[#FCD116] to-[#E8112D]" />
                    {/* Error message */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -8, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                exit={{ opacity: 0, y: -8, height: 0 }}
                                className="mb-5 overflow-hidden"
                            >
                                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#FDECEA] border border-[#F1B5AE]">
                                    <AlertCircle size={16} className="text-[#B3261E] flex-shrink-0 mt-0.5" />
                                    <p className="text-[#8C1D18] text-[12px] font-medium leading-relaxed">{error}</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Success overlay */}
                    <AnimatePresence>
                        {loginSuccess && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="absolute inset-0 z-20 flex items-center justify-center bg-white/95 rounded-2xl"
                            >
                                <div className="flex flex-col items-center gap-3">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                                        className="w-16 h-16 rounded-full bg-[#008751]/10 border border-[#008751]/30 flex items-center justify-center"
                                    >
                                        <CheckCircle2 size={32} strokeWidth={1.75} className="text-[#008751]" />
                                    </motion.div>
                                    <p className="text-sm font-bold text-[#1F1B16]">{t('Connexion réussie')}</p>
                                    <p className="text-[10px] text-[#6B6155] uppercase tracking-widest">{t('Redirection...')}</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div className="space-y-1.5">
                            <label htmlFor="agent-email" className="text-[10px] font-bold text-[#6B6155] uppercase tracking-[0.15em] ml-0.5">
                                <T>Email Professionnel</T>
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9083] group-focus-within:text-[#008751] transition-colors duration-200" size={16} />
                                <input
                                    id="agent-email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="agent@retourgagnant.bj"
                                    autoComplete="email"
                                    className="w-full bg-[#FBF9F4] border border-[#E6DFD1] focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 rounded-xl py-3.5 pl-11 pr-4 text-[#1F1B16] placeholder:text-[#A9A093] focus:outline-none text-[13px] transition-all"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label htmlFor="agent-password" className="text-[10px] font-bold text-[#6B6155] uppercase tracking-[0.15em] ml-0.5">
                                <T>Mot de Passe</T>
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9083] group-focus-within:text-[#008751] transition-colors duration-200" size={16} />
                                <input
                                    id="agent-password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    className="w-full bg-[#FBF9F4] border border-[#E6DFD1] focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 rounded-xl py-3.5 pl-11 pr-11 text-[#1F1B16] placeholder:text-[#A9A093] focus:outline-none text-[13px] transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9A9083] hover:text-[#008751] transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            {/* Password strength indicator */}
                            {password.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mt-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1 rounded-full bg-[#EDE6D8] overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                                                className={`h-full rounded-full ${passwordStrength.color} transition-colors`}
                                            />
                                        </div>
                                        <span className="text-[9px] font-bold text-[#6B6155] uppercase tracking-wider">
                                            {t(passwordStrength.key)}
                                        </span>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading || loginSuccess}
                            className="w-full bg-[#008751] hover:bg-[#00623A] text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group shadow-[0_10px_26px_-10px_rgba(0,135,81,0.6)] hover:shadow-[0_14px_32px_-10px_rgba(0,135,81,0.7)] hover:-translate-y-px active:translate-y-0 transition-all"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <>
                                    <span className="tracking-[0.08em] text-[12.5px]"><T>Accéder au bureau</T></span>
                                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>

                {/* Security badge */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="flex items-center justify-center gap-2 mt-6"
                >
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F1EADC] border border-[#E6DFD1]">
                        <Shield size={10} className="text-[#008751]" />
                        <span className="text-[9px] text-[#6B6155] font-bold uppercase tracking-wider">
                            <T>Connexion Sécurisée</T>
                        </span>
                    </div>
                </motion.div>

                {/* Footer */}
                <p className="text-center mt-4 text-[#6B6155] text-[10px]">
                    &copy; {new Date().getFullYear()} Retour Gagnant Bénin<br />
                    <T>Accès réservé aux agents accrédités</T>
                </p>
            </motion.div>
        </div>
    )
}

// Helper since cn might not be imported
function cn(...classes: (string | boolean | undefined)[]) {
    return classes.filter(Boolean).join(' ')
}
