'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X, MapPin, Mail, MessageCircle, Globe, Store,
    Star, Phone, ExternalLink, Clock, Sparkles,
} from 'lucide-react'

// Brand icons (lucide deprecated these — inline SVGs instead)
const IconFacebook = ({ size = 13 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
)
const IconInstagram = ({ size = 13 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
    </svg>
)
const IconLinkedin = ({ size = 13 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
        <rect x="2" y="9" width="4" height="12"/>
        <circle cx="4" cy="4" r="2"/>
    </svg>
)
import Image from 'next/image'
import type { Partner } from './PartnerCard'
import { CATEGORY_COLORS, DEFAULT_COLOR } from './PartnerCard'

interface PartnerProfileModalProps {
    partner: Partner | null
    onClose: () => void
}

export default function PartnerProfileModal({ partner, onClose }: PartnerProfileModalProps) {
    // Lock body scroll while open
    useEffect(() => {
        if (partner) document.body.style.overflow = 'hidden'
        else document.body.style.overflow = ''
        return () => { document.body.style.overflow = '' }
    }, [partner])

    // Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    const colors  = partner ? (CATEGORY_COLORS[partner.category] || DEFAULT_COLOR) : DEFAULT_COLOR
    const hasLogo = !!partner?.logo
    const hasCover = !!partner?.coverImage
    const initials = partner ? partner.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : ''
    const waNum   = ((partner?.whatsapp || partner?.phone) ?? '').replace(/\D/g, '')

    return (
        <AnimatePresence>
            {partner && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        key="modal"
                        initial={{ opacity: 0, scale: 0.94, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 24 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <article
                            className="relative w-full max-w-lg bg-white rounded-[28px] overflow-hidden shadow-2xl pointer-events-auto flex flex-col"
                            style={{ maxHeight: '90vh' }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* ── COVER ── */}
                            <div className="relative h-52 flex-shrink-0">
                                {hasCover ? (
                                    <Image src={partner.coverImage} alt={partner.name} fill
                                        className="object-cover" unoptimized priority/>
                                ) : (
                                    <div className="absolute inset-0"
                                        style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}>
                                        <svg className="absolute inset-0 w-full h-full opacity-[0.09]" xmlns="http://www.w3.org/2000/svg">
                                            <defs><pattern id="mp-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                                                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.8"/>
                                            </pattern></defs>
                                            <rect width="100%" height="100%" fill="url(#mp-grid)"/>
                                        </svg>
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-15"
                                            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)' }}/>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent"/>

                                {/* Badges */}
                                {partner.isPremium
                                    ? <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FCD116] text-[#1a2332] shadow-md">
                                        <Star size={11} fill="currentColor" strokeWidth={0}/>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Partenaire Premium</span>
                                    </div>
                                    : <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-sm"
                                        style={{ background: `${colors.badge}e0`, color: colors.badgeText }}>
                                        {partner.category}
                                    </div>
                                }

                                {/* Close */}
                                <button type="button" title="Fermer" onClick={onClose}
                                    className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-all">
                                    <X size={16}/>
                                </button>
                            </div>

                            {/* ── SCROLLABLE BODY ── */}
                            <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin' }}>

                                {/* Avatar + Name */}
                                <div className="relative px-6 -mt-10 flex items-end gap-4">
                                    <div className="relative flex-shrink-0 z-10">
                                        <div
                                            className="w-20 h-20 rounded-[18px] border-[4px] border-white shadow-xl overflow-hidden flex items-center justify-center text-white font-black text-2xl"
                                            style={hasLogo ? {} : { background: `linear-gradient(145deg, ${colors.from}, ${colors.to})` }}
                                        >
                                            {hasLogo
                                                ? <Image src={partner.logo} alt={partner.name} fill className="object-cover" unoptimized/>
                                                : <span style={{ textShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>{initials}</span>
                                            }
                                        </div>
                                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-sm"
                                            style={{ background: colors.from }}>
                                            <svg viewBox="0 0 10 8" className="w-2.5 h-2.5">
                                                <polyline points="1,4 3.5,6.5 9,1.5" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="pb-2 flex-1 min-w-0">
                                        <h2 className="text-xl font-black text-[#1a2332] leading-tight truncate">{partner.name}</h2>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                style={{ background: `${colors.badge}cc`, color: colors.badgeText }}>
                                                {partner.category}
                                            </span>
                                            <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                                <MapPin size={10}/>{partner.location}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-6 pt-4 pb-7 space-y-5">
                                    {/* Description */}
                                    <p className="text-[14px] text-gray-600 leading-relaxed">{partner.description}</p>

                                    {/* Contact CTAs */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {partner.email && (
                                            <a href={`mailto:${partner.email}`}
                                                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-[13px] bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-all hover:scale-[1.01]">
                                                <Mail size={16}/> Envoyer un email
                                            </a>
                                        )}
                                        {waNum && (
                                            <a href={`https://wa.me/${waNum}`} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-[13px] bg-green-50 text-green-700 border border-green-100 hover:bg-green-100 transition-all hover:scale-[1.01]">
                                                <MessageCircle size={16}/> WhatsApp
                                            </a>
                                        )}
                                        {partner.phone && !waNum && (
                                            <a href={`tel:${partner.phone}`}
                                                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-[13px] bg-green-50 text-green-700 border border-green-100 hover:bg-green-100 transition-all">
                                                <Phone size={16}/> Appeler
                                            </a>
                                        )}
                                    </div>

                                    {/* Coordonnées */}
                                    {(partner.phone || partner.website || partner.email) && (
                                        <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
                                            <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.25em] mb-3">Coordonnées</p>
                                            {partner.email && (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                                        <Mail size={13} className="text-blue-500"/>
                                                    </div>
                                                    <a href={`mailto:${partner.email}`} className="text-[13px] text-gray-600 hover:text-blue-600 transition-colors truncate">
                                                        {partner.email}
                                                    </a>
                                                </div>
                                            )}
                                            {partner.phone && (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                                                        <Phone size={13} className="text-green-500"/>
                                                    </div>
                                                    <a href={`tel:${partner.phone}`} className="text-[13px] text-gray-600 hover:text-green-600 transition-colors">
                                                        {partner.phone}
                                                    </a>
                                                </div>
                                            )}
                                            {partner.website && (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                                                        <Globe size={13} className="text-purple-500"/>
                                                    </div>
                                                    <a href={partner.website} target="_blank" rel="noopener noreferrer"
                                                        className="text-[13px] text-gray-600 hover:text-purple-600 transition-colors truncate flex items-center gap-1">
                                                        {partner.website.replace(/^https?:\/\//, '')}
                                                        <ExternalLink size={10}/>
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Réseaux sociaux */}
                                    {(partner.facebook || partner.instagram || partner.linkedin) && (
                                        <div>
                                            <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.25em] mb-2.5">Réseaux sociaux</p>
                                            <div className="flex flex-wrap gap-2">
                                                {partner.facebook && (
                                                    <a href={partner.facebook} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all text-[12px] font-semibold">
                                                        <IconFacebook size={13}/> Facebook
                                                    </a>
                                                )}
                                                {partner.instagram && (
                                                    <a href={partner.instagram} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-pink-100 bg-pink-50 text-pink-700 hover:bg-pink-100 transition-all text-[12px] font-semibold">
                                                        <IconInstagram size={13}/> Instagram
                                                    </a>
                                                )}
                                                {partner.linkedin && (
                                                    <a href={partner.linkedin} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-100 bg-sky-50 text-sky-800 hover:bg-sky-100 transition-all text-[12px] font-semibold">
                                                        <IconLinkedin size={13}/> LinkedIn
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Vitrine */}
                                    {partner.products.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <Store size={12} className="text-gray-300"/>
                                                <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.25em]">Vitrine</p>
                                                <div className="flex-1 h-px bg-gray-100"/>
                                                <span className="text-[9px] text-gray-300">{partner.products.length} article{partner.products.length > 1 ? 's' : ''}</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                {partner.products.map(product => (
                                                    <div key={product.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 group/prod">
                                                        {product.image
                                                            ? <Image src={product.image} alt={product.name} fill className="object-cover" unoptimized/>
                                                            : <div className="absolute inset-0 flex items-center justify-center p-1"
                                                                style={{ background: `linear-gradient(135deg, ${colors.from}1a, ${colors.to}1a)` }}>
                                                                <span className="text-[8px] text-gray-400 text-center font-medium leading-tight">{product.name}</span>
                                                            </div>
                                                        }
                                                        {product.price && (
                                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-1 py-0.5 opacity-0 group-hover/prod:opacity-100 transition-opacity">
                                                                <span className="text-[8px] text-white font-bold">{product.price}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Footer badge */}
                                    <div className="rounded-2xl p-4 flex items-center gap-3"
                                        style={{ background: `linear-gradient(135deg, ${colors.from}12, ${colors.to}08)`, border: `1px solid ${colors.badge}` }}>
                                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}>
                                            <Sparkles size={14} className="text-white"/>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[12px] font-bold text-[#1a2332]">Partenaire Retour Gagnant</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">Vérifié et certifié par notre équipe</p>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] font-bold" style={{ color: colors.from }}>
                                            <Clock size={10}/><span>Actif</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </article>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
