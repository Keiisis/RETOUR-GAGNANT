'use client'

import { motion } from 'framer-motion'
import { MapPin, Mail, MessageCircle, Star, Globe, Store, ChevronRight, Phone } from 'lucide-react'
import Image from 'next/image'
import { useTranslation, T } from '@/lib/translation'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PartnerProduct {
    id: number
    name: string
    image: string
    price?: string
}

export interface Partner {
    id: number
    name: string
    description: string
    logo: string
    coverImage: string
    category: string
    location: string
    website?: string
    phone?: string
    email?: string
    whatsapp?: string
    facebook?: string
    instagram?: string
    linkedin?: string
    products: PartnerProduct[]
    isPremium?: boolean
}

// ─── Category palettes ────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, {
    from: string; to: string
    badge: string; badgeText: string
}> = {
    'Immobilier': { from: '#059669', to: '#0d9488', badge: '#ecfdf5', badgeText: '#065f46' },
    'Agro-Business': { from: '#65a30d', to: '#16a34a', badge: '#f7fee7', badgeText: '#365314' },
    'Art & Culture': { from: '#7c3aed', to: '#9333ea', badge: '#faf5ff', badgeText: '#581c87' },
    'Services & Tech': { from: '#2563eb', to: '#4f46e5', badge: '#eff6ff', badgeText: '#1e3a8a' },
    'Mode & Beauté': { from: '#db2777', to: '#e11d48', badge: '#fdf2f8', badgeText: '#831843' },
    'Tourisme & Hôtellerie': { from: '#ea580c', to: '#d97706', badge: '#fff7ed', badgeText: '#7c2d12' },
    'Santé & Bien-être': { from: '#0d9488', to: '#0891b2', badge: '#f0fdfa', badgeText: '#134e4a' },
    'Finance & Investissement': { from: '#d97706', to: '#ca8a04', badge: '#fffbeb', badgeText: '#78350f' },
    'Éducation & Formation': { from: '#4f46e5', to: '#2563eb', badge: '#eef2ff', badgeText: '#312e81' },
    'Commerce & Distribution': { from: '#0891b2', to: '#0284c7', badge: '#f0f9ff', badgeText: '#0c4a6e' },
}
export const DEFAULT_COLOR = { from: '#6b7280', to: '#4b5563', badge: '#f9fafb', badgeText: '#374151' }

// ─── Component ────────────────────────────────────────────────────────────────

interface PartnerCardProps {
    partner: Partner
    onClick?: () => void
}

export default function PartnerCard({ partner, onClick }: PartnerCardProps) {
    const { t } = useTranslation()
    const colors = CATEGORY_COLORS[partner.category] || DEFAULT_COLOR
    const hasLogo = !!partner.logo
    const hasCover = !!partner.coverImage
    const initials = partner.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    const waNum = (partner.whatsapp || partner.phone || '').replace(/\D/g, '')

    return (
        <motion.article
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            whileHover={{ y: -6 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="group relative bg-white rounded-[22px] overflow-hidden flex flex-col cursor-pointer"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.03)' }}
            onClick={onClick}
        >
            {/* ── COVER ── */}
            <div className="relative h-[148px] overflow-hidden">
                {hasCover ? (
                    <Image
                        src={partner.coverImage}
                        alt={partner.name}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                        unoptimized
                    />
                ) : (
                    <div
                        className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.06]"
                        style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}
                    >
                        {/* Geometric grid */}
                        <svg className="absolute inset-0 w-full h-full opacity-[0.10]" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id={`g-${partner.id}`} width="28" height="28" patternUnits="userSpaceOnUse">
                                    <path d="M 28 0 L 0 0 0 28" fill="none" stroke="white" strokeWidth="0.7" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill={`url(#g-${partner.id})`} />
                        </svg>
                        {/* Glow blobs */}
                        <div className="absolute -top-10 -left-10 w-36 h-36 rounded-full opacity-25"
                            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 70%)' }} />
                        <div className="absolute -bottom-8 -right-8 w-28 h-28 rounded-full opacity-20"
                            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.45) 0%, transparent 70%)' }} />
                    </div>
                )}

                {/* Bottom fade */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

                {/* Premium badge */}
                {partner.isPremium && (
                    <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FCD116] text-[#1a2332] shadow-sm">
                        <Star size={9} fill="currentColor" strokeWidth={0} />
                        <span className="text-[9px] font-black uppercase tracking-widest"><T>Premium</T></span>
                    </div>
                )}

                {/* Category pill */}
                <div
                    className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm shadow-sm"
                    style={{ background: `${colors.badge}e0`, color: colors.badgeText }}
                >
                    {t(partner.category)}
                </div>
            </div>

            {/* ── AVATAR STRIP ── */}
            <div className="relative px-5 -mt-7 flex items-end gap-3">
                {/* Logo / initials avatar */}
                <div className="relative flex-shrink-0 z-10">
                    <div
                        className="w-[56px] h-[56px] rounded-[14px] border-[3px] border-white shadow-md overflow-hidden flex items-center justify-center text-white font-black text-lg"
                        style={hasLogo ? {} : { background: `linear-gradient(145deg, ${colors.from}, ${colors.to})` }}
                    >
                        {hasLogo
                            ? <Image src={partner.logo} alt={partner.name} fill className="object-cover" unoptimized />
                            : <span style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>{initials}</span>
                        }
                    </div>
                    {/* Checkmark dot */}
                    <div
                        className="absolute -bottom-0.5 -right-0.5 w-[16px] h-[16px] rounded-full border-2 border-white flex items-center justify-center"
                        style={{ background: colors.from }}
                    >
                        <svg viewBox="0 0 10 8" className="w-[7px] h-[7px]">
                            <polyline points="1,4 3.5,6.5 9,1.5" fill="none" stroke="white"
                                strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>

                {/* Name + location */}
                <div className="pb-2 min-w-0 flex-1">
                    <h3 className="font-black text-[#1a2332] text-[15px] leading-tight truncate group-hover:text-[#008751] transition-colors duration-200">
                        {t(partner.name)}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <MapPin size={9} className="text-gray-400 flex-shrink-0" />
                        <span className="text-[11px] text-gray-400 truncate">{t(partner.location)}</span>
                        {partner.website && <Globe size={9} className="text-gray-300 flex-shrink-0 ml-0.5" />}
                    </div>
                </div>
            </div>

            {/* ── BODY ── */}
            <div className="px-5 pt-3 pb-5 flex-1 flex flex-col gap-3.5">
                {/* Description */}
                <p className="text-[13px] text-gray-500 leading-relaxed line-clamp-2">
                    {t(partner.description)}
                </p>

                {/* Product vitrine */}
                {partner.products.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Store size={9} className="text-gray-300" />
                            <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.22em]"><T>Vitrine</T></span>
                            <div className="flex-1 h-px bg-gray-100" />
                            <span className="text-[9px] text-gray-300">{partner.products.length} {partner.products.length > 1 ? t('articles') : t('article')}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {partner.products.slice(0, 3).map(product => (
                                <div key={product.id} className="relative aspect-square rounded-[10px] overflow-hidden bg-gray-50">
                                    {product.image
                                        ? <Image src={product.image} alt={product.name} fill className="object-cover" unoptimized />
                                        : <div className="absolute inset-0 flex items-center justify-center p-1"
                                            style={{ background: `linear-gradient(135deg, ${colors.from}1a, ${colors.to}1a)` }}>
                                            <span className="text-[8px] text-gray-400 text-center font-medium leading-tight">{t(product.name)}</span>
                                        </div>
                                    }
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100">
                                        <span className="text-[8px] text-white font-bold px-1 text-center leading-tight">{t(product.name)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── CTA BUTTONS ── */}
                <div className="mt-auto pt-3 border-t border-gray-50 grid grid-cols-3 gap-2">
                    {/* Email or Phone */}
                    {partner.email ? (
                        <a
                            href={`mailto:${partner.email}`}
                            onClick={e => e.stopPropagation()}
                            title={`Email : ${partner.email}`}
                            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-[12px] border border-gray-100 text-gray-400 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                            <Mail size={14} />
                            <span className="text-[9px] font-bold"><T>Email</T></span>
                        </a>
                    ) : partner.phone ? (
                        <a
                            href={`tel:${partner.phone}`}
                            onClick={e => e.stopPropagation()}
                            title={`Appeler : ${partner.phone}`}
                            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-[12px] border border-gray-100 text-gray-400 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                            <Phone size={14} />
                            <span className="text-[9px] font-bold"><T>Appeler</T></span>
                        </a>
                    ) : (
                        <div className="rounded-[12px] bg-gray-50/50" />
                    )}

                    {/* WhatsApp */}
                    {waNum ? (
                        <a
                            href={`https://wa.me/${waNum}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            title={`WhatsApp : ${partner.whatsapp || partner.phone}`}
                            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-[12px] border border-gray-100 text-gray-400 hover:border-green-200 hover:text-green-600 hover:bg-green-50 transition-all"
                        >
                            <MessageCircle size={14} />
                            <span className="text-[9px] font-bold"><T>WhatsApp</T></span>
                        </a>
                    ) : (
                        <div className="rounded-[12px] bg-gray-50/50" />
                    )}

                    {/* Voir profil */}
                    <button
                        type="button"
                        title={`Voir le profil de ${partner.name}`}
                        className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-[12px] text-white text-[9px] font-bold transition-all hover:opacity-90 hover:shadow-md active:scale-95"
                        style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}
                    >
                        <ChevronRight size={14} />
                        <span><T>Profil</T></span>
                    </button>
                </div>
            </div>
        </motion.article>
    )
}
