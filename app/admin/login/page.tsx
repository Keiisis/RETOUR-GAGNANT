'use client';

import { useState } from 'react';
import { useLogin, useForgotPassword } from '@refinedev/core';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Mail, Lock, Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';

type View = 'login' | 'forgot' | 'forgot-sent';

export default function LoginPage() {
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
        <div className="min-h-screen bg-[#05080a] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 right-[-10%] w-[600px] h-[600px] bg-[#FCD116]/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#008751]/5 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-md relative z-10"
            >
                {/* Logo / Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-benin-gradient p-0.5 mb-6 shadow-2xl">
                        <div className="w-full h-full bg-[#05080a] rounded-[14px] flex items-center justify-center">
                            <ShieldCheck size={40} className="text-[#FCD116]" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-white font-heading">KAGE ADMIN</h1>
                    <p className="text-gray-500 mt-2 uppercase tracking-[0.3em] text-[10px] font-bold">Système Sécurisé</p>
                </div>

                <AnimatePresence mode="wait">
                    {/* ═══════════ LOGIN VIEW ═══════════ */}
                    {view === 'login' && (
                        <motion.div
                            key="login"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="bg-[#0f141e]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl"
                        >
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Email Personnel</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#FCD116] transition-colors" size={18} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="admin@retourgagnant.bj"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FCD116]/50 transition-all text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Mot de Passe</label>
                                        <button
                                            type="button"
                                            onClick={() => { setForgotEmail(email); setView('forgot'); }}
                                            className="text-[10px] text-[#FCD116]/60 hover:text-[#FCD116] transition-colors uppercase font-bold tracking-tighter"
                                        >
                                            Oublié ?
                                        </button>
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#FCD116] transition-colors" size={18} />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FCD116]/50 transition-all text-sm"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-white text-black font-bold h-14 rounded-xl flex items-center justify-center gap-2 hover:bg-[#FCD116] transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    {isLoading ? (
                                        <Loader2 className="animate-spin" size={20} />
                                    ) : (
                                        <>
                                            <span>S&apos;AUTHENTIFIER</span>
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
                            className="bg-[#0f141e]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl"
                        >
                            <button
                                type="button"
                                onClick={() => setView('login')}
                                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider mb-6"
                            >
                                <ArrowLeft size={14} /> Retour
                            </button>

                            <h2 className="text-xl font-black text-white mb-2">Réinitialisation</h2>
                            <p className="text-gray-500 text-xs mb-6">Entrez votre adresse email pour recevoir un lien de réinitialisation.</p>

                            <form onSubmit={handleForgot} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Email Personnel</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#FCD116] transition-colors" size={18} />
                                        <input
                                            type="email"
                                            required
                                            value={forgotEmail}
                                            onChange={(e) => setForgotEmail(e.target.value)}
                                            placeholder="admin@retourgagnant.bj"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FCD116]/50 transition-all text-sm"
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
                            <h2 className="text-xl font-black text-white mb-2">Lien Envoyé !</h2>
                            <p className="text-gray-500 text-sm mb-6">
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
                <p className="text-center mt-8 text-gray-600 text-xs">
                    &copy; {new Date().getFullYear()} Retour Gagnant Bénin. <br /> Accès strictement réservé au personnel autorisé.
                </p>
            </motion.div>
        </div>
    );
}
