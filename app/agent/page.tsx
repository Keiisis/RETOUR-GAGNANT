'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    FileText, MessageSquare, Compass, ArrowUpRight,
    TrendingUp, Headphones, Calendar, Users,
    ChevronRight, BarChart3, Phone, Mail,
    Activity, Clock, Target, Sparkles, Globe
} from 'lucide-react'
import Link from 'next/link'

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

interface DashboardStats {
    totalDossiers: number
    dossiersEnCours: number
    dossiersTermines: number
    newMessages: number
    newVocaux: number
    leadsOracle: number
    leadsNonContactes: number
    nationalityApps: number
}

// ═══════════════════════════════════════════
// Animation variants
// ═══════════════════════════════════════════

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.06, delayChildren: 0.1 },
    },
}

const staggerItem = {
    hidden: { opacity: 0, y: 16, scale: 0.97 },
    visible: {
        opacity: 1, y: 0, scale: 1,
        transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
    },
}

// fadeSlideUp removed — using staggerContainer/staggerItem instead

// ═══════════════════════════════════════════
// Skeleton Loader
// ═══════════════════════════════════════════

const KPISkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-nexus-card p-5">
                <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl nexus-skeleton" />
                    <div className="w-4 h-4 nexus-skeleton rounded" />
                </div>
                <div className="w-16 h-8 nexus-skeleton rounded mb-2" />
                <div className="w-24 h-3 nexus-skeleton rounded" />
            </div>
        ))}
    </div>
)

// ═══════════════════════════════════════════
// Mini Sparkline Chart
// ═══════════════════════════════════════════

const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1
    const width = 80
    const height = 24

    const points = data.map((value, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - ((value - min) / range) * height
        return `${x},${y}`
    }).join(' ')

    return (
        <svg width={width} height={height} className="opacity-60">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

// ═══════════════════════════════════════════
// Dashboard Page
// ═══════════════════════════════════════════

export default function AgentDashboard() {
    const [stats, setStats] = useState<DashboardStats>({
        totalDossiers: 0,
        dossiersEnCours: 0,
        dossiersTermines: 0,
        newMessages: 0,
        newVocaux: 0,
        leadsOracle: 0,
        leadsNonContactes: 0,
        nationalityApps: 0,
    })
    const [recentDossiers, setRecentDossiers] = useState<Record<string, unknown>[]>([])
    const [recentMessages, setRecentMessages] = useState<Record<string, unknown>[]>([])
    const [loading, setLoading] = useState(true)
    const [agentName, setAgentName] = useState('Agent')

    useEffect(() => {
        const fetchAll = async () => {
            try {
                // Get agent name
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const { data: profile } = await supabase
                        .from('user_profiles')
                        .select('full_name')
                        .eq('id', user.id)
                        .single()
                    if (profile?.full_name) setAgentName(profile.full_name.split(' ')[0])
                }

                // Parallel fetching (react-best-practices: async-parallel)
                const [
                    dossiersRes,
                    msgCountRes,
                    voixCountRes,
                    leadsRes,
                    msgsRes,
                    nationalityCountRes
                ] = await Promise.all([
                    supabase.from('dossier_tracking').select('*', { count: 'exact' }).order('created_at', { ascending: false }),
                    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('lu', false),
                    supabase.from('voice_messages').select('*', { count: 'exact', head: true }).eq('is_read', false),
                    supabase.from('eligibility_results').select('*').order('created_at', { ascending: false }),
                    supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(5),
                    supabase.from('nationality_applications').select('*', { count: 'exact', head: true }),
                ])

                const allDossiers = (dossiersRes.data as Record<string, unknown>[]) || []
                const allLeads = (leadsRes.data as Record<string, unknown>[]) || []

                setStats({
                    totalDossiers: dossiersRes.count || allDossiers.length,
                    dossiersEnCours: allDossiers.filter(d => d.statut !== 'termine').length,
                    dossiersTermines: allDossiers.filter(d => d.statut === 'termine').length,
                    newMessages: msgCountRes.count || 0,
                    newVocaux: voixCountRes.count || 0,
                    leadsOracle: allLeads.length,
                    leadsNonContactes: allLeads.filter(l => !l.contacted).length,
                    nationalityApps: nationalityCountRes.count || 0,
                })

                setRecentDossiers(allDossiers.slice(0, 5))
                setRecentMessages((msgsRes.data as Record<string, unknown>[]) || [])
            } catch (err) {
                // Security: don't expose error details
                if (process.env.NODE_ENV === 'development') {
                    console.error('Dashboard fetch error:', err)
                }
            } finally {
                setLoading(false)
            }
        }

        fetchAll()
    }, [])

    const kpiCards = [
        {
            label: 'Dossiers en cours',
            value: stats.dossiersEnCours,
            icon: FileText,
            gradient: 'from-emerald-500 to-teal-600',
            borderGlow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
            href: '/agent/dossiers',
            sparkData: [3, 5, 4, 7, 6, 8, stats.dossiersEnCours],
            sparkColor: '#10B981',
        },
        {
            label: 'Messages non lus',
            value: stats.newMessages,
            icon: MessageSquare,
            gradient: 'from-blue-500 to-indigo-600',
            borderGlow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]',
            href: '/agent/messages',
            sparkData: [2, 1, 4, 3, 5, 2, stats.newMessages],
            sparkColor: '#3B82F6',
        },
        {
            label: 'Vocaux non lus',
            value: stats.newVocaux,
            icon: Headphones,
            gradient: 'from-purple-500 to-fuchsia-600',
            borderGlow: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]',
            href: '/agent/vocaux',
            sparkData: [1, 3, 2, 1, 4, 2, stats.newVocaux],
            sparkColor: '#A855F7',
        },
        {
            label: 'Leads non contactés',
            value: stats.leadsNonContactes,
            icon: Compass,
            gradient: 'from-amber-500 to-orange-600',
            borderGlow: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]',
            href: '/agent/leads',
            sparkData: [5, 4, 6, 3, 7, 5, stats.leadsNonContactes],
            sparkColor: '#F59E0B',
        },
        {
            label: 'Demandes Nat.',
            value: stats.nationalityApps,
            icon: Globe,
            gradient: 'from-blue-600 to-cyan-700',
            borderGlow: 'hover:shadow-[0_0_30px_rgba(25,118,210,0.15)]',
            href: '/agent/nationalite',
            sparkData: [1, 2, 3, 2, 4, 3, stats.nationalityApps],
            sparkColor: '#1976D2',
        },
    ]

    const quickActions = [
        { label: 'Nouveau Dossier', icon: FileText, href: '/agent/dossiers', accent: 'text-emerald-400 bg-emerald-500/8 border-emerald-500/15 hover:bg-emerald-500/15' },
        { label: 'Voir les Messages', icon: Mail, href: '/agent/messages', accent: 'text-blue-400 bg-blue-500/8 border-blue-500/15 hover:bg-blue-500/15' },
        { label: 'Consulter l\'Agenda', icon: Calendar, href: '/agent/agenda', accent: 'text-purple-400 bg-purple-500/8 border-purple-500/15 hover:bg-purple-500/15' },
        { label: 'Fiche Client', icon: Users, href: '/agent/clients', accent: 'text-teal-400 bg-teal-500/8 border-teal-500/15 hover:bg-teal-500/15' },
    ]

    const statusColor = (status: string) => {
        switch (status) {
            case 'termine': return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
            case 'traitement': return 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
            case 'validation': return 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
            case 'verification': return 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
            case 'finalisation': return 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
            case 'reception': return 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
            default: return 'bg-white/5 text-nexus-text-muted border border-white/10'
        }
    }

    const statusLabel = (status: string) => {
        switch (status) {
            case 'termine': return 'Terminé'
            case 'traitement': return 'Traitement'
            case 'validation': return 'Validation'
            case 'verification': return 'Vérification'
            case 'finalisation': return 'Finalisation'
            case 'reception': return 'Réception'
            default: return status
        }
    }

    // Greeting based on time of day
    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Bonjour'
        if (hour < 18) return 'Bon après-midi'
        return 'Bonsoir'
    }

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="flex flex-col gap-2">
                    <div className="w-48 h-7 nexus-skeleton rounded" />
                    <div className="w-64 h-4 nexus-skeleton rounded" />
                </div>
                <KPISkeleton />
            </div>
        )
    }

    return (
        <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-7"
        >
            {/* ═══ Header with greeting ═══ */}
            <motion.div variants={staggerItem}>
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <Sparkles size={14} className="text-emerald-400" />
                            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-[0.3em]">
                                Bureau Opérationnel
                            </span>
                        </div>
                        <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                            {getGreeting()}, <span className="text-emerald-400">{agentName}</span>
                        </h1>
                        <p className="text-nexus-text-muted text-[12px] mt-1 flex items-center gap-1.5">
                            <Clock size={12} />
                            {new Date().toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </p>
                    </div>

                    {/* Live status */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/8 border border-emerald-500/15">
                        <Activity size={12} className="text-emerald-400 animate-nexus-pulse" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                            Système Actif
                        </span>
                    </div>
                </div>
            </motion.div>

            {/* ═══ KPI Cards ═══ */}
            <motion.div
                variants={staggerContainer}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
            >
                {kpiCards.map((kpi) => (
                    <motion.div key={kpi.label} variants={staggerItem}>
                        <Link
                            href={kpi.href}
                            className={`block p-5 glass-nexus-card group ${kpi.borderGlow} transition-all duration-300`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center shadow-lg`}>
                                    <kpi.icon size={18} className="text-white" />
                                </div>
                                <ArrowUpRight
                                    size={14}
                                    className="text-nexus-text-muted group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                                />
                            </div>

                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-2xl font-black text-white mb-0.5">{kpi.value}</p>
                                    <p className="text-[10px] text-nexus-text-muted font-bold uppercase tracking-wider">{kpi.label}</p>
                                </div>
                                <Sparkline data={kpi.sparkData} color={kpi.sparkColor} />
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </motion.div>

            {/* ═══ Quick Actions ═══ */}
            <motion.div variants={staggerItem}>
                <h2 className="text-[10px] font-bold text-nexus-text-muted uppercase tracking-[0.2em] mb-2.5 flex items-center gap-1.5">
                    <Target size={12} className="text-emerald-400" />
                    Actions Rapides
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {quickActions.map((action) => (
                        <Link
                            key={action.label}
                            href={action.href}
                            className={`flex items-center gap-2.5 p-3.5 rounded-xl border transition-all group ${action.accent}`}
                        >
                            <action.icon size={16} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[12px] font-semibold">{action.label}</span>
                        </Link>
                    ))}
                </div>
            </motion.div>

            {/* ═══ Two columns: Dossiers + Messages ═══ */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {/* Recent Dossiers */}
                <motion.div variants={staggerItem} className="glass-nexus-card overflow-hidden">
                    <div className="flex items-center justify-between p-4 pb-3 border-b border-nexus-border-subtle">
                        <div className="flex items-center gap-2">
                            <FileText size={14} className="text-emerald-400" />
                            <h3 className="font-bold text-white text-[13px]">Dossiers Récents</h3>
                        </div>
                        <Link href="/agent/dossiers" className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5 uppercase tracking-wider">
                            Tout voir <ChevronRight size={12} />
                        </Link>
                    </div>
                    <div className="divide-y divide-nexus-border-subtle">
                        {recentDossiers.length === 0 ? (
                            <div className="p-8 text-center">
                                <FileText size={24} className="mx-auto text-nexus-text-muted mb-2 opacity-50" />
                                <p className="text-nexus-text-muted text-[12px]">Aucun dossier pour le moment</p>
                            </div>
                        ) : (
                            recentDossiers.map((d) => (
                                <div key={d.id as string} className="flex items-center justify-between p-3.5 hover:bg-white/[0.015] transition-colors">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/8 flex items-center justify-center border border-emerald-500/10">
                                            <FileText size={13} className="text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="text-[12px] font-bold text-white">{d.num_dossier as string}</p>
                                            <p className="text-[10px] text-nexus-text-muted">{d.client_nom as string} {d.client_prenom as string}</p>
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColor(d.statut as string)}`}>
                                        {statusLabel(d.statut as string)}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>

                {/* Recent Messages */}
                <motion.div variants={staggerItem} className="glass-nexus-card overflow-hidden">
                    <div className="flex items-center justify-between p-4 pb-3 border-b border-nexus-border-subtle">
                        <div className="flex items-center gap-2">
                            <MessageSquare size={14} className="text-blue-400" />
                            <h3 className="font-bold text-white text-[13px]">Messages Récents</h3>
                        </div>
                        <Link href="/agent/messages" className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5 uppercase tracking-wider">
                            Tout voir <ChevronRight size={12} />
                        </Link>
                    </div>
                    <div className="divide-y divide-nexus-border-subtle">
                        {recentMessages.length === 0 ? (
                            <div className="p-8 text-center">
                                <MessageSquare size={24} className="mx-auto text-nexus-text-muted mb-2 opacity-50" />
                                <p className="text-nexus-text-muted text-[12px]">Aucun message</p>
                            </div>
                        ) : (
                            recentMessages.map((m) => (
                                <div key={m.id as string} className="flex items-center justify-between p-3.5 hover:bg-white/[0.015] transition-colors">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${(m.lu as boolean) ? 'bg-white/5' : 'bg-blue-500/10 border border-blue-500/15'}`}>
                                            {(m.type as string) === 'support' ? (
                                                <Phone size={13} className={(m.lu as boolean) ? 'text-nexus-text-muted' : 'text-blue-400'} />
                                            ) : (
                                                <Mail size={13} className={(m.lu as boolean) ? 'text-nexus-text-muted' : 'text-blue-400'} />
                                            )}
                                        </div>
                                        <div>
                                            <p className={`text-[12px] font-semibold ${(m.lu as boolean) ? 'text-nexus-text-muted' : 'text-white'}`}>
                                                {m.nom as string} {m.prenom as string}
                                            </p>
                                            <p className="text-[10px] text-nexus-text-muted truncate max-w-[180px]">
                                                {m.sujet as string}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[9px] text-nexus-text-muted">
                                            {new Date(m.created_at as string).toLocaleDateString('fr-FR')}
                                        </span>
                                        {!(m.lu as boolean) && (
                                            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>

            {/* ═══ Performance Summary Bar ═══ */}
            <motion.div
                variants={staggerItem}
                className="glass-nexus-card p-5 flex flex-col md:flex-row items-center justify-between gap-4 nexus-border-glow"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border border-emerald-500/20 flex items-center justify-center">
                        <BarChart3 size={18} className="text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-[13px] font-bold text-white">Résumé de Performance</p>
                        <p className="text-[11px] text-nexus-text-muted">
                            <span className="text-emerald-400 font-bold">{stats.dossiersTermines}</span> dossier(s) finalisé(s) • <span className="font-bold">{stats.totalDossiers}</span> total • <span className="text-amber-400 font-bold">{stats.leadsOracle}</span> leads Oracle
                        </p>
                    </div>
                </div>
                <Link
                    href="/agent/performances"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15 transition-all text-[11px] font-bold whitespace-nowrap"
                >
                    <TrendingUp size={14} />
                    Voir les détails
                    <ChevronRight size={12} />
                </Link>
            </motion.div>
        </motion.div>
    )
}
