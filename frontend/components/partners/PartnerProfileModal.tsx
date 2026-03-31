'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X, MapPin, Mail, MessageCircle, Globe,
    Facebook, Instagram, Linkedin, Star, Phone,
    Store, ExternalLink, Building2,
} from 'lucide-react'
import Image from 'next/image'
import { CATEGORY_COLORS, DEFAULT_COLOR } from './PartnerCard'
import type { Partner } from './PartnerCard'
import { useTranslation, T } from '@/lib/translation'

interface PartnerProfileModalProps {
    partner: Partner | null
    onClose: () => void
}

export default function PartnerProfileModal({ partner, onClose }: PartnerProfileModalProps) {
    const { t } = useTranslation()

    // Lock scroll while open
    useEffect(() => {
        if (!partner) return
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [partner])

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    const colors = partner ? (CATEGORY_COLORS[partner.category] || DEFAULT_COLOR) : DEFAULT_COLOR
    const hasLogo = !!partner?.logo
    const hasCover = !!partner?.coverImage
    const initials = partner ? partner.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : ''
    const waNum = (partner?.whatsapp || partner?.phone || '').replace(/\D/g, '')

    return (
        <AnimatePresence>
            {partner && (
                <>
                    {/* ── BACKDROP ── */}
                    <motion.div
                        key="modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="fixed inset-0 z-[300] bg-black/65 backdrop-blur-[6px]"
                        onClick={onClose}
                    />

                    {/* ── MODAL ── */}
                    <motion.div
                        key="modal-panel"
                        initial={{ opacity: 0, scale: 0.92, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.93, y: 16 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                        className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="relative w-full max-w-[480px] bg-white rounded-[28px] overflow-hidden shadow-2xl pointer-events-auto flex flex-col"
                            style={{ maxHeight: 'calc(100dvh - 2rem)' }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Close button */}
                            <button
                                type="button"
                                title={t("Fermer")}
                                onClick={onClose}
                                className="absolute top-4 right-4 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-all shadow-md"
                            >
                                <X size={16} strokeWidth={2.5} />
                            </button>

                            {/* ── SCROLLABLE BODY ── */}
                            <div className="overflow-y-auto flex-1 overscroll-contain" style={{ scrollbarWidth: 'none' }}>

                                {/* COVER HEADER */}
                                <div className="relative h-[200px] flex-shrink-0">
                                    {hasCover ? (
                                        <Image
                                            src={partner.coverImage}
                                            alt={partner.name}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    ) : (
                                        <div
                                            className="absolute inset-0"
                                            style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}
                                        >
                                            <svg className="absolute inset-0 w-full h-full opacity-[0.09]" xmlns="http://www.w3.org/2000/svg">
                                                <defs>
                                                    <pattern id="modal-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                                                        <path d="M 28 0 L 0 0 0 28" fill="none" stroke="white" strokeWidth="0.7" />
                                                    </pattern>
                                                </defs>
                                                <rect width="100%" height="100%" fill="url(#modal-grid)" />
                                            </svg>
                                            <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full opacity-20"
                                                style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)' }} />
                                            <div className="absolute -bottom-8 right-8 w-36 h-36 rounded-full opacity-15"
                                                style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)' }} />
                                        </div>
                                    )}

                                    {/* Fade to white at bottom */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                                    {/* Premium badge */}
                                    {partner.isPremium && (
                                        <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FCD116] text-[#1a2332] shadow-md">
                                            <Star size={11} fill="currentColor" strokeWidth={0} />
                                            <span className="text-[11px] font-black uppercase tracking-wider"><T>Partenaire Premium</T></span>
                                        </div>
                                    )}
                                </div>

                                {/* AVATAR + IDENTITY */}
                                <div className="relative px-6 -mt-[38px] flex items-end gap-4 pb-0">
                                    <div className="relative flex-shrink-0 z-10">
                                        <div
                                            className="w-[76px] h-[76px] rounded-[18px] border-[4px] border-white shadow-xl overflow-hidden flex items-center justify-center text-white font-black text-2xl"
                                            style={hasLogo ? {} : { background: `linear-gradient(145deg, ${colors.from}, ${colors.to})` }}
                                        >
                                            {hasLogo
                                                ? <Image src={partner.logo} alt={partner.name} fill className="object-cover" unoptimized />
                                                : <span style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>{initials}</span>
                                            }
                                        </div>
                                        <div
                                            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-sm"
                                            style={{ background: colors.from }}
                                        >
                                            <svg viewBox="0 0 10 8" className="w-2.5 h-2.5">
                                                <polyline points="1,4 3.5,6.5 9,1.5" fill="none" stroke="white"
                                                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </div>
                                    </div>

                                    <div className="pb-2 flex-1 min-w-0">
                                        <h2 className="text-[20px] font-black text-[#1a2332] leading-tight truncate">
                                            {t(partner.name)}
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span
                                                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                                                style={{ background: `${colors.badge}ee`, color: colors.badgeText }}
                                            >
                                                {t(partner.category)}
                                            </span>
                                            <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                                <MapPin size={10} />{t(partner.location)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* CONTENT */}
                                <div className="px-6 pt-5 pb-7 space-y-6">

                                    {/* Description */}
                                    <p className="text-[14px] text-gray-600 leading-relaxed">
                                        {t(partner.description)}
                                    </p>

                                    {/* ── CONTACT CTA ── */}
                                    <div className="space-y-2.5">
                                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.25em]"><T>Contact direct</T></p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {partner.email && (
                                                <a
                                                    href={`mailto:${partner.email}`}
                                                    className="flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl border-2 border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-200 transition-all font-bold text-[13px] shadow-sm"
                                                >
                                                    <Mail size={16} strokeWidth={2} />
                                                    <span><T>Email</T></span>
                                                </a>
                                            )}
                                            {waNum && (
                                                <a
                                                    href={`https://wa.me/${waNum}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl border-2 border-green-100 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-200 transition-all font-bold text-[13px] shadow-sm"
                                                >
                                                    <MessageCircle size={16} strokeWidth={2} />
                                                    <span><T>WhatsApp</T></span>
                                                </a>
                                            )}
                                            {partner.phone && !waNum && (
                                                <a
                                                    href={`tel:${partner.phone}`}
                                                    className="flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all font-bold text-[13px]"
                                                >
                                                    <Phone size={16} strokeWidth={2} />
                                                    <span><T>Appeler</T></span>
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── SOCIAL / WEB LINKS ── */}
                                    {(partner.website || partner.facebook || partner.instagram || partner.linkedin) && (
                                        <div className="space-y-2.5">
                                            <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.25em]"><T>Retrouvez-nous</T></p>
                                            <div className="flex flex-wrap gap-2">
                                                {partner.website && (
                                                    <a href={partner.website} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 transition-all text-[12px] text-gray-500 font-medium shadow-sm">
                                                        <Globe size={13} /> Site web
                                                        <ExternalLink size={9} className="text-gray-300" />
                                                    </a>
                                                )}
                                                {partner.facebook && (
                                                    <a href={partner.facebook} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-100 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all text-[12px] text-gray-500 font-medium shadow-sm">
                                                        <Facebook size={13} /> Facebook
                                                    </a>
                                                )}
                                                {partner.instagram && (
                                                    <a href={partner.instagram} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-100 bg-white hover:bg-pink-50 hover:text-pink-600 hover:border-pink-100 transition-all text-[12px] text-gray-500 font-medium shadow-sm">
                                                        <Instagram size={13} /> Instagram
                                                    </a>
                                                )}
                                                {partner.linkedin && (
                                                    <a href={partner.linkedin} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-100 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-100 transition-all text-[12px] text-gray-500 font-medium shadow-sm">
                                                        <Linkedin size={13} /> LinkedIn
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── INFO ROW ── */}
                                    {(partner.location || partner.website || partner.phone) && (
                                        <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 space-y-2.5">
                                            {partner.location && (
                                                <div className="flex items-center gap-2.5 text-[12px] text-gray-500">
                                                    <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                                                    <span>{t(partner.location)}</span>
                                                </div>
                                            )}
                                            {partner.website && (
                                                <div className="flex items-center gap-2.5 text-[12px] text-gray-500">
                                                    <Globe size={13} className="text-gray-400 flex-shrink-0" />
                                                    <a href={partner.website} target="_blank" rel="noopener noreferrer"
                                                        className="hover:text-[#008751] transition-colors truncate">
                                                        {partner.website.replace(/^https?:\/\//, '')}
                                                    </a>
                                                </div>
                                            )}
                                            {partner.phone && (
                                                <div className="flex items-center gap-2.5 text-[12px] text-gray-500">
                                                    <Phone size={13} className="text-gray-400 flex-shrink-0" />
                                                    <a href={`tel:${partner.phone}`} className="hover:text-[#008751] transition-colors">
                                                        {partner.phone}
                                                    </a>
                                                </div>
                                            )}
                                            {partner.email && (
                                                <div className="flex items-center gap-2.5 text-[12px] text-gray-500">
                                                    <Mail size={13} className="text-gray-400 flex-shrink-0" />
                                                    <a href={`mailto:${partner.email}`} className="hover:text-[#008751] transition-colors truncate">
                                                        {partner.email}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ── VITRINE ── */}
                                    {partner.products.length > 0 && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Store size={13} className="text-gray-300" />
                                                <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.25em]">
                                                    <T>Vitrine</T> — {partner.products.length} {partner.products.length > 1 ? t('articles') : t('article')}
                                                </span>
                                                <div className="flex-1 h-px bg-gray-100" />
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                {partner.products.map(product => (
                                                    <div key={product.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                                                        {product.image ? (
                                                            <Image src={product.image} alt={product.name} fill className="object-cover" unoptimized />
                                                        ) : (
                                                            <div className="absolute inset-0 flex items-center justify-center p-1.5"
                                                                style={{ background: `linear-gradient(135deg, ${colors.from}15, ${colors.to}15)` }}>
                                                                <span className="text-[8px] text-gray-400 text-center font-medium leading-tight">{t(product.name)}</span>
                                                            </div>
                                                        )}
                                                        {product.price && (
                                                            <div className="absolute bottom-1 right-1 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-[8px] font-bold text-[#1a2332] shadow-sm">
                                                                {product.price}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Empty state when no products and no contact */}
                                    {partner.products.length === 0 && !partner.email && !waNum && (
                                        <div className="flex flex-col items-center gap-2 py-6 text-gray-300">
                                            <Building2 size={28} strokeWidth={1} />
                                            <p className="text-[12px] text-center"><T>Ce partenaire n&apos;a pas encore complété son profil.</T></p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
