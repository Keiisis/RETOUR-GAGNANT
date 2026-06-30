'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe2, RefreshCw, Loader2, X, Save, ChevronDown, ChevronUp, Mail, Phone, CheckCircle2, Clock, Ban, AlertCircle, FileText, type LucideIcon } from 'lucide-react'

const GOLD = '#D4AF37'; const GREEN = '#008751'; const GREEN_L = '#00A86B'
const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'; const PANEL = '#0D2615'

interface NatRequest {
    id: string; full_name: string; email: string; phone?: string; nationality?: string
    current_country?: string; documents?: string[]; status: string; notes?: string
    created_at: string; updated_at?: string
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
    pending:    { label: 'En attente',   color: GOLD,    bg: `${GOLD}15` },
    processing: { label: 'En traitement',color: '#3b82f6', bg: '#3b82f615' },
    completed:  { label: 'Complété',     color: GREEN_L,  bg: `${GREEN_L}15` },
    rejected:   { label: 'Rejeté',       color: RED,      bg: `${RED}15` },
}

const STATUS_ICON: Record<string, LucideIcon> = {
    pending: Clock, processing: AlertCircle, completed: CheckCircle2, rejected: Ban,
}

function fmt(d: string) {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CeoNationalite() {
    const [items, setItems] = useState<NatRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState<string | null>(null)
    const [editing, setEditing] = useState<string | null>(null)
    const [editData, setEditData] = useState<{ status: string; notes: string }>({ status: '', notes: '' })
    const [saving, setSaving] = useState(false)
    const [filter, setFilter] = useState('all')
    const [refresh, setRefresh] = useState(0)

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/ceo/nationalite', { cache: 'no-store' })
        const data = res.ok ? await res.json() : {}
        setItems(data.requests || [])
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const startEdit = (item: NatRequest) => { setEditing(item.id); setEditData({ status: item.status || 'pending', notes: item.notes || '' }) }

    const save = async (id: string) => {
        setSaving(true)
        await fetch('/api/ceo/nationalite', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...editData }) })
        setSaving(false)
        setItems(prev => prev.map(x => x.id === id ? { ...x, ...editData } : x))
        setEditing(null)
    }

    const filtered = filter === 'all' ? items : items.filter(x => x.status === filter)

    const counts = { all: items.length, pending: items.filter(x => x.status === 'pending').length, processing: items.filter(x => x.status === 'processing').length, completed: items.filter(x => x.status === 'completed').length, rejected: items.filter(x => x.status === 'rejected').length }

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}25` }}>
                            <Globe2 size={18} style={{ color: GREEN_L }}/>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Demandes de Nationalité</h1>
                    </div>
                    <p className="text-sm opacity-50">Suivi des dossiers de nationalité béninoise</p>
                </div>
                <button onClick={() => setRefresh(r => r + 1)} className="px-4 py-2 rounded-xl hover:opacity-80 flex items-center gap-2 text-sm font-semibold" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Actualiser
                </button>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                    { key: 'all', label: 'Total', color: GOLD },
                    { key: 'pending', label: 'En attente', color: GOLD },
                    { key: 'processing', label: 'En cours', color: '#3b82f6' },
                    { key: 'completed', label: 'Complétés', color: GREEN_L },
                ].map((s, i) => (
                    <motion.div key={s.key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        onClick={() => setFilter(s.key)}
                        role="button" tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFilter(s.key); } }}
                        className="rounded-2xl p-4 cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" style={{ background: PANEL, border: `1px solid ${filter === s.key ? s.color : `${s.color}20`}` }}>
                        <div className="text-xs opacity-40 uppercase tracking-wider mb-1">{s.label}</div>
                        <div className="text-2xl font-black" style={{ color: s.color }}>{counts[s.key as keyof typeof counts]}</div>
                    </motion.div>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40"/></div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((item, i) => {
                        const meta = STATUS_META[item.status] || STATUS_META.pending
                        const Icon = STATUS_ICON[item.status] || Clock
                        const isOpen = expanded === item.id
                        return (
                            <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }}
                                className="rounded-2xl overflow-hidden" style={{ background: PANEL, border: `1px solid ${meta.color}20` }}>
                                <div className="flex items-center gap-4 p-5 cursor-pointer focus:outline-none focus:bg-white/[0.02]" 
                                    role="button" aria-expanded={isOpen ? "true" : "false"} tabIndex={0}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(isOpen ? null : item.id); } }}
                                    onClick={() => setExpanded(isOpen ? null : item.id)}>
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
                                        <Icon size={16} style={{ color: meta.color }}/>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm truncate">{item.full_name}</p>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <span className="text-[11px] opacity-40">{item.email}</span>
                                            <span className="text-[11px] opacity-30">{fmt(item.created_at)}</span>
                                        </div>
                                    </div>
                                    {isOpen ? <ChevronUp size={16} className="opacity-40 flex-shrink-0"/> : <ChevronDown size={16} className="opacity-40 flex-shrink-0"/>}
                                </div>

                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                            style={{ borderTop: `1px solid ${meta.color}15` }}>
                                            <div className="p-5 space-y-4">
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    {item.phone && (
                                                        <div className="flex items-center gap-2 opacity-60"><Phone size={13}/><span>{item.phone}</span></div>
                                                    )}
                                                    {item.nationality && (
                                                        <div className="flex items-center gap-2 opacity-60"><Globe2 size={13}/><span>{item.nationality}</span></div>
                                                    )}
                                                    {item.current_country && (
                                                        <div className="flex items-center gap-2 opacity-60"><FileText size={13}/><span>Réside en : {item.current_country}</span></div>
                                                    )}
                                                </div>

                                                {editing === item.id ? (
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Statut</label>
                                                            <select value={editData.status} onChange={e => setEditData(p => ({ ...p, status: e.target.value }))}
                                                                aria-label="Statut du dossier"
                                                                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: BG, border: `1px solid ${GOLD}25`, color: TEXT }}>
                                                                <option value="pending">En attente</option>
                                                                <option value="processing">En traitement</option>
                                                                <option value="completed">Complété</option>
                                                                <option value="rejected">Rejeté</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Notes internes</label>
                                                            <textarea value={editData.notes} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))}
                                                                aria-label="Notes internes"
                                                                rows={2} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={{ background: BG, border: `1px solid ${GOLD}25`, color: TEXT }}/>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button type="button" onClick={() => setEditing(null)} title="Annuler" aria-label="Annuler" className="px-4 py-2 rounded-xl text-sm opacity-40 hover:opacity-70"><X size={14}/></button>
                                                            <button type="button" onClick={() => save(item.id)} disabled={saving}
                                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
                                                                style={{ background: GREEN, color: '#fff' }}>
                                                                {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Enregistrer
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <a href={`mailto:${item.email}`} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold hover:opacity-80" style={{ background: '#3b82f615', color: '#3b82f6' }}>
                                                            <Mail size={13}/> Email
                                                        </a>
                                                        {item.phone && (
                                                            <a href={`https://wa.me/${item.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold hover:opacity-80" style={{ background: `${GREEN}20`, color: GREEN_L }}>
                                                                <Phone size={13}/> WhatsApp
                                                            </a>
                                                        )}
                                                        <button type="button" onClick={() => startEdit(item)}
                                                            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold hover:opacity-80" style={{ background: `${GOLD}15`, color: GOLD }}>
                                                            <Save size={13}/> Statut
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )
                    })}
                    {filtered.length === 0 && <p className="text-center opacity-30 py-12">Aucune demande</p>}
                </div>
            )}
        </div>
    )
}
