'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, Ban, RefreshCw, Loader2, Globe, Zap, Lock } from 'lucide-react'

const GOLD = '#D4AF37'; const YELLOW = '#FCD116'; const GREEN = '#008751'
const GREEN_L = '#00A86B'; const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'

function fmtDate(d: string | null | undefined) {
    if (!d) return 'N/A'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? 'N/A' : dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

interface WafLog { id: string; created_at: string; ip: string; threat_type?: string; path?: string; is_blocked?: boolean; country_code?: string }
interface IpBlock { id: string; created_at: string; ip: string; reason?: string; blocked_by?: string; violation_count?: number; unblocked_at?: string | null }

export default function CeoSecurite() {
    const [logs, setLogs] = useState<WafLog[]>([])
    const [blocks, setBlocks] = useState<IpBlock[]>([])
    const [memStats, setMemStats] = useState<{ total: number; dangerous: number }>({ total: 0, dangerous: 0 })
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<'logs' | 'blocks'>('logs')
    const [refresh, setRefresh] = useState(0)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/ceo/securite?hours=24', { cache: 'no-store' })
            if (res.ok) {
                const d = await res.json()
                setLogs(d.logs || [])
                setBlocks(d.blocks || [])
                const mem = d.memory || []
                setMemStats({ total: mem.length, dangerous: mem.filter((r: { trust_score: number }) => r.trust_score < 20).length })
            }
        } catch { /* silent */ }
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const blocked24h = logs.filter(l => l.is_blocked).length
    const uniqueIps = new Set(logs.map(l => l.ip)).size
    const score = Math.max(0, Math.min(100, 100 - Math.min(40, blocks.length * 4) - Math.min(30, blocked24h / 5)))
    const scoreColor = score >= 75 ? GREEN_L : score >= 45 ? YELLOW : RED

    const THREAT_COLORS: Record<string, string> = {
        sql_injection: RED, xss: '#f97316', rce: RED, path_traversal: '#f97316',
        brute_force: YELLOW, suspicious: YELLOW, bot: '#94a3b8',
    }

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}30` }}>
                            <ShieldCheck size={18} style={{ color: GREEN_L }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Sécurité</h1>
                    </div>
                    <p className="text-sm opacity-50">WAF — Firewall applicatif temps réel</p>
                </div>
                <button onClick={() => setRefresh(r => r + 1)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-all" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
                </button>
            </motion.div>

            {/* Score sécurité */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl p-6 mb-6 flex items-center gap-6" style={{ background: '#0D2615', border: `2px solid ${scoreColor}30` }}>
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black flex-shrink-0" style={{ background: `${scoreColor}20`, border: `3px solid ${scoreColor}`, color: scoreColor }}>
                    {Math.round(score)}
                </div>
                <div>
                    <div className="text-lg font-black mb-1" style={{ color: scoreColor }}>
                        Score de sécurité : {score >= 75 ? 'Excellent' : score >= 45 ? 'Modéré' : 'Critique'}
                    </div>
                    <p className="text-sm opacity-50">{blocks.length} IPs bloquées · {blocked24h} attaques bloquées (24h) · {uniqueIps} IPs uniques détectées</p>
                </div>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Événements (24h)', value: String(logs.length), icon: Zap, color: YELLOW },
                    { label: 'Bloqués (24h)', value: String(blocked24h), icon: Ban, color: RED },
                    { label: 'IPs bloquées actives', value: String(blocks.length), icon: Lock, color: RED },
                    { label: 'IPs mémoire', value: `${memStats.dangerous}/${memStats.total}`, icon: Globe, color: GOLD },
                ].map((k, i) => (
                    <motion.div key={k.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                        className="rounded-2xl p-4" style={{ background: '#0D2615', border: `1px solid ${k.color}20` }}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs opacity-40 uppercase tracking-wider">{k.label}</span>
                            <k.icon size={14} style={{ color: k.color }} />
                        </div>
                        <div className="text-xl font-black" style={{ color: k.color }}>{k.value}</div>
                    </motion.div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-5">
                {[{ key: 'logs', label: `Événements WAF (${logs.length})` }, { key: 'blocks', label: `IPs Bloquées (${blocks.length})` }].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
                        className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                        style={{ background: tab === t.key ? GREEN : `${GREEN}20`, color: tab === t.key ? '#fff' : GREEN_L }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl overflow-hidden" style={{ background: '#0D2615', border: `1px solid ${GOLD}15` }}>
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40" /></div>
                ) : tab === 'logs' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-xs opacity-40 uppercase tracking-wider border-b" style={{ borderColor: `${GOLD}10` }}>
                                <th className="text-left px-4 py-3">IP</th>
                                <th className="text-left px-4 py-3">Menace</th>
                                <th className="text-left px-4 py-3">Chemin</th>
                                <th className="text-left px-4 py-3">Pays</th>
                                <th className="text-left px-4 py-3">Statut</th>
                                <th className="text-left px-4 py-3">Date</th>
                            </tr></thead>
                            <tbody>
                                {logs.map(l => (
                                    <tr key={l.id} className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: `${GOLD}08` }}>
                                        <td className="px-4 py-2.5 font-mono text-xs opacity-80">{l.ip}</td>
                                        <td className="px-4 py-2.5">
                                            {l.threat_type && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${THREAT_COLORS[l.threat_type] || '#94a3b8'}25`, color: THREAT_COLORS[l.threat_type] || '#94a3b8' }}>{l.threat_type}</span>}
                                        </td>
                                        <td className="px-4 py-2.5 font-mono text-xs opacity-50 max-w-[140px] truncate">{l.path || '—'}</td>
                                        <td className="px-4 py-2.5 text-xs opacity-60">{l.country_code || '—'}</td>
                                        <td className="px-4 py-2.5">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: l.is_blocked ? `${RED}20` : `${GREEN_L}20`, color: l.is_blocked ? RED : GREEN_L }}>
                                                {l.is_blocked ? 'Bloqué' : 'Passé'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs opacity-50">{fmtDate(l.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-xs opacity-40 uppercase tracking-wider border-b" style={{ borderColor: `${GOLD}10` }}>
                                <th className="text-left px-4 py-3">IP</th>
                                <th className="text-left px-4 py-3">Raison</th>
                                <th className="text-left px-4 py-3">Violations</th>
                                <th className="text-left px-4 py-3">Bloqué par</th>
                                <th className="text-left px-4 py-3">Date</th>
                            </tr></thead>
                            <tbody>
                                {blocks.length === 0 ? (
                                    <tr><td colSpan={5} className="py-12 text-center opacity-30 text-sm">Aucune IP bloquée</td></tr>
                                ) : blocks.map(b => (
                                    <tr key={b.id} className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: `${GOLD}08` }}>
                                        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: RED }}>{b.ip}</td>
                                        <td className="px-4 py-2.5 text-xs opacity-60 max-w-[180px] truncate">{b.reason || '—'}</td>
                                        <td className="px-4 py-2.5">
                                            {b.violation_count && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${RED}20`, color: RED }}>{b.violation_count}</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs opacity-50">{b.blocked_by || '—'}</td>
                                        <td className="px-4 py-2.5 text-xs opacity-50">{fmtDate(b.created_at)}</td>
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
