'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Shield, Ban, Activity, RefreshCw, Trash2, Plus,
    AlertTriangle, CheckCircle2, Clock, Globe, Zap,
    ChevronLeft, ChevronRight, Search, Filter
} from 'lucide-react'

interface IpBlock {
    id: string
    ip: string
    reason: string
    blocked_by: 'auto' | 'manual'
    violation_count: number
    blocked_at: string
    expires_at: string | null
}

interface WafLog {
    id: string
    ip: string
    method: string
    path: string
    user_agent: string
    threat_type: string
    threat_detail: string | null
    created_at: string
}

interface WafSummary {
    recentLogs: WafLog[]
    blockedIps: IpBlock[]
    threatStats: Record<string, number>
    topIps: { ip: string; count: number }[]
    totalLogs24h: number
    totalBlocked: number
}

const THREAT_LABELS: Record<string, string> = {
    sql_injection:   'Injection SQL',
    xss:             'XSS',
    path_traversal:  'Path Traversal',
    rate_limit:      'Rate Limit',
    blocked_ip:      'IP Bloquée',
    suspicious_ua:   'UA Suspect',
}

const THREAT_COLORS: Record<string, string> = {
    sql_injection:  'text-red-400 bg-red-500/10 border-red-500/30',
    xss:            'text-orange-400 bg-orange-500/10 border-orange-500/30',
    path_traversal: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    rate_limit:     'text-blue-400 bg-blue-500/10 border-blue-500/30',
    blocked_ip:     'text-gray-400 bg-gray-500/10 border-gray-500/30',
    suspicious_ua:  'text-purple-400 bg-purple-500/10 border-purple-500/30',
}

const PAGE_SIZE = 20

export default function SecuritePage() {
    const [summary, setSummary] = useState<WafSummary | null>(null)
    const [logs, setLogs]       = useState<WafLog[]>([])
    const [totalLogs, setTotalLogs] = useState(0)
    const [logsPage, setLogsPage]   = useState(0)
    const [tab, setTab]         = useState<'overview' | 'logs' | 'blocks'>('overview')
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    // Blocage manuel
    const [newIp, setNewIp]     = useState('')
    const [newReason, setNewReason] = useState('')
    const [blocking, setBlocking]   = useState(false)
    const [blockMsg, setBlockMsg]   = useState('')

    // Recherche logs
    const [logSearch, setLogSearch] = useState('')

    const load = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true)
        else setRefreshing(true)
        try {
            const [summaryRes, logsRes] = await Promise.all([
                fetch('/api/admin/waf'),
                fetch(`/api/admin/waf?view=logs&limit=${PAGE_SIZE}&offset=${logsPage * PAGE_SIZE}`),
            ])
            const s = await summaryRes.json()
            const l = await logsRes.json()
            setSummary(s)
            setLogs(l.logs || [])
            setTotalLogs(l.total || 0)
        } catch {
            /* silencieux */
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [logsPage])

    useEffect(() => { load() }, [load])

    async function unblockIp(ip: string) {
        await fetch(`/api/admin/waf?ip=${encodeURIComponent(ip)}`, { method: 'DELETE' })
        load(true)
    }

    async function blockIp() {
        if (!/^[\d.:a-f]+$/i.test(newIp)) {
            setBlockMsg('Format IP invalide')
            return
        }
        setBlocking(true)
        setBlockMsg('')
        const res = await fetch('/api/admin/waf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: newIp.trim(), reason: newReason || 'Blocage manuel' }),
        })
        const d = await res.json()
        if (!res.ok) { setBlockMsg(d.error || 'Erreur'); setBlocking(false); return }
        setBlockMsg('IP bloquée avec succès')
        setNewIp('')
        setNewReason('')
        setBlocking(false)
        load(true)
    }

    const filteredLogs = logSearch
        ? logs.filter(l =>
            l.ip.includes(logSearch) ||
            l.path.toLowerCase().includes(logSearch.toLowerCase()) ||
            l.threat_type.includes(logSearch.toLowerCase()))
        : logs

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Sécurité — WAF & Protection</h1>
                        <p className="text-gray-400 text-sm">Pare-feu applicatif, blocage IP, journaux d'attaques</p>
                    </div>
                </div>
                <button
                    onClick={() => load(true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors text-sm"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Actualiser
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 border border-red-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-gray-400 text-xs">Attaques 24h</span>
                    </div>
                    <p className="text-3xl font-bold text-red-400">{summary?.totalLogs24h ?? 0}</p>
                </div>
                <div className="bg-gray-800/50 border border-orange-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Ban className="w-4 h-4 text-orange-400" />
                        <span className="text-gray-400 text-xs">IPs bloquées</span>
                    </div>
                    <p className="text-3xl font-bold text-orange-400">{summary?.totalBlocked ?? 0}</p>
                </div>
                <div className="bg-gray-800/50 border border-blue-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-blue-400" />
                        <span className="text-gray-400 text-xs">Type le + fréquent</span>
                    </div>
                    <p className="text-lg font-bold text-blue-400">
                        {summary?.threatStats
                            ? THREAT_LABELS[Object.entries(summary.threatStats).sort((a,b)=>b[1]-a[1])[0]?.[0]] || '—'
                            : '—'}
                    </p>
                </div>
                <div className="bg-gray-800/50 border border-green-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <span className="text-gray-400 text-xs">Statut WAF</span>
                    </div>
                    <p className="text-lg font-bold text-green-400">Actif</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-800/50 border border-gray-700 rounded-xl p-1 w-fit">
                {(['overview', 'logs', 'blocks'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        {t === 'overview' ? 'Synthèse' : t === 'logs' ? 'Journal WAF' : 'IPs bloquées'}
                    </button>
                ))}
            </div>

            {/* ── OVERVIEW ── */}
            {tab === 'overview' && summary && (
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Stats par type */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
                        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-amber-400" />
                            Menaces par type (24h)
                        </h2>
                        <div className="space-y-3">
                            {Object.entries(summary.threatStats).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                                const max = Math.max(...Object.values(summary.threatStats))
                                return (
                                    <div key={type} className="flex items-center gap-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium w-32 text-center ${THREAT_COLORS[type] || 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>
                                            {THREAT_LABELS[type] || type}
                                        </span>
                                        <div className="flex-1 bg-gray-900 rounded-full h-2">
                                            <div
                                                className="h-2 rounded-full bg-amber-500 transition-all"
                                                style={{ width: `${(count / max) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-white font-mono text-sm w-8 text-right">{count}</span>
                                    </div>
                                )
                            })}
                            {Object.keys(summary.threatStats).length === 0 && (
                                <p className="text-gray-500 text-sm">Aucune menace détectée dans les 24 dernières heures</p>
                            )}
                        </div>
                    </div>

                    {/* Top IPs */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
                        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                            <Globe className="w-4 h-4 text-amber-400" />
                            IPs les plus actives (24h)
                        </h2>
                        <div className="space-y-2">
                            {summary.topIps.map(({ ip, count }) => (
                                <div key={ip} className="flex items-center justify-between bg-gray-900/50 rounded-lg px-3 py-2">
                                    <code className="text-amber-400 font-mono text-sm">{ip}</code>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-300 font-semibold text-sm">{count} req.</span>
                                        <button
                                            onClick={() => unblockIp(ip)}
                                            className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition-colors"
                                            title="Bloquer cette IP"
                                        >
                                            <Ban className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {summary.topIps.length === 0 && (
                                <p className="text-gray-500 text-sm">Aucune activité suspecte récente</p>
                            )}
                        </div>
                    </div>

                    {/* Derniers logs */}
                    <div className="lg:col-span-2 bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
                        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-400" />
                            Dernières menaces détectées
                        </h2>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {summary.recentLogs.map(log => (
                                <LogRow key={log.id} log={log} />
                            ))}
                            {summary.recentLogs.length === 0 && (
                                <p className="text-gray-500 text-sm">Aucune menace récente</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── LOGS ── */}
            {tab === 'logs' && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                value={logSearch}
                                onChange={e => setLogSearch(e.target.value)}
                                placeholder="Filtrer par IP, chemin, type..."
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                            />
                        </div>
                        <div className="flex items-center gap-1 text-gray-400 text-sm">
                            <Filter className="w-4 h-4" />
                            {totalLogs} entrées
                        </div>
                    </div>

                    <div className="space-y-1 max-h-[500px] overflow-y-auto">
                        {filteredLogs.map(log => (
                            <LogRow key={log.id} log={log} detailed />
                        ))}
                        {filteredLogs.length === 0 && (
                            <p className="text-gray-500 text-sm py-4 text-center">Aucun résultat</p>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalLogs > PAGE_SIZE && (
                        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                            <span className="text-gray-400 text-sm">
                                {logsPage * PAGE_SIZE + 1}–{Math.min((logsPage + 1) * PAGE_SIZE, totalLogs)} sur {totalLogs}
                            </span>
                            <div className="flex gap-1">
                                <button onClick={() => setLogsPage(p => Math.max(0, p - 1))} disabled={logsPage === 0} className="p-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 disabled:opacity-40 hover:bg-gray-700 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button onClick={() => setLogsPage(p => p + 1)} disabled={(logsPage + 1) * PAGE_SIZE >= totalLogs} className="p-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 disabled:opacity-40 hover:bg-gray-700 transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── BLOCKS ── */}
            {tab === 'blocks' && (
                <div className="space-y-4">
                    {/* Blocage manuel */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
                        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-amber-400" />
                            Bloquer une IP manuellement
                        </h2>
                        <div className="flex gap-3 flex-wrap">
                            <input
                                value={newIp}
                                onChange={e => setNewIp(e.target.value)}
                                placeholder="192.168.1.1"
                                className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-red-500 transition-colors w-48"
                            />
                            <input
                                value={newReason}
                                onChange={e => setNewReason(e.target.value)}
                                placeholder="Raison (optionnel)"
                                className="flex-1 min-w-48 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                            />
                            <button
                                onClick={blockIp}
                                disabled={blocking || !newIp}
                                className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                            >
                                <Ban className="w-4 h-4" />
                                Bloquer
                            </button>
                        </div>
                        {blockMsg && (
                            <p className={`mt-2 text-sm ${blockMsg.includes('succès') ? 'text-green-400' : 'text-red-400'}`}>
                                {blockMsg}
                            </p>
                        )}
                    </div>

                    {/* Liste des IPs bloquées */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
                        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                            <Ban className="w-4 h-4 text-red-400" />
                            IPs bloquées ({summary?.totalBlocked ?? 0})
                        </h2>
                        <div className="space-y-2">
                            {(summary?.blockedIps || []).map(block => (
                                <div key={block.id} className="flex items-center justify-between bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <code className="text-red-400 font-mono font-bold">{block.ip}</code>
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${block.blocked_by === 'auto' ? 'text-blue-400 bg-blue-500/10 border-blue-500/30' : 'text-orange-400 bg-orange-500/10 border-orange-500/30'}`}>
                                                {block.blocked_by === 'auto' ? 'Auto' : 'Manuel'}
                                            </span>
                                            <span className="text-xs text-gray-500">{block.violation_count} violation(s)</span>
                                        </div>
                                        <p className="text-gray-400 text-xs">{block.reason}</p>
                                        <p className="text-gray-500 text-xs">
                                            <Clock className="w-3 h-3 inline mr-1" />
                                            {new Date(block.blocked_at).toLocaleString('fr-FR')}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => unblockIp(block.ip)}
                                        className="flex items-center gap-1 text-green-400 hover:text-green-300 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Débloquer
                                    </button>
                                </div>
                            ))}
                            {(summary?.blockedIps || []).length === 0 && (
                                <p className="text-gray-500 text-sm py-4 text-center">Aucune IP bloquée actuellement</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Composant LogRow ──────────────────────────────────────────
function LogRow({ log, detailed = false }: { log: WafLog; detailed?: boolean }) {
    return (
        <div className="flex items-start gap-3 bg-gray-900/40 rounded-lg px-3 py-2 text-xs">
            <span className={`px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${THREAT_COLORS[log.threat_type] || 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>
                {THREAT_LABELS[log.threat_type] || log.threat_type}
            </span>
            <code className="text-amber-400 font-mono whitespace-nowrap">{log.ip}</code>
            <span className="text-gray-400 truncate flex-1">{log.path}</span>
            {detailed && log.threat_detail && (
                <span className="text-gray-500 truncate max-w-48 hidden lg:block">{log.threat_detail}</span>
            )}
            <span className="text-gray-600 whitespace-nowrap">
                {new Date(log.created_at).toLocaleTimeString('fr-FR')}
            </span>
        </div>
    )
}
