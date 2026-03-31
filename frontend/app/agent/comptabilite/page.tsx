'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { 
    Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Download, Activity, CheckCircle2,
    BarChart3, Landmark, ArrowRight, FileText, X, TrendingDown, Zap, MessageCircle, 
    RefreshCw, Plus, AlertTriangle
} from 'lucide-react'
import { useTranslation } from '@/lib/translation'
import { exportToExcel } from '@/lib/exportExcel'
import { 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    AreaChart, Area
} from 'recharts'

interface DocumentFinancier {
    id: string
    type: 'devis' | 'facture'
    numero: string
    client_nom: string
    client_prenom: string
    client_phone?: string
    client_email?: string
    total: number
    status: string
    created_at: string
}

interface Depense {
    id: string
    titre: string
    categorie: string
    montant: number
    date_depense: string
}

// Taux de commission par défaut supprimé (sera récupéré en BDD)

// ── Helpers de Périodes ──────────────────────────────────────────
type Period = 'ce_mois' | '3_mois' | 'tous'

function getPeriodRange(period: Period): { start: Date; end: Date } {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    switch (period) {
        case 'ce_mois':
            return { start: new Date(now.getFullYear(), now.getMonth(), 1), end }
        case '3_mois':
            return { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), end }
        default:
            return { start: new Date(0), end }
    }
}

function getPreviousPeriodRange(period: Period): { start: Date; end: Date } {
    const now = new Date()
    if (period === 'ce_mois') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
        return { start, end }
    } else if (period === '3_mois') {
        const start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        const end = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        return { start, end }
    }
    return { start: new Date(0), end: new Date(0) }
}

function calcTrend(current: number, previous: number): string | null {
    if (previous === 0) return current > 0 ? '+100' : '0'
    const pct = ((current - previous) / previous) * 100
    return (pct >= 0 ? '+' : '') + pct.toFixed(1)
}

export default function AgentComptabilitePage() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [allDocs, setAllDocs] = useState<DocumentFinancier[]>([])
    const [expenses, setExpenses] = useState<Depense[]>([])
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('ce_mois')
    const [showRelancesOnly, setShowRelancesOnly] = useState(false)
    const [showExpenseModal, setShowExpenseModal] = useState(false)
    const [newExpense, setNewExpense] = useState({ titre: '', categorie: 'operationnel', montant: '' })
    const [savingExpense, setSavingExpense] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 8

    const [commissionRate, setCommissionRate] = useState(0.10)

    const fetchAllData = async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Fetch Documents
        const { data: docs } = await supabase
            .from('documents_financiers')
            .select('*')
            .eq('agent_id', user.id)
            .order('created_at', { ascending: false })

        // Fetch Expenses
        const { data: exp } = await supabase
            .from('depenses')
            .select('*')
            .eq('agent_id', user.id)
            .order('date_depense', { ascending: false })

        // Fetch Settings
        const { data: settings } = await supabase
            .from('system_settings')
            .select('*')
            .eq('id', 'comptabilite_erp')
            .single()

        if (settings?.value?.commission_rate) {
            setCommissionRate(settings.value.commission_rate)
        }

        if (docs) setAllDocs(docs)
        if (exp) setExpenses(exp)
        setLoading(false)
    }

    useEffect(() => {
        const init = async () => {
            await fetchAllData()
        }
        init()
    }, [])

    // ── Données Calculées ───────────────────────────────────────────
    const { start: pStart, end: pEnd } = useMemo(() => getPeriodRange(selectedPeriod), [selectedPeriod])
    const { start: prevStart, end: prevEnd } = useMemo(() => getPreviousPeriodRange(selectedPeriod), [selectedPeriod])

    const periodDocs = useMemo(() => 
        allDocs.filter(d => {
            const date = new Date(d.created_at)
            return date >= pStart && date <= pEnd
        }), [allDocs, pStart, pEnd])

    const prevDocs = useMemo(() => 
        allDocs.filter(d => {
            const date = new Date(d.created_at)
            return date >= prevStart && date <= prevEnd
        }), [allDocs, prevStart, prevEnd])

    const stats = useMemo(() => {
        const getStats = (list: DocumentFinancier[], expList: Depense[]) => {
            const invoices = list.filter(d => d.type === 'facture')
            const encaisse = invoices.filter(d => d.status === 'paye').reduce((acc, d) => acc + d.total, 0)
            const facture = invoices.reduce((acc, d) => acc + d.total, 0)
            const attente = invoices.filter(d => d.status === 'envoye' || d.status === 'accepte').reduce((acc, d) => acc + d.total, 0)
            const totalDepenses = expList.reduce((acc, e) => acc + Number(e.montant), 0)
            const beneficeNet = encaisse - totalDepenses
            return { 
                encaisse, facture, attente, 
                commission: Math.round(encaisse * commissionRate),
                depenses: totalDepenses,
                beneficeNet
            }
        }

        const curr = getStats(periodDocs, expenses.filter(e => {
            const date = new Date(e.date_depense)
            return date >= pStart && date <= pEnd
        }))
        const prev = getStats(prevDocs, expenses.filter(e => {
            const date = new Date(e.date_depense)
            return date >= prevStart && date <= prevEnd
        }))

        // Predictive Logic
        const daysInPeriod = Math.max(1, (pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24))
        const dailyAvg = curr.encaisse / daysInPeriod
        const projection30j = dailyAvg * 30

        return {
            ...curr,
            projection30j,
            trends: {
                encaisse: selectedPeriod === 'tous' ? null : calcTrend(curr.encaisse, prev.encaisse),
                facture: selectedPeriod === 'tous' ? null : calcTrend(curr.facture, prev.facture),
                attente: selectedPeriod === 'tous' ? null : calcTrend(curr.attente, prev.attente),
                commission: selectedPeriod === 'tous' ? null : calcTrend(curr.commission, prev.commission),
                benefice: selectedPeriod === 'tous' ? null : calcTrend(curr.beneficeNet, prev.beneficeNet)
            }
        }
    }, [periodDocs, prevDocs, expenses, selectedPeriod, pStart, pEnd, prevStart, prevEnd, commissionRate])

    // Data for Recharts
    const chartData = useMemo(() => {
        const days: Record<string, number> = {}
        periodDocs.filter(d => d.status === 'paye').forEach(d => {
            const day = new Date(d.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
            days[day] = (days[day] || 0) + d.total
        })
        return Object.entries(days).map(([name, total]) => ({ name, total })).reverse()
    }, [periodDocs])

    const displayedDocs = useMemo(() => {
        let docs = periodDocs
        if (showRelancesOnly) {
            docs = docs.filter(d => d.status === 'envoye' || d.status === 'accepte')
        }
        return docs
    }, [periodDocs, showRelancesOnly])

    const totalPages = Math.max(1, Math.ceil(displayedDocs.length / ITEMS_PER_PAGE))
    const paginatedDocs = useMemo(() => 
        displayedDocs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
        [displayedDocs, currentPage])

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('fr-BJ', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(val)
    }

    const handleWhatsAppReminder = (doc: DocumentFinancier) => {
        const message = `Bonjour ${doc.client_nom},\n\nC'est l'agence Retour Gagnant Bénin. Nous vous relançons concernant le document ${doc.numero} d'un montant de ${formatCurrency(doc.total)}.\n\nVous pouvez le consulter et le régler ici : ${window.location.origin}/portail/${doc.id}\n\nCordialement.`
        const encoded = encodeURIComponent(message)
        const phone = doc.client_phone?.replace(/\s+/g, '')
        window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank')
    }

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault()
        setSavingExpense(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('depenses').insert({
            agent_id: user.id,
            titre: newExpense.titre,
            categorie: newExpense.categorie,
            montant: Number(newExpense.montant),
            date_depense: new Date().toISOString()
        })

        if (!error) {
            setShowExpenseModal(false)
            setNewExpense({ titre: '', categorie: 'operationnel', montant: '' })
            fetchAllData()
        }
        setSavingExpense(false)
    }

    const handleExport = async () => {
        const statusLabels: Record<string, string> = {
            brouillon: 'Brouillon', envoye: 'Envoyé', accepte: 'Accepté',
            refuse: 'Refusé', paye: 'Payé', en_retard: 'En retard', annule: 'Annulé'
        }

        const columns = [
            { header: 'N° Document', key: 'numero', width: 22 },
            { header: 'Type', key: 'type', width: 12, type: 'status' as const },
            { header: 'Client', key: 'client', width: 30 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Téléphone', key: 'phone', width: 18 },
            { header: 'Montant (XOF)', key: 'total', width: 20, type: 'currency' as const },
            { header: 'Statut', key: 'status', width: 16, type: 'status' as const },
            { header: 'Date', key: 'created_at', width: 18, type: 'date' as const },
        ]

        const exportData = displayedDocs.map(d => ({
            numero: d.numero,
            type: d.type === 'facture' ? 'Facture' : 'Devis',
            client: `${d.client_nom} ${d.client_prenom}`.trim(),
            email: d.client_email || '',
            phone: d.client_phone || '',
            total: d.total,
            status: statusLabels[d.status] || d.status,
            created_at: new Date(d.created_at),
        }))

        const periodLabel = selectedPeriod === 'ce_mois' ? 'Ce Mois' : selectedPeriod === '3_mois' ? '3 Derniers Mois' : 'Global'

        await exportToExcel({
            filename: `RG_Tresorerie_${periodLabel.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}`,
            sheetName: 'Trésorerie',
            title: 'RAPPORT DE TRÉSORERIE — RETOUR GAGNANT BÉNIN',
            subtitle: `Période : ${periodLabel} — Généré le ${new Date().toLocaleDateString('fr-FR')} — Confidentiel`,
            columns,
            data: exportData,
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#060a10]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Chargement trésorerie...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-1.5 text-emerald-400">
                        <Landmark size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Trésorerie Réelle</span>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Espace <span className="text-emerald-400">Financier</span></h1>
                    <p className="text-nexus-text-muted text-sm mt-1">Plateforme de gestion analytique.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
                        {['ce_mois', '3_mois', 'tous'].map((p) => (
                            <button
                                key={p}
                                title={`Filtrer par ${p.replace('_', ' ')}`}
                                onClick={() => { setSelectedPeriod(p as Period); setCurrentPage(1); }}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                    selectedPeriod === p ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                {p === 'ce_mois' ? 'Ce mois' : p === '3_mois' ? '3 mois' : 'Global'}
                            </button>
                        ))}
                    </div>

                    <button 
                        onClick={() => fetchAllData()}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-emerald-400 transition-all"
                        title="Actualiser les données"
                    >
                        <RefreshCw size={18} />
                    </button>
                    
                    <button 
                        title={showRelancesOnly ? "Afficher tout" : "Afficher relances"}
                        onClick={() => { setShowRelancesOnly(!showRelancesOnly); setCurrentPage(1); }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                            showRelancesOnly 
                                ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' 
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                        }`}
                    >
                        <AlertTriangle size={18} />
                        <span className="text-xs font-bold font-primary">Relances</span>
                    </button>

                    <button title="Exporter en CSV" onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all hover:bg-emerald-500/10">
                        <Download size={18} />
                        <span className="text-xs font-bold">Export</span>
                    </button>

                    <button 
                        onClick={() => setShowExpenseModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/30 transition-all font-bold"
                    >
                        <Plus size={18} />
                        <span className="text-xs">Dépense</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Encaissé Réel', value: stats.encaisse, icon: Wallet, color: 'emerald', trend: stats.trends.encaisse },
                    { label: 'Bénéfice Net', value: stats.beneficeNet, icon: TrendingUp, color: 'sky', trend: stats.trends.benefice },
                    { label: 'Mes Dépenses', value: stats.depenses, icon: TrendingDown, color: 'rose', trend: null },
                    { label: 'Mes Commissions', value: stats.commission, icon: Zap, color: 'purple', trend: stats.trends.commission, isCommission: true },
                ].map((s, i) => (
                    <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-nexus-card p-6 group hover:shadow-[0_0_30px_rgba(16,185,129,0.05)] transition-all"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-10 h-10 rounded-xl bg-${s.color}-500/10 flex items-center justify-center`}>
                                <s.icon size={20} className={`text-${s.color}-400`} />
                            </div>
                            {s.trend && (
                                <div className={`flex items-center gap-1 text-[10px] font-bold ${s.trend.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {s.trend.startsWith('+') ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                    {s.trend}%
                                </div>
                            )}
                        </div>
                        <p className="text-2xl font-black text-white mb-1 font-mono tracking-tighter">{formatCurrency(s.value)}</p>
                        <p className="text-[10px] text-nexus-text-muted font-bold uppercase tracking-widest">{s.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Performance Graphs (RECHARTS) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-nexus-card p-6 min-h-[350px]">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <Activity size={16} className="text-emerald-400" /> Flux de Revenus
                            </h3>
                            <p className="text-[10px] text-gray-500 mt-1 font-bold">Ventes encaissées sur la période sélectionnée</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-400 font-bold">Projection 30j</p>
                            <p className="text-lg font-black text-emerald-400 font-mono tracking-tighter">~ {formatCurrency(stats.projection30j)}</p>
                        </div>
                    </div>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="name" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0c1420', border: '1px solid #ffffff10', borderRadius: '12px' }}
                                    itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                                />
                                <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-nexus-card p-6 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 flex items-center justify-center relative">
                        <TrendingUp size={32} className="text-emerald-400" />
                        <div className="absolute inset-0 animate-pulse bg-emerald-500/10 rounded-full" />
                    </div>
                    <div>
                        <h4 className="text-white font-black text-xl">Score Prédictif</h4>
                        <p className="text-gray-500 text-xs mt-2 px-4 leading-relaxed">
                            Basé sur vos {periodDocs.length} derniers documents, votre croissance estimée est de <span className="text-emerald-400 font-bold">{stats.trends.encaisse || '0'}%</span>.
                        </p>
                    </div>
                    <div className="w-full pt-4 space-y-2">
                        <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            <span>Santé Financière</span>
                            <span className="text-emerald-400">Stable</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: '85%' }} className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 glass-nexus-card overflow-hidden">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                        <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
                            <BarChart3 size={16} className="text-emerald-400" /> Journal - Page {currentPage}/{totalPages}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                    <th className="py-4 px-6">Document</th>
                                    <th className="py-4 px-6">Client</th>
                                    <th className="py-4 px-6 text-right">Montant</th>
                                    <th className="py-4 px-6 text-center">État</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {paginatedDocs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-16 text-center text-gray-500 italic text-sm">
                                            Aucun document trouvé pour cette sélection.
                                        </td>
                                    </tr>
                                ) : paginatedDocs.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <FileText size={15} className="text-emerald-400" />
                                                <div>
                                                    <p className="text-sm font-bold text-white">{tx.numero}</p>
                                                    <p className="text-[9px] text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-gray-300">{tx.client_nom} {tx.client_prenom}</td>
                                        <td className="py-4 px-6 text-right font-mono text-sm font-bold">{formatCurrency(tx.total)}</td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase border ${
                                                    tx.status === 'paye' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                    tx.status === 'envoye' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    tx.status === 'accepte' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                    'bg-gray-500/10 text-gray-400 border-white/10'
                                                }`}>
                                                    {tx.status}
                                                </span>
                                                {(tx.status === 'envoye' || tx.status === 'accepte') && (
                                                    <button 
                                                        onClick={() => handleWhatsAppReminder(tx)}
                                                        className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all"
                                                        title="Envoyer une relance WhatsApp"
                                                    >
                                                        <MessageCircle size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 border-t border-white/5 flex justify-center gap-2">
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentPage(i + 1)}
                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1 ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:text-white'}`}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="glass-nexus-card p-6">
                        <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                             Répartition de l&apos;activité
                        </h3>
                        <div className="space-y-5">
                            {[
                                { label: 'Collecté', val: stats.encaisse, color: 'bg-emerald-500' },
                                { label: 'Signature en cours', val: stats.attente, color: 'bg-amber-500' },
                                { label: 'Autres', val: Math.max(0, stats.facture - stats.encaisse - stats.attente), color: 'bg-gray-500' },
                            ].map((item) => {
                                const pct = stats.facture > 0 ? (item.val / stats.facture) * 100 : 0
                                return (
                                    <div key={item.label}>
                                        <div className="flex justify-between text-[10px] font-bold uppercase mb-1.5">
                                            <span className="text-gray-500">{item.label}</span>
                                            <span className="text-white">{Math.round(pct)}%</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className={`h-full ${item.color}`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-8 opacity-10 blur-xl bg-white w-20 h-20 rounded-full" />
                        <CheckCircle2 size={24} className="mb-4 relative z-10" />
                        <h4 className="text-lg font-black mb-2 relative z-10">Conseil de Trésorerie</h4>
                        <p className="text-white/80 text-xs leading-relaxed relative z-10">
                            {stats.attente > 0 
                                ? `Vous avez ${formatCurrency(stats.attente)} qui dorment. Relancez vos clients pour débloquer vos commissions !`
                                : "Excellent travail ! Votre trésorerie est parfaitement convertie."}
                        </p>
                        <button 
                            onClick={() => window.location.href='/agent/devis'}
                            className="mt-6 w-full py-2.5 bg-white text-emerald-800 font-bold rounded-xl text-xs hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 relative z-10"
                        >
                            Ouvrir les Devis <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* EXPENSE MODAL */}
            <AnimatePresence>
                {showExpenseModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowExpenseModal(false)}>
                        <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} onClick={e => e.stopPropagation()} className="glass-nexus-card w-full max-w-md overflow-hidden bg-[#0c1420]">
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <h3 className="text-lg font-black text-white">Ajouter une Dépense</h3>
                                <button title="Fermer" onClick={() => setShowExpenseModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Libellé</label>
                                    <input required value={newExpense.titre} onChange={e => setNewExpense({...newExpense, titre: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm" placeholder="ex: Publicité Facebook" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Montant (XOF)</label>
                                        <input required type="number" value={newExpense.montant} onChange={e => setNewExpense({...newExpense, montant: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm font-mono" placeholder="0" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Catégorie</label>
                                        <select title="Catégorie de dépense" value={newExpense.categorie} onChange={e => setNewExpense({...newExpense, categorie: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm appearance-none">
                                            <option value="marketing">Marketing</option>
                                            <option value="operationnel">Opérationnel</option>
                                            <option value="logistique">Logistique</option>
                                            <option value="autre">Autre</option>
                                        </select>
                                    </div>
                                </div>
                                <button disabled={savingExpense} type="submit" className="w-full py-4 bg-emerald-500 text-white font-black rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-4">
                                    {savingExpense ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />} Enregistrer la dépense
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
