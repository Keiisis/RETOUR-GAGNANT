'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import {
    Calendar, MapPin, Clock, Users, Ticket, Crown,
    ArrowLeft, CheckCircle2, X, Share2, ChevronLeft, ChevronRight,
    Phone, Mail, User, CreditCard, ExternalLink,
} from 'lucide-react'
import { useTranslation, T } from '@/lib/translation'
import CurrencySelector from '@/components/boutique/CurrencySelector'
import { type CurrencyCode, getCurrencyForLang, convertWithMargin, formatPrice as fmtCurrency } from '@/lib/currency'

interface EventData {
    id: string; title: string; slug: string; description: string; short_description: string
    location: string; location_map_url: string; start_date: string; end_date: string
    price_standard: number; price_vip: number; currency: string
    max_capacity: number; max_vip_seats: number; status: string
    cover_image_url: string; category: string; is_featured: boolean
    event_images: { id: string; url: string; alt_text: string; sort_order: number }[]
}

const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const formatTime = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

const PAYMENT_METHODS = [
    { id: 'kkiapay', label: 'Kkiapay', sub: 'Mobile Money — Bénin', color: '#008751' },
    { id: 'fedapay', label: 'FedaPay', sub: 'Afrique de l\'Ouest', color: '#0ea5e9' },
    { id: 'stripe', label: 'Carte Bancaire', sub: 'Stripe — International', color: '#6366f1' },
    { id: 'paypal', label: 'PayPal', sub: 'International', color: '#0070ba' },
]

export default function EventDetailPage() {
    const params = useParams()
    const slug = params?.slug as string

    const { t, lang } = useTranslation()

    const [event, setEvent] = useState<EventData | null>(null)
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [ticketType, setTicketType] = useState<'standard' | 'vip'>('standard')
    const [formStep, setFormStep] = useState(0)
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')
    const [galleryIdx, setGalleryIdx] = useState(0)
    const [form, setForm] = useState({ full_name: '', email: '', phone: '', whatsapp: '', payment_method: '' })
    const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(() => getCurrencyForLang(lang))
    useEffect(() => { setSelectedCurrency(getCurrencyForLang(lang)) }, [lang])

    useEffect(() => {
        if (!slug) return
        fetch('/api/events?admin=false')
            .then(r => r.json())
            .then(d => {
                const found = (d.events || []).find((e: EventData) => e.slug === slug)
                setEvent(found || null)
            })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [slug])

    const openRegistration = useCallback((type: 'standard' | 'vip') => {
        setTicketType(type)
        setFormStep(0)
        setError('')
        setSuccess(false)
        setShowModal(true)
    }, [])

    const handleSubmit = async () => {
        if (!event) return
        if (!form.full_name || !form.email || !form.phone) {
            setError('Veuillez remplir tous les champs obligatoires')
            return
        }
        setSubmitting(true); setError('')
        try {
            const res = await fetch(`/api/events/${event.id}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, ticket_type: ticketType }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erreur')
            if (data.requires_payment) setFormStep(2)
            else setSuccess(true)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur lors de l\'inscription')
        } finally {
            setSubmitting(false)
        }
    }

    const images = event?.event_images?.sort((a, b) => a.sort_order - b.sort_order) || []
    const allImages = event?.cover_image_url
        ? [{ url: event.cover_image_url, alt_text: event.title }, ...images.map(i => ({ url: i.url, alt_text: i.alt_text }))]
        : images.map(i => ({ url: i.url, alt_text: i.alt_text }))

    if (loading) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="w-10 h-10 border-3 border-[#008751] border-t-transparent rounded-full animate-spin" />
        </div>
    )

    if (!event) return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 text-center px-4">
            <div className="w-20 h-20 rounded-[22px] bg-gray-50 flex items-center justify-center">
                <Calendar size={36} className="text-gray-300" />
            </div>
            <p className="font-black text-[#1a2332] text-lg"><T>Événement introuvable</T></p>
            <Link href="/evenements" className="text-[#008751] text-sm font-bold hover:underline flex items-center gap-1">
                <ArrowLeft size={14} /> <T>Retour aux événements</T>
            </Link>
        </div>
    )

    const price = ticketType === 'vip' ? event.price_vip : event.price_standard
    const isFree = price === 0
    const showPrice = (amountXOF: number) => fmtCurrency(convertWithMargin(amountXOF, selectedCurrency), selectedCurrency)
    const displayPrice = showPrice(price)

    return (
        <div className="min-h-screen bg-[#fafbfc]">

            {/* ── HERO IMAGE ──────────────────────────────────────────── */}
            {allImages.length > 0 && (
                <div className="relative w-full h-[55vh] md:h-[60vh] overflow-hidden">
                    <Image
                        src={allImages[galleryIdx]?.url || ''}
                        alt={allImages[galleryIdx]?.alt_text || event.title}
                        fill className="object-cover"
                    />
                    {/* Gradient overlay bas */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#fafbfc] via-transparent to-black/20" />
                    {/* Gradient overlay haut pour le bouton retour */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />

                    {/* Bouton retour */}
                    <div className="absolute top-6 left-4 md:left-8 z-10 pt-16 md:pt-0">
                        <Link href="/evenements"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/90 backdrop-blur-sm text-[#1a2332] text-xs font-bold shadow-lg hover:bg-white transition-all border border-white/50">
                            <ArrowLeft size={14} /> <T>Retour</T>
                        </Link>
                    </div>

                    {/* Navigation galerie */}
                    {allImages.length > 1 && (
                        <>
                            <button type="button" aria-label={t("Photo précédente")} onClick={() => setGalleryIdx(i => (i - 1 + allImages.length) % allImages.length)}
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 backdrop-blur-sm text-[#1a2332] flex items-center justify-center hover:bg-white transition-all shadow-lg border border-white/50 cursor-pointer">
                                <ChevronLeft size={18} />
                            </button>
                            <button type="button" aria-label={t("Photo suivante")} onClick={() => setGalleryIdx(i => (i + 1) % allImages.length)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 backdrop-blur-sm text-[#1a2332] flex items-center justify-center hover:bg-white transition-all shadow-lg border border-white/50 cursor-pointer">
                                <ChevronRight size={18} />
                            </button>
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                                {allImages.map((_, idx) => (
                                    <button type="button" key={idx} onClick={() => setGalleryIdx(idx)}
                                        className={`h-1.5 rounded-full transition-all cursor-pointer ${idx === galleryIdx ? 'bg-[#008751] w-8' : 'bg-white/50 w-2'}`} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── CONTENU ─────────────────────────────────────────────── */}
            <div className="max-w-6xl mx-auto px-4 pb-24"
                style={{ marginTop: allImages.length > 0 ? '-3rem' : '7rem' }}>

                {/* Bande drapeau décorative */}
                <div className="h-[4px] rounded-full mb-8 max-w-xs"
                    style={{ background: 'linear-gradient(90deg, #008751, #FCD116, #E8112D)' }} />

                <div className="grid lg:grid-cols-5 gap-8 items-start">

                    {/* ── GAUCHE — Description ── */}
                    <div className="lg:col-span-3 space-y-6">

                        {/* Header event */}
                        <div className="bg-white rounded-[24px] border border-gray-100 p-7 md:p-8 space-y-4"
                            style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

                            {/* Catégorie + partage */}
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-[#008751]/8 text-[#008751] border border-[#008751]/15">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#008751]" />
                                    {t(event.category)}
                                </span>
                                <button type="button"
                                    className="w-9 h-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-[#008751] hover:border-[#008751]/20 transition-all cursor-pointer">
                                    <Share2 size={14} />
                                </button>
                            </div>

                            <h1 className="text-3xl md:text-4xl font-black font-heading tracking-tight text-[#1a2332] leading-tight">
                                {t(event.title)}
                            </h1>

                            {/* Méta-infos */}
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f0fdf4] border border-[#008751]/10">
                                    <div className="w-9 h-9 rounded-xl bg-[#008751]/10 flex items-center justify-center flex-shrink-0">
                                        <Calendar size={15} className="text-[#008751]" />
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wide"><T>Date</T></div>
                                        <div className="text-xs font-bold text-[#1a2332]">{formatDate(event.start_date)}</div>
                                        <div className="text-[10px] text-gray-400">
                                            {formatTime(event.start_date)}
                                            {event.end_date && ` — ${formatTime(event.end_date)}`}
                                        </div>
                                    </div>
                                </div>

                                {event.location && (
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#fff1f2] border border-[#E8112D]/10">
                                        <div className="w-9 h-9 rounded-xl bg-[#E8112D]/10 flex items-center justify-center flex-shrink-0">
                                            <MapPin size={15} className="text-[#E8112D]" />
                                        </div>
                                        <div>
                                            <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wide"><T>Lieu</T></div>
                                            <div className="text-xs font-bold text-[#1a2332]">{t(event.location)}</div>
                                            {event.location_map_url && (
                                                <a href={event.location_map_url} target="_blank" rel="noopener noreferrer"
                                                    className="text-[10px] text-[#E8112D] hover:underline flex items-center gap-0.5">
                                                    Voir sur Maps <ExternalLink size={9} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {event.max_capacity > 0 && (
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                                            <Users size={15} className="text-gray-400" />
                                        </div>
                                        <div>
                                            <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wide"><T>Capacité</T></div>
                                            <div className="text-xs font-bold text-[#1a2332]">{event.max_capacity} places</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-[24px] border border-gray-100 p-7 md:p-8"
                            style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-4 h-[3px] rounded-full bg-[#008751]" />
                                <T>Description</T>
                            </h2>
                            <div className="text-[15px] text-gray-600 leading-relaxed whitespace-pre-line">
                                {t(event.description || event.short_description || 'Aucune description disponible.')}
                            </div>
                        </div>

                        {/* Galerie thumbnails */}
                        {allImages.length > 1 && (
                            <div className="bg-white rounded-[24px] border border-gray-100 p-6"
                                style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                                <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span className="w-4 h-[3px] rounded-full bg-[#FCD116]" />
                                    {t('Galerie')} ({allImages.length} {t('photos')})
                                </h2>
                                <div className="grid grid-cols-4 gap-2">
                                    {allImages.map((img, idx) => (
                                        <button type="button" key={idx} onClick={() => setGalleryIdx(idx)}
                                            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${idx === galleryIdx ? 'border-[#008751] shadow-md' : 'border-transparent hover:border-gray-200'}`}>
                                            <Image src={img.url} alt={img.alt_text || ''} fill className="object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── DROITE — Sticky CTA ── */}
                    <div className="lg:col-span-2">
                        <div className="sticky top-24 space-y-4">
                            <div className="bg-white rounded-[24px] border border-gray-100 overflow-hidden"
                                style={{ boxShadow: '0 8px 40px rgba(0,135,81,0.12)' }}>
                                {/* Top stripe */}
                                <div className="h-[5px]"
                                    style={{ background: 'linear-gradient(90deg, #008751, #FCD116, #E8112D)' }} />

                                <div className="p-6 space-y-5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1"><T>Rejoignez l'événement</T></div>
                                            <h3 className="text-lg font-black text-[#1a2332] leading-tight">{t(event.title)}</h3>
                                        </div>
                                        <CurrencySelector
                                            value={selectedCurrency}
                                            onChange={setSelectedCurrency}
                                            baseAmountXOF={event.price_standard || event.price_vip}
                                            theme="light"
                                        />
                                    </div>

                                    {/* Prix */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between p-4 rounded-2xl bg-[#f0fdf4] border border-[#008751]/15">
                                            <div className="flex items-center gap-2">
                                                <Ticket size={16} className="text-[#008751]" />
                                                <span className="text-sm font-bold text-[#1a2332]"><T>Standard</T></span>
                                            </div>
                                            {event.price_standard > 0 ? (
                                                <span className="text-lg font-black text-[#008751]">
                                                    {showPrice(event.price_standard)}
                                                </span>
                                            ) : (
                                                <span className="text-sm font-black text-[#008751]"><T>GRATUIT</T></span>
                                            )}
                                        </div>

                                        {event.price_vip > 0 && (
                                            <div className="flex items-center justify-between p-4 rounded-2xl bg-[#fefce8] border border-[#FCD116]/30">
                                                <div className="flex items-center gap-2">
                                                    <Crown size={16} className="text-amber-500" />
                                                    <span className="text-sm font-bold text-[#1a2332]"><T>VIP</T></span>
                                                </div>
                                                <span className="text-lg font-black text-amber-600">
                                                    {showPrice(event.price_vip)}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Boutons CTA */}
                                    <div className="space-y-3">
                                        <button type="button" onClick={() => openRegistration('standard')}
                                            className="w-full py-4 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                            style={{
                                                background: 'linear-gradient(135deg, #008751, #006039)',
                                                boxShadow: '0 8px 32px rgba(0,135,81,0.35)',
                                            }}>
                                            <Ticket size={16} />
                                            {event.price_standard === 0 ? t('Participer gratuitement') : `${t('Participer')} — ${showPrice(event.price_standard)}`}
                                        </button>

                                        {event.price_vip > 0 && (
                                            <button type="button" onClick={() => openRegistration('vip')}
                                                className="w-full py-4 rounded-2xl font-black text-sm text-[#1a2332] flex items-center justify-center gap-2.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                                style={{
                                                    background: 'linear-gradient(135deg, #FCD116, #f59e0b)',
                                                    boxShadow: '0 8px 32px rgba(252,209,22,0.4)',
                                                }}>
                                                <Crown size={16} />
                                                {t('Réserver VIP')} — {showPrice(event.price_vip)}
                                            </button>
                                        )}
                                    </div>

                                    <div className="pt-2 border-t border-gray-50 space-y-2">
                                        <div className="flex items-center gap-2 text-[11px] text-gray-400">
                                            <CheckCircle2 size={12} className="text-[#008751]" />
                                            <T>Ticket envoyé par email après inscription</T>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-gray-400">
                                            <CheckCircle2 size={12} className="text-[#008751]" />
                                            <T>Paiement 100% sécurisé</T>
                                        </div>
                                        {event.max_capacity > 0 && (
                                            <div className="flex items-center gap-2 text-[11px] text-gray-400">
                                                <Users size={12} className="text-[#008751]" />
                                                {t('Places limitées')} — {event.max_capacity} {t('au total')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── MODAL INSCRIPTION ─────────────────────────────────── */}
            <AnimatePresence>
                {showModal && event && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.94, opacity: 0, y: 16 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.94, opacity: 0, y: 16 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md bg-white rounded-[28px] overflow-hidden"
                            style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.2)' }}
                        >
                            {/* Bande drapeau top */}
                            <div className="h-[5px]"
                                style={{
                                    background: ticketType === 'vip'
                                        ? 'linear-gradient(90deg, #FCD116, #f59e0b)'
                                        : 'linear-gradient(90deg, #008751, #006039)'
                                }} />

                            {/* Header modal */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{
                                            background: ticketType === 'vip'
                                                ? 'linear-gradient(135deg, #FCD116, #f59e0b)'
                                                : 'linear-gradient(135deg, #008751, #006039)',
                                        }}>
                                        {ticketType === 'vip'
                                            ? <Crown size={18} className="text-[#1a2332]" />
                                            : <Ticket size={18} className="text-white" />}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-[#1a2332]">
                                            {t('Inscription')} {ticketType === 'vip' ? t('VIP') : t('Standard')}
                                        </h3>
                                        <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{event.title}</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-[#1a2332] hover:bg-gray-100 cursor-pointer transition-all">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                {success ? (
                                    /* ── SUCCESS ── */
                                    <motion.div
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="text-center py-8 space-y-4"
                                    >
                                        <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center"
                                            style={{ background: 'linear-gradient(135deg, #008751, #006039)', boxShadow: '0 12px 40px rgba(0,135,81,0.3)' }}>
                                            <CheckCircle2 size={36} className="text-white" />
                                        </div>
                                        <h4 className="text-xl font-black text-[#1a2332]"><T>Inscription confirmée !</T></h4>
                                        <p className="text-gray-500 text-sm leading-relaxed">
                                            <T>Votre ticket vous sera envoyé par email à</T>{' '}
                                            <strong className="text-[#008751]">{form.email}</strong>
                                        </p>
                                        <div className="flex items-center gap-2 justify-center text-[11px] text-gray-400 bg-gray-50 px-4 py-2 rounded-full border border-gray-100 w-fit mx-auto">
                                            <CheckCircle2 size={11} className="text-[#008751]" />
                                            <T>Ticket généré et sécurisé anti-fraude</T>
                                        </div>
                                        <button type="button" onClick={() => setShowModal(false)}
                                            className="text-[#008751] text-sm font-bold hover:underline cursor-pointer">
                                            <T>Fermer</T>
                                        </button>
                                    </motion.div>
                                ) : (
                                    <>
                                        {/* Stepper */}
                                        <div className="flex items-center gap-2 justify-center">
                                            {[t('Informations'), t('Paiement')].map((s, i) => (
                                                <div key={s} className="flex items-center gap-2">
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${formStep >= i
                                                        ? 'text-white shadow-md'
                                                        : 'bg-gray-100 text-gray-400'
                                                        }`}
                                                        style={formStep >= i ? {
                                                            background: ticketType === 'vip'
                                                                ? 'linear-gradient(135deg, #FCD116, #f59e0b)'
                                                                : 'linear-gradient(135deg, #008751, #006039)',
                                                            color: ticketType === 'vip' ? '#1a2332' : 'white',
                                                        } : {}}>
                                                        {i + 1}
                                                    </div>
                                                    <span className={`text-[11px] font-bold ${formStep >= i ? 'text-[#1a2332]' : 'text-gray-400'}`}>{s}</span>
                                                    {i < 1 && (
                                                        <div className={`w-8 h-px transition-all ${formStep > i ? 'bg-[#008751]' : 'bg-gray-200'}`} />
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Étape 1 — Informations */}
                                        {formStep === 0 && (
                                            <div className="space-y-4">
                                                {[
                                                    { key: 'full_name', label: 'Nom complet', icon: User, type: 'text', placeholder: 'Ex: Marc Essou', required: true },
                                                    { key: 'email', label: 'Email', icon: Mail, type: 'email', placeholder: 'votre@email.com', required: true },
                                                    { key: 'phone', label: 'Téléphone', icon: Phone, type: 'tel', placeholder: '+229 XX XX XX XX', required: true },
                                                    { key: 'whatsapp', label: 'WhatsApp (optionnel)', icon: Phone, type: 'tel', placeholder: '+229 XX XX XX XX', required: false },
                                                ].map(f => (
                                                    <div key={f.key}>
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                            <f.icon size={10} />
                                                            {t(f.label)}{f.required && <span className="text-[#E8112D]">*</span>}
                                                        </label>
                                                        <input
                                                            type={f.type}
                                                            value={form[f.key as keyof typeof form]}
                                                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                                            placeholder={t(f.placeholder)}
                                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[#1a2332] text-sm focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/10 transition-all placeholder-gray-400"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Étape 2 — Paiement */}
                                        {formStep === 1 && !isFree && (
                                            <div className="space-y-4">
                                                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-gray-500"><T>Montant à payer</T></span>
                                                        <CurrencySelector
                                                            value={selectedCurrency}
                                                            onChange={setSelectedCurrency}
                                                            baseAmountXOF={price}
                                                            theme="light"
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xl font-black"
                                                            style={{ color: ticketType === 'vip' ? '#d97706' : '#008751' }}>
                                                            {displayPrice}
                                                        </span>
                                                        {selectedCurrency !== 'XOF' && (
                                                            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                                                encaissé en XOF
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                                    <CreditCard size={10} /> <T>Moyen de paiement</T>
                                                </label>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {PAYMENT_METHODS.map(pm => (
                                                        <button type="button" key={pm.id}
                                                            onClick={() => setForm(f => ({ ...f, payment_method: pm.id }))}
                                                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${form.payment_method === pm.id
                                                                ? 'border-[#008751] bg-[#008751]/5 shadow-sm'
                                                                : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                                                                }`}>
                                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                                <div className="w-2 h-2 rounded-full" style={{ background: pm.color }} />
                                                                <div className="text-xs font-bold text-[#1a2332]">{pm.label}</div>
                                                            </div>
                                                            <div className="text-[10px] text-gray-400">{pm.sub}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {error && (
                                            <p className="text-xs text-[#E8112D] text-center bg-[#E8112D]/5 p-3 rounded-xl border border-[#E8112D]/15">
                                                {error}
                                            </p>
                                        )}

                                        <div className="flex gap-3">
                                            {formStep > 0 && (
                                                <button type="button" onClick={() => setFormStep(f => f - 1)}
                                                    className="flex-1 py-3 rounded-2xl border border-gray-200 text-xs font-bold text-gray-500 hover:text-[#1a2332] hover:border-gray-300 cursor-pointer transition-all">
                                                    <T>Retour</T>
                                                </button>
                                            )}
                                            <button type="button"
                                                onClick={() => {
                                                    if (formStep === 0 && !isFree) setFormStep(1)
                                                    else handleSubmit()
                                                }}
                                                disabled={submitting}
                                                className="flex-1 py-3 rounded-2xl text-xs font-black disabled:opacity-50 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                                style={{
                                                    background: ticketType === 'vip'
                                                        ? 'linear-gradient(135deg, #FCD116, #f59e0b)'
                                                        : 'linear-gradient(135deg, #008751, #006039)',
                                                    color: ticketType === 'vip' ? '#1a2332' : 'white',
                                                    boxShadow: ticketType === 'vip'
                                                        ? '0 8px 24px rgba(252,209,22,0.3)'
                                                        : '0 8px 24px rgba(0,135,81,0.3)',
                                                }}>
                                                {submitting ? t('Envoi...')
                                                    : formStep === 0 && !isFree ? t('Continuer')
                                                        : isFree ? t("Confirmer l'inscription")
                                                            : t('Procéder au paiement')}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
