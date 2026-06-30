'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Home, ArrowLeft, Search, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f141e] via-[#1a2a3a] to-[#0f141e] text-white flex items-center justify-center px-4 relative overflow-hidden">
            {/* Decorative blurs */}
            <div className="absolute top-20 right-20 w-72 h-72 rounded-full bg-[#008751]/20 blur-[120px]" />
            <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full bg-[#FCD116]/15 blur-[120px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-[#E8112D]/10 blur-[150px]" />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center max-w-lg relative z-10"
            >
                {/* 404 Number */}
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
                    className="mb-6"
                >
                    <span className="text-[10rem] md:text-[12rem] font-black leading-none tracking-tighter bg-gradient-to-b from-white via-white/80 to-white/20 bg-clip-text text-transparent select-none">
                        404
                    </span>
                </motion.div>

                {/* Flag divider */}
                <div className="flex justify-center gap-0 mb-8">
                    <div className="w-16 h-1.5 bg-[#008751] rounded-l-full" />
                    <div className="w-16 h-1.5 bg-[#FCD116]" />
                    <div className="w-16 h-1.5 bg-[#E8112D] rounded-r-full" />
                </div>

                <h1 className="text-2xl md:text-3xl font-bold mb-3">
                    Page introuvable
                </h1>
                <p className="text-white/60 mb-10 text-base md:text-lg">
                    La page que vous recherchez n&apos;existe pas ou a été déplacée. Pas de panique, nous allons vous guider.
                </p>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link href="/">
                        <Button size="lg" className="bg-[#008751] hover:bg-[#006B40] text-white rounded-full px-8 h-12 gap-2 shadow-lg shadow-[#008751]/20">
                            <Home size={18} />
                            Retour à l&apos;accueil
                        </Button>
                    </Link>
                    <Link href="/services">
                        <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-full px-8 h-12 gap-2">
                            <Search size={18} />
                            Nos services
                        </Button>
                    </Link>
                </div>

                {/* Quick links */}
                <div className="mt-12 flex flex-wrap justify-center gap-3">
                    {[
                        { label: 'Contact', href: '/contact', icon: HelpCircle },
                        { label: 'Rendez-vous', href: '/rendez-vous', icon: ArrowLeft },
                    ].map(({ label, href, icon: Icon }) => (
                        <Link
                            key={label}
                            href={href}
                            className="text-sm text-white/40 hover:text-[#FCD116] transition-colors flex items-center gap-1.5"
                        >
                            <Icon size={14} />
                            {label}
                        </Link>
                    ))}
                </div>
            </motion.div>
        </div>
    )
}
