'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    TrendingUp, FileText, MessageSquare, Clock,
    CheckCircle2, BarChart3, Target, Award
} from 'lucide-react'

export default function AgentPerformancesPage() {
    const [stats, setStats] = useState({
        totalDossiers: 0,
        dossiersTermines: 0,
        tauxResolution: 0,
        messagesRepondus: 0,
        tempsReponseMoyen: '< 2h',
        leadsConverts: 0,
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPerf = async () => {
            const { data: dossiers } = await supabase.from('dossier_tracking').select('*')
            const all = dossiers || []
            const termines = all.filter((d) => d.status === 'termine')

            const { count: msgCount } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('lu', true)

            setStats({
                totalDossiers: all.length,
                dossiersTermines: termines.length,
                tauxResolution: all.length > 0 ? Math.round((termines.length / all.length) * 100) : 0,
                messagesRepondus: msgCount || 0,
                tempsReponseMoyen: '< 2h',
                leadsConverts: termines.length,
            })
            setLoading(false)
        }
        fetchPerf()
    }, [])

    const perfCards = [
        { label: 'Dossiers Finalisés', value: stats.dossiersTermines, total: `/ ${stats.totalDossiers}`, icon: CheckCircle2, color: 'text-emerald-400' },
        { label: 'Taux de Résolution', value: `${stats.tauxResolution}%`, total: '', icon: Target, color: 'text-amber-400' },
        { label: 'Messages Traités', value: stats.messagesRepondus, total: '', icon: MessageSquare, color: 'text-blue-400' },
        { label: 'Temps de Réponse', value: stats.tempsReponseMoyen, total: 'objectif', icon: Clock, color: 'text-purple-400' },
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={16} className="text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Analytics</span>
                </div>
                <h1 className="text-2xl font-black text-white">Mes Performances</h1>
                <p className="text-gray-500 text-sm mt-1">Suivi de votre productivité et de vos objectifs</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {perfCards.map((card, i) => (
                    <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white/[0.03] border border-white/5 rounded-2xl p-5"
                    >
                        <card.icon size={20} className={`${card.color} mb-3`} />
                        <div className="flex items-end gap-2">
                            <p className="text-3xl font-black text-white">{card.value}</p>
                            {card.total && <span className="text-xs text-gray-500 mb-1">{card.total}</span>}
                        </div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">{card.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Progress Bars */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                <h2 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
                    <BarChart3 size={14} className="text-emerald-400" /> Progression des Objectifs
                </h2>

                <div className="space-y-5">
                    {[
                        { label: 'Dossiers finalisés ce mois', current: stats.dossiersTermines, target: 10, color: 'bg-emerald-500' },
                        { label: 'Messages traités', current: stats.messagesRepondus, target: 50, color: 'bg-blue-500' },
                        { label: 'Leads convertis', current: stats.leadsConverts, target: 5, color: 'bg-amber-500' },
                    ].map((obj) => (
                        <div key={obj.label}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-300 font-semibold">{obj.label}</span>
                                <span className="text-xs text-gray-500 font-bold">{obj.current} / {obj.target}</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min((obj.current / obj.target) * 100, 100)}%` }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                    className={`h-full rounded-full ${obj.color}`}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Achievement */}
            <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-6 flex items-center gap-4">
                <Award size={32} className="text-emerald-400 flex-shrink-0" />
                <div>
                    <p className="text-sm font-bold text-white">Continuez comme ça !</p>
                    <p className="text-xs text-gray-400 mt-1">
                        Vous avez finalisé {stats.dossiersTermines} dossier(s). Chaque dossier finalisé rapproche un client de son rêve béninois. 🇧🇯
                    </p>
                </div>
            </div>
        </div>
    )
}
