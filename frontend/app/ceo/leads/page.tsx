'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Target, RefreshCw, Loader2, ChevronDown, ChevronUp, Mail, Phone, CheckCircle2, Clock, Trash2 } from 'lucide-react'

const GOLD = '#D4AF37'; const GREEN = '#008751'; const GREEN_L = '#00A86B'
const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'; const PANEL = '#0D2615'

interface Lead {
    id: string; full_name?: string; email?: string; phone?: string
    score?: number; eligibility_score?: number; recommendation?: string
    oracle_response?: string; nationality?: string; residency_country?: string
    is_contacted?: boolean; created_at: string
}

function ScoreBadge({ score }: { score: number }) {
    const color = score >= 80 ? GREEN_L : score >= 60 ? GOLD : score >= 40 ? '#f97316' : RED
    return (
        <div className="flex items-center gap-1.5">
            <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }}/>
            </div>
            <span className="text-xs font-black" style={{ color }}>{score}</span>
        </div>
    )
}

function fmt(d: string) {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CeoLeads() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState<string | null>(null)
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [refresh, setRefresh] = useState(0)

    const load = useCallback(async () => {
        if (!loading) setLoading(true)
        const res = await fetch('/api/ceo/leads', { cache: 'no-store' })
        const data = res.ok ? await res.json() : {}
        setLeads(data.leads || [])
        setLoading(false)
    }, [loading])

    useEffect(() => { load() }, [load, refresh])

    const toggleContacted = async (lead: Lead) => {
        const val = !lead.is_contacted
        await fetch('/api/ceo/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id, is_contacted: val }) })
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, is_contacted: val } : l))
    }

    const del = async (id: string) => {
        if (!confirm('Supprimer ce lead ?')) return
        await fetch(`/api/ceo/leads?id=${id}`, { method: 'DELETE' })
        setLeads(prev => prev.filter(l => l.id !== id))
    }

    const filtered = leads
        .filter(l => filter === 'all' || (filter === 'contacted' ? l.is_contacted : !l.is_contacted))
        .filter(l => !search || (l.full_name || '').toLowerCase().includes(search.toLowerCase()) || (l.email || '').toLowerCase().includes(search.toLowerCase()))

    const avgScore = leads.length ? Math.round(leads.reduce((s, l) => s + (l.score || l.eligibility_score || 0), 0) / leads.length) : 0

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}25` }}>
                            <Target size={18} style={{ color: GOLD }}/>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Leads Oracle</h1>
                    </div>
                    <p className="text-sm opacity-50">Résultats d&apos;éligibilité & prospects qualifiés</p>
                </div>
                <div className="flex gap-2 items-center">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="px-4 py-2 rounded-xl text-sm outline-none w-44" style={{ background: PANEL, border: `1px solid ${GOLD}20`, color: TEXT }}/>
                    <button onClick={() => setRefresh(r => r + 1)} title="Actualiser" aria-label="Actualiser" className="px-3 py-2 rounded-xl hover:opacity-80" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
                    </button>
                </div>
            </motion.div>

            <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Total leads', value: leads.length, color: GOLD },
                    { label: 'Score moyen', value: avgScore, color: avgScore >= 70 ? GREEN_L : GOLD },
                    { label: 'Contactés', value: leads.filter(l => l.is_contacted).length, color: GREEN_L },
                    { label: 'Non contactés', value: leads.filter(l => !l.is_contacted).length, color: '#94a3b8' },
                ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className="rounded-2xl p-4" style={{ background: PANEL, border: `1px solid ${s.color}20` }}>
                        <div className="text-xs opacity-40 uppercase tracking-wider mb-1">{s.label}</div>
                        <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                    </motion.div>
                ))}
            </div>

            <div className="flex gap-2 mb-4">
                {[['all', 'Tous'], ['not_contacted', 'Non contactés'], ['contacted', 'Contactés']].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setFilter(k)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                        style={{ background: filter === k ? GOLD : `${GOLD}12`, color: filter === k ? BG : GOLD }}>
                        {l}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40"/></div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((lead, i) => {
                        const score = lead.score || lead.eligibility_score || 0
                        const isOpen = expanded === lead.id
                        return (
                            <motion.div key={lead.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }}
                                className="rounded-2xl overflow-hidden" style={{ background: PANEL, border: `1px solid ${lead.is_contacted ? `${GREEN}25` : `${GOLD}15`}` }}>
                                <div className="flex items-center gap-4 p-5 cursor-pointer" onClick={() => setExpanded(isOpen ? null : lead.id)}>
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: lead.is_contacted ? `${GREEN}20` : `${GOLD}15` }}>
                                        {lead.is_contacted ? <CheckCircle2 size={16} style={{ color: GREEN_L }}/> : <Clock size={16} style={{ color: GOLD }}/>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm truncate">{lead.full_name || lead.email || 'Anonyme'}</p>
                                        <div className="mt-1"><ScoreBadge score={score}/></div>
                                    </div>
                                    <span className="text-[11px] opacity-30 hidden md:block">{fmt(lead.created_at)}</span>
                                    {isOpen ? <ChevronUp size={16} className="opacity-40 flex-shrink-0"/> : <ChevronDown size={16} className="opacity-40 flex-shrink-0"/>}
                                </div>
                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                            style={{ borderTop: `1px solid ${GOLD}10` }}>
                                            <div className="p-5 space-y-3">
                                                <div className="grid grid-cols-2 gap-3 text-sm opacity-60">
                                                    {lead.email && <div className="flex items-center gap-2"><Mail size={12}/>{lead.email}</div>}
                                                    {lead.phone && <div className="flex items-center gap-2"><Phone size={12}/>{lead.phone}</div>}
                                                    {lead.nationality && <div>Nationalité : {lead.nationality}</div>}
                                                    {lead.residency_country && <div>Réside : {lead.residency_country}</div>}
                                                </div>
                                                {(lead.recommendation || lead.oracle_response) && (
                                                    <div className="p-3 rounded-xl text-[12px] opacity-60 leading-relaxed" style={{ background: BG }}>
                                                        {lead.recommendation || lead.oracle_response}
                                                    </div>
                                                )}
                                                <div className="flex gap-2 flex-wrap">
                                                    {lead.email && <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold hover:opacity-80" style={{ background: '#3b82f615', color: '#3b82f6' }}><Mail size={13}/> Email</a>}
                                                    {lead.phone && <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold hover:opacity-80" style={{ background: `${GREEN}20`, color: GREEN_L }}><Phone size={13}/> WhatsApp</a>}
                                                    <button type="button" onClick={() => toggleContacted(lead)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold hover:opacity-80" style={{ background: lead.is_contacted ? `${RED}15` : `${GREEN}20`, color: lead.is_contacted ? RED : GREEN_L }}>
                                                        <CheckCircle2 size={13}/> {lead.is_contacted ? 'Marquer non contacté' : 'Marquer contacté'}
                                                    </button>
                                                    <button type="button" onClick={() => del(lead.id)} title="Supprimer" aria-label="Supprimer" className="ml-auto p-2 rounded-xl hover:opacity-80" style={{ background: `${RED}12`, color: RED }}><Trash2 size={14}/></button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )
                    })}
                    {filtered.length === 0 && <p className="text-center opacity-30 py-12">Aucun lead trouvé</p>}
                </div>
            )}
        </div>
    )
}
