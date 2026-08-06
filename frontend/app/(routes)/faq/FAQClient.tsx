'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CaretDown as ChevronDown, Question as HelpCircle, MagnifyingGlass as Search, ChatCircle as MessageCircle } from '@phosphor-icons/react';
import Link from 'next/link'
import { useTranslation, T } from '@/lib/translation'

interface FAQItem {
    q: string
    a: string
}

function FAQAccordion({ item, index, isOpen, toggle }: { item: FAQItem; index: number; isOpen: boolean; toggle: () => void }) {
    const { t } = useTranslation()
    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
        >
            <button
                onClick={toggle}
                className="w-full flex items-center justify-between gap-4 p-5 md:p-6 text-left"
            >
                <span className="font-semibold text-[#1a2332] text-sm md:text-base pr-4">{t(item.q)}</span>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${isOpen ? 'bg-[#008751] text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                    <ChevronDown size={16} />
                </motion.div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 md:px-6 pb-5 md:pb-6">
                            <div className="h-px bg-gray-100 mb-4" />
                            <p className="text-gray-600 text-sm leading-relaxed">{t(item.a)}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

export default function FAQClient({ items }: { items: FAQItem[] }) {
    const { t } = useTranslation()
    const [openIndex, setOpenIndex] = useState<number | null>(0)
    const [search, setSearch] = useState('')

    const filtered = items.filter(item =>
        item.q.toLowerCase().includes(search.toLowerCase()) ||
        item.a.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero */}
            <section className="py-16 md:py-24 bg-gradient-to-br from-[#0f141e] via-[#1a2a3a] to-[#0f141e] text-white">
                <div className="container mx-auto px-4 text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6 border border-white/10">
                            <HelpCircle className="text-[#FCD116]" size={30} />
                        </div>
                        <h1 className="text-3xl md:text-5xl font-bold font-heading mb-4">
                            <T>Questions Fréquentes</T>
                        </h1>
                        <p className="text-white/60 max-w-xl mx-auto text-base md:text-lg">
                            <T>Trouvez rapidement les réponses à vos questions sur nos services</T>
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Content */}
            <div className="container mx-auto px-4 py-12 md:py-16 max-w-3xl">
                {/* Search */}
                <div className="relative mb-8">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("Rechercher une question...")}
                        className="w-full bg-white border border-gray-200 rounded-2xl py-3.5 pl-12 pr-4 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#008751] focus:ring-1 focus:ring-[#008751] text-sm shadow-sm"
                    />
                </div>

                {/* FAQ Items */}
                <div className="space-y-3">
                    {filtered.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <HelpCircle className="mx-auto mb-3 text-gray-200" size={40} />
                            <p className="text-sm"><T>Aucun résultat trouvé</T></p>
                        </div>
                    ) : (
                        filtered.map((item, i) => (
                            <FAQAccordion
                                key={i}
                                item={item}
                                index={i}
                                isOpen={openIndex === i}
                                toggle={() => setOpenIndex(openIndex === i ? null : i)}
                            />
                        ))
                    )}
                </div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-12 text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-8"
                >
                    <MessageCircle className="mx-auto text-[#008751] mb-4" size={32} />
                    <h3 className="text-lg font-bold text-[#1a2332] mb-2">
                        <T>Vous n&apos;avez pas trouvé votre réponse ?</T>
                    </h3>
                    <p className="text-gray-500 text-sm mb-6">
                        <T>Notre équipe est disponible pour vous aider.</T>
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link
                            href="/contact"
                            className="bg-[#008751] hover:bg-[#006B40] text-white font-bold text-sm py-3 px-6 rounded-xl transition-colors"
                        >
                            <T>Nous contacter</T>
                        </Link>
                        <Link
                            href="/rendez-vous"
                            className="bg-[#1a2332] hover:bg-[#2c3b55] text-white font-bold text-sm py-3 px-6 rounded-xl transition-colors"
                        >
                            <T>Prendre rendez-vous</T>
                        </Link>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
