'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Receipt, Search, RefreshCw, Loader2, Eye, CheckCircle2, Clock, AlertTriangle, X } from 'lucide-react'

const GOLD = '#D4AF37'; const YELLOW = '#FCD116'; const GREEN = '#008751'
const GREEN_L = '#00A86B'; const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'

function fmt(n: number) { return `${n.toLocaleString('fr-FR')} FCFA` }
function fmtDate(d: string | null | undefined) {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Doc { id: string; created_at: string; number?: string; type?: string; total_amount?: number; status?: string; client_email?: string; client_name?: string; due_date?: string }

const STATUS_META: Record<string, { label: string; color: string }> = {
    paid: { label: 'Payée', color: GREEN_L }, draft: { label: 'Brouillon', color: '#94a3b8' },
    sent: { label: 'Envoyée', color: '#60a5fa' }, overdue: { label: 'En retard', color: RED },
    pending: { label: 'En attente', color: YELLOW }, cancelled: { label: 'Annulée', color: RED },
    accepted: { label: 'Accepté', color: GREEN_L }, rejected: { label: 'Refusé', color: RED },
}

export default function CeoFacturation() {
    const [docs, setDocs] = useState<Doc[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [docType, setDocType] = useState<'all' | 'invoice' | 'quote'>('all')
    const [selected, setSelected] = useState<Doc | null>(null)
    const [refresh, setRefresh] = useState(0)

    const load = useCallback(async () => {
        if (!loading) setLoading(true)
        try {
            const res = await fetch('/api/ceo/facturation', { cache: 'no-store' })
            if (res.ok) {
                const d = await res.json()
                setDocs(d.docs || [])
            }
        } catch { /* silent */ }
        setLoading(false)
    }, [loading])

    useEffect(() => { load() }, [load, refresh])

    const filtered = docs.filter(d => {
        const matchType = docType === 'all' || d.type === docType
        const matchSearch = !search || (d.number || '').toLowerCase().includes(search.toLowerCase()) ||
            (d.client_email || d.client_name || '').toLowerCase().includes(search.toLowerCase())
        return matchType && matchSearch
    })

    const totalPaid = docs.filter(d => ['paid', 'accepted'].includes(d.status || '')).reduce((a, d) => a + (d.total_amount || 0), 0)
    const totalPending = docs.filter(d => ['pending', 'sent'].includes(d.status || '')).reduce((a, d) => a + (d.total_amount || 0), 0)

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}25` }}>
                            <Receipt size={18} style={{ color: GOLD }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Facturation</h1>
                    </div>
                    <p className="text-sm opacity-50">Factures & devis du système</p>
                </div>
                <button onClick={() => setRefresh(r => r + 1)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-all" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
                </button>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total documents', value: String(docs.length), color: GOLD, icon: Receipt },
                    { label: 'Encaissé', value: fmt(totalPaid), color: GREEN_L, icon: CheckCircle2 },
                    { label: 'En attente', value: fmt(totalPending), color: YELLOW, icon: Clock },
                    { label: 'En retard', value: String(docs.filter(d => d.status === 'overdue').length), color: RED, icon: AlertTriangle },
                ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                        className="rounded-2xl p-4" style={{ background: '#0D2615', border: `1px solid ${s.color}20` }}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs opacity-40 uppercase tracking-wider">{s.label}</span>
                            <s.icon size={14} style={{ color: s.color }} />
                        </div>
                        <div className="font-black" style={{ color: s.color, fontSize: s.label === 'Encaissé' || s.label === 'En attente' ? '14px' : '20px' }}>{s.value}</div>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-5 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Numéro, client..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: '#0D2615', border: `1px solid ${GOLD}20`, color: TEXT }} />
                </div>
                {[{ k: 'all', l: 'Tout' }, { k: 'invoice', l: 'Factures' }, { k: 'quote', l: 'Devis' }].map(t => (
                    <button key={t.k} onClick={() => setDocType(t.k as typeof docType)}
                        className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                        style={{ background: docType === t.k ? GOLD : `${GOLD}12`, color: docType === t.k ? BG : GOLD }}>
                        {t.l}
                    </button>
                ))}
            </div>

            {/* Table */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                className="rounded-2xl overflow-hidden" style={{ background: '#0D2615', border: `1px solid ${GOLD}15` }}>
                <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: `${GOLD}15` }}>
                    <h2 className="font-bold text-sm" style={{ color: GOLD }}>Documents de facturation</h2>
                    <span className="text-xs opacity-40">{filtered.length} document{filtered.length > 1 ? 's' : ''}</span>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40" /></div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center opacity-30 text-sm">Aucun document trouvé</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-xs opacity-40 uppercase tracking-wider border-b" style={{ borderColor: `${GOLD}10` }}>
                                <th className="text-left px-5 py-3">N°</th>
                                <th className="text-left px-5 py-3">Type</th>
                                <th className="text-left px-5 py-3">Client</th>
                                <th className="text-left px-5 py-3">Date</th>
                                <th className="text-left px-5 py-3">Statut</th>
                                <th className="text-right px-5 py-3">Montant</th>
                                <th className="px-5 py-3"></th>
                            </tr></thead>
                            <tbody>
                                {filtered.map(d => {
                                    const meta = STATUS_META[d.status || ''] || { label: d.status || '—', color: '#94a3b8' }
                                    return (
                                        <tr key={d.id} className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: `${GOLD}08` }}>
                                            <td className="px-5 py-3 font-mono text-xs opacity-70">{d.number || d.id.slice(0, 8).toUpperCase()}</td>
                                            <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${d.type === 'invoice' ? GREEN_L : GOLD}20`, color: d.type === 'invoice' ? GREEN_L : GOLD }}>{d.type === 'invoice' ? 'Facture' : 'Devis'}</span></td>
                                            <td className="px-5 py-3 text-xs opacity-70">{d.client_name || d.client_email || '—'}</td>
                                            <td className="px-5 py-3 text-xs opacity-60">{fmtDate(d.created_at)}</td>
                                            <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${meta.color}20`, color: meta.color }}>{meta.label}</span></td>
                                            <td className="px-5 py-3 text-right font-bold" style={{ color: ['paid', 'accepted'].includes(d.status || '') ? GREEN_L : TEXT }}>{fmt(d.total_amount || 0)}</td>
                                            <td className="px-5 py-3">
                                                <button onClick={() => setSelected(d)} title="Voir" className="p-1.5 rounded-lg hover:opacity-80 transition-opacity" style={{ background: `${GOLD}15` }}>
                                                    <Eye size={12} style={{ color: GOLD }} />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>

            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={() => setSelected(null)}>
                    <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()}
                        className="w-full max-w-md rounded-3xl p-6" style={{ background: '#0D2615', border: `1px solid ${GOLD}30` }}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-black" style={{ color: GOLD }}>Détail document</h3>
                            <button onClick={() => setSelected(null)} title="Fermer" className="opacity-40 hover:opacity-70 p-1"><X size={18} /></button>
                        </div>
                        {[['Numéro', selected.number || selected.id.slice(0, 8).toUpperCase()], ['Type', selected.type === 'invoice' ? 'Facture' : 'Devis'], ['Client', selected.client_name || selected.client_email || '—'], ['Montant', fmt(selected.total_amount || 0)], ['Statut', STATUS_META[selected.status || '']?.label || selected.status || '—'], ['Date', fmtDate(selected.created_at)], ['Échéance', selected.due_date ? fmtDate(selected.due_date) : '—']].map(([k, v]) => (
                            <div key={k} className="flex justify-between py-2 border-b text-sm" style={{ borderColor: `${GOLD}10` }}>
                                <span className="opacity-50">{k}</span><span className="font-semibold">{v}</span>
                            </div>
                        ))}
                    </motion.div>
                </div>
            )}
        </div>
    )
}
