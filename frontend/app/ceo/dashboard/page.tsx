'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    TrendingUp, Users, ShoppingBag, ShieldCheck, MessageSquare,
    Activity, AlertTriangle, CheckCircle2, Crown, ArrowUpRight,
    Clock, Globe, Receipt, Zap, ArrowDownRight, type LucideProps,
} from 'lucide-react'
import Link from 'next/link'

// ══════════════════════════════════════════════════════════════
// PALETTE CEO — Or · Vert · Jaune · Rouge
// ══════════════════════════════════════════════════════════════
const GOLD    = '#D4AF37'
const YELLOW  = '#FCD116'
const GREEN   = '#008751'
const GREEN_L = '#00A86B'
const RED     = '#E8112D'
const BG      = '#0B1F0D'
const TEXT    = '#F0EBD8'

interface KpiData {
    revenue_total:   number
    revenue_month:   number
    revenue_today:   number
    orders_total:    number
    orders_pending:  number
    clients_total:   number
    agents_count:    number
    messages_unread: number
    waf_events_24h:  number
    waf_blocked_24h: number
    ip_blocked:      number
    security_score:  number
    partner_apps_pending?: number
    nationalite_pending?:  number
    dossiers_total?:       number
}

async function fetchKpis(): Promise<KpiData> {
    const res = await fetch('/api/ceo/kpis', { cache: 'no-store' })
    if (!res.ok) throw new Error('Erreur API KPIs')
    return res.json()
}

function formatXOF(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M FCFA`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K FCFA`
    return `${n.toLocaleString('fr-FR')} FCFA`
}

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color, href, trend, delay = 0 }: {
    title: string; value: string; sub?: string
    icon: React.ForwardRefExoticComponent<LucideProps>; color: string
    href?: string; trend?: 'up' | 'down' | 'neutral'; delay?: number
}) {
    const inner = (
        <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="relative overflow-hidden rounded-2xl p-5 group h-full border"
            style={{
                background: `linear-gradient(135deg, rgba(15,40,18,0.9) 0%, rgba(20,50,22,0.7) 100%)`,
                borderColor: `${color}20`,
                backdropFilter: 'blur(12px)',
            }}
        >
            {/* Halo */}
            <div className="absolute top-0 right-0 w-36 h-36 rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none"
                style={{ background: color, transform: 'translate(35%, -35%)' }} />

            <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${color}18`, border: `1px solid ${color}35` }}>
                    <Icon size={19} style={{ color }} />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${
                        trend === 'up' ? 'text-emerald-300' : trend === 'down' ? 'text-red-400' : 'text-gray-500'
                    }`}
                        style={{
                            background: trend === 'up' ? 'rgba(52,211,153,0.12)' : trend === 'down' ? 'rgba(248,113,113,0.12)' : 'rgba(107,114,128,0.12)'
                        }}>
                        {trend === 'up' ? <ArrowUpRight size={11} /> : trend === 'down' ? <ArrowDownRight size={11} /> : null}
                    </div>
                )}
            </div>

            <p className="text-[10px] font-black uppercase tracking-[0.25em] mb-1" style={{ color: `${TEXT}60` }}>{title}</p>
            <p className="text-2xl font-black mb-1" style={{ color: TEXT }}>{value}</p>
            {sub && <p className="text-xs" style={{ color: `${TEXT}50` }}>{sub}</p>}

            {href && (
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRight size={14} style={{ color }} />
                </div>
            )}
        </motion.div>
    )

    return href ? <Link href={href} className="h-full block">{inner}</Link> : inner
}

// ── Score sécurité (anneau SVG) ───────────────────────────────
function SecurityRing({ score }: { score: number }) {
    const r     = 36
    const circ  = 2 * Math.PI * r
    const dash  = (score / 100) * circ
    const color = score >= 80 ? GREEN_L : score >= 60 ? YELLOW : RED

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width="90" height="90" className="-rotate-90">
                <circle cx="45" cy="45" r={r} fill="none" stroke={`${color}20`} strokeWidth="7" />
                <motion.circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="7"
                    strokeDasharray={circ}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: circ - dash }}
                    transition={{ duration: 1.8, ease: 'easeOut', delay: 0.5 }}
                    strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black" style={{ color: TEXT }}>{score}</span>
                <span className="text-[8px] font-bold" style={{ color: `${TEXT}50` }}>/ 100</span>
            </div>
        </div>
    )
}

// ── Page principale ───────────────────────────────────────────
export default function CeoDashboardPage() {
    const [kpis, setKpis]           = useState<KpiData | null>(null)
    const [loading, setLoading]     = useState(true)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
    const [mounted, setMounted]     = useState(false)

    useEffect(() => {
        setMounted(true)
        const load = async () => {
            setLoading(true)
            try { const d = await fetchKpis(); setKpis(d); setLastUpdate(new Date()) }
            catch (e) { console.error(e) }
            finally { setLoading(false) }
        }
        load()
        const iv = setInterval(load, 60_000)
        return () => clearInterval(iv)
    }, [])

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto min-h-full">

            {/* En-tête */}
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                        style={{ background: `linear-gradient(135deg, ${GOLD}, #9A7A00, ${YELLOW})` }}>
                        <Crown size={18} style={{ color: BG }} />
                    </div>
                    <h1 className="text-xl font-black tracking-wide" style={{ color: TEXT }}>VUE EXÉCUTIVE</h1>
                    {loading && (
                        <div className="w-4 h-4 border-2 rounded-full animate-spin"
                            style={{ borderColor: `${GREEN}30`, borderTopColor: GREEN_L }} />
                    )}
                </div>
                {/* Barre drapeau */}
                <div className="flex ml-12 rounded-full overflow-hidden mb-1" style={{ height: 2, width: 80 }}>
                    <div className="flex-1" style={{ background: GREEN }} />
                    <div className="flex-1" style={{ background: YELLOW }} />
                    <div className="flex-1" style={{ background: RED }} />
                </div>
                <p className="text-xs ml-12 flex items-center gap-2" style={{ color: `${TEXT}45` }}>
                    Actualisé à {lastUpdate ? lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: GREEN_L }} />
                        Temps réel
                    </span>
                </p>
            </motion.div>

            {/* ── Revenus ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <KpiCard title="Revenu Total"      value={kpis ? formatXOF(kpis.revenue_total) : '—'}
                    sub="Depuis la création" icon={TrendingUp} color={GOLD} href="/ceo/revenus" trend="up" delay={0.05} />
                <KpiCard title="Revenu du Mois"    value={kpis ? formatXOF(kpis.revenue_month) : '—'}
                    sub={mounted ? new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '—'}
                    icon={Receipt} color={GREEN_L} href="/ceo/revenus" trend="up" delay={0.1} />
                <KpiCard title="Revenu Aujourd'hui" value={kpis ? formatXOF(kpis.revenue_today) : '—'}
                    sub={mounted ? new Date().toLocaleDateString('fr-FR') : '—'}
                    icon={Zap} color={YELLOW} href="/ceo/revenus" delay={0.15} />
            </div>

            {/* ── Opérations ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <KpiCard title="Commandes" value={kpis ? kpis.orders_total.toString() : '—'}
                    sub={kpis ? `${kpis.orders_pending} en attente` : ''} icon={ShoppingBag} color={YELLOW} href="/ceo/commandes" delay={0.2} />
                <KpiCard title="Clients" value={kpis ? kpis.clients_total.toString() : '—'}
                    sub="Comptes actifs" icon={Users} color={GREEN_L} href="/ceo/clients" delay={0.25} />
                <KpiCard title="Agents" value={kpis ? kpis.agents_count.toString() : '—'}
                    sub="Terrain" icon={Globe} color={GOLD} delay={0.3} />
                <KpiCard title="Messages" value={kpis ? kpis.messages_unread.toString() : '—'}
                    sub="Non lus" icon={MessageSquare}
                    color={kpis && kpis.messages_unread > 0 ? RED : `${TEXT}40`}
                    href="/ceo/messages" delay={0.35} />
            </div>

            {/* ── Sécurité + WAF ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

                {/* Score */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="rounded-2xl p-5 border"
                    style={{
                        background: 'linear-gradient(135deg, rgba(15,40,18,0.9) 0%, rgba(20,50,22,0.7) 100%)',
                        borderColor: `${GREEN}25`,
                    }}>
                    <div className="flex items-center gap-2 mb-5">
                        <ShieldCheck size={16} style={{ color: GREEN_L }} />
                        <span className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: `${TEXT}60` }}>Score Sécurité</span>
                    </div>
                    <div className="flex items-center gap-5">
                        <SecurityRing score={kpis?.security_score ?? 0} />
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2 text-xs">
                                <CheckCircle2 size={12} style={{ color: GREEN_L }} />
                                <span style={{ color: `${TEXT}70` }}>WAF Actif</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                {kpis && kpis.ip_blocked > 0
                                    ? <AlertTriangle size={12} style={{ color: RED }} />
                                    : <CheckCircle2 size={12} style={{ color: GREEN_L }} />}
                                <span style={{ color: `${TEXT}70` }}>{kpis?.ip_blocked ?? 0} IP bloquée{(kpis?.ip_blocked ?? 0) > 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <Activity size={12} style={{ color: YELLOW }} />
                                <span style={{ color: `${TEXT}70` }}>{kpis?.waf_events_24h ?? 0} évts / 24h</span>
                            </div>
                        </div>
                    </div>
                    <Link href="/ceo/securite"
                        className="mt-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors"
                        style={{ color: `${GREEN_L}80` }}
                        onMouseEnter={e => (e.currentTarget.style.color = GREEN_L)}
                        onMouseLeave={e => (e.currentTarget.style.color = `${GREEN_L}80`)}>
                        Rapport complet <ArrowUpRight size={11} />
                    </Link>
                </motion.div>

                {/* WAF Stats */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                    className="rounded-2xl p-5 border col-span-1 lg:col-span-2"
                    style={{
                        background: 'linear-gradient(135deg, rgba(15,40,18,0.9) 0%, rgba(20,50,22,0.7) 100%)',
                        borderColor: `${GREEN}20`,
                    }}>
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <Activity size={16} style={{ color: YELLOW }} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: `${TEXT}60` }}>
                                Activité WAF — 24h
                            </span>
                        </div>
                        <Link href="/ceo/securite" className="text-[10px] transition-colors"
                            style={{ color: `${TEXT}40` }}
                            onMouseEnter={e => (e.currentTarget.style.color = GREEN_L)}
                            onMouseLeave={e => (e.currentTarget.style.color = `${TEXT}40`)}>
                            Détails →
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl p-4 border"
                            style={{ background: `${GREEN}12`, borderColor: `${GREEN}25` }}>
                            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: `${TEXT}50` }}>Analysées</p>
                            <p className="text-2xl font-black" style={{ color: TEXT }}>{kpis?.waf_events_24h ?? '—'}</p>
                        </div>
                        <div className="rounded-xl p-4 border"
                            style={{ background: `${RED}10`, borderColor: `${RED}25` }}>
                            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: `${TEXT}50` }}>Bloquées</p>
                            <p className="text-2xl font-black" style={{ color: RED }}>{kpis?.waf_blocked_24h ?? '—'}</p>
                        </div>
                        <div className="rounded-xl p-4 border col-span-2 sm:col-span-1"
                            style={{
                                background: kpis && kpis.ip_blocked > 0 ? `${RED}10` : `${GREEN}10`,
                                borderColor: kpis && kpis.ip_blocked > 0 ? `${RED}20` : `${GREEN}20`,
                            }}>
                            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: `${TEXT}50` }}>IPs Bannies</p>
                            <p className="text-2xl font-black" style={{ color: kpis && kpis.ip_blocked > 0 ? RED : GREEN_L }}>
                                {kpis?.ip_blocked ?? '—'}
                            </p>
                        </div>
                    </div>

                    {kpis && kpis.waf_blocked_24h > 0 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                            className="mt-4 flex items-center gap-2 p-3 rounded-xl text-xs border"
                            style={{ background: `${RED}10`, borderColor: `${RED}25`, color: `${RED}DD` }}>
                            <AlertTriangle size={13} className="shrink-0" />
                            {kpis.waf_blocked_24h} attaque{kpis.waf_blocked_24h > 1 ? 's' : ''} bloquée{kpis.waf_blocked_24h > 1 ? 's' : ''} — Système de défense opérationnel
                        </motion.div>
                    )}
                </motion.div>
            </div>

            {/* ── Actions rapides ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
                className="rounded-2xl p-5 border"
                style={{
                    background: `linear-gradient(135deg, rgba(15,40,18,0.85), rgba(20,50,22,0.65))`,
                    borderColor: `${GOLD}25`,
                }}>
                <div className="flex items-center gap-2 mb-4">
                    <Crown size={14} style={{ color: GOLD }} />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: `${TEXT}60` }}>Actions Rapides</span>
                </div>
                {/* Ligne tricolore */}
                <div className="flex rounded-full overflow-hidden mb-4" style={{ height: 1.5 }}>
                    <div className="flex-1" style={{ background: GREEN }} />
                    <div className="flex-1" style={{ background: YELLOW }} />
                    <div className="flex-1" style={{ background: RED }} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Revenus',      href: '/ceo/revenus',    icon: Receipt,      color: GOLD },
                        { label: 'WAF Sécurité', href: '/ceo/securite',   icon: ShieldCheck,  color: GREEN_L },
                        { label: 'Commandes',    href: '/ceo/commandes',  icon: ShoppingBag,  color: YELLOW },
                        { label: 'Clients',      href: '/ceo/clients',    icon: Users,        color: RED },
                    ].map(action => (
                        <Link key={action.href} href={action.href}
                            className="flex items-center gap-2.5 p-3 rounded-xl transition-all group border"
                            style={{ background: `${action.color}08`, borderColor: `${action.color}15` }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = `${action.color}18`
                                e.currentTarget.style.borderColor = `${action.color}35`
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = `${action.color}08`
                                e.currentTarget.style.borderColor = `${action.color}15`
                            }}
                        >
                            <action.icon size={15} style={{ color: action.color }} />
                            <span className="text-xs font-bold transition-colors" style={{ color: `${TEXT}60` }}
                                onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
                                onMouseLeave={e => (e.currentTarget.style.color = `${TEXT}60`)}>
                                {action.label}
                            </span>
                        </Link>
                    ))}
                </div>
            </motion.div>

            {/* Footer */}
            <div className="mt-8 text-center">
                <div className="flex justify-center gap-2 mb-3">
                    {[GREEN, YELLOW, RED].map((c, i) => (
                        <div key={i} className="w-8 h-1 rounded-full opacity-30" style={{ background: c }} />
                    ))}
                </div>
                <p className="text-[10px] flex items-center justify-center gap-1.5" style={{ color: `${TEXT}30` }}>
                    <Clock size={10} />
                    Actualisation automatique toutes les 60 secondes
                </p>
            </div>
        </div>
    )
}
