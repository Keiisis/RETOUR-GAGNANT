'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2, User, Phone, ShieldCheck } from 'lucide-react'

// ── Critères de sécurité du mot de passe ──────────────────────────────────────
const PWD_CRITERIA = [
    { id: 'length',    label: '12 caractères minimum',    test: (p: string) => p.length >= 12 },
    { id: 'upper',     label: '1 lettre majuscule',        test: (p: string) => /[A-Z]/.test(p) },
    { id: 'digits',    label: '2 chiffres minimum',        test: (p: string) => (p.match(/\d/g) || []).length >= 2 },
    { id: 'special',   label: '1 caractère spécial (!@#$…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function PasswordStrength({ password }: { password: string }) {
    const results = useMemo(() => PWD_CRITERIA.map(c => ({ ...c, ok: c.test(password) })), [password])
    const score = results.filter(r => r.ok).length
    const bars = [
        { min: 0, color: 'bg-red-500' },
        { min: 1, color: 'bg-orange-500' },
        { min: 2, color: 'bg-yellow-400' },
        { min: 3, color: 'bg-blue-400' },
        { min: 4, color: 'bg-emerald-400' },
    ]
    const barColor = bars.slice().reverse().find(b => score >= b.min)?.color || 'bg-gray-700'
    const label = ['', 'Très faible', 'Faible', 'Moyen', 'Fort', 'Excellent'][score]

    if (!password) return null

    return (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 space-y-2">
            {/* Barre de progression */}
            <div className="flex gap-1 items-center">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < score ? barColor : 'bg-white/10'}`} />
                ))}
                <span className={`text-[10px] font-bold ml-1.5 transition-colors duration-300 ${
                    score <= 1 ? 'text-red-400' : score === 2 ? 'text-yellow-400' : score === 3 ? 'text-blue-400' : 'text-emerald-400'
                }`}>{label}</span>
            </div>
            {/* Critères */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {results.map(r => (
                    <motion.div key={r.id} className="flex items-center gap-1.5"
                        animate={{ opacity: r.ok ? 1 : 0.5 }}>
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${r.ok ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-white/5 border border-white/10'}`}>
                            {r.ok && <CheckCircle2 size={9} className="text-emerald-400" />}
                        </div>
                        <span className={`text-[9.5px] font-medium transition-colors duration-200 ${r.ok ? 'text-emerald-300' : 'text-gray-500'}`}>{r.label}</span>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    )
}

export default function ClientRegisterPage() {
    const [form, setForm] = useState({ nom: '', prenom: '', email: '', phone: '', password: '', confirm: '' })
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [linkedDocs, setLinkedDocs] = useState(0)
    const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            const emailParam = params.get('email')
            if (emailParam) setForm(f => ({ ...f, email: decodeURIComponent(emailParam) }))
        }
    }, [])

    const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (form.password !== form.confirm) {
            setError('Les mots de passe ne correspondent pas.')
            return
        }
        const failedCriteria = PWD_CRITERIA.filter(c => !c.test(form.password))
        if (failedCriteria.length > 0) {
            setError(`Mot de passe insuffisant : ${failedCriteria.map(c => c.label).join(', ')}.`)
            return
        }

        setIsLoading(true)

        try {
            // Inscription et liaison centralisées côté serveur avec envoi d'email personnalisé
            const res = await fetch('/api/client/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: form.email.trim().toLowerCase(),
                    password: form.password,
                    nom: form.nom,
                    prenom: form.prenom,
                    phone: form.phone,
                }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Erreur lors de la configuration du compte.')

            setLinkedDocs(json.linked?.documents || 0)
            setNeedsEmailConfirm(json.needsEmailConfirm !== false)
            setSuccess(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de l\'inscription.')
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
                className="w-full max-w-[460px] relative z-10"
            >
                <div className="text-center mb-7">
                    <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        className="inline-flex items-center justify-center w-[68px] h-[68px] rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[2px] mb-4 shadow-[0_0_40px_rgba(59,130,246,0.3)]">
                        <div className="w-full h-full bg-nexus-deep rounded-[14px] flex items-center justify-center">
                            <User size={30} className="text-blue-400" />
                        </div>
                    </motion.div>
                    <h1 className="text-2xl font-black text-white">CRÉER MON <span className="text-blue-400">COMPTE</span></h1>
                    <p className="text-gray-500 mt-1.5 uppercase tracking-[0.3em] text-[9px] font-bold">Retour Gagnant Bénin — Espace Client</p>
                </div>

                <AnimatePresence mode="wait">
                    {success ? (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                            <div className="w-16 h-16 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center mx-auto mb-4">
                                <Mail size={32} className="text-blue-400" />
                            </div>
                            <h2 className="text-xl font-black text-white mb-2">Vérifiez votre email !</h2>
                            <p className="text-gray-400 text-sm mb-4">
                                Un email de confirmation a été envoyé à<br />
                                <strong className="text-white">{form.email}</strong>
                            </p>
                            {linkedDocs > 0 && (
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4">
                                    <p className="text-blue-300 text-sm font-bold">
                                        {linkedDocs} document{linkedDocs > 1 ? 's' : ''} retrouvé{linkedDocs > 1 ? 's' : ''} et lié{linkedDocs > 1 ? 's' : ''} à votre compte.
                                    </p>
                                </div>
                            )}
                            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 mb-4">
                                <p className="text-amber-300 text-[12px] font-bold mb-1">Action requise</p>
                                <p className="text-gray-400 text-[11px] leading-relaxed">
                                    Cliquez sur le lien dans l'email pour <strong className="text-white">activer votre compte</strong>. Le lien est valable 24h.
                                </p>
                            </div>
                            <p className="text-gray-600 text-[10px]">Vérifiez vos spams si vous ne voyez pas l'email.</p>
                        </motion.div>
                    ) : (
                        <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                            className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-7 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                            <AnimatePresence>
                                {error && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-5 overflow-hidden">
                                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/8 border border-red-500/15">
                                            <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                                            <p className="text-red-400 text-[12px]">{error}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em]">Nom</label>
                                        <input type="text" required value={form.nom} onChange={e => update('nom', e.target.value)}
                                            placeholder="Dupont" className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/50 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none text-[13px] transition-colors" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em]">Prénom</label>
                                        <input type="text" value={form.prenom} onChange={e => update('prenom', e.target.value)}
                                            placeholder="Marie" className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/50 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none text-[13px] transition-colors" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em]">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={15} />
                                        <input type="email" required value={form.email} onChange={e => update('email', e.target.value)}
                                            placeholder="votre@email.com" autoComplete="email"
                                            className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-gray-600 focus:outline-none text-[13px] transition-colors" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em]">Téléphone (optionnel)</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={15} />
                                        <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                                            placeholder="+33 6 12 34 56 78"
                                            className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-gray-600 focus:outline-none text-[13px] transition-colors" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em] flex items-center gap-1.5">
                                        <ShieldCheck size={10} />Mot de passe
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={15} />
                                        <input type={showPassword ? 'text' : 'password'} required minLength={12} value={form.password} onChange={e => update('password', e.target.value)}
                                            placeholder="Min. 12 car., maj., chiffres, spécial"
                                            className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-10 text-white placeholder:text-gray-600 focus:outline-none text-[13px] transition-colors" />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-blue-400 transition-colors" tabIndex={-1}>
                                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                    <PasswordStrength password={form.password} />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em]">Confirmer le mot de passe</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={15} />
                                        <input type={showPassword ? 'text' : 'password'} required value={form.confirm} onChange={e => update('confirm', e.target.value)}
                                            placeholder="Répéter le mot de passe"
                                            className={`w-full bg-white/[0.04] border rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-gray-600 focus:outline-none text-[13px] transition-colors ${
                                                form.confirm && form.confirm !== form.password
                                                    ? 'border-red-500/40 focus:border-red-500/60'
                                                    : form.confirm && form.confirm === form.password
                                                    ? 'border-emerald-500/40 focus:border-emerald-500/60'
                                                    : 'border-white/[0.08] focus:border-blue-500/50'
                                            }`} />
                                        {form.confirm && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                {form.confirm === form.password
                                                    ? <CheckCircle2 size={14} className="text-emerald-400" />
                                                    : <AlertCircle size={14} className="text-red-400" />
                                                }
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <motion.button type="submit" disabled={isLoading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 group relative overflow-hidden shadow-[0_4px_20px_rgba(59,130,246,0.3)] mt-2">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : (
                                        <>
                                            <span className="tracking-[0.1em] text-[12px]">CRÉER MON COMPTE</span>
                                            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </motion.button>
                            </form>

                            <div className="mt-5 pt-5 border-t border-white/[0.06] text-center">
                                <p className="text-[12px] text-gray-500">
                                    Déjà un compte ?{' '}
                                    <Link href="/client/login" className="text-blue-400 font-bold hover:text-blue-300 transition-colors">Se connecter</Link>
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <p className="text-center mt-5 text-gray-600 text-[10px]">
                    © {new Date().getFullYear()} Retour Gagnant Bénin — Vos données sont protégées
                </p>
            </motion.div>
        </div>
    )
}
