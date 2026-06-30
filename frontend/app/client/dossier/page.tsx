'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    FolderOpen, CheckCircle2, Clock, AlertCircle, ChevronRight, Calendar,
    Upload, FileUp, Trash2, Paperclip, Loader2, ShoppingBag, Package,
    CheckSquare, Square, RefreshCw, XCircle, ChevronDown,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────

interface Dossier {
    id: string
    num_dossier: string
    service_type: string
    service?: string
    statut: string
    progression: number
    etapes: { id?: number; label?: string; status: string; date?: string | null; note?: string }[]
    documents_manquants: string[]
    notes?: string
    notes_internes?: string
    created_at: string
    updated_at: string
}

interface Order {
    id: string
    product_title: string
    amount: number
    currency: string
    payment_status: string
    created_at: string
}

interface ClientDoc {
    id: string
    nom_fichier: string
    type_fichier: string
    taille: number
    url: string
    storage_path: string
    created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    reception:    { label: 'Réception',    color: 'text-blue-400',    bg: 'bg-blue-500/15' },
    verification: { label: 'Vérification', color: 'text-indigo-400',  bg: 'bg-indigo-500/15' },
    traitement:   { label: 'Traitement',   color: 'text-amber-400',   bg: 'bg-amber-500/15' },
    validation:   { label: 'Validation',   color: 'text-purple-400',  bg: 'bg-purple-500/15' },
    finalisation: { label: 'Finalisation', color: 'text-teal-400',    bg: 'bg-teal-500/15' },
    termine:      { label: 'Terminé',      color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    annule:       { label: 'Annulé',       color: 'text-gray-400',    bg: 'bg-gray-500/15' },
}

const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
    pending:   { label: 'En attente',  color: 'text-amber-400',   bg: 'bg-amber-500/15' },
    completed: { label: 'Livré',       color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    paid:      { label: 'Livré',       color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    succeeded: { label: 'Livré',       color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    failed:    { label: 'Échoué',      color: 'text-red-400',     bg: 'bg-red-500/15' },
    refunded:  { label: 'Remboursé',   color: 'text-gray-400',    bg: 'bg-gray-500/15' },
}

const ETAPES_LABELS = [
    'Réception du dossier',
    'Vérification des documents',
    'Traitement administratif',
    'Validation des autorités',
    'Finalisation',
    'Dossier clôturé',
]

const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
const fmtDate = (d: string) => {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR')
}
const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR')

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif'
const MAX_SIZE_MB = 50

// ── Composant principal ───────────────────────────────────────────

export default function ClientDossierPage() {
    const [dossiers, setDossiers] = useState<Dossier[]>([])
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [userId, setUserId] = useState('')
    const [userEmail, setUserEmail] = useState('')

    // Upload
    const [uploadingDossier, setUploadingDossier] = useState<string | null>(null)
    const [docsByDossier, setDocsByDossier] = useState<Record<string, ClientDoc[]>>({})
    const [expandedDossier, setExpandedDossier] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const activeDossierRef = useRef<string | null>(null)

    // Selection / suppression
    const [selectionMode, setSelectionMode] = useState(false)
    const [selectedDossiers, setSelectedDossiers] = useState<Set<string>>(new Set())
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
    const [deleting, setDeleting] = useState(false)

    // ── Fetch docs ─────────────────────────────────────────────────

    const fetchDocs = useCallback(async (dossierId: string) => {
        const { data } = await supabase
            .from('client_documents')
            .select('id, nom_fichier, type_fichier, taille, url, storage_path, created_at')
            .eq('dossier_id', dossierId)
            .order('created_at', { ascending: false })
        setDocsByDossier(prev => ({ ...prev, [dossierId]: (data as ClientDoc[]) || [] }))
    }, [])

    // ── Load principal ─────────────────────────────────────────────

    const load = useCallback(async (uid: string, email: string, silent = false) => {
        if (!silent) return
        setRefreshing(true)

        const [{ data: dossierData }, { data: ordersData }] = await Promise.all([
            supabase
                .from('dossier_tracking')
                .select('*')
                .or(`client_id.eq.${uid},client_email.eq.${email}`)
                .order('created_at', { ascending: false }),
            supabase
                .from('orders')
                .select('id, product_title, amount, currency, payment_status, created_at')
                .or(`client_id.eq.${uid},client_email.eq.${email}`)
                .order('created_at', { ascending: false }),
        ])

        const dossierList = (dossierData as Dossier[]) || []
        const orderList = (ordersData as Order[]) || []

        // Auto-corriger les dossiers boutique selon le statut de paiement de l'ordre
        const orderMap = new Map(orderList.map(o => [o.id, o]))
        const autoFixPromises: Promise<void>[] = []

        for (const d of dossierList) {
            const isCmd = d.num_dossier?.match(/^RG-CMD-(.+)$/)
            if (isCmd) {
                const orderId = isCmd[1]
                const order = orderMap.get(orderId)
                if (order && ['completed', 'paid', 'succeeded'].includes(order.payment_status) && d.statut !== 'termine') {
                    autoFixPromises.push(
                        (async () => {
                            await supabase.from('dossier_tracking').update({ statut: 'termine', progression: 100 }).eq('id', d.id)
                            d.statut = 'termine'
                            d.progression = 100
                        })()
                    )
                }
            }
        }

        await Promise.all(autoFixPromises)

        setDossiers(dossierList)
        setOrders(orderList)
        setRefreshing(false)
    }, [])

    // ── Init ───────────────────────────────────────────────────────

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) return
            const uid = session.user.id
            const email = session.user.email || ''
            setUserId(uid)
            setUserEmail(email)

            const [{ data: dossierData }, { data: ordersData }] = await Promise.all([
                supabase
                    .from('dossier_tracking')
                    .select('*')
                    .or(`client_id.eq.${uid},client_email.eq.${email}`)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('orders')
                    .select('id, product_title, amount, currency, payment_status, created_at')
                    .or(`client_id.eq.${uid},client_email.eq.${email}`)
                    .order('created_at', { ascending: false }),
            ])

            const dossierList = (dossierData as Dossier[]) || []
            const orderList = (ordersData as Order[]) || []

            // Auto-correction boutique
            const orderMap = new Map(orderList.map(o => [o.id, o]))
            const fixes: Promise<void>[] = []

            for (const d of dossierList) {
                const isCmd = d.num_dossier?.match(/^RG-CMD-(.+)$/)
                if (isCmd) {
                    const order = orderMap.get(isCmd[1])
                    if (order && ['completed', 'paid', 'succeeded'].includes(order.payment_status) && d.statut !== 'termine') {
                        fixes.push(
                            (async () => {
                                await supabase.from('dossier_tracking').update({ statut: 'termine', progression: 100 }).eq('id', d.id)
                                d.statut = 'termine'
                                d.progression = 100
                            })()
                        )
                    }
                }
            }

            await Promise.all(fixes)
            setDossiers(dossierList)
            setOrders(orderList)
            await Promise.all(dossierList.map(d => fetchDocs(d.id)))
            setLoading(false)
        }
        init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Realtime ───────────────────────────────────────────────────

    useEffect(() => {
        if (!userId) return
        const channel = supabase
            .channel(`client-dossier-${userId}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'dossier_tracking', filter: `client_id=eq.${userId}` },
                () => load(userId, userEmail, true)
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'orders', filter: `client_id=eq.${userId}` },
                () => load(userId, userEmail, true)
            )
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, userEmail])

    // ── Upload ─────────────────────────────────────────────────────

    const handleUploadClick = (dossierId: string) => {
        activeDossierRef.current = dossierId
        fileInputRef.current?.click()
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        const dossierId = activeDossierRef.current
        if (!file || !dossierId || !userId) return
        e.target.value = ''

        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            alert(`Fichier trop volumineux (max ${MAX_SIZE_MB} MB)`)
            return
        }
        setUploadingDossier(dossierId)
        try {
            const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
            const path = `${userId}/${dossierId}/${fileName}`
            const { error: uploadError } = await supabase.storage
                .from('client-documents').upload(path, file, { cacheControl: '3600', upsert: false })
            if (uploadError) throw new Error(uploadError.message)
            const { data: signedData } = await supabase.storage
                .from('client-documents').createSignedUrl(path, 60 * 60 * 24 * 7)
            await supabase.from('client_documents').insert({
                client_id: userId, dossier_id: dossierId,
                nom_fichier: file.name, type_fichier: file.type,
                taille: file.size, url: signedData?.signedUrl || '',
                storage_path: path,
            })
            await fetchDocs(dossierId)
            setExpandedDossier(dossierId)
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Erreur lors de l\'upload')
        } finally {
            setUploadingDossier(null)
        }
    }

    const handleDeleteDoc = async (docId: string, storagePath: string, dossierId: string) => {
        if (!confirm('Supprimer ce fichier ?')) return
        await supabase.storage.from('client-documents').remove([storagePath])
        await supabase.from('client_documents').delete().eq('id', docId)
        await fetchDocs(dossierId)
    }

    const refreshSignedUrl = async (storagePath: string) => {
        const { data } = await supabase.storage.from('client-documents').createSignedUrl(storagePath, 60 * 60)
        return data?.signedUrl || ''
    }

    // ── Suppression ────────────────────────────────────────────────

    const handleDeleteDossier = async (id: string) => {
        if (!confirm('Supprimer ce dossier ?')) return
        try {
            const { data: docs } = await supabase.from('client_documents').select('storage_path, id').eq('dossier_id', id)
            if (docs && docs.length > 0) {
                const paths = docs.map(d => d.storage_path).filter(Boolean)
                if (paths.length > 0) {
                    await supabase.storage.from('client-documents').remove(paths)
                }
                await supabase.from('client_documents').delete().eq('dossier_id', id)
            }
        } catch (e) {
            console.error('Failed to cleanup physical files:', e)
        }
        await supabase.from('dossier_tracking').delete().eq('id', id)
        setDossiers(prev => prev.filter(d => d.id !== id))
    }

    const handleDeleteOrder = async (id: string) => {
        if (!confirm('Supprimer cette commande de la liste ?')) return
        await supabase.from('orders').delete().eq('id', id)
        setOrders(prev => prev.filter(o => o.id !== id))
    }

    const toggleDossierSelect = (id: string) => {
        setSelectedDossiers(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const toggleOrderSelect = (id: string) => {
        setSelectedOrders(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const handleBulkDelete = async () => {
        const totalCount = selectedDossiers.size + selectedOrders.size
        if (totalCount === 0) return
        if (!confirm(`Supprimer ${totalCount} élément(s) sélectionné(s) ?`)) return
        setDeleting(true)
        try {
            const dossierIds = Array.from(selectedDossiers)
            if (dossierIds.length > 0) {
                const { data: docs } = await supabase.from('client_documents').select('storage_path, id').in('dossier_id', dossierIds)
                if (docs && docs.length > 0) {
                    const paths = docs.map(d => d.storage_path).filter(Boolean)
                    if (paths.length > 0) {
                        await supabase.storage.from('client-documents').remove(paths)
                    }
                    await supabase.from('client_documents').delete().in('dossier_id', dossierIds)
                }
            }
        } catch (e) {
            console.error('Failed to cleanup physical files for bulk delete:', e)
        }
        const ops: Promise<unknown>[] = []
        selectedDossiers.forEach(id => ops.push(supabase.from('dossier_tracking').delete().eq('id', id) as unknown as Promise<unknown>))
        selectedOrders.forEach(id => ops.push(supabase.from('orders').delete().eq('id', id) as unknown as Promise<unknown>))
        await Promise.all(ops)
        setDossiers(prev => prev.filter(d => !selectedDossiers.has(d.id)))
        setOrders(prev => prev.filter(o => !selectedOrders.has(o.id)))
        setSelectedDossiers(new Set())
        setSelectedOrders(new Set())
        setSelectionMode(false)
        setDeleting(false)
    }

    // Commandes boutique sans dossier correspondant
    const matchedOrderIds = new Set(
        dossiers
            .map(d => d.num_dossier?.match(/^RG-CMD-(.+)$/)?.[1])
            .filter(Boolean) as string[]
    )
    const unmatchedOrders = orders.filter(o => !matchedOrderIds.has(o.id))

    const totalSelected = selectedDossiers.size + selectedOrders.size

    // ── Render ─────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="w-7 h-7 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
        )
    }

    const isEmpty = dossiers.length === 0 && unmatchedOrders.length === 0

    return (
        <div className="space-y-6">
            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} title="Fichier"
                className="hidden" onChange={handleFileChange} />

            {/* Header */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <FolderOpen size={14} className="text-indigo-400" />
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em]">Suivi Dossier</span>
                </div>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-black text-white">Mon Dossier & Commandes</h1>
                        <p className="text-gray-500 text-sm mt-1">Suivez vos dossiers et commandes en temps réel.</p>
                    </div>
                    {!isEmpty && (
                        <div className="flex items-center gap-2">
                            <button type="button"
                                onClick={() => load(userId, userEmail, true)}
                                disabled={refreshing}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-gray-400 hover:text-white text-[11px] font-bold transition-all disabled:opacity-50">
                                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                                Actualiser
                            </button>
                            <button type="button"
                                onClick={() => {
                                    setSelectionMode(s => !s)
                                    setSelectedDossiers(new Set())
                                    setSelectedOrders(new Set())
                                }}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${
                                    selectionMode
                                        ? 'bg-red-500/20 border-red-500/30 text-red-400'
                                        : 'bg-white/[0.04] border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.07]'
                                }`}>
                                {selectionMode ? <XCircle size={12} /> : <CheckSquare size={12} />}
                                {selectionMode ? 'Annuler' : 'Sélectionner'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Barre de suppression groupée */}
            <AnimatePresence>
                {selectionMode && totalSelected > 0 && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <p className="text-sm text-red-300 font-bold">{totalSelected} élément(s) sélectionné(s)</p>
                        <button type="button" onClick={handleBulkDelete} disabled={deleting}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[12px] font-bold transition-all disabled:opacity-50">
                            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            Supprimer la sélection
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {isEmpty ? (
                <div className="bg-[#0a1221] border border-white/[0.06] rounded-2xl p-12 text-center">
                    <FolderOpen size={40} className="text-gray-700 mx-auto mb-4" />
                    <h2 className="text-white font-bold mb-2">Aucun dossier ni commande</h2>
                    <p className="text-gray-500 text-sm">Vos dossiers et commandes apparaîtront ici.</p>
                </div>
            ) : (
                <div className="space-y-8">

                    {/* ── Section : Dossiers de service ── */}
                    {dossiers.length > 0 && (
                        <div className="space-y-4">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.25em] flex items-center gap-2">
                                <FolderOpen size={10} className="text-indigo-400" />
                                Dossiers de service ({dossiers.length})
                            </p>
                            {dossiers.map(dossier => {
                                const s = STATUT_CONFIG[dossier.statut] || { label: dossier.statut, color: 'text-gray-400', bg: 'bg-gray-500/15' }
                                const etapes = Array.isArray(dossier.etapes) ? dossier.etapes : []
                                const prog = dossier.progression || 0
                                const isSelected = selectedDossiers.has(dossier.id)

                                return (
                                    <motion.div key={dossier.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                                        className={`bg-[#0a1221] border rounded-2xl overflow-hidden transition-colors ${
                                            isSelected ? 'border-red-500/30' : 'border-white/[0.06]'
                                        }`}>
                                        {/* Header */}
                                        <div className="p-5 border-b border-white/[0.06]">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    {selectionMode && (
                                                        <button type="button" onClick={() => toggleDossierSelect(dossier.id)}
                                                            aria-label={isSelected ? "Désélectionner le dossier" : "Sélectionner le dossier"}
                                                            className="mt-0.5 text-gray-400 hover:text-red-400 transition-colors flex-shrink-0">
                                                            {isSelected ? <CheckSquare size={16} className="text-red-400" /> : <Square size={16} />}
                                                        </button>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-0.5">Dossier N°</p>
                                                        <h2 className="text-base font-black text-white">{dossier.num_dossier}</h2>
                                                        <p className="text-sm text-gray-400 mt-0.5 truncate">{dossier.service_type}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${s.bg} ${s.color}`}>{s.label}</span>
                                                    {!selectionMode && (
                                                        <button type="button" onClick={() => handleDeleteDossier(dossier.id)}
                                                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors"
                                                            title="Supprimer" aria-label="Supprimer le dossier">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Barre de progression */}
                                            <div className="mt-4">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[11px] text-gray-500 font-bold">Progression</span>
                                                    <span className={`text-[12px] font-black ${s.color}`}>{prog}%</span>
                                                </div>
                                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                                    <motion.div
                                                        className={`h-full rounded-full ${prog >= 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-indigo-500 to-blue-500'}`}
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${prog}%` }}
                                                        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Étapes */}
                                        <div className="p-5">
                                            <button type="button"
                                                onClick={() => setExpandedDossier(expandedDossier === dossier.id ? null : dossier.id)}
                                                aria-expanded={expandedDossier === dossier.id ? "true" : "false"}
                                                className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3 hover:text-gray-300 transition-colors w-full text-left">
                                                Étapes du traitement
                                                <ChevronDown size={12} className={`ml-auto transition-transform ${expandedDossier === dossier.id ? 'rotate-180' : ''}`} />
                                            </button>

                                            <AnimatePresence>
                                                {expandedDossier === dossier.id && (
                                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                                        className="overflow-hidden space-y-2">
                                                        {(etapes.length > 0 ? etapes : ETAPES_LABELS.map((label, i) => ({ label, status: i === 0 ? 'completed' : 'pending', date: null as string | null | undefined }))).map((etape, i) => {
                                                            const done = etape.status === 'completed'
                                                            const inProgress = etape.status === 'in_progress'
                                                            return (
                                                                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${done ? 'bg-emerald-500/8' : inProgress ? 'bg-indigo-500/8 border border-indigo-500/20' : 'bg-white/[0.02]'}`}>
                                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black ${done ? 'bg-emerald-500 text-white' : inProgress ? 'bg-indigo-500/30 text-indigo-400 border border-indigo-500/50' : 'bg-white/5 text-gray-600'}`}>
                                                                        {done ? <CheckCircle2 size={13} /> : inProgress ? <Clock size={12} className="animate-pulse" /> : i + 1}
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <p className={`text-sm font-bold ${done ? 'text-emerald-400' : inProgress ? 'text-white' : 'text-gray-500'}`}>
                                                                            {etape.label || ETAPES_LABELS[i] || `Étape ${i + 1}`}
                                                                        </p>
                                                                        {etape.date && <p className="text-[10px] text-gray-600 flex items-center gap-1 mt-0.5"><Calendar size={9} />{fmtDate(etape.date)}</p>}
                                                                    </div>
                                                                    {inProgress && <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full">EN COURS</span>}
                                                                </div>
                                                            )
                                                        })}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        {/* Documents manquants */}
                                        {dossier.documents_manquants?.length > 0 && (
                                            <div className="mx-5 mb-4 p-4 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                                                <p className="text-xs font-black text-amber-400 flex items-center gap-2 mb-3">
                                                    <AlertCircle size={13} /> Documents requis
                                                 </p>
                                                <ul className="space-y-1.5">
                                                    {dossier.documents_manquants.map((doc, i) => (
                                                        <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                                                            {doc}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Notes */}
                                        {dossier.notes && (
                                            <div className="mx-5 mb-4 p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-1.5">Note de l'agent</p>
                                                <p className="text-sm text-gray-300 leading-relaxed">{dossier.notes}</p>
                                            </div>
                                        )}

                                        {/* Upload documents */}
                                        <div className="border-t border-white/[0.06] mx-5 mb-5 mt-1 pt-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <button type="button"
                                                    onClick={() => setExpandedDossier(expandedDossier === `docs-${dossier.id}` ? null : `docs-${dossier.id}`)}
                                                    aria-expanded={expandedDossier === `docs-${dossier.id}` ? "true" : "false"}
                                                    className="flex items-center gap-2 text-[11px] font-bold text-gray-400 hover:text-white transition-colors">
                                                    <Paperclip size={12} />
                                                    Mes fichiers ({docsByDossier[dossier.id]?.length || 0})
                                                    <ChevronRight size={11} className={`transition-transform ${expandedDossier === `docs-${dossier.id}` ? 'rotate-90' : ''}`} />
                                                </button>
                                                <button type="button" onClick={() => handleUploadClick(dossier.id)}
                                                    disabled={uploadingDossier === dossier.id}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/20 transition-all disabled:opacity-50">
                                                    {uploadingDossier === dossier.id ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                                                    {uploadingDossier === dossier.id ? 'Upload...' : 'Ajouter'}
                                                </button>
                                            </div>
                                            <AnimatePresence>
                                                {expandedDossier === `docs-${dossier.id}` && (
                                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                                        className="overflow-hidden">
                                                        {(docsByDossier[dossier.id] || []).length === 0 ? (
                                                            <div className="py-4 text-center">
                                                                <FileUp size={20} className="text-gray-700 mx-auto mb-2" />
                                                                <p className="text-[11px] text-gray-600">Aucun fichier pour ce dossier.</p>
                                                                <p className="text-[10px] text-gray-700 mt-0.5">PDF, Word, JPEG, PNG — max {MAX_SIZE_MB} MB</p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {(docsByDossier[dossier.id] || []).map(clientDoc => (
                                                                    <div key={clientDoc.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                                                        <div className="p-1.5 rounded-lg bg-indigo-500/10 flex-shrink-0">
                                                                            <Paperclip size={12} className="text-indigo-400" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-xs font-bold text-white truncate">{clientDoc.nom_fichier}</p>
                                                                            <p className="text-[10px] text-gray-600">{fmtSize(clientDoc.taille)} · {fmtDate(clientDoc.created_at)}</p>
                                                                        </div>
                                                                        <div className="flex items-center gap-1">
                                                                            <button type="button" onClick={async () => { const url = await refreshSignedUrl(clientDoc.storage_path); window.open(url, '_blank') }}
                                                                                className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-indigo-400 transition-colors" title="Télécharger" aria-label="Télécharger le fichier">
                                                                                <FileUp size={13} />
                                                                            </button>
                                                                            <button type="button" onClick={() => handleDeleteDoc(clientDoc.id, clientDoc.storage_path, dossier.id)}
                                                                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors" title="Supprimer" aria-label="Supprimer le fichier">
                                                                                <Trash2 size={13} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <div className="px-5 pb-4 flex items-center justify-between text-[11px] text-gray-600">
                                            <span>Créé le {fmtDate(dossier.created_at)}</span>
                                            {dossier.updated_at && <span>Mis à jour le {fmtDate(dossier.updated_at)}</span>}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}

                    {/* ── Section : Commandes boutique sans dossier ── */}
                    {unmatchedOrders.length > 0 && (
                        <div className="space-y-4">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.25em] flex items-center gap-2">
                                <ShoppingBag size={10} className="text-emerald-400" />
                                Commandes boutique ({unmatchedOrders.length})
                            </p>
                            <div className="bg-[#0a1221] border border-white/[0.06] rounded-2xl overflow-hidden">
                                <div className="divide-y divide-white/[0.04]">
                                    {unmatchedOrders.map(order => {
                                        const ps = ORDER_STATUS[order.payment_status] || { label: order.payment_status, color: 'text-gray-400', bg: 'bg-gray-500/15' }
                                        const isSelected = selectedOrders.has(order.id)
                                        return (
                                            <div key={order.id} className={`flex items-center gap-4 px-5 py-4 transition-colors ${isSelected ? 'bg-red-500/5' : ''}`}>
                                                {selectionMode && (
                                                    <button type="button" onClick={() => toggleOrderSelect(order.id)}
                                                        aria-label={isSelected ? "Désélectionner la commande" : "Sélectionner la commande"}
                                                        className="text-gray-400 hover:text-red-400 transition-colors flex-shrink-0">
                                                        {isSelected ? <CheckSquare size={15} className="text-red-400" /> : <Square size={15} />}
                                                    </button>
                                                )}
                                                <div className="p-2 rounded-lg bg-emerald-500/10 flex-shrink-0">
                                                    <Package size={14} className="text-emerald-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-white truncate">{order.product_title || 'Produit boutique'}</p>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        <p className="text-[10px] text-gray-600">{fmtDate(order.created_at)}</p>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ps.bg} ${ps.color}`}>{ps.label}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <p className="text-sm font-mono font-bold text-white">{fmtN(order.amount)} {order.currency || 'XOF'}</p>
                                                    {!selectionMode && (
                                                        <button type="button" onClick={() => handleDeleteOrder(order.id)}
                                                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors" title="Supprimer" aria-label="Supprimer la commande de la liste">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
