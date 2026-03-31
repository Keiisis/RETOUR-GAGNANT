'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2, User, RefreshCw } from 'lucide-react'

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
        <div className="min-h-screen bg-nexus-deep flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-50 bg-[radial-gradient(circle,rgba(59,130,246,0.12)_0%,transparent_70%)]" />
                <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-40 bg-[radial-gradient(circle,rgba(99,102,241,0.1)_0%,transparent_70%)]" />
                <div className="absolute inset-0 opacity-[0.015] bg-[linear-gradient(rgba(59,130,246,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.4)_1px,transparent_1px)] bg-[length:80px_80px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 32, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[420px] relative z-10"
            >
                {/* Logo */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[2px] mb-5 shadow-[0_0_40px_rgba(59,130,246,0.3)]"
                    >
                        <div className="w-full h-full bg-nexus-deep rounded-[14px] flex items-center justify-center">
                            <User size={32} className="text-blue-400" />
                        </div>
                    </motion.div>
                    <h1 className="text-2xl font-black text-white">MON <span className="text-blue-400">ESPACE</span></h1>
                    <p className="text-gray-500 mt-1.5 uppercase tracking-[0.3em] text-[9px] font-bold">Retour Gagnant Bénin — Portail Client</p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-7 shadow-[0_20px_60px_rgba(0,0,0,0.4)] relative"
                >
                    <AnimatePresence>
                        {success && (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 z-20 flex items-center justify-center bg-[#060d16]/90 rounded-2xl">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-14 h-14 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                                        <CheckCircle2 size={28} className="text-blue-400" />
                                    </div>
                                    <p className="text-sm font-bold text-white">Connexion réussie</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Redirection...</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Erreur email non confirmé */}
                    <AnimatePresence>
                        {error === 'email_not_confirmed' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-5 overflow-hidden">
                                <div className="p-4 rounded-xl bg-amber-500/8 border border-amber-500/20 space-y-3">
                                    <div className="flex items-start gap-2.5">
                                        <AlertCircle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-amber-400 text-[12px] font-bold mb-0.5">Email non confirmé</p>
                                            <p className="text-amber-300/70 text-[11px] leading-relaxed">
                                                Votre compte existe mais votre email n'est pas encore vérifié. Vérifiez votre boîte mail (y compris les spams).
                                            </p>
                                        </div>
                                    </div>
                                    {resendStatus === 'idle' && (
                                        <button type="button" onClick={handleResendConfirmation}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-[11px] font-bold transition-all border border-amber-500/20">
                                            <RefreshCw size={12} />
                                            Renvoyer l&apos;email de confirmation
                                        </button>
                                    )}
                                    {resendStatus === 'loading' && (
                                        <div className="flex items-center justify-center gap-2 py-2 text-amber-400/60 text-[11px]">
                                            <Loader2 size={12} className="animate-spin" />
                                            Envoi en cours...
                                        </div>
                                    )}
                                    {resendStatus === 'sent' && (
                                        <div className="flex items-center gap-2 py-2 text-emerald-400 text-[11px] font-bold">
                                            <CheckCircle2 size={12} />
                                            Email envoyé ! Vérifiez votre boîte mail.
                                        </div>
                                    )}
                                    {resendStatus === 'error' && (
                                        <p className="text-red-400 text-[11px] text-center">Erreur d&apos;envoi. Réessayez dans quelques minutes.</p>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Erreurs classiques */}
                    <AnimatePresence>
                        {(error === 'invalid_credentials' || error === 'generic') && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-5 overflow-hidden">
                                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/8 border border-red-500/15">
                                    <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-red-400 text-[12px]">
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
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={15} />
                                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="votre@email.com" autoComplete="email"
                                    className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/50 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-gray-600 focus:outline-none text-[13px] transition-colors" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">Mot de passe</label>
                                <Link href="/client/reset-password" className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors font-bold">
                                    Mot de passe oublié ?
                                </Link>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={15} />
                                <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••" autoComplete="current-password"
                                    className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/50 rounded-xl py-3.5 pl-11 pr-11 text-white placeholder:text-gray-600 focus:outline-none text-[13px] transition-colors" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-blue-400 transition-colors" tabIndex={-1}>
                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        <motion.button type="submit" disabled={isLoading || success} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 group relative overflow-hidden shadow-[0_4px_20px_rgba(59,130,246,0.3)]">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                            {isLoading ? <Loader2 className="animate-spin" size={18} /> : (
                                <>
                                    <span className="tracking-[0.1em] text-[12px]">SE CONNECTER</span>
                                    <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </motion.button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
                        <p className="text-[12px] text-gray-500">
                            Pas encore de compte ?{' '}
                            <Link href={`/client/register${typeof window !== 'undefined' ? window.location.search : ''}`} className="text-blue-400 font-bold hover:text-blue-300 transition-colors">
                                Créer mon compte
                            </Link>
                        </p>
                    </div>
                </motion.div>

                <p className="text-center mt-5 text-gray-600 text-[10px]">
                    © {new Date().getFullYear()} Retour Gagnant Bénin — Espace Client Sécurisé
                </p>
            </motion.div>
        </div>
    )
}
