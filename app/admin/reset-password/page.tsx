'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShieldCheck, Lock, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [sessionReady, setSessionReady] = useState(false);

    useEffect(() => {
        // Supabase envoie le token dans le hash : #access_token=...&type=recovery
        // onAuthStateChange gère automatiquement la session depuis le hash
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setSessionReady(true);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) {
            setErrorMsg('Les mots de passe ne correspondent pas.');
            setStatus('error');
            return;
        }
        if (password.length < 8) {
            setErrorMsg('Le mot de passe doit contenir au moins 8 caractères.');
            setStatus('error');
            return;
        }

        setLoading(true);
        setStatus('idle');

        const { error } = await supabase.auth.updateUser({ password });

        setLoading(false);

        if (error) {
            setErrorMsg(error.message);
            setStatus('error');
        } else {
            setStatus('success');
            setTimeout(() => router.push('/admin'), 3000);
        }
    };

    return (
        <div className="min-h-screen bg-[#05080a] flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 right-[-10%] w-[600px] h-[600px] bg-[#FCD116]/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#008751]/5 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-benin-gradient p-0.5 mb-6 shadow-2xl">
                        <div className="w-full h-full bg-[#05080a] rounded-[14px] flex items-center justify-center">
                            <ShieldCheck size={40} className="text-[#FCD116]" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-white font-heading">NOUVEAU MOT DE PASSE</h1>
                    <p className="text-gray-500 mt-2 uppercase tracking-[0.3em] text-[10px] font-bold">Réinitialisation Sécurisée</p>
                </div>

                {status === 'success' ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#0f141e]/80 backdrop-blur-xl border border-[#008751]/20 rounded-3xl p-8 shadow-2xl text-center"
                    >
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#008751]/10 border border-[#008751]/20 mb-6">
                            <CheckCircle2 size={32} className="text-[#008751]" />
                        </div>
                        <h2 className="text-xl font-black text-white mb-2">Mot de Passe Mis à Jour !</h2>
                        <p className="text-gray-500 text-sm">Redirection vers le dashboard dans quelques secondes...</p>
                    </motion.div>
                ) : (
                    <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl">
                        {!sessionReady && (
                            <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-medium">
                                En attente de validation du lien... Si vous venez d&apos;arriver via email, patientez un instant.
                            </div>
                        )}

                        <form onSubmit={handleReset} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Nouveau Mot de Passe</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#FCD116] transition-colors" size={18} />
                                    <input
                                        type={showPwd ? 'text' : 'password'}
                                        required
                                        minLength={8}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Minimum 8 caractères"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-12 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FCD116]/50 transition-all text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPwd((p) => !p)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                    >
                                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Confirmer le Mot de Passe</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#FCD116] transition-colors" size={18} />
                                    <input
                                        type={showPwd ? 'text' : 'password'}
                                        required
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        placeholder="Répétez le mot de passe"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FCD116]/50 transition-all text-sm"
                                    />
                                </div>
                            </div>

                            {status === 'error' && (
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                                    <AlertCircle size={16} className="shrink-0" />
                                    {errorMsg}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !sessionReady}
                                className="w-full bg-white text-black font-bold h-14 rounded-xl flex items-center justify-center gap-2 hover:bg-[#FCD116] transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <Lock size={18} />}
                                RÉINITIALISER
                            </button>
                        </form>
                    </div>
                )}

                <p className="text-center mt-8 text-gray-600 text-xs">
                    &copy; {new Date().getFullYear()} Retour Gagnant Bénin.
                </p>
            </motion.div>
        </div>
    );
}
