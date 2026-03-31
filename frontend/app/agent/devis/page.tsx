'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    FileText, Plus, Trash2, X, Loader2, Search,
    Download, Eye, Calculator, Receipt, Send,
    Phone, Mail, CheckCircle2, AlertCircle, Link as LinkIcon
} from 'lucide-react'
import Link from 'next/link'
import { LOGO_BASE64, STAMP_BASE64 } from '@/lib/logoBase64'

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
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'devis' | 'facture'>('all')
    const [showPreview, setShowPreview] = useState<DocumentFinancier | null>(null)
    const [generating, setGenerating] = useState(false)
    const [sendingEmail, setSendingEmail] = useState<string | null>(null)

    const fetchDocuments = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Requête 1 : documents directement assignés à cet agent
        const { data: ownDocs } = await supabase
            .from('documents_financiers')
            .select('*')
            .eq('agent_id', user.id)
            .order('created_at', { ascending: false })

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
        allDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        setDocuments(allDocs)
        setLoading(false)
    }, [])

    useEffect(() => { fetchDocuments() }, [fetchDocuments])

    const handleDelete = async (id: string) => {
        if(!confirm('Voulez-vous vraiment supprimer ce document ?')) return;
        await supabase.from('documents_financiers').delete().eq('id', id)
        setDocuments(prev => prev.filter(d => d.id !== id))
        setShowPreview(null)
    }

    const handleUpdateStatus = async (id: string, status: string) => {
        await supabase.from('documents_financiers').update({ status }).eq('id', id)
        setDocuments(prev => prev.map(d => d.id === id ? { ...d, status } : d))
        if (showPreview?.id === id) setShowPreview(prev => prev ? { ...prev, status } : null)
    }

    const fmtN = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

    const generatePDF = async (doc: DocumentFinancier) => {
        setGenerating(true)
        try {
            // Fetch ERP Templates (aligned with admin/settings/erp)
            const { data: templateData } = await supabase
                .from('document_templates')
                .select('content')
                .eq('id', 'official_devis_facture')
                .single()

            const tpl = templateData?.content || {}
            const devisHeader = tpl.header || "RETOUR GAGNANT BÉNIN\nRCCM : RB/COT/26 B 42001 | IFU : 3202644573981\nHaie-Vive Cocotiers, Cotonou, Bénin\n+229 01 60 32 21 21 / +229 01 94 35 50 50\ncontact@retourgagnantbenin.bj"
            const devisFooter = tpl.footer || "RETOUR GAGNANT BÉNIN — RCCM : RB/COT/26 B 42001 — IFU : 3202644573981\nSiège : Haie-Vive Cocotiers, Cotonou. Email : contact@retourgagnantbenin.bj"
            const presidentName = tpl.signature_name || "N. R. G"
            const presidentTitle = tpl.signature_title || "LA DIRECTION GÉNÉRALE"

            const jsPDF = (await import('jspdf')).default
            const pdf = new jsPDF('p', 'mm', 'a4')
            const pw = 210
            const ph = 297
            const ml = 14
            const mr = 14
            const cw = pw - ml - mr

            const statusLabels: Record<string, string> = { 
                brouillon: 'BROUILLON', envoye: 'ENVOYÉ', accepte: 'ACCEPTÉ', 
                refuse: 'REFUSÉ', paye: 'PAYÉ', en_retard: 'EN RETARD', annule: 'ANNULÉ' 
            }
            const statusColorMap: Record<string, [number, number, number]> = {
                brouillon: [100, 100, 100], envoye: [59, 130, 246], accepte: [0, 160, 90],
                refuse: [230, 60, 60], paye: [16, 185, 129], en_retard: [245, 158, 11], annule: [100, 100, 100]
            }

            // ── BENIN FLAG BANNER (Robust for Printing) ───────────
            pdf.setLineWidth(4)
            pdf.setDrawColor(0, 135, 81)
            pdf.line(0, 3, pw / 3, 3)
            pdf.setDrawColor(252, 209, 22)
            pdf.line(pw / 3, 3, (pw * 2) / 3, 3)
            pdf.setDrawColor(232, 17, 45)
            pdf.line((pw * 2) / 3, 3, pw, 3)

            // ── WHITE HEADER ──────────────────────────────────────
            const headerTop = 4
            const headerH = 48
            pdf.setFillColor(255, 255, 255)
            pdf.rect(0, headerTop, pw, headerH, 'F')

            // Ligne de separation
            pdf.setDrawColor(230, 230, 230)
            pdf.setLineWidth(0.2)
            pdf.line(ml, headerTop + headerH, pw - mr, headerTop + headerH)

            // ── LOGO & BRANDING ───────────────────────────────────
            const logoSize = 28
            const logoX = ml - 2
            const logoY = headerTop + 8

            // Cercle blanc derrière le logo transparent
            pdf.setFillColor(255, 255, 255)
            pdf.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2, 'F')

            try {
                pdf.addImage(LOGO_BASE64, 'PNG', logoX, logoY, logoSize, logoSize)
            } catch (e) {
                console.error('Logo error:', e)
            }

            const textStartX = logoX + logoSize + 4
            const nameY = logoY + 9

            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(18)
            pdf.setTextColor(0, 135, 81)
            pdf.text('RETOUR ', textStartX, nameY)
            pdf.setTextColor(232, 17, 45)
            pdf.text('GAGNANT', textStartX + 26, nameY)

            pdf.setFontSize(9)
            pdf.setTextColor(100, 100, 100)
            pdf.setCharSpace(2)
            pdf.text('BÉNIN', textStartX, nameY + 6.5)
            pdf.setCharSpace(0)

            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(7.5)
            pdf.setTextColor(140, 140, 140)
            const sloganText = "L'agence d'accompagnement à la Nationalité Béninoise et au retour des Afro-descendants."
            const sloganLines = pdf.splitTextToSize(sloganText, 85)
            sloganLines.forEach((line: string, i: number) => {
                pdf.text(line, textStartX, nameY + 12 + i * 3.5)
            })

            // ── TYPE DOCUMENT ─────────────────────────────────────
            const typeLabel = doc.type === 'devis' ? 'DEVIS' : 'FACTURE'
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(26)
            pdf.setTextColor(doc.type === 'devis' ? 180 : 0, doc.type === 'devis' ? 130 : 135, doc.type === 'devis' ? 0 : 81)
            pdf.text(typeLabel, pw - mr, headerTop + 14, { align: 'right' })

            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(8.5)
            pdf.setTextColor(80, 80, 80)
            pdf.text(`N° ${doc.numero}`, pw - mr, headerTop + 22, { align: 'right' })
            pdf.text(`Date : ${new Date(doc.created_at).toLocaleDateString('fr-FR')}`, pw - mr, headerTop + 27, { align: 'right' })
            pdf.text(doc.type === 'facture' ? `Délai : ${doc.validite}` : `Validité : ${doc.validite}`, pw - mr, headerTop + 32, { align: 'right' })

            // Status Badge
            const sc = statusColorMap[doc.status] || [90, 90, 90]
            const badgeY = headerTop + 37
            const badgeW = 32
            const badgeH = 8
            pdf.setFillColor(sc[0], sc[1], sc[2])
            pdf.roundedRect(pw - mr - badgeW, badgeY, badgeW, badgeH, 1.5, 1.5, 'F')
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(7.5)
            pdf.setTextColor(255, 255, 255)
            pdf.text(statusLabels[doc.status] || doc.status.toUpperCase(), pw - mr - badgeW / 2, badgeY + 5.5, { align: 'center' })

            let y = headerTop + headerH + 8

            // ── ADRESSES ──────────────────────────────────────────
            const boxW = (cw - 6) / 2
            const boxH = 50

            // EMETTEUR
            pdf.setFillColor(12, 20, 32)
            pdf.setDrawColor(40, 60, 90)
            pdf.roundedRect(ml, y, boxW, boxH, 2, 2, 'FD')

            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(6.5)
            pdf.setTextColor(110, 150, 200)
            pdf.text('ÉMETTEUR', ml + 4, y + 7)
            pdf.setFontSize(8)
            pdf.setTextColor(255, 255, 255)
            const headerLines = pdf.splitTextToSize(devisHeader, boxW - 8)
            headerLines.forEach((l: string, i: number) => {
                const isFirst = i === 0
                if (isFirst) {
                    pdf.setFont('helvetica', 'bold')
                    pdf.setFontSize(10)
                } else {
                    pdf.setFont('helvetica', 'normal')
                    pdf.setFontSize(7)
                    if (i === 1) pdf.setTextColor(160, 180, 210)
                }
                const offset = isFirst ? 15 : (22 + (i - 1) * 6)
                pdf.text(l, ml + 4, y + offset)
            })

            // DESTINATAIRE
            pdf.setFillColor(248, 250, 255)
            pdf.setDrawColor(200, 215, 240)
            const toX = ml + boxW + 6
            pdf.roundedRect(toX, y, boxW, boxH, 2, 2, 'FD')

            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(6.5)
            pdf.setTextColor(100, 110, 160)
            pdf.text('DESTINATAIRE', toX + 4, y + 7)
            pdf.setFontSize(10)
            pdf.setTextColor(15, 25, 50)
            pdf.text(`${doc.client_nom} ${doc.client_prenom}`, toX + 4, y + 15)
            pdf.setFontSize(7.5)
            pdf.setTextColor(70, 80, 110)
            pdf.text(doc.client_email || '', toX + 4, y + 22)
            pdf.text(doc.client_phone || '', toX + 4, y + 28)
            if (doc.client_adresse) {
                const lines = pdf.splitTextToSize(doc.client_adresse, boxW - 8)
                lines.slice(0, 2).forEach((l: string, i: number) => pdf.text(l, toX + 4, y + 35 + i * 5))
            }

            y += boxH + 10

            // ── TABLE ─────────────────────────────────────────────
            const cols = [
                { h: 'DESCRIPTION DU SERVICE', w: 68 },
                { h: 'QTÉ', w: 14, a: 'center' },
                { h: 'PU HT', w: 28, a: 'right' },
                { h: 'TVA', w: 15, a: 'center' },
                { h: 'TVA MNT', w: 22, a: 'right' },
                { h: 'TOTAL HT', w: 35, a: 'right' },
            ]

            pdf.setFillColor(15, 25, 45)
            pdf.rect(ml, y, cw, 10, 'F')
            let cx = ml
            pdf.setFontSize(6.5)
            pdf.setTextColor(255, 255, 255)
            cols.forEach(c => {
                const tx = c.a === 'right' ? cx + c.w - 2 : c.a === 'center' ? cx + c.w / 2 : cx + 3
                pdf.text(c.h, tx, y + 6.5, { align: (c.a || 'left') as any })
                cx += c.w
            })
            y += 10

            doc.items.forEach((it, i) => {
                const rh = 9
                pdf.setFillColor(i % 2 === 0 ? 252 : 246, i % 2 === 0 ? 253 : 248, i % 2 === 0 ? 255 : 252)
                pdf.rect(ml, y, cw, rh, 'F')
                pdf.setDrawColor(220, 230, 240)
                pdf.line(ml, y + rh, ml + cw, y + rh)

                const data = [
                    { t: it.description, w: cols[0].w },
                    { t: it.quantity.toString(), w: cols[1].w, a: 'center' },
                    { t: fmtN(it.unit_price), w: cols[2].w, a: 'right' },
                    { t: it.tva + '%', w: cols[3].w, a: 'center' },
                    { t: fmtN(it.quantity * it.unit_price * it.tva / 100), w: cols[4].w, a: 'right' },
                    { t: fmtN(it.quantity * it.unit_price), w: cols[5].w, a: 'right' },
                ]

                cx = ml
                pdf.setFontSize(8)
                pdf.setTextColor(40, 50, 70)
                data.forEach(d => {
                    const tx = d.a === 'right' ? cx + d.w - 2 : d.a === 'center' ? cx + d.w / 2 : cx + 3
                    const val = d.t.length > 40 ? d.t.substring(0, 37) + '...' : d.t
                    pdf.text(val, tx, y + 5.5, { align: (d.a || 'left') as any })
                    cx += d.w
                })
                y += rh
            })
            y += 8

            // ── TOTALS ────────────────────────────────────────────
            const totW = 85
            const tx2 = pw - mr - totW
            const drawTot = (l: string, v: string, b = false) => {
                pdf.setFont('helvetica', b ? 'bold' : 'normal')
                pdf.setTextColor(b ? 0 : 70, b ? 0 : 80, b ? 0 : 90)
                pdf.text(l, tx2, y + 5)
                pdf.text(v + ' ' + (doc.currency || 'XOF'), pw - mr, y + 5, { align: 'right' })
                y += 7
            }

            drawTot('Sous-total HT', fmtN(doc.sous_total))
            drawTot('TVA (18%)', fmtN(doc.total_tva))
            if (doc.remise > 0) drawTot('Remise', '-' + fmtN(doc.remise))

            pdf.setFillColor(0, 135, 81)
            pdf.roundedRect(tx2 - 4, y, totW + 4, 12, 1.5, 1.5, 'F')
            pdf.setFontSize(10)
            pdf.setTextColor(255, 255, 255)
            pdf.text('TOTAL TTC', tx2, y + 7.5)
            pdf.text(fmtN(doc.total) + ' ' + (doc.currency || 'XOF'), pw - mr, y + 7.5, { align: 'right' })
            y += 20

            // ── SIGNATURES ────────────────────────────────────────
            const sigW = (cw - 8) / 2
            const sigH = 38

            // Client
            pdf.setDrawColor(0, 135, 81)
            pdf.roundedRect(ml, y, sigW, sigH, 2, 2, 'D')
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(7)
            pdf.setTextColor(0, 80, 50)
            pdf.text('ACCORD CLIENT', ml + 4, y + 6)
            pdf.setFontSize(7.5)
            pdf.text(`${doc.client_nom} ${doc.client_prenom}`, ml + 4, y + sigH - 4)

            if (doc.signature_url) {
                try { pdf.addImage(doc.signature_url, 'PNG', ml + 4, y + 8, sigW - 8, 20) } catch {}
            }

            // PDG
            const sig2X = ml + sigW + 8
            pdf.setDrawColor(20, 40, 80)
            pdf.roundedRect(sig2X, y, sigW, sigH, 2, 2, 'D')
            pdf.setTextColor(20, 40, 80)
            pdf.text(presidentTitle.toUpperCase(), sig2X + 4, y + 6)

            try {
                // Increased stamp size from 48 to 65 for better visibility
                const sSz = 65
                pdf.addImage(STAMP_BASE64, 'PNG', sig2X + (sigW - sSz) / 2, y + (sigH - sSz) / 2 - 2, sSz, sSz)
            } catch {}

            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(8)
            pdf.setTextColor(0, 100, 60)
            pdf.text(presidentName, sig2X + 4, y + 33)

            // ── FOOTER ────────────────────────────────────────────
            pdf.setFillColor(12, 20, 32)
            pdf.rect(0, ph - 16, pw, 16, 'F')
            pdf.setFontSize(6)
            pdf.setTextColor(150, 170, 200)
            const footerLines = devisFooter.split('\n')
            if (footerLines.length > 0) pdf.text(footerLines[0], pw / 2, ph - 11, { align: 'center' })
            if (footerLines.length > 1) pdf.text(footerLines[1], pw / 2, ph - 7, { align: 'center' })
            pdf.text(`Doc N° ${doc.numero} — Page 1/1`, pw / 2, ph - 4, { align: 'center' })

            pdf.save(`${doc.type}_${doc.numero}.pdf`)
        } catch (err) {
            console.error('PDF error:', err)
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
            const statusLabel = doc.status === 'paye' ? ' ✅ PAYÉ' : doc.status === 'accepte' ? ' ✅ ACCEPTÉ' : ''

            await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: doc.client_email,
                    subject: `${typeLabel} N° ${doc.numero}${statusLabel} — Retour Gagnant Bénin`,
                    message: `Bonjour ${doc.client_prenom || ''} ${doc.client_nom || ''},\n\nVeuillez trouver ci-joint votre ${typeLabel.toLowerCase()} N° ${doc.numero} d'un montant de ${doc.total.toLocaleString('fr-FR')} XOF.\n\n📋 Détails :\n${doc.items?.map(i => `  • ${i.description} — ${i.quantity} x ${i.unit_price.toLocaleString('fr-FR')} XOF`).join('\n') || ''}\n\n💰 Total : ${doc.total.toLocaleString('fr-FR')} XOF\n${doc.notes ? `\n📝 Notes : ${doc.notes}` : ''}\n${doc.conditions ? `\n⚖️ Conditions : ${doc.conditions}` : ''}\n\nCordialement,\nL'équipe Retour Gagnant Bénin`,
                    clientName: `${doc.client_prenom || ''} ${doc.client_nom || ''}`.trim(),
                    context: 'document_financier',
                    relatedId: doc.id,
                }),
            })

            // Update status to 'envoye' if still brouillon
            if (doc.status === 'brouillon') {
                await supabase
                    .from('documents_financiers')
                    .update({ status: 'envoye' })
                    .eq('id', doc.id)
                fetchDocuments()
            }

            alert(`✅ ${typeLabel} envoyé(e) par email à ${doc.client_email}`)
        } catch (err) {
            console.error('Email error:', err)
            alert('Erreur lors de l\'envoi du mail.')
        } finally {
            setSendingEmail(null)
        }
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
        en_retard: { color: 'bg-orange-500/20 text-orange-400', label: 'En retard' },
        annule: { color: 'bg-zinc-500/20 text-zinc-400', label: 'Annulé' },
    }

    if (loading) {
        return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
    }

    const myCA = documents.filter(d => d.status === 'paye').reduce((s, d) => s + d.total, 0)
    const activeDevis = documents.filter(d => d.type === 'devis' && d.status !== 'refuse').length

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
                    <p className="text-gray-500 text-sm mt-1">Gérez vos propals techniques et factures clients.</p>
                </div>
                <Link href="/agent/devis/create" className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all">
                    <Plus size={16} /> Créer une Facture / Devis
                </Link>
            </div>

            {/* Stats Ultra Puissantes (Dashboard Agent) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
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
            </div>

            {/* Search + Filter */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par Numéro ou Client..." className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
                </div>
                <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-full sm:w-auto">
                    {[{ k: 'all', l: 'Tous' }, { k: 'devis', l: 'Devis' }, { k: 'facture', l: 'Factures' }].map(f => (
                        <button key={f.k} type="button" onClick={() => setFilterType(f.k as typeof filterType)} className={`flex-1 sm:flex-none text-xs font-bold px-4 py-2 rounded-lg transition-all ${filterType === f.k ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:text-white'}`}>{f.l}</button>
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
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Montant</th>
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Statut</th>
                                <th className="py-4 px-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-gray-500">
                                        <Receipt size={32} className="mx-auto mb-3 opacity-50" />
                                        <p className="text-sm font-semibold">Aucun document créé</p>
                                    </td>
                                </tr>
                            ) : filtered.map(doc => (
                                <tr key={doc.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                    <td className="py-3 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${doc.type==='devis'?'bg-blue-500/10 text-blue-400':'bg-emerald-500/10 text-emerald-400'}`}>
                                                {doc.type === 'devis' ? <FileText size={16} /> : <Receipt size={16} />}
                                            </div>
                                            <div>
                                                <p className="text-white font-bold text-sm">{doc.numero}</p>
                                                <p className="text-gray-500 text-[10px]">{new Date(doc.created_at).toLocaleDateString('fr-FR')}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-5">
                                        <p className="text-white text-sm font-medium">{doc.client_nom} {doc.client_prenom}</p>
                                        <p className="text-gray-500 text-[10px]">{doc.client_email || doc.client_phone}</p>
                                    </td>
                                    <td className="py-3 px-5 text-right">
                                        <p className="text-white font-mono text-sm font-bold">{doc.total.toLocaleString('fr-FR')} XOF</p>
                                    </td>
                                    <td className="py-3 px-5 text-center">
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusConfig[doc.status]?.color || ''}`}>{statusConfig[doc.status]?.label}</span>
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
                                            <button onClick={() => generatePDF(doc)} disabled={generating} className="p-2 text-gray-400 hover:text-blue-400 hover:bg-white/5 rounded-lg transition-all" title="Télécharger PDF">
                                                {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                            </button>
                                            <button onClick={() => sendPDFByEmail(doc)} disabled={sendingEmail === doc.id || !doc.client_email} className="p-2 text-gray-400 hover:text-amber-400 hover:bg-white/5 rounded-lg transition-all disabled:opacity-30" title={doc.client_email ? `Envoyer par email à ${doc.client_email}` : 'Email client manquant'}>
                                                {sendingEmail === doc.id ? <Loader2 size={16} className="animate-spin text-amber-400" /> : <Send size={16} />}
                                            </button>
                                            <button onClick={() => handleDelete(doc.id)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all" title="Supprimer"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
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
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Récapitulatif Total</p>
                                        <p className="text-2xl text-emerald-400 font-black font-mono mt-1">{showPreview.total.toLocaleString('fr-Fr')} XOF</p>
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
                                                    <td className="p-3 text-gray-300">{it.description}</td>
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
