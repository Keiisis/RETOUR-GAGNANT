'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Envelope as Mail, Lock, CircleNotch as Loader2, ArrowRight, Eye, EyeSlash as EyeOff, WarningCircle as AlertCircle, CheckCircle as CheckCircle2, Key as KeyRound } from '@phosphor-icons/react';

export default function ResetPasswordPage() {
    const [step, setStep] = useState<'request' | 'reset' | 'done'>('request')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [emailSent, setEmailSent] = useState(false)

    useEffect(() => {
        // Detect PASSWORD_RECOVERY event (user clicked link in email)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setStep('reset')
            }
        })
        return () => subscription.unsubscribe()
    }, [])

    const handleRequestReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)
        try {
            const origin = window.location.origin
            const { error } = await supabase.auth.resetPasswordForEmail(
                email.trim().toLowerCase(),
                { redirectTo: `${origin}/client/reset-password` }
            )
            if (error) throw new Error(error.message)
            setEmailSent(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (password !== confirm) {
            setError('Les mots de passe ne correspondent pas.')
            return
        }
        if (password.length < 8) {
            setError('Le mot de passe doit contenir au moins 8 caractères.')
            return
        }
        setIsLoading(true)
        try {
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw new Error(error.message)
            setStep('done')
            setTimeout(() => { window.location.href = '/client/login' }, 2500)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de la réinitialisation.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-nexus-deep flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-50 bg-[radial-gradient(circle,rgba(59,130,246,0.12)_0%,transparent_70%)]" />
                <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-40 bg-[radial-gradient(circle,rgba(99,102,241,0.1)_0%,transparent_70%)]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 32, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[420px] relative z-10"
            >
                <div className="text-center mb-7">
                    <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        className="inline-flex items-center justify-center w-[68px] h-[68px] rounded-2xl bg-[var(--panel-accent)] p-[2px] mb-4 shadow-[0_0_40px_rgba(59,130,246,0.3)]">
                        <div className="w-full h-full bg-nexus-deep rounded-[14px] flex items-center justify-center">
                            <KeyRound size={28} className="text-[var(--panel-accent)]" />
                        </div>
                    </motion.div>
                    <h1 className="text-2xl font-black text-white">MOT DE PASSE <span className="text-[var(--panel-accent)]">OUBLIÉ</span></h1>
                    <p className="text-gray-500 mt-1.5 uppercase tracking-[0.3em] text-[9px] font-bold">Retour Gagnant Bénin · Espace Client</p>
                </div>

                <AnimatePresence mode="wait">
                    {step === 'done' ? (
                        <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                            <div className="w-16 h-16 rounded-full bg-[var(--panel-accent-soft)] border border-[var(--panel-accent)]/30 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 size={32} className="text-[var(--panel-accent)]" />
                            </div>
                            <h2 className="text-xl font-black text-white mb-2">Mot de passe mis à jour !</h2>
                            <p className="text-gray-400 text-sm mb-4">Vous allez être redirigé vers la connexion...</p>
                            <Loader2 className="animate-spin text-[var(--panel-accent)] mx-auto" size={20} />
                        </motion.div>

                    ) : step === 'reset' ? (
                        <motion.div key="reset" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-7 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                            <p className="text-sm text-gray-400 mb-5">Choisissez votre nouveau mot de passe.</p>
                            <AnimatePresence>
                                {error && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
                                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/8 border border-red-500/15">
                                            <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                                            <p className="text-red-400 text-[12px]">{error}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em]">Nouveau mot de passe</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={15} />
                                        <input type={showPassword ? 'text' : 'password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                                            placeholder="Min. 8 caractères"
                                            className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[var(--panel-accent)]/50 rounded-xl py-3 pl-11 pr-10 text-white placeholder:text-gray-600 focus:outline-none text-[13px] transition-colors" />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-[var(--panel-accent)] transition-colors" tabIndex={-1}>
                                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em]">Confirmer</label>
                                    <input type={showPassword ? 'text' : 'password'} required value={confirm} onChange={e => setConfirm(e.target.value)}
                                        placeholder="Répéter le mot de passe"
                                        className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[var(--panel-accent)]/50 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none text-[13px] transition-colors" />
                                </div>
                                <motion.button type="submit" disabled={isLoading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                                    className="w-full bg-[var(--panel-accent)] text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 group relative overflow-hidden shadow-[0_4px_20px_rgba(59,130,246,0.3)] mt-2">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : (
                                        <>
                                            <span className="tracking-[0.1em] text-[12px]">RÉINITIALISER</span>
                                            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </motion.button>
                            </form>
                        </motion.div>

                    ) : emailSent ? (
                        <motion.div key="sent" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                            <div className="w-16 h-16 rounded-full bg-[var(--panel-accent-soft)] border border-[var(--panel-accent)]/30 flex items-center justify-center mx-auto mb-4">
                                <Mail size={28} className="text-[var(--panel-accent)]" />
                            </div>
                            <h2 className="text-xl font-black text-white mb-2">Email envoyé !</h2>
                            <p className="text-gray-400 text-sm mb-2">Vérifiez votre boîte mail.</p>
                            <p className="text-gray-500 text-xs mb-5">Cliquez sur le lien dans l'email pour définir votre nouveau mot de passe. Vérifiez aussi vos spams.</p>
                            <Link href="/client/login" className="inline-flex items-center gap-1.5 text-[var(--panel-accent)] text-sm font-bold hover:text-[var(--panel-accent)] transition-colors">
                                <ArrowRight size={14} /> Retour à la connexion
                            </Link>
                        </motion.div>

                    ) : (
                        <motion.div key="request" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-7 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                            <p className="text-sm text-gray-400 mb-5">Saisissez votre adresse email pour recevoir un lien de réinitialisation.</p>
                            <AnimatePresence>
                                {error && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
                                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/8 border border-red-500/15">
                                            <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                                            <p className="text-red-400 text-[12px]">{error}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <form onSubmit={handleRequestReset} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em]">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={15} />
                                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                            placeholder="votre@email.com" autoComplete="email"
                                            className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[var(--panel-accent)]/50 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-gray-600 focus:outline-none text-[13px] transition-colors" />
                                    </div>
                                </div>
                                <motion.button type="submit" disabled={isLoading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                                    className="w-full bg-[var(--panel-accent)] text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 group relative overflow-hidden shadow-[0_4px_20px_rgba(59,130,246,0.3)] mt-2">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : (
                                        <>
                                            <span className="tracking-[0.1em] text-[12px]">ENVOYER LE LIEN</span>
                                            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </motion.button>
                            </form>
                            <div className="mt-5 pt-5 border-t border-white/[0.06] text-center">
                                <Link href="/client/login" className="text-[12px] text-gray-500 hover:text-[var(--panel-accent)] transition-colors">
                                    ← Retour à la connexion
                                </Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <p className="text-center mt-5 text-gray-600 text-[10px]">
                    © {new Date().getFullYear()} Retour Gagnant Bénin · Espace Client Sécurisé
                </p>
            </motion.div>
        </div>
    )
}
