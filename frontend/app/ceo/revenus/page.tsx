'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, ArrowUpRight, DollarSign, Calendar, ShoppingBag, CreditCard, RefreshCw, Loader2 } from 'lucide-react'

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
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Order { id: string; created_at: string; total_amount: number; status: string; client_email?: string }

const STATUS_COLOR: Record<string, string> = {
    completed: GREEN_L, paid: GREEN_L, pending: YELLOW,
    cancelled: RED, refunded: '#94a3b8', processing: '#60a5fa',
}
const STATUS_LABEL: Record<string, string> = {
    completed: 'Complétée', paid: 'Payée', pending: 'En attente',
    cancelled: 'Annulée', refunded: 'Remboursée', processing: 'En cours',
}

export default function CeoRevenus() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month')
    const [refresh, setRefresh] = useState(0)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            const now = new Date()
            let since: Date | null = null
            if (period === 'today') { since = new Date(now); since.setHours(0, 0, 0, 0) }
            else if (period === 'week') { since = new Date(Date.now() - 7 * 86400000) }
            else if (period === 'month') { since = new Date(now); since.setDate(1); since.setHours(0, 0, 0, 0) }
            else if (period === 'year') { since = new Date(now); since.setMonth(0, 1); since.setHours(0, 0, 0, 0) }

                const params = new URLSearchParams({ limit: '500' })
            if (since) params.set('since', since.toISOString())
            const res = await fetch(`/api/ceo/orders?${params}`, { cache: 'no-store' })
            const data = res.ok ? await res.json() : { orders: [] }
            setOrders(data.orders || [])
            setLoading(false)
        }
        load()
    }, [period, refresh])

    const paidOrders = orders.filter(o => ['completed', 'paid'].includes(o.status))
    const totalRevenue = paidOrders.reduce((a, o) => a + (o.total_amount || 0), 0)
    const pending = orders.filter(o => o.status === 'pending').reduce((a, o) => a + (o.total_amount || 0), 0)
    const avgOrder = paidOrders.length ? Math.round(totalRevenue / paidOrders.length) : 0

    const PERIODS = [
        { key: 'today', label: "Aujourd'hui" },
        { key: 'week', label: '7 jours' },
        { key: 'month', label: 'Ce mois' },
        { key: 'year', label: 'Cette année' },
        { key: 'all', label: 'Tout' },
    ]

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}30` }}>
                            <TrendingUp size={18} style={{ color: GREEN_L }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Revenus</h1>
                    </div>
                    <p className="text-sm opacity-50">Analyse financière en temps réel</p>
                </div>
                <button onClick={() => setRefresh(r => r + 1)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
                </button>
            </motion.div>

            {/* Period selector */}
            <div className="flex gap-2 mb-8 flex-wrap">
                {PERIODS.map(p => (
                    <button key={p.key} onClick={() => setPeriod(p.key as typeof period)}
                        className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                        style={{ background: period === p.key ? GOLD : `${GOLD}15`, color: period === p.key ? BG : GOLD, boxShadow: period === p.key ? `0 4px 20px ${GOLD}40` : 'none' }}>
                        {p.label}
                    </button>
                ))}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Revenus encaissés', value: fmt(totalRevenue), icon: TrendingUp, color: GREEN_L, sub: `${paidOrders.length} commandes` },
                    { label: 'En attente', value: fmt(pending), icon: Calendar, color: YELLOW, sub: `${orders.filter(o => o.status === 'pending').length} cmd.` },
                    { label: 'Panier moyen', value: fmt(avgOrder), icon: ShoppingBag, color: GOLD, sub: 'par commande' },
                    { label: 'Total commandes', value: String(orders.length), icon: CreditCard, color: '#60a5fa', sub: 'sur la période' },
                ].map((k, i) => (
                    <motion.div key={k.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                        className="rounded-2xl p-5" style={{ background: '#0D2615', border: `1px solid ${k.color}20` }}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold opacity-50 uppercase tracking-wider">{k.label}</span>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${k.color}20` }}>
                                <k.icon size={16} style={{ color: k.color }} />
                            </div>
                        </div>
                        <div className="text-xl font-black" style={{ color: k.color }}>{k.value}</div>
                        <div className="text-xs opacity-40 mt-1">{k.sub}</div>
                    </motion.div>
                ))}
            </div>

            {/* Orders table */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="rounded-2xl overflow-hidden" style={{ background: '#0D2615', border: `1px solid ${GOLD}15` }}>
                <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: `${GOLD}15` }}>
                    <h2 className="font-bold text-sm" style={{ color: GOLD }}>Historique des transactions</h2>
                    <span className="text-xs opacity-40">{orders.length} résultats</span>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={28} className="animate-spin opacity-40" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="py-16 text-center opacity-30 text-sm">Aucune commande sur cette période</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs opacity-40 uppercase tracking-wider border-b" style={{ borderColor: `${GOLD}10` }}>
                                    <th className="text-left px-5 py-3">Date</th>
                                    <th className="text-left px-5 py-3">Client</th>
                                    <th className="text-left px-5 py-3">Statut</th>
                                    <th className="text-right px-5 py-3">Montant</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((o, i) => (
                                    <tr key={o.id} className="border-b transition-colors hover:bg-white/[0.02]" style={{ borderColor: `${GOLD}08` }}>
                                        <td className="px-5 py-3 opacity-70">{fmtDate(o.created_at)}</td>
                                        <td className="px-5 py-3 font-mono text-xs opacity-60">{o.client_email || o.id.slice(0, 12) + '...'}</td>
                                        <td className="px-5 py-3">
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: `${STATUS_COLOR[o.status] || '#94a3b8'}20`, color: STATUS_COLOR[o.status] || '#94a3b8' }}>
                                                {STATUS_LABEL[o.status] || o.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-right font-bold" style={{ color: ['completed', 'paid'].includes(o.status) ? GREEN_L : TEXT }}>
                                            {fmt(o.total_amount || 0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>
        </div>
    )
}
