'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkle as Sparkles, Envelope as Mail, Phone, CheckCircle as CheckCircle2, Clock, MagnifyingGlass as Search, Globe, Briefcase, Star, CaretDown as ChevronDown, CaretUp as ChevronUp, MapPin, Target, FileText, Lightning as Zap, ChatText as MessageSquare, ArrowClockwise as RefreshCw, Trash as Trash2, Funnel as Filter, TrendUp as TrendingUp } from '@phosphor-icons/react';
import LeadReplyDrawer from '@/components/agent/LeadReplyDrawer'
import { Lead } from '@/types/lead'
import { cn } from '@/lib/utils'

type FilterType = 'all' | 'hot' | 'not_contacted' | 'contacted' | 'origins'

interface Toast { id: number; type: 'success' | 'error' | 'info'; msg: string }

const scoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30'
    if (score >= 60) return 'text-amber-400 bg-amber-500/20 border-amber-500/30'
    return 'text-red-400 bg-red-500/20 border-red-500/30'
}

const answerLabels: Record<string, { label: string; icon: typeof MapPin }> = {
    pays_residence: { label: 'Pays de résidence', icon: MapPin },
    lien_benin: { label: 'Lien avec le Bénin', icon: Globe },
    motivation: { label: 'Motivation principale', icon: Target },
    preuve_origine: { label: 'Preuves d\'origine', icon: FileText },
    origin: { label: 'Origines béninoises', icon: Globe },
    objective: { label: 'Objectif', icon: Zap },
    timeline: { label: 'Délai souhaité', icon: Clock },
    budget: { label: 'Budget envisagé', icon: Briefcase },
    experience: { label: 'Expérience', icon: Briefcase },
    message_libre: { label: 'Message libre', icon: MessageSquare },
}

// Safe date formatter to avoid RangeError: Invalid time value
const formatDateSafe = (dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-FR', options)
}

export default function AdminLeadsOraclePage() {
    const { t } = useTranslation();
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<FilterType>('all')
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [toasts, setToasts] = useState<Toast[]>([])
    const [toastCounter, setToastCounter] = useState(0)

    const addToast = useCallback((type: Toast['type'], msg: string) => {
        const id = toastCounter + 1
        setToastCounter(id)
        setToasts(t => [...t, { id, type, msg }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
    }, [toastCounter])

    const fetchLeads = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/admin/leads')
            if (!res.ok) throw new Error('Erreur chargement leads')
            const data = await res.json()
            setLeads(data.leads || [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchLeads() }, [fetchLeads])

    const toggleContacted = async (lead: Lead) => {
        const newVal = !lead.is_contacted
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, is_contacted: newVal } : l))
        try {
            const res = await fetch(`/api/admin/leads/${lead.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_contacted: newVal }),
            })
            if (!res.ok) throw new Error('Erreur mise à jour')
            addToast('success', newVal ? 'Marqué comme contacté' : 'Marqué comme non contacté')
        } catch {
            // Rollback
            setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, is_contacted: !newVal } : l))
            addToast('error', 'Erreur lors de la mise à jour')
        }
    }

    const deleteLead = async (lead: Lead) => {
        if (!confirm(`Supprimer définitivement le lead de ${lead.client_prenom} ${lead.client_nom} ?`)) return
        try {
            const res = await fetch(`/api/admin/leads/${lead.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Erreur suppression')
            setLeads(prev => prev.filter(l => l.id !== lead.id))
            addToast('success', 'Lead supprimé')
        } catch {
            addToast('error', 'Erreur lors de la suppression')
        }
    }

    const handleEmailSent = (lead: Lead) => {
        if (!lead.is_contacted) {
            toggleContacted(lead)
        }
    }

    const filtered = leads.filter(l => {
        const matchSearch =
            l.client_nom?.toLowerCase().includes(search.toLowerCase()) ||
            l.client_email?.toLowerCase().includes(search.toLowerCase()) ||
            l.recommended_service?.toLowerCase().includes(search.toLowerCase()) ||
            l.client_prenom?.toLowerCase().includes(search.toLowerCase())

        if (filter === 'hot') return matchSearch && l.eligibility_score >= 70
        if (filter === 'not_contacted') return matchSearch && !l.is_contacted
        if (filter === 'contacted') return matchSearch && l.is_contacted
        if (filter === 'origins') return matchSearch && l.has_origins
        return matchSearch
    })

    const renderOracleAnswers = (lead: Lead) => {
        const answers = lead.answers
        if (!answers || Object.keys(answers).length === 0) {
            return <p className="text-gray-600 text-xs italic"><T>Aucune réponse Oracle enregistrée.</T></p>
        }
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(answers).map(([key, value]) => {
                    if (!value || (Array.isArray(value) && value.length === 0)) return null
                    const meta = answerLabels[key]
                    const Icon = meta?.icon || FileText
                    const displayValue = Array.isArray(value) ? value.join(', ') : String(value)
                    return (
                        <div key={key} className="flex items-start gap-2 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
                            <Icon size={12} className="text-amber-400/70 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">{meta?.label || key}</p>
                                <p className="text-xs text-gray-300 mt-0.5 break-words">{displayValue}</p>
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    const stats = {
        total: leads.length,
        hot: leads.filter(l => l.eligibility_score >= 70).length,
        notContacted: leads.filter(l => !l.is_contacted).length,
        origins: leads.filter(l => l.has_origins).length,
        avgScore: leads.length ? Math.round(leads.reduce((a, l) => a + l.eligibility_score, 0) / leads.length) : 0,
    }

    const FILTERS: { key: FilterType; label: string; count: number; color: string }[] = [
        { key: 'all', label: 'Tous', count: leads.length, color: '#FCD116' },
        { key: 'hot', label: 'Hot (≥70%)', count: stats.hot, color: '#008751' },
        { key: 'not_contacted', label: 'À contacter', count: stats.notContacted, color: '#E8112D' },
        { key: 'contacted', label: 'Contactés', count: leads.filter(l => l.is_contacted).length, color: '#3b82f6' },
        { key: 'origins', label: 'Origines', count: stats.origins, color: '#a855f7' },
    ]

    return (
        <>
            <div className="space-y-8 animate-in fade-in duration-700">
                {/* Toast container */}
                <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
                    <AnimatePresence>
                        {toasts.map(t => (
                            <motion.div
                                key={t.id}
                                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={cn(
                                    'flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-bold pointer-events-auto border',
                                    t.type === 'success' ? 'bg-[#0a1a0f] border-[#008751]/30 text-[#00c870]'
                                        : t.type === 'error' ? 'bg-[#1a0a0a] border-[#E8112D]/30 text-[#ff4d4d]'
                                            : 'bg-[#0a0f1a] border-[#3b82f6]/30 text-[#60a5fa]'
                                )}
                            >
                                <CheckCircle2 size={16} />
                                {t.msg}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[#FCD116]">
                            <Sparkles size={18} className="text-[#FCD116]" />
                            <span className="text-[10px] font-black uppercase tracking-[0.5em]"><T>L&apos;Oracle</T></span>
                        </div>
                        <h1 className="text-4xl font-black text-white font-heading tracking-tighter">
                            LEADS <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#008751]"><T>ORACLE</T></span>
                        </h1>
                        <p className="text-sm text-gray-500">
                            {leads.length} lead(s) • {stats.notContacted} à contacter • Score moyen : {stats.avgScore}%
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={fetchLeads}
                        className="flex items-center gap-2 text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white px-4 py-2.5 rounded-xl transition-all border border-white/5"
                    >
                        <RefreshCw size={14} /> Rafraîchir
                    </button>
                </div>

                {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                        { label: 'Total Leads', value: stats.total, color: '#FCD116', icon: Sparkles },
                        { label: 'Score ≥70%', value: stats.hot, color: '#008751', icon: Star },
                        { label: 'Origines 🇧🇯', value: stats.origins, color: '#a855f7', icon: Globe },
                        { label: 'À Contacter', value: stats.notContacted, color: '#E8112D', icon: Clock },
                        { label: 'Score Moyen', value: `${stats.avgScore}%`, color: '#3b82f6', icon: TrendingUp },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: stat.color + '15' }}>
                                <stat.icon size={16} style={{ color: stat.color }} />
                            </div>
                            <div>
                                <p className="text-lg font-black font-mono" style={{ color: stat.color }}>{stat.value}</p>
                                <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold leading-tight">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters + Search */}
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm">
                        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t("Nom, email, service...")}
                            title={t("Rechercher")}
                            className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FCD116]/40 text-sm"
                        />
                    </div>

                    {/* Filter tabs */}
                    <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 flex-wrap">
                        <Filter size={13} className="text-gray-600 mx-2" />
                        {FILTERS.map(f => (
                            <button
                                key={f.key}
                                type="button"
                                onClick={() => setFilter(f.key)}
                                className={cn(
                                    'flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all',
                                    filter === f.key
                                        ? 'bg-white/10 text-white'
                                        : 'text-gray-500 hover:text-white'
                                )}
                            >
                                {f.label}
                                <span className="text-[9px] font-mono opacity-60">{f.count}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Leads list */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-2 border-[#FCD116]/30 border-t-[#FCD116] rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Sparkles size={36} className="text-gray-700" />
                                <p className="text-gray-500 text-sm font-bold"><T>Aucun lead trouvé</T></p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {filtered.map((lead, i) => (
                                    <motion.div
                                        key={lead.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.02 }}
                                        className="p-4 hover:bg-white/[0.02] transition-all"
                                    >
                                        {/* Main row */}
                                        <div className="flex items-center justify-between flex-wrap gap-3">
                                            <div className="flex items-center gap-4">
                                                {/* Score */}
                                                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 border', scoreColor(lead.eligibility_score))}>
                                                    {lead.eligibility_score}%
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-bold text-white">
                                                            {lead.client_prenom} {lead.client_nom}
                                                        </p>
                                                        {lead.has_origins && (
                                                            <span className="text-[9px] bg-purple-500/15 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                                <Globe size={9} /> Origines 🇧🇯
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                                        <span className="flex items-center gap-1"><Mail size={11} />{lead.client_email}</span>
                                                        {lead.client_whatsapp && (
                                                            <span className="hidden sm:flex items-center gap-1"><Phone size={11} />{lead.client_whatsapp}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap">
                                                {/* Service */}
                                                <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-bold bg-white/5 text-gray-400 px-3 py-1.5 rounded-full">
                                                    <Briefcase size={10} /> {lead.recommended_service}
                                                </span>

                                                {/* Date */}
                                                <span className="text-[10px] text-gray-600">
                                                    {formatDateSafe(lead.created_at)}
                                                </span>

                                                {/* Oracle button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                                                    className={cn(
                                                        'flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-all border',
                                                        expandedId === lead.id
                                                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                            : 'bg-white/5 text-gray-500 border-white/10 hover:text-amber-400 hover:border-amber-500/20'
                                                    )}
                                                    title={t("Voir les réponses Oracle")}
                                                >
                                                    <Sparkles size={11} />
                                                    Oracle
                                                    {expandedId === lead.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                                </button>

                                                {/* Toggle contacted */}
                                                <button
                                                    type="button"
                                                    onClick={() => toggleContacted(lead)}
                                                    className={cn(
                                                        'text-xs font-bold px-3 py-1.5 rounded-lg transition-all',
                                                        lead.is_contacted
                                                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                                            : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                                    )}
                                                >
                                                    {lead.is_contacted ? (
                                                        <span className="flex items-center gap-1"><CheckCircle2 size={11} /> <T>Contacté</T></span>
                                                    ) : (
                                                        <span className="flex items-center gap-1"><Clock size={11} /> <T>À contacter</T></span>
                                                    )}
                                                </button>

                                                {/* Reply button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedLead(lead)}
                                                    className="flex items-center gap-1.5 text-xs font-bold bg-[#3b82f6]/15 text-[#3b82f6] hover:bg-[#3b82f6]/25 border border-[#3b82f6]/20 hover:border-[#3b82f6]/40 px-3 py-1.5 rounded-lg transition-all"
                                                    title={t("Envoyer un email")}
                                                >
                                                    <Mail size={12} /> Répondre
                                                </button>

                                                {/* WhatsApp */}
                                                {lead.client_whatsapp && (
                                                    <a
                                                        href={`https://wa.me/${lead.client_whatsapp.replace(/\s+/g, '')}?text=Bonjour%20${lead.client_prenom},%20suite%20à%20votre%20simulation%20sur%20Retour%20Gagnant...`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={() => { if (!lead.is_contacted) toggleContacted(lead) }}
                                                        className="flex items-center gap-1 text-xs font-bold bg-green-500/20 text-green-400 hover:bg-green-500/30 px-3 py-1.5 rounded-lg transition-all"
                                                        title={t("WhatsApp")}
                                                    >
                                                        <Phone size={12} /> WA
                                                    </a>
                                                )}

                                                {/* Delete */}
                                                <button
                                                    type="button"
                                                    onClick={() => deleteLead(lead)}
                                                    title={t("Supprimer")}
                                                    className="p-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Oracle answers : expandable */}
                                        <AnimatePresence>
                                            {expandedId === lead.id && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="mt-4 pt-4 border-t border-white/5">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <Sparkles size={12} className="text-amber-400" />
                                                            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.2em]">
                                                                Réponses Oracle : {lead.client_prenom} {lead.client_nom}
                                                            </p>
                                                        </div>
                                                        {renderOracleAnswers(lead)}

                                                        {/* Service info */}
                                                        <div className="mt-3 flex items-center gap-2">
                                                            <span className="text-[10px] font-bold bg-[#FCD116]/10 text-[#FCD116] border border-[#FCD116]/20 px-3 py-1 rounded-full uppercase tracking-wider">
                                                                <Briefcase size={10} className="inline mr-1" />
                                                                {lead.recommended_service}
                                                            </span>
                                                            <span className="text-[10px] text-gray-600">
                                                                Soumis le {formatDateSafe(lead.created_at, { day: 'numeric', month: 'long', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Drawer de composition email : monté hors du scroll */}
            <LeadReplyDrawer
                lead={selectedLead}
                onClose={() => setSelectedLead(null)}
                onSent={handleEmailSent}
            />
        </>
    )
}
