'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { FileText, MagnifyingGlass as Search, Plus, Clock, CheckCircle as CheckCircle2, CircleNotch as Loader2, Eye, X, Calendar, Envelope as Mail, Phone, Note as StickyNote, ArrowRight, WarningCircle as AlertCircle, FileText as FileWarning, PaperPlaneTilt as Send, ChatText as MessageSquare, User, Download, Trash as Trash2 } from '@phosphor-icons/react';
import type { Icon as LucideIcon } from '@phosphor-icons/react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

type DossierStatus = 'reception' | 'verification' | 'traitement' | 'validation' | 'finalisation' | 'termine'

interface Dossier {
    id: string
    num_dossier: string
    client_nom: string
    client_prenom: string
    client_email: string
    client_phone: string
    service_type: string
    statut: DossierStatus
    etapes: Record<string, unknown>[]
    created_at: string
    updated_at?: string
    notes?: string
    progression?: number
    documents_manquants?: string[]
    client_message?: string
    message_thread_id?: string
    dossier_ref_id?: string
    agent_assigne?: string | null
    source?: string
}

interface DossierDoc {
    id: string
    dossier_id: string
    file_name?: string
    filename?: string
    file_url?: string
    url?: string
    storage_path?: string
    sourceTable: string
}

interface ChatMsg {
    id: string
    role: string
    content: string
    created_at: string
}

const columns: { id: DossierStatus; label: string; color: string; icon: LucideIcon }[] = [
    { id: 'reception', label: 'Réception', color: 'border-sky-500/30 bg-sky-500/5', icon: Plus },
    { id: 'verification', label: 'Vérification', color: 'border-amber-500/30 bg-amber-500/5', icon: Clock },
    { id: 'traitement', label: 'Traitement', color: 'border-emerald-500/30 bg-emerald-500/5', icon: Loader2 },
    { id: 'validation', label: 'Validation', color: 'border-blue-500/30 bg-blue-500/5', icon: Eye },
    { id: 'finalisation', label: 'Finalisation', color: 'border-purple-500/30 bg-purple-500/5', icon: ArrowRight },
    { id: 'termine', label: 'Terminé', color: 'border-green-500/30 bg-green-500/5', icon: CheckCircle2 },
]

export default function AgentDossiersPage() {
    const [dossiers, setDossiers] = useState<Dossier[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [currentUserId, setCurrentUserId] = useState('')
    const [onlyMine, setOnlyMine] = useState(false)
    // Filtre « Service Mobile Dossier » : dossiers ouverts depuis l'app mobile.
    const [mobileOnly, setMobileOnly] = useState(false)
    const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null)
    const [noteText, setNoteText] = useState('')
    const [docRequest, setDocRequest] = useState('')
    const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([])
    const [dossierDocs, setDossierDocs] = useState<DossierDoc[]>([])
    const [loadingDocs, setLoadingDocs] = useState(false)
    const [chatInput, setChatInput] = useState('')
    const [chatSending, setChatSending] = useState(false)
    const [emailSending, setEmailSending] = useState(false)
    const chatBottomRef = useRef<HTMLDivElement>(null)

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

    const loadDossierDocs = async (trackingId: string, refId?: string) => {
        setLoadingDocs(true)
        const ids = [trackingId, refId].filter(Boolean) as string[]

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

    const handleDeleteDossierDoc = async (doc: DossierDoc) => {
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

    const handleDeleteDossier = async (dossier: Dossier) => {
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

            setDossiers(prev => prev.filter(d => d.id !== dossier.id));
            setSelectedDossier(null);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Erreur lors de la suppression complète');
        }
    };

    const loadChat = async (threadId: string) => {
        const { data } = await supabase
            .from('chat_messages')
            .select('id, role, content, created_at')
            .eq('conversation_id', threadId)
            .order('created_at', { ascending: true })
        setChatMsgs((data || []) as ChatMsg[])
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
    }

    const sendChatReply = async () => {
        if (!selectedDossier?.message_thread_id || !chatInput.trim() || chatSending) return
        setChatSending(true)
        const content = chatInput.trim()
        setChatInput('')
        const { data } = await supabase
            .from('chat_messages')
            .insert({ conversation_id: selectedDossier.message_thread_id, role: 'agent', content })
            .select('id, role, content, created_at')
            .single()
        if (data) {
            setChatMsgs(prev => [...prev, data as ChatMsg])
            setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
        setChatSending(false)
    }

    const sendEmailReply = async (message: string) => {
        if (!selectedDossier?.client_email || !message.trim()) return
        setEmailSending(true)
        try {
            await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: selectedDossier.client_email,
                    subject: `Réponse à votre dossier ${selectedDossier.num_dossier}`,
                    clientName: `${selectedDossier.client_prenom} ${selectedDossier.client_nom}`.trim() || 'Client',
                    context: 'dossierUpdate',
                    relatedId: selectedDossier.num_dossier,
                    dossierNumero: selectedDossier.num_dossier,
                    progression: selectedDossier.progression || 0,
                    message,
                    documentsManquants: selectedDossier.documents_manquants || [],
                    trackerUrl: `${window.location.origin}/suivi-dossier`,
                }),
            })
        } catch (e) { console.error(e) }
        setEmailSending(false)
    }

    const addMissingDocument = async () => {
        if (!docRequest.trim() || !selectedDossier) return
        const newDocs = [...(selectedDossier.documents_manquants || []), docRequest.trim()]
        
        setDossiers(prev => prev.map(d => d.id === selectedDossier.id ? { ...d, documents_manquants: newDocs } : d))
        setSelectedDossier({ ...selectedDossier, documents_manquants: newDocs })
        setDocRequest('')
        
        await supabase.from('dossier_tracking').update({ documents_manquants: newDocs }).eq('id', selectedDossier.id)

        // Envoi Email
        try {
            await fetch('/api/email/send', {
                method: 'POST',
                body: JSON.stringify({
                    to: selectedDossier.client_email,
                    subject: 'Action Requise : Document manquant pour votre dossier',
                    clientName: selectedDossier.client_prenom + ' ' + selectedDossier.client_nom,
                    context: 'dossierUpdate',
                    relatedId: selectedDossier.num_dossier,
                    dossierNumero: selectedDossier.num_dossier,
                    progression: selectedDossier.progression || 0,
                    message: "Afin de poursuivre le traitement de votre dossier, veuillez nous fournir de toute urgence le(s) document(s) bloquant(s).",
                    documentsManquants: newDocs,
                    trackerUrl: `${window.location.origin}/suivi-dossier`
                })
            })
        } catch (e) { console.error('Erreur send email doc:', e) }
    }
    
    const removeMissingDocument = async (docToRemove: string) => {
        if (!selectedDossier) return
        const newDocs = (selectedDossier.documents_manquants || []).filter(d => d !== docToRemove)
        
        setDossiers(prev => prev.map(d => d.id === selectedDossier.id ? { ...d, documents_manquants: newDocs } : d))
        setSelectedDossier({ ...selectedDossier, documents_manquants: newDocs })
        
        await supabase.from('dossier_tracking').update({ documents_manquants: newDocs }).eq('id', selectedDossier.id)
    }

    useEffect(() => {
        const fetchDossiers = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) setCurrentUserId(user.id)

            const { data } = await supabase
                .from('dossier_tracking')
                .select('*')
                .order('created_at', { ascending: false })

            setDossiers((data || []) as Dossier[])
            setLoading(false)
        }
        fetchDossiers()

        // Realtime: auto-refresh when dossier_tracking changes
        const channel = supabase
            .channel('agent-dossiers-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'dossier_tracking',
            }, () => { fetchDossiers() })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    const updateStatus = async (dossierId: string, newStatus: DossierStatus) => {
        const statusProgressionMap: Record<DossierStatus, number> = {
            reception: 10,
            verification: 30,
            traitement: 60,
            validation: 80,
            finalisation: 95,
            termine: 100
        }
        const progression = statusProgressionMap[newStatus];
        const updated_at = new Date().toISOString();

        setDossiers(prev => prev.map(d => d.id === dossierId ? { ...d, statut: newStatus, progression, updated_at } : d))
        
        // Update dossier_tracking (agent table)
        await supabase
            .from('dossier_tracking')
            .update({ statut: newStatus, progression, updated_at })
            .eq('id', dossierId)

        // ── Sync to dossiers table (mobile table) via dossier_ref_id ──
        const dossierEntry = dossiers.find(x => x.id === dossierId);
        const dossierRefId = dossierEntry?.dossier_ref_id;
        if (dossierRefId) {
            const mobileStatusMap: Record<DossierStatus, string> = {
                reception: 'soumis',
                verification: 'verifie',
                traitement: 'traitement',
                validation: 'validation',
                finalisation: 'validation',
                termine: 'termine',
            }
            await supabase
                .from('dossiers')
                .update({
                    status: mobileStatusMap[newStatus],
                    progress: progression,
                    updated_at,
                })
                .eq('id', dossierRefId)
        }

        const d = dossiers.find(x => x.id === dossierId);
        if (d && d.client_email) {
            try {
                await fetch('/api/email/send', {
                    method: 'POST',
                    body: JSON.stringify({
                        to: d.client_email,
                        subject: 'Mise à jour de votre dossier : ' + newStatus.toUpperCase(),
                        clientName: d.client_prenom + ' ' + d.client_nom,
                        context: 'dossierUpdate',
                        relatedId: d.num_dossier,
                        dossierNumero: d.num_dossier,
                        progression: progression,
                        message: `Votre dossier a avancé d'une étape et est actuellement en phase de **${newStatus.toUpperCase()}**.`,
                        documentsManquants: d.documents_manquants || [],
                        trackerUrl: `${window.location.origin}/suivi-dossier`
                    })
                })
            } catch (e) {
                console.error('Erreur send email status:', e);
            }
        }
    }

    const onDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result

        if (!destination) return

        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return
        }

        const newStatus = destination.droppableId as DossierStatus
        updateStatus(draggableId, newStatus)
    }

    const filtered = dossiers.filter(d => {
        // Filtre « Mes dossiers » : uniquement ceux dont je suis responsable.
        if (onlyMine && d.agent_assigne !== currentUserId) return false
        // Filtre « Service Mobile » : uniquement les dossiers ouverts depuis l'app.
        if (mobileOnly && d.source !== 'mobile') return false
        const q = search.toLowerCase()
        return d.num_dossier?.toLowerCase().includes(q)
            || d.client_nom?.toLowerCase().includes(q)
            || d.client_email?.toLowerCase().includes(q)
    })

    const mineCount = dossiers.filter(d => d.agent_assigne === currentUserId).length
    const mobileCount = dossiers.filter(d => d.source === 'mobile').length

    const getDossiersByStatus = (status: DossierStatus) =>
        filtered.filter(d => d.statut === status)

    // Prendre en charge (ou lâcher) un dossier à son propre nom.
    const toggleMine = async (dossier: Dossier) => {
        const prendre = dossier.agent_assigne !== currentUserId
        const nouvel = prendre ? currentUserId : null
        setDossiers(prev => prev.map(d => d.id === dossier.id ? { ...d, agent_assigne: nouvel } : d))
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch('/api/admin/dossiers/assign', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                },
                body: JSON.stringify({ dossier_id: dossier.id, agent_id: nouvel }),
            })
            if (!res.ok) {
                // Rollback visuel si le serveur refuse.
                setDossiers(prev => prev.map(d => d.id === dossier.id ? { ...d, agent_assigne: dossier.agent_assigne } : d))
            }
        } catch {
            setDossiers(prev => prev.map(d => d.id === dossier.id ? { ...d, agent_assigne: dossier.agent_assigne } : d))
        }
    }

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
                    <h1 className="text-2xl font-black text-white">Mes Dossiers (Kanban)</h1>
                    <p className="text-gray-500 text-sm mt-1">{dossiers.length} dossier(s) au total • <span className="text-emerald-400">Glissez-déposez pour changer le statut</span></p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Bascule « Mes dossiers » : ceux dont je suis responsable. */}
                    <button
                        type="button"
                        onClick={() => setOnlyMine(v => !v)}
                        className={`py-2.5 px-3.5 rounded-xl text-sm font-bold border transition-colors whitespace-nowrap ${onlyMine
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white/5 text-gray-400 border-white/10 hover:border-emerald-500/40'}`}
                        title="N'afficher que les dossiers dont je suis responsable"
                    >
                        Mes dossiers{mineCount > 0 ? ` (${mineCount})` : ''}
                    </button>
                    {/* Bascule « Service Mobile Dossier » : ouverts depuis l'app mobile. */}
                    <button
                        type="button"
                        onClick={() => setMobileOnly(v => !v)}
                        className={`py-2.5 px-3.5 rounded-xl text-sm font-bold border transition-colors whitespace-nowrap ${mobileOnly
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white/5 text-gray-400 border-white/10 hover:border-emerald-500/40'}`}
                        title="N'afficher que les dossiers ouverts depuis l'application mobile"
                    >
                        📱 Service Mobile{mobileCount > 0 ? ` (${mobileCount})` : ''}
                    </button>
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Rechercher..."
                            title="Rechercher un dossier"
                            className="bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm w-full md:w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
                    {columns.map((column) => {
                        const items = getDossiersByStatus(column.id)
                        const ColumnIcon = column.icon

                        return (
                            <Droppable droppableId={column.id} key={column.id}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`rounded-2xl border transition-colors duration-300 p-4 min-h-[500px] flex flex-col ${snapshot.isDraggingOver
                                            ? 'bg-emerald-500/10 border-emerald-500/50'
                                            : column.color
                                            }`}
                                    >
                                        {/* Column Header */}
                                        <div className="flex items-center justify-between mb-4 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <ColumnIcon size={16} className="text-gray-400" />
                                                <span className="text-sm font-bold text-white">{column.label}</span>
                                            </div>
                                            <span className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-full text-gray-300">
                                                {items.length}
                                            </span>
                                        </div>

                                        {/* Cards Container */}
                                        <div className="flex-1 space-y-3">
                                            {items.map((d, index) => (
                                                <Draggable key={d.id} draggableId={d.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`bg-[#0a1210] border rounded-xl p-4 cursor-grab hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all group ${snapshot.isDragging ? 'border-emerald-500 shadow-2xl scale-105 z-50' : 'border-white/5'
                                                                }`}
                                                            onClick={() => {
                                                                setSelectedDossier(d)
                                                                setNoteText(d.notes || '')
                                                                setChatMsgs([])
                                                                setChatInput('')
                                                                if (d.message_thread_id) loadChat(d.message_thread_id)
                                                                // Toujours charger les documents en cherchant par les 2 IDs possibles
                                                                loadDossierDocs(d.id, d.dossier_ref_id)
                                                            }}
                                                        >
                                                            <div className="flex items-start justify-between mb-2">
                                                                <span className="text-xs font-mono text-emerald-400 font-bold">{d.num_dossier}</span>
                                                                <div className="flex items-center gap-2">
                                                                    {/* Prise en charge : à moi (plein) ou libre (contour). */}
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); toggleMine(d) }}
                                                                        title={d.agent_assigne === currentUserId ? 'Vous êtes responsable : cliquez pour lâcher' : d.agent_assigne ? 'Assigné à un autre agent : cliquez pour reprendre' : 'Prendre en charge'}
                                                                        className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border transition-colors ${d.agent_assigne === currentUserId
                                                                            ? 'bg-emerald-500 text-white border-emerald-500'
                                                                            : d.agent_assigne
                                                                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                                                                : 'bg-white/5 text-gray-500 border-white/15 hover:border-emerald-500/40'}`}
                                                                    >
                                                                        {d.agent_assigne === currentUserId ? 'MOI' : d.agent_assigne ? 'PRIS' : 'LIBRE'}
                                                                    </button>
                                                                    {(d.documents_manquants?.length ?? 0) > 0 && (
                                                                        <span title="Vérification requise : Documents manquants">
                                                                            <FileWarning size={14} className="text-red-400 animate-pulse" />
                                                                        </span>
                                                                    )}
                                                                    {(() => {
                                                                        const lastUpdate = d.updated_at || d.created_at;
                                                                        const lastUpdateTime = lastUpdate && !isNaN(new Date(lastUpdate).getTime()) ? new Date(lastUpdate).getTime() : null;
                                                                        const isStagnant = lastUpdateTime !== null && (new Date().getTime() - lastUpdateTime > 3 * 24 * 60 * 60 * 1000);
                                                                        return isStagnant && d.statut !== 'termine' ? (
                                                                            <span title="Dossier stagnant : Aucune avancée depuis 3 jours">
                                                                                <AlertCircle size={14} className="text-amber-500" />
                                                                            </span>
                                                                        ) : null;
                                                                    })()}
                                                                    <Eye size={14} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
                                                                </div>
                                                            </div>
                                                            <p className="text-sm font-semibold text-white mb-1">{d.client_nom} {d.client_prenom}</p>
                                                            <p className="text-[11px] text-gray-500">{d.service_type}</p>
                                                            
                                                            <div className="flex items-center justify-between mt-3">
                                                                <div className="flex items-center gap-1 text-[10px] text-gray-600">
                                                                    <Calendar size={10} />
                                                                    {d.created_at && !isNaN(new Date(d.created_at).getTime())
                                                                        ? new Date(d.created_at).toLocaleDateString('fr-FR')
                                                                        : '-'}
                                                                </div>
                                                                <span className="text-[10px] font-mono text-emerald-500/80 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                                                    {d.progression || 0}%
                                                                </span>
                                                            </div>

                                                            {/* Quick Status Change */}
                                                            {column.id !== 'termine' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        const nextStatus: Record<string, DossierStatus> = {
                                                                            reception: 'verification',
                                                                            verification: 'traitement',
                                                                            traitement: 'validation',
                                                                            validation: 'finalisation',
                                                                            finalisation: 'termine',
                                                                        }
                                                                        updateStatus(d.id, nextStatus[column.id])
                                                                    }}
                                                                    className="mt-3 w-full flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-400/80 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg py-1.5 transition-all opacity-0 group-hover:opacity-100"
                                                                >
                                                                    Avancer <ArrowRight size={10} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                            {items.length === 0 && !snapshot.isDraggingOver && (
                                                <div className="text-center py-8 text-gray-600/50 text-xs border border-dashed border-white/5 rounded-xl">
                                                    Déposez un dossier ici
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Droppable>
                        )
                    })}
                </div>
            </DragDropContext>

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
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleDeleteDossier(selectedDossier)}
                                        title="Supprimer le dossier"
                                        className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => setSelectedDossier(null)}
                                        title="Fermer"
                                        className="p-2 rounded-lg hover:bg-white/5 text-gray-400"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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
                                    <span>
                                        {selectedDossier.created_at && !isNaN(new Date(selectedDossier.created_at).getTime())
                                            ? new Date(selectedDossier.created_at).toLocaleDateString('fr-FR')
                                            : '-'}
                                    </span>
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
                                                setSelectedDossier({ ...selectedDossier, statut: col.id })
                                            }}
                                            className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${selectedDossier.statut === col.id
                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                : 'bg-white/5 text-gray-500 border-white/10 hover:text-white'
                                                }`}
                                        >
                                            {col.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Documents Fournis */}
                            <div className="mb-6">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <FileText size={12} /> Documents fournis par le client
                                </p>
                                <div className="space-y-2">
                                    {loadingDocs ? (
                                        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                                            <Loader2 size={14} className="animate-spin" /> Chargement des documents...
                                        </div>
                                    ) : dossierDocs.length > 0 ? (
                                        dossierDocs.map(doc => (
                                            <div key={doc.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <FileText size={14} className="text-emerald-400 shrink-0" />
                                                    <span className="text-gray-300 truncate">{doc.file_name || doc.filename}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {doc.file_url && (
                                                        <a 
                                                            href={doc.file_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 rounded transition-colors"
                                                            title="Télécharger/Voir"
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
                                            Aucun document fourni pour le moment.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Documents Manquants */}
                            <div className="mb-6">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <FileWarning size={12} className={selectedDossier.documents_manquants?.length ? 'text-red-400' : ''} />
                                    Vérifications & Documents Requis
                                </p>
                                <div className="space-y-2 mb-3">
                                    {(selectedDossier.documents_manquants || []).map((doc, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 text-sm">
                                            <span className="text-red-300/90 font-medium">{doc}</span>
                                            <button 
                                                onClick={() => removeMissingDocument(doc)} 
                                                title="Marquer comme reçu"
                                                className="text-red-400/50 hover:text-green-400 hover:bg-green-500/10 p-1 rounded transition-colors"
                                            >
                                                <CheckCircle2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {(!selectedDossier.documents_manquants || selectedDossier.documents_manquants.length === 0) && (
                                        <p className="text-xs text-emerald-400/70 bg-emerald-500/5 px-3 py-2 rounded-lg border border-emerald-500/10">
                                            Tous les documents sont en ordre.
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={docRequest}
                                        onChange={(e) => setDocRequest(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addMissingDocument()}
                                        placeholder="Réclamer un document au client (Ex: Scan Passeport)"
                                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50 text-sm"
                                    />
                                    <button
                                        onClick={addMissingDocument}
                                        title="Notifier le client"
                                        className="bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-400 px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                                    >
                                        <Send size={14} /> Relancer
                                    </button>
                                </div>
                            </div>

                            {/* ── Messagerie client ── */}
                            <div className="rounded-2xl border border-blue-500/15 overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-3 bg-blue-500/5 border-b border-blue-500/10">
                                    <MessageSquare size={13} className="text-blue-400" />
                                    <span className="text-xs font-black uppercase tracking-widest text-blue-400">Messagerie client</span>
                                </div>

                                {selectedDossier?.message_thread_id ? (
                                    <>
                                        {/* Messages */}
                                        <div className="max-h-48 overflow-y-auto p-3 space-y-2 bg-[#060c12]">
                                            {selectedDossier.client_message && chatMsgs.length === 0 && (
                                                <div className="flex gap-2 justify-start">
                                                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                        <User size={10} className="text-blue-400" />
                                                    </div>
                                                    <div className="bg-blue-500/10 border border-blue-500/15 rounded-xl rounded-bl-sm px-3 py-2 max-w-[80%]">
                                                        <p className="text-xs text-gray-200 whitespace-pre-wrap">{selectedDossier.client_message}</p>
                                                    </div>
                                                </div>
                                            )}
                                            {chatMsgs.map(m => (
                                                <div key={m.id} className={`flex gap-2 ${m.role === 'agent' ? 'justify-end' : 'justify-start'}`}>
                                                    {m.role === 'client' && (
                                                        <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                            <User size={10} className="text-blue-400" />
                                                        </div>
                                                    )}
                                                    <div className={`rounded-xl px-3 py-2 max-w-[80%] text-xs ${m.role === 'agent'
                                                        ? 'bg-emerald-500/15 border border-emerald-500/20 rounded-tr-sm'
                                                        : 'bg-blue-500/10 border border-blue-500/15 rounded-bl-sm'
                                                    } text-gray-200`}>
                                                        <p className="whitespace-pre-wrap">{m.content}</p>
                                                        <p className="text-[9px] text-gray-600 mt-1">
                                                            {m.created_at && !isNaN(new Date(m.created_at).getTime())
                                                                ? new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                                                                : '-'}
                                                        </p>
                                                    </div>
                                                    {m.role === 'agent' && (
                                                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                            <User size={10} className="text-emerald-400" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {chatMsgs.length === 0 && !selectedDossier.client_message && (
                                                <p className="text-center text-[11px] text-gray-600 py-3">Aucun message échangé</p>
                                            )}
                                            <div ref={chatBottomRef} />
                                        </div>
                                        {/* Zone saisie */}
                                        <div className="p-3 border-t border-blue-500/10 flex gap-2 bg-[#060c12]">
                                            <textarea
                                                value={chatInput}
                                                onChange={e => setChatInput(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatReply() } }}
                                                placeholder="Répondre au client · Entrée pour envoyer"
                                                rows={2}
                                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-gray-600 text-xs focus:outline-none focus:border-blue-500/40 resize-none"
                                            />
                                            <div className="flex flex-col gap-1.5 shrink-0 self-end">
                                                <button type="button" onClick={sendChatReply} disabled={chatSending || !chatInput.trim()}
                                                    title="Envoyer le message instantané"
                                                    className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 flex items-center justify-center disabled:opacity-40 transition-colors">
                                                    {chatSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                                </button>
                                                <button type="button" onClick={() => sendEmailReply(chatInput)} disabled={emailSending || !chatInput.trim()}
                                                    title="Envoyer aussi par email"
                                                    className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 flex items-center justify-center disabled:opacity-40 transition-colors">
                                                    {emailSending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-4 space-y-2">
                                        <p className="text-xs text-gray-500">Pas de fil de messagerie : envoyez un email :</p>
                                        <div className="flex gap-2">
                                            <textarea
                                                value={chatInput}
                                                onChange={e => setChatInput(e.target.value)}
                                                placeholder="Message à envoyer par email..."
                                                rows={2}
                                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-gray-600 text-xs focus:outline-none focus:border-amber-500/40 resize-none"
                                            />
                                            <button type="button" onClick={() => sendEmailReply(chatInput)} disabled={emailSending || !chatInput.trim()}
                                                className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 flex items-center justify-center disabled:opacity-40 transition-colors self-end">
                                                {emailSending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                                            </button>
                                        </div>
                                    </div>
                                )}
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
