'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ShoppingBag, Search, RefreshCw, Loader2, Eye, CheckCircle2, XCircle, Clock, Filter } from 'lucide-react'

const GOLD = '#D4AF37'; const YELLOW = '#FCD116'; const GREEN = '#008751'
const GREEN_L = '#00A86B'; const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'

function fmt(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M FCFA`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K FCFA`
    return `${n.toLocaleString('fr-FR')} FCFA`
}
function fmtDate(d: string) {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface Order {
    id: string; created_at: string; total_amount: number; status: string
    client_email?: string; currency?: string; payment_method?: string
    updated_at?: string
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ size?: number }> }> = {
    completed:  { label: 'Complétée',   color: GREEN_L, bg: `${GREEN_L}20`, icon: CheckCircle2 },
    paid:       { label: 'Payée',        color: GREEN_L, bg: `${GREEN_L}20`, icon: CheckCircle2 },
    pending:    { label: 'En attente',   color: YELLOW,  bg: `${YELLOW}20`,  icon: Clock },
    processing: { label: 'En cours',     color: '#60a5fa', bg: '#60a5fa20',  icon: RefreshCw },
    cancelled:  { label: 'Annulée',      color: RED,     bg: `${RED}20`,     icon: XCircle },
    refunded:   { label: 'Remboursée',   color: '#94a3b8', bg: '#94a3b820',  icon: XCircle },
}

const ALL_STATUSES = ['all', 'pending', 'processing', 'completed', 'paid', 'cancelled', 'refunded']

export default function CeoCommandes() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [selected, setSelected] = useState<Order | null>(null)
    const [refresh, setRefresh] = useState(0)

    const load = useCallback(async () => {
        setLoading(true)
        const params = new URLSearchParams({ limit: '500' })
        if (statusFilter !== 'all') params.set('status', statusFilter)
        const res = await fetch(`/api/ceo/orders?${params}`, { cache: 'no-store' })
        const data = res.ok ? await res.json() : { orders: [] }
        setOrders(data.orders || [])
        setLoading(false)
    }, [statusFilter, refresh])

    useEffect(() => { load() }, [load])

    const filtered = orders.filter(o =>
        !search || o.id.toLowerCase().includes(search.toLowerCase()) ||
        (o.client_email || '').toLowerCase().includes(search.toLowerCase())
    )

    const stats = {
        total: orders.length,
        revenue: orders.filter(o => ['completed', 'paid'].includes(o.status)).reduce((a, o) => a + (o.total_amount || 0), 0),
        pending: orders.filter(o => o.status === 'pending').length,
        cancelled: orders.filter(o => o.status === 'cancelled').length,
    }

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${YELLOW}25` }}>
                            <ShoppingBag size={18} style={{ color: YELLOW }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Commandes</h1>
                    </div>
                    <p className="text-sm opacity-50">Toutes les commandes du système</p>
                </div>
                <button onClick={() => setRefresh(r => r + 1)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
                </button>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total', value: String(stats.total), color: GOLD },
                    { label: 'Revenus', value: fmt(stats.revenue), color: GREEN_L },
                    { label: 'En attente', value: String(stats.pending), color: YELLOW },
                    { label: 'Annulées', value: String(stats.cancelled), color: RED },
                ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className="rounded-2xl p-4" style={{ background: '#0D2615', border: `1px solid ${s.color}20` }}>
                        <div className="text-xs opacity-40 uppercase tracking-wider mb-1">{s.label}</div>
                        <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par ID, email..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: '#0D2615', border: `1px solid ${GOLD}20`, color: TEXT }} />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {ALL_STATUSES.map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)} className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                            style={{ background: statusFilter === s ? GOLD : `${GOLD}12`, color: statusFilter === s ? BG : GOLD }}>
                            {s === 'all' ? 'Tout' : STATUS_META[s]?.label || s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                className="rounded-2xl overflow-hidden" style={{ background: '#0D2615', border: `1px solid ${GOLD}15` }}>
                <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: `${GOLD}15` }}>
                    <h2 className="font-bold text-sm" style={{ color: GOLD }}>Liste des commandes</h2>
                    <span className="text-xs opacity-40">{filtered.length} résultats</span>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40" /></div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center opacity-30 text-sm">Aucune commande trouvée</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs opacity-40 uppercase tracking-wider border-b" style={{ borderColor: `${GOLD}10` }}>
                                    <th className="text-left px-5 py-3">ID</th>
                                    <th className="text-left px-5 py-3">Client</th>
                                    <th className="text-left px-5 py-3">Date</th>
                                    <th className="text-left px-5 py-3">Statut</th>
                                    <th className="text-right px-5 py-3">Montant</th>
                                    <th className="px-5 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(o => {
                                    const meta = STATUS_META[o.status] || { label: o.status, color: '#94a3b8', bg: '#94a3b820', icon: Clock }
                                    return (
                                        <tr key={o.id} className="border-b transition-colors hover:bg-white/[0.02]" style={{ borderColor: `${GOLD}08` }}>
                                            <td className="px-5 py-3 font-mono text-xs opacity-50">{o.id.slice(0, 8)}...</td>
                                            <td className="px-5 py-3 text-xs opacity-70">{o.client_email || '—'}</td>
                                            <td className="px-5 py-3 text-xs opacity-60">{fmtDate(o.created_at)}</td>
                                            <td className="px-5 py-3">
                                                <span className="flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: meta.bg, color: meta.color }}>
                                                    <meta.icon size={10} /> {meta.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right font-bold" style={{ color: ['completed', 'paid'].includes(o.status) ? GREEN_L : TEXT }}>
                                                {fmt(o.total_amount || 0)}
                                            </td>
                                            <td className="px-5 py-3">
                                                <button onClick={() => setSelected(o)} className="p-1.5 rounded-lg hover:opacity-80 transition-opacity" style={{ background: `${GOLD}15` }} title="Détail">
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

            {/* Detail modal */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setSelected(null)}>
                    <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()}
                        className="w-full max-w-md rounded-3xl p-6" style={{ background: '#0D2615', border: `1px solid ${GOLD}30` }}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-black" style={{ color: GOLD }}>Détail commande</h3>
                            <button onClick={() => setSelected(null)} className="opacity-40 hover:opacity-70 transition-opacity">✕</button>
                        </div>
                        {[
                            ['ID', selected.id],
                            ['Statut', STATUS_META[selected.status]?.label || selected.status],
                            ['Client', selected.client_email || '—'],
                            ['Montant', fmt(selected.total_amount || 0)],
                            ['Devise', selected.currency || 'XOF'],
                            ['Paiement', selected.payment_method || '—'],
                            ['Créée le', fmtDate(selected.created_at)],
                            ['Mise à jour', selected.updated_at ? fmtDate(selected.updated_at) : '—'],
                        ].map(([k, v]) => (
                            <div key={k} className="flex justify-between py-2 border-b text-sm" style={{ borderColor: `${GOLD}10` }}>
                                <span className="opacity-50">{k}</span>
                                <span className="font-semibold">{v}</span>
                            </div>
                        ))}
                    </motion.div>
                </div>
            )}
        </div>
    )
}
