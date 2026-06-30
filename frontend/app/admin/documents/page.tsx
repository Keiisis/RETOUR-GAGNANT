'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    FolderOpen, CheckCircle2, XCircle, Clock, FileText,
    User, Mail, Calendar, Search, LucideIcon, Trash2
} from 'lucide-react'

interface ClientDocument {
    id: string
    client_email: string
    client_nom: string
    file_name: string
    file_url: string
    file_type: string
    file_size: number
    status: string
    agent_note: string
    created_at: string
}

const formatDate = (val: string | null | undefined) => {
    if (!val) return '—'
    const d = new Date(val)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR')
}

export default function AdminDocumentsPage() {
    const [documents, setDocuments] = useState<ClientDocument[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'en_attente' | 'valide' | 'rejete'>('all')

    const fetchDocs = async () => {
        let query = supabase.from('client_documents').select('*').order('created_at', { ascending: false })
        if (filter !== 'all') query = query.eq('status', filter)
        const { data } = await query
        setDocuments((data || []) as ClientDocument[])
        setLoading(false)
    }

    useEffect(() => { fetchDocs() }, [filter])

    const updateStatus = async (id: string, status: string, note?: string) => {
        await supabase.from('client_documents').update({
            status,
            agent_note: note || ''
        }).eq('id', id)
        fetchDocs()
    }

    const handleDeleteDoc = async (doc: ClientDocument) => {
        if (!confirm('Supprimer définitivement ce document et son fichier physique ?')) return

        try {
            let storagePath = (doc as any).storage_path
            if (!storagePath && doc.file_url) {
                const bucketToken = 'client-documents/'
                if (doc.file_url.includes(bucketToken)) {
                    storagePath = decodeURIComponent(doc.file_url.split(bucketToken)[1].split('?')[0])
                } else if (doc.file_url.startsWith('/uploads/')) {
                    storagePath = doc.file_url.replace('/uploads/', '')
                } else {
                    storagePath = doc.file_name
                }
            }
            if (storagePath) {
                await supabase.storage.from('client-documents').remove([storagePath])
            }
        } catch (e) {
            console.error('Storage deletion failed:', e)
        }

        const { error } = await supabase.from('client_documents').delete().eq('id', doc.id)
        if (error) {
            alert('Erreur lors de la suppression : ' + error.message)
        } else {
            setDocuments(prev => prev.filter(d => d.id !== doc.id))
        }
    }

    const statusConfig: Record<string, { label: string, color: string, Icon: LucideIcon }> = {
        en_attente: { label: 'En attente', color: 'bg-amber-500/20 text-amber-400', Icon: Clock },
        valide: { label: 'Validé', color: 'bg-emerald-500/20 text-emerald-400', Icon: CheckCircle2 },
        rejete: { label: 'Rejeté', color: 'bg-red-500/20 text-red-400', Icon: XCircle },
    }

    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]"><T>Gestion</T></span>
                    <h1 className="text-2xl font-black text-white flex items-center gap-2">
                        <FolderOpen size={22} className="text-emerald-400" /> Documents Clients
                    </h1>
                </div>

                {/* Filter */}
                <div className="flex gap-2 mb-6">
                    {(['all', 'en_attente', 'valide', 'rejete'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${filter === f ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-gray-500 border border-white/5 hover:text-white'}`}
                        >
                            {f === 'all' ? 'Tous' : statusConfig[f]?.label || f}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    </div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-20 text-gray-500">
                        <FolderOpen className="mx-auto mb-3 text-gray-700" size={40} />
                        <p className="text-sm"><T>Aucun document</T></p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {documents.map((doc, i) => {
                            const cfg = statusConfig[doc.status] || statusConfig.en_attente
                            return (
                                <motion.div
                                    key={doc.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.03 }}
                                    className="bg-white/[0.03] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all"
                                >
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <FileText size={20} className="text-blue-400 shrink-0" />
                                            <div className="min-w-0">
                                                {doc.file_url ? (
                                                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-white hover:text-emerald-400 transition-colors hover:underline truncate block">
                                                        {doc.file_name}
                                                    </a>
                                                ) : (
                                                    <p className="text-sm font-bold text-white truncate">{doc.file_name}</p>
                                                )}
                                                <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 flex-wrap">
                                                    <span className="flex items-center gap-1"><User size={10} /> {doc.client_nom || 'N/A'}</span>
                                                    <span className="flex items-center gap-1"><Mail size={10} /> {doc.client_email}</span>
                                                    <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(doc.created_at)}</span>
                                                    {doc.file_size > 0 && <span>{(doc.file_size / 1024).toFixed(0)} KB</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 ${cfg.color}`}>
                                                <cfg.Icon size={10} /> {cfg.label}
                                            </span>
                                            {doc.status === 'en_attente' && (
                                                <>
                                                    <button
                                                        onClick={() => updateStatus(doc.id, 'valide')}
                                                        className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
                                                    >
                                                        ✓ Valider
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const note = window.prompt('Raison du rejet :')
                                                            if (note !== null) updateStatus(doc.id, 'rejete', note)
                                                        }}
                                                        className="bg-red-500/20 text-red-400 hover:bg-red-500/30 font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
                                                    >
                                                        ✕ Rejeter
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => handleDeleteDoc(doc)}
                                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-xl transition-all"
                                                title="Supprimer"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    {doc.agent_note && (
                                        <p className="text-xs text-gray-500 italic mt-2 pl-9">Note : {doc.agent_note}</p>
                                    )}
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
