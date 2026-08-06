'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WhatsappLogo, X } from '@phosphor-icons/react'
import { COMPANY_INFO } from '@/lib/constants/company-info'

export default function WhatsAppButton() {
    const [tooltip, setTooltip] = useState(false)

    return (
        <div className="fixed bottom-6 left-6 z-[998] flex flex-col items-start gap-3">
            {/* Tooltip */}
            <AnimatePresence>
                {tooltip && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 max-w-[260px] relative"
                    >
                        <button
                            onClick={() => setTooltip(false)}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors"
                        >
                            <X size={12} className="text-gray-400" />
                        </button>
                        <p className="text-sm font-semibold text-[#1a2332] mb-1">
                            Besoin d&apos;aide ? 
                        </p>
                        <p className="text-xs text-gray-500 mb-3">
                            Discutez directement avec notre équipe sur WhatsApp.
                        </p>
                        <div className="flex flex-col gap-2">
                            <a
                                href={COMPANY_INFO.whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-bold text-[#008751] bg-[#008751]/10 hover:bg-[#008751]/20 py-2 px-3 rounded-lg transition-colors text-center"
                            >
                                 {COMPANY_INFO.phoneDisplay}
                            </a>
                            <a
                                href={COMPANY_INFO.whatsapp2Link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-bold text-[#008751] bg-[#008751]/10 hover:bg-[#008751]/20 py-2 px-3 rounded-lg transition-colors text-center"
                            >
                                 {COMPANY_INFO.phone2Display}
                            </a>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FAB */}
            <motion.button
                onClick={() => setTooltip(!tooltip)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white shadow-[0_4px_20px_rgba(37,211,102,0.4)] flex items-center justify-center transition-colors relative"
                aria-label="Contacter sur WhatsApp"
            >
                {/* Pulse ring */}
                <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30" />
                <WhatsappLogo size={26} className="relative z-10 fill-white" />
            </motion.button>
        </div>
    )
}
