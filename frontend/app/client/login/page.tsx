'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Envelope as Mail, Lock, CircleNotch as Loader2, ArrowRight, Eye, EyeSlash as EyeOff, WarningCircle as AlertCircle, CheckCircle as CheckCircle2, User, ArrowClockwise as RefreshCw } from '@phosphor-icons/react';
import AuthBackdrop, { BrandSeal } from '@/components/auth/AuthBackdrop'

export default function ClientLoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<'invalid_credentials' | 'email_not_confirmed' | 'generic' | null>(null)
    const [success, setSuccess] = useState(false)
    const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            if (params.get('error') === 'no-profile') {
                setError('generic')
            }
            if (params.get('error') === 'confirmation_failed') {
                setError('email_not_confirmed')
            }
            const emailParam = params.get('email')
            if (emailParam) setEmail(decodeURIComponent(emailParam))
        }
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        setResendStatus('idle')

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            })

            if (authError) {
                const msg = authError.message.toLowerCase()
                if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
                    setError('email_not_confirmed')
                } else if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('password')) {
                    setError('invalid_credentials')
                } else {
                    setError('generic')
                }
                return
            }

            await supabase.auth.getSession()
            setSuccess(true)

            const from = new URLSearchParams(window.location.search).get('from')
            // Sécurité : ne rediriger que vers des routes internes /client/* (Open Redirect fix)
            const safeFrom = (from && /^\/(client|portail)\//.test(from)) ? from : '/client/dashboard'
            setTimeout(() => {
                window.location.href = safeFrom
            }, 900)
        } catch {
            setError('generic')
        } finally {
            if (!success) setIsLoading(false)
        }
    }

    const handleResendConfirmation = async () => {
        if (!email.trim()) {
            setError('invalid_credentials')
            return
        }
        setResendStatus('loading')
        try {
            const res = await fetch('/api/client/resend-confirmation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            })
            if (!res.ok) throw new Error()
            setResendStatus('sent')
        } catch {
            setResendStatus('error')
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* La Porte du Retour : ce que vient accomplir la personne qui se connecte. */}
            <AuthBackdrop
                tone="parchment"
                image="/images/client-login-bg.webp"
                imageAlt=""
                focus="center 55%"
            />

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-[420px] relative z-10"
            >
                {/* Sceau de marque + intitulé */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.08, duration: 0.55, ease: [0.34, 1.4, 0.64, 1] }}
                        className="mb-5"
                    >
                        <BrandSeal inner="#F8F5EE">
                            <User size={30} strokeWidth={1.75} className="text-[#008751]" />
                        </BrandSeal>
                    </motion.div>
                    <h1 className="font-display text-[32px] leading-none text-[#1F1B16] tracking-tight">Mon espace</h1>
                    <p className="text-[#6B6155] mt-2.5 uppercase tracking-[0.28em] text-[9px] font-semibold">
                        Retour Gagnant Bénin · Portail client
                    </p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.16, duration: 0.5 }}
                    className="bg-white border border-[#E6DFD1] rounded-2xl p-7 shadow-[0_18px_50px_-24px_rgba(31,27,22,0.35)] relative overflow-hidden"
                >
                    {/* Filet tricolore latéral : la carte se lit comme un document officiel */}
                    <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-[#008751] via-[#FCD116] to-[#E8112D]" />
                    <AnimatePresence>
                        {success && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-20 flex items-center justify-center bg-white/95 rounded-2xl">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-14 h-14 rounded-full bg-[#008751]/10 border border-[#008751]/25 flex items-center justify-center">
                                        <CheckCircle2 size={28} strokeWidth={1.75} className="text-[#008751]" />
                                    </div>
                                    <p className="text-sm font-bold text-[#1F1B16]">Connexion réussie</p>
                                    <p className="text-[10px] text-[#6B6155] uppercase tracking-widest">Redirection…</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Erreur email non confirmé */}
                    <AnimatePresence>
                        {error === 'email_not_confirmed' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-5 overflow-hidden">
                                <div className="p-4 rounded-xl bg-[#FEF6E4] border border-[#E8C57A] space-y-3">
                                    <div className="flex items-start gap-2.5">
                                        <AlertCircle size={15} className="text-[#96650B] flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[#7A5208] text-[12px] font-bold mb-0.5">Email non confirmé</p>
                                            <p className="text-[#8A6414] text-[11px] leading-relaxed">
                                                Votre compte existe mais votre email n&apos;est pas encore vérifié. Vérifiez votre boîte mail (y compris les spams).
                                            </p>
                                        </div>
                                    </div>
                                    {resendStatus === 'idle' && (
                                        <button type="button" onClick={handleResendConfirmation}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#F7E6BF] hover:bg-[#F2DCA8] text-[#7A5208] text-[11px] font-bold transition-all border border-[#E4C177]">
                                            <RefreshCw size={12} />
                                            Renvoyer l&apos;email de confirmation
                                        </button>
                                    )}
                                    {resendStatus === 'loading' && (
                                        <div className="flex items-center justify-center gap-2 py-2 text-[#8A6414] text-[11px]">
                                            <Loader2 size={12} className="animate-spin" />
                                            Envoi en cours…
                                        </div>
                                    )}
                                    {resendStatus === 'sent' && (
                                        <div className="flex items-center gap-2 py-2 text-[#00623A] text-[11px] font-bold">
                                            <CheckCircle2 size={12} />
                                            Email envoyé. Vérifiez votre boîte mail.
                                        </div>
                                    )}
                                    {resendStatus === 'error' && (
                                        <p className="text-[#B3261E] text-[11px] text-center">Envoi impossible. Réessayez dans quelques minutes.</p>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Erreurs classiques */}
                    <AnimatePresence>
                        {(error === 'invalid_credentials' || error === 'generic') && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-5 overflow-hidden">
                                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FDECEA] border border-[#F1B5AE]">
                                    <AlertCircle size={15} className="text-[#B3261E] flex-shrink-0 mt-0.5" />
                                    <p className="text-[#8C1D18] text-[12px]">
                                        {error === 'invalid_credentials'
                                            ? 'Identifiants incorrects. Vérifiez votre email et mot de passe.'
                                            : 'Une erreur est survenue. Veuillez réessayer.'}
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <label htmlFor="client-email" className="text-[10px] font-bold text-[#6B6155] uppercase tracking-[0.15em]">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9083]" size={15} />
                                <input id="client-email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="votre@email.com" autoComplete="email"
                                    className="w-full bg-[#FBF9F4] border border-[#E6DFD1] focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 rounded-xl py-3.5 pl-11 pr-4 text-[#1F1B16] placeholder:text-[#A9A093] focus:outline-none text-[13px] transition-all" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label htmlFor="client-password" className="text-[10px] font-bold text-[#6B6155] uppercase tracking-[0.15em]">Mot de passe</label>
                                <Link href="/client/reset-password" className="text-[10px] text-[#008751] hover:text-[#00623A] transition-colors font-bold">
                                    Mot de passe oublié ?
                                </Link>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9083]" size={15} />
                                <input id="client-password" type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••" autoComplete="current-password"
                                    className="w-full bg-[#FBF9F4] border border-[#E6DFD1] focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 rounded-xl py-3.5 pl-11 pr-11 text-[#1F1B16] placeholder:text-[#A9A093] focus:outline-none text-[13px] transition-all" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9A9083] hover:text-[#008751] transition-colors" tabIndex={-1}>
                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={isLoading || success}
                            className="w-full bg-[#008751] hover:bg-[#00623A] text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 group shadow-[0_10px_26px_-10px_rgba(0,135,81,0.6)] hover:shadow-[0_14px_32px_-10px_rgba(0,135,81,0.7)] hover:-translate-y-px active:translate-y-0 transition-all">
                            {isLoading ? <Loader2 className="animate-spin" size={18} /> : (
                                <>
                                    <span className="tracking-[0.08em] text-[12.5px]">Se connecter</span>
                                    <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-[#EDE6D8] text-center">
                        <p className="text-[12px] text-[#6B6155]">
                            Pas encore de compte ?{' '}
                            <Link href={`/client/register${typeof window !== 'undefined' ? window.location.search : ''}`} className="text-[#008751] font-bold hover:text-[#00623A] transition-colors">
                                Créer mon compte
                            </Link>
                        </p>
                    </div>
                </motion.div>

                <p className="text-center mt-5 text-[#9A9083] text-[10px]">
                    © {new Date().getFullYear()} Retour Gagnant Bénin · Espace client sécurisé
                </p>
            </motion.div>
        </div>
    )
}
