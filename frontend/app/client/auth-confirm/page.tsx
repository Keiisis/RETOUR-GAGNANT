'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { CheckCircle2, Loader2, Shield, ArrowRight, AlertCircle } from 'lucide-react'

export default function AuthConfirmPage() {
    const [status, setStatus] = useState<'loading' | 'verified' | 'no_session' | 'error'>('loading')
    const [countdown, setCountdown] = useState(3)

    useEffect(() => {
        const check = async () => {
            try {
                // Petite attente pour laisser Supabase traiter les tokens depuis le hash URL
                await new Promise(r => setTimeout(r, 800))

                const { data: { session } } = await supabase.auth.getSession()

                if (session) {
                    setStatus('verified')
                    // Countdown avant redirection automatique
                    let count = 3
                    const timer = setInterval(() => {
                        count--
                        setCountdown(count)
                        if (count <= 0) {
                            clearInterval(timer)
                            window.location.href = '/client/dashboard'
                        }
                    }, 1000)
                    return () => clearInterval(timer)
                } else {
                    // Pas de session : email confirmé mais pas connecté automatiquement
                    setStatus('no_session')
                }
            } catch {
                setStatus('error')
            }
        }

        check()
    }, [])

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
                className="w-full max-w-[420px] relative z-10 text-center"
            >
                {/* Logo */}
                <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[2px] mb-5 shadow-[0_0_40px_rgba(59,130,246,0.3)]"
                >
                    <div className="w-full h-full bg-nexus-deep rounded-[14px] flex items-center justify-center">
                        <Shield size={32} className="text-blue-400" />
                    </div>
                </motion.div>

                <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                    {/* Loading */}
                    {status === 'loading' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <Loader2 size={40} className="text-blue-400 animate-spin mx-auto" />
                            <p className="text-white font-bold text-lg">Vérification en cours...</p>
                            <p className="text-gray-500 text-sm">Votre compte est en train d'être confirmé.</p>
                        </motion.div>
                    )}

                    {/* Verified — session active */}
                    {status === 'verified' && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                                <CheckCircle2 size={32} className="text-emerald-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white mb-2">Compte vérifié !</h1>
                                <p className="text-gray-400 text-sm">
                                    Votre adresse email a été confirmée avec succès.<br />
                                    Bienvenue dans votre espace client.
                                </p>
                            </div>
                            <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-xl px-4 py-3">
                                <p className="text-emerald-400 text-sm font-bold">
                                    Redirection automatique dans <span className="text-white">{countdown}s</span>...
                                </p>
                            </div>
                            <Link href="/client/dashboard"
                                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold h-11 rounded-xl text-sm shadow-[0_4px_20px_rgba(59,130,246,0.3)] hover:shadow-[0_4px_24px_rgba(59,130,246,0.45)] transition-all">
                                Accéder à mon espace maintenant
                                <ArrowRight size={15} />
                            </Link>
                        </motion.div>
                    )}

                    {/* Email confirmé mais pas de session */}
                    {status === 'no_session' && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                            <div className="w-16 h-16 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center mx-auto">
                                <CheckCircle2 size={32} className="text-blue-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white mb-2">Email confirmé !</h1>
                                <p className="text-gray-400 text-sm">
                                    Votre adresse email a été vérifiée avec succès.<br />
                                    Connectez-vous maintenant pour accéder à votre espace.
                                </p>
                            </div>
                            <Link href="/client/login"
                                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold h-11 rounded-xl text-sm shadow-[0_4px_20px_rgba(59,130,246,0.3)] hover:shadow-[0_4px_24px_rgba(59,130,246,0.45)] transition-all">
                                Se connecter
                                <ArrowRight size={15} />
                            </Link>
                        </motion.div>
                    )}

                    {/* Erreur */}
                    {status === 'error' && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                            <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto">
                                <AlertCircle size={32} className="text-red-400" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-white mb-2">Lien expiré ou invalide</h1>
                                <p className="text-gray-400 text-sm">
                                    Ce lien de confirmation a peut-être expiré.<br />
                                    Connectez-vous pour en recevoir un nouveau.
                                </p>
                            </div>
                            <Link href="/client/login"
                                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold h-11 rounded-xl text-sm transition-all">
                                Aller à la connexion
                                <ArrowRight size={15} />
                            </Link>
                        </motion.div>
                    )}
                </div>

                <p className="text-center mt-5 text-gray-600 text-[10px]">
                    © {new Date().getFullYear()} Retour Gagnant Bénin — Espace Client Sécurisé
                </p>
            </motion.div>
        </div>
    )
}
