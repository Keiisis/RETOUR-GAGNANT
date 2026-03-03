'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    TrendingUp, FileText, MessageSquare, Clock,
    CheckCircle2, BarChart3, Target, Award,
    Users, Compass, Briefcase, Edit3, X, Save, Star
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

interface Targets {
    dossiers: number
    messages: number
    leads: number
    devis: number
    rdv: number
}

const DEFAULT_TARGETS: Targets = { dossiers: 10, messages: 50, leads: 20, devis: 10, rdv: 15 }

export default function AgentPerformancesPage() {
    const [perf, setPerf] = useState<PerformanceData>({
        totalDossiers: 0, dossiersTermines: 0, dossiersEnCours: 0, dossiersNouveaux: 0,
        tauxResolution: 0, messagesTotal: 0, messagesLus: 0, messagesRDV: 0,
        leadsTotal: 0, leadsContactes: 0, leadsHot: 0,
        devisTotal: 0, devisEnvoyes: 0, eventsTotal: 0,
        clientsUniques: 0, thisMonthDossiers: 0, thisMonthMessages: 0, thisMonthLeads: 0,
    })
    const [loading, setLoading] = useState(true)
    const [targets, setTargets] = useState<Targets>(DEFAULT_TARGETS)
    const [showEditTargets, setShowEditTargets] = useState(false)
    const [tempTargets, setTempTargets] = useState<Targets>(DEFAULT_TARGETS)

    // Load saved targets from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('agent_perf_targets')
            if (saved) {
                const parsed = JSON.parse(saved)
                setTargets(parsed)
                setTempTargets(parsed)
            }
        } catch { /* ignore */ }
    }, [])

    const saveTargets = () => {
        setTargets(tempTargets)
        try { localStorage.setItem('agent_perf_targets', JSON.stringify(tempTargets)) } catch { /* ignore */ }
        setShowEditTargets(false)
    }

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

            const termines = dossiers.filter((d: Record<string, unknown>) => d.statut === 'termine')
            const enCours = dossiers.filter((d: Record<string, unknown>) => ['traitement', 'validation', 'finalisation'].includes(d.statut as string))
            const lus = messages.filter((m: Record<string, unknown>) => m.lu === true)
            const rdvMessages = messages.filter((m: Record<string, unknown>) => m.type === 'rendez-vous')
            const contactes = leads.filter((l: Record<string, unknown>) => l.contacted === true)
            const hot = leads.filter((l: Record<string, unknown>) => (l.eligibility_score as number) >= 70)
            const envoyes = devis.filter((d: Record<string, unknown>) => d.status !== 'brouillon')

            const thisMonthDossiers = dossiers.filter((d: Record<string, unknown>) => (d.created_at as string) >= firstOfMonth).length
            const thisMonthMessages = messages.filter((m: Record<string, unknown>) => (m.created_at as string) >= firstOfMonth).length
            const thisMonthLeads = leads.filter((l: Record<string, unknown>) => (l.created_at as string) >= firstOfMonth).length

            const uniqueEmails = new Set([
                ...dossiers.map((d: Record<string, unknown>) => d.client_email || d.email),
                ...messages.map((m: Record<string, unknown>) => m.email),
            ].filter(Boolean))

            setPerf({
                totalDossiers: dossiers.length,
                dossiersTermines: termines.length,
                dossiersEnCours: enCours.length,
                dossiersNouveaux: dossiers.filter((d: Record<string, unknown>) => d.statut === 'reception').length,
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
        { label: 'Leads Hot ≥70%', value: perf.leadsHot, icon: TrendingUp, color: 'text-red-400', bg: 'bg-red-500/10' },
        { label: 'Leads Contactés', value: perf.leadsContactes, icon: Users, color: 'text-teal-400', bg: 'bg-teal-500/10' },
        { label: 'Devis Créés', value: perf.devisTotal, icon: Briefcase, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        { label: 'Devis Envoyés', value: perf.devisEnvoyes, icon: Briefcase, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Clients Uniques', value: perf.clientsUniques, icon: Users, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    ]

    const progressItems = [
        { key: 'dossiers' as keyof Targets, label: 'Dossiers finalisés', current: perf.dossiersTermines, color: 'bg-emerald-500', glowColor: 'shadow-emerald-500/30' },
        { key: 'messages' as keyof Targets, label: 'Messages traités', current: perf.messagesLus, color: 'bg-blue-500', glowColor: 'shadow-blue-500/30' },
        { key: 'leads' as keyof Targets, label: 'Leads contactés', current: perf.leadsContactes, color: 'bg-amber-500', glowColor: 'shadow-amber-500/30' },
        { key: 'devis' as keyof Targets, label: 'Devis envoyés', current: perf.devisEnvoyes, color: 'bg-purple-500', glowColor: 'shadow-purple-500/30' },
        { key: 'rdv' as keyof Targets, label: 'RDV planifiés', current: perf.messagesRDV, color: 'bg-cyan-500', glowColor: 'shadow-cyan-500/30' },
    ]

    const targetFields = [
        { key: 'dossiers' as keyof Targets, label: 'Dossiers finalisés', color: 'text-emerald-400' },
        { key: 'messages' as keyof Targets, label: 'Messages traités', color: 'text-blue-400' },
        { key: 'leads' as keyof Targets, label: 'Leads contactés', color: 'text-amber-400' },
        { key: 'devis' as keyof Targets, label: 'Devis envoyés', color: 'text-purple-400' },
        { key: 'rdv' as keyof Targets, label: 'RDV planifiés', color: 'text-cyan-400' },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={16} className="text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Analytics Temps Réel</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Mes Performances</h1>
                    <p className="text-gray-500 text-sm mt-1">Données calculées en temps réel depuis la base de données</p>
                </div>
                <button
                    type="button"
                    onClick={() => { setTempTargets(targets); setShowEditTargets(true) }}
                    className="flex items-center gap-2 bg-white/5 text-gray-400 border border-white/10 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-white/10 hover:text-white transition-all"
                >
                    <Edit3 size={14} /> Objectifs
                </button>
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
                        transition={{ delay: i * 0.04 }}
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
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <BarChart3 size={14} className="text-emerald-400" /> Progression des Objectifs
                    </h2>
                    <button
                        type="button"
                        onClick={() => { setTempTargets(targets); setShowEditTargets(true) }}
                        className="text-[10px] text-gray-500 hover:text-emerald-400 flex items-center gap-1 transition-colors font-bold"
                    >
                        <Edit3 size={11} /> Modifier les objectifs
                    </button>
                </div>
                <div className="space-y-5">
                    {progressItems.map(obj => {
                        const target = targets[obj.key]
                        const pct = target > 0 ? (obj.current / target) * 100 : 0
                        const displayPct = Math.round(pct)
                        const isExceeded = pct >= 100
                        const barWidth = Math.min(pct, 100)

                        return (
                            <div key={obj.key}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-300 font-semibold">{obj.label}</span>
                                    <div className="flex items-center gap-2">
                                        {isExceeded && (
                                            <span className="flex items-center gap-1 text-[9px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                <Star size={8} /> Objectif atteint !
                                            </span>
                                        )}
                                        <span className={`text-xs font-bold ${isExceeded ? 'text-emerald-400' : 'text-gray-500'}`}>
                                            {obj.current} / {target} ({displayPct}%)
                                        </span>
                                    </div>
                                </div>
                                <div className="w-full h-2.5 rounded-full bg-white/5 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${barWidth}%` }}
                                        transition={{ duration: 1, ease: 'easeOut' }}
                                        className={`h-full rounded-full ${isExceeded ? 'bg-emerald-400' : obj.color}`}
                                    />
                                </div>
                                {isExceeded && (
                                    <p className="text-[9px] text-emerald-500/60 mt-1 font-bold">
                                        +{obj.current - target} au-delà de l&apos;objectif
                                    </p>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Achievement Banner */}
            <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-6 flex items-center gap-4">
                <Award size={32} className="text-emerald-400 flex-shrink-0" />
                <div>
                    <p className="text-sm font-bold text-white">
                        {perf.tauxResolution >= 80 ? 'Performance Excellente !' :
                            perf.tauxResolution >= 50 ? 'Bonne progression !' :
                                'Continuez vos efforts !'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        Vous avez finalisé {perf.dossiersTermines} dossier(s) sur {perf.totalDossiers},
                        contacté {perf.leadsContactes} lead(s), traité {perf.messagesLus} message(s),
                        et planifié {perf.eventsTotal} événement(s) dans l&apos;agenda.
                    </p>
                </div>
            </div>

            {/* Edit Targets Modal */}
            <AnimatePresence>
                {showEditTargets && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                        onClick={() => setShowEditTargets(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-[#0a0f14] border border-white/10 rounded-2xl p-6 w-full max-w-md"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold text-white">Modifier les Objectifs</h3>
                                <button type="button" onClick={() => setShowEditTargets(false)} className="text-gray-500 hover:text-white" title="Fermer"><X size={18} /></button>
                            </div>
                            <p className="text-xs text-gray-500 mb-5">
                                Définissez vos propres objectifs sans limite. Sauvegardés localement dans votre navigateur.
                            </p>
                            <div className="space-y-4">
                                {targetFields.map(item => (
                                    <div key={item.key} className="flex items-center justify-between gap-4">
                                        <label className={`text-sm font-semibold ${item.color} flex-1`}>{item.label}</label>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setTempTargets(prev => ({ ...prev, [item.key]: Math.max(1, prev[item.key] - 5) }))}
                                                className="w-7 h-7 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center text-sm font-bold transition-colors"
                                            >−</button>
                                            <input
                                                type="number"
                                                min="1"
                                                title={item.label}
                                                placeholder={String(tempTargets[item.key])}
                                                value={tempTargets[item.key]}
                                                onChange={e => setTempTargets(prev => ({ ...prev, [item.key]: Math.max(1, parseInt(e.target.value) || 1) }))}
                                                className="w-20 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm text-center focus:outline-none focus:border-emerald-500/50"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setTempTargets(prev => ({ ...prev, [item.key]: prev[item.key] + 5 }))}
                                                className="w-7 h-7 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center text-sm font-bold transition-colors"
                                            >+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setShowEditTargets(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-bold">Annuler</button>
                                <button type="button" onClick={saveTargets} className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-500/30 transition-all">
                                    <Save size={14} /> Sauvegarder
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
