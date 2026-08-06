'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { visibleInterval } from '@/lib/visible-interval'
import { Pulse as Activity, Globe, Monitor, DeviceMobile as Smartphone, DeviceTablet as Tablet, TrendUp as TrendingUp, Users, Eye, MapPin, Clock, WifiHigh as Wifi, ArrowClockwise as RefreshCw, CaretRight as ChevronRight, ChartBar as BarChart2, GoogleChromeLogo as Chrome, WarningCircle as AlertCircle, Lightning as Zap, Radio, Cursor as MousePointer2, Heart, ShieldWarning as ShieldAlert, TreeStructure as Network, Translate as Languages, Gauge, Repeat as Repeat2, ArrowLineDown as ArrowDownToLine, type Icon as LucideIcon } from '@phosphor-icons/react';

// ── World Map (CSR only — react-simple-maps requiert le DOM) ─
const WorldMapDynamic = dynamic(() => import('./WorldMap'), { ssr: false, loading: () => (
    <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-600">
            <Globe size={32} className="animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest">Chargement carte...</span>
        </div>
    </div>
)})

// ── Types ────────────────────────────────────────────────────
interface VisitorSession {
    id: string
    session_id: string
    ip: string
    country: string
    country_code: string
    city: string
    region: string
    latitude: number
    longitude: number
    device_type: 'mobile' | 'tablet' | 'desktop'
    browser: string
    browser_version: string
    os: string
    page: string
    referrer: string
    utm_source: string
    created_at: string
    last_seen_at: string
}

interface LiveData {
    live: VisitorSession[]
    stats: {
        active_now: number
        unique_visitors_24h: number
        page_views_24h: number
        countries_24h: number
    }
    top_pages: { page: string; count: number }[]
    top_countries: { country: string; count: number; code: string }[]
    country_points: { country: string; count: number; code: string; lat: number; lon: number }[]
    device_stats: Record<string, number>
    browser_stats: Record<string, number>
    hourly_chart: { hour: string; count: number }[]
    // Métriques enrichies
    top_isp: { isp: string; count: number }[]
    top_languages: { language: string; count: number }[]
    connection_stats: Record<string, number>
    top_screens: { resolution: string; count: number }[]
    returning_stats: { returning: number; new_visitors: number }
    security_stats: { vpn: number; proxy: number; tor: number }
    avg_scroll_depth: number
    avg_page_load_ms: number
}

// ── Helpers ──────────────────────────────────────────────────
const COUNTRY_FLAGS: Record<string, string> = {
    BJ: '🇧🇯', FR: '🇫🇷', SN: '🇸🇳', CI: '🇨🇮', TG: '🇹🇬', BF: '🇧🇫',
    ML: '🇲🇱', GH: '🇬🇭', NG: '🇳🇬', CM: '🇨🇲', US: '🇺🇸', CA: '🇨🇦',
    BE: '🇧🇪', CH: '🇨🇭', DE: '🇩🇪', GB: '🇬🇧', IT: '🇮🇹', ES: '🇪🇸',
    PT: '🇵🇹', NL: '🇳🇱', MA: '🇲🇦', DZ: '🇩🇿', TN: '🇹🇳', CM2: '🇨🇲',
    CD: '🇨🇩', GA: '🇬🇦', MR: '🇲🇷', NE: '🇳🇪', XX: '🌍',
}
const getFlag = (code: string) => COUNTRY_FLAGS[code] || ''

const DEVICE_ICONS = { mobile: Smartphone, tablet: Tablet, desktop: Monitor }
const DEVICE_COLORS = { mobile: '#818cf8', tablet: '#34d399', desktop: '#60a5fa' }
const BROWSER_COLORS: Record<string, string> = {
    Chrome: '#FCD116', Firefox: '#f97316', Safari: '#60a5fa',
    Edge: '#6366f1', Opera: '#e11d48', Autre: '#6b7280',
}

function timeAgo(iso: string): string {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (diff < 10) return 'maintenant'
    if (diff < 60) return `il y a ${diff}s`
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`
    return `il y a ${Math.floor(diff / 3600)}h`
}

function formatPage(page: string): string {
    if (page === '/' || page === '') return ' Accueil'
    return page.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── KPI Card ─────────────────────────────────────────────────
function KPICard({ label, value, icon: Icon, color, suffix = '', pulse = false }: {
    label: string; value: number | string; icon: LucideIcon
    color: string; suffix?: string; pulse?: boolean
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 overflow-hidden group hover:border-white/10 transition-all"
        >
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: `radial-gradient(circle at 20% 50%, ${color}08 0%, transparent 70%)` }} />
            <div className="relative flex items-start justify-between">
                <div>
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">{label}</p>
                    <div className="flex items-end gap-1.5">
                        <span className="text-3xl font-black text-white tabular-nums" style={{ color }}>
                            {typeof value === 'number' ? value.toLocaleString() : value}
                        </span>
                        {suffix && <span className="text-xs text-gray-500 mb-1">{suffix}</span>}
                    </div>
                </div>
                <div className="relative">
                    {pulse && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
                    )}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: `${color}15`, border: `1px solid ${color}20` }}>
                        <Icon size={18} style={{ color }} />
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

// ── MiniBar ───────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
    return (
        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.round((value / max) * 100)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
            />
        </div>
    )
}

// ═════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════
export default function AnalyticsLivePage() {
    const [data, setData] = useState<LiveData | null>(null)
    const [loading, setLoading] = useState(true)
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [newVisitorIds, setNewVisitorIds] = useState<Set<string>>(new Set())
    const prevSessionIds = useRef<Set<string>>(new Set())

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/analytics/live')
            if (!res.ok) return
            const json: LiveData = await res.json()

            // Détecter nouveaux visiteurs pour animation flash
            const currentIds = new Set(json.live.map(s => s.session_id))
            const newIds = new Set<string>()
            for (const id of currentIds) {
                if (!prevSessionIds.current.has(id)) newIds.add(id)
            }
            if (newIds.size > 0) {
                setNewVisitorIds(newIds)
                setTimeout(() => setNewVisitorIds(new Set()), 2500)
            }
            prevSessionIds.current = currentIds

            setData(json)
            setLastRefresh(new Date())
        } catch { /* silencieux */ } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Rafraîchit toutes les 120s quand l'auto-refresh est actif, en PAUSE dès que
    // l'onglet passe en arrière-plan (un dashboard laissé ouvert ne consomme plus).
    useEffect(() => {
        if (!autoRefresh) return
        return visibleInterval(fetchData, 120_000, { runImmediately: false })
    }, [autoRefresh, fetchData])

    // Unique sessions actives (dedupliqué par session_id)
    const uniqueLiveSessions = data ? Array.from(
        new Map(data.live.map(s => [s.session_id, s])).values()
    ).slice(0, 50) : []

    const maxHourly = data ? Math.max(...data.hourly_chart.map(h => h.count), 1) : 1
    const maxPage = data ? Math.max(...data.top_pages.map(p => p.count), 1) : 1
    const maxCountry = data ? Math.max(...data.top_countries.map(c => c.count), 1) : 1
    const totalDevices = data ? Object.values(data.device_stats).reduce((a, b) => a + b, 0) || 1 : 1
    const totalBrowsers = data ? Object.values(data.browser_stats).reduce((a, b) => a + b, 0) || 1 : 1
    const totalVisitors = data ? (data.returning_stats?.returning ?? 0) + (data.returning_stats?.new_visitors ?? 0) : 1
    const maxIsp = data ? Math.max(...(data.top_isp?.map(i => i.count) ?? [1]), 1) : 1
    const maxLang = data ? Math.max(...(data.top_languages?.map(l => l.count) ?? [1]), 1) : 1
    const maxConn = data ? Math.max(...Object.values(data.connection_stats ?? {}), 1) : 1
    const maxScreen = data ? Math.max(...(data.top_screens?.map(s => s.count) ?? [1]), 1) : 1

    return (
        <div className="space-y-6">

            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-black text-white tracking-tight">Analytics</h1>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black tracking-[0.2em] uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                            LIVE
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm">
                        Visiteurs en temps réel · Mis à jour {timeAgo(lastRefresh.toISOString())}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setAutoRefresh(a => !a)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                            autoRefresh
                                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                : 'bg-white/5 border-white/10 text-gray-400'
                        }`}
                    >
                        <Radio size={13} className={autoRefresh ? 'animate-pulse' : ''} />
                        Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
                    </button>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white text-xs font-bold transition-all"
                    >
                        <RefreshCw size={13} />
                        Actualiser
                    </button>
                </div>
            </div>

            {/* ── KPI Cards ───────────────────────────────────────── */}
            {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-28 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard label="En ligne maintenant" value={data?.stats.active_now ?? 0} icon={Wifi} color="#22c55e" pulse />
                    <KPICard label="Visiteurs uniques 24h" value={data?.stats.unique_visitors_24h ?? 0} icon={Users} color="#818cf8" />
                    <KPICard label="Pages vues 24h" value={data?.stats.page_views_24h ?? 0} icon={Eye} color="#60a5fa" />
                    <KPICard label="Pays représentés" value={data?.stats.countries_24h ?? 0} icon={Globe} color="#f59e0b" suffix="pays" />
                </div>
            )}

            {/* ── Métriques secondaires ───────────────────────────── */}
            {data && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <KPICard
                        label="Scroll moyen"
                        value={`${data.avg_scroll_depth ?? 0}%`}
                        icon={MousePointer2} color="#a78bfa"
                        suffix="de la page"
                    />
                    <KPICard
                        label="Chargement moyen"
                        value={data.avg_page_load_ms > 0 ? `${(data.avg_page_load_ms / 1000).toFixed(1)}s` : '—'}
                        icon={Gauge} color="#f59e0b"
                    />
                    <KPICard
                        label="Visiteurs fidèles"
                        value={totalVisitors > 0 ? `${Math.round(((data.returning_stats?.returning ?? 0) / totalVisitors) * 100)}%` : '—'}
                        icon={Repeat2} color="#f43f5e"
                    />
                    <KPICard
                        label="VPN / Proxy"
                        value={(data.security_stats?.vpn ?? 0) + (data.security_stats?.proxy ?? 0)}
                        icon={ShieldAlert}
                        color={(data.security_stats?.vpn ?? 0) + (data.security_stats?.proxy ?? 0) > 0 ? '#ef4444' : '#6b7280'}
                    />
                </div>
            )}

            {/* ── Graphique horaire ───────────────────────────────── */}
            {data && data.hourly_chart.length > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-bold text-white flex items-center gap-2">
                            <BarChart2 size={15} className="text-purple-400" />
                            Activité des dernières 24h
                        </p>
                        <span className="text-[10px] text-gray-600 font-mono">{data.stats.page_views_24h} pages vues</span>
                    </div>
                    <div className="flex items-end gap-1 h-20">
                        {data.hourly_chart.map((h, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-[#0a0f18] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap z-10">
                                    {h.hour}: {h.count}
                                </div>
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${h.count === 0 ? 3 : Math.max(12, (h.count / maxHourly) * 100)}%` }}
                                    transition={{ duration: 0.5, delay: i * 0.02 }}
                                    className="w-full rounded-t-sm"
                                    style={{
                                        // Couleurs pleines : les barres translucides étaient
                                        // invisibles en mode clair (30 % d'opacité sur blanc)
                                        background: h.count === 0
                                            ? 'rgba(120, 130, 150, 0.18)'
                                            : h.count === maxHourly
                                                ? 'linear-gradient(to top, #4F46E5, #8B5CF6)'
                                                : '#7C7FF2'
                                    }}
                                />
                                {i % 4 === 0 && (
                                    <span className="text-[9px] text-gray-700 font-mono">{h.hour}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Carte Monde + Flux Live ─────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

                {/* Carte monde */}
                <div className="xl:col-span-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden" style={{ minHeight: 340 }}>
                    <div className="flex items-center justify-between px-5 pt-4 pb-2">
                        <p className="text-sm font-bold text-white flex items-center gap-2">
                            <MapPin size={15} className="text-emerald-400" />
                            Présence mondiale
                        </p>
                        <span className="text-[10px] text-gray-500">
                            {data?.country_points?.length || 0} pays (24h) — {uniqueLiveSessions.length} en ligne
                        </span>
                    </div>
                    <div style={{ height: 300 }}>
                        <WorldMapDynamic sessions={uniqueLiveSessions} countryPoints={data?.country_points || []} />
                    </div>
                </div>

                {/* Flux live */}
                <div className="xl:col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/5 flex-shrink-0">
                        <p className="text-sm font-bold text-white flex items-center gap-2">
                            <Activity size={15} className="text-red-400 animate-pulse" />
                            Flux temps réel
                        </p>
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                            {data?.stats.active_now ?? 0} en ligne
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-premium" style={{ maxHeight: 304 }}>
                        {loading ? (
                            <div className="p-5 space-y-3">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="h-12 bg-white/[0.02] rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : uniqueLiveSessions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-gray-600">
                                <AlertCircle size={28} />
                                <p className="text-sm font-bold">Aucun visiteur actif</p>
                                <p className="text-xs text-gray-700">Les visites apparaîtront ici en temps réel</p>
                            </div>
                        ) : (
                            <AnimatePresence mode="popLayout">
                                {uniqueLiveSessions.map((session) => {
                                    const DevIcon = DEVICE_ICONS[session.device_type] || Monitor
                                    const isNew = newVisitorIds.has(session.session_id)
                                    return (
                                        <motion.div
                                            key={session.session_id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.3 }}
                                            className={`px-4 py-3 border-b border-white/[0.04] last:border-0 transition-all ${
                                                isNew ? 'bg-green-500/5' : 'hover:bg-white/[0.02]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                {/* Flag */}
                                                <span className="text-xl flex-shrink-0 leading-none">
                                                    {getFlag(session.country_code)}
                                                </span>
                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className="text-white text-xs font-bold truncate">
                                                            {session.city || session.country || 'Inconnu'}
                                                        </span>
                                                        {session.city && session.country !== session.city && (
                                                            <span className="text-gray-600 text-[10px] truncate">
                                                                · {session.country}
                                                            </span>
                                                        )}
                                                        {isNew && (
                                                            <span className="flex-shrink-0 text-[9px] font-black text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">NEW</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-gray-600">
                                                        <DevIcon size={10} />
                                                        <span>{session.browser}</span>
                                                        <span>·</span>
                                                        <span className="text-gray-700 truncate max-w-[120px]">
                                                            {formatPage(session.page)}
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Time */}
                                                <div className="text-[10px] text-gray-700 flex-shrink-0 flex items-center gap-1">
                                                    <Clock size={9} />
                                                    {timeAgo(session.last_seen_at)}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Stats détaillées ────────────────────────────────── */}
            {data && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

                    {/* Top Pages */}
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                        <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <TrendingUp size={14} className="text-purple-400" />
                            Top Pages (24h)
                        </p>
                        <div className="space-y-2.5">
                            {data.top_pages.slice(0, 8).map((p, i) => (
                                <div key={p.page} className="flex items-center gap-3 group">
                                    <span className="text-[10px] font-black text-gray-700 w-4">{i + 1}</span>
                                    <span className="flex-1 text-xs text-gray-400 truncate group-hover:text-white transition-colors">
                                        {formatPage(p.page)}
                                    </span>
                                    <MiniBar value={p.count} max={maxPage} color="#818cf8" />
                                    <span className="text-[10px] text-gray-600 font-mono w-8 text-right">{p.count}</span>
                                </div>
                            ))}
                            {data.top_pages.length === 0 && (
                                <p className="text-xs text-gray-700 text-center py-4">Aucune donnée</p>
                            )}
                        </div>
                    </div>

                    {/* Top Pays */}
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                        <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <Globe size={14} className="text-yellow-400" />
                            Top Pays (24h)
                        </p>
                        <div className="space-y-2.5">
                            {data.top_countries.slice(0, 8).map((c, i) => (
                                <div key={c.country} className="flex items-center gap-3 group">
                                    <span className="text-sm leading-none flex-shrink-0">{getFlag(c.code)}</span>
                                    <span className="flex-1 text-xs text-gray-400 truncate group-hover:text-white transition-colors">
                                        {c.country}
                                    </span>
                                    <MiniBar value={c.count} max={maxCountry} color="#f59e0b" />
                                    <span className="text-[10px] text-gray-600 font-mono w-8 text-right">{c.count}</span>
                                </div>
                            ))}
                            {data.top_countries.length === 0 && (
                                <p className="text-xs text-gray-700 text-center py-4">Aucune donnée</p>
                            )}
                        </div>
                    </div>

                    {/* Appareils */}
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                        <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <Smartphone size={14} className="text-indigo-400" />
                            Appareils (24h)
                        </p>
                        <div className="space-y-4">
                            {(['mobile', 'desktop', 'tablet'] as const).map((d) => {
                                const count = data.device_stats[d] || 0
                                const pct = Math.round((count / totalDevices) * 100)
                                const Icon = DEVICE_ICONS[d]
                                return (
                                    <div key={d} className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Icon size={13} style={{ color: DEVICE_COLORS[d] }} />
                                                <span className="text-xs text-gray-400 capitalize">{d}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-white">{count}</span>
                                                <span className="text-[10px] text-gray-600">{pct}%</span>
                                            </div>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${pct}%` }}
                                                transition={{ duration: 0.7, ease: 'easeOut' }}
                                                className="h-full rounded-full"
                                                style={{ backgroundColor: DEVICE_COLORS[d] }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Navigateurs */}
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                        <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <Chrome size={14} className="text-blue-400" />
                            Navigateurs (24h)
                        </p>
                        <div className="space-y-2.5">
                            {Object.entries(data.browser_stats)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 6)
                                .map(([browser, count]) => {
                                    const pct = Math.round((count / totalBrowsers) * 100)
                                    const color = BROWSER_COLORS[browser] || '#6b7280'
                                    return (
                                        <div key={browser} className="flex items-center gap-3 group">
                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                            <span className="flex-1 text-xs text-gray-400 truncate group-hover:text-white transition-colors">
                                                {browser}
                                            </span>
                                            <MiniBar value={count} max={totalBrowsers} color={color} />
                                            <span className="text-[10px] text-gray-600 font-mono w-8 text-right">{pct}%</span>
                                        </div>
                                    )
                                })}
                            {Object.keys(data.browser_stats).length === 0 && (
                                <p className="text-xs text-gray-700 text-center py-4">Aucune donnée</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── FAI, Langues, Connexion, Résolutions ────────────── */}
            {data && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

                    {/* Top FAI / Opérateurs */}
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                        <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <Network size={14} className="text-sky-400" />
                            Opérateurs / FAI (24h)
                        </p>
                        <div className="space-y-2.5">
                            {(data.top_isp ?? []).slice(0, 7).map((item) => (
                                <div key={item.isp} className="flex items-center gap-3 group">
                                    <span className="flex-1 text-xs text-gray-400 truncate group-hover:text-white transition-colors" title={item.isp}>
                                        {item.isp}
                                    </span>
                                    <MiniBar value={item.count} max={maxIsp} color="#38bdf8" />
                                    <span className="text-[10px] text-gray-600 font-mono w-6 text-right">{item.count}</span>
                                </div>
                            ))}
                            {(data.top_isp ?? []).length === 0 && (
                                <p className="text-xs text-gray-700 text-center py-4">—</p>
                            )}
                        </div>
                    </div>

                    {/* Langues navigateur */}
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                        <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <Languages size={14} className="text-emerald-400" />
                            Langues (24h)
                        </p>
                        <div className="space-y-2.5">
                            {(data.top_languages ?? []).slice(0, 7).map((item) => (
                                <div key={item.language} className="flex items-center gap-3 group">
                                    <span className="w-9 text-xs font-bold text-gray-300 flex-shrink-0">{item.language}</span>
                                    <MiniBar value={item.count} max={maxLang} color="#34d399" />
                                    <span className="text-[10px] text-gray-600 font-mono w-6 text-right">{item.count}</span>
                                </div>
                            ))}
                            {(data.top_languages ?? []).length === 0 && (
                                <p className="text-xs text-gray-700 text-center py-4">—</p>
                            )}
                        </div>
                    </div>

                    {/* Type de connexion */}
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                        <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <ArrowDownToLine size={14} className="text-orange-400" />
                            Connexion (24h)
                        </p>
                        <div className="space-y-2.5">
                            {Object.entries(data.connection_stats ?? {})
                                .sort(([, a], [, b]) => b - a)
                                .map(([type, count]) => (
                                    <div key={type} className="flex items-center gap-3 group">
                                        <span className="w-12 text-xs font-bold text-gray-300 uppercase flex-shrink-0">{type}</span>
                                        <MiniBar value={count} max={maxConn} color="#fb923c" />
                                        <span className="text-[10px] text-gray-600 font-mono w-6 text-right">{count}</span>
                                    </div>
                                ))}
                            {Object.keys(data.connection_stats ?? {}).length === 0 && (
                                <p className="text-xs text-gray-700 text-center py-4">—</p>
                            )}
                        </div>
                        {/* Fidélité en bas */}
                        {totalVisitors > 1 && (
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <p className="text-[10px] text-gray-600 mb-2 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <Heart size={10} className="text-rose-400" /> Fidélité
                                </p>
                                <div className="flex gap-2 items-center">
                                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden flex">
                                        <div
                                            className="h-full bg-rose-500 rounded-l-full transition-all"
                                            style={{ width: `${Math.round(((data.returning_stats?.returning ?? 0) / totalVisitors) * 100)}%` }}
                                        />
                                    </div>
                                    <div className="text-[10px] text-gray-500 whitespace-nowrap">
                                        <span className="text-rose-400 font-bold">{data.returning_stats?.returning ?? 0}</span> retour
                                        <span className="text-gray-700 mx-1">·</span>
                                        <span className="text-emerald-400 font-bold">{data.returning_stats?.new_visitors ?? 0}</span> nouveau
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Résolutions écran */}
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                        <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <Monitor size={14} className="text-violet-400" />
                            Résolutions (24h)
                        </p>
                        <div className="space-y-2.5">
                            {(data.top_screens ?? []).slice(0, 6).map((item) => (
                                <div key={item.resolution} className="flex items-center gap-3 group">
                                    <span className="w-24 text-[10px] font-mono text-gray-400 flex-shrink-0 truncate">{item.resolution}</span>
                                    <MiniBar value={item.count} max={maxScreen} color="#a78bfa" />
                                    <span className="text-[10px] text-gray-600 font-mono w-6 text-right">{item.count}</span>
                                </div>
                            ))}
                            {(data.top_screens ?? []).length === 0 && (
                                <p className="text-xs text-gray-700 text-center py-4">—</p>
                            )}
                        </div>
                        {/* Alerte sécurité */}
                        {((data.security_stats?.vpn ?? 0) + (data.security_stats?.proxy ?? 0) + (data.security_stats?.tor ?? 0)) > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <ShieldAlert size={10} /> Accès suspects
                                </p>
                                <div className="flex gap-3 mt-1.5 text-[10px] text-gray-500">
                                    {(data.security_stats?.vpn ?? 0) > 0 && <span><span className="text-red-400 font-bold">{data.security_stats.vpn}</span> VPN</span>}
                                    {(data.security_stats?.proxy ?? 0) > 0 && <span><span className="text-orange-400 font-bold">{data.security_stats.proxy}</span> Proxy</span>}
                                    {(data.security_stats?.tor ?? 0) > 0 && <span><span className="text-purple-400 font-bold">{data.security_stats.tor}</span> Tor</span>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Table détaillée des sessions ───────────────────── */}
            {data && uniqueLiveSessions.length > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                        <p className="text-sm font-bold text-white flex items-center gap-2">
                            <Zap size={14} className="text-yellow-400" />
                            Détail sessions actives
                        </p>
                        <span className="text-[10px] text-gray-600">{uniqueLiveSessions.length} sessions · 30 dernières minutes</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-white/5">
                                    {['Pays', 'Ville', 'Opérateur', 'Page', 'Appareil', 'Navigateur', 'OS', 'Langue', 'Scroll', 'Chgt.', 'Dernière activité'].map(h => (
                                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-600 uppercase tracking-widest whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {uniqueLiveSessions.slice(0, 20).map((s) => {
                                    const DevIcon = DEVICE_ICONS[s.device_type] || Monitor
                                    return (
                                        <tr key={s.session_id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 py-2.5 whitespace-nowrap">
                                                <span className="flex items-center gap-1.5">
                                                    <span>{getFlag(s.country_code)}</span>
                                                    <span className="text-gray-400">{s.country || '—'}</span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap max-w-[120px] truncate"
                                                title={(s as unknown as Record<string, string>).isp || '—'}>
                                                {(s as unknown as Record<string, string>).isp || '—'}
                                            </td>
                                            <td className="px-4 py-2.5 max-w-[130px] truncate">
                                                <a href={s.page} target="_blank" rel="noopener noreferrer"
                                                    className="text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                                    {formatPage(s.page)}
                                                    <ChevronRight size={10} />
                                                </a>
                                            </td>
                                            <td className="px-4 py-2.5 whitespace-nowrap">
                                                <span className="flex items-center gap-1.5 text-gray-400">
                                                    <DevIcon size={11} style={{ color: DEVICE_COLORS[s.device_type] }} />
                                                    {s.device_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">
                                                <span className="flex items-center gap-1">
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BROWSER_COLORS[s.browser] || '#6b7280' }} />
                                                    {s.browser} {s.browser_version}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{s.os || '—'}</td>
                                            <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap font-mono text-[10px]">
                                                {((s as unknown as Record<string, string>).language || '').split('-')[0]?.toUpperCase() || '—'}
                                            </td>
                                            <td className="px-4 py-2.5 whitespace-nowrap">
                                                {((s as unknown as Record<string, number>).scroll_depth ?? 0) > 0 ? (
                                                    <span className="flex items-center gap-1 text-[10px]">
                                                        <span className="text-purple-400 font-bold font-mono">
                                                            {(s as unknown as Record<string, number>).scroll_depth}%
                                                        </span>
                                                        <div className="w-10 h-1 bg-white/10 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-purple-500 rounded-full"
                                                                style={{ width: `${(s as unknown as Record<string, number>).scroll_depth}%` }}
                                                            />
                                                        </div>
                                                    </span>
                                                ) : <span className="text-gray-700 text-[10px]">—</span>}
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap font-mono text-[10px]">
                                                {((s as unknown as Record<string, number>).page_load_ms ?? 0) > 0
                                                    ? `${((s as unknown as Record<string, number>).page_load_ms / 1000).toFixed(1)}s`
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap font-mono text-[10px]">
                                                {timeAgo(s.last_seen_at)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── SQL hint (si pas de données) ────────────────────── */}
            {!loading && data?.stats.page_views_24h === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5"
                >
                    <p className="text-yellow-400 font-bold text-sm mb-3 flex items-center gap-2">
                        <AlertCircle size={15} /> Créer la table Supabase
                    </p>
                    <p className="text-gray-400 text-xs mb-3">
                        Exécuter ce SQL dans <strong className="text-white">Supabase → SQL Editor</strong> :
                    </p>
                    <pre className="bg-[#0a0f18] border border-white/5 rounded-xl p-4 text-[11px] text-green-400 font-mono overflow-x-auto leading-relaxed">
{`-- ① Création initiale (si table inexistante)
create table if not exists visitor_sessions (
  id uuid default gen_random_uuid() primary key,
  session_id text not null,
  ip text, country text, country_code text,
  city text, region text,
  latitude float, longitude float,
  device_type text, browser text,
  browser_version text, os text,
  page text not null default '/',
  referrer text, utm_source text,
  utm_medium text, utm_campaign text,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

-- Contrainte unique pour upsert (session_id + page)
alter table visitor_sessions
  add constraint if not exists visitor_sessions_session_page_key
  unique (session_id, page);

-- ② Migration : colonnes enrichies (safe si déjà existantes)
alter table visitor_sessions
  add column if not exists continent text,
  add column if not exists continent_code text,
  add column if not exists isp text,
  add column if not exists timezone text,
  add column if not exists is_vpn boolean default false,
  add column if not exists is_proxy boolean default false,
  add column if not exists is_tor boolean default false,
  add column if not exists screen_resolution text,
  add column if not exists viewport_size text,
  add column if not exists language text,
  add column if not exists connection_type text,
  add column if not exists hardware_concurrency smallint default 0,
  add column if not exists device_memory float default 0,
  add column if not exists is_returning boolean default false,
  add column if not exists page_load_ms integer default 0,
  add column if not exists scroll_depth smallint default 0;

-- Index performances
create index if not exists vs_created_at on visitor_sessions(created_at desc);
create index if not exists vs_last_seen  on visitor_sessions(last_seen_at desc);
create index if not exists vs_isp        on visitor_sessions(isp);
create index if not exists vs_country    on visitor_sessions(country_code);

-- RLS (service_role bypasse automatiquement)
alter table visitor_sessions enable row level security;
create policy if not exists "allow_insert" on visitor_sessions
  for insert with check (true);
create policy if not exists "allow_service_select" on visitor_sessions
  for select using (true);`}
                    </pre>
                </motion.div>
            )}

        </div>
    )
}
