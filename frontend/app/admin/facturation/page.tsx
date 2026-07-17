'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    FileText, Plus, Trash2, Loader2, Search,
    Download, Eye, Calculator, Receipt,
    Link as LinkIcon
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { LOGO_BASE64, STAMP_BASE64 } from '@/lib/logoBase64'

import { FinancialAnalytics } from '@/components/dashboard/FinancialAnalytics'

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
    const [filterType, setFilterType] = useState<'all' | 'devis' | 'facture'>('all')
    const [showPreview, setShowPreview] = useState<DocumentFinancier | null>(null)
    const [generating, setGenerating] = useState(false)

    const fetchDocuments = useCallback(async () => {
        const { data } = await supabase
            .from('documents_financiers')
            .select(`*, agent:agent_id(email)`)
            .order('created_at', { ascending: false })
            
        // Map agent email if joined
        const mapped = (data || []).map(d => ({
            ...d,
            agent_email: d.agent?.email || 'N/A'
        }))
        
        setDocuments(mapped as DocumentFinancier[])
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
    const formatDate = (val: string | null | undefined) => {
        if (!val) return '—'
        const d = new Date(val)
        return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR')
    }

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
            const devisFooter = tpl.footer || "RETOUR GAGNANT BÉNIN — RCCM : RB/COT/26 B 42001 — IFU : 3202644573981\nSiège : Haie-Vive Cocotiers, Cotonou. Email : contact@retourgagnantbenin.bj\nTVA 18% applicable — En cas de litige, seules les juridictions béninoises sont compétentes."
            const presidentName = tpl.signature_name || "Nathalie RIFFERT GERMANY"
            const presidentTitle = tpl.signature_title || "LA DIRECTION GÉNÉRALE"

            const jsPDF = (await import('jspdf')).default
            const pdf = new jsPDF('p', 'mm', 'a4')
            const pw = 210
            const ph = 297
            const ml = 14
            const mr = 14
            const cw = pw - ml - mr

            // Helper: safe text (replace problematic characters for jsPDF standard fonts)
            const safe = (s: string) => s
                .replace(/\u2014/g, '-')
                .replace(/\u2013/g, '-')
                .replace(/\u2019/g, "'")
                .replace(/\u2018/g, "'")
                .replace(/\u201c/g, '"')
                .replace(/\u201d/g, '"')
                .replace(/\u2713/g, '[OK]')
                .replace(/\u2714/g, '[OK]')
                .replace(/\u2022/g, '-')

            // ── BENIN FLAG STRIPE ──────────────────────────────────
            pdf.setFillColor(0, 135, 81)
            pdf.rect(0, 0, pw / 3, 4, 'F')
            pdf.setFillColor(252, 209, 22)
            pdf.rect(pw / 3, 0, pw / 3, 4, 'F')
            pdf.setFillColor(232, 17, 45)
            pdf.rect((pw * 2) / 3, 0, pw / 3, 4, 'F')

            // ── WHITE HEADER (identique navbar) ──────────────────
            const headerTop = 4
            const headerH = 48
            pdf.setFillColor(255, 255, 255)
            pdf.rect(0, headerTop, pw, headerH, 'F')

            // Ligne de separation en bas du header
            pdf.setDrawColor(215, 215, 215)
            pdf.setLineWidth(0.4)
            pdf.line(0, headerTop + headerH, pw, headerTop + headerH)

            // ── LOGO & BRANDING (Alignés horizontalement) ─────────
            const logoSize = 26
            const logoX = ml
            const logoY = headerTop + 10

            try {
                pdf.addImage(LOGO_BASE64, 'PNG', logoX, logoY, logoSize, logoSize)
            } catch (e) {
                console.error('Logo error:', e)
            }

            // TEXTES : A côté du logo, centrés verticalement avec le logo
            const textStartX = logoX + logoSize + 5
            const nameY = logoY + 8

            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(16)
            pdf.setTextColor(0, 135, 81)
            const text1 = 'RETOUR '
            const text2 = 'GAGNANT'
            pdf.text(text1, textStartX, nameY)
            pdf.setTextColor(232, 17, 45)
            pdf.text(text2, textStartX + pdf.getTextWidth(text1), nameY)

            // BÉNIN
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(8)
            pdf.setTextColor(90, 90, 90)
            pdf.setCharSpace(2)
            pdf.text('BENIN', textStartX, nameY + 6)
            pdf.setCharSpace(0)

            // Slogan
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(6.5)
            pdf.setTextColor(130, 130, 130)
            const sloganText = safe("L'agence d'accompagnement a la Nationalite Beninoise et au retour des Afro-descendants.")
            const sloganLines = pdf.splitTextToSize(sloganText, 80)
            sloganLines.forEach((line: string, i: number) => {
                pdf.text(line, textStartX, nameY + 11.5 + i * 3.5)
            })

            // ── TYPE DOCUMENT (droite, en haut du header) ────────
            const typeLabel = doc.type === 'devis' ? 'DEVIS' : 'FACTURE'
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(24)
            if (doc.type === 'devis') {
                pdf.setTextColor(180, 120, 0)
            } else {
                pdf.setTextColor(0, 135, 81)
            }
            pdf.text(typeLabel, pw - mr, headerTop + 14, { align: 'right' })

            // Numero + Date + Validite
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(8)
            pdf.setTextColor(80, 80, 80)
            pdf.text('N. ' + doc.numero, pw - mr, headerTop + 22, { align: 'right' })
            pdf.text('Date : ' + formatDate(doc.created_at), pw - mr, headerTop + 27, { align: 'right' })
            if (doc.validite) {
                const validLabel = doc.type === 'facture' ? 'Delai : ' : 'Validite : '
                pdf.text(safe(validLabel + doc.validite), pw - mr, headerTop + 32, { align: 'right' })
            }

            // ── STATUS BADGE (Dans le header, à droite en bas) ──────────────────
            const statusLabels: Record<string, string> = {
                brouillon: 'BROUILLON', envoye: 'ENVOYE', accepte: 'ACCEPTE',
                refuse: 'REFUSE', paye: 'PAYE', en_retard: 'EN RETARD', annule: 'ANNULE'
            }
            const statusColorMap: Record<string, [number, number, number]> = {
                brouillon: [120, 120, 120], envoye: [59, 130, 246], accepte: [0, 160, 90],
                refuse: [220, 50, 50], paye: [16, 185, 110], en_retard: [220, 120, 20], annule: [90, 90, 90],
            }
            const sc = statusColorMap[doc.status] || [90, 90, 90]
            const statusText = statusLabels[doc.status] || doc.status.toUpperCase()
            
            const badgeY = headerTop + 37
            const badgeW = 32
            const badgeH = 8
            pdf.setFillColor(sc[0], sc[1], sc[2])
            pdf.roundedRect(pw - mr - badgeW, badgeY, badgeW, badgeH, 1.5, 1.5, 'F')
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(7.5)
            pdf.setTextColor(255, 255, 255)
            pdf.text(statusText, pw - mr - badgeW / 2, badgeY + 5.5, { align: 'center' })

            let y = headerTop + headerH + 8

            // Emetteur (dark box)
            const boxW = (cw - 6) / 2
            const boxH = 46

            pdf.setFillColor(18, 28, 42)
            pdf.setDrawColor(40, 60, 90)
            pdf.setLineWidth(0.3)
            pdf.roundedRect(ml, y, boxW, boxH, 2, 2, 'FD')

            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(6)
            pdf.setTextColor(80, 120, 180)
            pdf.text('EMETTEUR', ml + 4, y + 6)
            pdf.setFontSize(8)
            pdf.setTextColor(220, 230, 245)
            const headerLines = pdf.splitTextToSize(devisHeader, boxW - 8)
            headerLines.forEach((l: string, i: number) => {
                const isFirst = i === 0
                if (isFirst) {
                    pdf.setFont('helvetica', 'bold')
                    pdf.setFontSize(9)
                } else {
                    pdf.setFont('helvetica', 'normal')
                    pdf.setFontSize(6.5)
                    if (i === 1) pdf.setTextColor(140, 160, 185)
                }
                const offset = isFirst ? 13 : (19 + (i - 1) * 6)
                pdf.text(safe(l), ml + 4, y + offset)
            })

            // Destinataire (light box)
            const toX = ml + boxW + 6
            pdf.setFillColor(248, 250, 255)
            pdf.setDrawColor(200, 215, 240)
            pdf.roundedRect(toX, y, boxW, boxH, 2, 2, 'FD')

            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(6)
            pdf.setTextColor(100, 110, 160)
            pdf.text('DESTINATAIRE', toX + 4, y + 6)
            pdf.setFontSize(9)
            pdf.setTextColor(30, 40, 70)
            const clientFullName = `${doc.client_nom} ${doc.client_prenom}`.trim() || 'Client'
            pdf.text(clientFullName, toX + 4, y + 13)
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(7)
            pdf.setTextColor(70, 80, 110)
            let clientY = y + 19
            if (doc.client_email) { pdf.text(doc.client_email, toX + 4, clientY); clientY += 5.5 }
            if (doc.client_phone) { pdf.text(doc.client_phone, toX + 4, clientY); clientY += 5.5 }
            if (doc.client_adresse) {
                const addrLines = pdf.splitTextToSize(doc.client_adresse, boxW - 8)
                addrLines.slice(0, 3).forEach((line: string) => {
                    pdf.text(line, toX + 4, clientY)
                    clientY += 5
                })
            }

            y += boxH + 8

            // ── ITEMS TABLE ────────────────────────────────────────
            const cols = [
                { header: 'DESCRIPTION', w: 70, align: 'left' as const },
                { header: 'QTE', w: 14, align: 'center' as const },
                { header: 'PU HT', w: 26, align: 'right' as const },
                { header: 'TVA %', w: 15, align: 'center' as const },
                { header: 'TVA', w: 22, align: 'right' as const },
                { header: 'TOTAL HT', w: 35, align: 'right' as const },
            ]

            pdf.setFillColor(10, 16, 24)
            pdf.rect(ml, y, cw, 10, 'F')

            let colX = ml
            cols.forEach(col => {
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(6.5)
                pdf.setTextColor(200, 215, 230)
                if (col.align === 'right') {
                    pdf.text(col.header, colX + col.w - 2, y + 6.5, { align: 'right' })
                } else if (col.align === 'center') {
                    pdf.text(col.header, colX + col.w / 2, y + 6.5, { align: 'center' })
                } else {
                    pdf.text(col.header, colX + 3, y + 6.5)
                }
                colX += col.w
            })
            y += 10

            doc.items.forEach((item: DevisItem, i: number) => {
                const rowH = 9.5
                const even = i % 2 === 0
                pdf.setFillColor(even ? 252 : 247, even ? 253 : 249, even ? 254 : 252)
                pdf.rect(ml, y, cw, rowH, 'F')
                pdf.setDrawColor(220, 228, 238)
                pdf.setLineWidth(0.2)
                pdf.line(ml, y + rowH, ml + cw, y + rowH)

                const tvaMnt = item.quantity * item.unit_price * item.tva / 100
                const lineTotal = item.quantity * item.unit_price
                const rowData = [
                    { text: safe(item.description || '-'), w: cols[0].w, align: 'left' },
                    { text: String(item.quantity), w: cols[1].w, align: 'center' },
                    { text: fmtN(item.unit_price), w: cols[2].w, align: 'right' },
                    { text: item.tva + '%', w: cols[3].w, align: 'center' },
                    { text: fmtN(tvaMnt), w: cols[4].w, align: 'right' },
                    { text: fmtN(lineTotal), w: cols[5].w, align: 'right' },
                ]
                colX = ml
                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(8)
                pdf.setTextColor(40, 55, 75)
                rowData.forEach(cell => {
                    if (cell.align === 'right') {
                        pdf.text(cell.text, colX + cell.w - 2, y + 6.5, { align: 'right' })
                    } else if (cell.align === 'center') {
                        pdf.text(cell.text, colX + cell.w / 2, y + 6.5, { align: 'center' })
                    } else {
                        const lines = pdf.splitTextToSize(cell.text, cell.w - 5)
                        pdf.text(lines[0], colX + 3, y + 6.5)
                    }
                    colX += cell.w
                })
                y += rowH
            })

            pdf.setDrawColor(150, 170, 200)
            pdf.setLineWidth(0.6)
            pdf.line(ml, y, ml + cw, y)
            y += 8

            // ── TOTALS ─────────────────────────────────────────────
            const totW = 85
            const totX2 = pw - mr - totW

            const drawRow = (label: string, value: string, bold = false, red = false) => {
                pdf.setFont('helvetica', bold ? 'bold' : 'normal')
                pdf.setFontSize(bold ? 9 : 8)
                pdf.setTextColor(red ? 200 : 70, red ? 50 : 85, red ? 50 : 105)
                pdf.text(label, totX2, y + 5)
                pdf.setTextColor(red ? 200 : 25, red ? 50 : 35, red ? 50 : 60)
                pdf.text(value, pw - mr, y + 5, { align: 'right' })
                y += 8
            }

            const cur = doc.currency || 'XOF'
            drawRow('Sous-total HT', `${fmtN(doc.sous_total)} ${cur}`)
            drawRow('TVA (18%)', `+ ${fmtN(doc.total_tva)} ${cur}`)
            if (doc.remise > 0) drawRow('Remise', `- ${fmtN(doc.remise)} ${cur}`, false, true)

            pdf.setDrawColor(150, 175, 210)
            pdf.setLineWidth(0.5)
            pdf.line(totX2 - 2, y - 2, pw - mr, y - 2)

            pdf.setFillColor(0, 135, 81)
            pdf.roundedRect(totX2 - 4, y - 1, totW + 4, 12, 2, 2, 'F')
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(10)
            pdf.setTextColor(255, 255, 255)
            pdf.text('TOTAL TTC', totX2, y + 7.5)
            pdf.text(`${fmtN(doc.total)} ${cur}`, pw - mr, y + 7.5, { align: 'right' })
            y += 18

            // ── SIGNATURE ZONE ─────────────────────────────
            if (y + 36 < ph - 20) {
                const sigW = (cw - 8) / 2
                const sigBoxH = 36
                pdf.setFillColor(242, 255, 248)
                pdf.setDrawColor(0, 135, 81)
                pdf.setLineWidth(0.4)
                pdf.roundedRect(ml, y, sigW, sigBoxH, 2, 2, 'FD')
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(7)
                pdf.setTextColor(0, 100, 60)
                pdf.text('BON POUR ACCORD', ml + 4, y + 8)
                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(6.5)
                pdf.setTextColor(90, 100, 95)
                pdf.text('Signature et Cachet du client :', ml + 4, y + 15)
                if (doc.signature_url) {
                    try { pdf.addImage(doc.signature_url, 'PNG', ml + 4, y + 17, sigW - 20, 13) } catch {}
                    const signedDate = doc.signed_at
                        ? formatDate(doc.signed_at)
                        : formatDate(doc.created_at)
                    pdf.setFont('helvetica', 'bold')
                    pdf.setFontSize(6)
                    pdf.setTextColor(0, 135, 81)
                    pdf.text('[OK] Accepte et signe le ' + signedDate, ml + 4, y + 33)
                } else {
                    pdf.text('____________________________', ml + 4, y + 24)
                    pdf.text('Date :  ____/____/________', ml + 4, y + 31)
                }

                const sig2X = ml + sigW + 8
                pdf.setFillColor(242, 245, 255)
                pdf.setDrawColor(100, 110, 200)
                pdf.roundedRect(sig2X, y, sigW, sigBoxH, 2, 2, 'FD')
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(7)
                pdf.setTextColor(70, 80, 170)
                pdf.text(presidentTitle.toUpperCase(), sig2X + 4, y + 12)
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(7.5)
                pdf.text(safe(presidentName), sig2X + 4, y + 18)

                // Add Stamp (cachet) enlarged
                if (STAMP_BASE64) {
                    try {
                        const stampData = STAMP_BASE64.startsWith('data:') ? STAMP_BASE64 : `data:image/png;base64,${STAMP_BASE64}`
                        pdf.addImage(stampData, 'PNG', sig2X + sigW - 65, y - 5, 65, 65)
                    } catch (e) {
                        console.error('Error adding stamp:', e)
                    }
                }

                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(6.5)
                pdf.setTextColor(90, 95, 130)
                pdf.text('Signature et Cachet officiel', sig2X + 4, y + 23)
                pdf.text('Etabli le ' + formatDate(doc.created_at), sig2X + 4, y + 28)
            }

            // ── WATERMARK ──────────────────────────────────────────
            if (doc.status === 'brouillon') {
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(75)
                pdf.setTextColor(210, 215, 222)
                pdf.text('BROUILLON', pw / 2, ph / 2, { align: 'center', angle: 40 })
            }
            if (doc.status === 'paye') {
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(80)
                pdf.setTextColor(195, 240, 215)
                pdf.text('PAYE', pw / 2, ph / 2, { align: 'center', angle: 40 })
            }

            // ── LEGAL FOOTER ───────────────────────────────────────
            pdf.setFillColor(10, 16, 24)
            pdf.rect(0, ph - 14, pw, 14, 'F')
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(5.5)
            pdf.setTextColor(120, 140, 160)
            const footerLines = devisFooter.split('\n')
            if (footerLines.length > 0) pdf.text(safe(footerLines[0]), pw / 2, ph - 9, { align: 'center' })
            if (footerLines.length > 1) pdf.text(safe(footerLines[1]), pw / 2, ph - 6.5, { align: 'center' })
            pdf.text('Document N. ' + doc.numero + ' - Genere le ' + formatDate(new Date().toISOString()), pw / 2, ph - 3, { align: 'center' })

            pdf.save(`${doc.type}_${doc.numero}.pdf`)
        } catch (err) {
            console.error('PDF generation error:', err)
        }
        setGenerating(false)
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
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par Numéro ou Client..." className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
                </div>
                <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-full sm:w-auto">
                    {[{ k: 'all', l: 'Tous' }, { k: 'devis', l: 'Devis' }, { k: 'facture', l: 'Factures' }].map(f => (
                        <button key={f.k} type="button" onClick={() => setFilterType(f.k as typeof filterType)} className={`flex-1 sm:flex-none text-xs font-bold px-4 py-2 rounded-lg transition-all ${filterType === f.k ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:text-white'}`}>{f.l}</button>
                    ))}
                </div>
            </div>

            {/* Document List (Tables are cleaner for ERP) */}
            <div className="bg-[#0c1420] border border-white/5 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/[0.02] border-b border-white/5">
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
                                <tr key={doc.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                    <td className="py-3 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${doc.type==='devis'?'bg-blue-500/10 text-blue-400':'bg-emerald-500/10 text-emerald-400'}`}>
                                                {doc.type === 'devis' ? <FileText size={16} /> : <Receipt size={16} />}
                                            </div>
                                            <div>
                                                <p className="text-white font-bold text-sm">{doc.numero}</p>
                                                <p className="text-gray-500 text-[10px]">{formatDate(doc.created_at)}</p>
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
                                                className="p-2 text-gray-400 hover:text-amber-400 hover:bg-white/5 rounded-lg transition-all" 
                                                title="Copier le Lien Client"
                                            >
                                                <LinkIcon size={16} />
                                            </button>
                                            <button onClick={() => setShowPreview(doc)} className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-white/5 rounded-lg transition-all" title="Aperçu / Modifier"><Eye size={16} /></button>
                                            <button onClick={() => generatePDF(doc)} disabled={generating} className="p-2 text-gray-400 hover:text-blue-400 hover:bg-white/5 rounded-lg transition-all" title="PDF">
                                                {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
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
