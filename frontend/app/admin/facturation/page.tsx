'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'

import { FileText, Plus, Trash as Trash2, CircleNotch as Loader2, MagnifyingGlass as Search, Download, Eye, Calculator, Receipt, ArrowCounterClockwise as Undo2, X, Warning as AlertTriangle, ShieldCheck, CurrencyCircleDollar as BadgeDollarSign, ArrowSquareOut as ExternalLink, Link as LinkIcon } from '@phosphor-icons/react';
import Link from 'next/link'
import Image from 'next/image'


import { FinancialAnalytics } from '@/components/dashboard/FinancialAnalytics'
import { CURRENCIES, asCurrency } from '@/lib/currency'
import { DOC_FIN_STATUTS } from '@/lib/constants/statuts'
import DescriptionLignes from '@/components/shared/DescriptionLignes'

import { telechargerDocumentPdf, type DocumentSource } from '@/lib/document-pdf-navigateur'

interface DevisItem {
    description: string
    quantity: number
    unit_price: number
    tva: number
}

interface DocumentFinancier {
    id: string
    type: 'devis' | 'facture' | 'avoir'
    numero: string
    avoir_de_facture_id?: string
    motif_avoir?: string
    client_ifu?: string
    mecef_nim?: string
    mecef_code?: string
    mecef_counters?: string
    mecef_datetime?: string
    mecef_qr?: string
    client_nom: string
    client_prenom: string
    client_email: string
    client_phone: string
    client_adresse: string
    items: DevisItem[]
    sous_total: number
    total_tva: number
    remise: number
    total: number
    status: string
    notes: string
    conditions: string
    validite: string
    created_at: string
    agent_id: string
    agent_email?: string
    currency?: string
    signature_url?: string
    signed_at?: string
}

export default function AdminFacturationPage() {
    const [documents, setDocuments] = useState<DocumentFinancier[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'devis' | 'facture' | 'avoir'>('all')
    const [showPreview, setShowPreview] = useState<DocumentFinancier | null>(null)
    const [generating, setGenerating] = useState(false)
    // Avoir / note de crédit
    const [avoirTarget, setAvoirTarget] = useState<DocumentFinancier | null>(null)
    const [avoirMotif, setAvoirMotif] = useState('')
    const [avoirMontant, setAvoirMontant] = useState('')
    const [avoirRestant, setAvoirRestant] = useState<number | null>(null)
    const [avoirSaving, setAvoirSaving] = useState(false)
    const [avoirError, setAvoirError] = useState('')

    // Certification e-MCF / MECeF (DGI Bénin)
    const [mecefTarget, setMecefTarget] = useState<DocumentFinancier | null>(null)
    const [mecefForm, setMecefForm] = useState({ mecef_nim: '', mecef_code: '', mecef_counters: '', mecef_datetime: '', mecef_qr: '', client_ifu: '' })
    const [mecefSaving, setMecefSaving] = useState(false)
    const [mecefAuto, setMecefAuto] = useState(false)
    const [mecefAutoError, setMecefAutoError] = useState('')

    // Normalisation AUTOMATIQUE via l'API DGI (remplace la saisie manuelle).
    const handleAutoMecef = async () => {
        if (!mecefTarget) return
        setMecefAuto(true)
        setMecefAutoError('')
        try {
            const res = await fetch('/api/admin/facturation/mecef/normaliser', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: mecefTarget.id }),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                const d = data.document
                setMecefForm({
                    mecef_nim: d.mecef_nim || '',
                    mecef_code: d.mecef_code || '',
                    mecef_counters: d.mecef_counters || '',
                    mecef_datetime: d.mecef_datetime ? d.mecef_datetime.slice(0, 16) : '',
                    mecef_qr: d.mecef_qr || '',
                    client_ifu: d.client_ifu || mecefForm.client_ifu,
                })
                fetchDocuments()
            } else {
                setMecefAutoError(data.error || 'Normalisation impossible.')
            }
        } catch {
            setMecefAutoError('Erreur réseau lors de l\'appel à la DGI.')
        }
        setMecefAuto(false)
    }

    const openMecef = (doc: DocumentFinancier) => {
        setMecefAutoError('')
        setMecefTarget(doc)
        setMecefTarget(doc)
        setMecefForm({
            mecef_nim: doc.mecef_nim || '',
            mecef_code: doc.mecef_code || '',
            mecef_counters: doc.mecef_counters || '',
            mecef_datetime: doc.mecef_datetime ? doc.mecef_datetime.slice(0, 16) : '',
            mecef_qr: doc.mecef_qr || '',
            client_ifu: doc.client_ifu || '',
        })
    }

    const handleSaveMecef = async () => {
        if (!mecefTarget) return
        setMecefSaving(true)
        try {
            const res = await fetch('/api/admin/facturation/mecef', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: mecefTarget.id, ...mecefForm }),
            })
            const data = await res.json()
            if (data.success) { setMecefTarget(null); fetchDocuments() }
        } catch { /* silencieux */ }
        setMecefSaving(false)
    }

    const handleCreateAvoir = async () => {
        if (!avoirTarget) return
        if (!avoirMotif.trim()) { setAvoirError('Le motif est obligatoire.'); return }
        setAvoirSaving(true)
        setAvoirError('')
        try {
            const res = await fetch('/api/admin/avoirs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    facture_id: avoirTarget.id,
                    motif: avoirMotif.trim(),
                    ...(avoirMontant.trim() ? { montant: Number(avoirMontant) } : {}),
                }),
            })
            const data = await res.json()
            if (data.success) {
                setAvoirTarget(null)
                setAvoirMotif('')
                setAvoirMontant('')
                setAvoirRestant(null)
                fetchDocuments()
            } else setAvoirError(data.error || 'Création impossible')
        } catch {
            setAvoirError('Création impossible')
        }
        setAvoirSaving(false)
    }

    const fetchDocuments = useCallback(async () => {
        // NB : PAS de join `agent:agent_id(email)` : il n'existe aucune relation
        // FK entre documents_financiers.agent_id et une table joignable par
        // PostgREST → la requête échouait et l'admin ne voyait AUCUNE facture
        // (y compris celles émises par les agents comme Ornel). On récupère les
        // documents seuls, puis on mappe l'email de l'agent séparément.
        const [{ data, error }, usersRes] = await Promise.all([
            supabase.from('documents_financiers').select('*').order('created_at', { ascending: false }),
            fetch('/api/admin/users').then(r => r.ok ? r.json() : { users: [] }).catch(() => ({ users: [] })),
        ])
        if (error) console.error('[facturation] chargement documents:', error.message)
        const emailById: Record<string, string> = {}
        for (const u of (usersRes.users || [])) emailById[u.id] = u.email || u.full_name || ''
        const mapped = (data || []).map(d => ({
            ...d,
            agent_email: emailById[d.agent_id] || 'N/A',
        }))
        setDocuments(mapped as DocumentFinancier[])
        setLoading(false)
    }, [])

    useEffect(() => { fetchDocuments() }, [fetchDocuments])

    // En-tête d'auth (token session) : les UPDATE/DELETE directs sont bloqués
    // par RLS, on passe par l'API serveur (service key)
    const authHeaders = async (): Promise<Record<string, string>> => {
        const { data: { session } } = await supabase.auth.getSession()
        return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
    }

    const handleDelete = async (id: string) => {
        if(!confirm('Voulez-vous vraiment supprimer ce document ?')) return;
        const res = await fetch(`/api/agent/documents-financiers?id=${id}`, { method: 'DELETE', headers: await authHeaders() })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
            setDocuments(prev => prev.filter(d => d.id !== id))
            setShowPreview(null)
        } else alert(data.error || 'Suppression impossible')
    }

    const handleUpdateStatus = async (id: string, status: string) => {
        const res = await fetch('/api/agent/documents-financiers', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
            body: JSON.stringify({ id, status }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
            // La route renvoie le document réel (un « payé » y gagne sa date et son moyen).
            const doc = data.document || { status }
            setDocuments(prev => prev.map(d => d.id === id ? { ...d, ...doc } : d))
            if (showPreview?.id === id) setShowPreview(prev => prev ? { ...prev, ...doc } : null)
        } else {
            // Facture payée, normalisée DGI, statut inconnu… : le motif est dit, pas tu.
            alert(data.error || 'Changement de statut impossible')
        }
    }

    // Marquer une facture (produite manuellement) payée / impayée
    const toggleFacturePaid = async (doc: DocumentFinancier) => {
        const nowPaid = doc.status !== 'paye'
        const res = await fetch('/api/agent/documents-financiers', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
            body: JSON.stringify({ id: doc.id, action: nowPaid ? 'mark_paid' : 'mark_unpaid' }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
            const patch = nowPaid
                ? { status: 'paye', payment_method: 'manuel', paid_at: new Date().toISOString() }
                : { status: 'envoye', paid_at: null }
            setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, ...patch } as DocumentFinancier : d))
            if (showPreview?.id === doc.id) setShowPreview(prev => prev ? { ...prev, ...patch } as DocumentFinancier : null)
        } else alert(data.error || 'Opération impossible')
    }

    // Libellé de devise du DOCUMENT (jamais forcer XOF sur une facture EUR/USD)
    /* Delegue a la table UNIQUE des devises (`lib/currency.ts`).
   Il existait DEUX copies de ce helper, et elles divergeaient : celle de
   l'admin rendait « FCFA » pour XOF et ignorait GBP (qui s'affichait « GBP »),
   celle de l'agent rendait « XOF » et connaissait GBP. Une meme facture
   changeait donc d'apparence selon le panel — et aucune des deux ne
   connaissait HTG. */
    const curLabel = (c?: string) => CURRENCIES[asCurrency(c)].symbol
    const formatDate = (val: string | null | undefined) => {
        if (!val) return '-'
        const d = new Date(val)
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-FR')
    }

    // Modèle UNIQUE (lib/document-pdf.ts) : même rendu que le portail client,
    // les emails et l'app mobile (audit du 29/09/2026 : 4 mises en page coexistaient).
    const generatePDF = async (doc: DocumentFinancier) => {
        setGenerating(true)
        try {
            await telechargerDocumentPdf(doc as unknown as DocumentSource, supabase)
        } catch (e) {
            console.error('PDF', e)
            alert(`Génération du PDF impossible : ${e instanceof Error ? e.message : 'erreur inconnue'}`)
        }
        setGenerating(false)
    }

    const filtered = documents.filter(d => {
        const matchSearch = d.numero?.toLowerCase().includes(search.toLowerCase()) ||
            d.client_nom?.toLowerCase().includes(search.toLowerCase())
        const matchType = filterType === 'all' || d.type === filterType
        return matchSearch && matchType
    })

    // Référence unique lib/constants/statuts. Avant : entrée `valide` (« Avoir
    // émis ») proposée en changement manuel alors que la contrainte CHECK de
    // documents_financiers.status la refuse → échec systématique.
    const statusConfig: Record<string, { color: string; label: string }> =
        Object.fromEntries(DOC_FIN_STATUTS.map(d => [d.value, { color: d.badge, label: d.label }]))

    if (loading) {
        return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Calculator size={16} className="text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">ERP & Comptabilité</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Centre de Facturation</h1>
                    <p className="text-gray-500 text-sm mt-1">Supervision globale des finances de l&apos;agence.</p>
                </div>
                <Link href="/admin/facturation/create" className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all">
                    <Plus size={16} /> Créer une Facture / Devis
                </Link>
            </div>

            {/* Dashboard Financier */}
            <FinancialAnalytics />

            {/* Search + Filter */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par Numéro ou Client..." className="w-full bg-[var(--panel-surface-alt)] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
                </div>
                <div className="flex gap-1 bg-[var(--panel-surface-alt)] rounded-xl p-1 w-full sm:w-auto">
                    {[{ k: 'all', l: 'Tous' }, { k: 'devis', l: 'Devis' }, { k: 'facture', l: 'Factures' }, { k: 'avoir', l: 'Avoirs' }].map(f => (
                        <button key={f.k} type="button" onClick={() => setFilterType(f.k as typeof filterType)} className={`flex-1 sm:flex-none text-xs font-bold px-4 py-2 rounded-lg transition-all ${filterType === f.k ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:text-white'}`}>{f.l}</button>
                    ))}
                </div>
            </div>

            {/* Document List (Tables are cleaner for ERP) */}
            <div className="rounded-xl overflow-hidden shadow-xl border" style={{ backgroundColor: 'var(--panel-surface, #0c1420)', borderColor: 'var(--panel-border, rgba(255,255,255,0.05))' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[var(--panel-surface-alt)] border-b border-white/5">
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Document</th>
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Client</th>
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Montant</th>
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Statut</th>
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Créé par</th>
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-gray-500">
                                        <Receipt size={32} className="mx-auto mb-3 opacity-50" />
                                        <p className="text-sm font-semibold">Aucun document trouvé</p>
                                    </td>
                                </tr>
                            ) : filtered.map(doc => (
                                <tr key={doc.id} className="border-b border-white/5 hover:bg-[var(--panel-surface-alt)] transition-colors group">
                                    <td className="py-3 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${doc.type==='devis'?'bg-blue-500/10 text-blue-400':'bg-emerald-500/10 text-emerald-400'}`}>
                                                {doc.type === 'devis' ? <FileText size={16} /> : <Receipt size={16} />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm" style={{ color: 'var(--panel-text-heading, #fff)' }}>{doc.numero}</p>
                                                <p className="text-gray-500 text-[10px]">{formatDate(doc.created_at)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-5">
                                        <p className="text-sm font-medium" style={{ color: 'var(--panel-text-heading, #fff)' }}>{doc.client_nom} {doc.client_prenom}</p>
                                        <p className="text-gray-500 text-[10px]">{doc.client_email || doc.client_phone}</p>
                                    </td>
                                    <td className="py-3 px-5 text-right">
                                        <p className="font-mono text-sm font-bold" style={{ color: 'var(--panel-text-heading, #fff)' }}>{doc.total.toLocaleString('fr-FR')} {curLabel(doc.currency)}</p>
                                    </td>
                                    <td className="py-3 px-5 text-center">
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusConfig[doc.status]?.color || 'bg-gray-500/15 text-gray-400'}`}>{statusConfig[doc.status]?.label || doc.status}</span>
                                    </td>
                                    <td className="py-3 px-5">
                                        <p className="text-gray-400 text-xs">{doc.agent_email}</p>
                                    </td>
                                    <td className="py-3 px-5 text-right">
                                        <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    const url = `${window.location.origin}/portail/${doc.id}`
                                                    navigator.clipboard.writeText(url)
                                                    alert('Lien Magique Client copié dans le presse-papier ! Envoye-le via WhatsApp.')
                                                }}
                                                className="p-2 text-gray-400 hover:text-amber-400 hover:bg-[var(--panel-surface-alt)] rounded-lg transition-all"
                                                title="Copier le Lien Client"
                                            >
                                                <LinkIcon size={16} />
                                            </button>
                                            <button onClick={() => setShowPreview(doc)} className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-[var(--panel-surface-alt)] rounded-lg transition-all" title="Aperçu / Modifier"><Eye size={16} /></button>
                                            <a href={`/portail/${doc.id}`} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-purple-400 hover:bg-[var(--panel-surface-alt)] rounded-lg transition-all inline-flex" title="Voir exactement comme le client le reçoit"><ExternalLink size={16} /></a>
                                            <button onClick={() => generatePDF(doc)} disabled={generating} className="p-2 text-gray-400 hover:text-blue-400 hover:bg-[var(--panel-surface-alt)] rounded-lg transition-all" title="PDF">
                                                {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                            </button>
                                            {doc.type === 'facture' && (
                                                <button onClick={() => toggleFacturePaid(doc)} className={`p-2 rounded-lg transition-all ${doc.status === 'paye' ? 'text-emerald-500 hover:text-amber-500 hover:bg-amber-500/10' : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10'}`} title={doc.status === 'paye' ? 'Payée : cliquer pour marquer impayée' : 'Marquer cette facture comme payée'}><BadgeDollarSign size={16} /></button>
                                            )}
                                            {(doc.type === 'facture' || doc.type === 'avoir') && (
                                                <button onClick={() => openMecef(doc)} className={`p-2 hover:bg-[var(--panel-surface-alt)] rounded-lg transition-all ${doc.mecef_code || doc.mecef_nim ? 'text-emerald-500' : 'text-gray-400 hover:text-emerald-400'}`} title="Certification fiscale e-MCF (DGI)"><ShieldCheck size={16} /></button>
                                            )}
                                            {doc.type === 'facture' && (
                                                <button onClick={() => { setAvoirTarget(doc); setAvoirMontant(''); setAvoirMotif(''); setAvoirError(''); setAvoirRestant(null); fetch(`/api/admin/avoirs?facture_id=${doc.id}`).then(r => r.json()).then(d => { const deja = (d.avoirs || []).reduce((a: number, x: { total: number }) => a + Number(x.total || 0), 0); setAvoirRestant(Math.max(0, Number(doc.total || 0) - deja)) }).catch(() => setAvoirRestant(Number(doc.total || 0))) }} className="p-2 text-gray-400 hover:text-orange-400 hover:bg-[var(--panel-surface-alt)] rounded-lg transition-all" title="Émettre un avoir (note de crédit)"><Undo2 size={16} /></button>
                                            )}
                                            <button onClick={() => handleDelete(doc.id)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-[var(--panel-surface-alt)] rounded-lg transition-all" title="Supprimer"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL CERTIFICATION e-MCF / MECeF */}
            <AnimatePresence>
                {mecefTarget && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
                        onClick={() => setMecefTarget(null)}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            onClick={e => e.stopPropagation()}
                            className="border rounded-2xl p-6 max-w-md w-full max-h-[92vh] overflow-y-auto"
                            style={{ backgroundColor: 'var(--panel-surface, #111827)', borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="text-emerald-500" size={22} />
                                    <h3 className="text-base font-black" style={{ color: 'var(--panel-text-heading, #fff)' }}>Certification e-MCF (DGI)</h3>
                                </div>
                                <button onClick={() => setMecefTarget(null)} className="opacity-60 hover:opacity-100" style={{ color: 'var(--panel-text, #fff)' }}><X size={18} /></button>
                            </div>
                            <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--panel-text-muted, #9CA3AF)' }}>
                                Reportez ici les données de certification de la facture normalisée délivrées par le système <strong>e-MCF/MECeF</strong> de la DGI (code de contrôle, NIM, compteurs, QR). Elles s&apos;affichent alors sur le PDF de la facture.
                            </p>

                            {/* Normalisation AUTOMATIQUE via l'API DGI */}
                            {!(mecefTarget?.mecef_nim || mecefTarget?.mecef_code) && (
                                <div className="mb-4">
                                    <button onClick={handleAutoMecef} disabled={mecefAuto}
                                        className="w-full bg-[#008751] hover:bg-[#007445] disabled:opacity-50 text-white font-bold text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                                        {mecefAuto ? <Loader2 className="animate-spin" size={15} /> : <ShieldCheck size={15} />}
                                        Normaliser automatiquement (API DGI)
                                    </button>
                                    <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--panel-text-muted, #9CA3AF)' }}>
                                        Récupère NIM, code, compteurs et QR directement depuis la DGI. À défaut, saisissez-les manuellement ci-dessous.
                                    </p>
                                    {mecefAutoError && <p className="text-[11px] mt-2 text-red-500 flex items-center gap-1.5"><X size={12} /> {mecefAutoError}</p>}
                                </div>
                            )}

                            {([
                                { k: 'client_ifu', l: 'IFU du client (si professionnel)', ph: '3200000000000' },
                                { k: 'mecef_code', l: 'Code de contrôle MECeF', ph: 'XXXX-XXXX-XXXX' },
                                { k: 'mecef_nim', l: 'NIM (identification machine)', ph: 'NIM…' },
                                { k: 'mecef_counters', l: 'Compteurs', ph: 'ex : 125/340 FV' },
                                { k: 'mecef_qr', l: 'Contenu du QR (URL de vérification DGI)', ph: 'https://sygmef.impots.bj/...' },
                            ] as const).map(f => (
                                <div key={f.k} className="mb-2.5">
                                    <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--panel-text-muted, #9CA3AF)' }}>{f.l}</label>
                                    <input type="text" value={mecefForm[f.k]} onChange={e => setMecefForm(s => ({ ...s, [f.k]: e.target.value }))}
                                        placeholder={f.ph}
                                        className="w-full border rounded-xl py-2 px-3 text-sm focus:outline-none"
                                        style={{ backgroundColor: 'var(--panel-surface-alt, rgba(255,255,255,0.05))', borderColor: 'var(--panel-border, rgba(255,255,255,0.1))', color: 'var(--panel-text, #fff)' }} />
                                </div>
                            ))}
                            <div className="mb-4">
                                <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--panel-text-muted, #9CA3AF)' }}>Date/heure de certification</label>
                                <input type="datetime-local" value={mecefForm.mecef_datetime} onChange={e => setMecefForm(s => ({ ...s, mecef_datetime: e.target.value }))}
                                    className="w-full border rounded-xl py-2 px-3 text-sm focus:outline-none"
                                    style={{ backgroundColor: 'var(--panel-surface-alt, rgba(255,255,255,0.05))', borderColor: 'var(--panel-border, rgba(255,255,255,0.1))', color: 'var(--panel-text, #fff)' }} />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handleSaveMecef} disabled={mecefSaving}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                                    {mecefSaving ? <Loader2 className="animate-spin" size={15} /> : <ShieldCheck size={15} />}
                                    Enregistrer la certification
                                </button>
                                <button onClick={() => setMecefTarget(null)} className="flex-1 border font-bold text-sm py-2.5 rounded-xl transition-all"
                                    style={{ backgroundColor: 'var(--panel-surface-alt, rgba(255,255,255,0.05))', borderColor: 'var(--panel-border, rgba(255,255,255,0.1))', color: 'var(--panel-text, #fff)' }}>Fermer</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MODAL AVOIR / NOTE DE CRÉDIT */}
            <AnimatePresence>
                {avoirTarget && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
                        onClick={() => { setAvoirTarget(null); setAvoirMotif(''); setAvoirMontant(''); setAvoirRestant(null); setAvoirError('') }}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            onClick={e => e.stopPropagation()}
                            className="border rounded-2xl p-6 max-w-md w-full"
                            style={{ backgroundColor: 'var(--panel-surface, #111827)', borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Undo2 className="text-orange-500" size={22} />
                                    <h3 className="text-base font-black" style={{ color: 'var(--panel-text-heading, #fff)' }}>Émettre un avoir</h3>
                                </div>
                                <button onClick={() => { setAvoirTarget(null); setAvoirMotif(''); setAvoirMontant(''); setAvoirRestant(null); setAvoirError('') }} className="opacity-60 hover:opacity-100" style={{ color: 'var(--panel-text, #fff)' }}><X size={18} /></button>
                            </div>
                            <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--panel-text-muted, #9CA3AF)' }}>
                                En comptabilité normée, une facture émise ne se supprime pas : on émet un <strong>avoir</strong> (note de crédit) qui la crédite. L&apos;avoir porte sur la facture <span className="font-mono font-bold">{avoirTarget.numero}</span>, reprend sa devise et son taux de change figés, et entre en contre-passation (CA et TVA) dans la comptabilité.
                            </p>
                            <label className="text-xs font-bold mb-1 block" style={{ color: 'var(--panel-text-muted, #9CA3AF)' }}>
                                Montant à créditer ({avoirTarget.currency || 'XOF'})
                            </label>
                            <input
                                type="number" min={0} step="0.01"
                                value={avoirMontant}
                                onChange={e => setAvoirMontant(e.target.value)}
                                placeholder={avoirRestant !== null ? `${avoirRestant} (total restant)` : 'Total de la facture'}
                                title="Montant a crediter"
                                className="w-full border rounded-xl py-2.5 px-3 text-sm focus:outline-none mb-1 font-mono"
                                style={{ backgroundColor: 'var(--panel-surface-alt, rgba(255,255,255,0.05))', borderColor: 'var(--panel-border, rgba(255,255,255,0.1))', color: 'var(--panel-text, #fff)' }}
                            />
                            <p className="text-[11px] mb-3" style={{ color: 'var(--panel-text-muted, #9CA3AF)' }}>
                                Laissez vide pour un avoir <strong>total</strong>.
                                {avoirRestant !== null && (
                                    <> Restant avoirable : <span className="font-mono font-bold">{avoirRestant.toLocaleString('fr-FR')} {avoirTarget.currency || 'XOF'}</span>.</>
                                )}
                                {' '}La TVA est créditée au prorata.
                            </p>
                            <label className="text-xs font-bold mb-1 block" style={{ color: 'var(--panel-text-muted, #9CA3AF)' }}>Motif de l&apos;avoir *</label>
                            <textarea
                                rows={3}
                                value={avoirMotif}
                                onChange={e => setAvoirMotif(e.target.value)}
                                placeholder="Erreur de facturation, annulation de commande, geste commercial…"
                                className="w-full border rounded-xl py-2.5 px-3 text-sm focus:outline-none resize-none mb-2"
                                style={{ backgroundColor: 'var(--panel-surface-alt, rgba(255,255,255,0.05))', borderColor: 'var(--panel-border, rgba(255,255,255,0.1))', color: 'var(--panel-text, #fff)' }}
                            />
                            {avoirError && (
                                <p className="text-xs text-red-500 font-semibold mb-2 flex items-center gap-1.5"><AlertTriangle size={13} /> {avoirError}</p>
                            )}
                            <div className="flex gap-3 mt-3">
                                <button onClick={handleCreateAvoir} disabled={avoirSaving}
                                    className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                                    {avoirSaving ? <Loader2 className="animate-spin" size={15} /> : <Undo2 size={15} />}
                                    Émettre l&apos;avoir
                                </button>
                                <button onClick={() => { setAvoirTarget(null); setAvoirMotif(''); setAvoirMontant(''); setAvoirRestant(null); setAvoirError('') }}
                                    className="flex-1 border font-bold text-sm py-2.5 rounded-xl transition-all"
                                    style={{ backgroundColor: 'var(--panel-surface-alt, rgba(255,255,255,0.05))', borderColor: 'var(--panel-border, rgba(255,255,255,0.1))', color: 'var(--panel-text, #fff)' }}>Annuler</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PREVIEW MODAL */}
            <AnimatePresence>
                {showPreview && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowPreview(null)}>
                        <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} onClick={e => e.stopPropagation()} className="bg-[#080e15] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
                            {/* Flag stripe */}
                            <div className="h-1 flex flex-shrink-0">
                                <div className="flex-1 bg-emerald-600" />
                                <div className="flex-1 bg-amber-400" />
                                <div className="flex-1 bg-red-600" />
                            </div>

                            {/* Header */}
                            <div className="bg-[#0c1420] border-b border-white/5 p-5 flex items-start justify-between flex-shrink-0">
                                <div className="flex items-center gap-4">
                                    <Image src="/logo.jpg" alt="Logo" width={48} height={48} className="w-12 h-12 rounded-lg object-cover" />
                                    <div>
                                        <p className="text-emerald-400 text-xl font-black tracking-wider">RETOUR GAGNANT BÉNIN</p>
                                        <p className="text-gray-600 text-xs mt-0.5">Agence de Services Internationaux</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-3xl font-black ${showPreview.type === 'devis' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {showPreview.type === 'devis' ? 'DEVIS' : 'FACTURE'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1 font-mono">N° {showPreview.numero}</p>
                                </div>
                            </div>

                            <div className="overflow-y-auto flex-1 p-5 space-y-5">
                                {/* Actions Rapides (Conversion) */}
                                {showPreview.type === 'devis' && showPreview.status !== 'accepte' && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-3 text-amber-500">
                                            <FileText size={20} />
                                            <div>
                                                <p className="text-sm font-bold">Ce client a-t-il validé ce devis ?</p>
                                                <p className="text-xs text-amber-500/70">Passez-le en &quot;Accepté&quot; pour générer automatiquement la facture correspondante.</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleUpdateStatus(showPreview.id, 'accepte')} className="bg-amber-500 text-black px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-400">Marquer Accepté</button>
                                    </div>
                                )}

                                {/* Details like inside PDF */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-[var(--panel-surface-alt)] p-4 rounded-xl">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Client</p>
                                        <p className="text-white font-bold">{showPreview.client_nom} {showPreview.client_prenom}</p>
                                        <p className="text-gray-400 text-xs mt-1">{showPreview.client_email}</p>
                                        <p className="text-gray-400 text-xs">{showPreview.client_phone}</p>
                                    </div>
                                    <div className="bg-[var(--panel-surface-alt)] p-4 rounded-xl">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Récapitulatif Total</p>
                                        <p className="text-2xl text-emerald-400 font-black font-mono mt-1">{showPreview.total.toLocaleString('fr-FR')} {curLabel(showPreview.currency)}</p>
                                    </div>
                                </div>

                                <div className="border border-white/5 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-[var(--panel-surface-alt)] text-gray-400 text-left">
                                            <tr>
                                                <th className="p-3">Description</th>
                                                <th className="p-3 text-center">Qté</th>
                                                <th className="p-3 text-right">PU</th>
                                                <th className="p-3 text-right">TVA</th>
                                                <th className="p-3 text-right">Total HT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {showPreview.items.map((it, i) => (
                                                <tr key={i} className="border-t border-white/5">
                                                    <td className="p-3 text-gray-300"><DescriptionLignes texte={it.description} /></td>
                                                    <td className="p-3 text-gray-400 text-center">{it.quantity}</td>
                                                    <td className="p-3 text-gray-400 text-right font-mono">{it.unit_price.toLocaleString('fr-FR')}</td>
                                                    <td className="p-3 text-gray-400 text-right">{it.tva}%</td>
                                                    <td className="p-3 text-white font-medium text-right font-mono">{(it.quantity * it.unit_price).toLocaleString('fr-FR')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Status Update */}
                                <div className="border-t border-white/5 pt-4">
                                    <p className="text-xs text-gray-400 mb-2">Changer le statut manuellement :</p>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(statusConfig).map(([key, cfg]) => (
                                            <button key={key} type="button" onClick={() => handleUpdateStatus(showPreview.id, key)} className={`text-[10px] font-bold px-3 py-1.5 rounded-full transition-all border ${showPreview.status === key ? cfg.color : 'bg-transparent border-white/10 text-gray-500 hover:text-white hover:border-white/30'}`}>{cfg.label}</button>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    )
}
