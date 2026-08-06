'use client';

import { useTranslation, T } from '@/lib/translation';
import { useState } from 'react';
import { useLogin, useForgotPassword } from '@refinedev/core';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Envelope as Mail, Lock, CircleNotch as Loader2, ArrowRight, ArrowLeft, CheckCircle as CheckCircle2 } from '@phosphor-icons/react';
import AuthBackdrop, { BrandSeal } from '@/components/auth/AuthBackdrop';

type View = 'login' | 'forgot' | 'forgot-sent';

export default function LoginPage() {
    const { t } = useTranslation();
    const [view, setView] = useState<View>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [forgotEmail, setForgotEmail] = useState('');

    const { mutate: login, isPending: isLoading } = useLogin();
    const { mutate: forgotPassword, isPending: isSending } = useForgotPassword();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        login({ email, password });
    };

    const handleForgot = (e: React.FormEvent) => {
        e.preventDefault();
        forgotPassword({ email: forgotEmail }, {
            onSuccess: () => setView('forgot-sent'),
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* L'arbre-réseau vu d'en haut : la vue d'ensemble, propre à l'administration. */}
            <AuthBackdrop
                tone="charcoal"
                image="/images/admin-login-bg.webp"
                imageAlt=""
                focus="center 45%"
            />

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-md relative z-10"
            >
                {/* Logo / Header */}
                <div className="text-center mb-9">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.08, duration: 0.55, ease: [0.34, 1.4, 0.64, 1] }}
                        className="mb-5"
                    >
                        <BrandSeal inner="#0D1524" size={80}>
                            <ShieldCheck size={34} strokeWidth={1.6} className="text-[#E8BE2A]" />
                        </BrandSeal>
                    </motion.div>
                    <h1 className="font-display text-[32px] leading-none text-[#F4F8FF] tracking-tight"><T>Administration</T></h1>
                    <p className="text-[#A9B4C7] mt-2.5 uppercase tracking-[0.28em] text-[9px] font-semibold"><T>Accès réservé au système</T></p>
                </div>

                <AnimatePresence mode="wait">
                    {/* ═══════════ LOGIN VIEW ═══════════ */}
                    {view === 'login' && (
                        <motion.div
                            key="login"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="bg-[#0F1728]/88 backdrop-blur-xl border border-[rgba(226,236,255,0.12)] rounded-3xl p-8 shadow-[0_28px_70px_-30px_rgba(0,0,0,0.85)] relative overflow-hidden"
                        >
                            <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-[#008751] via-[#FCD116] to-[#E8112D]" />
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-[#A9B4C7] uppercase tracking-widest ml-1"><T>Email Personnel</T></label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7C879E] group-focus-within:text-[#E8BE2A] transition-colors" size={18} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder={t("admin@retourgagnant.bj")}
                                            className="w-full bg-[#162034] border border-[rgba(226,236,255,0.12)] rounded-xl py-4 pl-12 pr-4 text-[#EAF0FA] placeholder:text-[#7C879E] focus:outline-none focus:border-[#E8BE2A] focus:ring-2 focus:ring-[#E8BE2A]/15 transition-all text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-xs font-bold text-[#A9B4C7] uppercase tracking-widest"><T>Mot de Passe</T></label>
                                        <button
                                            type="button"
                                            onClick={() => { setForgotEmail(email); setView('forgot'); }}
                                            className="text-[10px] text-[#E8BE2A] hover:text-[#F2CE55] transition-colors uppercase font-bold tracking-tighter"
                                        >
                                            Oublié ?
                                        </button>
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7C879E] group-focus-within:text-[#E8BE2A] transition-colors" size={18} />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-[#162034] border border-[rgba(226,236,255,0.12)] rounded-xl py-4 pl-12 pr-4 text-[#EAF0FA] placeholder:text-[#7C879E] focus:outline-none focus:border-[#E8BE2A] focus:ring-2 focus:ring-[#E8BE2A]/15 transition-all text-sm"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-[#E8BE2A] hover:bg-[#F2CE55] text-[#0D1524] font-bold h-14 rounded-xl flex items-center justify-center gap-2 shadow-[0_10px_26px_-12px_rgba(232,190,42,0.8)] hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    {isLoading ? (
                                        <Loader2 className="animate-spin" size={20} />
                                    ) : (
                                        <>
                                            <span className="tracking-[0.06em]"><T>S&apos;authentifier</T></span>
                                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* ═══════════ FORGOT PASSWORD VIEW ═══════════ */}
                    {view === 'forgot' && (
                        <motion.div
                            key="forgot"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-[#0F1728]/88 backdrop-blur-xl border border-[rgba(226,236,255,0.12)] rounded-3xl p-8 shadow-[0_28px_70px_-30px_rgba(0,0,0,0.85)] relative overflow-hidden"
                        >
                            <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-[#008751] via-[#FCD116] to-[#E8112D]" />
                            <button
                                type="button"
                                onClick={() => setView('login')}
                                className="flex items-center gap-2 text-[#A9B4C7] hover:text-[#EAF0FA] transition-colors text-xs font-bold uppercase tracking-wider mb-6"
                            >
                                <ArrowLeft size={14} /> Retour
                            </button>

                            <h2 className="text-xl font-black text-white mb-2"><T>Réinitialisation</T></h2>
                            <p className="text-[#A9B4C7] text-xs mb-6"><T>Entrez votre adresse email pour recevoir un lien de réinitialisation.</T></p>

                            <form onSubmit={handleForgot} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-[#A9B4C7] uppercase tracking-widest ml-1"><T>Email Personnel</T></label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7C879E] group-focus-within:text-[#E8BE2A] transition-colors" size={18} />
                                        <input
                                            type="email"
                                            required
                                            value={forgotEmail}
                                            onChange={(e) => setForgotEmail(e.target.value)}
                                            placeholder={t("admin@retourgagnant.bj")}
                                            className="w-full bg-[#162034] border border-[rgba(226,236,255,0.12)] rounded-xl py-4 pl-12 pr-4 text-[#EAF0FA] placeholder:text-[#7C879E] focus:outline-none focus:border-[#E8BE2A] focus:ring-2 focus:ring-[#E8BE2A]/15 transition-all text-sm"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSending}
                                    className="w-full bg-[#FCD116] text-black font-bold h-14 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-300 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSending ? <Loader2 className="animate-spin" size={20} /> : <Mail size={18} />}
                                    ENVOYER LE LIEN
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* ═══════════ CONFIRMATION VIEW ═══════════ */}
                    {view === 'forgot-sent' && (
                        <motion.div
                            key="sent"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-[#0f141e]/80 backdrop-blur-xl border border-[#008751]/20 rounded-3xl p-8 shadow-2xl text-center"
                        >
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#008751]/10 border border-[#008751]/20 mb-6">
                                <CheckCircle2 size={32} className="text-[#008751]" />
                            </div>
                            <h2 className="text-xl font-black text-white mb-2"><T>Lien Envoyé !</T></h2>
                            <p className="text-[#A9B4C7] text-sm mb-6">
                                Un email de réinitialisation a été envoyé à <span className="text-white font-bold">{forgotEmail}</span>.
                                Vérifiez votre boîte de réception (et les spams).
                            </p>
                            <button
                                type="button"
                                onClick={() => setView('login')}
                                className="text-[#FCD116]/70 hover:text-[#FCD116] text-xs font-bold uppercase tracking-widest transition-colors"
                            >
                                ← Retour à la connexion
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer Link */}
                <p className="text-center mt-8 text-[#8894A8] text-xs">
                    &copy; {new Date().getFullYear()} Retour Gagnant Bénin. <br /> Accès strictement réservé au personnel autorisé.
                </p>
            </motion.div>
        </div>
    );
}
