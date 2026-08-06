'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { ChartBar as BarChart3, TrendUp as TrendingUp, Users, ChatText as MessageSquare, Globe as Globe2, Calendar, ArrowUpRight, ArrowDownRight, FileText, Sparkle as Sparkles, Envelope as Mail, Target } from '@phosphor-icons/react';

const formatDate = (val: string | null | undefined) => {
    if (!val) return '—'
    const d = new Date(val)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR')
}

interface Lead {
    id: number
    client_nom: string
    client_prenom: string
    eligibility_score: number
    recommended_service: string
    is_contacted?: boolean
    contacted?: boolean
    created_at: string
}

interface Stats {
    totalLeads: number
    totalMessages: number
    totalOrders: number
    totalBlogViews: number
    leadsByMonth: { month: string, count: number }[]
    serviceDistribution: { service: string, count: number }[]
    conversionRate: number
    contactedRate: number
    avgScore: number
    recentLeads: Lead[]
    emailsSent: number
}

interface StatCardProps {
    icon: React.ComponentType<{ size?: number; className?: string }>
    label: string
    value: string | number
    trend?: number
    color: string
}

export default function AdminAnalyticsPage() {
    const [stats, setStats] = useState<Stats>({
        totalLeads: 0, totalMessages: 0, totalOrders: 0, totalBlogViews: 0,
        leadsByMonth: [], serviceDistribution: [], conversionRate: 0,
        contactedRate: 0, avgScore: 0, recentLeads: [], emailsSent: 0
    })
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true)

            const now = new Date()
            let fromDate: string | null = null
            if (period === '7d') fromDate = new Date(now.getTime() - 7 * 86400000).toISOString()
            else if (period === '30d') fromDate = new Date(now.getTime() - 30 * 86400000).toISOString()
            else if (period === '90d') fromDate = new Date(now.getTime() - 90 * 86400000).toISOString()

            // Parallel queries
            let leadsQuery = supabase.from('eligibility_results').select('*')
            let messagesQuery = supabase.from('messages').select('id', { count: 'exact', head: true })
            const blogQuery = supabase.from('blog_posts').select('views')

            if (fromDate) {
                leadsQuery = leadsQuery.gte('created_at', fromDate)
                messagesQuery = messagesQuery.gte('created_at', fromDate)
            }

            const [leadsRes, messagesRes, blogRes] = await Promise.all([
                leadsQuery.order('created_at', { ascending: false }),
                messagesQuery,
                blogQuery,
            ])

            const leads = leadsRes.data || []
            const totalMessages = messagesRes.count || 0
            const totalBlogViews = (blogRes.data || []).reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.views) || 0), 0)

            // Compute stats
            const contacted = leads.filter((l) => l.is_contacted || l.contacted).length
            const avgScore = leads.length > 0
                ? Math.round(leads.reduce((s: number, l) => s + (l.eligibility_score || 0), 0) / leads.length)
                : 0

            // Service distribution
            const serviceCounts: Record<string, number> = {}
            leads.forEach((l) => {
                const s = l.recommended_service || 'Autre'
                serviceCounts[s] = (serviceCounts[s] || 0) + 1
            })
            const serviceDistribution = Object.entries(serviceCounts)
                .map(([service, count]) => ({ service, count }))
                .sort((a, b) => b.count - a.count)

            // Leads by month
            const monthCounts: Record<string, number> = {}
            leads.forEach((l) => {
                const d = new Date(l.created_at)
                if (!isNaN(d.getTime())) {
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                    monthCounts[key] = (monthCounts[key] || 0) + 1
                }
            })
            const leadsByMonth = Object.entries(monthCounts)
                .map(([month, count]) => ({ month, count }))
                .sort((a, b) => a.month.localeCompare(b.month))
                .slice(-6)

            // Email count
            let emailsSent = 0
            try {
                const emailRes = await supabase.from('email_logs').select('id', { count: 'exact', head: true }).eq('status', 'sent')
                emailsSent = emailRes.count || 0
            } catch { }

            setStats({
                totalLeads: leads.length,
                totalMessages,
                totalOrders: 0,
                totalBlogViews,
                leadsByMonth,
                serviceDistribution,
                conversionRate: leads.length > 0 ? Math.round((contacted / leads.length) * 100) : 0,
                contactedRate: contacted,
                avgScore,
                recentLeads: leads.slice(0, 5),
                emailsSent,
            })
            setLoading(false)
        }
        fetchStats()
    }, [period])



    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0f14] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        )
    }

    const maxLeads = Math.max(...stats.leadsByMonth.map(m => m.count), 1)

    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                    <div>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]"><T>Dashboard</T></span>
                        <h1 className="text-2xl font-black text-white flex items-center gap-2">
                            <BarChart3 size={24} className="text-emerald-400" /> Analytics
                        </h1>
                    </div>
                    <div className="flex gap-2">
                        {(['7d', '30d', '90d', 'all'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${period === p ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                            >
                                {p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : p === '90d' ? '3 mois' : 'Tout'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    <StatCard icon={Users} label="Leads Oracle" value={stats.totalLeads} color="bg-blue-500/20 text-blue-400" />
                    <StatCard icon={MessageSquare} label="Messages" value={stats.totalMessages} color="bg-purple-500/20 text-purple-400" />
                    <StatCard icon={Target} label="Taux Contact" value={`${stats.conversionRate}%`} color="bg-emerald-500/20 text-emerald-400" />
                    <StatCard icon={Sparkles} label="Score Moyen" value={`${stats.avgScore}%`} color="bg-yellow-500/20 text-yellow-400" />
                    <StatCard icon={Mail} label="Emails Envoyés" value={stats.emailsSent} color="bg-cyan-500/20 text-cyan-400" />
                    <StatCard icon={FileText} label="Vues Blog" value={stats.totalBlogViews} color="bg-pink-500/20 text-pink-400" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Leads by Month Chart */}
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                            <TrendingUp size={14} className="text-emerald-400" /> Leads par Mois
                        </h3>
                        <div className="flex items-end gap-3 h-40">
                            {stats.leadsByMonth.length === 0 ? (
                                <p className="text-xs text-gray-500 m-auto"><T>Pas encore de données</T></p>
                            ) : stats.leadsByMonth.map((m, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                    <span className="text-[10px] font-bold text-emerald-400">{m.count}</span>
                                    <div
                                        className="w-full bg-gradient-to-t from-emerald-500/40 to-emerald-500/80 rounded-t-lg transition-all h-[var(--bar-h)] min-h-[8px]"
                                        style={{ '--bar-h': `${(m.count / maxLeads) * 100}%` } as React.CSSProperties}
                                    />
                                    <span className="text-[9px] text-gray-600">{m.month.split('-')[1]}/{m.month.split('-')[0].slice(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Service Distribution */}
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                            <Globe2 size={14} className="text-yellow-400" /> Répartition par Service
                        </h3>
                        <div className="space-y-3">
                            {stats.serviceDistribution.length === 0 ? (
                                <p className="text-xs text-gray-500"><T>Pas encore de données</T></p>
                            ) : stats.serviceDistribution.map((s, i) => {
                                const pct = stats.totalLeads > 0 ? Math.round((s.count / stats.totalLeads) * 100) : 0
                                const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-cyan-500']
                                return (
                                    <div key={i}>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="text-gray-300 font-medium">{s.service}</span>
                                            <span className="text-gray-500">{s.count} ({pct}%)</span>
                                        </div>
                                        <div className="w-full h-2 bg-white/5 rounded-full">
                                            <div className={`h-2 rounded-full ${colors[i % colors.length]} transition-all w-[var(--p-w)]`} style={{ '--p-w': `${pct}%` } as React.CSSProperties} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Recent Leads */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Calendar size={14} className="text-blue-400" /> Leads Récents
                    </h3>
                    <div className="space-y-2">
                        {stats.recentLeads.map((lead, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${lead.eligibility_score >= 80 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                        {lead.eligibility_score}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-white">{lead.client_prenom} {lead.client_nom}</p>
                                        <p className="text-[10px] text-gray-500">{lead.recommended_service}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lead.is_contacted || lead.contacted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                        {lead.is_contacted || lead.contacted ? 'Contacté' : 'En attente'}
                                    </span>
                                    <p className="text-[10px] text-gray-600 mt-1">{formatDate(lead.created_at)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatCard({ icon: Icon, label, value, trend, color }: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all"
        >
            <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon size={18} />
                </div>
                {trend !== undefined && (
                    <span className={`text-[10px] font-bold flex items-center gap-0.5 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trend >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {Math.abs(trend)}%
                    </span>
                )}
            </div>
            <p className="text-2xl font-black text-white">{value}</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">{label}</p>
        </motion.div>
    )
}
