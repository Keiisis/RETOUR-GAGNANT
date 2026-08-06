'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cookie, X, Check } from '@phosphor-icons/react'
import Link from 'next/link'

export default function CookieConsent() {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const consent = localStorage.getItem('rg_cookie_consent')
        if (!consent) {
            const timer = setTimeout(() => setVisible(true), 2000)
            return () => clearTimeout(timer)
        }
    }, [])

    const accept = () => {
        localStorage.setItem('rg_cookie_consent', 'accepted')
        setVisible(false)
    }

    const refuse = () => {
        localStorage.setItem('rg_cookie_consent', 'refused')
        setVisible(false)
    }

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-[9999]"
                >
                    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] border border-gray-100 p-5 relative overflow-hidden">
                        {/* Flag accent */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />

                        <button
                            onClick={refuse}
                            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                            aria-label="Fermer"
                        >
                            <X size={14} className="text-gray-500" />
                        </button>

                        <div className="flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-[#FCD116]/15 flex items-center justify-center shrink-0 mt-0.5">
                                <Cookie className="text-[#c9a800]" size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-[#1a2332] text-sm mb-1">
                                    Ce site utilise des cookies
                                </h3>
                                <p className="text-gray-500 text-xs leading-relaxed mb-4">
                                    Nous utilisons des cookies pour améliorer votre expérience et analyser le trafic.{' '}
                                    <Link href="/confidentialite" className="text-[#008751] hover:underline font-medium">
                                        En savoir plus
                                    </Link>
                                </p>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={accept}
                                        className="flex-1 bg-[#008751] hover:bg-[#006B40] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <Check size={14} />
                                        Accepter
                                    </button>
                                    <button
                                        onClick={refuse}
                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2.5 px-4 rounded-xl transition-colors"
                                    >
                                        Refuser
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
