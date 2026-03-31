'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    Compass, Search, Phone, Mail,
    CheckCircle2, Globe, Briefcase, Star,
    ChevronDown, ChevronUp, MapPin, Target, Clock,
    MessageSquare, FileText, Zap, RefreshCw
} from 'lucide-react'
import LeadReplyDrawer from '@/components/agent/LeadReplyDrawer'
import { Lead } from '@/types/lead'

export default function AgentLeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'all' | 'hot' | 'not_contacted'>('all')
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [newLeadIds, setNewLeadIds] = useState<Set<string>>(new Set())

    const fetchLeads = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase
            .from('eligibility_results')
            .select('*')
            .order('created_at', { ascending: false })

        setLeads((data || []) as Lead[])
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchLeads()
    }, [fetchLeads])

    // Subscription temps réel — nouveaux leads + mises à jour
    useEffect(() => {
        const channel = supabase.channel('leads_realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'eligibility_results' },
                (payload) => {
                    const newLead = payload.new as Lead
                    setLeads(prev => [newLead, ...prev])
                    setNewLeadIds(prev => new Set(prev).add(newLead.id))
                    // Retire le badge "nouveau" après 10s
                    setTimeout(() => {
                        setNewLeadIds(prev => {
                            const next = new Set(prev)
                            next.delete(newLead.id)
                            return next
                        })
                    }, 10000)
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'eligibility_results' },
                (payload) => {
                    const updated = payload.new as Lead
                    setLeads(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l))
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    const toggleContacted = async (lead: Lead) => {
        const newVal = !lead.is_contacted
        await supabase
            .from('eligibility_results')
            .update({ is_contacted: newVal })
            .eq('id', lead.id)

        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, is_contacted: newVal } : l))
    }

    // Appelé par le drawer quand l'email est envoyé avec succès
    const handleEmailSent = (lead: Lead) => {
        if (!lead.is_contacted) {
            toggleContacted(lead)
        }
    }

    const filtered = leads.filter(l => {
        const matchSearch = l.client_nom?.toLowerCase().includes(search.toLowerCase()) ||
            l.client_email?.toLowerCase().includes(search.toLowerCase()) ||
            l.recommended_service?.toLowerCase().includes(search.toLowerCase())

        if (filter === 'hot') return matchSearch && l.eligibility_score >= 70
        if (filter === 'not_contacted') return matchSearch && !l.is_contacted
        return matchSearch
    })

    const scoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400 bg-emerald-500/20'
        if (score >= 60) return 'text-amber-400 bg-amber-500/20'
        return 'text-red-400 bg-red-500/20'
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

    const renderOracleAnswers = (lead: Lead) => {
        const answers = lead.answers
        if (!answers || Object.keys(answers).length === 0) {
            return <p className="text-gray-600 text-xs italic">Aucune réponse Oracle enregistrée.</p>
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Compass size={16} className="text-amber-400" />
                            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.3em]">L&apos;Oracle</span>
                        </div>
                        <h1 className="text-2xl font-black text-white">Pipeline Leads</h1>
                        <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
                            <span>{leads.length} lead(s) • {leads.filter(l => !l.is_contacted).length} à contacter</span>
                            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Temps réel
                            </span>
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            type="button"
                            onClick={() => fetchLeads()}
                            title="Rafraîchir"
                            className="flex items-center gap-1.5 text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white px-3 py-2 rounded-xl transition-all"
                        >
                            <RefreshCw size={13} /> Rafraîchir
                        </button>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Rechercher un lead..."
                                title="Rechercher"
                                className="bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm w-full sm:w-56"
                            />
                        </div>

                        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                            {[
                                { key: 'all', label: 'Tous' },
                                { key: 'hot', label: 'Hot Leads' },
                                { key: 'not_contacted', label: 'À contacter' },
                            ].map((f) => (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => setFilter(f.key as typeof filter)}
                                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${filter === f.key ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:text-white'
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <Star size={18} className="text-amber-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-white">{leads.filter(l => l.eligibility_score >= 70).length}</p>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Score Élevé (≥70%)</p>
                        </div>
                    </div>
                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 size={18} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-white">{leads.filter(l => l.is_contacted).length}</p>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Déjà Contactés</p>
                        </div>
                    </div>
                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <Globe size={18} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-white">{leads.filter(l => l.has_origins).length}</p>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Origines Béninoises</p>
                        </div>
                    </div>
                </div>

                {/* Leads List */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="divide-y divide-white/5">
                        {filtered.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 text-sm">Aucun lead trouvé</div>
                        ) : (
                            filtered.map((lead, i) => (
                                <motion.div
                                    key={lead.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.03 }}
                                    className="p-4 hover:bg-white/[0.02] transition-all"
                                >
                                    {/* Ligne principale */}
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div className="flex items-center gap-4">
                                            {/* Score */}
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${scoreColor(lead.eligibility_score)}`}>
                                                {lead.eligibility_score}%
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm font-bold text-white">{lead.client_nom} {lead.client_prenom}</p>
                                                    {lead.has_origins && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Globe size={10} /> Origines</span>}
                                                    {newLeadIds.has(lead.id) && (
                                                        <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold animate-pulse">
                                                            Nouveau
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1"><Mail size={11} />{lead.client_email}</span>
                                                    {lead.client_whatsapp && <span className="flex items-center gap-1"><Phone size={11} />{lead.client_whatsapp}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Service Recommandé */}
                                            <span className="hidden lg:flex items-center gap-1 text-[10px] font-bold bg-white/5 text-gray-400 px-3 py-1.5 rounded-full">
                                                <Briefcase size={11} /> {lead.recommended_service}
                                            </span>

                                            {/* Date */}
                                            <span className="text-[10px] text-gray-600">
                                                {new Date(lead.created_at).toLocaleDateString('fr-FR')}
                                            </span>

                                            {/* Bouton Oracle answers */}
                                            <button
                                                type="button"
                                                onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                                                className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-all border ${
                                                    expandedId === lead.id
                                                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                        : 'bg-white/5 text-gray-500 border-white/10 hover:text-amber-400 hover:border-amber-500/20'
                                                }`}
                                                title="Voir les réponses Oracle"
                                            >
                                                <Compass size={11} />
                                                Oracle
                                                {expandedId === lead.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                            </button>

                                            {/* Toggle Contacted */}
                                            <button
                                                type="button"
                                                onClick={() => toggleContacted(lead)}
                                                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${lead.is_contacted
                                                    ? 'bg-emerald-500/20 text-emerald-400'
                                                    : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                                    }`}
                                            >
                                                {lead.is_contacted ? '✓ Contacté' : 'À contacter'}
                                            </button>

                                            {/* Email Button — ouvre le drawer */}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedLead(lead)}
                                                className="flex items-center gap-1.5 text-xs font-bold bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/20 hover:border-blue-500/40 px-3 py-1.5 rounded-lg transition-all"
                                                title="Envoyer un Email"
                                            >
                                                <Mail size={12} /> Répondre
                                            </button>

                                            {/* WhatsApp */}
                                            {lead.client_whatsapp && (
                                                <a
                                                    href={`https://wa.me/${lead.client_whatsapp.replace(/\s+/g, '')}?text=Bonjour%20${lead.client_prenom},%20suite%20%C3%A0%20votre%20simulation%20sur%20l'Oracle%20Retour%20Gagnant...`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={() => { if (!lead.is_contacted) toggleContacted(lead) }}
                                                    className="flex items-center gap-1 text-xs font-bold bg-green-500/20 text-green-400 hover:bg-green-500/30 px-3 py-1.5 rounded-lg transition-all"
                                                    title="Contacter sur WhatsApp"
                                                >
                                                    <Phone size={12} /> WhatsApp
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Panel Oracle Answers — expandable */}
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
                                                        <Compass size={12} className="text-amber-400" />
                                                        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.2em]">Réponses Oracle complètes</p>
                                                    </div>
                                                    {renderOracleAnswers(lead)}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Drawer de composition email — monté en dehors du scroll container */}
            <LeadReplyDrawer
                lead={selectedLead}
                onClose={() => setSelectedLead(null)}
                onSent={handleEmailSent}
            />
        </>
    )
}
