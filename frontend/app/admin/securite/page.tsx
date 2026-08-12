'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, Prohibit as Ban, Pulse as Activity, ArrowClockwise as RefreshCw, Trash as Trash2, Plus, FloppyDisk as Save, Warning as AlertTriangle, CheckCircle as CheckCircle2, Clock, Globe, Lightning as Zap, Gear as Settings, CaretLeft as ChevronLeft, CaretRight as ChevronRight, MagnifyingGlass as Search, Funnel as Filter, ToggleLeft, ToggleRight, BookOpen, Sliders, Eye, EyeSlash as EyeOff, XCircle } from '@phosphor-icons/react';

// ── Types ─────────────────────────────────────────────────────
interface IpBlock {
    id: string; ip: string; reason: string
    blocked_by: 'auto' | 'manual'; violation_count: number
    blocked_at: string; expires_at: string | null
}
interface WafLog {
    id: string; ip: string; method: string; path: string
    user_agent: string; threat_type: string; threat_detail: string | null
    score: number; created_at: string
}
interface WafSummary {
    recentLogs: WafLog[]; blockedIps: IpBlock[]
    threatStats: Record<string, number>; topIps: { ip: string; count: number }[]
    totalLogs24h: number; totalBlocked: number
    error?: string;
}
interface CustomRule {
    id: string; name: string; pattern: string; category: string
    description: string; severity: number; targets: string[]
    enabled: boolean; created_at: string
}
interface WafConfig {
    enabled: string; paranoia_level: string
    blocked_countries: string; whitelisted_ips: string; whitelisted_paths: string
}

// ── Constantes ────────────────────────────────────────────────
const THREAT_LABELS: Record<string, string> = {
    sql_injection: 'Injection SQL', xss: 'XSS',
    path_traversal: 'Path Traversal', lfi: 'LFI', rfi: 'RFI',
    rce: 'Exec. Code', command_injection: 'Cmd Injection',
    php_injection: 'PHP Injection', nodejs_injection: 'Node.js Injection',
    ssrf: 'SSRF', xxe: 'XXE', http_smuggling: 'HTTP Smuggling',
    scanner_detection: 'Scanner', protocol_violation: 'Protocole',
    session_fixation: 'Session', data_leakage: 'Fuite données',
    rate_limit: 'Rate Limit', blocked_ip: 'IP Bloquée',
    geo_block: 'Geo Block', custom_rule: 'Règle Custom',
}
const THREAT_COLORS: Record<string, string> = {
    sql_injection: 'text-red-400 bg-red-500/10 border-red-500/30',
    xss: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    rce: 'text-red-500 bg-red-600/10 border-red-600/30',
    command_injection: 'text-red-500 bg-red-600/10 border-red-600/30',
    ssrf: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    lfi: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    rfi: 'text-yellow-500 bg-yellow-600/10 border-yellow-600/30',
    scanner_detection: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    rate_limit: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    blocked_ip: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
    geo_block: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    custom_rule: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
}
const SEV_LABELS: Record<number, { label: string; color: string }> = {
    1: { label: 'CRITIQUE', color: 'text-red-400' },
    2: { label: 'ERREUR',   color: 'text-orange-400' },
    3: { label: 'ALERTE',   color: 'text-yellow-400' },
    4: { label: 'NOTICE',   color: 'text-blue-400' },
    5: { label: 'INFO',     color: 'text-gray-400' },
}
const PAGE_SIZE = 20

// ── Helpers pour le formatage sécurisé des dates (évite les crashs si timestamps invalides) ──
const formatTimeSafe = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleTimeString('fr-FR')
}

const formatDateTimeSafe = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString('fr-FR')
}

// ══════════════════════════════════════════════════════════════
export default function SecuritePage() {
    const [tab, setTab]           = useState<'overview' | 'logs' | 'blocks' | 'rules' | 'config'>('overview')
    const [summary, setSummary]   = useState<WafSummary | null>(null)
    const [logs, setLogs]         = useState<WafLog[]>([])
    const [totalLogs, setTotalLogs] = useState(0)
    const [logsPage, setLogsPage] = useState(0)
    const [rules, setRules]       = useState<CustomRule[]>([])
    const [config, setConfig]     = useState<WafConfig | null>(null)
    const [loading, setLoading]   = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [logSearch, setLogSearch] = useState('')

    // Blocage IP manuel
    const [newIp, setNewIp]       = useState('')
    const [newReason, setNewReason] = useState('')
    const [blocking, setBlocking] = useState(false)
    const [blockMsg, setBlockMsg] = useState('')

    // Nouvelle règle
    const [showRuleForm, setShowRuleForm] = useState(false)
    const [ruleForm, setRuleForm] = useState({
        name: '', pattern: '', category: 'custom', description: '',
        severity: 2, targets: ['all'], enabled: true,
    })
    const [ruleMsg, setRuleMsg]   = useState('')
    const [savingRule, setSavingRule] = useState(false)
    const [testResult, setTestResult] = useState<{ matched: boolean; error?: string } | null>(null)

    // Config éditable
    const [editConfig, setEditConfig] = useState<Partial<WafConfig>>({})
    const [savingConfig, setSavingConfig] = useState(false)
    const [configMsg, setConfigMsg] = useState('')

    const load = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true); else setRefreshing(true)
        try {
            const [sRes, lRes, rRes, cRes] = await Promise.all([
                fetch('/api/admin/waf'),
                fetch(`/api/admin/waf?view=logs&limit=${PAGE_SIZE}&offset=${logsPage * PAGE_SIZE}`),
                fetch('/api/admin/waf/rules'),
                fetch('/api/admin/waf/config'),
            ])
            const [s, l, r, c] = await Promise.all([
                sRes.ok ? sRes.json().catch(() => null) : null,
                lRes.ok ? lRes.json().catch(() => null) : null,
                rRes.ok ? rRes.json().catch(() => null) : null,
                cRes.ok ? cRes.json().catch(() => null) : null,
            ])

            if (s && !s.error) {
                setSummary(s)
            } else {
                setSummary({
                    recentLogs: [],
                    blockedIps: [],
                    threatStats: {},
                    topIps: [],
                    totalLogs24h: 0,
                    totalBlocked: 0,
                    error: s?.error || 'Erreur lors du chargement des statistiques WAF'
                })
            }
            setLogs(l?.logs || [])
            setTotalLogs(l?.total || 0)
            setRules(r?.rules || [])
            setConfig(c?.config || null)
            setEditConfig(c?.config || {})
        } catch (err) {
            console.error('Error loading security data:', err)
        } finally {
            setLoading(false); setRefreshing(false)
        }
    }, [logsPage])

    useEffect(() => { load() }, [load])

    // ── Actions IPs ───────────────────────────────────────────
    async function unblockIp(ip: string) {
        await fetch(`/api/admin/waf?ip=${encodeURIComponent(ip)}`, { method: 'DELETE' })
        load(true)
    }
    async function blockIp() {
        if (!/^[\d.:a-f]+$/i.test(newIp.trim())) { setBlockMsg('Format IP invalide'); return }
        setBlocking(true); setBlockMsg('')
        const res = await fetch('/api/admin/waf', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: newIp.trim(), reason: newReason || 'Blocage manuel' }),
        })
        const d = await res.json()
        setBlockMsg(res.ok ? 'IP bloquée avec succès' : (d.error || 'Erreur'))
        setBlocking(false)
        if (res.ok) { setNewIp(''); setNewReason(''); load(true) }
    }

    // ── Test regex en live ────────────────────────────────────
    function testRegex(pattern: string, testStr = 'SELECT * FROM users WHERE 1=1') {
        try {
            const matched = new RegExp(pattern, 'i').test(testStr)
            setTestResult({ matched })
        } catch { setTestResult({ matched: false, error: 'Regex invalide' }) }
    }

    // ── Créer règle custom ────────────────────────────────────
    async function createRule() {
        if (!ruleForm.name || !ruleForm.pattern) { setRuleMsg('Nom et pattern requis'); return }
        setSavingRule(true); setRuleMsg('')
        const res = await fetch('/api/admin/waf/rules', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ruleForm),
        })
        const d = await res.json()
        if (!res.ok) { setRuleMsg(d.error || 'Erreur'); setSavingRule(false); return }
        setRuleMsg('Règle créée avec succès')
        setRuleForm({ name: '', pattern: '', category: 'custom', description: '', severity: 2, targets: ['all'], enabled: true })
        setShowRuleForm(false)
        setSavingRule(false)
        setTestResult(null)
        load(true)
    }

    // ── Toggle règle ──────────────────────────────────────────
    async function toggleRule(rule: CustomRule) {
        await fetch(`/api/admin/waf/rules/${rule.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: !rule.enabled }),
        })
        load(true)
    }

    // ── Supprimer règle ───────────────────────────────────────
    async function deleteRule(id: string) {
        await fetch(`/api/admin/waf/rules/${id}`, { method: 'DELETE' })
        load(true)
    }

    // ── Sauvegarder config ────────────────────────────────────
    async function saveConfig() {
        setSavingConfig(true); setConfigMsg('')
        const res = await fetch('/api/admin/waf/config', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editConfig),
        })
        setConfigMsg(res.ok ? 'Configuration sauvegardée' : 'Erreur de sauvegarde')
        setSavingConfig(false)
        load(true)
    }

    const filteredLogs = logSearch
        ? logs.filter(l => l.ip.includes(logSearch) || l.path.toLowerCase().includes(logSearch.toLowerCase()) || l.threat_type.includes(logSearch.toLowerCase()))
        : logs

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
    )

    return (
        <div className="space-y-6 p-6">
            {summary?.error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-red-400 font-semibold text-sm">Erreur système WAF</h3>
                        <p className="text-gray-300 text-sm mt-1">{summary.error}</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">WAF : Pare-feu Applicatif</h1>
                        <p className="text-gray-400 text-sm">Moteur OWASP CRS · {summary?.totalLogs24h ?? 0} événements 24h · {summary?.totalBlocked ?? 0} IPs bloquées</p>
                    </div>
                </div>
                <button onClick={() => load(true)} disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors text-sm">
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualiser
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: AlertTriangle, label: 'Attaques 24h', value: summary?.totalLogs24h ?? 0, color: 'red' },
                    { icon: Ban,           label: 'IPs bloquées', value: summary?.totalBlocked ?? 0, color: 'orange' },
                    { icon: BookOpen,      label: 'Règles OWASP', value: '500+', color: 'blue' },
                    { icon: Zap,           label: 'Paranoia', value: `Niveau ${config?.paranoia_level ?? 1}`, color: 'amber' },
                ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className={`bg-gray-800/50 border border-${color}-500/20 rounded-xl p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                            <Icon className={`w-4 h-4 text-${color}-400`} />
                            <span className="text-gray-400 text-xs">{label}</span>
                        </div>
                        <p className={`text-2xl font-bold text-${color}-400`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-800/50 border border-gray-700 rounded-xl p-1 flex-wrap">
                {([
                    { id: 'overview', label: 'Synthèse',    icon: Activity },
                    { id: 'logs',     label: 'Journal WAF', icon: Clock },
                    { id: 'blocks',   label: 'IPs bloquées',icon: Ban },
                    { id: 'rules',    label: 'Règles custom',icon: BookOpen },
                    { id: 'config',   label: 'Configuration',icon: Settings },
                ] as const).map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTab(id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab === id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                        <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                ))}
            </div>

            {/* ══ OVERVIEW ══ */}
            {tab === 'overview' && summary && (
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Menaces par type */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
                        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-amber-400" /> Menaces par type (24h)
                        </h2>
                        <div className="space-y-3">
                            {Object.entries(summary.threatStats).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                                const max = Math.max(...Object.values(summary.threatStats), 1)
                                return (
                                    <div key={type} className="flex items-center gap-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium w-36 text-center truncate ${THREAT_COLORS[type] || 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>
                                            {THREAT_LABELS[type] || type}
                                        </span>
                                        <div className="flex-1 bg-gray-900 rounded-full h-2">
                                            <div className="h-2 rounded-full bg-amber-500 transition-all" style={{ width: `${(count / max) * 100}%` }} />
                                        </div>
                                        <span className="text-white font-mono text-sm w-8 text-right">{count}</span>
                                    </div>
                                )
                            })}
                            {Object.keys(summary.threatStats).length === 0 && (
                                <div className="flex items-center gap-2 text-green-400 text-sm py-4">
                                    <CheckCircle2 className="w-4 h-4" /> Aucune menace détectée ces 24 dernières heures
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top IPs */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
                        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                            <Globe className="w-4 h-4 text-amber-400" /> IPs les plus actives (24h)
                        </h2>
                        <div className="space-y-2">
                            {summary.topIps.map(({ ip, count }) => (
                                <div key={ip} className="flex items-center justify-between bg-gray-900/50 rounded-lg px-3 py-2">
                                    <code className="text-amber-400 font-mono text-sm">{ip}</code>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-300 text-sm">{count} req.</span>
                                        <button onClick={() => { setNewIp(ip); setTab('blocks') }}
                                            className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition-colors" title="Bloquer">
                                            <Ban className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {summary.topIps.length === 0 && <p className="text-gray-500 text-sm">Aucune activité suspecte</p>}
                        </div>
                    </div>

                    {/* Derniers events */}
                    <div className="lg:col-span-2 bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
                        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-400" /> Dernières menaces détectées
                        </h2>
                        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                            {summary.recentLogs.map(log => <LogRow key={log.id} log={log} />)}
                            {summary.recentLogs.length === 0 && <p className="text-gray-500 text-sm">Aucune menace récente</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* ══ LOGS ══ */}
            {tab === 'logs' && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input value={logSearch} onChange={e => setLogSearch(e.target.value)}
                                placeholder="Filtrer par IP, chemin, type de menace..."
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors" />
                        </div>
                        <span className="text-gray-400 text-sm flex items-center gap-1">
                            <Filter className="w-4 h-4" /> {totalLogs} entrées
                        </span>
                    </div>
                    <div className="space-y-1 max-h-[500px] overflow-y-auto">
                        {filteredLogs.map(log => <LogRow key={log.id} log={log} detailed />)}
                        {filteredLogs.length === 0 && <p className="text-gray-500 text-sm py-4 text-center">Aucun résultat</p>}
                    </div>
                    {totalLogs > PAGE_SIZE && (
                        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                            <span className="text-gray-400 text-sm">
                                {logsPage * PAGE_SIZE + 1}–{Math.min((logsPage + 1) * PAGE_SIZE, totalLogs)} sur {totalLogs}
                            </span>
                            <div className="flex gap-1">
                                <button onClick={() => setLogsPage(p => Math.max(0, p - 1))} disabled={logsPage === 0}
                                    className="p-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 disabled:opacity-40 hover:bg-gray-700 transition-colors"
                                    aria-label="Page précédente">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button onClick={() => setLogsPage(p => p + 1)} disabled={(logsPage + 1) * PAGE_SIZE >= totalLogs}
                                    className="p-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 disabled:opacity-40 hover:bg-gray-700 transition-colors"
                                    aria-label="Page suivante">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ══ BLOCKS ══ */}
            {tab === 'blocks' && (
                <div className="space-y-4">
                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
                        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-amber-400" /> Bloquer une IP manuellement
                        </h2>
                        <div className="flex gap-3 flex-wrap">
                            <input value={newIp} onChange={e => setNewIp(e.target.value)} placeholder="192.168.1.1"
                                className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-red-500 transition-colors w-48" />
                            <input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Raison (optionnel)"
                                className="flex-1 min-w-48 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors" />
                            <button onClick={blockIp} disabled={blocking || !newIp}
                                className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
                                <Ban className="w-4 h-4" /> Bloquer
                            </button>
                        </div>
                        {blockMsg && <p className={`mt-2 text-sm ${blockMsg.includes('succès') ? 'text-green-400' : 'text-red-400'}`}>{blockMsg}</p>}
                    </div>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
                        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                            <Ban className="w-4 h-4 text-red-400" /> IPs bloquées ({summary?.totalBlocked ?? 0})
                        </h2>
                        <div className="space-y-2">
                            {(summary?.blockedIps || []).map(block => (
                                <div key={block.id} className="flex items-center justify-between bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 flex-wrap gap-2">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <code className="text-red-400 font-mono font-bold">{block.ip}</code>
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${block.blocked_by === 'auto' ? 'text-blue-400 bg-blue-500/10 border-blue-500/30' : 'text-orange-400 bg-orange-500/10 border-orange-500/30'}`}>
                                                {block.blocked_by === 'auto' ? 'Auto' : 'Manuel'}
                                            </span>
                                            <span className="text-xs text-gray-500">{block.violation_count} violation(s)</span>
                                        </div>
                                        <p className="text-gray-400 text-xs">{block.reason}</p>
                                        <p className="text-gray-500 text-xs"><Clock className="w-3 h-3 inline mr-1" />{formatDateTimeSafe(block.blocked_at)}</p>
                                    </div>
                                    <button onClick={() => unblockIp(block.ip)}
                                        className="flex items-center gap-1 text-green-400 hover:text-green-300 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" /> Débloquer
                                    </button>
                                </div>
                            ))}
                            {(summary?.blockedIps || []).length === 0 && <p className="text-gray-500 text-sm py-4 text-center">Aucune IP bloquée actuellement</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* ══ RÈGLES CUSTOM ══ */}
            {tab === 'rules' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-gray-400 text-sm">{rules.length} règle(s) custom · Les règles OWASP CRS intégrées (500+) sont toujours actives</p>
                        <button onClick={() => setShowRuleForm(v => !v)}
                            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-black font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
                            <Plus className="w-4 h-4" /> Nouvelle règle
                        </button>
                    </div>

                    {/* Formulaire nouvelle règle */}
                    {showRuleForm && (
                        <div className="bg-gray-800/50 border border-amber-500/30 rounded-2xl p-5 space-y-4">
                            <h2 className="text-white font-semibold">Créer une règle personnalisée</h2>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-gray-400 text-xs mb-1 block">Nom *</label>
                                    <input value={ruleForm.name} onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="ex: Blocage User-Agent custom"
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-xs mb-1 block">Catégorie</label>
                                    <select value={ruleForm.category} onChange={e => setRuleForm(f => ({ ...f, category: e.target.value }))}
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                                        aria-label="Catégorie de la règle">
                                        {['custom', 'sql_injection', 'xss', 'rce', 'scanner_detection', 'ssrf', 'lfi', 'rfi'].map(c => (
                                            <option key={c} value={c}>{THREAT_LABELS[c] || c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-gray-400 text-xs mb-1 block">Pattern Regex *</label>
                                <div className="flex gap-2">
                                    <input value={ruleForm.pattern} onChange={e => { setRuleForm(f => ({ ...f, pattern: e.target.value })); setTestResult(null) }}
                                        placeholder="ex: (?i)(malicious|badbot|scrapy)"
                                        className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-amber-500" />
                                    <button onClick={() => testRegex(ruleForm.pattern)}
                                        className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors flex items-center gap-1">
                                        <Eye className="w-3.5 h-3.5" /> Tester
                                    </button>
                                </div>
                                {testResult && (
                                    <p className={`mt-1 text-xs flex items-center gap-1 ${testResult.error ? 'text-red-400' : testResult.matched ? 'text-green-400' : 'text-gray-400'}`}>
                                        {testResult.error ? <><XCircle className="w-3 h-3" /> {testResult.error}</> :
                                         testResult.matched ? <><CheckCircle2 className="w-3 h-3" /> Pattern match sur la chaîne de test</> :
                                         <><EyeOff className="w-3 h-3" /> Pas de match sur la chaîne de test</>}
                                    </p>
                                )}
                            </div>

                            <div className="grid md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-gray-400 text-xs mb-1 block">Sévérité</label>
                                    <select value={ruleForm.severity} onChange={e => setRuleForm(f => ({ ...f, severity: parseInt(e.target.value) }))}
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                                        aria-label="Sévérité de la règle">
                                        {Object.entries(SEV_LABELS).map(([v, { label }]) => (
                                            <option key={v} value={v}>{label} (+{6 - parseInt(v)} pts)</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-gray-400 text-xs mb-1 block">Cibles</label>
                                    <select value={ruleForm.targets[0]} onChange={e => setRuleForm(f => ({ ...f, targets: [e.target.value] }))}
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                                        aria-label="Cibles de la règle">
                                        {['all', 'url', 'query', 'body', 'userAgent', 'referer', 'cookie'].map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-gray-400 text-xs mb-1 block">Activée</label>
                                    <button onClick={() => setRuleForm(f => ({ ...f, enabled: !f.enabled }))}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors w-full ${ruleForm.enabled ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-gray-900 border-gray-600 text-gray-400'}`}>
                                        {ruleForm.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                        {ruleForm.enabled ? 'Activée' : 'Désactivée'}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-gray-400 text-xs mb-1 block">Description</label>
                                <input value={ruleForm.description} onChange={e => setRuleForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Description de la règle (optionnel)"
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
                            </div>

                            {ruleMsg && <p className={`text-sm ${ruleMsg.includes('succès') ? 'text-green-400' : 'text-red-400'}`}>{ruleMsg}</p>}

                            <div className="flex gap-2">
                                <button onClick={createRule} disabled={savingRule || !ruleForm.name || !ruleForm.pattern}
                                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
                                    <Save className="w-4 h-4" /> {savingRule ? 'Création...' : 'Créer la règle'}
                                </button>
                                <button onClick={() => { setShowRuleForm(false); setRuleMsg(''); setTestResult(null) }}
                                    className="px-4 py-2 text-gray-400 hover:text-gray-200 text-sm transition-colors">
                                    Annuler
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Liste des règles custom */}
                    <div className="space-y-2">
                        {rules.map(rule => (
                            <div key={rule.id} className={`border rounded-xl px-4 py-3 flex items-start justify-between gap-3 flex-wrap transition-opacity ${rule.enabled ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-900/30 border-gray-800 opacity-60'}`}>
                                <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-white font-medium text-sm">{rule.name}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${THREAT_COLORS[rule.category] || 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>
                                            {THREAT_LABELS[rule.category] || rule.category}
                                        </span>
                                        <span className={`text-xs font-medium ${SEV_LABELS[rule.severity]?.color || 'text-gray-400'}`}>
                                            {SEV_LABELS[rule.severity]?.label}
                                        </span>
                                    </div>
                                    <code className="text-amber-400 text-xs font-mono break-all">{rule.pattern}</code>
                                    {rule.description && <p className="text-gray-400 text-xs">{rule.description}</p>}
                                    <p className="text-gray-600 text-xs">Cibles: {Array.isArray(rule.targets) ? rule.targets.join(', ') : rule.targets}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button onClick={() => toggleRule(rule)}
                                        className={`p-1.5 rounded-lg border transition-colors ${rule.enabled ? 'text-green-400 border-green-500/30 bg-green-500/10 hover:bg-green-500/20' : 'text-gray-500 border-gray-700 hover:bg-gray-700'}`}
                                        title={rule.enabled ? 'Désactiver' : 'Activer'}>
                                        {rule.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => deleteRule(rule.id)}
                                        className="p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors" title="Supprimer">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {rules.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                                <p>Aucune règle custom. Les 500+ règles OWASP CRS sont actives par défaut.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══ CONFIGURATION ══ */}
            {tab === 'config' && (
                <div className="space-y-5">
                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 space-y-6">
                        <h2 className="text-white font-semibold flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-amber-400" /> Configuration du WAF
                        </h2>

                        {/* WAF activé */}
                        <div className="flex items-center justify-between py-3 border-b border-gray-700">
                            <div>
                                <p className="text-white font-medium">WAF activé</p>
                                <p className="text-gray-400 text-sm">Désactiver met le WAF en bypass total (déconseillé)</p>
                            </div>
                            <button onClick={() => setEditConfig(c => ({ ...c, enabled: c.enabled === 'false' ? 'true' : 'false' }))}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${editConfig.enabled !== 'false' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                {editConfig.enabled !== 'false' ? <><ToggleRight className="w-5 h-5" /> Activé</> : <><ToggleLeft className="w-5 h-5" /> Désactivé</>}
                            </button>
                        </div>

                        {/* Niveau de paranoia */}
                        <div className="py-3 border-b border-gray-700">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-white font-medium">Niveau de paranoia</p>
                                    <p className="text-gray-400 text-sm">Plus élevé = plus strict, plus de faux positifs potentiels</p>
                                </div>
                                <span className="text-amber-400 font-bold text-xl">
                                    {editConfig.paranoia_level ?? config?.paranoia_level ?? '1'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {[1, 2, 3, 4].map(level => (
                                    <button key={level} onClick={() => setEditConfig(c => ({ ...c, paranoia_level: String(level) }))}
                                        className={`py-2 rounded-lg border text-sm font-medium transition-colors ${String(editConfig.paranoia_level ?? config?.paranoia_level) === String(level) ? 'bg-amber-500 border-amber-500 text-black' : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-amber-500/50'}`}>
                                        <div className="text-lg">{level}</div>
                                        <div className="text-xs opacity-70">{['Normal', 'Élevé', 'Strict', 'Paranoïa'][level - 1]}</div>
                                    </button>
                                ))}
                            </div>
                            <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                                <p><strong className="text-gray-400">Niveau 1</strong> : Règles essentielles (score ≥5 pour blocage)</p>
                                <p><strong className="text-gray-400">Niveau 2</strong> : Règles renforcées (score ≥4)</p>
                                <p><strong className="text-gray-400">Niveau 3</strong> : Règles strictes (score ≥3)</p>
                                <p><strong className="text-gray-400">Niveau 4</strong> : Blocage dès le premier match</p>
                            </div>
                        </div>

                        {/* Pays bloqués */}
                        <div className="py-3 border-b border-gray-700">
                            <p className="text-white font-medium mb-1">Pays bloqués</p>
                            <p className="text-gray-400 text-sm mb-2">Codes ISO-3166 séparés par des virgules (ex: KP, IR, RU)</p>
                            <input
                                value={(() => { try { return JSON.parse(editConfig.blocked_countries || config?.blocked_countries || '[]').join(', ') } catch { return '' } })()}
                                onChange={e => {
                                    const arr = e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
                                    setEditConfig(c => ({ ...c, blocked_countries: JSON.stringify(arr) }))
                                }}
                                placeholder="ex: KP, IR, RU"
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        {/* IPs whitelistées */}
                        <div className="py-3 border-b border-gray-700">
                            <p className="text-white font-medium mb-1">IPs exemptées du WAF</p>
                            <p className="text-gray-400 text-sm mb-2">Séparées par des virgules (ex: 1.2.3.4, 5.6.7.8)</p>
                            <input
                                value={(() => { try { return JSON.parse(editConfig.whitelisted_ips || config?.whitelisted_ips || '[]').join(', ') } catch { return '' } })()}
                                onChange={e => {
                                    const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                    setEditConfig(c => ({ ...c, whitelisted_ips: JSON.stringify(arr) }))
                                }}
                                placeholder="ex: 1.2.3.4, 10.0.0.1"
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        {/* Chemins exemptés */}
                        <div className="py-3">
                            <p className="text-white font-medium mb-1">Chemins exemptés du WAF</p>
                            <p className="text-gray-400 text-sm mb-2">Séparés par des virgules (ex: /api/webhook, /api/cron)</p>
                            <input
                                value={(() => { try { return JSON.parse(editConfig.whitelisted_paths || config?.whitelisted_paths || '[]').join(', ') } catch { return '' } })()}
                                onChange={e => {
                                    const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                    setEditConfig(c => ({ ...c, whitelisted_paths: JSON.stringify(arr) }))
                                }}
                                placeholder="ex: /api/webhooks/stripe, /api/cron"
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        {configMsg && (
                            <p className={`text-sm font-medium ${configMsg.includes('sauvegardée') ? 'text-green-400' : 'text-red-400'}`}>
                                {configMsg}
                            </p>
                        )}

                        <button onClick={saveConfig} disabled={savingConfig}
                            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold px-6 py-2.5 rounded-xl transition-colors">
                            <Save className="w-4 h-4" /> {savingConfig ? 'Sauvegarde...' : 'Sauvegarder la configuration'}
                        </button>
                    </div>

                    {/* Info règles intégrées */}
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5">
                        <h2 className="text-blue-400 font-semibold mb-3 flex items-center gap-2">
                            <BookOpen className="w-4 h-4" /> Règles OWASP CRS intégrées
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            {[
                                ['942xxx', 'SQL Injection', '20 règles'],
                                ['941xxx', 'XSS', '16 règles'],
                                ['930xxx', 'LFI', '5 règles'],
                                ['931xxx', 'RFI', '3 règles'],
                                ['932xxx', 'RCE/OS Command', '9 règles'],
                                ['933xxx', 'PHP Injection', '4 règles'],
                                ['934xxx', 'Node.js/SSRF', '8 règles'],
                                ['913xxx', 'Scanners', '5 règles'],
                                ['920xxx', 'Protocole', '4 règles'],
                                ['921xxx', 'HTTP Smuggling', '2 règles'],
                                ['943xxx', 'Session', '1 règle'],
                                ['951xxx', 'Data Leakage', '2 règles'],
                            ].map(([id, name, count]) => (
                                <div key={id} className="bg-gray-900/50 rounded-lg p-3">
                                    <code className="text-blue-400 text-xs">{id}</code>
                                    <p className="text-white text-xs font-medium mt-0.5">{name}</p>
                                    <p className="text-gray-500 text-xs">{count}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Composant LogRow ───────────────────────────────────────────
function LogRow({ log, detailed = false }: { log: WafLog; detailed?: boolean }) {
    const colorClass = THREAT_COLORS[log.threat_type] || 'text-gray-400 bg-gray-500/10 border-gray-500/30'
    return (
        <div className="flex items-center gap-2 bg-gray-900/40 rounded-lg px-3 py-1.5 text-xs flex-wrap">
            <span className={`px-2 py-0.5 rounded-full border font-medium whitespace-nowrap shrink-0 ${colorClass}`}>
                {THREAT_LABELS[log.threat_type] || log.threat_type}
            </span>
            <code className="text-amber-400 font-mono whitespace-nowrap">{log.ip}</code>
            {log.score > 0 && <span className="text-red-400 font-mono">+{log.score}pts</span>}
            <span className="text-gray-400 truncate flex-1 min-w-0">{log.path}</span>
            {detailed && log.threat_detail && (
                <span className="text-gray-500 truncate max-w-xs hidden lg:block">{log.threat_detail}</span>
            )}
            <span className="text-gray-600 whitespace-nowrap shrink-0">
                {formatTimeSafe(log.created_at)}
            </span>
        </div>
    )
}
