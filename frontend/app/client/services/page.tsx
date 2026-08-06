'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Briefcase, CheckCircle as CheckCircle2, Clock, WarningCircle as AlertCircle, CaretRight as ChevronRight, ArrowRight, ArrowSquareOut as ExternalLink, CircleNotch as Loader2, ArrowClockwise as RefreshCw, ShoppingBag, Globe, Users, Medal as Award, FileMagnifyingGlass as FileSearch, Package, CaretDown as ChevronDown, CaretUp as ChevronUp, Calendar, TrendUp as TrendingUp, Sparkle as Sparkles, Star, Lightning as Zap } from '@phosphor-icons/react';
import { ServiceOrderDrawer, type OrderableService } from '@/components/client/ServiceOrderDrawer'

// ── Types ─────────────────────────────────────────────────────────
interface Service {
    id: string
    title: string
    slug: string
    description: string
    icon_type: string
    color: string
    is_active: boolean
    order_index: number
}

interface Dossier {
    id: string
    num_dossier: string
    service_type: string
    statut: string
    progression: number
    etapes: Array<{ label?: string; status: string; date?: string }>
    documents_manquants: string[]
    notes: string
    created_at: string
    updated_at: string
}

interface NationalityApp {
    id: string
    reference: string
    status: string
    amount: number
    currency: string
    payment_status: string
    created_at: string
    needs_recherche_ancestrale: boolean
    recherche_ancestrale_paid: boolean
    recherche_ancestrale_ref: string | null
    missing_docs: string[] | null
    docs_deadline: string | null
}

interface Order {
    id: string
    product_title: string
    amount: number
    currency: string
    payment_status: string
    created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────
const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    reception:    { label: 'Reçu',        color: 'text-[var(--panel-accent)]',    bg: 'bg-[var(--panel-accent-soft)]',    dot: 'bg-[var(--panel-accent)]' },
    verification: { label: 'Vérification',color: 'text-[var(--panel-accent)]',  bg: 'bg-[var(--panel-accent-soft)]',  dot: 'bg-[var(--panel-accent)]' },
    traitement:   { label: 'Traitement',  color: 'text-amber-400',   bg: 'bg-amber-500/15',   dot: 'bg-amber-400' },
    validation:   { label: 'Validation',  color: 'text-[var(--panel-accent)]',  bg: 'bg-[var(--panel-accent-soft)]',  dot: 'bg-[var(--panel-accent)]' },
    finalisation: { label: 'Finalisation',color: 'text-teal-400',    bg: 'bg-teal-500/15',    dot: 'bg-teal-400' },
    termine:      { label: 'Terminé',     color: 'text-emerald-400', bg: 'bg-emerald-500/15', dot: 'bg-emerald-400' },
    annule:       { label: 'Annulé',      color: 'text-gray-400',    bg: 'bg-gray-500/15',    dot: 'bg-gray-400' },
    soumis:       { label: 'Soumis',      color: 'text-[var(--panel-accent)]',    bg: 'bg-[var(--panel-accent-soft)]',    dot: 'bg-[var(--panel-accent)]' },
    en_traitement:{ label: 'En cours',    color: 'text-amber-400',   bg: 'bg-amber-500/15',   dot: 'bg-amber-400' },
    approuve:     { label: 'Approuvé',    color: 'text-emerald-400', bg: 'bg-emerald-500/15', dot: 'bg-emerald-400' },
    rejete:       { label: 'Rejeté',      color: 'text-red-400',     bg: 'bg-red-500/15',     dot: 'bg-red-400' },
}

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
    pending:   { label: 'En attente',  color: 'text-amber-400' },
    completed: { label: 'Réglé',       color: 'text-emerald-400' },
    paid:      { label: 'Réglé',       color: 'text-emerald-400' },
    succeeded: { label: 'Réglé',       color: 'text-emerald-400' },
    failed:    { label: 'Échoué',      color: 'text-red-400' },
    refunded:  { label: 'Remboursé',   color: 'text-gray-400' },
}

const SERVICE_TYPE_LABEL: Record<string, string> = {
    'nationalite': 'Nationalité VIP',
    'recherche-ancestrale': 'Recherche Ancestrale',
    'transport': 'Transport & Logistique',
    'sante': 'Santé',
    'scolarite': 'Scolarité & Éducation',
    'administratif': 'Démarches Admin.',
}

const SERVICE_TYPE_COLOR: Record<string, string> = {
    'nationalite': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    'recherche-ancestrale': 'text-[var(--panel-accent)] bg-[var(--panel-accent-soft)] border-[var(--panel-accent)]/20',
    'transport': 'text-[var(--panel-accent)] bg-[var(--panel-accent-soft)] border-[var(--panel-accent)]/20',
    'sante': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    'scolarite': 'text-[var(--panel-accent)] bg-[var(--panel-accent-soft)] border-[var(--panel-accent)]/20',
    'administratif': 'text-teal-400 bg-teal-500/10 border-teal-500/20',
}

// Services spéciaux mis en avant (fixes)
const FEATURED_SERVICES = [
    {
        id: 'nationalite',
        title: 'Nationalité VIP',
        description: 'Récupérez votre nationalité béninoise. Service complet de A à Z avec accompagnement personnalisé.',
        icon: Award,
        color: 'from-amber-500 to-orange-600',
        glow: 'shadow-[0_4px_20px_rgba(245,158,11,0.25)]',
        badge: 'Service Phare',
        href: '/nationalite/formulaire',
        ctaLabel: 'Déposer ma demande',
    },
    {
        id: 'recherche-ancestrale',
        title: 'Recherche Ancestrale',
        description: 'Retrouvez vos racines africaines. Recherche dans les archives et bases de données spécialisées.',
        icon: FileSearch,
        color: 'bg-[var(--panel-accent)]',
        glow: 'shadow-[0_4px_20px_rgba(168,85,247,0.25)]',
        badge: 'Expertise IA',
        href: '/services#recherche-ancestrale',
        ctaLabel: 'En savoir plus',
    },
    {
        id: 'autres',
        title: 'Autres Services',
        description: 'Transport, santé, scolarité, démarches administratives... Nous vous accompagnons sur tous vos projets.',
        icon: Globe,
        color: 'from-[var(--panel-accent)] to-[var(--panel-accent-soft)]',
        glow: 'shadow-[0_4px_20px_rgba(59,130,246,0.25)]',
        badge: 'Multi-services',
        href: '/services',
        ctaLabel: 'Voir tous les services',
    },
    {
        id: 'boutique',
        title: 'Boutique',
        description: 'Produits, formations et ressources pour votre retour au Bénin. Livraison disponible.',
        icon: ShoppingBag,
        color: 'from-emerald-500 to-teal-600',
        glow: 'shadow-[0_4px_20px_rgba(16,185,129,0.25)]',
        badge: 'Achat en ligne',
        href: '/boutique',
        ctaLabel: 'Explorer la boutique',
    },
]

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR')

// Ajoute ?back=/client/services à un href (gère les fragments # et les params existants)
const withBack = (href: string, extra?: Record<string, string>) => {
    const [path, hash] = href.split('#')
    const params = new URLSearchParams({ ...(extra || {}), back: '/client/services' })
    return `${path}?${params.toString()}${hash ? '#' + hash : ''}`
}

// ── Composant DossierCard ─────────────────────────────────────────
function DossierCard({ dossier, expanded, onToggle }: {
    dossier: Dossier
    expanded: boolean
    onToggle: () => void
}) {
    const s = STATUT_CONFIG[dossier.statut] || { label: dossier.statut, color: 'text-gray-400', bg: 'bg-gray-500/15', dot: 'bg-gray-400' }
    const etapes = Array.isArray(dossier.etapes) ? dossier.etapes : []
    const completedSteps = etapes.filter(e => e.status === 'completed').length
    const typeColor = SERVICE_TYPE_COLOR[dossier.service_type] || 'text-gray-400 bg-gray-500/10 border-gray-500/20'
    const typeLabel = SERVICE_TYPE_LABEL[dossier.service_type] || dossier.service_type

    return (
        <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#0a1221] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/10 transition-colors">
            <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeColor}`}>
                                {typeLabel}
                            </span>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${s.bg} ${s.color}`}>
                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${s.dot}`} />
                                {s.label}
                            </span>
                        </div>
                        <h3 className="text-white font-black text-base">{dossier.num_dossier}</h3>
                        <p className="text-gray-500 text-[11px] mt-0.5">Créé le {fmtDate(dossier.created_at)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className={`text-2xl font-black ${s.color}`}>{dossier.progression}%</p>
                        <p className="text-gray-600 text-[10px]">{completedSteps}/{etapes.length || '—'} étapes</p>
                    </div>
                </div>

                {/* Barre de progression */}
                <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                    <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--panel-accent)] to-[var(--panel-accent-soft)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${dossier.progression}%` }}
                        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
                    />
                </div>

                {/* Alerte documents manquants */}
                {dossier.documents_manquants?.length > 0 && (
                    <div className="mb-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                        <p className="text-amber-400 text-[11px] font-bold flex items-center gap-1.5 mb-2">
                            <AlertCircle size={11} /> Documents requis ({dossier.documents_manquants.length})
                        </p>
                        <ul className="space-y-1">
                            {dossier.documents_manquants.slice(0, 3).map((doc, i) => (
                                <li key={i} className="flex items-center gap-1.5 text-[11px] text-gray-300">
                                    <div className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" />
                                    {doc}
                                </li>
                            ))}
                            {dossier.documents_manquants.length > 3 && (
                                <li className="text-[10px] text-amber-400/60">+{dossier.documents_manquants.length - 3} autres</li>
                            )}
                        </ul>
                    </div>
                )}

                {/* Note de l'agent */}
                {dossier.notes && !expanded && (
                    <p className="text-gray-500 text-[11px] italic line-clamp-1 mb-3">"{dossier.notes}"</p>
                )}

                {/* Toggle étapes */}
                <button type="button" onClick={onToggle}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-[var(--panel-accent)] transition-colors w-full">
                    {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {expanded ? 'Masquer les étapes' : `Voir les ${etapes.length || 'les'} étapes`}
                </button>
            </div>

            {/* Étapes détaillées */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border-t border-white/[0.06]"
                    >
                        <div className="p-5 space-y-2">
                            {etapes.map((etape, i) => {
                                const done = etape.status === 'completed'
                                const inProgress = etape.status === 'in_progress'
                                return (
                                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${done ? 'bg-emerald-500/8' : inProgress ? 'bg-[var(--panel-accent-soft)] border border-[var(--panel-accent)]/20' : 'bg-white/[0.02]'}`}>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black ${done ? 'bg-emerald-500 text-white' : inProgress ? 'bg-[var(--panel-accent-soft)] text-[var(--panel-accent)] border border-[var(--panel-accent)]/50' : 'bg-white/5 text-gray-600'}`}>
                                            {done ? <CheckCircle2 size={13} /> : inProgress ? <Clock size={12} className="animate-pulse" /> : i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-bold ${done ? 'text-emerald-400' : inProgress ? 'text-white' : 'text-gray-500'}`}>
                                                {etape.label || `Étape ${i + 1}`}
                                            </p>
                                            {etape.date && (
                                                <p className="text-[10px] text-gray-600 flex items-center gap-1 mt-0.5">
                                                    <Calendar size={9} />{fmtDate(etape.date)}
                                                </p>
                                            )}
                                        </div>
                                        {inProgress && <span className="text-[9px] font-black bg-[var(--panel-accent-soft)] text-[var(--panel-accent)] px-2 py-0.5 rounded-full flex-shrink-0">EN COURS</span>}
                                    </div>
                                )
                            })}

                            {dossier.notes && (
                                <div className="mt-2 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-1">Note de l'agent</p>
                                    <p className="text-sm text-gray-300 leading-relaxed">{dossier.notes}</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Footer */}
            <div className="px-5 pb-4 flex items-center justify-between">
                <Link href="/client/dossier"
                    className="flex items-center gap-1.5 text-[11px] text-[var(--panel-accent)] hover:text-[var(--panel-accent)] font-bold transition-colors">
                    Gérer ce dossier <ExternalLink size={10} />
                </Link>
                {dossier.updated_at && (
                    <p className="text-[10px] text-gray-600">MàJ {fmtDate(dossier.updated_at)}</p>
                )}
            </div>
        </motion.div>
    )
}

// ══════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════════════════════════════════════════════
export default function ClientServicesPage() {
    const [clientId, setClientId] = useState('')
    const [clientEmail, setClientEmail] = useState('')
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    // Drawer commande de service
    const [drawerService, setDrawerService] = useState<OrderableService | null>(null)

    const [services, setServices] = useState<Service[]>([])
    const [dossiers, setDossiers] = useState<Dossier[]>([])
    const [nationalityApps, setNationalityApps] = useState<NationalityApp[]>([])
    const [orders, setOrders] = useState<Order[]>([])

    const [expandedDossier, setExpandedDossier] = useState<string | null>(null)
    const [activeSection, setActiveSection] = useState<'catalogue' | 'actifs' | 'commandes'>('actifs')

    const loadData = async (uid: string, email: string, silent = false) => {
        if (!silent) setLoading(true)
        else setRefreshing(true)

        const [
            { data: servicesData },
            { data: dossiersData },
            { data: natAppsData },
            { data: ordersData },
        ] = await Promise.all([
            supabase
                .from('services')
                .select('*')
                .eq('is_active', true)
                .order('order_index', { ascending: true }),
            supabase
                .from('dossier_tracking')
                .select('*')
                .or(`client_id.eq.${uid},client_email.eq.${email}`)
                .order('created_at', { ascending: false }),
            supabase
                .from('nationality_applications')
                .select('id, reference, status, amount, currency, payment_status, created_at, needs_recherche_ancestrale, recherche_ancestrale_paid, recherche_ancestrale_ref, missing_docs, docs_deadline')
                .eq('email', email)
                .order('created_at', { ascending: false }),
            supabase
                .from('orders')
                .select('id, product_title, amount, currency, payment_status, created_at')
                .or(`client_id.eq.${uid},client_email.eq.${email}`)
                .order('created_at', { ascending: false })
                .limit(10),
        ])

        setServices(servicesData || [])
        setDossiers(dossiersData || [])
        setNationalityApps(natAppsData || [])
        setOrders(ordersData || [])

        if (!silent) setLoading(false)
        else setRefreshing(false)
    }

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) return
            const uid = session.user.id
            const email = session.user.email || ''
            setClientId(uid)
            setClientEmail(email)
            await loadData(uid, email)
        }
        init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Realtime : dossier_tracking + orders + nationality_applications
    useEffect(() => {
        if (!clientId) return
        const channel = supabase
            .channel(`client-services-${clientId}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'dossier_tracking', filter: `client_id=eq.${clientId}` },
                () => loadData(clientId, clientEmail, true)
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'orders', filter: `client_id=eq.${clientId}` },
                () => loadData(clientId, clientEmail, true)
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'nationality_applications', filter: `email=eq.${clientEmail}` },
                () => loadData(clientId, clientEmail, true)
            )
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId, clientEmail])

    const hasActiveServices = dossiers.length > 0 || nationalityApps.length > 0
    const hasOrders = orders.length > 0

    const SECTIONS = [
        { id: 'actifs' as const, label: 'Mes services actifs', count: dossiers.length + nationalityApps.length },
        { id: 'catalogue' as const, label: 'Commander un service', count: 0 },
        { id: 'commandes' as const, label: 'Mes commandes', count: orders.length },
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center h-80">
                <div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--panel-border)', borderTopColor: 'var(--panel-accent)' }} />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center gap-2 mb-1">
                    <Briefcase size={14} className="text-[var(--panel-accent)]" />
                    <span className="text-[10px] font-bold text-[var(--panel-accent)] uppercase tracking-[0.3em]">Espace Client</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-white">Mes Services</h1>
                        <p className="text-gray-500 text-sm mt-1">Commandez et suivez vos services en temps réel.</p>
                    </div>
                    <button type="button" onClick={() => loadData(clientId, clientEmail, true)} disabled={refreshing}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-gray-400 hover:text-white text-[11px] font-bold transition-all disabled:opacity-50">
                        <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                        Actualiser
                    </button>
                </div>
            </motion.div>

            {/* Navigation sections */}
            <div className="flex gap-1 bg-white/[0.03] border border-white/5 rounded-2xl p-1">
                {SECTIONS.map(section => (
                    <button key={section.id} type="button" onClick={() => setActiveSection(section.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                            activeSection === section.id
                                ? 'bg-[var(--panel-accent-soft)] text-[var(--panel-accent)] border border-[var(--panel-accent)]/20'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        }`}>
                        <span className="hidden sm:inline">{section.label}</span>
                        <span className="sm:hidden">{section.label.split(' ')[0]}</span>
                        {section.count > 0 && (
                            <span className={`min-w-[18px] h-[18px] text-[10px] font-black rounded-full flex items-center justify-center px-1 ${activeSection === section.id ? 'bg-[var(--panel-accent)] text-white' : 'bg-white/10 text-gray-400'}`}>
                                {section.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {/* ── SECTION : Mes services actifs ── */}
                {activeSection === 'actifs' && (
                    <motion.div key="actifs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">

                        {/* Nationalité applications */}
                        {nationalityApps.map(app => {
                            const s = STATUT_CONFIG[app.status] || { label: app.status, color: 'text-gray-400', bg: 'bg-gray-500/15', dot: 'bg-gray-400' }
                            return (
                                <motion.div key={app.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                                    className="bg-[#0a1221] border border-amber-500/20 rounded-2xl p-5">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-amber-400 bg-amber-500/10 border border-amber-500/20">
                                                    Nationalité VIP
                                                </span>
                                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${s.bg} ${s.color}`}>
                                                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${s.dot}`} />
                                                    {s.label}
                                                </span>
                                            </div>
                                            <h3 className="text-white font-black text-base">{app.reference}</h3>
                                            <p className="text-gray-500 text-[11px] mt-0.5">Soumis le {fmtDate(app.created_at)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-xs font-bold ${PAYMENT_STATUS[app.payment_status]?.color || 'text-gray-400'}`}>
                                                {PAYMENT_STATUS[app.payment_status]?.label || app.payment_status}
                                            </p>
                                            <p className="text-white font-mono font-black text-sm">{fmtN(app.amount)} {app.currency}</p>
                                        </div>
                                    </div>

                                    {/* Documents manquants Nationalité */}
                                    {app.missing_docs && app.missing_docs.length > 0 && (
                                        <div className="mb-3 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                                            <p className="text-amber-400 text-[11px] font-bold flex items-center gap-1.5 mb-1.5">
                                                <AlertCircle size={11} /> Documents manquants
                                            </p>
                                            {app.docs_deadline && (
                                                <p className="text-amber-300/70 text-[10px] mb-1.5">
                                                    Délai : {fmtDate(app.docs_deadline)}
                                                </p>
                                            )}
                                            <ul className="space-y-1">
                                                {app.missing_docs.map((d, i) => (
                                                    <li key={i} className="flex items-center gap-1.5 text-[11px] text-gray-300">
                                                        <div className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" />
                                                        {d}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Recherche Ancestrale upsell / status */}
                                    {app.needs_recherche_ancestrale && !app.recherche_ancestrale_paid && (
                                        <div className="mb-3 p-3 bg-[var(--panel-accent-soft)] border border-[var(--panel-accent)]/20 rounded-xl flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[var(--panel-accent)] text-[11px] font-bold flex items-center gap-1.5 mb-0.5">
                                                    <Star size={11} /> Recherche Ancestrale disponible
                                                </p>
                                                <p className="text-[var(--panel-accent)] text-[10px]">Complétez votre dossier avec une recherche dans les archives.</p>
                                            </div>
                                            <Link href={withBack('/services#recherche-ancestrale')}
                                                className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-[var(--panel-accent-soft)] hover:bg-[var(--panel-accent-soft)] text-[var(--panel-accent)] transition-all">
                                                En savoir plus <ArrowRight size={10} />
                                            </Link>
                                        </div>
                                    )}

                                    {app.recherche_ancestrale_paid && app.recherche_ancestrale_ref && (
                                        <div className="mb-3 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
                                            <p className="text-emerald-400 text-[11px] font-bold flex items-center gap-1.5">
                                                <CheckCircle2 size={11} /> Recherche Ancestrale — {app.recherche_ancestrale_ref}
                                            </p>
                                        </div>
                                    )}

                                    <Link href="/client/dossier"
                                        className="inline-flex items-center gap-1.5 text-[11px] text-[var(--panel-accent)] hover:text-[var(--panel-accent)] font-bold transition-colors">
                                        Voir le suivi complet <ChevronRight size={11} />
                                    </Link>
                                </motion.div>
                            )
                        })}

                        {/* Dossiers tracking */}
                        {dossiers.map(dossier => (
                            <DossierCard
                                key={dossier.id}
                                dossier={dossier}
                                expanded={expandedDossier === dossier.id}
                                onToggle={() => setExpandedDossier(expandedDossier === dossier.id ? null : dossier.id)}
                            />
                        ))}

                        {/* État vide */}
                        {!hasActiveServices && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="bg-[#0a1221] border border-white/[0.06] rounded-2xl p-12 text-center">
                                <div className="w-16 h-16 rounded-2xl bg-[var(--panel-accent-soft)] border border-[var(--panel-accent)]/20 flex items-center justify-center mx-auto mb-4">
                                    <Briefcase size={28} className="text-[var(--panel-accent)]" />
                                </div>
                                <h2 className="text-white font-bold text-lg mb-2">Aucun service actif</h2>
                                <p className="text-gray-500 text-sm mb-6">Vous n'avez pas encore de service en cours.<br />Découvrez ce que nous pouvons faire pour vous.</p>
                                <button type="button" onClick={() => setActiveSection('catalogue')}
                                    style={{ background: 'var(--panel-accent)' }}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:-translate-y-px active:translate-y-0">
                                    <Sparkles size={14} />
                                    Découvrir nos services
                                </button>
                            </motion.div>
                        )}
                    </motion.div>
                )}

                {/* ── SECTION : Catalogue ── */}
                {activeSection === 'catalogue' && (
                    <motion.div key="catalogue" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-6">

                        {/* Services mis en avant */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                <Zap size={10} className="text-[var(--panel-accent)]" /> Services phares
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {FEATURED_SERVICES.map((svc, i) => {
                                    const Icon = svc.icon
                                    const isNat = svc.id === 'nationalite'
                                    const hasActive = isNat && nationalityApps.length > 0
                                    return (
                                        <motion.div key={svc.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                            className="bg-[#0a1221] border border-white/[0.06] rounded-2xl p-5 hover:border-white/10 transition-all group">
                                            <div className="flex items-start gap-4">
                                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${svc.color} p-[1px] flex-shrink-0 ${svc.glow}`}>
                                                    <div className="w-full h-full bg-[#0a1221] rounded-[10px] flex items-center justify-center">
                                                        <Icon size={22} className="text-white/80" />
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <h3 className="text-white font-black text-sm">{svc.title}</h3>
                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/8">
                                                            {svc.badge}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-500 text-xs leading-relaxed mb-4">{svc.description}</p>
                                                    {hasActive ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold">
                                                                <CheckCircle2 size={11} /> Service actif
                                                            </span>
                                                            <button type="button" onClick={() => setActiveSection('actifs')}
                                                                className="flex items-center gap-1 text-[10px] text-[var(--panel-accent)] hover:text-[var(--panel-accent)] font-bold transition-colors">
                                                                Voir le suivi <ChevronRight size={10} />
                                                            </button>
                                                        </div>
                                                    ) : isNat ? (
                                                        /* Nationalité VIP → redirige vers formulaire externe */
                                                        <Link href={withBack(svc.href, clientEmail ? { email: clientEmail } : {})}
                                                            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-gradient-to-r ${svc.color} text-white transition-all hover:opacity-90 ${svc.glow}`}>
                                                            {svc.ctaLabel}
                                                            <ArrowRight size={12} />
                                                        </Link>
                                                    ) : svc.id === 'boutique' ? (
                                                        /* Boutique → redirige avec bannière retour */
                                                        <Link href={withBack(svc.href)}
                                                            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-gradient-to-r ${svc.color} text-white transition-all hover:opacity-90 ${svc.glow}`}>
                                                            {svc.ctaLabel}
                                                            <ArrowRight size={12} />
                                                        </Link>
                                                    ) : (
                                                        /* Autres services → drawer in-panel */
                                                        <button type="button"
                                                            onClick={() => setDrawerService({
                                                                id: svc.id,
                                                                title: svc.title,
                                                                description: svc.description,
                                                                color: svc.color,
                                                                badge: svc.badge,
                                                                features: svc.id === 'recherche-ancestrale'
                                                                    ? ['Recherche archives', 'Bases de données spécialisées', 'IA & Plan de composition de Famille']
                                                                    : ['Accompagnement personnalisé', 'Suivi en temps réel', 'Equipe dédiée'],
                                                            })}
                                                            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-gradient-to-r ${svc.color} text-white transition-all hover:opacity-90 ${svc.glow}`}>
                                                            {svc.ctaLabel}
                                                            <ArrowRight size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Services supplémentaires depuis la DB */}
                        {services.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                    <Globe size={10} className="text-gray-500" /> Tous nos services
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {services.map((svc, i) => (
                                        <motion.div key={svc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                            className="bg-[#0a1221] border border-white/[0.06] rounded-xl p-4 hover:border-white/10 transition-all group">
                                            <h4 className="text-white font-bold text-sm mb-1">{svc.title}</h4>
                                            <p className="text-gray-500 text-[11px] leading-relaxed line-clamp-2 mb-3">{svc.description}</p>
                                            <button type="button"
                                                onClick={() => setDrawerService({
                                                    id: svc.slug,
                                                    title: svc.title,
                                                    description: svc.description,
                                                    color: 'from-[var(--panel-accent)] to-[var(--panel-accent-soft)]',
                                                    badge: 'Commander',
                                                    features: ['Accompagnement personnalisé', 'Suivi en temps réel'],
                                                })}
                                                className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--panel-accent)] hover:text-[var(--panel-accent)] transition-colors">
                                                Commander ce service <ArrowRight size={10} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* CTA contact */}
                        <div className="bg-gradient-to-br from-[var(--panel-accent-soft)] to-[var(--panel-accent-soft)] border border-[var(--panel-accent)]/20 rounded-2xl p-6 text-center">
                            <Users size={24} className="text-[var(--panel-accent)] mx-auto mb-3" />
                            <h3 className="text-white font-black text-lg mb-2">Besoin d'un conseil personnalisé ?</h3>
                            <p className="text-gray-400 text-sm mb-4">Notre équipe vous accompagne dans le choix du service adapté à votre situation.</p>
                            <Link href="/client/messages"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:-translate-y-px active:translate-y-0">
                                Contacter notre équipe
                                <ArrowRight size={14} />
                            </Link>
                        </div>
                    </motion.div>
                )}

                {/* ── SECTION : Commandes ── */}
                {activeSection === 'commandes' && (
                    <motion.div key="commandes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                        {!hasOrders ? (
                            <div className="bg-[#0a1221] border border-white/[0.06] rounded-2xl p-12 text-center">
                                <ShoppingBag size={36} className="text-gray-700 mx-auto mb-4" />
                                <h2 className="text-white font-bold text-lg mb-2">Aucune commande</h2>
                                <p className="text-gray-500 text-sm mb-5">Vos achats depuis la boutique apparaîtront ici.</p>
                                <Link href="/boutique?back=/client/services"
                                    style={{ background: 'var(--panel-accent)' }}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:-translate-y-px active:translate-y-0">
                                    <Package size={14} />
                                    Visiter la boutique
                                </Link>
                            </div>
                        ) : (
                            <div className="bg-[#0a1221] border border-white/[0.06] rounded-2xl overflow-hidden">
                                <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
                                    <h2 className="font-black text-white text-sm flex items-center gap-2">
                                        <ShoppingBag size={15} className="text-emerald-400" /> Historique commandes
                                    </h2>
                                    <Link href="/boutique?back=/client/services" className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
                                        Boutique <ExternalLink size={10} />
                                    </Link>
                                </div>
                                <div className="divide-y divide-white/[0.04]">
                                    {orders.map(order => {
                                        const ps = PAYMENT_STATUS[order.payment_status] || { label: order.payment_status, color: 'text-gray-400' }
                                        return (
                                            <div key={order.id} className="flex items-center gap-4 px-5 py-3.5">
                                                <div className="p-2 rounded-lg bg-emerald-500/10 flex-shrink-0">
                                                    <Package size={14} className="text-emerald-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-white truncate">{order.product_title || 'Produit'}</p>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        <p className="text-[10px] text-gray-600">{fmtDate(order.created_at)}</p>
                                                        <span className={`text-[10px] font-bold ${ps.color}`}>{ps.label}</span>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-mono font-bold text-white flex-shrink-0">
                                                    {fmtN(order.amount)} {order.currency || 'XOF'}
                                                </p>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="p-4 border-t border-white/[0.04] flex items-center justify-between">
                                    <p className="text-[11px] text-gray-500">{orders.length} commande(s) au total</p>
                                    <div className="flex items-center gap-2">
                                        <TrendingUp size={12} className="text-emerald-400" />
                                        <p className="text-[11px] font-bold text-emerald-400">
                                            Total : {fmtN(orders.filter(o => o.payment_status === 'completed').reduce((s, o) => s + o.amount, 0))} XOF réglé
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Drawer commande de service (in-panel, pour tout sauf Nationalité VIP) */}
            <ServiceOrderDrawer
                service={drawerService}
                onClose={() => setDrawerService(null)}
                onSuccess={() => {
                    setDrawerService(null)
                    setActiveSection('actifs')
                    // Recharger les données pour afficher le nouveau dossier
                    if (clientId) loadData(clientId, clientEmail, true)
                }}
            />
        </div>
    )
}
