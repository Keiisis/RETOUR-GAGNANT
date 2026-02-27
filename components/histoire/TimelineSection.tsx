'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export interface TimelineItem {
    year: string
    title: string
    description: string
    highlight?: boolean
}

export function TimelineSection({ items }: { items: TimelineItem[] }) {
    return (
        <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent md:-translate-x-px" />

            <div className="space-y-16 md:space-y-24">
                {items.map((item, index) => {
                    const isEven = index % 2 === 0
                    return (
                        <motion.div
                            key={item.year}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-80px' }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className={`relative flex flex-col md:flex-row items-start md:items-center gap-8 ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'
                                }`}
                        >
                            {/* Connector dot */}
                            <div className="absolute left-6 md:left-1/2 w-3 h-3 rounded-full border-2 border-[#FCD116] bg-[#05080a] md:-translate-x-1.5 z-10 shadow-[0_0_10px_rgba(252,209,22,0.4)]" />

                            {/* Year badge */}
                            <div className={`md:w-1/2 ${isEven ? 'md:text-right md:pr-16' : 'md:text-left md:pl-16'} pl-16 md:pl-0`}>
                                <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-black tracking-[0.2em] uppercase border ${item.highlight
                                        ? 'bg-[#FCD116]/10 text-[#FCD116] border-[#FCD116]/30'
                                        : 'bg-white/5 text-gray-400 border-white/5'
                                    }`}>
                                    {item.year}
                                </span>
                            </div>

                            {/* Content card */}
                            <div className={`md:w-1/2 ${isEven ? 'md:pl-16' : 'md:pr-16'} pl-16 md:pl-0`}>
                                <div className={`relative p-6 rounded-2xl border transition-all duration-500 hover:border-white/10 ${item.highlight
                                        ? 'bg-[#FCD116]/5 border-[#FCD116]/20'
                                        : 'bg-white/[0.02] border-white/5'
                                    }`}>
                                    {item.highlight && (
                                        <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#FCD116]/50 to-transparent" />
                                    )}
                                    <h4 className="text-lg font-black text-white font-heading tracking-tight mb-2 flex items-center gap-2">
                                        {item.highlight && <ArrowRight size={16} className="text-[#FCD116]" />}
                                        {item.title}
                                    </h4>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        {item.description}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}
