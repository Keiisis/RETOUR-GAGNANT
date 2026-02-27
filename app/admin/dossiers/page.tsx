'use client'

import { useList, useUpdate } from '@refinedev/core'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, FileText, Clock, CheckCircle2, Zap, AlertTriangle, ChevronDown, ChevronUp, Save, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const statutColors: Record<string, string> = {
    reception: '#6b7280',
    verification: '#3b82f6',
    traitement: '#FCD116',
    validation: '#f59e0b',
    finalisation: '#008751',
    termine: '#10b981',
    annule: '#ef4444',
}

const statutLabels: Record<string, string> = {
    reception: 'Réception',
    verification: 'Vérification',
    traitement: 'Traitement',
    validation: 'Validation',
    finalisation: 'Finalisation',
    termine: 'Terminé',
    annule: 'Annulé',
}

const stepStatuses = [
    { value: 'pending', label: 'En attente', color: '#6b7280' },
    { value: 'in_progress', label: 'En cours', color: '#FCD116' },
    { value: 'completed', label: 'Terminé', color: '#008751' },
]

export default function AdminDossiersPage() {
    const listResult = useList({
        resource: 'dossier_tracking',
        sorters: [{ field: 'created_at', order: 'desc' }],
    })
    const { mutate: update } = useUpdate()

    const data = listResult?.result?.data || []
    const isLoading = listResult?.query?.isLoading ?? true
    const refetch = () => listResult?.query?.refetch()

    const [searchQuery, setSearchQuery] = useState('')
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [showCreateModal, setShowCreateModal] = useState(false)

    // Create form state
    const [newDossier, setNewDossier] = useState({
        num_dossier: '',
        client_nom: '',
        client_prenom: '',
        client_email: '',
        client_whatsapp: '',
        service_type: 'general',
    })

    const dossiers = data || []
    const filtered = dossiers.filter((d: Record<string, unknown>) =>
        (d.num_dossier as string)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.client_nom as string)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.client_prenom as string)?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const updateStep = (dossierId: string, etapes: Record<string, unknown>[], stepIndex: number, newStatus: string) => {
        const updated = [...etapes]
        updated[stepIndex] = {
            ...updated[stepIndex],
            status: newStatus,
            date: newStatus !== 'pending' ? new Date().toISOString().split('T')[0] : null,
        }
        const completedCount = updated.filter((s) => s.status === 'completed').length
        const progression = Math.round((completedCount / updated.length) * 100)

        update({
            resource: 'dossier_tracking',
            id: dossierId,
            values: { etapes: updated, progression },
        }, { onSuccess: () => refetch() })
    }

    const updateStatut = (dossierId: string, newStatut: string) => {
        update({
            resource: 'dossier_tracking',
            id: dossierId,
            values: { statut: newStatut },
        }, { onSuccess: () => refetch() })
    }

    const createDossier = async () => {
        if (!newDossier.num_dossier || !newDossier.client_nom || !newDossier.client_email) return

        try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
            const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
            const { createClient } = await import('@supabase/supabase-js')
            const supabase = createClient(supabaseUrl, supabaseKey)

            await supabase.from('dossier_tracking').insert({
                ...newDossier,
                num_dossier: newDossier.num_dossier.toUpperCase(),
                client_email: newDossier.client_email.toLowerCase(),
            })

            setShowCreateModal(false)
            setNewDossier({ num_dossier: '', client_nom: '', client_prenom: '', client_email: '', client_whatsapp: '', service_type: 'general' })
            refetch()
        } catch (err) {
            console.error('Erreur création dossier:', err)
        }
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black font-heading tracking-tight flex items-center gap-3">
                        <FileText size={28} className="text-[#008751]" />
                        Nexus Tracker
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Gérez le suivi des dossiers clients en temps réel</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#008751] text-white font-bold text-sm hover:bg-[#006a41] transition-colors"
                >
                    <Plus size={16} />
                    Nouveau dossier
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un dossier..."
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751]"
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Total', count: dossiers.length, color: '#008751' },
                    { label: 'En cours', count: dossiers.filter((d: Record<string, unknown>) => d.statut === 'traitement' || d.statut === 'verification').length, color: '#FCD116' },
                    { label: 'Terminés', count: dossiers.filter((d: Record<string, unknown>) => d.statut === 'termine').length, color: '#10b981' },
                    { label: 'Bloqués', count: dossiers.filter((d: Record<string, unknown>) => d.statut === 'annule').length, color: '#ef4444' },
                ].map((stat) => (
                    <div key={stat.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
                        <p className="text-2xl font-black font-mono" style={{ color: stat.color }}>{stat.count}</p>
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Dossiers List */}
            {isLoading ? (
                <div className="text-center py-16">
                    <div className="w-8 h-8 border-2 border-[#008751] border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((dossier: Record<string, unknown>) => {
                        const isExpanded = expandedId === dossier.id
                        const etapes = (dossier.etapes as Record<string, unknown>[]) || []
                        return (
                            <motion.div
                                key={dossier.id as string}
                                layout
                                className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors"
                            >
                                {/* Row */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : dossier.id as string)}
                                    className="w-full flex items-center justify-between p-5 text-left"
                                    title={`Voir les détails du dossier ${dossier.num_dossier}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${statutColors[dossier.statut as string] || '#6b7280'}20` }}>
                                            <FileText size={18} style={{ color: statutColors[dossier.statut as string] || '#6b7280' }} />
                                        </div>
                                        <div>
                                            <p className="font-mono font-bold text-sm tracking-wider">{dossier.num_dossier as string}</p>
                                            <p className="text-gray-500 text-xs">{dossier.client_prenom as string} {dossier.client_nom as string} — {dossier.service_type as string}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span
                                            className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
                                            style={{
                                                color: statutColors[dossier.statut as string],
                                                backgroundColor: `${statutColors[dossier.statut as string]}15`,
                                                border: `1px solid ${statutColors[dossier.statut as string]}30`
                                            }}
                                        >
                                            {statutLabels[dossier.statut as string] || dossier.statut as string}
                                        </span>
                                        <span className="font-mono text-sm text-gray-400">{dossier.progression as number}%</span>
                                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                    </div>
                                </button>

                                {/* Expanded Content */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-white/5"
                                        >
                                            <div className="p-6 space-y-6">
                                                {/* Client Info */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1">Email</p>
                                                        <p className="text-gray-300">{dossier.client_email as string}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1">WhatsApp</p>
                                                        <p className="text-gray-300">{(dossier.client_whatsapp as string) || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1">Créé le</p>
                                                        <p className="text-gray-300">{new Date(dossier.created_at as string).toLocaleDateString('fr-FR')}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1">Statut global</p>
                                                        <select
                                                            value={dossier.statut as string}
                                                            onChange={e => updateStatut(dossier.id as string, e.target.value)}
                                                            title="Changer le statut du dossier"
                                                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#008751]"
                                                        >
                                                            {Object.entries(statutLabels).map(([val, lab]) => (
                                                                <option key={val} value={val} className="bg-[#0a0f18]">{lab}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Steps Management */}
                                                <div>
                                                    <h4 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Étapes du dossier</h4>
                                                    <div className="space-y-3">
                                                        {etapes.map((step, idx) => {
                                                            const stepConfig = stepStatuses.find(s => s.value === step.status) || stepStatuses[2]
                                                            return (
                                                                <div key={idx} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${stepConfig.color}20`, border: `2px solid ${stepConfig.color}` }}>
                                                                        {step.status === 'completed' ? <CheckCircle2 size={14} style={{ color: stepConfig.color }} /> :
                                                                            step.status === 'in_progress' ? <Zap size={14} style={{ color: stepConfig.color }} /> :
                                                                                <Clock size={14} style={{ color: stepConfig.color }} />}
                                                                    </div>
                                                                    <span className="flex-1 text-sm font-medium">{step.label as string}</span>
                                                                    <select
                                                                        value={step.status as string}
                                                                        onChange={e => updateStep(dossier.id as string, etapes, idx, e.target.value)}
                                                                        title={`Changer le statut de l'étape: ${step.label}`}
                                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#008751]"
                                                                    >
                                                                        {stepStatuses.map(s => (
                                                                            <option key={s.value} value={s.value} className="bg-[#0a0f18]">{s.label}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )
                    })}

                    {filtered.length === 0 && (
                        <div className="text-center py-16 text-gray-500">
                            <FileText size={40} className="mx-auto mb-4 opacity-30" />
                            <p className="font-bold">Aucun dossier trouvé</p>
                        </div>
                    )}
                </div>
            )}

            {/* Create Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowCreateModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-[#0f141e] border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black font-heading">Nouveau Dossier</h3>
                                <button onClick={() => setShowCreateModal(false)} title="Fermer" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">N° Dossier</label>
                                    <input
                                        type="text"
                                        value={newDossier.num_dossier}
                                        onChange={e => setNewDossier({ ...newDossier, num_dossier: e.target.value })}
                                        placeholder="RG-2026-XXXXX"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751] font-mono"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Nom</label>
                                        <input
                                            type="text"
                                            value={newDossier.client_nom}
                                            onChange={e => setNewDossier({ ...newDossier, client_nom: e.target.value })}
                                            placeholder="Nom"
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Prénom</label>
                                        <input
                                            type="text"
                                            value={newDossier.client_prenom}
                                            onChange={e => setNewDossier({ ...newDossier, client_prenom: e.target.value })}
                                            placeholder="Prénom"
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751]"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Email</label>
                                    <input
                                        type="email"
                                        value={newDossier.client_email}
                                        onChange={e => setNewDossier({ ...newDossier, client_email: e.target.value })}
                                        placeholder="client@email.com"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">WhatsApp</label>
                                    <input
                                        type="tel"
                                        value={newDossier.client_whatsapp}
                                        onChange={e => setNewDossier({ ...newDossier, client_whatsapp: e.target.value })}
                                        placeholder="+229 XX XX XX XX"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Service</label>
                                    <input
                                        type="text"
                                        value={newDossier.service_type}
                                        onChange={e => setNewDossier({ ...newDossier, service_type: e.target.value })}
                                        placeholder="Ex: Passeport & Documents"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751]"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={createDossier}
                                className="w-full mt-6 py-4 rounded-xl bg-[#008751] text-white font-black uppercase tracking-widest text-sm hover:bg-[#006a41] transition-colors flex items-center justify-center gap-2"
                            >
                                <Save size={16} />
                                Créer le dossier
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
