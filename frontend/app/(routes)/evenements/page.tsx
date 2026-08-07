'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Calendar, MapPin, Users, Ticket, Crown, ArrowRight, Star, MagnifyingGlass as Search, CaretRight as ChevronRight } from '@phosphor-icons/react';
import { useTranslation, T } from '@/lib/translation'
import { ttcFromHt } from '@/lib/tax'

interface EventData {
    id: string
    title: string
    slug: string
    short_description: string
    description: string
    location: string
    start_date: string
    end_date: string
    price_standard: number
    price_vip: number
    currency: string
    max_capacity: number
    status: string
    cover_image_url: string
    category: string
    is_featured: boolean
    event_images: { id: string; url: string; alt_text: string }[]
}

const CATEGORIES = [
    { value: 'all', label: 'Tous' },
    { value: 'conference', label: 'Conférence' },
    { value: 'gala', label: 'Gala' },
    { value: 'workshop', label: 'Atelier' },
    { value: 'networking', label: 'Networking' },
    { value: 'cultural', label: 'Culturel' },
]

// Palette STRICTEMENT charte Bénin (vert / or / rouge + neutre) — aucune
// couleur hors-charte (plus de bleu/violet/rose).
const CAT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
    conference: { bg: 'bg-[#E6F3ED]', text: 'text-[#00643C]', dot: '#008751' },
    gala: { bg: 'bg-[#FDF6D8]', text: 'text-[#7a5c00]', dot: '#FCD116' },
    workshop: { bg: 'bg-[#E6F3ED]', text: 'text-[#0a7d52]', dot: '#0a7d52' },
    networking: { bg: 'bg-[#FDECEA]', text: 'text-[#E8112D]', dot: '#E8112D' },
    cultural: { bg: 'bg-[#FDF6D8]', text: 'text-[#8a3b12]', dot: '#E8112D' },
    other: { bg: 'bg-gray-100', text: 'text-gray-600', dot: '#6b7280' },
}

const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
// TVA « en sus » : les prix billets sont HORS TAXE en base ; on affiche le TTC
// (HT × 1,18), cohérent avec la page événement et le montant réellement payé.
// Un billet gratuit (0) reste affiché à 0.
const formatPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(ttcFromHt(n, 'XOF'))

export default function EvenementsPage() {
    const { t } = useTranslation()
    const [events, setEvents] = useState<EventData[]>([])
    const [loading, setLoading] = useState(true)
    const [activeCategory, setActiveCategory] = useState('all')
    const [search, setSearch] = useState('')

    useEffect(() => {
        fetch('/api/events')
            .then(r => r.json())
            .then(d => setEvents(d.events || []))
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [])

    const filtered = events.filter(e => {
        if (activeCategory !== 'all' && e.category !== activeCategory) return false
        if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })
    const featured = events.filter(e => e.is_featured)

    return (
        <div className="min-h-screen bg-white">

            {/* ── HERO ───────────────────────────────────────────────── */}
            <div className="relative overflow-hidden bg-white pt-28 pb-16">
                {/* Déco arrière-plan */}
                <div className="absolute inset-0 pointer-events-none select-none">
                    <div className="absolute left-0 top-0 bottom-0 w-[6px]"
                        style={{ background: 'linear-gradient(180deg, #008751, #FCD116, #E8112D)' }} />
                    <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.07]"
                        style={{ background: 'radial-gradient(circle, #008751, transparent 70%)' }} />
                    <div className="absolute top-1/2 -left-20 w-[400px] h-[400px] rounded-full opacity-[0.05]"
                        style={{ background: 'radial-gradient(circle, #FCD116, transparent 70%)' }} />
                    <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="grid-evt" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#008751" strokeWidth="0.8" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid-evt)" />
                    </svg>
                </div>

                <div className="relative max-w-6xl mx-auto px-4 text-center">
                    <nav className="flex items-center justify-center gap-1.5 text-[13px] text-slate-400 mb-6">
                        <Link href="/" className="hover:text-[#008751]"><T>Accueil</T></Link><ChevronRight size={13} />
                        <span className="text-slate-600 font-medium"><T>Événements</T></span>
                    </nav>
                    <motion.span
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E6F3ED] text-[#00643C] text-[11px] font-black uppercase tracking-[0.15em] mb-5"
                    >
                        <Ticket size={13} weight="fill" /> <T>Galas · Conférences · Networking</T>
                    </motion.span>
                    <motion.h1
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                        className="font-display text-5xl md:text-[4rem] font-bold tracking-tight leading-[0.98] text-[#111a15] mb-5"
                    >
                        <T>Nos</T>{' '}
                        <span className="relative inline-block">
                            <span className="relative z-10 text-transparent bg-clip-text italic"
                                style={{ backgroundImage: 'linear-gradient(135deg, #008751 0%, #0a7d52 55%, #00643C 100%)' }}>
                                <T>Événements</T>
                            </span>
                            <span className="absolute -bottom-2 left-0 right-0 h-[5px] rounded-full"
                                style={{ background: 'linear-gradient(90deg, #008751, #FCD116, #E8112D)' }} />
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                        className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed mb-10"
                    >
                        <T>Organisation Galas, conférences, salons — Rencontres B2B et Opportunités d&apos;affaire.</T>
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                        className="max-w-md mx-auto relative"
                    >
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder={t("Rechercher un événement...")}
                            className="w-full pl-11 pr-4 py-4 rounded-2xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/10 transition-all placeholder-gray-400 shadow-sm"
                        />
                    </motion.div>
                </div>
            </div>

            {/* ── STATS ──────────────────────────────────────────────── */}
            {!loading && events.length > 0 && (
                <div className="max-w-6xl mx-auto px-4 pb-10">
                    <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                        {[
                            { value: events.length, label: 'Événements', color: '#008751' },
                            { value: events.filter(e => e.price_standard === 0).length, label: 'Gratuits', color: '#FCD116' },
                            { value: events.filter(e => e.price_vip > 0).length, label: 'Avec VIP', color: '#E8112D' },
                        ].map((s, i) => (
                            <motion.div key={s.label}
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i + 0.25 }}
                                className="text-center p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                <div className="text-3xl font-black" style={{ color: s.color }}>{s.value}</div>
                                <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">{t(s.label)}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── FILTRES ─────────────────────────────────────────────── */}
            <div className="max-w-6xl mx-auto px-4 pb-12">
                <div className="flex flex-wrap justify-center gap-2">
                    {CATEGORIES.map(cat => {
                        const isActive = activeCategory === cat.value
                        return (
                            <button type="button" key={cat.value} onClick={() => setActiveCategory(cat.value)}
                                className={`px-5 py-2.5 rounded-full border text-xs font-bold transition-all cursor-pointer ${isActive
                                    ? 'bg-[#008751] text-white border-[#008751] shadow-[0_4px_16px_rgba(0,135,81,0.3)]'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#008751] hover:text-[#008751]'
                                    }`}>
                                {t(cat.label)}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ── FEATURED ────────────────────────────────────────────── */}
            {featured.length > 0 && activeCategory === 'all' && !search && (
                <div className="max-w-6xl mx-auto px-4 pb-14">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md"
                            style={{ background: 'linear-gradient(135deg, #FCD116, #f59e0b)' }}>
                            <Star size={14} fill="white" className="text-white" />
                        </div>
                        <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]"><T>À la une</T></span>
                        <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
                    </div>

                    {featured.slice(0, 1).map(evt => (
                        <Link href={`/evenements/${evt.slug}`} key={evt.id}>
                            <motion.div
                                whileHover={{ y: -4, boxShadow: '0 24px 64px rgba(0,135,81,0.15)' }}
                                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                className="relative grid md:grid-cols-2 rounded-[28px] border border-gray-100 overflow-hidden bg-white cursor-pointer group"
                                style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}
                            >
                                <div className="absolute top-0 left-0 right-0 h-[4px] z-10"
                                    style={{ background: 'linear-gradient(90deg, #008751, #FCD116, #E8112D)' }} />
                                <div className="relative h-64 md:h-80 overflow-hidden">
                                    {evt.cover_image_url ? (
                                        <Image src={evt.cover_image_url} alt={evt.title} fill
                                            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-[#f0fdf4] via-[#fef9c3] to-[#fff1f2] flex items-center justify-center">
                                            <Calendar size={52} className="text-[#008751]/20" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                    <div className="absolute top-5 left-5">
                                        <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider text-[#1a2332] shadow-md"
                                            style={{ background: 'linear-gradient(135deg, #FCD116, #f59e0b)' }}>
                                            <T>À la une</T>
                                        </span>
                                    </div>
                                </div>
                                <div className="p-8 md:p-10 flex flex-col justify-center space-y-4">
                                    {(() => {
                                        const cc = CAT_COLORS[evt.category] || CAT_COLORS.other
                                        return (
                                            <span className={`inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${cc.bg} ${cc.text}`}>
                                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: cc.dot }} />
                                                {t(evt.category)}
                                            </span>
                                        )
                                    })()}
                                    <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-[#111a15] group-hover:text-[#008751] transition-colors leading-tight">
                                        {t(evt.title)}
                                    </h2>
                                    <p className="text-gray-500 text-sm leading-relaxed line-clamp-3">
                                        {t(evt.short_description || evt.description)}
                                    </p>
                                    <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                                        <span className="flex items-center gap-1.5">
                                            <Calendar size={12} className="text-[#008751]" />
                                            {formatDate(evt.start_date)}
                                        </span>
                                        {evt.location && (
                                            <span className="flex items-center gap-1.5">
                                                <MapPin size={12} className="text-[#E8112D]" />
                                                {t(evt.location)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                        <div>
                                            {evt.price_standard > 0 ? (
                                                <span className="text-xl font-black text-[#008751]">
                                                    {formatPrice(evt.price_standard)}
                                                    <span className="text-sm font-bold text-gray-400 ml-1">{evt.currency}</span>
                                                </span>
                                            ) : (
                                                <span className="text-xs font-black text-[#008751] bg-[#008751]/8 px-3 py-1.5 rounded-full border border-[#008751]/20"><T>GRATUIT</T></span>
                                            )}
                                        </div>
                                        <span className="flex items-center gap-1.5 text-xs font-black text-[#008751] group-hover:gap-3 transition-all">
                                            <T>Voir les détails</T> <ArrowRight size={14} />
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        </Link>
                    ))}
                </div>
            )}

            {/* ── GRILLE ──────────────────────────────────────────────── */}
            <div className="max-w-6xl mx-auto px-4 pb-24">
                {featured.length > 0 && filtered.some(e => !e.is_featured) && activeCategory === 'all' && !search && (
                    <div className="flex items-center gap-4 mb-8">
                        <div className="flex-1 h-px bg-gray-100" />
                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.25em]"><T>Tous les événements</T></span>
                        <div className="flex-1 h-px bg-gray-100" />
                    </div>
                )}

                {loading ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="rounded-[24px] border border-gray-100 bg-gray-50 h-80 animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 mx-auto rounded-[22px] flex items-center justify-center mb-5 bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7]">
                            <Calendar size={36} className="text-[#008751]/40" />
                        </div>
                        <p className="text-[#1a2332] font-bold text-lg"><T>Aucun événement trouvé</T></p>
                        <p className="text-gray-400 text-sm mt-1"><T>De nouveaux événements seront bientôt publiés.</T></p>
                        {(search || activeCategory !== 'all') && (
                            <button type="button" onClick={() => { setSearch(''); setActiveCategory('all') }}
                                className="mt-4 text-[#008751] text-sm font-bold hover:underline cursor-pointer">
                                <T>Réinitialiser les filtres</T>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map((evt, i) => {
                            const cc = CAT_COLORS[evt.category] || CAT_COLORS.other
                            return (
                                <motion.div
                                    key={evt.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                >
                                    <Link href={`/evenements/${evt.slug}`}>
                                        <motion.article
                                            whileHover={{ y: -6, boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}
                                            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                            className="bg-white rounded-[24px] border border-gray-100 overflow-hidden cursor-pointer group flex flex-col"
                                            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                                        >
                                            <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${cc.dot}, #008751)` }} />
                                            <div className="relative h-48 overflow-hidden">
                                                {evt.cover_image_url ? (
                                                    <Image src={evt.cover_image_url} alt={evt.title} fill
                                                        className="object-cover transition-transform duration-600 group-hover:scale-[1.05]" />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-[#f0fdf4] to-[#fef9c3] flex items-center justify-center">
                                                        <Calendar size={36} className="text-[#008751]/20" />
                                                    </div>
                                                )}
                                                <div className="absolute top-3 left-3">
                                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold shadow-sm ${cc.bg} ${cc.text}`}>
                                                        {t(evt.category)}
                                                    </span>
                                                </div>
                                                {evt.price_vip > 0 && (
                                                    <div className="absolute top-3 right-3">
                                                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black text-[#1a2332] shadow-md"
                                                            style={{ background: 'linear-gradient(135deg, #FCD116, #f59e0b)' }}>
                                                            <Crown size={9} />VIP
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-5 flex-1 flex flex-col gap-3">
                                                <h3 className="font-display text-[17px] font-bold text-[#111a15] group-hover:text-[#008751] transition-colors leading-snug line-clamp-2">
                                                    {t(evt.title)}
                                                </h3>
                                                <div className="flex flex-col gap-1.5 text-xs text-gray-400">
                                                    <span className="flex items-center gap-1.5">
                                                        <Calendar size={11} className="text-[#008751] flex-shrink-0" />
                                                        {formatDate(evt.start_date)}
                                                    </span>
                                                    {evt.location && (
                                                        <span className="flex items-center gap-1.5">
                                                            <MapPin size={11} className="text-[#E8112D] flex-shrink-0" />
                                                            <span className="truncate">{t(evt.location)}</span>
                                                        </span>
                                                    )}
                                                    {evt.max_capacity > 0 && (
                                                        <span className="flex items-center gap-1.5">
                                                            <Users size={11} className="text-gray-300 flex-shrink-0" />
                                                            {evt.max_capacity} {t("places")}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between">
                                                    {evt.price_standard > 0 ? (
                                                        <div>
                                                            <span className="text-base font-black text-[#008751]">{formatPrice(evt.price_standard)}</span>
                                                            <span className="text-[10px] text-gray-400 ml-1">{evt.currency}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] font-black text-[#008751] bg-[#008751]/8 px-2.5 py-1 rounded-full border border-[#008751]/15"><T>GRATUIT</T></span>
                                                    )}
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black text-white group-hover:gap-2.5 transition-all"
                                                        style={{ background: 'linear-gradient(135deg, #008751, #006039)', boxShadow: '0 4px 14px rgba(0,135,81,0.25)' }}>
                                                        <Ticket size={12} /> <T>Participer</T>
                                                    </span>
                                                </div>
                                            </div>
                                        </motion.article>
                                    </Link>
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ── BANDEAU CTA BAS ─────────────────────────────────────── */}
            <div className="relative overflow-hidden">
                <div className="h-[6px]" style={{ background: 'linear-gradient(90deg, #008751 33%, #FCD116 33% 66%, #E8112D 66%)' }} />
                <div className="bg-gradient-to-br from-[#f0fdf4] via-white to-[#fef9c3] py-16 text-center px-4">
                    <h2 className="font-display text-3xl font-bold text-[#111a15] mb-2"><T>Vous organisez un événement ?</T></h2>
                    <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto"><T>Rejoignez le réseau RGB et touchez la diaspora béninoise.</T></p>
                    <Link href="/devenir-partenaire"
                        className="inline-flex items-center gap-2 px-7 py-4 rounded-full font-black text-sm text-white transition-all hover:scale-[1.03] active:scale-[0.98]"
                        style={{ background: 'linear-gradient(135deg, #008751, #006039)', boxShadow: '0 8px 32px rgba(0,135,81,0.3)' }}>
                        <T>Devenir partenaire</T> <ArrowRight size={15} />
                    </Link>
                </div>
            </div>
        </div>
    )
}
