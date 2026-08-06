'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { X, CheckCircle as CheckCircle2, CircleNotch as Loader2, ArrowRight, Phone, ChatText as MessageSquare, PaperPlaneTilt as Send, WarningCircle as AlertCircle, Star, CaretRight as ChevronRight, Sparkle as Sparkles } from '@phosphor-icons/react';
import PricingCalculator3D from '@/components/services/PricingCalculator3D'

// ── Types ─────────────────────────────────────────────────────────

export interface OrderableService {
    id: string           // slug / identifiant
    title: string
    description: string
    color: string        // gradient Tailwind (ex: 'from-purple-500 to-violet-600')
    icon?: React.ComponentType<{ size?: number; className?: string }>
    badge?: string
    features?: string[]
}

import { getServiceMode, MODE_COPY } from '@/lib/service-mode'
import FaPriestsDirectory from '@/components/services/FaPriestsDirectory'
import FaConsultationBooking from '@/components/services/FaConsultationBooking'

interface DBService {
    id: string
    title: string
    slug: string
    subtitle?: string
    description?: string
    features?: string[]
    pricing_options?: Array<{ label: string; price: string; features?: string[] }>
    color?: string       // hex CSS color (ex: '#a855f7')
    price_display?: string
    icon_type?: string
    delivery_mode?: string
}

interface ServiceOrderDrawerProps {
    service: OrderableService | null
    onClose: () => void
    onSuccess?: (dossierId: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────

// Map Tailwind color tokens to CSS hex values for PricingCalculator3D
const TW_HEX: Record<string, string> = {
    'blue-400': '#60a5fa', 'blue-500': '#3b82f6', 'blue-600': '#2563eb',
    'indigo-400': '#818cf8', 'indigo-500': '#6366f1', 'indigo-600': '#4f46e5',
    'violet-400': '#a78bfa', 'violet-500': '#8b5cf6', 'violet-600': '#7c3aed',
    'purple-400': '#c084fc', 'purple-500': '#a855f7', 'purple-600': '#9333ea',
    'emerald-400': '#34d399', 'emerald-500': '#10b981', 'emerald-600': '#059669',
    'green-500': '#22c55e',  'teal-500': '#14b8a6',
    'amber-500': '#f59e0b',  'orange-500': '#f97316',
    'rose-500': '#f43f5e',   'pink-500': '#ec4899',
    'red-500': '#ef4444',    'yellow-500': '#eab308',
    'cyan-500': '#06b6d4',   'sky-500': '#0ea5e9',
}
function twToHex(colorClass: string): string {
    const match = colorClass.match(/from-([a-z]+-\d+)/)
    if (match && TW_HEX[match[1]]) return TW_HEX[match[1]]
    return '#3b82f6'
}

// ── Composant ────────────────────────────────────────────────────

export function ServiceOrderDrawer({ service, onClose, onSuccess }: ServiceOrderDrawerProps) {
    const [description, setDescription] = useState('')
    const [phone, setPhone] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [createdRef, setCreatedRef] = useState('')
    const [clientEmail, setClientEmail] = useState('')

    // Full service data from DB
    const [dbService, setDbService] = useState<DBService | null>(null)
    const [loadingData, setLoadingData] = useState(false)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.email) setClientEmail(session.user.email)
        })
    }, [])

    // Fetch full service data when drawer opens
    useEffect(() => {
        if (!service?.id) return
        setDbService(null)
        setLoadingData(true)

        fetch(`/api/services/${encodeURIComponent(service.id)}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.service) setDbService(data.service)
            })
            .catch(() => {})
            .finally(() => setLoadingData(false))
    }, [service?.id])

    // Reset form when service changes
    useEffect(() => {
        setDescription('')
        setPhone('')
        setError('')
        setSuccess(false)
        setCreatedRef('')
    }, [service?.id])

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!service) return
        if (!description.trim()) {
            setError('Veuillez décrire votre besoin.')
            return
        }

        setSubmitting(true)
        setError('')

        try {
            const session = await supabase.auth.getSession()
            const token = session.data.session?.access_token

            const res = await fetch('/api/client/service-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    service_id: service.id,
                    service_type: service.title,
                    service_title: service.title,
                    description: description.trim(),
                    phone: phone.trim() || undefined,
                    client_email: clientEmail,
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erreur lors de la soumission')

            setCreatedRef(data.dossier?.num_dossier || '')
            setSuccess(true)
            onSuccess?.(data.dossier?.id || '')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue')
        } finally {
            setSubmitting(false)
        }
    }

    // Determine the hex color for PricingCalculator3D
    const baseColor = dbService?.color || twToHex(service?.color || '')

    // Comment ce service se commande-t-il ? Un service sur rendez-vous ne doit
    // jamais afficher un libellé de paiement, et un tarif « À partir de » n'est
    // pas un montant ferme. Voir lib/service-mode.ts.
    const mode = getServiceMode({
        slug: dbService?.slug || service?.id,
        delivery_mode: dbService?.delivery_mode,
    })
    const modeCopy = MODE_COPY[mode]

    return (
        <AnimatePresence>
            {service && (
                <>
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300]"
                        onClick={onClose}
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                        className="fixed right-0 top-0 h-full w-full max-w-lg bg-[#060d1a] border-l border-white/[0.08] z-[301] flex flex-col overflow-hidden shadow-2xl"
                    >
                        {/* ── Header gradient ── */}
                        <div className={`bg-gradient-to-br ${service.color} p-[1px] flex-shrink-0`}>
                            <div className="bg-[#060d1a] px-6 py-5">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex-1 min-w-0">
                                        {service.badge && (
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1 block">{service.badge}</span>
                                        )}
                                        <h2 className="text-xl font-black text-white leading-tight">{service.title}</h2>
                                        {dbService?.subtitle ? (
                                            <p className="text-blue-300/80 text-[11px] font-semibold mt-0.5 italic">{dbService.subtitle}</p>
                                        ) : (
                                            <p className="text-gray-400 text-sm mt-1 leading-relaxed">{service.description}</p>
                                        )}
                                    </div>
                                    <button type="button" onClick={onClose} title="Fermer"
                                        className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-colors flex-shrink-0">
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Features pills from service prop (basic tags) */}
                                {service.features && service.features.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {service.features.map((feat, i) => (
                                            <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-gray-300">
                                                {feat}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Corps (scrollable) ── */}
                        <div className="flex-1 overflow-y-auto">
                            {success ? (
                                /* ── État succès ── */
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                    className="h-full flex flex-col items-center justify-center text-center gap-4 py-8 px-6">
                                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                                        <CheckCircle2 size={32} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-black text-lg mb-2">Demande envoyée !</h3>
                                        <p className="text-gray-400 text-sm leading-relaxed">
                                            Votre demande a bien été reçue. Notre équipe vous contactera sous 24-48h.
                                        </p>
                                        {createdRef && (
                                            <p className="mt-2 text-[11px] font-mono text-gray-500">Référence : <span className="text-blue-400">{createdRef}</span></p>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2 w-full max-w-xs">
                                        <Link href="/client/dossier"
                                            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-bold transition-all border border-blue-500/20">
                                            Voir dans mon dossier <ArrowRight size={14} />
                                        </Link>
                                        <button type="button" onClick={onClose}
                                            className="px-5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] text-gray-400 text-sm font-bold transition-all border border-white/[0.06]">
                                            Fermer
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="p-6 space-y-6">
                                    {/* ── Loading service data ── */}
                                    {loadingData && (
                                        <div className="flex items-center justify-center py-6">
                                            <Loader2 size={20} className="animate-spin text-blue-400" />
                                        </div>
                                    )}

                                    {/* ── Full service content from DB ── */}
                                    {!loadingData && dbService && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

                                            {/* Description complète */}
                                            {dbService.description && dbService.description !== service.description && (
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-1.5">
                                                        <Sparkles size={9} />À propos de ce service
                                                    </p>
                                                    <p className="text-gray-300 text-[12.5px] leading-relaxed">
                                                        {dbService.description}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Features list from DB */}
                                            {dbService.features && dbService.features.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-1.5">
                                                        <Star size={9} />Ce qui est inclus
                                                    </p>
                                                    <div className="space-y-1.5">
                                                        {dbService.features.map((feat, i) => (
                                                            <div key={i} className="flex items-start gap-2.5">
                                                                <div className="mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                                                                    style={{ backgroundColor: `${baseColor}20`, border: `1px solid ${baseColor}40` }}>
                                                                    <ChevronRight size={9} style={{ color: baseColor }} />
                                                                </div>
                                                                <span className="text-[12px] text-gray-300 leading-snug">{feat}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Calculateur de prix */}
                                            {dbService.pricing_options && dbService.pricing_options.length > 0 ? (
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-1.5">
                                                        <span></span>Tarifs & Options
                                                    </p>
                                                    <PricingCalculator3D
                                                        options={dbService.pricing_options}
                                                        baseColor={baseColor}
                                                        serviceName={dbService.title || service.title}
                                                    />
                                                </div>
                                            ) : dbService.price_display ? (
                                                <div className="rounded-xl p-4 border" style={{ backgroundColor: `${baseColor}10`, borderColor: `${baseColor}30` }}>
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: baseColor }}>Tarif</p>
                                                    <p className="text-white font-black text-lg">{dbService.price_display}</p>
                                                </div>
                                            ) : null}

                                            {/* Séparateur vers formulaire */}
                                            <div className="relative flex items-center gap-3 py-1">
                                                <div className="flex-1 h-px bg-white/[0.06]" />
                                                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-600">Commander ce service</span>
                                                <div className="flex-1 h-px bg-white/[0.06]" />
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* ── Parcours réel « Consultation Fa & Racines » ──
                                        On réutilise EXACTEMENT les composants du site public
                                        (annuaire des prêtres + réservation avec paiement
                                        Kkiapay/FedaPay). Rien n'est réécrit ni simulé : même
                                        code, mêmes tarifs admin, même pipeline
                                        fa-checkout → widget → /api/checkout/verify. */}
                                    {mode === 'booking' && (
                                        <div className="space-y-6">
                                            <FaPriestsDirectory />
                                            <FaConsultationBooking options={dbService?.pricing_options} />
                                        </div>
                                    )}

                                    {/* ── Formulaire de demande (services sur rendez-vous) ── */}
                                    {mode !== 'booking' && (
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div>
                                            {!dbService && (
                                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-4">
                                                    Décrivez votre besoin
                                                </p>
                                            )}

                                            {/* Description */}
                                            <div className="space-y-1.5">
                                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
                                                    <MessageSquare size={11} />
                                                    Votre demande <span className="text-red-400">*</span>
                                                </label>
                                                <textarea
                                                    value={description}
                                                    onChange={e => { setDescription(e.target.value); setError('') }}
                                                    placeholder={`Décrivez votre besoin pour ${service.title}...`}
                                                    rows={4}
                                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/40 focus:bg-white/[0.06] resize-none transition-all"
                                                />
                                                <p className="text-[10px] text-gray-600 text-right">{description.length}/1000</p>
                                            </div>

                                            {/* Téléphone */}
                                            <div className="space-y-1.5 mt-3">
                                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
                                                    <Phone size={11} />
                                                    Téléphone / WhatsApp <span className="text-gray-600">(optionnel)</span>
                                                </label>
                                                <input
                                                    type="tel"
                                                    value={phone}
                                                    onChange={e => setPhone(e.target.value)}
                                                    placeholder="+229 XX XX XX XX"
                                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/40 focus:bg-white/[0.06] transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* Compte connecté */}
                                        {clientEmail && (
                                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-500/8 border border-blue-500/15">
                                                <CheckCircle2 size={12} className="text-blue-400 flex-shrink-0" />
                                                <p className="text-[11px] text-blue-300/80">
                                                    Demande liée à : <span className="font-bold">{clientEmail}</span>
                                                </p>
                                            </div>
                                        )}

                                        {/* Erreur */}
                                        {error && (
                                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                                                <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
                                                <p className="text-[11px] text-red-300">{error}</p>
                                            </div>
                                        )}

                                        {/* Info délai */}
                                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px] text-gray-500 leading-relaxed">
                                            Notre équipe traitera votre demande sous <span className="text-gray-300 font-bold">24 à 48h</span> ouvrables. Vous recevrez une confirmation par email et un suivi dans votre espace client.
                                        </div>
                                    </form>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── Footer ──
                            Masqué en mode « booking » : la réservation Fa a son propre
                            bouton de paiement, en afficher un second créerait deux
                            actions concurrentes pour un même geste. */}
                        {!success && mode !== 'booking' && (
                            <div className="flex-shrink-0 p-4 border-t border-white/[0.06] bg-[#060d1a]">
                                {/* Ce qui se passe après l'envoi : dit explicitement s'il y aura
                                    paiement, devis ou prise de rendez-vous. */}
                                <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--panel-text-muted)' }}>
                                    {modeCopy.note}
                                </p>
                                <button type="button" onClick={handleSubmit} disabled={submitting || !description.trim()}
                                    className={`w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-black transition-all ${
                                        submitting || !description.trim()
                                            ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                                            : `bg-gradient-to-r ${service.color} text-white hover:opacity-90 shadow-lg`
                                    }`}>
                                    {submitting ? (
                                        <><Loader2 size={15} className="animate-spin" /> Envoi en cours...</>
                                    ) : (
                                        <><Send size={15} /> {modeCopy.cta}</>
                                    )}
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
