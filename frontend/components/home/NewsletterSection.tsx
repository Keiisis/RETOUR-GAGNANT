'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ArrowRight, CheckCircle, Loader2 } from 'lucide-react'

export default function NewsletterSection() {
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) return

        setStatus('loading')
        try {
            const res = await fetch('/api/newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })
            if (res.ok) {
                setStatus('success')
                setEmail('')
            } else {
                setStatus('error')
            }
        } catch {
            setStatus('error')
        }
    }

    return (
        <section className="py-16 bg-gradient-to-br from-[#008751] to-[#006B40] relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FCD116]/10 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="container mx-auto px-4 relative z-10">
                <div className="max-w-2xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/20">
                            <Mail className="text-[#FCD116]" size={26} />
                        </div>

                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                            Restez informé de nos actualités
                        </h2>
                        <p className="text-white/70 text-sm md:text-base mb-8 max-w-lg mx-auto">
                            Recevez nos guides, conseils et opportunités d&apos;investissement directement dans votre boîte mail. Pas de spam, que du contenu utile.
                        </p>

                        <AnimatePresence mode="wait">
                            {status === 'success' ? (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center justify-center gap-3 text-white bg-white/15 rounded-2xl py-4 px-6 backdrop-blur-sm border border-white/20"
                                >
                                    <CheckCircle className="text-[#FCD116]" size={22} />
                                    <span className="font-semibold text-sm">Merci ! Vous êtes inscrit à notre newsletter.</span>
                                </motion.div>
                            ) : (
                                <motion.form
                                    key="form"
                                    onSubmit={handleSubmit}
                                    className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
                                >
                                    <div className="relative flex-1">
                                        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Votre adresse email"
                                            className="w-full bg-white rounded-xl py-3.5 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FCD116] shadow-lg"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={status === 'loading'}
                                        className="bg-[#FCD116] hover:bg-[#e5c000] text-[#1a2332] font-bold text-sm py-3.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 whitespace-nowrap"
                                    >
                                        {status === 'loading' ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <>
                                                S&apos;inscrire
                                                <ArrowRight size={16} />
                                            </>
                                        )}
                                    </button>
                                </motion.form>
                            )}
                        </AnimatePresence>

                        {status === 'error' && (
                            <p className="text-[#FCD116] text-xs mt-3">
                                Une erreur est survenue. Réessayez.
                            </p>
                        )}

                        <p className="text-white/40 text-xs mt-4">
                            En vous inscrivant, vous acceptez notre{' '}
                            <a href="/confidentialite" className="underline hover:text-white/60">politique de confidentialité</a>.
                        </p>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
