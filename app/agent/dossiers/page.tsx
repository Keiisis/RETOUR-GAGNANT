'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    FileText, Search, Plus, Clock,
    CheckCircle2, Loader2, Eye,
    X, Calendar, Mail, Phone, StickyNote,
    ArrowRight
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type DossierStatus = 'nouveau' | 'en_attente' | 'en_cours' | 'termine'

interface Dossier {
    id: string
    num_dossier: string
    client_nom: string
    client_prenom: string
    client_email: string
    client_phone: string
    service_type: string
    status: DossierStatus
    steps: Record<string, unknown>[]
    created_at: string
    notes?: string
}

const columns: { id: DossierStatus; label: string; color: string; icon: LucideIcon }[] = [
    { id: 'nouveau', label: 'Nouveau', color: 'border-sky-500/30 bg-sky-500/5', icon: Plus },
    { id: 'en_attente', label: 'En Attente Client', color: 'border-amber-500/30 bg-amber-500/5', icon: Clock },
    { id: 'en_cours', label: 'En Traitement', color: 'border-emerald-500/30 bg-emerald-500/5', icon: Loader2 },
    { id: 'termine', label: 'Finalisé', color: 'border-green-500/30 bg-green-500/5', icon: CheckCircle2 },
]

export default function AgentDossiersPage() {
    const [dossiers, setDossiers] = useState<Dossier[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null)
    const [noteText, setNoteText] = useState('')

    useEffect(() => {
        const fetchDossiers = async () => {
            const { data } = await supabase
                .from('dossier_tracking')
                .select('*')
                .order('created_at', { ascending: false })

            setDossiers((data || []) as Dossier[])
            setLoading(false)
        }
        fetchDossiers()
    }, [])

    const updateStatus = async (dossierId: string, newStatus: DossierStatus) => {
        await supabase
            .from('dossier_tracking')
            .update({ status: newStatus })
            .eq('id', dossierId)

        setDossiers(prev => prev.map(d => d.id === dossierId ? { ...d, status: newStatus } : d))
    }

    const filtered = dossiers.filter(d =>
        d.num_dossier?.toLowerCase().includes(search.toLowerCase()) ||
        d.client_nom?.toLowerCase().includes(search.toLowerCase()) ||
        d.client_email?.toLowerCase().includes(search.toLowerCase())
    )

    const getDossiersByStatus = (status: DossierStatus) =>
        filtered.filter(d => d.status === status)

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white">Mes Dossiers</h1>
                    <p className="text-gray-500 text-sm mt-1">{dossiers.length} dossier(s) au total</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Rechercher..."
                            title="Rechercher un dossier"
                            className="bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {columns.map((column) => {
                    const items = getDossiersByStatus(column.id)
                    const ColumnIcon = column.icon
                    return (
                        <div key={column.id} className={`rounded-2xl border ${column.color} p-4 min-h-[400px]`}>
                            {/* Column Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <ColumnIcon size={16} className="text-gray-400" />
                                    <span className="text-sm font-bold text-white">{column.label}</span>
                                </div>
                                <span className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-full text-gray-300">
                                    {items.length}
                                </span>
                            </div>

                            {/* Cards */}
                            <div className="space-y-3">
                                {items.map((d, i) => (
                                    <motion.div
                                        key={d.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="bg-[#0a1210] border border-white/5 rounded-xl p-4 cursor-pointer hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all group"
                                        onClick={() => { setSelectedDossier(d); setNoteText(d.notes || '') }}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <span className="text-xs font-mono text-emerald-400 font-bold">{d.num_dossier}</span>
                                            <Eye size={14} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
                                        </div>
                                        <p className="text-sm font-semibold text-white mb-1">{d.client_nom} {d.client_prenom}</p>
                                        <p className="text-[11px] text-gray-500">{d.service_type}</p>
                                        <div className="flex items-center gap-1 mt-3 text-[10px] text-gray-600">
                                            <Calendar size={10} />
                                            {new Date(d.created_at).toLocaleDateString('fr-FR')}
                                        </div>

                                        {/* Quick Status Change */}
                                        {column.id !== 'termine' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    const nextStatus: Record<string, DossierStatus> = {
                                                        nouveau: 'en_attente',
                                                        en_attente: 'en_cours',
                                                        en_cours: 'termine',
                                                    }
                                                    updateStatus(d.id, nextStatus[column.id])
                                                }}
                                                className="mt-3 w-full flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-400/80 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg py-1.5 transition-all"
                                            >
                                                Avancer <ArrowRight size={10} />
                                            </button>
                                        )}
                                    </motion.div>
                                ))}

                                {items.length === 0 && (
                                    <div className="text-center py-8 text-gray-600 text-xs">
                                        Aucun dossier
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Dossier Detail Modal */}
            <AnimatePresence>
                {selectedDossier && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setSelectedDossier(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-[#0a1210] border border-emerald-500/20 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <p className="text-xs font-mono text-emerald-400 font-bold mb-1">{selectedDossier.num_dossier}</p>
                                    <h2 className="text-xl font-black text-white">
                                        {selectedDossier.client_nom} {selectedDossier.client_prenom}
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setSelectedDossier(null)}
                                    title="Fermer"
                                    className="p-2 rounded-lg hover:bg-white/5 text-gray-400"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2  gap-4 mb-6">
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Mail size={14} className="text-emerald-400" />
                                    <span className="truncate">{selectedDossier.client_email}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Phone size={14} className="text-emerald-400" />
                                    <span>{selectedDossier.client_phone || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <FileText size={14} className="text-emerald-400" />
                                    <span>{selectedDossier.service_type}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Calendar size={14} className="text-emerald-400" />
                                    <span>{new Date(selectedDossier.created_at).toLocaleDateString('fr-FR')}</span>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="mb-6">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Statut</p>
                                <div className="flex gap-2 flex-wrap">
                                    {columns.map((col) => (
                                        <button
                                            key={col.id}
                                            onClick={() => {
                                                updateStatus(selectedDossier.id, col.id)
                                                setSelectedDossier({ ...selectedDossier, status: col.id })
                                            }}
                                            className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${selectedDossier.status === col.id
                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                : 'bg-white/5 text-gray-500 border-white/10 hover:text-white'
                                                }`}
                                        >
                                            {col.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notes Internes */}
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <StickyNote size={12} /> Notes Internes
                                </p>
                                <textarea
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    placeholder="Ajouter une note interne sur ce dossier..."
                                    title="Notes internes"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/30 text-sm resize-none h-24"
                                />
                                <button
                                    onClick={async () => {
                                        await supabase
                                            .from('dossier_tracking')
                                            .update({ notes: noteText })
                                            .eq('id', selectedDossier.id)
                                        setDossiers(prev => prev.map(d => d.id === selectedDossier.id ? { ...d, notes: noteText } : d))
                                    }}
                                    className="mt-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-2 rounded-lg transition-all"
                                >
                                    Sauvegarder la note
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
