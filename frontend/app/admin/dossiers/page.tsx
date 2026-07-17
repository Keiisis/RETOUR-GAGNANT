'use client'

import { useTranslation, T } from '@/lib/translation';
import { useList, useUpdate } from '@refinedev/core'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, FileText, Clock, CheckCircle2, Zap, AlertTriangle, ChevronDown, ChevronUp, Save, Plus, X, Download, RefreshCw, MessageSquare, Send, User, Mail, Loader2, Trash2 } from 'lucide-react'
import { exportToExcel } from '@/lib/exportExcel'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

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

const formatDate = (val: string | null | undefined) => {
    if (!val) return '—'
    const d = new Date(val)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR')
}

export default function AdminDossiersPage() {
    const { t } = useTranslation();
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
    const [syncing, setSyncing] = useState(false)
    const [syncResult, setSyncResult] = useState<string | null>(null)

    // Chat par dossier
    const [chatMessages, setChatMessages] = useState<Record<string, Array<{ id: string; role: string; content: string; created_at: string }>>>({})
    const [chatInput, setChatInput] = useState<Record<string, string>>({})
    const [chatSending, setChatSending] = useState<Record<string, boolean>>({})
    const [emailSending, setEmailSending] = useState<Record<string, boolean>>({})
    const chatBottomRefs = useRef<Record<string, HTMLDivElement | null>>({})

    const loadChat = async (threadId: string) => {
        if (!threadId || chatMessages[threadId]) return
        const { data } = await supabase
            .from('chat_messages')
            .select('id, role, content, created_at')
            .eq('conversation_id', threadId)
            .order('created_at', { ascending: true })
        setChatMessages(prev => ({ ...prev, [threadId]: (data || []) as Array<{ id: string; role: string; content: string; created_at: string }> }))
    }

    const sendChatReply = async (dossier: Record<string, unknown>) => {
        const threadId = dossier.message_thread_id as string
        if (!threadId) return
        const content = (chatInput[threadId] || '').trim()
        if (!content) return
        setChatSending(prev => ({ ...prev, [threadId]: true }))
        setChatInput(prev => ({ ...prev, [threadId]: '' }))
        const { data } = await supabase
            .from('chat_messages')
            .insert({ conversation_id: threadId, role: 'agent', content })
            .select('id, role, content, created_at')
            .single()
        if (data) {
            setChatMessages(prev => ({ ...prev, [threadId]: [...(prev[threadId] || []), data as { id: string; role: string; content: string; created_at: string }] }))
            setTimeout(() => chatBottomRefs.current[threadId]?.scrollIntoView({ behavior: 'smooth' }), 60)
        }
        setChatSending(prev => ({ ...prev, [threadId]: false }))
    }

    const sendEmailReply = async (dossier: Record<string, unknown>, message: string) => {
        const threadId = dossier.message_thread_id as string
        if (!message.trim() || !(dossier.client_email as string)) return
        setEmailSending(prev => ({ ...prev, [threadId || dossier.id as string]: true }))
        try {
            await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: dossier.client_email,
                    subject: `Réponse à votre dossier ${dossier.num_dossier}`,
                    clientName: `${dossier.client_prenom || ''} ${dossier.client_nom || ''}`.trim() || 'Client',
                    context: 'dossierUpdate',
                    relatedId: dossier.num_dossier,
                    dossierNumero: dossier.num_dossier,
                    progression: dossier.progression || 0,
                    message,
                    documentsManquants: (dossier.documents_manquants as string[]) || [],
                    trackerUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/suivi-dossier`,
                }),
            })
        } catch (e) { console.error(e) }
        setEmailSending(prev => ({ ...prev, [threadId || dossier.id as string]: false }))
    }

    const handleSyncDossiers = async () => {
        setSyncing(true)
        setSyncResult(null)
        try {
            const res = await fetch('/api/cron/sync-dossiers', { method: 'POST' })
            const data = await res.json()
            setSyncResult(` ${data.synced} dossier(s) synchronisé(s) sur ${data.total}`)
            refetch()
        } catch {
            setSyncResult('Erreur de synchronisation')
        } finally {
            setSyncing(false)
            setTimeout(() => setSyncResult(null), 5000)
        }
    }

    // Documents
    const [dossierDocs, setDossierDocs] = useState<any[]>([])
    const [loadingDocs, setLoadingDocs] = useState(false)

    const deletePhysicalFile = async (url: string, sourceTable: string) => {
        if (!url) return;
        try {
            let bucket = 'client-documents';
            if (sourceTable === 'dossier_documents') {
                bucket = 'dossier-documents';
            } else if (sourceTable === 'documents') {
                bucket = 'dossier-documents';
            }
            
            let path = '';
            if (url.includes(`/storage/v1/object/public/${bucket}/`)) {
                path = decodeURIComponent(url.split(`/storage/v1/object/public/${bucket}/`)[1].split('?')[0]);
            } else if (url.includes(`/storage/v1/object/sign/${bucket}/`)) {
                path = decodeURIComponent(url.split(`/storage/v1/object/sign/${bucket}/`)[1].split('?')[0]);
            } else {
                for (const b of ['client-documents', 'dossier-documents']) {
                    if (url.includes(`/${b}/`)) {
                        bucket = b;
                        path = decodeURIComponent(url.split(`/${b}/`)[1].split('?')[0]);
                        break;
                    }
                }
            }
            
            if (path) {
                await supabase.storage.from(bucket).remove([path]);
            }
        } catch (e) {
            console.error('Failed to delete physical file from storage:', e);
        }
    };

    const loadDossierDocs = async (dossierTrackingId: string, dossierRefId?: string) => {
        setLoadingDocs(true)
        setDossierDocs([])
        
        const ids = [dossierTrackingId, dossierRefId].filter(Boolean) as string[]
        
        // Query all three document tables the system uses:
        // - dossier_documents: mobile app uploads (DossierScreen)
        // - client_documents: web dashboard uploads (/api/documents/upload)
        // - documents: legacy fallback table
        const [r1, r2, r3] = await Promise.all([
            supabase.from('dossier_documents').select('*').in('dossier_id', ids),
            supabase.from('client_documents').select('*').in('dossier_id', ids),
            supabase.from('documents').select('*').in('dossier_id', ids),
        ])
        
        // Tag their source table
        const docs1 = (r1.data || []).map(d => ({ ...d, sourceTable: 'dossier_documents' }))
        const docs2 = (r2.data || []).map(d => ({ ...d, sourceTable: 'client_documents' }))
        const docs3 = (r3.data || []).map(d => ({ ...d, sourceTable: 'documents' }))

        // Merge and deduplicate by id
        const all = [...docs1, ...docs2, ...docs3]
        const seen = new Set<string>()
        const unique = all.filter(d => {
            if (seen.has(d.id)) return false
            seen.add(d.id)
            return true
        })
        
        setDossierDocs(unique)
        setLoadingDocs(false)
    }

    const handleDeleteDossierDoc = async (doc: any) => {
        if (!confirm('Supprimer définitivement ce document et son fichier physique ?')) return;

        if (doc.file_url) {
            await deletePhysicalFile(doc.file_url, doc.sourceTable);
        }

        const table = doc.sourceTable || 'dossier_documents';
        const { error } = await supabase.from(table).delete().eq('id', doc.id);
        
        if (error) {
            alert('Erreur lors de la suppression du document : ' + error.message);
        } else {
            setDossierDocs(prev => prev.filter(d => d.id !== doc.id));
        }
    };

    const handleDeleteDossier = async (dossier: any) => {
        if (!confirm(`Supprimer définitivement le dossier ${dossier.num_dossier} ainsi que TOUS ses documents physiques associés ? Cette action est irréversible.`)) return;

        try {
            const ids = [dossier.id, dossier.dossier_ref_id].filter(Boolean) as string[];
            
            const [r1, r2, r3] = await Promise.all([
                supabase.from('dossier_documents').select('file_url').in('dossier_id', ids),
                supabase.from('client_documents').select('file_url').in('dossier_id', ids),
                supabase.from('documents').select('file_url').in('dossier_id', ids),
            ]);

            const allUrls = [
                ...(r1.data || []).map(d => ({ url: d.file_url, table: 'dossier_documents' })),
                ...(r2.data || []).map(d => ({ url: d.file_url, table: 'client_documents' })),
                ...(r3.data || []).map(d => ({ url: d.file_url, table: 'documents' })),
            ];

            for (const item of allUrls) {
                if (item.url) {
                    await deletePhysicalFile(item.url, item.table);
                }
            }

            await Promise.all([
                supabase.from('dossier_documents').delete().in('dossier_id', ids),
                supabase.from('client_documents').delete().in('dossier_id', ids),
                supabase.from('documents').delete().in('dossier_id', ids),
                supabase.from('dossier_tracking').delete().eq('id', dossier.id),
            ]);

            if (dossier.dossier_ref_id) {
                await supabase.from('dossiers').delete().eq('id', dossier.dossier_ref_id);
            }

            refetch();
            setExpandedId(null);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Erreur lors de la suppression complète');
        }
    };

    // Create form state
    const [newDossier, setNewDossier] = useState({
        num_dossier: '',
        client_nom: '',
        client_prenom: '',
        client_email: '',
        client_whatsapp: '',
        service_type: 'general',
    })

    const handleExpandDossier = useCallback((dossierId: string, threadId: string | undefined, refId: string | undefined) => {
        setExpandedId(prev => prev === dossierId ? null : dossierId)
        if (dossierId !== expandedId) {
            if (threadId) loadChat(threadId)
            loadDossierDocs(dossierId, refId)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expandedId])

    // Synchroniser automatiquement au chargement de la page
    useEffect(() => {
        fetch('/api/cron/sync-dossiers', { method: 'POST' })
            .then(r => r.json())
            .then(d => { if (d.synced > 0) refetch() })
            .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const dossiers = data || []
    const filtered = dossiers.filter((d: Record<string, unknown>) =>
        (d.num_dossier as string)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.client_nom as string)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.client_prenom as string)?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // ── Status mapping: dossier_tracking statuts → mobile dossiers statuses ──
    const trackingToMobileStatus: Record<string, string> = {
        reception: 'soumis',
        verification: 'verifie',
        traitement: 'traitement',
        validation: 'validation',
        finalisation: 'validation',
        termine: 'termine',
        annule: 'annule',
    }

    // Sync helper: propagate changes from dossier_tracking → dossiers (mobile table)
    const syncToMobileDossiers = async (dossierId: string, mobileStatus: string, progression: number) => {
        // Find the dossier_ref_id for this tracking entry
        const dossier = dossiers.find((d: Record<string, unknown>) => d.id === dossierId)
        const refId = dossier?.dossier_ref_id as string | undefined
        if (!refId) return

        await supabase
            .from('dossiers')
            .update({
                status: mobileStatus,
                progress: progression,
                updated_at: new Date().toISOString(),
            })
            .eq('id', refId)
    }

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
        }, {
            onSuccess: () => {
                refetch()
                // Sync progression to mobile dossiers table
                const dossier = dossiers.find((d: Record<string, unknown>) => d.id === dossierId)
                const currentStatut = (dossier?.statut as string) || 'reception'
                const mobileStatus = trackingToMobileStatus[currentStatut] || 'soumis'
                syncToMobileDossiers(dossierId, mobileStatus, progression)
            }
        })
    }

    const updateStatut = (dossierId: string, newStatut: string) => {
        // Calculate progression from statut
        const statutProgressionMap: Record<string, number> = {
            reception: 10,
            verification: 30,
            traitement: 60,
            validation: 80,
            finalisation: 95,
            termine: 100,
            annule: 0,
        }
        const progression = statutProgressionMap[newStatut] ?? 10

        update({
            resource: 'dossier_tracking',
            id: dossierId,
            values: { statut: newStatut, progression },
        }, {
            onSuccess: () => {
                refetch()
                // Sync to mobile dossiers table
                const mobileStatus = trackingToMobileStatus[newStatut] || 'soumis'
                syncToMobileDossiers(dossierId, mobileStatus, progression)
            }
        })
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

    const handleExportExcel = async () => {
        const columns = [
            { header: 'N° Dossier', key: 'num_dossier', width: 20 },
            { header: 'Passager / Client', key: 'client_nom', width: 30 },
            { header: 'Email', key: 'client_email', width: 30 },
            { header: 'WhatsApp', key: 'client_whatsapp', width: 20 },
            { header: 'Type de Service', key: 'service_type', width: 25 },
            { header: 'Statut', key: 'statut', width: 20, type: 'status' as const },
            { header: 'Progression (%)', key: 'progression', width: 20, type: 'percent' as const },
            { header: 'Créé le', key: 'created_at', width: 20, type: 'date' as const }
        ];

        const exportData = filtered.map((d: Record<string, unknown>) => ({
            num_dossier: d.num_dossier,
            client_nom: `${d.client_prenom || ''} ${d.client_nom || ''}`.trim(),
            client_email: d.client_email,
            client_whatsapp: d.client_whatsapp || 'Non renseigné',
            service_type: d.service_type,
            statut: statutLabels[d.statut as string] || d.statut,
            progression: d.progression,
            created_at: new Date(d.created_at as string)
        }));

        await exportToExcel({
            filename: `RG_Export_Dossiers_${new Date().toISOString().split('T')[0]}`,
            sheetName: 'Suivi Dossiers',
            title: 'RAPPORT DE SUIVI DES DOSSIERS — RETOUR GAGNANT',
            subtitle: `Synthèse générée le ${new Date().toLocaleDateString('fr-FR')} - Confidentiel`,
            columns,
            data: exportData
        });
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
                    <p className="text-gray-500 text-sm mt-1"><T>Gérez le suivi des dossiers clients en temps réel</T></p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {syncResult && (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
                            {syncResult}
                        </span>
                    )}
                    <button
                        onClick={handleSyncDossiers}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-sm hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                        title="Synchroniser automatiquement la progression des dossiers boutique depuis les statuts de paiement"
                    >
                        <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
                        Sync statuts paiement
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-colors"
                        title="Télécharger le rapport Excel pour la comptabilité"
                    >
                        <Download size={16} />
                        Export Excel
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#008751] text-white font-bold text-sm hover:bg-[#006a41] transition-colors shadow-[0_4px_20px_rgba(0,135,81,0.3)]"
                    >
                        <Plus size={16} />
                        Nouveau dossier
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t("Rechercher un dossier...")}
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
                                    onClick={() => handleExpandDossier(dossier.id as string, dossier.message_thread_id as string | undefined, dossier.dossier_ref_id as string | undefined)}
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
                                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1"><T>Email</T></p>
                                                        <p className="text-gray-300">{dossier.client_email as string}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1"><T>WhatsApp</T></p>
                                                        <p className="text-gray-300">{(dossier.client_whatsapp as string) || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1"><T>Créé le</T></p>
                                                        <p className="text-gray-300">{formatDate(dossier.created_at as string)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1"><T>Statut global</T></p>
                                                        <select
                                                            value={dossier.statut as string}
                                                            onChange={e => updateStatut(dossier.id as string, e.target.value)}
                                                            title={t("Changer le statut du dossier")}
                                                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#008751]"
                                                        >
                                                            {Object.entries(statutLabels).map(([val, lab]) => (
                                                                 <option key={val} value={val} className="bg-[#0a0f18]">{lab}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="flex flex-col justify-end">
                                                        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1"><T>Actions</T></p>
                                                        <button
                                                            onClick={() => handleDeleteDossier(dossier)}
                                                            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs px-4 py-2.5 rounded-xl transition-all w-fit border border-red-500/20"
                                                        >
                                                            <Trash2 size={12} />
                                                            Supprimer
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Documents fournis */}
                                                <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <FileText size={14} className="text-[#008751]" />
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-[#008751]"><T>Documents fournis par le client</T></p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {loadingDocs ? (
                                                            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                                                                <Loader2 size={14} className="animate-spin" /> <T>Chargement des documents...</T>
                                                            </div>
                                                        ) : dossierDocs.length > 0 ? (
                                                            dossierDocs.map(doc => (
                                                                <div key={doc.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm">
                                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                                        <FileText size={14} className="text-[#008751] shrink-0" />
                                                                        <span className="text-gray-300 truncate">{doc.file_name || doc.filename}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        {doc.file_url && (
                                                                            <a 
                                                                                href={doc.file_url}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="p-1.5 bg-[#008751]/10 text-[#008751] hover:bg-[#008751]/20 rounded transition-colors"
                                                                                title={t("Télécharger/Voir")}
                                                                            >
                                                                                <Download size={14} />
                                                                            </a>
                                                                        )}
                                                                        <button
                                                                            onClick={() => handleDeleteDossierDoc(doc)}
                                                                            className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                                                            title="Supprimer"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-xs text-gray-500 bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                                                                <T>Aucun document fourni pour le moment.</T>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Message client */}
                                                {Boolean(dossier.client_message || dossier.notes_internes) && (
                                                    <div className="p-4 rounded-xl border border-[#FCD116]/20 bg-[#FCD116]/5">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <MessageSquare size={14} className="text-[#FCD116]" />
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-[#FCD116]">Message du client</p>
                                                        </div>
                                                        <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                                                            {(dossier.client_message as string) ||
                                                                // Fallback : extraire depuis notes_internes pour les anciens dossiers
                                                                ((dossier.notes_internes as string) || '')
                                                                    .split('\n')
                                                                    .find(line => line.startsWith('Message client:') || line.startsWith('Description:'))
                                                                    ?.replace(/^(Message client:|Description:)\s*/, '')
                                                                || (dossier.notes_internes as string)
                                                            }
                                                        </p>
                                                    </div>
                                                )}

                                                {/* ── Chat / Répondre au client ──────────────── */}
                                                {(() => {
                                                    const threadId = dossier.message_thread_id as string | undefined
                                                    const msgs = threadId ? (chatMessages[threadId] || []) : []
                                                    const input = threadId ? (chatInput[threadId] || '') : ''
                                                    const sending = threadId ? (chatSending[threadId] || false) : false
                                                    const emailing = emailSending[(threadId || dossier.id as string) || ''] || false
                                                    return (
                                                        <div className="rounded-2xl border border-blue-500/15 overflow-hidden">
                                                            {/* Header */}
                                                            <div className="flex items-center justify-between px-4 py-3 bg-blue-500/5 border-b border-blue-500/10">
                                                                <div className="flex items-center gap-2">
                                                                    <MessageSquare size={14} className="text-blue-400" />
                                                                    <span className="text-xs font-black uppercase tracking-widest text-blue-400">Messagerie client</span>
                                                                    {!threadId && <span className="text-[10px] text-gray-600 ml-2">(dossier sans fil — créé avant la mise à jour)</span>}
                                                                </div>
                                                                {/* Bouton envoyer par email séparé */}
                                                                {threadId && input.trim() && (
                                                                    <button type="button"
                                                                        onClick={() => sendEmailReply(dossier, input)}
                                                                        disabled={emailing}
                                                                        className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                                                                    >
                                                                        {emailing ? <Loader2 size={10} className="animate-spin" /> : <Mail size={10} />}
                                                                        Envoyer aussi par email
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {/* Zone messages */}
                                                            {threadId ? (
                                                                <>
                                                                    <div className="max-h-52 overflow-y-auto p-3 space-y-2 bg-[#060d14]">
                                                                        {/* Message initial */}
                                                                        {Boolean(dossier.client_message) && msgs.length === 0 && (
                                                                            <div className="flex justify-start gap-2">
                                                                                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                                                    <User size={11} className="text-blue-400" />
                                                                                </div>
                                                                                <div className="bg-blue-500/10 border border-blue-500/15 rounded-xl rounded-bl-sm px-3 py-2 max-w-[80%]">
                                                                                    <p className="text-xs text-gray-200 whitespace-pre-wrap">{dossier.client_message as string}</p>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {msgs.map(m => (
                                                                            <div key={m.id} className={`flex gap-2 ${m.role === 'agent' ? 'justify-end' : 'justify-start'}`}>
                                                                                {m.role === 'client' && (
                                                                                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                                                        <User size={11} className="text-blue-400" />
                                                                                    </div>
                                                                                )}
                                                                                <div className={`rounded-xl px-3 py-2 max-w-[80%] text-xs ${m.role === 'agent'
                                                                                    ? 'bg-emerald-500/15 border border-emerald-500/20 text-gray-200 rounded-tr-sm'
                                                                                    : 'bg-blue-500/10 border border-blue-500/15 text-gray-200 rounded-bl-sm'
                                                                                }`}>
                                                                                    <p className="whitespace-pre-wrap">{m.content}</p>
                                                                                    <p className="text-[9px] text-gray-600 mt-1">{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                                                </div>
                                                                                {m.role === 'agent' && (
                                                                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                                                        <User size={11} className="text-emerald-400" />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                        {msgs.length === 0 && !dossier.client_message && (
                                                                            <p className="text-center text-[11px] text-gray-600 py-4">Aucun message échangé</p>
                                                                        )}
                                                                        <div ref={el => { chatBottomRefs.current[threadId] = el }} />
                                                                    </div>
                                                                    {/* Zone de saisie */}
                                                                    <div className="p-3 border-t border-blue-500/10 bg-[#060d14] flex gap-2">
                                                                        <textarea
                                                                            value={input}
                                                                            onChange={e => setChatInput(prev => ({ ...prev, [threadId]: e.target.value }))}
                                                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatReply(dossier) } }}
                                                                            placeholder="Répondre au client (instantané) · Entrée pour envoyer"
                                                                            rows={2}
                                                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-gray-600 text-xs focus:outline-none focus:border-blue-500/40 resize-none"
                                                                        />
                                                                        <button type="button"
                                                                            onClick={() => sendChatReply(dossier)}
                                                                            disabled={sending || !input.trim()}
                                                                            className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-40 shrink-0 self-end"
                                                                        >
                                                                            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                /* Pas de thread — proposer email direct */
                                                                <div className="p-4 space-y-3">
                                                                    <p className="text-xs text-gray-500">Ce dossier n&apos;a pas de fil de messagerie. Envoyez un email directement :</p>
                                                                    <div className="flex gap-2">
                                                                        <textarea
                                                                            value={chatInput[dossier.id as string] || ''}
                                                                            onChange={e => setChatInput(prev => ({ ...prev, [dossier.id as string]: e.target.value }))}
                                                                            placeholder="Message à envoyer par email..."
                                                                            rows={2}
                                                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-gray-600 text-xs focus:outline-none focus:border-amber-500/40 resize-none"
                                                                        />
                                                                        <button type="button"
                                                                            onClick={() => sendEmailReply(dossier, chatInput[dossier.id as string] || '')}
                                                                            disabled={emailing || !(chatInput[dossier.id as string] || '').trim()}
                                                                            className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-40 shrink-0 self-end"
                                                                        >
                                                                            {emailing ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })()}

                                                {/* Steps Management */}
                                                <div>
                                                    <h4 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4"><T>Étapes du dossier</T></h4>
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
                            <p className="font-bold"><T>Aucun dossier trouvé</T></p>
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
                                <h3 className="text-xl font-black font-heading"><T>Nouveau Dossier</T></h3>
                                <button onClick={() => setShowCreateModal(false)} title={t("Fermer")} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block"><T>N° Dossier</T></label>
                                    <input
                                        type="text"
                                        value={newDossier.num_dossier}
                                        onChange={e => setNewDossier({ ...newDossier, num_dossier: e.target.value })}
                                        placeholder={t("RG-2026-XXXXX")}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751] font-mono"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block"><T>Nom</T></label>
                                        <input
                                            type="text"
                                            value={newDossier.client_nom}
                                            onChange={e => setNewDossier({ ...newDossier, client_nom: e.target.value })}
                                            placeholder={t("Nom")}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block"><T>Prénom</T></label>
                                        <input
                                            type="text"
                                            value={newDossier.client_prenom}
                                            onChange={e => setNewDossier({ ...newDossier, client_prenom: e.target.value })}
                                            placeholder={t("Prénom")}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751]"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block"><T>Email</T></label>
                                    <input
                                        type="email"
                                        value={newDossier.client_email}
                                        onChange={e => setNewDossier({ ...newDossier, client_email: e.target.value })}
                                        placeholder={t("client@email.com")}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block"><T>WhatsApp</T></label>
                                    <input
                                        type="tel"
                                        value={newDossier.client_whatsapp}
                                        onChange={e => setNewDossier({ ...newDossier, client_whatsapp: e.target.value })}
                                        placeholder={t("+229 XX XX XX XX")}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block"><T>Service</T></label>
                                    <input
                                        type="text"
                                        value={newDossier.service_type}
                                        onChange={e => setNewDossier({ ...newDossier, service_type: e.target.value })}
                                        placeholder={t("Ex: Passeport & Documents")}
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
