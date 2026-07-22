'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { getProposalBySecret } from '@/app/actions/ai-proposals'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import {
    Loader2, ChevronRight, ChevronLeft, MapPin,
    Star, CreditCard, Calendar, CheckCircle, Sparkles, BookOpen,
    HandIcon, FileDown, MessageCircle, Wifi, Waves, Car, UserCheck,
    Mountain, UtensilsCrossed, Shield, Landmark, Download, Hotel
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Price } from '@/components/ui/Price'
import { CurrencyCode } from '@/lib/currency'

// ─── Types ────────────────────────────────────────────────────
interface ProposalItem {
    id: string
    type: string
    title: string
    subtitle?: string
    description: string | null
    location: string | null
    highlights?: string[]
    image_url: string | null
    /** Galerie multi-images du slide : chaque image porte sa propre légende
     *  (comme une vraie slide de présentation). Rétrocompatible : si absent,
     *  seule image_url est utilisée. */
    images?: Array<{ url: string; caption?: string }>
    original_price: number
    selling_price: number
    order_index: number
}

interface Proposal {
    id: string
    secret_key: string
    client_name: string
    destination: string
    status: string
    total_amount: number
    start_date: string | null
    end_date: string | null
    valid_until?: string | null
    created_at?: string
    currency?: string
}

// ─── Constants ────────────────────────────────────────────────
// Icônes premium (lucide) — plus aucun emoji dans les Smart Slides
const TYPE_META: Record<string, { label: string; Icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>; accent: string; accentBg: string }> = {
    hero:       { label: 'Bienvenue',      Icon: Sparkles,         accent: '#FCD116', accentBg: 'rgba(252,209,22,0.12)' },
    hotel:      { label: 'Hébergement',    Icon: Hotel,            accent: '#38BDF8', accentBg: 'rgba(56,189,248,0.12)' },
    restaurant: { label: 'Gastronomie',    Icon: UtensilsCrossed,  accent: '#FB923C', accentBg: 'rgba(251,146,60,0.12)' },
    activity:   { label: 'Découverte',     Icon: Mountain,         accent: '#34D399', accentBg: 'rgba(52,211,153,0.12)' },
    transport:  { label: 'Transport VIP',  Icon: Car,              accent: '#A78BFA', accentBg: 'rgba(167,139,250,0.12)' },
    pricing:    { label: 'Votre Devis',    Icon: CreditCard,       accent: '#FCD116', accentBg: 'rgba(252,209,22,0.10)' },
}

// ─── Highlight icon auto-detect ────────────────────────────────
function HighlightIcon({ text }: { text: string }) {
    const t = text.toLowerCase()
    const cls = 'w-3 h-3 flex-shrink-0'
    if (t.includes('wifi') || t.includes('internet'))              return <Wifi className={cls} />
    if (t.includes('pisci') || t.includes('plage') || t.includes('mer'))  return <Waves className={cls} />
    if (t.includes('voiture') || t.includes('transport') || t.includes('transfert')) return <Car className={cls} />
    if (t.includes('guide') || t.includes('accompagn'))            return <UserCheck className={cls} />
    if (t.includes('vue') || t.includes('panoram') || t.includes('montagne')) return <Mountain className={cls} />
    if (t.includes('restaurant') || t.includes('repas') || t.includes('déjeuner')) return <UtensilsCrossed className={cls} />
    if (t.includes('spa') || t.includes('massage') || t.includes('bien-être')) return <Sparkles className={cls} />
    if (t.includes('sécuri') || t.includes('protec'))              return <Shield className={cls} />
    if (t.includes('visite') || t.includes('culturel') || t.includes('musée')) return <Landmark className={cls} />
    if (t.includes('hôtel') || t.includes('chambre') || t.includes('suite')) return <Hotel className={cls} />
    return <Star className={`${cls} fill-current`} />
}

// ─── 3D slide transitions ─────────────────────────────────────
const slideVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? '100%' : '-100%',
        opacity: 0,
        scale: 0.85,
        rotateY: direction > 0 ? 15 : -15,
        filter: 'blur(10px)',
    }),
    center: {
        x: 0, opacity: 1, scale: 1, rotateY: 0, filter: 'blur(0px)',
        transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
    },
    exit: (direction: number) => ({
        x: direction < 0 ? '50%' : '-50%',
        opacity: 0, scale: 0.9,
        rotateY: direction < 0 ? 10 : -10,
        filter: 'blur(10px)',
        transition: { duration: 0.5, ease: [0.7, 0, 0.84, 0] as const },
    }),
}

// ─── Stat card ────────────────────────────────────────────────
function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
    return (
        <div className="flex-1 min-w-0 bg-white/85 backdrop-blur-xl border border-slate-200 rounded-2xl p-3 md:p-4">
            <p className="text-[8px] md:text-[9px] uppercase tracking-[0.15em] font-bold mb-1" style={{ color: accent + 'aa' }}>{label}</p>
            <p className="text-slate-900 font-black text-xs md:text-sm truncate leading-tight">{value}</p>
        </div>
    )
}

// ─── Main component ───────────────────────────────────────────
export default function PresentationView({ params }: { params: Promise<{ secret: string }> }) {
    const { secret } = React.use(params)
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [now] = useState(() => Date.now())
    const [proposal, setProposal] = useState<Proposal | null>(null)
    const [items, setItems] = useState<ProposalItem[]>([])
    const [currentSlide, setCurrentSlide] = useState(0)
    const [direction, setDirection] = useState(0)
    const [showSwipeHint, setShowSwipeHint] = useState(true)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            const result = await getProposalBySecret(secret)
            if (result.success && result.proposal) {
                setProposal(result.proposal)
                setItems(result.items || [])

                // ── Analytics: Track proposal view ──
                try {
                    fetch('/api/proposals/track-view', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            proposalId: result.proposal.id,
                            secretKey: secret,
                            viewedAt: new Date().toISOString(),
                            userAgent: navigator.userAgent,
                            referrer: document.referrer || null,
                        }),
                    }).catch(() => {})
                } catch {}
            }
            setLoading(false)
            setTimeout(() => setShowSwipeHint(false), 4000)
        }
        load()
    }, [secret])

    const goToSlide = useCallback((n: number) => {
        if (n < 0 || n >= items.length) return
        setDirection(n > currentSlide ? 1 : -1)
        setCurrentSlide(n)
        setShowSwipeHint(false)
    }, [currentSlide, items.length])

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') goToSlide(currentSlide + 1)
            if (e.key === 'ArrowLeft') goToSlide(currentSlide - 1)
        }
        window.addEventListener('keydown', h)
        return () => window.removeEventListener('keydown', h)
    }, [goToSlide, currentSlide])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleDragEnd = (_e: any, { offset }: PanInfo) => {
        if (offset.x < -50) goToSlide(currentSlide + 1)
        else if (offset.x > 50) goToSlide(currentSlide - 1)
    }

    // ─── Loading ──────────────────────────────────────────────
    if (loading) {
        return (
            <div className="h-[100dvh] w-screen bg-[#F4F7F5] flex flex-col items-center justify-center gap-6">
                <div className="relative">
                    <div className="absolute -inset-6 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] rounded-full blur-3xl opacity-25 animate-pulse" />
                    <Loader2 className="w-16 h-16 text-amber-600 animate-spin relative z-10" />
                </div>
                <p className="text-amber-600 uppercase tracking-[0.3em] font-black text-xs">Retour Gagnant Bénin</p>
            </div>
        )
    }

    if (!proposal || items.length === 0) {
        return (
            <div className="h-[100dvh] w-screen bg-[#F4F7F5] flex flex-col items-center justify-center text-slate-900 p-6 text-center">
                <Shield size={44} className="mb-6 text-amber-600" />
                <h1 className="text-2xl font-black mb-3">Proposition introuvable</h1>
                <p className="text-slate-500 text-sm max-w-sm">Ce lien a expiré ou n&apos;est pas valide. Contactez votre agent <span className="text-amber-600 font-bold">Retour Gagnant</span>.</p>
            </div>
        )
    }

    // ─── Computed values ──────────────────────────────────────
    const currentItem = items[currentSlide]
    const meta = TYPE_META[currentItem.type] || TYPE_META.activity
    const progress = ((currentSlide + 1) / items.length) * 100
    const billableItems = items.filter(i => i.type !== 'hero' && i.type !== 'pricing' && i.selling_price > 0)
    const totalOriginal = billableItems.reduce((acc, i) => acc + (i.original_price || 0), 0)
    const savings = totalOriginal > proposal.total_amount ? totalOriginal - proposal.total_amount : 0
    const maxPrice = billableItems.length > 0 ? Math.max(...billableItems.map(i => i.selling_price)) : 1

    const durationDays = proposal.start_date && proposal.end_date
        ? Math.ceil((new Date(proposal.end_date).getTime() - new Date(proposal.start_date).getTime()) / (1000 * 60 * 60 * 24))
        : 0
    const hotelCount = items.filter(i => i.type === 'hotel').length
    const activityCount = items.filter(i => i.type === 'activity').length
    const restaurantCount = items.filter(i => i.type === 'restaurant').length

    const clientInitials = proposal.client_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

    return (
        <div className="h-[100dvh] w-screen bg-[#F4F7F5] text-slate-900 overflow-hidden relative select-none flex flex-col" style={{ perspective: '1200px' }}>

            {/* ═══ BACKGROUND ═══ */}
            <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                    key={currentItem.id + '-bg'}
                    variants={{
                        enter: { opacity: 0, scale: 1.08 },
                        center: { opacity: 1, scale: 1, transition: { duration: 1.2, ease: 'easeOut' } },
                        exit: { opacity: 0, transition: { duration: 0.5 } },
                    }}
                    initial="enter" animate="center" exit="exit"
                    className="absolute inset-0 z-0"
                >
                    {currentItem.image_url ? (
                        <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={currentItem.image_url} alt="" className="w-full h-full object-cover object-center" />
                            {/* Strong gradient from bottom for text readability */}
                            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/70 to-transparent" />
                            <div className="absolute inset-0 bg-gradient-to-r from-white/50 via-transparent to-transparent" />
                        </>
                    ) : currentItem.type === 'hero' ? (
                        <div className="absolute inset-0">
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(0,135,81,0.35),transparent)]" />
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_20%_20%,rgba(252,209,22,0.18),transparent)]" />
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_80%_10%,rgba(232,17,45,0.15),transparent)]" />
                            {/* Animated glow orbs */}
                            <motion.div className="absolute w-96 h-96 rounded-full blur-3xl opacity-20 bg-[#FCD116]"
                                style={{ top: '60%', left: '60%', translateX: '-50%', translateY: '-50%' }}
                                animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 4, repeat: Infinity }} />
                        </div>
                    ) : (
                        <div className="absolute inset-0">
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(0,135,81,0.18),transparent_60%)]" />
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(252,209,22,0.12),transparent_60%)]" />
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* ═══ PROGRESS BAR ═══ */}
            <div className="absolute top-0 left-0 right-0 z-50 h-[3px]">
                <div className="h-full bg-slate-50" />
                <motion.div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]"
                    animate={{ width: `${progress}%` }}
                    transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                />
            </div>

            {/* ═══ HEADER ═══ */}
            <div className="absolute top-0 left-0 right-0 z-50 px-4 md:px-8 pt-4 md:pt-5 flex justify-between items-start pointer-events-none">
                {/* Logo + client */}
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-[#008751] via-[#FCD116] to-[#E8112D] rounded-full flex items-center justify-center font-black text-white text-[10px] md:text-xs shadow-xl">RG</div>
                    <div className="hidden sm:block">
                        <p className="text-[8px] font-black uppercase tracking-[0.25em] drop-shadow-md">
                            <span className="text-emerald-700">Retour</span> <span className="text-amber-600">Gagnant</span> <span className="text-[#E8112D]">Bénin</span>
                        </p>
                        <p className="font-bold text-slate-900/80 text-[11px] drop-shadow-md truncate max-w-[140px]">{proposal.client_name}</p>
                    </div>
                </div>

                {/* Dots — mobile (centered) */}
                <div className="flex sm:hidden fixed top-3.5 inset-x-0 justify-center pointer-events-auto z-50">
                    <div className="flex items-center gap-1.5 bg-white/85 backdrop-blur-xl px-3 py-1.5 rounded-full border border-slate-200">
                        {items.map((_, i) => (
                            <button key={i} title={`Slide ${i + 1}`} onClick={() => goToSlide(i)}
                                className={`rounded-full transition-all duration-300 ${i === currentSlide ? 'w-5 h-1.5 bg-gradient-to-r from-[#008751] to-[#FCD116]' : i < currentSlide ? 'w-1.5 h-1.5 bg-[#008751]/70' : 'w-1.5 h-1.5 bg-slate-300'}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Dots — desktop (right) */}
                <div className="hidden sm:flex items-center gap-2 pointer-events-auto">
                    {items.map((_, i) => (
                        <button key={i} title={`Slide ${i + 1}`} onClick={() => goToSlide(i)}
                            className={`rounded-full transition-all duration-500 ${i === currentSlide ? 'w-8 h-2 bg-gradient-to-r from-[#008751] to-[#FCD116] shadow-[0_0_10px_rgba(252,209,22,0.5)]' : i < currentSlide ? 'w-2 h-2 bg-[#008751]/50' : 'w-2 h-2 bg-slate-200 hover:bg-slate-300'}`}
                        />
                    ))}
                </div>

                {/* Destination + date */}
                <div className="text-right pointer-events-auto">
                    <p className="text-[9px] font-black text-amber-600 tracking-[0.2em] uppercase drop-shadow-md truncate max-w-[110px] md:max-w-none">{proposal.destination}</p>
                    {proposal.start_date && (
                        <p className="text-[9px] md:text-[10px] text-slate-900/60 flex items-center justify-end gap-1 mt-0.5">
                            <Calendar className="w-2.5 h-2.5" />
                            {new Date(proposal.start_date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                        </p>
                    )}
                </div>
            </div>

            {/* ═══ GALERIE MULTI-IMAGES (chaque image avec sa légende) ═══ */}
            <AnimatePresence>
                {(currentItem.images?.length || 0) > 0 && !['pricing'].includes(currentItem.type) && (
                    <motion.div
                        key={currentItem.id + '-gallery'}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: 0.35, duration: 0.6 } }}
                        exit={{ opacity: 0, y: 30 }}
                        className="absolute bottom-24 left-0 right-0 z-30 px-4 md:px-10"
                    >
                        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {currentItem.images!.map((img, gi) => (
                                <figure key={gi}
                                    className="snap-start flex-shrink-0 w-44 md:w-56 rounded-2xl overflow-hidden bg-white/85 backdrop-blur-xl border border-slate-200"
                                    style={{ boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 30px ${meta.accent}20` }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={img.url} alt={img.caption || ''} className="w-full h-28 md:h-36 object-cover" />
                                    {img.caption && (
                                        <figcaption className="px-3 py-2 text-[10px] md:text-[11px] font-semibold text-slate-900/85 leading-snug">
                                            {img.caption}
                                        </figcaption>
                                    )}
                                </figure>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ FLOATING IMAGE CARD (desktop, non-hero slides) ═══ */}
            <AnimatePresence>
                {currentItem.image_url && !['hero', 'pricing'].includes(currentItem.type) && (
                    <motion.div
                        key={currentItem.id + '-img-card'}
                        initial={{ opacity: 0, x: 40, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1, transition: { delay: 0.3, duration: 0.7 } }}
                        exit={{ opacity: 0, x: 40 }}
                        className="hidden xl:block absolute top-20 right-8 w-72 h-52 2xl:w-80 2xl:h-60 rounded-3xl overflow-hidden z-30 pointer-events-none"
                        style={{ boxShadow: `0 0 50px ${meta.accent}30, 0 20px 60px rgba(0,0,0,0.6)` }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={currentItem.image_url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-white/60 to-transparent" />
                        {/* Price badge overlay */}
                        {currentItem.selling_price > 0 && (
                            <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl backdrop-blur-xl border text-xs font-black"
                                style={{ background: meta.accent + '20', borderColor: meta.accent + '50', color: meta.accent }}>
                                <Price amount={currentItem.selling_price} currency={(proposal.currency as CurrencyCode) || 'XOF'} forceDisplayCurrency={(proposal.currency as CurrencyCode) || 'XOF'} />
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ MAIN CONTENT (3D swipeable) ═══ */}
            <motion.div
                className="relative z-20 flex-1 flex flex-col justify-end md:justify-center px-5 md:px-10 xl:px-16 pb-[90px] md:pb-6 w-full cursor-grab active:cursor-grabbing"
                style={{ transformStyle: 'preserve-3d' }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
            >
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={currentItem.id}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter" animate="center" exit="exit"
                        className="w-full max-w-2xl xl:max-w-3xl"
                        style={{ transformStyle: 'preserve-3d' }}
                    >
                        {/* Swipe hint */}
                        {showSwipeHint && currentSlide === 0 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: -20 }}
                                transition={{ repeat: Infinity, duration: 1.5, repeatType: 'reverse' }}
                                className="md:hidden absolute -top-14 right-0 flex items-center gap-2 text-amber-600/80 text-[10px] font-bold uppercase tracking-widest bg-white/85 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200"
                            >
                                <HandIcon className="w-4 h-4" /> Balayez l&apos;écran
                            </motion.div>
                        )}

                        <div className="max-h-[65vh] md:max-h-[80vh] overflow-y-auto no-scrollbar pr-1">

                            {/* ══════════════════════════════════════════
                                HERO SLIDE
                            ══════════════════════════════════════════ */}
                            {currentItem.type === 'hero' && (
                                <>
                                    {/* Client avatar + label */}
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                                        className="flex items-center gap-3 mb-4 md:mb-6"
                                    >
                                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-[#FCD116] to-[#E8112D] flex items-center justify-center font-black text-[#050D1A] text-sm md:text-base shadow-[0_0_20px_rgba(252,209,22,0.4)] flex-shrink-0">
                                            {clientInitials}
                                        </div>
                                        <div>
                                            <p className="text-[9px] md:text-[10px] text-slate-900/55 uppercase tracking-widest">Préparé exclusivement pour</p>
                                            <p className="text-sm md:text-base font-black text-slate-900">{proposal.client_name}</p>
                                        </div>
                                    </motion.div>

                                    {/* Title */}
                                    <motion.h1
                                        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                                        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] mb-4 drop-shadow-[0_2px_10px_rgba(255,255,255,0.85)]"
                                        style={{ background: 'linear-gradient(120deg, #047857 0%, #B45309 55%, #065F46 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                                    >
                                        {currentItem.title}
                                    </motion.h1>

                                    {/* Description */}
                                    {currentItem.description && (
                                        <motion.p
                                            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                                            className="text-sm md:text-lg text-slate-900/70 leading-relaxed mb-5 max-w-lg"
                                        >
                                            {currentItem.description}
                                        </motion.p>
                                    )}

                                    {/* Stats pills */}
                                    {(durationDays > 0 || hotelCount > 0 || activityCount > 0 || restaurantCount > 0) && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
                                            className="flex flex-wrap gap-2 mb-5"
                                        >
                                            {durationDays > 0 && (
                                                <span className="px-3 py-1.5 bg-white/85 backdrop-blur-xl border border-slate-200 rounded-full text-[10px] md:text-xs font-bold text-slate-900/90 flex items-center gap-1.5">
                                                    <Calendar className="w-3 h-3 text-amber-600" /> {durationDays} jour{durationDays > 1 ? 's' : ''}
                                                </span>
                                            )}
                                            {hotelCount > 0 && (
                                                <span className="px-3 py-1.5 bg-white/85 backdrop-blur-xl border border-slate-200 rounded-full text-[10px] md:text-xs font-bold text-slate-900/90">
                                                    <Hotel size={12} className="inline-block mr-1 -mt-0.5" /> {hotelCount} hôtel{hotelCount > 1 ? 's' : ''}
                                                </span>
                                            )}
                                            {activityCount > 0 && (
                                                <span className="px-3 py-1.5 bg-white/85 backdrop-blur-xl border border-slate-200 rounded-full text-[10px] md:text-xs font-bold text-slate-900/90">
                                                    <Mountain size={12} className="inline-block mr-1 -mt-0.5" /> {activityCount} activité{activityCount > 1 ? 's' : ''}
                                                </span>
                                            )}
                                            {restaurantCount > 0 && (
                                                <span className="px-3 py-1.5 bg-white/85 backdrop-blur-xl border border-slate-200 rounded-full text-[10px] md:text-xs font-bold text-slate-900/90">
                                                    <UtensilsCrossed size={12} className="inline-block mr-1 -mt-0.5" /> {restaurantCount} restaurant{restaurantCount > 1 ? 's' : ''}
                                                </span>
                                            )}
                                            <span className="px-3 py-1.5 bg-[#008751]/25 backdrop-blur-xl border border-[#008751]/40 rounded-full text-[10px] md:text-xs font-bold text-emerald-700">
                                                 Offre Exclusive
                                            </span>
                                        </motion.div>
                                    )}

                                    {/* Total price chip */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.32 }}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-white/85 backdrop-blur-xl border border-[#FCD116]/20 rounded-full mb-6"
                                    >
                                        <span className="text-[10px] text-slate-900/55 uppercase tracking-widest">Total</span>
                                        <span className="text-amber-600 font-black text-base md:text-lg">
                                            <Price amount={proposal.total_amount} currency={(proposal.currency as CurrencyCode) || 'XOF'} forceDisplayCurrency={(proposal.currency as CurrencyCode) || 'XOF'} />
                                        </span>
                                    </motion.div>

                                    {/* CTA */}
                                    <motion.button
                                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                                        onClick={(e) => { e.stopPropagation(); goToSlide(1) }}
                                        className="relative px-8 md:px-10 py-3.5 md:py-4 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] rounded-full text-[#050D1A] font-black uppercase tracking-wider text-xs md:text-sm transition-all flex items-center gap-2.5 active:scale-95 touch-manipulation overflow-hidden group"
                                    >
                                        <motion.div
                                            className="absolute inset-0 bg-slate-200"
                                            animate={{ x: ['-100%', '200%'] }}
                                            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
                                            style={{ transform: 'skewX(-20deg)', width: '30%' }}
                                        />
                                        Découvrir l&apos;expérience <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                                    </motion.button>
                                </>
                            )}

                            {/* ══════════════════════════════════════════
                                CONTENT SLIDES (hotel/restaurant/activity/transport)
                            ══════════════════════════════════════════ */}
                            {!['hero', 'pricing'].includes(currentItem.type) && (
                                <>
                                    {/* Badge + location row */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
                                        className="flex items-center gap-2 mb-3 md:mb-4 flex-wrap"
                                    >
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] md:text-xs font-black tracking-[0.15em] uppercase border backdrop-blur-xl"
                                            style={{ background: meta.accentBg, borderColor: meta.accent + '40', color: meta.accent }}>
                                            <meta.Icon size={14} className="inline-block" /> {meta.label}
                                        </span>
                                        {currentItem.location && (
                                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/85 backdrop-blur-xl border border-slate-200 text-[10px] md:text-xs font-bold text-slate-900/70">
                                                <MapPin className="w-3 h-3 text-[#E8112D]" /> {currentItem.location}
                                            </span>
                                        )}
                                    </motion.div>

                                    {/* Subtitle */}
                                    {currentItem.subtitle && (
                                        <motion.p
                                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                                            className="font-bold text-[10px] md:text-sm uppercase tracking-[0.1em] md:tracking-[0.15em] mb-2 drop-shadow-md"
                                            style={{ color: meta.accent }}
                                        >
                                            {currentItem.subtitle}
                                        </motion.p>
                                    )}

                                    {/* Title */}
                                    <motion.h1
                                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                                        className="text-2xl sm:text-3xl md:text-4xl xl:text-5xl font-black leading-[1.1] mb-3 md:mb-4 drop-shadow-[0_2px_10px_rgba(255,255,255,0.85)]"
                                        style={{ background: `linear-gradient(120deg, #ffffff 50%, ${meta.accent} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                                    >
                                        {currentItem.title}
                                    </motion.h1>

                                    {/* Description */}
                                    {currentItem.description && (
                                        <motion.p
                                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                                            className="text-sm md:text-base text-slate-900/75 leading-relaxed mb-4 md:mb-5 max-w-xl line-clamp-3 md:line-clamp-4"
                                        >
                                            {currentItem.description}
                                        </motion.p>
                                    )}

                                    {/* ── Stat cards ────────────────────── */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
                                        className="flex gap-2 md:gap-3 mb-4 md:mb-5"
                                    >
                                        <StatCard label="Catégorie" value={meta.label} accent={meta.accent} />
                                        {currentItem.location && <StatCard label="Lieu" value={currentItem.location} accent={meta.accent} />}
                                        {currentItem.selling_price > 0 && (
                                            <div className="flex-shrink-0 backdrop-blur-xl border rounded-2xl p-3 md:p-4 text-center"
                                                style={{ background: meta.accent + '12', borderColor: meta.accent + '35' }}>
                                                <p className="text-[8px] md:text-[9px] uppercase tracking-[0.15em] font-bold mb-1" style={{ color: meta.accent + '99' }}>Tarif inclus</p>
                                                <p className="font-black text-xs md:text-sm whitespace-nowrap" style={{ color: meta.accent }}>
                                                    <Price amount={currentItem.selling_price} currency={(proposal.currency as CurrencyCode) || 'XOF'} forceDisplayCurrency={(proposal.currency as CurrencyCode) || 'XOF'} />
                                                </p>
                                            </div>
                                        )}
                                    </motion.div>

                                    {/* ── Highlights with icons ─────────── */}
                                    {currentItem.highlights && currentItem.highlights.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                                            className="grid grid-cols-2 md:grid-cols-3 gap-2"
                                        >
                                            {currentItem.highlights.map((h, i) => (
                                                <div key={i}
                                                    className="flex items-center gap-2 px-3 py-2.5 bg-white/85 backdrop-blur-xl border border-slate-200 rounded-xl"
                                                    style={{ borderColor: meta.accent + '20' }}
                                                >
                                                    <span style={{ color: meta.accent }}>
                                                        <HighlightIcon text={h} />
                                                    </span>
                                                    <span className="text-[10px] md:text-xs font-semibold text-slate-900/85 leading-tight line-clamp-2">{h}</span>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </>
                            )}

                            {/* ══════════════════════════════════════════
                                PRICING SLIDE
                            ══════════════════════════════════════════ */}
                            {currentItem.type === 'pricing' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                                >
                                    {/* Glass panel */}
                                    <div className="bg-white/92 backdrop-blur-2xl border border-slate-200 p-5 md:p-7 rounded-[2rem] shadow-[0_0_60px_rgba(252,209,22,0.07)] relative overflow-hidden">
                                        {/* Glow corner */}
                                        <div className="absolute top-0 right-0 w-40 h-40 bg-[#FCD116]/8 rounded-full blur-3xl pointer-events-none" />
                                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#008751]/8 rounded-full blur-3xl pointer-events-none" />

                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-5 relative z-10">
                                            <div>
                                                <p className="text-[9px] md:text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-1">Votre Tarif VIP</p>
                                                {totalOriginal > proposal.total_amount && (
                                                    <p className="text-xs text-slate-900/50 line-through mb-0.5">
                                                        <Price amount={totalOriginal} currency={(proposal.currency as CurrencyCode) || 'XOF'} forceDisplayCurrency={(proposal.currency as CurrencyCode) || 'XOF'} />
                                                    </p>
                                                )}
                                                <p className="text-2xl md:text-4xl font-black text-slate-900">
                                                    <Price amount={proposal.total_amount} currency={(proposal.currency as CurrencyCode) || 'XOF'} forceDisplayCurrency={(proposal.currency as CurrencyCode) || 'XOF'} />
                                                </p>
                                            </div>
                                            <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-amber-600/25 hidden sm:block" />
                                        </div>

                                        {/* Items with progress bars */}
                                        <div className="space-y-3 mb-5 relative z-10 max-h-[140px] md:max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                                            {billableItems.map((item) => {
                                                const pct = maxPrice > 0 ? (item.selling_price / maxPrice) * 100 : 0
                                                const m = TYPE_META[item.type] || TYPE_META.activity
                                                return (
                                                    <div key={item.id} className="pb-2.5 border-b border-slate-200 last:border-0">
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <span className="text-slate-900/75 text-[11px] md:text-sm flex items-center gap-2 truncate pr-3">
                                                                <m.Icon size={14} className="flex-shrink-0" style={{ color: m.accent }} />
                                                                <span className="truncate">{item.title}</span>
                                                            </span>
                                                            <span className="text-slate-900 font-bold text-[11px] md:text-sm whitespace-nowrap">
                                                                <Price amount={item.selling_price} currency={(proposal.currency as CurrencyCode) || 'XOF'} forceDisplayCurrency={(proposal.currency as CurrencyCode) || 'XOF'} />
                                                            </span>
                                                        </div>
                                                        {/* Progress bar */}
                                                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${pct}%` }}
                                                                transition={{ delay: 0.4, duration: 0.9, ease: 'easeOut' }}
                                                                className="h-full rounded-full"
                                                                style={{ background: `linear-gradient(to right, ${m.accent}80, ${m.accent})` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {/* Économies */}
                                        {savings > 0 && (
                                            <div className="bg-[#008751]/12 border border-[#008751]/25 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between relative z-10">
                                                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Vous économisez</span>
                                                <span className="text-emerald-700 font-black text-sm">
                                                    <Price amount={savings} currency={(proposal.currency as CurrencyCode) || 'XOF'} forceDisplayCurrency={(proposal.currency as CurrencyCode) || 'XOF'} /> 
                                                </span>
                                            </div>
                                        )}

                                        {/* CTA buttons */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 relative z-10 mb-3">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); router.push(`/p/${secret}/paiement`) }}
                                                className="bg-gradient-to-r from-[#008751] to-[#FCD116] text-[#050D1A] py-3.5 md:py-4 rounded-2xl font-black text-sm transition-all shadow-[0_0_30px_rgba(0,135,81,0.25)] flex items-center justify-center gap-2 active:scale-95 touch-manipulation"
                                            >
                                                <CreditCard className="w-4 h-4" /> Payer maintenant
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); router.push(`/p/${secret}/paiement`) }}
                                                className="bg-slate-100 border border-slate-200 hover:bg-slate-100 text-slate-900 py-3.5 md:py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 touch-manipulation"
                                            >
                                                <BookOpen className="w-4 h-4 text-amber-600" /> Réserver
                                            </button>
                                        </div>

                                        {/* Download buttons — PDF + PPTX */}
                                        <div className="grid grid-cols-2 gap-2 relative z-10 mb-3">
                                            <a
                                                href={`/api/proposals/${proposal.id}/devis`}
                                                target="_blank" rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="bg-slate-50 border border-slate-200 hover:bg-[#FCD116]/10 hover:border-[#FCD116]/30 text-slate-500 hover:text-amber-600 py-2.5 rounded-xl font-medium text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
                                            >
                                                <FileDown className="w-3.5 h-3.5" /> Devis PDF
                                            </a>
                                            <a
                                                href={`/api/proposals/${proposal.id}/pptx`}
                                                target="_blank" rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="bg-slate-50 border border-slate-200 hover:bg-blue-500/10 hover:border-blue-400/30 text-slate-900/60 hover:text-blue-400 py-2.5 rounded-xl font-medium text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
                                            >
                                                <Download className="w-3.5 h-3.5" /> PPTX
                                            </a>
                                        </div>

                                        {/* Trust + validity */}
                                        <div className="flex flex-col items-center gap-1 relative z-10">
                                            <p className="text-slate-900/55 text-[9px] md:text-[10px] flex items-center gap-1.5">
                                                <CheckCircle className="w-3 h-3 text-emerald-700" /> Paiement 100% sécurisé — Retour Gagnant Bénin
                                            </p>
                                            <p className="text-amber-600/35 text-[9px]">
                                                {(() => {
                                                    const validUntil = proposal?.valid_until 
                                                        ? new Date(proposal.valid_until) 
                                                        : new Date(new Date(proposal?.created_at || now).getTime() + 14 * 24 * 60 * 60 * 1000)
                                                    const diffDays = Math.ceil((validUntil.getTime() - now) / (1000 * 60 * 60 * 24))
                                                    return diffDays > 0 
                                                        ? `⏳ Offre personnalisée · Expire dans ${diffDays} jour${diffDays > 1 ? 's' : ''}` 
                                                        : `⏳ Offre personnalisée · Expirée`
                                                })()}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                        </div>
                    </motion.div>
                </AnimatePresence>
            </motion.div>

            {/* ═══ NAVIGATION CONTROLS ═══ */}
            <div className="absolute bottom-4 md:bottom-8 left-0 right-0 px-5 md:px-10 z-40 flex items-center justify-between pointer-events-none">
                <div className="text-slate-900/50 text-[10px] font-black font-mono tracking-widest">
                    {String(currentSlide + 1).padStart(2, '0')}<span className="text-slate-900/55 mx-1">/</span>{String(items.length).padStart(2, '0')}
                </div>
                <div className="flex items-center gap-2 md:gap-3 pointer-events-auto">
                    <button onClick={() => goToSlide(currentSlide - 1)} title="Précédent"
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center backdrop-blur-2xl border transition-all active:scale-90 touch-manipulation ${currentSlide === 0 ? 'opacity-0 pointer-events-none' : 'bg-white/85 border-slate-200 text-slate-900 hover:bg-white/88'}`}
                        disabled={currentSlide === 0}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={() => goToSlide(currentSlide + 1)} title="Suivant"
                        className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center backdrop-blur-2xl border transition-all active:scale-90 touch-manipulation shadow-lg ${currentSlide === items.length - 1 ? 'opacity-0 pointer-events-none' : 'bg-gradient-to-r from-[#008751] to-[#FCD116] border-[#FCD116]/30 text-[#050D1A] shadow-[0_0_20px_rgba(252,209,22,0.3)]'}`}
                        disabled={currentSlide === items.length - 1}
                    >
                        <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                </div>
            </div>

            {/* ═══ FLOATING PDF (bas gauche) ═══ */}
            <a
                href={`/api/proposals/${proposal.id}/devis`}
                target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="fixed bottom-[88px] left-4 md:bottom-20 md:left-8 z-[60] w-12 h-12 md:w-14 md:h-14 bg-white/90 hover:bg-[#FCD116]/20 backdrop-blur-xl border border-[#FCD116]/30 hover:border-[#FCD116]/70 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95 touch-manipulation"
                title="Télécharger le devis PDF"
            >
                <FileDown className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
            </a>

            {/* ═══ FLOATING WHATSAPP (bas droite) ═══ */}
            <a
                href="https://wa.me/2290160322121"
                target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="fixed bottom-[88px] right-4 md:bottom-20 md:right-8 z-[60] w-12 h-12 md:w-14 md:h-14 bg-[#25D366] hover:bg-[#1db954] rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(37,211,102,0.45)] transition-all hover:scale-110 active:scale-95 touch-manipulation"
                title="Contacter sur WhatsApp"
            >
                <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-slate-900" />
            </a>

            {/* ═══ AMBIENT PARTICLES (desktop) ═══ */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden hidden md:block">
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 h-1 rounded-full"
                        style={{ background: ['#008751', '#FCD116', '#E8112D'][i % 3], top: `${15 + i * 13}%`, left: `${78 + (i % 3) * 6}%` }}
                        animate={{ y: [-20, 20], opacity: [0.08, 0.35, 0.08] }}
                        transition={{ duration: 3 + i * 0.5, repeat: Infinity, repeatType: 'reverse', delay: i * 0.4 }}
                    />
                ))}
            </div>
        </div>
    )
}
