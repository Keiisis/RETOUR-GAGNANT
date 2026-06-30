'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Users, ShoppingBag, ShieldCheck, Download, RefreshCw, Loader2, FileText } from 'lucide-react'

const GOLD = '#D4AF37'; const YELLOW = '#FCD116'; const GREEN = '#008751'
const GREEN_L = '#00A86B'; const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'

function fmt(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M FCFA`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K FCFA`
    return `${n.toLocaleString('fr-FR')} FCFA`
}

interface Stats {
    revenue_total: number; revenue_month: number
    orders_total: number; orders_month: number
    clients_total: number; clients_month: number
    agents_count: number; messages_total: number
    dossiers_total: number; waf_blocks: number
}

export default function CeoRapports() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [refresh, setRefresh] = useState(0)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                const res = await fetch('/api/ceo/rapports', { cache: 'no-store' })
                if (res.ok) {
                    const d = await res.json()
                    setStats({
                        revenue_total:  d.total_revenue   || 0,
                        revenue_month:  d.monthly?.[d.monthly.length - 1]?.revenue || 0,
                        orders_total:   d.total_orders    || 0,
                        orders_month:   d.monthly?.[d.monthly.length - 1]?.orders  || 0,
                        clients_total:  d.total_clients   || 0,
                        clients_month:  0,
                        agents_count:   0,
                        messages_total: 0,
                        dossiers_total: d.dossiers_total  || 0,
                        waf_blocks:     0,
                    })
                }
            } catch { /* silent */ }
            setLoading(false)
        }
        load()
    }, [refresh])

    const CARDS = stats ? [
        { title: 'Revenus totaux', value: fmt(stats.revenue_total), sub: `Ce mois : ${fmt(stats.revenue_month)}`, icon: TrendingUp, color: GREEN_L },
        { title: 'Commandes', value: String(stats.orders_total), sub: `Ce mois : ${stats.orders_month}`, icon: ShoppingBag, color: YELLOW },
        { title: 'Clients', value: String(stats.clients_total), sub: `Ce mois : ${stats.clients_month}`, icon: Users, color: GOLD },
        { title: 'Agents actifs', value: String(stats.agents_count), sub: 'dans le système', icon: Users, color: '#60a5fa' },
        { title: 'Dossiers', value: String(stats.dossiers_total), sub: 'dossiers ouverts', icon: FileText, color: '#a78bfa' },
        { title: 'Messages reçus', value: String(stats.messages_total), sub: 'total messages', icon: BarChart3, color: '#f97316' },
        { title: 'IPs bloquées', value: String(stats.waf_blocks), sub: 'actives', icon: ShieldCheck, color: RED },
    ] : []

    const REPORT_TYPES = [
        { title: 'Rapport financier mensuel', desc: 'Revenus, commandes, paiements du mois', color: GREEN_L, icon: TrendingUp },
        { title: 'Rapport clientèle', desc: 'Nouveaux clients, rétention, géographie', color: GOLD, icon: Users },
        { title: 'Rapport dossiers', desc: 'Statuts, avancement, agents assignés', color: '#60a5fa', icon: FileText },
        { title: 'Rapport sécurité', desc: 'Attaques, IPs bloquées, score WAF', color: RED, icon: ShieldCheck },
    ]

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}25` }}>
                            <BarChart3 size={18} style={{ color: GOLD }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Rapports</h1>
                    </div>
                    <p className="text-sm opacity-50">Vue consolidée de tout le système</p>
                </div>
                <button onClick={() => setRefresh(r => r + 1)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-all" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
                </button>
            </motion.div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40" /></div>
            ) : (
                <>
                    {/* KPI Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {CARDS.map((k, i) => (
                            <motion.div key={k.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                                className="rounded-2xl p-5" style={{ background: '#0D2615', border: `1px solid ${k.color}20` }}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs opacity-40 uppercase tracking-wider leading-tight">{k.title}</span>
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${k.color}20` }}>
                                        <k.icon size={14} style={{ color: k.color }} />
                                    </div>
                                </div>
                                <div className="text-2xl font-black" style={{ color: k.color }}>{k.value}</div>
                                <div className="text-xs opacity-40 mt-1">{k.sub}</div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Report export cards */}
                    <h2 className="text-sm font-black opacity-50 uppercase tracking-widest mb-4">Générer un rapport</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {REPORT_TYPES.map((r, i) => (
                            <motion.div key={r.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.08 }}
                                className="rounded-2xl p-5 flex items-center justify-between gap-4 hover:border-opacity-50 transition-all" style={{ background: '#0D2615', border: `1px solid ${r.color}25` }}>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${r.color}20` }}>
                                        <r.icon size={18} style={{ color: r.color }} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm">{r.title}</div>
                                        <div className="text-xs opacity-50 mt-0.5">{r.desc}</div>
                                    </div>
                                </div>
                                <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all hover:opacity-80" style={{ background: `${r.color}20`, color: r.color }}
                                    title="Export PDF (bientôt disponible)">
                                    <Download size={12} /> PDF
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
