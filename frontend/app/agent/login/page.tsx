'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslation, T } from '@/lib/translation'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'

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
        <div className="min-h-screen bg-nexus-deep flex items-center justify-center p-4 relative overflow-hidden">
            {/* ═══ Animated Background Orbs ═══ */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Orb 1 — Top Right */}
                <div className="absolute top-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full animate-orb-1 opacity-60 bg-[radial-gradient(circle,rgba(16,185,129,0.12)_0%,transparent_70%)]"
                />
                {/* Orb 2 — Bottom Left */}
                <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full animate-orb-2 opacity-50 bg-[radial-gradient(circle,rgba(20,184,166,0.1)_0%,transparent_70%)]"
                />
                {/* Orb 3 — Center */}
                <div className="absolute top-[35%] left-[45%] w-[400px] h-[400px] rounded-full animate-nexus-float opacity-30 bg-[radial-gradient(circle,rgba(16,185,129,0.08)_0%,transparent_65%)]"
                />

                {/* Grid lines */}
                <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(rgba(16,185,129,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.4)_1px,transparent_1px)] bg-[length:80px_80px]"
                />

                {/* Vignette */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(4,10,8,0.8)_100%)]"
                />
            </div>

            {/* ═══ Login Card ═══ */}
            <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className={cn('w-full max-w-[420px] relative z-10', shake && 'animate-nexus-shake')}
            >
                {/* Logo / Header */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        transition={{ delay: 0.2, duration: 0.6, type: 'spring', stiffness: 200 }}
                        className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-[2px] mb-5 shadow-nexus-glow-lg animate-nexus-glow"
                    >
                        <div className="w-full h-full bg-nexus-deep rounded-[14px] flex items-center justify-center">
                            <Shield size={32} className="text-emerald-400" />
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-2xl font-black text-white font-heading tracking-tight"
                    >
                        <T>ESPACE</T> <span className="text-emerald-400"><T>AGENT</T></span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-nexus-text-muted mt-1.5 uppercase tracking-[0.3em] text-[9px] font-bold"
                    >
                        <T>Retour Gagnant Bénin — Bureau Opérationnel</T>
                    </motion.p>
                </div>

                {/* Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="glass-nexus-card p-7 shadow-nexus-elevated"
                >
                    {/* Error message */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -8, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                exit={{ opacity: 0, y: -8, height: 0 }}
                                className="mb-5 overflow-hidden"
                            >
                                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/8 border border-red-500/15">
                                    <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-red-400 text-[12px] font-medium leading-relaxed">{error}</p>
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
                                className="absolute inset-0 z-20 flex items-center justify-center glass-nexus-card rounded-2xl"
                            >
                                <div className="flex flex-col items-center gap-3">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                                        className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"
                                    >
                                        <CheckCircle2 size={32} className="text-emerald-400" />
                                    </motion.div>
                                    <p className="text-sm font-bold text-white">{t('Connexion réussie')}</p>
                                    <p className="text-[10px] text-nexus-text-muted uppercase tracking-widest">{t('Redirection...')}</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div className="space-y-1.5">
                            <label htmlFor="agent-email" className="text-[10px] font-bold text-nexus-text-muted uppercase tracking-[0.15em] ml-0.5">
                                <T>Email Professionnel</T>
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nexus-text-muted group-focus-within:text-emerald-400 transition-colors duration-200" size={16} />
                                <input
                                    id="agent-email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="agent@retourgagnant.bj"
                                    autoComplete="email"
                                    className="w-full glass-nexus-input rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-nexus-text-muted/50 focus:outline-none text-[13px]"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label htmlFor="agent-password" className="text-[10px] font-bold text-nexus-text-muted uppercase tracking-[0.15em] ml-0.5">
                                <T>Mot de Passe</T>
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nexus-text-muted group-focus-within:text-emerald-400 transition-colors duration-200" size={16} />
                                <input
                                    id="agent-password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    className="w-full glass-nexus-input rounded-xl py-3.5 pl-11 pr-11 text-white placeholder:text-nexus-text-muted/50 focus:outline-none text-[13px]"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-nexus-text-muted hover:text-emerald-400 transition-colors"
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
                                        <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                                                className={`h-full rounded-full ${passwordStrength.color} transition-colors`}
                                            />
                                        </div>
                                        <span className="text-[9px] font-bold text-nexus-text-muted uppercase tracking-wider">
                                            {t(passwordStrength.key)}
                                        </span>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Submit */}
                        <motion.button
                            type="submit"
                            disabled={isLoading || loginSuccess}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-nexus-glow relative overflow-hidden"
                        >
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                            {isLoading ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <>
                                    <span className="tracking-[0.15em] text-[12px] relative z-10"><T>ACCÉDER AU BUREAU</T></span>
                                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform relative z-10" />
                                </>
                            )}
                        </motion.button>
                    </form>
                </motion.div>

                {/* Security badge */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="flex items-center justify-center gap-2 mt-6"
                >
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.02] border border-nexus-border-subtle">
                        <Shield size={10} className="text-emerald-500" />
                        <span className="text-[9px] text-nexus-text-muted font-bold uppercase tracking-wider">
                            <T>Connexion Sécurisée</T>
                        </span>
                    </div>
                </motion.div>

                {/* Footer */}
                <p className="text-center mt-4 text-nexus-text-muted text-[10px]">
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
