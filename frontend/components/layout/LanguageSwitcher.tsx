'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation, SUPPORTED_LANGUAGES, type LangCode } from '@/lib/translation'

// ═══════════════════════════════════════════════════════
// Language Switcher Component
// ═══════════════════════════════════════════════════════

export function LanguageSwitcher({ className }: { className?: string }) {
    const { t, lang, setLang } = useTranslation()
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === lang) || SUPPORTED_LANGUAGES[0]

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelect = (code: LangCode) => {
        setLang(code)
        setIsOpen(false)
    }

    return (
        <div className={cn("relative z-50", className)} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-3 py-1.5 xl:px-4 xl:py-2 transition-colors duration-300"
                aria-label={t("Changer de langue")}
            >
                <div className="flex items-center gap-1.5 md:gap-2">
                    <Globe size={14} className="text-white/70 hidden sm:block" />
                    <span className="text-sm xl:text-base leading-none translate-y-[1px]">{currentLang.flag}</span>
                    <span className="text-[10px] xl:text-xs font-bold text-white uppercase tracking-wider hidden lg:block">
                        {currentLang.code}
                    </span>
                </div>
                <ChevronDown
                    size={14}
                    className={cn(
                        "text-white/50 transition-transform duration-300",
                        isOpen && "rotate-180 text-white"
                    )}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute top-12 right-0 bg-[#0A0F14]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden min-w-[180px]"
                    >
                        <div className="py-2">
                            {SUPPORTED_LANGUAGES.map((l) => (
                                <button
                                    key={l.code}
                                    onClick={() => handleSelect(l.code as LangCode)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5 group",
                                        lang === l.code ? "bg-white/5" : ""
                                    )}
                                >
                                    <span className="text-xl leading-none">{l.flag}</span>
                                    <div className="flex flex-col">
                                        <span className={cn(
                                            "text-[13px] font-bold transition-colors",
                                            lang === l.code ? "text-[#FCD116]" : "text-white group-hover:text-white"
                                        )}>
                                            {l.nativeLabel}
                                        </span>
                                        <span className="text-[10px] text-white/40 uppercase tracking-widest">
                                            {l.code}
                                        </span>
                                    </div>

                                    {lang === l.code && (
                                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FCD116] shadow-[0_0_8px_rgba(252,209,22,0.8)]" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
