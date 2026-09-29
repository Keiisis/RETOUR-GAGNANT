'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { FileText, Plus, Trash as Trash2, X, CircleNotch as Loader2, MagnifyingGlass as Search, Download, Eye, Calculator, Receipt, PaperPlaneTilt as Send, Phone, Envelope as Mail, CheckCircle as CheckCircle2, WarningCircle as AlertCircle, Link as LinkIcon, Warning as AlertTriangle, Bell, Clock, CurrencyCircleDollar as BadgeDollarSign, ArrowSquareOut as ExternalLink } from '@phosphor-icons/react';
import Link from 'next/link'

import { convertCurrency, refreshRates, CURRENCIES, asCurrency, type CurrencyCode } from '@/lib/currency'

import { DOC_FIN_STATUTS, DOC_FIN_CLOS, type DocFinStatut } from '@/lib/constants/statuts'
import DescriptionLignes from '@/components/shared/DescriptionLignes'
import { descriptionEnLigne } from '@/lib/description-lignes'
import { telechargerDocumentPdf, type DocumentSource } from '@/lib/document-pdf-navigateur'

// Libellé de devise du DOCUMENT : ne JAMAIS forcer XOF sur un devis/facture EUR/USD
/* Delegue a la table UNIQUE des devises (`lib/currency.ts`).
   Il existait DEUX copies de ce helper, et elles divergeaient : celle de
   l'admin rendait « FCFA » pour XOF et ignorait GBP (qui s'affichait « GBP »),
   celle de l'agent rendait « XOF » et connaissait GBP. Une meme facture
   changeait donc d'apparence selon le panel — et aucune des deux ne
   connaissait HTG. */
const curLabel = (c?: string) => CURRENCIES[asCurrency(c)].symbol
// Total converti en XOF pour agréger des documents multi-devises (KPIs)
const toXof = (amount: number, c?: string) => convertCurrency(amount, ((c || 'XOF').toUpperCase()) as CurrencyCode, 'XOF')

interface DevisItem {
    description: string
    quantity: number
    unit_price: number
    tva: number
}

interface DocumentFinancier {
    id: string
    type: 'devis' | 'facture'
    numero: string
    client_nom: string
    client_prenom: string
    client_email: string
    client_phone: string
    client_adresse: string
    items: DevisItem[]
    currency: string
    sous_total: number
    total_tva: number
    remise: number
    total: number
    status: string
    notes: string
    conditions: string
    validite: string
    created_at: string
    signature_url?: string
    signed_at?: string
}

export default function AgentDevisPage() {
    const [documents, setDocuments] = useState<DocumentFinancier[]>([])
    const [paidByDoc, setPaidByDoc] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [erreur, setErreur] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'devis' | 'facture' | 'impayees'>('all')
    const [sendingRelance, setSendingRelance] = useState<string | null>(null)
    const [showPreview, setShowPreview] = useState<DocumentFinancier | null>(null)
    const [generating, setGenerating] = useState(false)
    const [sendingEmail, setSendingEmail] = useState<string | null>(null)

    const fetchDocuments = useCallback(async () => {
        // Charger les taux de change (table currencies) pour agréger multi-devises
        refreshRates()
        const { data: { user } } = await supabase.auth.getUser()
        // Session absente : fin du chargement + message (le spinner tournait sans fin)
        if (!user) { setErreur('Session expirée : reconnectez-vous.'); setLoading(false); return }

        // Requête 1 : documents directement assignés à cet agent
        const { data: ownDocs, error: ownErr } = await supabase
            .from('documents_financiers')
            .select('*')
            .eq('agent_id', user.id)
            .order('created_at', { ascending: false })

        setErreur(ownErr ? `Chargement impossible : ${ownErr.message}` : null)
        const owned = (ownDocs || []) as DocumentFinancier[]
        const ownedIds = new Set(owned.map(d => d.id))

        // Requête 2 : factures liées via parent_devis_id aux devis de cet agent
        // (couvre le cas où agent_id était NULL au moment de la création par la route /sign)
        const myDevisIds = owned.filter(d => d.type === 'devis').map(d => d.id)
        let linkedFactures: DocumentFinancier[] = []
        if (myDevisIds.length > 0) {
            const { data: linked } = await supabase
                .from('documents_financiers')
                .select('*')
                .in('parent_devis_id', myDevisIds)
            linkedFactures = ((linked || []) as DocumentFinancier[]).filter(d => !ownedIds.has(d.id))
        }

        const allDocs = [...owned, ...linkedFactures]
        allDocs.sort((a, b) => {
            const timeA = a.created_at && !isNaN(new Date(a.created_at).getTime()) ? new Date(a.created_at).getTime() : 0
            const timeB = b.created_at && !isNaN(new Date(b.created_at).getTime()) ? new Date(b.created_at).getTime() : 0
            return timeB - timeA
        })

        setDocuments(allDocs)

        // Fetch paiements manuels pour ces documents
        const docIds = allDocs.map(d => d.id)
        if (docIds.length > 0) {
            const { data: paiements } = await supabase
                .from('paiements_manuels')
                .select('document_id, montant')
                .in('document_id', docIds)
            const map: Record<string, number> = {}
            ;(paiements || []).forEach(p => {
                map[p.document_id] = (map[p.document_id] || 0) + Number(p.montant || 0)
            })
            // Ajouter aussi les factures statut "paye" → considérer le total comme payé
            allDocs.forEach(d => {
                if (d.type === 'facture' && d.status === 'paye' && !map[d.id]) {
                    map[d.id] = d.total
                }
            })
            setPaidByDoc(map)
        } else {
            setPaidByDoc({})
        }

        setLoading(false)
    }, [])

    useEffect(() => { fetchDocuments() }, [fetchDocuments])

    // En-tête d'auth (token session) pour les routes serveur
    const authHeaders = async (): Promise<Record<string, string>> => {
        const { data: { session } } = await supabase.auth.getSession()
        return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
    }

    const handleDelete = async (id: string) => {
        if(!confirm('Voulez-vous vraiment supprimer ce document ?')) return;
        // Passage par l'API serveur (les DELETE directs sont bloqués par RLS)
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
        if (res.ok) {
            setDocuments(prev => prev.map(d => d.id === id ? { ...d, status } : d))
            if (showPreview?.id === id) setShowPreview(prev => prev ? { ...prev, status } : null)
            return null
        }
        const data = await res.json().catch(() => ({}))
        return (data.error as string) || `erreur ${res.status}`
    }

    // Marquer une facture (produite manuellement) comme payée / impayée
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
            setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, ...patch } : d))
            if (showPreview?.id === doc.id) setShowPreview(prev => prev ? { ...prev, ...patch } : null)
        } else alert(data.error || 'Opération impossible')
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

    const sendPDFByEmail = async (doc: DocumentFinancier) => {
        if (!doc.client_email) {
            alert('Ce client n\'a pas d\'adresse email renseignée.')
            return
        }

        setSendingEmail(doc.id)
        try {
            const typeLabel = doc.type === 'devis' ? 'Devis' : 'Facture'
            const statusLabel = doc.status === 'paye' ? ' PAYÉ' : doc.status === 'accepte' ? ' ACCEPTÉ' : ''

            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: doc.client_email,
                    subject: `${typeLabel} N° ${doc.numero}${statusLabel} : Retour Gagnant Bénin`,
 message: `Bonjour ${doc.client_prenom || ''} ${doc.client_nom || ''},\n\nVeuillez trouver ci-joint votre ${typeLabel.toLowerCase()} N° ${doc.numero} d'un montant de ${doc.total.toLocaleString('fr-FR')} XOF.\n\n Détails :\n${doc.items?.map(i => `• ${descriptionEnLigne(i.description)} : ${i.quantity} x ${i.unit_price.toLocaleString('fr-FR')} XOF`).join('\n') || ''}\n\n Total : ${doc.total.toLocaleString('fr-FR')} XOF\n${doc.notes ? `\n Notes : ${doc.notes}`: ''}\n${doc.conditions ? `\n Conditions : ${doc.conditions}`: ''}\n\nCordialement,\nL'équipe Retour Gagnant Bénin`,
                    clientName: `${doc.client_prenom || ''} ${doc.client_nom || ''}`.trim(),
                    context: 'document_financier',
                    relatedId: doc.id,
                }),
            })
            // Pas de « envoyé » si le serveur mail a refusé.
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)

            // Update status to 'envoye' if still brouillon
            // Via la route serveur (propriété + règles de statut), plus d'écriture directe.
            if (doc.status === 'brouillon') {
                const statutErr = await handleUpdateStatus(doc.id, 'envoye')
                if (statutErr) {
                    alert(` ${typeLabel} envoyé(e) par email à ${doc.client_email}, mais statut non mis à jour : ${statutErr}`)
                    return
                }
            }

            alert(` ${typeLabel} envoyé(e) par email à ${doc.client_email}`)
        } catch (err) {
            console.error('Email error:', err)
            alert(`Erreur lors de l'envoi du mail : ${err instanceof Error ? err.message : 'inconnue'}`)
        } finally {
            setSendingEmail(null)
        }
    }

    // ─── Helpers Alarmes Factures Impayées ────────────────────────────────
    const parseValiditeDays = (validite: string): number => {
        if (!validite) return 30
        const match = String(validite).match(/\d+/)
        return match ? parseInt(match[0], 10) : 30
    }

    const computeOverdue = (doc: DocumentFinancier, paid: number) => {
        if (doc.type !== 'facture' || doc.status === 'annule') return { isUnpaid: false, isOverdue: false, daysLate: 0, remaining: 0 }
        const remaining = Math.max(0, doc.total - paid)
        if (remaining === 0) return { isUnpaid: false, isOverdue: false, daysLate: 0, remaining: 0 }
        const dueDays = parseValiditeDays(doc.validite)
        const createdAt = doc.created_at && !isNaN(new Date(doc.created_at).getTime()) ? new Date(doc.created_at).getTime() : Date.now()
        const dueAt = createdAt + dueDays * 24 * 60 * 60 * 1000
        const daysLate = Math.floor((Date.now() - dueAt) / (24 * 60 * 60 * 1000))
        return { isUnpaid: true, isOverdue: daysLate > 0, daysLate: Math.max(0, daysLate), remaining }
    }

    const sendRelance = async (doc: DocumentFinancier) => {
        if (!doc.client_email) { alert('Email client manquant : impossible de relancer.'); return }
        const info = computeOverdue(doc, paidByDoc[doc.id] || 0)
        if (!info.isUnpaid) return
        setSendingRelance(doc.id)
        try {
            const subject = `Rappel : Facture ${doc.numero} en attente de règlement`
            const html = `
                <p>Bonjour ${doc.client_nom || ''} ${doc.client_prenom || ''},</p>
                <p>Nous nous permettons de revenir vers vous concernant la facture <strong>${doc.numero}</strong>${info.isOverdue ? ` échue depuis <strong>${info.daysLate} jour${info.daysLate > 1 ? 's' : ''}</strong>` : ''}.</p>
                <p><strong>Montant restant dû :</strong> ${info.remaining.toLocaleString('fr-FR')} ${doc.currency || 'XOF'}</p>
                <p>Vous pouvez régler directement depuis votre espace client : <a href="${window.location.origin}/portail/${doc.id}">${window.location.origin}/portail/${doc.id}</a></p>
                <p>Merci pour votre confiance,<br/>L'équipe Retour Gagnant Bénin</p>
            `
            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: doc.client_email, subject, html }),
            })
            if (!res.ok) throw new Error('Erreur envoi')
            alert(` Relance envoyée à ${doc.client_email}`)
        } catch (e) {
            alert(`Erreur lors de l'envoi : ${e instanceof Error ? e.message : 'inconnue'}`)
        } finally {
            setSendingRelance(null)
        }
    }

    const filtered = documents.filter(d => {
        const matchSearch = d.numero?.toLowerCase().includes(search.toLowerCase()) ||
            d.client_nom?.toLowerCase().includes(search.toLowerCase())
        let matchType = true
        if (filterType === 'devis' || filterType === 'facture') matchType = d.type === filterType
        else if (filterType === 'impayees') matchType = computeOverdue(d, paidByDoc[d.id] || 0).isUnpaid
        return matchSearch && matchType
    })

    const statusConfig: Record<string, { color: string; label: string }> =
        Object.fromEntries(DOC_FIN_STATUTS.map(d => [d.value, { color: d.badge, label: d.label }]))

    if (loading) {
        return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
    }

    // KPIs agrégés en XOF (conversion des documents EUR/USD) : sinon on
    // additionnerait des devises différentes (337 EUR + 164 000 XOF = faux)
    const myCA = documents.filter(d => d.status === 'paye').reduce((s, d) => s + toXof(d.total, d.currency), 0)
    // Devis actifs = hors pipeline clos (payé, annulé, refusé) — pas seulement « non refusé »
    const activeDevis = documents.filter(d => d.type === 'devis' && !DOC_FIN_CLOS.includes(d.status as DocFinStatut)).length

    // Alarmes factures impayées
    const unpaidDocs = documents.filter(d => computeOverdue(d, paidByDoc[d.id] || 0).isUnpaid)
    const overdueDocs = unpaidDocs.filter(d => computeOverdue(d, paidByDoc[d.id] || 0).isOverdue)
    const unpaidAmount = unpaidDocs.reduce((s, d) => s + toXof(computeOverdue(d, paidByDoc[d.id] || 0).remaining, d.currency), 0)
    const overdueAmount = overdueDocs.reduce((s, d) => s + toXof(computeOverdue(d, paidByDoc[d.id] || 0).remaining, d.currency), 0)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Calculator size={16} className="text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Mon Espace Facturation</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Mes Documents Financiers</h1>
                    {erreur && <p className="text-red-400 text-sm font-semibold mt-1">{erreur}</p>}
                    <p className="text-gray-500 text-sm mt-1">Gérez vos propals techniques et factures clients.</p>
                </div>
                <Link href="/agent/devis/create" className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all">
                    <Plus size={16} /> Créer une Facture / Devis
                </Link>
            </div>

            {/* Alarme Factures en Retard */}
            {overdueDocs.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative bg-gradient-to-r from-red-500/15 via-orange-500/10 to-red-500/5 border border-red-500/30 rounded-xl p-4 flex items-start gap-4"
                >
                    <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle size={20} className="text-red-400" />
                        </div>
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-[#080e15]">
                            {overdueDocs.length}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-red-300 font-black text-sm flex items-center gap-2">
                            <Bell size={13} />
                            {overdueDocs.length} facture{overdueDocs.length > 1 ? 's' : ''} en retard de paiement
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                            <span className="font-mono text-orange-300 font-bold">{overdueAmount.toLocaleString('fr-FR')} XOF</span> à récupérer : relancez vos clients depuis la liste ci-dessous.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFilterType('impayees')}
                        className="flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0"
                    >
                        Voir la liste <Clock size={12} />
                    </button>
                </motion.div>
            )}

            {/* Stats Ultra Puissantes (Dashboard Agent) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <div className="bg-[#0c1420] border border-white/5 rounded-xl p-5 shadow-lg flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0`}>
                        <CheckCircle2 size={24} className="text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-white font-mono">{myCA.toLocaleString('fr-FR')} XOF</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Mes Ventes Converties (Payées)</p>
                    </div>
                </div>
                <div className="bg-[#0c1420] border border-white/5 rounded-xl p-5 shadow-lg flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0`}>
                        <FileText size={24} className="text-blue-400" />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-white font-mono">{activeDevis}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Devis Actifs (En négociation)</p>
                    </div>
                </div>
                <div className={`bg-[#0c1420] border rounded-xl p-5 shadow-lg flex items-center gap-5 ${unpaidDocs.length > 0 ? 'border-orange-500/30' : 'border-white/5'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${unpaidDocs.length > 0 ? 'bg-orange-500/10' : 'bg-gray-500/10'}`}>
                        <AlertCircle size={24} className={unpaidDocs.length > 0 ? 'text-orange-400' : 'text-gray-500'} />
                    </div>
                    <div>
                        <p className={`text-3xl font-black font-mono ${unpaidDocs.length > 0 ? 'text-orange-300' : 'text-gray-400'}`}>
                            {unpaidAmount.toLocaleString('fr-FR')} XOF
                        </p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">
                            {unpaidDocs.length} Impayée{unpaidDocs.length > 1 ? 's' : ''} · {overdueDocs.length} en retard
                        </p>
                    </div>
                </div>
            </div>

            {/* Search + Filter */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par Numéro ou Client..." className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
                </div>
                <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-full sm:w-auto">
                    {[
                        { k: 'all', l: 'Tous' },
                        { k: 'devis', l: 'Devis' },
                        { k: 'facture', l: 'Factures' },
                        { k: 'impayees', l: `Impayées${unpaidDocs.length > 0 ? ` (${unpaidDocs.length})` : ''}` },
                    ].map(f => (
                        <button
                            key={f.k}
                            type="button"
                            onClick={() => setFilterType(f.k as typeof filterType)}
                            className={`flex-1 sm:flex-none text-xs font-bold px-4 py-2 rounded-lg transition-all ${
                                filterType === f.k
                                    ? f.k === 'impayees'
                                        ? 'bg-orange-500/20 text-orange-400'
                                        : 'bg-emerald-500/20 text-emerald-400'
                                    : f.k === 'impayees' && unpaidDocs.length > 0
                                        ? 'text-orange-400/80 hover:text-orange-300'
                                        : 'text-gray-500 hover:text-white'
                            }`}
                        >
                            {f.l}
                        </button>
                    ))}
                </div>
            </div>

            {/* Document List */}
            <div className="bg-[#0c1420] border border-white/5 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/[0.02] border-b border-white/5">
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Document</th>
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Client</th>
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Total</th>
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Payé</th>
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Reste</th>
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Statut</th>
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-gray-500">
                                        <Receipt size={32} className="mx-auto mb-3 opacity-50" />
                                        <p className="text-sm font-semibold">Aucun document créé</p>
                                    </td>
                                </tr>
                            ) : filtered.map(doc => {
                                const alarm = computeOverdue(doc, paidByDoc[doc.id] || 0)
                                return (
                                <tr key={doc.id} className={`border-b border-white/5 transition-colors group ${alarm.isOverdue ? 'bg-red-500/[0.04] hover:bg-red-500/[0.08] border-l-2 border-l-red-500/60' : 'hover:bg-white/[0.02]'}`}>
                                    <td className="py-3 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${doc.type==='devis'?'bg-blue-500/10 text-blue-400':'bg-emerald-500/10 text-emerald-400'}`}>
                                                {doc.type === 'devis' ? <FileText size={16} /> : <Receipt size={16} />}
                                            </div>
                                            <div>
                                                <p className="text-white font-bold text-sm flex items-center gap-1.5">
                                                    {doc.numero}
                                                    {alarm.isOverdue && (
                                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-red-300 bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                                                            <AlertTriangle size={8} /> J+{alarm.daysLate}
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-gray-500 text-[10px]">{doc.created_at && !isNaN(new Date(doc.created_at).getTime()) ? new Date(doc.created_at).toLocaleDateString('fr-FR') : '-'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-5">
                                        <p className="text-white text-sm font-medium">{doc.client_nom} {doc.client_prenom}</p>
                                        <p className="text-gray-500 text-[10px]">{doc.client_email || doc.client_phone}</p>
                                    </td>
                                    <td className="py-3 px-5 text-right">
                                        <p className="text-white font-mono text-sm font-bold">{doc.total.toLocaleString('fr-FR')} {curLabel(doc.currency)}</p>
                                    </td>
                                    {(() => {
                                        const paid = paidByDoc[doc.id] || 0
                                        const remaining = Math.max(0, doc.total - paid)
                                        const fullyPaid = remaining === 0 && paid > 0
                                        return (
                                            <>
                                                <td className="py-3 px-5 text-right">
                                                    <p className={`font-mono text-sm font-bold ${paid > 0 ? 'text-emerald-400' : 'text-gray-600'}`}>
                                                        {paid.toLocaleString('fr-FR')} {curLabel(doc.currency)}
                                                    </p>
                                                </td>
                                                <td className="py-3 px-5 text-right">
                                                    <p className={`font-mono text-sm font-bold ${fullyPaid ? 'text-emerald-500' : remaining > 0 ? 'text-amber-400' : 'text-gray-600'}`}>
                                                        {fullyPaid ? '-' : `${remaining.toLocaleString('fr-FR')} ${curLabel(doc.currency)}`}
                                                    </p>
                                                </td>
                                            </>
                                        )
                                    })()}
                                    <td className="py-3 px-5 text-center">
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusConfig[doc.status]?.color || ''}`}>{statusConfig[doc.status]?.label || doc.status}</span>
                                    </td>
                                    <td className="py-3 px-5 text-right">
                                        <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    const url = `${window.location.origin}/portail/${doc.id}`
                                                    navigator.clipboard.writeText(url)
                                                    alert('Lien Magique Client copié dans le presse-papier !')
                                                }}
                                                className="p-2 text-gray-400 hover:text-amber-400 hover:bg-white/5 rounded-lg transition-all"
                                                title="Copier le Lien Client (WhatsApp)"
                                            >
                                                <LinkIcon size={16} />
                                            </button>
                                            <button onClick={() => setShowPreview(doc)} className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-white/5 rounded-lg transition-all" title="Aperçu / Modifier"><Eye size={16} /></button>
                                            <a href={`/portail/${doc.id}`} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-purple-400 hover:bg-white/5 rounded-lg transition-all inline-flex" title="Voir exactement comme le client le reçoit"><ExternalLink size={16} /></a>
                                            <button onClick={() => generatePDF(doc)} disabled={generating} className="p-2 text-gray-400 hover:text-blue-400 hover:bg-white/5 rounded-lg transition-all" title="Télécharger PDF">
                                                {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                            </button>
                                            <button onClick={() => sendPDFByEmail(doc)} disabled={sendingEmail === doc.id || !doc.client_email} className="p-2 text-gray-400 hover:text-amber-400 hover:bg-white/5 rounded-lg transition-all disabled:opacity-30" title={doc.client_email ? `Envoyer par email à ${doc.client_email}` : 'Email client manquant'}>
                                                {sendingEmail === doc.id ? <Loader2 size={16} className="animate-spin text-amber-400" /> : <Send size={16} />}
                                            </button>
                                            {alarm.isUnpaid && (
                                                <button
                                                    onClick={() => sendRelance(doc)}
                                                    disabled={sendingRelance === doc.id || !doc.client_email}
                                                    className={`p-2 rounded-lg transition-all disabled:opacity-30 ${alarm.isOverdue ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/10'}`}
                                                    title={alarm.isOverdue ? `Relancer : en retard de ${alarm.daysLate} jour(s)` : 'Envoyer une relance de paiement'}
                                                >
                                                    {sendingRelance === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                                                </button>
                                            )}
                                            {doc.type === 'facture' && (
                                                <button
                                                    onClick={() => toggleFacturePaid(doc)}
                                                    className={`p-2 rounded-lg transition-all ${doc.status === 'paye' ? 'text-emerald-400 hover:text-amber-400 hover:bg-amber-500/10' : 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10'}`}
                                                    title={doc.status === 'paye' ? 'Payée : cliquer pour marquer impayée' : 'Marquer cette facture comme payée'}
                                                >
                                                    {doc.status === 'paye' ? <CheckCircle2 size={16} /> : <BadgeDollarSign size={16} />}
                                                </button>
                                            )}
                                            <button onClick={() => handleDelete(doc.id)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all" title="Supprimer"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

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
                                    <img src="/logo.jpg" alt="Logo" className="w-12 h-12 rounded-lg object-cover" />
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 p-4 rounded-xl">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Client</p>
                                        <p className="text-white font-bold">{showPreview.client_nom} {showPreview.client_prenom}</p>
                                        <p className="text-gray-400 text-xs mt-1">{showPreview.client_email}</p>
                                        <p className="text-gray-400 text-xs">{showPreview.client_phone}</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-xl">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Récapitulatif</p>
                                        {(() => {
                                            const paid = paidByDoc[showPreview.id] || 0
                                            const remaining = Math.max(0, showPreview.total - paid)
                                            const fullyPaid = remaining === 0 && paid > 0
                                            return (
                                                <div className="space-y-1 mt-1">
                                                    <div className="flex items-baseline justify-between">
                                                        <span className="text-[10px] text-gray-500 font-bold uppercase">Total</span>
                                                        <span className="text-xl text-white font-black font-mono">{showPreview.total.toLocaleString('fr-FR')} {curLabel(showPreview.currency)}</span>
                                                    </div>
                                                    <div className="flex items-baseline justify-between">
                                                        <span className="text-[10px] text-gray-500 font-bold uppercase">Payé</span>
                                                        <span className={`text-sm font-black font-mono ${paid > 0 ? 'text-emerald-400' : 'text-gray-600'}`}>{paid.toLocaleString('fr-FR')} {curLabel(showPreview.currency)}</span>
                                                    </div>
                                                    <div className="flex items-baseline justify-between pt-1 border-t border-white/5">
                                                        <span className="text-[10px] text-gray-500 font-bold uppercase">Reste</span>
                                                        <span className={`text-lg font-black font-mono ${fullyPaid ? 'text-emerald-500' : remaining > 0 ? 'text-amber-400' : 'text-gray-600'}`}>
                                                            {fullyPaid ? 'SOLDÉ ' : `${remaining.toLocaleString('fr-FR')} ${curLabel(showPreview.currency)}`}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })()}
                                    </div>
                                </div>

                                <div className="border border-white/5 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-white/5 text-gray-400 text-left">
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

                                <div className="border-t border-white/5 pt-4">
                                    <p className="text-xs text-info-400 mb-2 flex items-center gap-2">
                                        <AlertCircle size={14}/>
                                        En tant qu'Agent, laissez le système changer le statut automatiquement lorsque le client signe ou paie via le lien.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
