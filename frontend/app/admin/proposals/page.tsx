'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { getProposalsList, deleteProposal } from '@/app/actions/ai-proposals'
import {
    FileText, Globe, Loader2, Play, Trash2, Copy,
    Search, Filter, BarChart3, TrendingUp, Sparkles, CheckCircle, ExternalLink
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Proposal {
    id: string
    secret_key: string
    client_name: string
    destination: string
    status: string
    total_amount: number
    created_at: string
}

export default function AdminProposalsPage() {
    const [proposals, setProposals] = useState<Proposal[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const router = useRouter()

    useEffect(() => {
        fetchProposals()
    }, [])

    const fetchProposals = async () => {
        setLoading(true)
        const res = await getProposalsList()
        if (res.success && res.data) {
            setProposals(res.data)
        }
        setLoading(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer définitivement cette proposition ? Cette action est irréversible.')) return
        const res = await deleteProposal(id)
        if (res.success) {
            setProposals(prev => prev.filter(p => p.id !== id))
        } else {
            alert('Erreur: ' + (res.error || ''))
        }
    }

    const copyLink = (secretKey: string) => {
        navigator.clipboard.writeText(`${window.location.origin}/p/${secretKey}`)
    }

    const filteredProposals = useMemo(() => {
        return proposals.filter(p => {
            const matchesSearch = p.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.destination.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesStatus = statusFilter === 'all' || p.status === statusFilter
            return matchesSearch && matchesStatus
        })
    }, [proposals, searchTerm, statusFilter])

    // Stats
    const totalRevenue = proposals.filter(p => p.status === 'paid').reduce((acc, p) => acc + (p.total_amount || 0), 0)
    const pendingRevenue = proposals.filter(p => p.status === 'ready').reduce((acc, p) => acc + (p.total_amount || 0), 0)
    const conversionRate = proposals.length > 0 ? (proposals.filter(p => p.status === 'paid').length / proposals.length) * 100 : 0

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <Sparkles className="w-8 h-8 text-[#FCD116]" />
                        Smart Slides <span className="text-[#FCD116]">VIP</span>
                    </h1>
                    <p className="text-slate-400 mt-1">Gérez et suivez les propositions IA générées par vos agents.</p>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#FCD116]/5 rounded-full blur-2xl flex-shrink-0" />
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-[#FCD116]/10 rounded-lg text-[#FCD116]">
                            <FileText className="w-5 h-5" />
                        </div>
                        <h3 className="text-slate-400 font-medium text-sm">Total Devis</h3>
                    </div>
                    <p className="text-3xl font-black text-white">{proposals.length}</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#008751]/5 rounded-full blur-2xl flex-shrink-0" />
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-[#008751]/10 rounded-lg text-[#008751]">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <h3 className="text-slate-400 font-medium text-sm">Chiffre d&apos;Affaires (Payé)</h3>
                    </div>
                    <p className="text-3xl font-black text-white">{totalRevenue.toLocaleString()} <span className="text-lg text-slate-500">FCFA</span></p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl flex-shrink-0" />
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <h3 className="text-slate-400 font-medium text-sm">En Attente (Prêt)</h3>
                    </div>
                    <p className="text-3xl font-black text-white">{pendingRevenue.toLocaleString()} <span className="text-lg text-slate-500">FCFA</span></p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#E8112D]/5 rounded-full blur-2xl flex-shrink-0" />
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-[#E8112D]/10 rounded-lg text-[#E8112D]">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                        <h3 className="text-slate-400 font-medium text-sm">Taux de Conversion</h3>
                    </div>
                    <p className="text-3xl font-black text-white">{conversionRate.toFixed(1)}%</p>
                </motion.div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Rechercher un client, une destination..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-[#FCD116] transition-colors"
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-white focus:outline-none focus:border-[#FCD116] transition-colors appearance-none"
                    >
                        <option value="all">Tous les statuts</option>
                        <option value="paid">Payé</option>
                        <option value="ready">Prêt</option>
                        <option value="draft">Brouillon</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="p-4 font-bold">Client & Destination</th>
                                <th className="p-4 font-bold">Lien Secret</th>
                                <th className="p-4 font-bold">Statut</th>
                                <th className="p-4 font-bold">Montant</th>
                                <th className="p-4 font-bold">Date Création</th>
                                <th className="p-4 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center">
                                        <Loader2 className="w-8 h-8 text-[#FCD116] animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : filteredProposals.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        Aucune proposition trouvée.
                                    </td>
                                </tr>
                            ) : (
                                filteredProposals.map((prop) => (
                                    <tr key={prop.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4">
                                            <p className="text-white font-bold">{prop.client_name}</p>
                                            <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5"><Globe className="w-3 h-3" /> {prop.destination}</p>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => copyLink(prop.secret_key)} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 transition" title="Copier le lien">
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <span className="text-xs font-mono text-slate-500 truncate max-w-[120px]">{prop.secret_key}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${prop.status === 'paid' ? 'bg-[#008751]/20 text-[#008751]' : prop.status === 'ready' ? 'bg-[#FCD116]/20 text-[#FCD116]' : 'bg-slate-800 text-slate-400'}`}>
                                                {prop.status === 'paid' ? 'Payé' : prop.status === 'ready' ? 'Prêt' : 'Brouillon'}
                                            </span>
                                        </td>
                                        <td className="p-4 font-bold text-[#FCD116]">
                                            {prop.total_amount?.toLocaleString() || 0} <span className="text-xs text-slate-500">FCFA</span>
                                        </td>
                                        <td className="p-4 text-slate-400 text-sm">
                                            {new Date(prop.created_at).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <a href={`/p/${prop.secret_key}`} target="_blank" rel="noreferrer" className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors" title="Aperçu public">
                                                    <Play className="w-4 h-4 fill-current" />
                                                </a>
                                                <button onClick={() => router.push(`/agent/presentations/${prop.id}`)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors" title="Accéder à l'éditeur">
                                                    <ExternalLink className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(prop.id)} className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors" title="Supprimer">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
