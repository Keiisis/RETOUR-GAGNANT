'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    FileText, Plus, Trash2, X, Save, Loader2, Search,
    Send, Download, Eye, Edit3, Calculator, Receipt,
    Phone, Mail, ChevronDown, CheckCircle2
} from 'lucide-react'

interface DevisItem {
    description: string
    quantity: number
    unit_price: number
    tva: number
}

interface Devis {
    id: string
    type: 'devis' | 'facture'
    numero: string
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
}

const defaultConditions = `• Validité : 30 jours à compter de la date d'émission
• Paiement : 50% à la commande, solde à la livraison
• Les tarifs sont exprimés en FCFA
• Ce document n'a pas valeur de facture tant qu'il n'est pas accepté`

export default function AgentDevisPage() {
    const [documents, setDocuments] = useState<Devis[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'devis' | 'facture'>('all')
    const [showForm, setShowForm] = useState(false)
    const [showPreview, setShowPreview] = useState<Devis | null>(null)
    const [saving, setSaving] = useState(false)
    const [generating, setGenerating] = useState(false)

    // Form state
    const [formType, setFormType] = useState<'devis' | 'facture'>('devis')
    const [clientNom, setClientNom] = useState('')
    const [clientPrenom, setClientPrenom] = useState('')
    const [clientEmail, setClientEmail] = useState('')
    const [clientPhone, setClientPhone] = useState('')
    const [clientAdresse, setClientAdresse] = useState('')
    const [items, setItems] = useState<DevisItem[]>([{ description: '', quantity: 1, unit_price: 0, tva: 18 }])
    const [remise, setRemise] = useState(0)
    const [notes, setNotes] = useState('')
    const [conditions, setConditions] = useState(defaultConditions)
    const [validite, setValidite] = useState('30 jours')

    const fetchDocuments = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('agent_devis')
            .select('*')
            .eq('agent_id', user.id)
            .order('created_at', { ascending: false })

        setDocuments((data || []) as Devis[])
        setLoading(false)
    }, [])

    useEffect(() => { fetchDocuments() }, [fetchDocuments])

    const generateNumero = (type: 'devis' | 'facture') => {
        const prefix = type === 'devis' ? 'DEV' : 'FAC'
        const date = new Date()
        const yr = date.getFullYear()
        const mn = String(date.getMonth() + 1).padStart(2, '0')
        const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0')
        return `${prefix}-${yr}${mn}-${rand}`
    }

    const sousTotal = items.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0)
    const totalTVA = items.reduce((sum, it) => sum + (it.quantity * it.unit_price * it.tva / 100), 0)
    const totalFinal = sousTotal + totalTVA - remise

    const addItem = () => setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0, tva: 18 }])
    const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))
    const updateItem = (i: number, field: keyof DevisItem, value: string | number) => {
        setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
    }

    const resetForm = () => {
        setFormType('devis'); setClientNom(''); setClientPrenom('')
        setClientEmail(''); setClientPhone(''); setClientAdresse('')
        setItems([{ description: '', quantity: 1, unit_price: 0, tva: 18 }])
        setRemise(0); setNotes(''); setConditions(defaultConditions); setValidite('30 jours')
    }

    const handleSave = async () => {
        if (!clientNom.trim() || items.length === 0) return
        setSaving(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const docData = {
            agent_id: user.id,
            type: formType,
            numero: generateNumero(formType),
            client_nom: clientNom, client_prenom: clientPrenom,
            client_email: clientEmail, client_phone: clientPhone,
            client_adresse: clientAdresse,
            items, sous_total: sousTotal, total_tva: totalTVA,
            remise, total: totalFinal,
            status: 'brouillon', notes, conditions, validite,
        }

        await supabase.from('agent_devis').insert(docData)
        await fetchDocuments()
        setShowForm(false)
        resetForm()
        setSaving(false)
    }

    const handleDelete = async (id: string) => {
        await supabase.from('agent_devis').delete().eq('id', id)
        setDocuments(prev => prev.filter(d => d.id !== id))
        setShowPreview(null)
    }

    const handleUpdateStatus = async (id: string, status: string) => {
        await supabase.from('agent_devis').update({ status }).eq('id', id)
        setDocuments(prev => prev.map(d => d.id === id ? { ...d, status } : d))
        if (showPreview?.id === id) setShowPreview(prev => prev ? { ...prev, status } : null)
    }

    const generatePDF = async (doc: Devis) => {
        setGenerating(true)
        try {
            const jsPDF = (await import('jspdf')).default

            const pdf = new jsPDF('p', 'mm', 'a4')
            const pageWidth = 210
            const margin = 20

            // Header background
            pdf.setFillColor(10, 18, 16)
            pdf.rect(0, 0, pageWidth, 52, 'F')

            // Green accent line
            pdf.setFillColor(16, 185, 129)
            pdf.rect(0, 52, pageWidth, 2, 'F')

            // Company name header
            pdf.setTextColor(16, 185, 129)
            pdf.setFontSize(22)
            pdf.setFont('helvetica', 'bold')
            pdf.text('RETOUR GAGNANT', margin, 22)

            pdf.setTextColor(180, 180, 180)
            pdf.setFontSize(9)
            pdf.setFont('helvetica', 'normal')
            pdf.text('Agence de Services Internationaux', margin, 30)
            pdf.text('Cotonou, Bénin | contact@retourgagnant.com', margin, 36)
            pdf.text('+229 XX XX XX XX | www.retourgagnant.com', margin, 42)

            // Document type badge
            const typeLabel = doc.type === 'devis' ? 'DEVIS' : 'FACTURE'
            pdf.setTextColor(16, 185, 129)
            pdf.setFontSize(28)
            pdf.setFont('helvetica', 'bold')
            pdf.text(typeLabel, pageWidth - margin, 25, { align: 'right' })

            pdf.setTextColor(120, 120, 120)
            pdf.setFontSize(9)
            pdf.text(`N° ${doc.numero}`, pageWidth - margin, 35, { align: 'right' })
            pdf.text(`Date: ${new Date(doc.created_at).toLocaleDateString('fr-FR')}`, pageWidth - margin, 42, { align: 'right' })

            let y = 66

            // Client info box
            pdf.setFillColor(245, 248, 250)
            pdf.roundedRect(margin, y, pageWidth - margin * 2, 32, 3, 3, 'F')

            pdf.setTextColor(80, 80, 80)
            pdf.setFontSize(8)
            pdf.setFont('helvetica', 'bold')
            pdf.text('DESTINATAIRE', margin + 6, y + 8)

            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(10)
            pdf.setTextColor(30, 30, 30)
            pdf.text(`${doc.client_nom} ${doc.client_prenom}`, margin + 6, y + 16)

            pdf.setFontSize(8)
            pdf.setTextColor(100, 100, 100)
            const clientDetails = [doc.client_email, doc.client_phone, doc.client_adresse].filter(Boolean).join(' | ')
            pdf.text(clientDetails, margin + 6, y + 23)

            y += 42

            // Table header
            const colWidths = [80, 20, 28, 18, 24]
            const colX = [margin, margin + 80, margin + 100, margin + 128, margin + 146]

            pdf.setFillColor(16, 185, 129)
            pdf.rect(margin, y, pageWidth - margin * 2, 9, 'F')

            pdf.setTextColor(255, 255, 255)
            pdf.setFontSize(8)
            pdf.setFont('helvetica', 'bold')
            const headers = ['Description', 'Qté', 'Prix Unit.', 'TVA', 'Total HT']
            headers.forEach((h, i) => {
                pdf.text(h, colX[i] + 3, y + 6)
            })

            y += 9

            // Table rows
            doc.items.forEach((item: DevisItem, i: number) => {
                const rowColor = i % 2 === 0 ? 255 : 248
                pdf.setFillColor(rowColor, rowColor, rowColor)
                pdf.rect(margin, y, pageWidth - margin * 2, 8, 'F')

                pdf.setTextColor(50, 50, 50)
                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(8)
                pdf.text(item.description || 'Service', colX[0] + 3, y + 5.5)
                pdf.text(String(item.quantity), colX[1] + 3, y + 5.5)
                pdf.text(`${item.unit_price.toLocaleString('fr-FR')}`, colX[2] + 3, y + 5.5)
                pdf.text(`${item.tva}%`, colX[3] + 3, y + 5.5)
                pdf.text(`${(item.quantity * item.unit_price).toLocaleString('fr-FR')}`, colX[4] + 3, y + 5.5)
                y += 8
            })

            // Separator line
            pdf.setDrawColor(220, 220, 220)
            pdf.line(margin, y + 2, pageWidth - margin, y + 2)

            y += 8

            // Totals section
            const totalsX = pageWidth - margin - 65

            pdf.setFontSize(9)
            pdf.setTextColor(80, 80, 80)
            pdf.setFont('helvetica', 'normal')
            pdf.text('Sous-Total HT:', totalsX, y)
            pdf.text(`${doc.sous_total.toLocaleString('fr-FR')} FCFA`, pageWidth - margin, y, { align: 'right' })
            y += 7

            pdf.text('TVA:', totalsX, y)
            pdf.text(`${doc.total_tva.toLocaleString('fr-FR')} FCFA`, pageWidth - margin, y, { align: 'right' })
            y += 7

            if (doc.remise > 0) {
                pdf.setTextColor(220, 50, 50)
                pdf.text('Remise:', totalsX, y)
                pdf.text(`-${doc.remise.toLocaleString('fr-FR')} FCFA`, pageWidth - margin, y, { align: 'right' })
                y += 7
            }

            // Total final
            pdf.setFillColor(16, 185, 129)
            pdf.roundedRect(totalsX - 5, y - 1, pageWidth - margin - totalsX + 5, 12, 2, 2, 'F')
            pdf.setTextColor(255, 255, 255)
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(11)
            pdf.text('TOTAL TTC:', totalsX, y + 7)
            pdf.text(`${doc.total.toLocaleString('fr-FR')} FCFA`, pageWidth - margin - 2, y + 7, { align: 'right' })

            y += 22

            // Notes
            if (doc.notes) {
                pdf.setTextColor(80, 80, 80)
                pdf.setFontSize(8)
                pdf.setFont('helvetica', 'bold')
                pdf.text('NOTES', margin, y)
                y += 5
                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(7)
                pdf.setTextColor(120, 120, 120)
                const noteLines = pdf.splitTextToSize(doc.notes, pageWidth - margin * 2)
                pdf.text(noteLines, margin, y)
                y += noteLines.length * 4 + 5
            }

            // Conditions
            if (doc.conditions) {
                pdf.setTextColor(80, 80, 80)
                pdf.setFontSize(8)
                pdf.setFont('helvetica', 'bold')
                pdf.text('CONDITIONS', margin, y)
                y += 5
                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(7)
                pdf.setTextColor(120, 120, 120)
                const condLines = pdf.splitTextToSize(doc.conditions, pageWidth - margin * 2)
                pdf.text(condLines, margin, y)
            }

            // Footer
            pdf.setFillColor(10, 18, 16)
            pdf.rect(0, 282, pageWidth, 15, 'F')
            pdf.setTextColor(100, 100, 100)
            pdf.setFontSize(7)
            pdf.text('RETOUR GAGNANT - Agence de Services Internationaux | RCCM: XX-XXXX | NIF: XXXXXXX', pageWidth / 2, 290, { align: 'center' })

            pdf.save(`${doc.type}_${doc.numero}.pdf`)
        } catch (err) {
            console.error('PDF generation error:', err)
        }
        setGenerating(false)
    }

    const sendByEmail = (doc: Devis) => {
        const subject = `${doc.type === 'devis' ? 'Devis' : 'Facture'} N°${doc.numero} - RETOUR GAGNANT`
        const body = `Bonjour ${doc.client_prenom},\n\nVeuillez trouver ci-joint votre ${doc.type} N°${doc.numero}.\n\nMontant total: ${doc.total.toLocaleString('fr-FR')} FCFA\n\nCordialement,\nRETOUR GAGNANT`
        window.open(`mailto:${doc.client_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
        handleUpdateStatus(doc.id, 'envoye')
    }

    const sendByWhatsApp = (doc: Devis) => {
        const msg = `Bonjour ${doc.client_prenom},\n\nVoici votre ${doc.type} N°${doc.numero}.\n\nDétails:\n${doc.items.map((it: DevisItem) => `• ${it.description}: ${(it.quantity * it.unit_price).toLocaleString('fr-FR')} FCFA`).join('\n')}\n\n*Total TTC: ${doc.total.toLocaleString('fr-FR')} FCFA*\n\nCordialement,\nRETOUR GAGNANT`
        window.open(`https://wa.me/${doc.client_phone?.replace(/\s+/g, '')}?text=${encodeURIComponent(msg)}`)
        handleUpdateStatus(doc.id, 'envoye')
    }

    const filtered = documents.filter(d => {
        const matchSearch = d.numero?.toLowerCase().includes(search.toLowerCase()) ||
            d.client_nom?.toLowerCase().includes(search.toLowerCase())
        const matchType = filterType === 'all' || d.type === filterType
        return matchSearch && matchType
    })

    const statusConfig: Record<string, { color: string; label: string }> = {
        brouillon: { color: 'bg-gray-500/20 text-gray-400', label: 'Brouillon' },
        envoye: { color: 'bg-blue-500/20 text-blue-400', label: 'Envoyé' },
        accepte: { color: 'bg-emerald-500/20 text-emerald-400', label: 'Accepté' },
        refuse: { color: 'bg-red-500/20 text-red-400', label: 'Refusé' },
        paye: { color: 'bg-green-500/20 text-green-400', label: 'Payé' },
    }

    if (loading) {
        return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Receipt size={16} className="text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Facturation</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Devis & Factures</h1>
                    <p className="text-gray-500 text-sm mt-1">{documents.length} document(s)</p>
                </div>
                <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all">
                    <Plus size={16} /> Nouveau Document
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Devis', value: documents.filter(d => d.type === 'devis').length, icon: FileText, color: 'text-blue-400' },
                    { label: 'Factures', value: documents.filter(d => d.type === 'facture').length, icon: Receipt, color: 'text-emerald-400' },
                    { label: 'Envoyés', value: documents.filter(d => d.status === 'envoye').length, icon: Send, color: 'text-purple-400' },
                    { label: 'CA Total', value: `${documents.filter(d => d.status === 'paye').reduce((s, d) => s + d.total, 0).toLocaleString('fr-FR')}`, icon: Calculator, color: 'text-amber-400' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                        <stat.icon size={16} className={`${stat.color} mb-2`} />
                        <p className="text-xl font-black text-white">{stat.value}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Search + Filter */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un document..." title="Rechercher" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
                </div>
                <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                    {[{ k: 'all', l: 'Tous' }, { k: 'devis', l: 'Devis' }, { k: 'facture', l: 'Factures' }].map(f => (
                        <button key={f.k} onClick={() => setFilterType(f.k as typeof filterType)} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${filterType === f.k ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:text-white'}`}>{f.l}</button>
                    ))}
                </div>
            </div>

            {/* Document List */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center text-gray-500">
                        <Receipt size={40} className="mx-auto mb-3 text-gray-700" />
                        <p className="text-sm font-semibold">Aucun document</p>
                    </div>
                ) : filtered.map((doc, i) => (
                    <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 hover:border-emerald-500/20 transition-all">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${doc.type === 'devis' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                    {doc.type === 'devis' ? <FileText size={18} /> : <Receipt size={18} />}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">{doc.numero}</p>
                                    <p className="text-xs text-gray-500">{doc.client_nom} {doc.client_prenom} • {new Date(doc.created_at).toLocaleDateString('fr-FR')}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <p className="text-sm font-bold text-white">{doc.total?.toLocaleString('fr-FR')} FCFA</p>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusConfig[doc.status]?.color || ''}`}>{statusConfig[doc.status]?.label || doc.status}</span>
                                <div className="flex gap-1">
                                    <button onClick={() => setShowPreview(doc)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-emerald-400" title="Voir"><Eye size={14} /></button>
                                    <button onClick={() => generatePDF(doc)} disabled={generating} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-blue-400" title="PDF"><Download size={14} /></button>
                                    <button onClick={() => handleDelete(doc.id)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-red-400" title="Supprimer"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Preview Modal */}
            <AnimatePresence>
                {showPreview && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowPreview(null)}>
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()} className="bg-[#0a0f14] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            {/* Preview Header */}
                            <div className="bg-gradient-to-r from-[#0a1210] to-[#0a1614] border-b border-emerald-500/20 p-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-emerald-400 text-xl font-black tracking-wider">RETOUR GAGNANT</p>
                                        <p className="text-gray-500 text-xs mt-1">Agence de Services Internationaux</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-emerald-400">{showPreview.type === 'devis' ? 'DEVIS' : 'FACTURE'}</p>
                                        <p className="text-xs text-gray-500 mt-1">N° {showPreview.numero}</p>
                                        <p className="text-xs text-gray-500">{new Date(showPreview.created_at).toLocaleDateString('fr-FR')}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Client Info */}
                                <div className="bg-white/5 rounded-xl p-4">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Destinataire</p>
                                    <p className="text-sm font-bold text-white">{showPreview.client_nom} {showPreview.client_prenom}</p>
                                    <p className="text-xs text-gray-400 mt-1">{[showPreview.client_email, showPreview.client_phone, showPreview.client_adresse].filter(Boolean).join(' • ')}</p>
                                </div>

                                {/* Items Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-emerald-500/20">
                                                <th className="text-left py-2 text-[10px] font-bold text-emerald-400 uppercase">Description</th>
                                                <th className="text-center py-2 text-[10px] font-bold text-emerald-400 uppercase">Qté</th>
                                                <th className="text-right py-2 text-[10px] font-bold text-emerald-400 uppercase">Prix Unit.</th>
                                                <th className="text-center py-2 text-[10px] font-bold text-emerald-400 uppercase">TVA</th>
                                                <th className="text-right py-2 text-[10px] font-bold text-emerald-400 uppercase">Total HT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {showPreview.items?.map((item: DevisItem, i: number) => (
                                                <tr key={i} className="border-b border-white/5">
                                                    <td className="py-2 text-gray-300">{item.description}</td>
                                                    <td className="py-2 text-gray-400 text-center">{item.quantity}</td>
                                                    <td className="py-2 text-gray-400 text-right">{item.unit_price?.toLocaleString('fr-FR')}</td>
                                                    <td className="py-2 text-gray-400 text-center">{item.tva}%</td>
                                                    <td className="py-2 text-white font-bold text-right">{(item.quantity * item.unit_price).toLocaleString('fr-FR')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Totals */}
                                <div className="flex justify-end">
                                    <div className="w-64 space-y-2">
                                        <div className="flex justify-between text-sm text-gray-400"><span>Sous-Total HT</span><span>{showPreview.sous_total?.toLocaleString('fr-FR')} FCFA</span></div>
                                        <div className="flex justify-between text-sm text-gray-400"><span>TVA</span><span>{showPreview.total_tva?.toLocaleString('fr-FR')} FCFA</span></div>
                                        {showPreview.remise > 0 && <div className="flex justify-between text-sm text-red-400"><span>Remise</span><span>-{showPreview.remise?.toLocaleString('fr-FR')} FCFA</span></div>}
                                        <div className="flex justify-between text-lg font-black text-emerald-400 border-t border-emerald-500/20 pt-2"><span>TOTAL TTC</span><span>{showPreview.total?.toLocaleString('fr-FR')} FCFA</span></div>
                                    </div>
                                </div>

                                {showPreview.notes && <div className="bg-white/5 rounded-xl p-4"><p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Notes</p><p className="text-xs text-gray-400">{showPreview.notes}</p></div>}

                                {/* Status + Actions */}
                                <div className="border-t border-white/5 pt-4">
                                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Statut:</p>
                                        {Object.entries(statusConfig).map(([key, cfg]) => (
                                            <button key={key} onClick={() => handleUpdateStatus(showPreview.id, key)} className={`text-[10px] font-bold px-2 py-1 rounded-full transition-all ${showPreview.status === key ? cfg.color : 'bg-white/5 text-gray-600 hover:text-white'}`}>{cfg.label}</button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => generatePDF(showPreview)} disabled={generating} className="flex-1 flex items-center justify-center gap-1 text-xs py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold hover:bg-blue-500/30">
                                            {generating ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF
                                        </button>
                                        <button onClick={() => sendByEmail(showPreview)} className="flex-1 flex items-center justify-center gap-1 text-xs py-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold hover:bg-purple-500/30">
                                            <Mail size={12} /> Email
                                        </button>
                                        {showPreview.client_phone && (
                                            <button onClick={() => sendByWhatsApp(showPreview)} className="flex-1 flex items-center justify-center gap-1 text-xs py-2.5 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 font-bold hover:bg-green-500/30">
                                                <Phone size={12} /> WhatsApp
                                            </button>
                                        )}
                                        <button onClick={() => setShowPreview(null)} className="px-3 py-2.5 rounded-xl border border-white/10 text-gray-500 hover:text-white" title="Fermer"><X size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create Form Modal */}
            <AnimatePresence>
                {showForm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()} className="bg-[#0a0f14] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <h3 className="text-lg font-bold text-white mb-4">Nouveau Document</h3>

                            {/* Type Toggle */}
                            <div className="flex gap-2 mb-5">
                                {(['devis', 'facture'] as const).map(t => (
                                    <button key={t} onClick={() => setFormType(t)} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${formType === t ? (t === 'devis' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30') : 'bg-white/5 text-gray-500 border border-white/5'}`}>
                                        {t === 'devis' ? 'Devis' : 'Facture'}
                                    </button>
                                ))}
                            </div>

                            {/* Client Info */}
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Informations Client</p>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <input type="text" value={clientNom} onChange={e => setClientNom(e.target.value)} placeholder="Nom *" title="Nom" className="bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                <input type="text" value={clientPrenom} onChange={e => setClientPrenom(e.target.value)} placeholder="Prénom" title="Prénom" className="bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="Email" title="Email" className="bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                <input type="text" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="Téléphone / WhatsApp" title="Téléphone" className="bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                <input type="text" value={clientAdresse} onChange={e => setClientAdresse(e.target.value)} placeholder="Adresse" title="Adresse" className="col-span-2 bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                            </div>

                            {/* Services */}
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Services / Prestations</p>
                            <div className="space-y-2 mb-3">
                                {items.map((item, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                        <input type="text" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Description" title="Description" className="col-span-5 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-xs placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                        <input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 0)} title="Quantité" className="col-span-2 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-xs focus:outline-none focus:border-emerald-500/50" />
                                        <input type="number" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', parseInt(e.target.value) || 0)} title="Prix unitaire" className="col-span-2 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-xs focus:outline-none focus:border-emerald-500/50" />
                                        <input type="number" value={item.tva} onChange={e => updateItem(i, 'tva', parseInt(e.target.value) || 0)} title="TVA %" className="col-span-2 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-xs focus:outline-none focus:border-emerald-500/50" />
                                        <button onClick={() => removeItem(i)} className="col-span-1 text-gray-500 hover:text-red-400" title="Supprimer"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={addItem} className="text-xs text-emerald-400 font-bold flex items-center gap-1 mb-4 hover:text-emerald-300"><Plus size={12} /> Ajouter une ligne</button>

                            {/* Totals Preview */}
                            <div className="bg-white/5 rounded-xl p-4 mb-4 space-y-1">
                                <div className="flex justify-between text-xs text-gray-400"><span>Sous-Total HT</span><span>{sousTotal.toLocaleString('fr-FR')} FCFA</span></div>
                                <div className="flex justify-between text-xs text-gray-400"><span>TVA</span><span>{totalTVA.toLocaleString('fr-FR')} FCFA</span></div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-400">Remise</span>
                                    <input type="number" value={remise} onChange={e => setRemise(parseInt(e.target.value) || 0)} title="Remise" className="w-24 bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-white text-xs text-right focus:outline-none focus:border-emerald-500/50" />
                                </div>
                                <div className="flex justify-between text-sm font-bold text-emerald-400 border-t border-white/5 pt-2"><span>TOTAL TTC</span><span>{totalFinal.toLocaleString('fr-FR')} FCFA</span></div>
                            </div>

                            {/* Notes & Conditions */}
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optionnel)" title="Notes" rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none mb-3" />
                            <textarea value={conditions} onChange={e => setConditions(e.target.value)} placeholder="Conditions" title="Conditions" rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none mb-4" />

                            <div className="flex gap-3">
                                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-bold">Annuler</button>
                                <button onClick={handleSave} disabled={saving || !clientNom.trim()} className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Sauvegarder
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
