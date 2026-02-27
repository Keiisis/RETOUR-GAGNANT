'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    Compass, Search, Phone, Mail,
    CheckCircle2, Globe, Briefcase, Star
} from 'lucide-react'

interface Lead {
    id: string
    client_nom: string
    client_prenom: string
    client_email: string
    client_whatsapp: string
    recommended_service: string
    recommended_slug: string
    eligibility_score: number
    has_origins: boolean
    answers: Record<string, string>
    contacted: boolean
    created_at: string
}

export default function AgentLeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'all' | 'hot' | 'not_contacted'>('all')

    const fetchLeads = async () => {
        const { data } = await supabase
            .from('eligibility_results')
            .select('*')
            .order('created_at', { ascending: false })

        setLeads((data || []) as Lead[])
        setLoading(false)
    }

    useEffect(() => {
        fetchLeads()
    }, [])

    const toggleContacted = async (lead: Lead) => {
        const newVal = !lead.contacted
        await supabase
            .from('eligibility_results')
            .update({ contacted: newVal })
            .eq('id', lead.id)

        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, contacted: newVal } : l))
    }

    const filtered = leads.filter(l => {
        const matchSearch = l.client_nom?.toLowerCase().includes(search.toLowerCase()) ||
            l.client_email?.toLowerCase().includes(search.toLowerCase()) ||
            l.recommended_service?.toLowerCase().includes(search.toLowerCase())

        if (filter === 'hot') return matchSearch && l.eligibility_score >= 70
        if (filter === 'not_contacted') return matchSearch && !l.contacted
        return matchSearch
    })

    const scoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400 bg-emerald-500/20'
        if (score >= 60) return 'text-amber-400 bg-amber-500/20'
        return 'text-red-400 bg-red-500/20'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Compass size={16} className="text-amber-400" />
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.3em]">L&apos;Oracle</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Pipeline Leads</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {leads.length} lead(s) • {leads.filter(l => !l.contacted).length} à contacter
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Rechercher un lead..."
                            title="Rechercher"
                            className="bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm w-56"
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
                        <p className="text-2xl font-black text-white">{leads.filter(l => l.contacted).length}</p>
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
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-4">
                                        {/* Score */}
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm ${scoreColor(lead.eligibility_score)}`}>
                                            {lead.eligibility_score}%
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-white">{lead.client_nom} {lead.client_prenom}</p>
                                                {lead.has_origins && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Globe size={10} /> Origines</span>}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                <span className="flex items-center gap-1"><Mail size={11} />{lead.client_email}</span>
                                                {lead.client_whatsapp && <span className="flex items-center gap-1"><Phone size={11} />{lead.client_whatsapp}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {/* Service Recommandé */}
                                        <span className="hidden lg:flex items-center gap-1 text-[10px] font-bold bg-white/5 text-gray-400 px-3 py-1.5 rounded-full">
                                            <Briefcase size={11} /> {lead.recommended_service}
                                        </span>

                                        {/* Date */}
                                        <span className="text-[10px] text-gray-600">
                                            {new Date(lead.created_at).toLocaleDateString('fr-FR')}
                                        </span>

                                        {/* Toggle Contacted */}
                                        <button
                                            onClick={() => toggleContacted(lead)}
                                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${lead.contacted
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                                }`}
                                        >
                                            {lead.contacted ? '✓ Contacté' : 'À contacter'}
                                        </button>

                                        {/* WhatsApp */}
                                        {lead.client_whatsapp && (
                                            <a
                                                href={`https://wa.me/${lead.client_whatsapp.replace(/\s+/g, '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-xs font-bold bg-green-500/20 text-green-400 hover:bg-green-500/30 px-3 py-1.5 rounded-lg transition-all"
                                                title="Contacter sur WhatsApp"
                                            >
                                                <Phone size={12} /> WhatsApp
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
