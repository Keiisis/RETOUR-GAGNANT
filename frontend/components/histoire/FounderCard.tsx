'use client'

import { motion } from 'framer-motion'
import { Quotes as Quote } from '@phosphor-icons/react';
import Image from 'next/image'
import { useTranslation } from '@/lib/translation'

export interface FounderData {
    name: string
    role: string
    quote: string
    image?: string
}

export function FounderCard({ founder, index }: { founder: FounderData, index: number }) {
    const { t } = useTranslation();
    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7, delay: index * 0.15 }}
            className="group relative bg-[#0a0f18] border border-white/5 rounded-[2rem] overflow-hidden hover:border-[#FCD116]/30 transition-all duration-500"
        >
            {/* Glow effect on hover */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#FCD116]/5 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            {/* Photo area */}
            <div className="relative h-72 bg-gradient-to-b from-[#0a0f18] to-[#05080a] overflow-hidden">
                {founder.image ? (
                    <Image
                        src={founder.image}
                        alt={t(founder.name)}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="w-28 h-28 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                            <span className="text-4xl font-black text-[#FCD116]/30 font-heading">
                                {founder.name.charAt(0)}
                            </span>
                        </div>
                    </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f18] via-transparent to-transparent" />
            </div>

            {/* Info */}
            <div className="relative z-10 p-8 -mt-12">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-[2px] bg-[#FCD116]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FCD116]">{t(founder.role)}</span>
                </div>
                <h3 className="text-2xl font-black text-white font-heading tracking-tight mb-4">
                    {founder.name}
                </h3>

                {/* Quote */}
                <div className="relative pl-6 border-l-2 border-white/10">
                    <Quote size={16} className="absolute -left-2 -top-1 text-[#FCD116]/40 bg-[#0a0f18]" />
                    <p className="text-sm text-gray-400 italic leading-relaxed">
                        {t(founder.quote)}
                    </p>
                </div>
            </div>
        </motion.div>
    )
}
