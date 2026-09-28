'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { FileText, ChatText as MessageSquare, Compass, ArrowUpRight, TrendUp as TrendingUp, Headphones, Calendar, Users, CaretRight as ChevronRight, ChartBar as BarChart3, Phone, Envelope as Mail, Pulse as Activity, Clock, Target, Sparkle as Sparkles, Globe } from '@phosphor-icons/react';
import Link from 'next/link'
import { useTranslation, T } from '@/lib/translation'
import { AnyRecord } from '@/types'
import { DOSSIER_STATUTS_CLOS, statutDossier } from '@/lib/constants/statuts'

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
    rdvEnAttente: number
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

// fadeSlideUp removed : using staggerContainer/staggerItem instead

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
    if (data.length < 2) return null
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
    const { t, lang } = useTranslation()
    const [mounted, setMounted] = useState(false)
    const [stats, setStats] = useState<DashboardStats>({
        totalDossiers: 0,
        dossiersEnCours: 0,
        dossiersTermines: 0,
        newMessages: 0,
        newVocaux: 0,
        leadsOracle: 0,
        leadsNonContactes: 0,
        nationalityApps: 0,
        rdvEnAttente: 0,
    })
    const [recentDossiers, setRecentDossiers] = useState<AnyRecord[]>([])
    const [recentMessages, setRecentMessages] = useState<AnyRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [agentName, setAgentName] = useState('Agent')
    const [erreur, setErreur] = useState<string | null>(null)
    // Nouveautés par jour sur 7 jours (données réelles ; remplace les courbes figées)
    const [series, setSeries] = useState<Record<'dossiers' | 'messages' | 'vocaux' | 'leads' | 'nationalite' | 'rdv', number[]>>({
        dossiers: [], messages: [], vocaux: [], leads: [], nationalite: [], rdv: [],
    })

    useEffect(() => {
        setMounted(true)
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

                // Comptes exacts côté base (head + count) : un select('*') plafonne
                // à 1000 lignes et faussait les totaux au-delà.
                const depuis = new Date(Date.now() - 6 * 86400000)
                depuis.setHours(0, 0, 0, 0)
                const depuisIso = depuis.toISOString()
                const tete = { count: 'exact' as const, head: true }
                const [
                    totalDossiersRes,
                    termineRes,
                    actifsRes,
                    recentDossiersRes,
                    msgCountRes,
                    voixCountRes,
                    leadsTotalRes,
                    // « Contacté » = is_contacted (drapeau posé par la page Leads) ;
                    // l'ancien calcul lisait `contacted`, jamais renseigné → tous comptés.
                    leadsNonContactesRes,
                    msgsRes,
                    nationalityCountRes,
                    rdvRes,
                    s1, s2, s3, s4, s5, s6,
                ] = await Promise.all([
                    supabase.from('dossier_tracking').select('id', tete),
                    supabase.from('dossier_tracking').select('id', tete).eq('statut', 'termine'),
                    // En cours = ni terminé ni annulé (les annulés étaient comptés « en cours »)
                    supabase.from('dossier_tracking').select('id', tete).or(`statut.is.null,statut.not.in.(${DOSSIER_STATUTS_CLOS.join(',')})`),
                    supabase.from('dossier_tracking').select('id, num_dossier, client_nom, client_prenom, nom, prenom, statut').order('created_at', { ascending: false }).limit(5),
                    // Même périmètre que /agent/messages (qui exclut les messages « nationality ») :
                    // sinon le compteur annonçait des non-lus introuvables dans la boîte.
                    supabase.from('messages').select('id', tete).eq('lu', false).neq('type', 'nationality'),
                    supabase.from('voice_messages').select('id', tete).eq('is_read', false),
                    supabase.from('eligibility_results').select('id', tete),
                    supabase.from('eligibility_results').select('id', tete).or('is_contacted.is.null,is_contacted.eq.false'),
                    supabase.from('messages').select('*').neq('type', 'nationality').order('created_at', { ascending: false }).limit(5),
                    supabase.from('nationality_applications').select('id', tete),
                    supabase.from('rdv_requests').select('id', tete).eq('statut', 'en_attente'),
                    // Séries réelles des 7 derniers jours (créations par jour)
                    supabase.from('dossier_tracking').select('created_at').gte('created_at', depuisIso),
                    supabase.from('messages').select('created_at').gte('created_at', depuisIso),
                    supabase.from('voice_messages').select('created_at').gte('created_at', depuisIso),
                    supabase.from('eligibility_results').select('created_at').gte('created_at', depuisIso),
                    supabase.from('nationality_applications').select('created_at').gte('created_at', depuisIso),
                    supabase.from('rdv_requests').select('created_at').gte('created_at', depuisIso),
                ])

                const echec = [totalDossiersRes, termineRes, actifsRes, recentDossiersRes, msgCountRes, voixCountRes, leadsTotalRes, leadsNonContactesRes, msgsRes, nationalityCountRes, rdvRes]
                    .find(r => r.error)
                if (echec?.error) setErreur(echec.error.message)

                const parJour = (rows: { created_at: string | null }[] | null) => {
                    const jours = Array.from({ length: 7 }, () => 0)
                    for (const r of rows || []) {
                        if (!r.created_at) continue
                        const idx = Math.floor((new Date(r.created_at).getTime() - depuis.getTime()) / 86400000)
                        if (idx >= 0 && idx < 7) jours[idx]++
                    }
                    return jours
                }
                setSeries({
                    dossiers: parJour(s1.data), messages: parJour(s2.data), vocaux: parJour(s3.data),
                    leads: parJour(s4.data), nationalite: parJour(s5.data), rdv: parJour(s6.data),
                })

                const total = totalDossiersRes.count || 0
                const termines = termineRes.count || 0
                setStats({
                    totalDossiers: total,
                    dossiersEnCours: actifsRes.count || 0,
                    dossiersTermines: termines,
                    newMessages: msgCountRes.count || 0,
                    newVocaux: voixCountRes.count || 0,
                    leadsOracle: leadsTotalRes.count || 0,
                    leadsNonContactes: leadsNonContactesRes.count || 0,
                    nationalityApps: nationalityCountRes.count || 0,
                    rdvEnAttente: rdvRes.count || 0,
                })

                setRecentDossiers((recentDossiersRes.data as AnyRecord[]) || [])
                setRecentMessages((msgsRes.data as AnyRecord[]) || [])
            } catch (err) {
                setErreur(err instanceof Error ? err.message : 'Chargement impossible')
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
            label: t('Dossiers en cours'),
            value: stats.dossiersEnCours,
            icon: FileText,
            gradient: 'from-emerald-500 to-teal-600',
            borderGlow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
            href: '/agent/dossiers',
            sparkData: series.dossiers,
            sparkColor: '#10B981',
        },
        {
            label: t('Messages non lus'),
            value: stats.newMessages,
            icon: MessageSquare,
            gradient: 'from-blue-500 to-indigo-600',
            borderGlow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]',
            href: '/agent/messages',
            sparkData: series.messages,
            sparkColor: '#3B82F6',
        },
        {
            label: t('Vocaux non lus'),
            value: stats.newVocaux,
            icon: Headphones,
            gradient: 'from-purple-500 to-fuchsia-600',
            borderGlow: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]',
            href: '/agent/vocaux',
            sparkData: series.vocaux,
            sparkColor: '#A855F7',
        },
        {
            label: t('Leads non contactés'),
            value: stats.leadsNonContactes,
            icon: Compass,
            gradient: 'from-amber-500 to-orange-600',
            borderGlow: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]',
            href: '/agent/leads',
            sparkData: series.leads,
            sparkColor: '#F59E0B',
        },
        {
            label: t('Demandes Nat.'),
            value: stats.nationalityApps,
            icon: Globe,
            gradient: 'from-blue-600 to-cyan-700',
            borderGlow: 'hover:shadow-[0_0_30px_rgba(25,118,210,0.15)]',
            href: '/agent/nationalite',
            sparkData: series.nationalite,
            sparkColor: '#1976D2',
        },
        {
            label: t('RDV en attente'),
            value: stats.rdvEnAttente,
            icon: Calendar,
            gradient: 'from-rose-500 to-pink-600',
            borderGlow: 'hover:shadow-[0_0_30px_rgba(244,63,94,0.15)]',
            href: '/agent/agenda',
            sparkData: series.rdv,
            sparkColor: '#F43F5E',
        },
    ]

    const quickActions = [
        { label: t('Nouveau Dossier'), icon: FileText, href: '/agent/dossiers', accent: 'text-emerald-400 bg-emerald-500/8 border-emerald-500/15 hover:bg-emerald-500/15' },
        { label: t('Voir les Messages'), icon: Mail, href: '/agent/messages', accent: 'text-blue-400 bg-blue-500/8 border-blue-500/15 hover:bg-blue-500/15' },
        { label: t('Consulter l\'Agenda'), icon: Calendar, href: '/agent/agenda', accent: 'text-purple-400 bg-purple-500/8 border-purple-500/15 hover:bg-purple-500/15' },
        { label: t('Fiche Client'), icon: Users, href: '/agent/clients', accent: 'text-teal-400 bg-teal-500/8 border-teal-500/15 hover:bg-teal-500/15' },
    ]

    // Libellés et couleurs : référence unique (lib/constants/statuts), « Annulé » compris
    const statusColor = (status: string) => statutDossier(status).badge
    const statusLabel = (status: string) => t(statutDossier(status).label)

    // Greeting based on time of day
    const getGreeting = () => {
        if (!mounted) return t('Bonjour')
        const hour = new Date().getHours()
        if (hour < 12) return t('Bonjour')
        if (hour < 18) return t('Bon après-midi')
        return t('Bonsoir')
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
                                <T>Bureau Opérationnel</T>
                            </span>
                        </div>
                        <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                            {getGreeting()}, <span className="text-emerald-400">{agentName}</span>
                        </h1>
                        <p className="text-nexus-text-muted text-[12px] mt-1 flex items-center gap-1.5">
                            <Clock size={12} />
                            {mounted ? new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            }) : '-'}
                        </p>
                    </div>

                    {/* Live status */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/8 border border-emerald-500/15">
                        <Activity size={12} className="text-emerald-400 animate-nexus-pulse" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                            <T>Système Actif</T>
                        </span>
                    </div>
                </div>
            </motion.div>

            {erreur && (
                <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[12px] font-semibold">
                    {t('Certaines données du tableau de bord n\'ont pas pu être chargées')} : {erreur}
                </div>
            )}

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
                                {/* Pastille sobre : la couleur vit dans l'icône et la sparkline,
                                    pas dans un dégradé criard (cohérence Nexus Emerald) */}
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center border"
                                    style={{ backgroundColor: `${kpi.sparkColor}14`, borderColor: `${kpi.sparkColor}33` }}>
                                    <kpi.icon size={18} style={{ color: kpi.sparkColor }} />
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
                    <T>Actions Rapides</T>
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
                            <h3 className="font-bold text-white text-[13px]"><T>Dossiers Récents</T></h3>
                        </div>
                        <Link href="/agent/dossiers" className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5 uppercase tracking-wider">
                            <T>Tout voir</T> <ChevronRight size={12} />
                        </Link>
                    </div>
                    <div className="divide-y divide-nexus-border-subtle">
                        {recentDossiers.length === 0 ? (
                            <div className="p-8 text-center">
                                <FileText size={24} className="mx-auto text-nexus-text-muted mb-2 opacity-50" />
                                <p className="text-nexus-text-muted text-[12px]"><T>Aucun dossier pour le moment</T></p>
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
                                            <p className="text-[10px] text-nexus-text-muted">{(d.client_nom || d.nom || '') as string} {(d.client_prenom || d.prenom || '') as string}</p>
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
                            <h3 className="font-bold text-white text-[13px]"><T>Messages Récents</T></h3>
                        </div>
                        <Link href="/agent/messages" className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5 uppercase tracking-wider">
                            <T>Tout voir</T> <ChevronRight size={12} />
                        </Link>
                    </div>
                    <div className="divide-y divide-nexus-border-subtle">
                        {recentMessages.length === 0 ? (
                            <div className="p-8 text-center">
                                <MessageSquare size={24} className="mx-auto text-nexus-text-muted mb-2 opacity-50" />
                                <p className="text-nexus-text-muted text-[12px]"><T>Aucun message</T></p>
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
                                            {m.created_at && !isNaN(new Date(m.created_at).getTime()) ? new Date(m.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR') : '-'}
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
                        <p className="text-[13px] font-bold text-white"><T>Résumé de Performance</T></p>
                        <p className="text-[11px] text-nexus-text-muted">
                            <span className="text-emerald-400 font-bold">{stats.dossiersTermines}</span> {t('dossier(s) finalisé(s)')} • <span className="font-bold">{stats.totalDossiers}</span> {t('total')} • <span className="text-amber-400 font-bold">{stats.leadsOracle}</span> {t('leads Oracle')}
                        </p>
                    </div>
                </div>
                <Link
                    href="/agent/performances"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15 transition-all text-[11px] font-bold whitespace-nowrap"
                >
                    <TrendingUp size={14} />
                    {t('Voir les détails')}
                    <ChevronRight size={12} />
                </Link>
            </motion.div>
        </motion.div>
    )
}
