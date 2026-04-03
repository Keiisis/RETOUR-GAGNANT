'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown, Mail, Lock, Loader2, ArrowRight, ArrowLeft, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ══════════════════════════════════════════════════════════════
// PALETTE CEO — Or · Vert · Jaune · Rouge (Drapeau Bénin)
// ══════════════════════════════════════════════════════════════
const GOLD   = '#D4AF37'
const YELLOW = '#FCD116'
const GREEN  = '#008751'
const RED    = '#E8112D'
const BG     = '#0B1F0D'   // Fond vert forêt profond (pas noir)

type View = 'login' | 'forgot' | 'forgot-sent'

export default function CeoLoginPage() {
    const router = useRouter()
    const [view, setView]             = useState<View>('login')
    const [email, setEmail]           = useState('')
    const [password, setPassword]     = useState('')
    const [forgotEmail, setForgotEmail] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading]   = useState(false)
    const [isSending, setIsSending]   = useState(false)
    const [error, setError]           = useState('')

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')
        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
            if (authError) { setError('Identifiants incorrects.'); return }

            const { data: profile } = await supabase
                .from('user_profiles')
                .select('role, full_name')
                .eq('id', data.user.id)
                .single()

            if (!profile || profile.role !== 'ceo') {
                await supabase.auth.signOut()
                setError('Accès réservé au CEO.')
                return
            }
            sessionStorage.removeItem('ceo_welcomed')
            router.push('/ceo/dashboard')
        } catch {
            setError('Erreur de connexion.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSending(true)
        try {
            await supabase.auth.resetPasswordForEmail(forgotEmail, {
                redirectTo: `${window.location.origin}/ceo/reset-password`,
            })
            setView('forgot-sent')
        } catch {
            setError("Erreur lors de l'envoi.")
        } finally {
            setIsSending(false)
        }
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${BG} 0%, #112A13 50%, #0E1E0A 100%)` }}
        >
            {/* Cercles de couleurs Bénin */}
            <div className="absolute top-[-20%] right-[-10%] w-[700px] h-[700px] rounded-full blur-[140px] pointer-events-none opacity-20"
                style={{ background: GOLD }} />
            <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none opacity-15"
                style={{ background: RED }} />
            <div className="absolute top-[40%] left-[20%] w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none opacity-10"
                style={{ background: GREEN }} />

            {/* Particules dorées */}
            {[...Array(10)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        width: 2 + (i % 3),
                        height: 2 + (i % 3),
                        background: i % 3 === 0 ? GOLD : i % 3 === 1 ? YELLOW : GREEN,
                        left: `${8 + i * 9}%`,
                        top: `${15 + (i % 4) * 20}%`,
                    }}
                    animate={{ y: [-15, 15, -15], opacity: [0.2, 0.8, 0.2], scale: [0.6, 1.4, 0.6] }}
                    transition={{ duration: 2.5 + i * 0.3, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
                />
            ))}

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-md relative z-10"
            >
                {/* En-tête */}
                <div className="text-center mb-8">
                    {/* Bannière drapeau Bénin */}
                    <div className="flex justify-center mb-5">
                        <div className="flex rounded-2xl overflow-hidden shadow-2xl" style={{ height: 8, width: 96 }}>
                            <div className="flex-1" style={{ background: GREEN }} />
                            <div className="flex-1" style={{ background: YELLOW }} />
                            <div className="flex-1" style={{ background: RED }} />
                        </div>
                    </div>

                    <motion.div
                        initial={{ scale: 0, rotate: -120 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.3, type: 'spring', stiffness: 180 }}
                        className="inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-5 shadow-2xl relative"
                        style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #B8860B 40%, ${YELLOW} 70%, ${GOLD} 100%)` }}
                    >
                        <Crown size={48} style={{ color: BG }} />
                        <motion.div
                            className="absolute inset-0 rounded-3xl"
                            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 60%)' }}
                            animate={{ opacity: [0.6, 1, 0.6] }}
                            transition={{ duration: 2.5, repeat: Infinity }}
                        />
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-4xl font-black tracking-widest"
                        style={{
                            background: `linear-gradient(135deg, ${GOLD}, ${YELLOW}, ${GOLD})`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            fontFamily: 'serif',
                        }}
                    >
                        ESPACE CEO
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                        className="mt-2 uppercase tracking-[0.45em] text-[9px] font-black"
                        style={{ color: `${GREEN}AA` }}
                    >
                        RETOUR GAGNANT BÉNIN · ACCÈS PRIVÉ
                    </motion.p>
                </div>

                {/* Ligne tricolore */}
                <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.8, duration: 0.7 }}
                    className="h-[2px] mb-7 mx-6 rounded-full"
                    style={{ background: `linear-gradient(90deg, ${GREEN}, ${YELLOW}, ${RED})` }}
                />

                <AnimatePresence mode="wait">
                    {/* ═══ LOGIN ═══ */}
                    {view === 'login' && (
                        <motion.div
                            key="login"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="rounded-3xl p-8 shadow-2xl border"
                            style={{
                                background: 'rgba(20, 50, 22, 0.75)',
                                borderColor: `${GOLD}25`,
                                backdropFilter: 'blur(20px)',
                                boxShadow: `0 30px 70px rgba(0,0,0,0.5), 0 0 0 1px ${GOLD}10`,
                            }}
                        >
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mb-5 p-3 rounded-xl text-xs border"
                                    style={{ color: RED, background: `${RED}12`, borderColor: `${RED}30` }}
                                >
                                    {error}
                                </motion.div>
                            )}

                            <form onSubmit={handleLogin} className="space-y-6">
                                {/* Email */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: YELLOW }}>
                                        Adresse Email
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2" size={17} style={{ color: `${GREEN}90` }} />
                                        <input
                                            type="email" required value={email}
                                            onChange={e => { setEmail(e.target.value); setError('') }}
                                            placeholder="ceo@retourgagnant.bj"
                                            className="w-full rounded-xl py-4 pl-11 pr-4 text-sm outline-none transition-all"
                                            style={{
                                                background: 'rgba(255,255,255,0.06)',
                                                border: `1px solid rgba(0,135,81,0.25)`,
                                                color: '#F0EBD8',
                                            }}
                                            onFocus={e => e.currentTarget.style.borderColor = `${GOLD}60`}
                                            onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,135,81,0.25)'}
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: YELLOW }}>
                                            Mot de Passe
                                        </label>
                                        <button type="button"
                                            onClick={() => { setForgotEmail(email); setView('forgot') }}
                                            className="text-[9px] font-bold uppercase tracking-wider transition-colors"
                                            style={{ color: `${GOLD}70` }}
                                            onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
                                            onMouseLeave={e => (e.currentTarget.style.color = `${GOLD}70`)}
                                        >
                                            Oublié ?
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2" size={17} style={{ color: `${GREEN}90` }} />
                                        <input
                                            type={showPassword ? 'text' : 'password'} required value={password}
                                            onChange={e => { setPassword(e.target.value); setError('') }}
                                            placeholder="••••••••"
                                            className="w-full rounded-xl py-4 pl-11 pr-12 text-sm outline-none transition-all"
                                            style={{
                                                background: 'rgba(255,255,255,0.06)',
                                                border: `1px solid rgba(0,135,81,0.25)`,
                                                color: '#F0EBD8',
                                            }}
                                            onFocus={e => e.currentTarget.style.borderColor = `${GOLD}60`}
                                            onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,135,81,0.25)'}
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                                            style={{ color: `${GREEN}60` }}>
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit" disabled={isLoading}
                                    className="w-full h-14 rounded-xl font-black text-sm tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 group relative overflow-hidden"
                                    style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #B8860B 50%, ${YELLOW} 100%)`, color: BG }}
                                >
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        style={{ background: `linear-gradient(135deg, ${YELLOW}, ${GOLD}, ${YELLOW})` }} />
                                    {isLoading
                                        ? <Loader2 className="animate-spin relative z-10" size={22} />
                                        : <>
                                            <span className="relative z-10">ACCÉDER AU PANNEAU</span>
                                            <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    }
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* ═══ FORGOT ═══ */}
                    {view === 'forgot' && (
                        <motion.div key="forgot"
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="rounded-3xl p-8 shadow-2xl border"
                            style={{ background: 'rgba(20, 50, 22, 0.75)', borderColor: `${GOLD}25`, backdropFilter: 'blur(20px)' }}
                        >
                            <button type="button" onClick={() => setView('login')}
                                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-6 transition-colors"
                                style={{ color: `${GREEN}80` }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#F0EBD8')}
                                onMouseLeave={e => (e.currentTarget.style.color = `${GREEN}80`)}
                            >
                                <ArrowLeft size={14} /> Retour
                            </button>
                            <h2 className="text-xl font-black mb-2" style={{ color: '#F0EBD8' }}>Réinitialisation</h2>
                            <p className="text-xs mb-6" style={{ color: `${GREEN}90` }}>Entrez votre email pour recevoir un lien de réinitialisation.</p>
                            <form onSubmit={handleForgot} className="space-y-5">
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2" size={17} style={{ color: `${GREEN}70` }} />
                                    <input type="email" required value={forgotEmail}
                                        onChange={e => setForgotEmail(e.target.value)}
                                        placeholder="ceo@retourgagnant.bj"
                                        className="w-full rounded-xl py-4 pl-11 pr-4 text-sm outline-none"
                                        style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${GOLD}30`, color: '#F0EBD8' }}
                                    />
                                </div>
                                <button type="submit" disabled={isSending}
                                    className="w-full h-14 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                                    style={{ background: `linear-gradient(135deg, ${GOLD}, #B8860B)`, color: BG }}>
                                    {isSending ? <Loader2 className="animate-spin" size={20} /> : <Mail size={18} />}
                                    ENVOYER LE LIEN
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* ═══ SENT ═══ */}
                    {view === 'forgot-sent' && (
                        <motion.div key="sent"
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="rounded-3xl p-8 shadow-2xl border text-center"
                            style={{ background: 'rgba(20, 50, 22, 0.75)', borderColor: `${GREEN}40`, backdropFilter: 'blur(20px)' }}
                        >
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
                                style={{ background: `${GREEN}18`, border: `1px solid ${GREEN}40` }}>
                                <CheckCircle2 size={32} style={{ color: GREEN }} />
                            </div>
                            <h2 className="text-xl font-black mb-2" style={{ color: '#F0EBD8' }}>Lien Envoyé !</h2>
                            <p className="text-sm mb-6" style={{ color: `${GREEN}AA` }}>
                                Email envoyé à <span style={{ color: '#F0EBD8', fontWeight: 'bold' }}>{forgotEmail}</span>.
                            </p>
                            <button type="button" onClick={() => setView('login')}
                                className="text-[10px] font-bold uppercase tracking-widest transition-colors"
                                style={{ color: `${GOLD}70` }}>
                                ← Retour à la connexion
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Pied de page */}
                <div className="text-center mt-8">
                    <div className="flex justify-center gap-2 mb-3">
                        {[GREEN, YELLOW, RED].map((c, i) => (
                            <div key={i} className="w-6 h-1.5 rounded-full opacity-40" style={{ background: c }} />
                        ))}
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.35em]" style={{ color: `${GREEN}50` }}>
                        © {new Date().getFullYear()} Retour Gagnant Bénin · Accès Privé & Confidentiel
                    </p>
                </div>
            </motion.div>
        </div>
    )
}
