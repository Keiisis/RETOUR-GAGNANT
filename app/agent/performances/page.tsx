'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    TrendingUp, FileText, MessageSquare, Clock,
    CheckCircle2, BarChart3, Target, Award,
    Users, CalendarDays, Compass, Briefcase
} from 'lucide-react'

interface PerformanceData {
    totalDossiers: number
    dossiersTermines: number
    dossiersEnCours: number
    dossiersNouveaux: number
    tauxResolution: number
    messagesTotal: number
    messagesLus: number
    messagesRDV: number
    leadsTotal: number
    leadsContactes: number
    leadsHot: number
    devisTotal: number
    devisEnvoyes: number
    eventsTotal: number
    clientsUniques: number
    thisMonthDossiers: number
    thisMonthMessages: number
    thisMonthLeads: number
}

export default function AgentPerformancesPage() {
    const [perf, setPerf] = useState<PerformanceData>({
        totalDossiers: 0, dossiersTermines: 0, dossiersEnCours: 0, dossiersNouveaux: 0,
        tauxResolution: 0, messagesTotal: 0, messagesLus: 0, messagesRDV: 0,
        leadsTotal: 0, leadsContactes: 0, leadsHot: 0,
        devisTotal: 0, devisEnvoyes: 0, eventsTotal: 0,
        clientsUniques: 0, thisMonthDossiers: 0, thisMonthMessages: 0, thisMonthLeads: 0,
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPerf = async () => {
            const now = new Date()
            const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

            const [dossiersRes, messagesRes, leadsRes, devisRes, eventsRes] = await Promise.all([
                supabase.from('dossier_tracking').select('*'),
                supabase.from('messages').select('*'),
                supabase.from('eligibility_results').select('*'),
                supabase.from('agent_devis').select('*'),
                supabase.from('agent_events').select('*'),
            ])

            const dossiers = dossiersRes.data || []
            const messages = messagesRes.data || []
            const leads = leadsRes.data || []
            const devis = devisRes.data || []
            const events = eventsRes.data || []

            const termines = dossiers.filter((d: Record<string, unknown>) => d.status === 'termine')
            const enCours = dossiers.filter((d: Record<string, unknown>) => d.status === 'en_cours')
            const nouveaux = dossiers.filter((d: Record<string, unknown>) => d.status === 'nouveau')
            const lus = messages.filter((m: Record<string, unknown>) => m.lu === true)
            const rdvMessages = messages.filter((m: Record<string, unknown>) => m.type === 'rendez-vous')
            const contactes = leads.filter((l: Record<string, unknown>) => l.contacted === true)
            const hot = leads.filter((l: Record<string, unknown>) => (l.eligibility_score as number) >= 70)
            const envoyes = devis.filter((d: Record<string, unknown>) => d.status !== 'brouillon')

            // This month stats
            const thisMonthDossiers = dossiers.filter((d: Record<string, unknown>) => (d.created_at as string) >= firstOfMonth).length
            const thisMonthMessages = messages.filter((m: Record<string, unknown>) => (m.created_at as string) >= firstOfMonth).length
            const thisMonthLeads = leads.filter((l: Record<string, unknown>) => (l.created_at as string) >= firstOfMonth).length

            // Unique clients (by email)
            const uniqueEmails = new Set([
                ...dossiers.map((d: Record<string, unknown>) => d.client_email || d.email),
                ...messages.map((m: Record<string, unknown>) => m.email),
            ].filter(Boolean))

            setPerf({
                totalDossiers: dossiers.length,
                dossiersTermines: termines.length,
                dossiersEnCours: enCours.length,
                dossiersNouveaux: nouveaux.length,
                tauxResolution: dossiers.length > 0 ? Math.round((termines.length / dossiers.length) * 100) : 0,
                messagesTotal: messages.length,
                messagesLus: lus.length,
                messagesRDV: rdvMessages.length,
                leadsTotal: leads.length,
                leadsContactes: contactes.length,
                leadsHot: hot.length,
                devisTotal: devis.length,
                devisEnvoyes: envoyes.length,
                eventsTotal: events.length,
                clientsUniques: uniqueEmails.size,
                thisMonthDossiers,
                thisMonthMessages,
                thisMonthLeads,
            })
            setLoading(false)
        }
        fetchPerf()
    }, [])

    if (loading) {
        return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
    }

    const kpiCards = [
        { label: 'Dossiers Totaux', value: perf.totalDossiers, icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Finalisés', value: perf.dossiersTermines, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
        { label: 'En Cours', value: perf.dossiersEnCours, icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Taux Résolution', value: `${perf.tauxResolution}%`, icon: Target, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        { label: 'Messages Reçus', value: perf.messagesTotal, icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        { label: 'Messages Lus', value: perf.messagesLus, icon: MessageSquare, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
        { label: 'Leads Oracle', value: perf.leadsTotal, icon: Compass, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        { label: 'Leads Hot (≥70%)', value: perf.leadsHot, icon: TrendingUp, color: 'text-red-400', bg: 'bg-red-500/10' },
        { label: 'Leads Contactés', value: perf.leadsContactes, icon: Users, color: 'text-teal-400', bg: 'bg-teal-500/10' },
        { label: 'Devis Créés', value: perf.devisTotal, icon: Briefcase, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        { label: 'Devis Envoyés', value: perf.devisEnvoyes, icon: Briefcase, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Clients Uniques', value: perf.clientsUniques, icon: Users, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    ]

    const progressBars = [
        { label: 'Dossiers finalisés (objectif: 10)', current: perf.dossiersTermines, target: 10, color: 'bg-emerald-500' },
        { label: 'Messages traités (objectif: 50)', current: perf.messagesLus, target: 50, color: 'bg-blue-500' },
        { label: 'Leads contactés (objectif: 20)', current: perf.leadsContactes, target: 20, color: 'bg-amber-500' },
        { label: 'Devis envoyés (objectif: 10)', current: perf.devisEnvoyes, target: 10, color: 'bg-purple-500' },
        { label: 'RDV planifiés (objectif: 15)', current: perf.messagesRDV, target: 15, color: 'bg-cyan-500' },
    ]

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={16} className="text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Analytics Temps Réel</span>
                </div>
                <h1 className="text-2xl font-black text-white">Mes Performances</h1>
                <p className="text-gray-500 text-sm mt-1">Données calculées en temps réel depuis votre base de données</p>
            </div>

            {/* This Month Summary */}
            <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-2xl p-5">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">Ce mois-ci</p>
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Nouveaux dossiers', value: perf.thisMonthDossiers, icon: FileText },
                        { label: 'Messages reçus', value: perf.thisMonthMessages, icon: MessageSquare },
                        { label: 'Nouveaux leads', value: perf.thisMonthLeads, icon: Compass },
                    ].map(item => (
                        <div key={item.label} className="text-center">
                            <item.icon size={18} className="text-emerald-400 mx-auto mb-1" />
                            <p className="text-2xl font-black text-white">{item.value}</p>
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">{item.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {kpiCards.map((card, i) => (
                    <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white/[0.03] border border-white/5 rounded-2xl p-4"
                    >
                        <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                            <card.icon size={16} className={card.color} />
                        </div>
                        <p className="text-2xl font-black text-white">{card.value}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">{card.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Progress Bars */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                <h2 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
                    <BarChart3 size={14} className="text-emerald-400" /> Progression des Objectifs
                </h2>
                <div className="space-y-5">
                    {progressBars.map(obj => {
                        const pct = Math.min((obj.current / obj.target) * 100, 100)
                        return (
                            <div key={obj.label}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-300 font-semibold">{obj.label}</span>
                                    <span className="text-xs text-gray-500 font-bold">{obj.current} / {obj.target} ({Math.round(pct)}%)</span>
                                </div>
                                <div className="w-full h-2.5 rounded-full bg-white/5 overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }} className={`h-full rounded-full ${obj.color}`} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Achievement */}
            <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-6 flex items-center gap-4">
                <Award size={32} className="text-emerald-400 flex-shrink-0" />
                <div>
                    <p className="text-sm font-bold text-white">
                        {perf.tauxResolution >= 80 ? 'Performance Excellente !' :
                            perf.tauxResolution >= 50 ? 'Bonne progression !' :
                                'Continuez vos efforts !'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        Vous avez finalisé {perf.dossiersTermines} dossier(s) sur {perf.totalDossiers}, contacté {perf.leadsContactes} leads, et traité {perf.messagesLus} messages. {perf.eventsTotal} événements planifiés dans votre agenda.
                    </p>
                </div>
            </div>
        </div>
    )
}
