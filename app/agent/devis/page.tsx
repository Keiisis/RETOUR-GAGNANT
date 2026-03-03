'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    FileText, Plus, Trash2, X, Loader2, Search,
    Send, Download, Eye, Calculator, Receipt,
    Phone, Mail, CheckCircle2, Building2, User, Hash,
    Calendar, CreditCard, ArrowRight
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
• Les tarifs sont exprimés en FCFA (XOF)
• TVA applicable selon la législation béninoise en vigueur`

export default function AgentDevisPage() {
    const [documents, setDocuments] = useState<Devis[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'devis' | 'facture'>('all')
    const [showForm, setShowForm] = useState(false)
    const [showPreview, setShowPreview] = useState<Devis | null>(null)
    const [saving, setSaving] = useState(false)
    const [generating, setGenerating] = useState(false)

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
        await supabase.from('agent_devis').insert({
            agent_id: user.id, type: formType, numero: generateNumero(formType),
            client_nom: clientNom, client_prenom: clientPrenom, client_email: clientEmail,
            client_phone: clientPhone, client_adresse: clientAdresse,
            items, sous_total: sousTotal, total_tva: totalTVA, remise, total: totalFinal,
            status: 'brouillon', notes, conditions, validite,
        })
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
            const pw = 210
            const ph = 297
            const ml = 14
            const mr = 14
            const cw = pw - ml - mr // 182mm

            // ── BENIN FLAG STRIPE ──────────────────────────────────
            pdf.setFillColor(0, 135, 81)
            pdf.rect(0, 0, pw / 3, 4, 'F')
            pdf.setFillColor(252, 209, 22)
            pdf.rect(pw / 3, 0, pw / 3, 4, 'F')
            pdf.setFillColor(232, 17, 45)
            pdf.rect((pw * 2) / 3, 0, pw / 3, 4, 'F')

            // ── DARK HEADER ────────────────────────────────────────
            pdf.setFillColor(10, 16, 24)
            pdf.rect(0, 4, pw, 50, 'F')

            // Company name (left)
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(22)
            pdf.setTextColor(0, 185, 100)
            pdf.text('RETOUR GAGNANT', ml, 20)

            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(7.5)
            pdf.setTextColor(140, 160, 180)
            pdf.text('BÉNIN', ml, 25)

            pdf.setFontSize(7)
            pdf.setTextColor(100, 120, 140)
            pdf.text('Agence de Services Internationaux', ml, 31)
            pdf.text('Cotonou, République du Bénin', ml, 36)
            pdf.text('contact@retour-gagnant.bj  |  www.retour-gagnant.bj', ml, 41)
            pdf.text('+229 01 XX XX XX XX', ml, 46)

            // Document type badge (right)
            const typeLabel = doc.type === 'devis' ? 'DEVIS' : 'FACTURE'
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(30)
            if (doc.type === 'devis') {
                pdf.setTextColor(252, 209, 22)
            } else {
                pdf.setTextColor(0, 185, 100)
            }
            pdf.text(typeLabel, pw - mr, 24, { align: 'right' })

            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(9)
            pdf.setTextColor(160, 175, 190)
            pdf.text(`N\u00b0 ${doc.numero}`, pw - mr, 32, { align: 'right' })
            pdf.text(`Date : ${new Date(doc.created_at).toLocaleDateString('fr-FR')}`, pw - mr, 38, { align: 'right' })
            pdf.text(doc.type === 'facture' ? `D\u00e9lai : ${doc.validite}` : `Validit\u00e9 : ${doc.validite}`, pw - mr, 44, { align: 'right' })

            // Status badge
            const statusColorMap: Record<string, [number, number, number]> = {
                brouillon: [90, 90, 90],
                envoye: [59, 130, 246],
                accepte: [0, 175, 100],
                refuse: [230, 60, 60],
                paye: [16, 200, 120],
            }
            const sc = statusColorMap[doc.status] || [90, 90, 90]
            pdf.setFillColor(sc[0], sc[1], sc[2])
            pdf.roundedRect(pw - mr - 26, 47, 26, 6, 1.5, 1.5, 'F')
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(6)
            pdf.setTextColor(255, 255, 255)
            const statusLabels: Record<string, string> = { brouillon: 'BROUILLON', envoye: 'ENVOY\u00c9', accepte: 'ACCEPT\u00c9', refuse: 'REFUS\u00c9', paye: 'PAY\u00c9' }
            pdf.text(statusLabels[doc.status] || doc.status.toUpperCase(), pw - mr - 13, 51.3, { align: 'center' })

            let y = 64

            // ── FROM / TO BOXES ────────────────────────────────────
            const boxW = (cw - 6) / 2
            const boxH = 42

            // FROM box (dark blue)
            pdf.setFillColor(18, 28, 42)
            pdf.setDrawColor(40, 60, 90)
            pdf.setLineWidth(0.4)
            pdf.roundedRect(ml, y, boxW, boxH, 2, 2, 'FD')

            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(6.5)
            pdf.setTextColor(80, 120, 180)
            pdf.text('\u00c9METTEUR', ml + 4, y + 7)

            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(9.5)
            pdf.setTextColor(220, 230, 245)
            pdf.text('RETOUR GAGNANT B\u00c9NIN', ml + 4, y + 15)

            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(7.5)
            pdf.setTextColor(140, 160, 185)
            pdf.text('RCCM : BJ-COT-2024-XXXX', ml + 4, y + 22)
            pdf.text('NIF : XXXXXXXX-P', ml + 4, y + 27.5)
            pdf.text('Cotonou, B\u00e9nin', ml + 4, y + 33)
            pdf.text('contact@retour-gagnant.bj', ml + 4, y + 38.5)

            // TO box (light)
            const toX = ml + boxW + 6
            pdf.setFillColor(248, 250, 255)
            pdf.setDrawColor(200, 215, 240)
            pdf.roundedRect(toX, y, boxW, boxH, 2, 2, 'FD')

            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(6.5)
            pdf.setTextColor(100, 110, 160)
            pdf.text('DESTINATAIRE', toX + 4, y + 7)

            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(9.5)
            pdf.setTextColor(30, 40, 70)
            const clientFullName = `${doc.client_nom} ${doc.client_prenom}`.trim() || 'Client'
            pdf.text(clientFullName, toX + 4, y + 15)

            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(7.5)
            pdf.setTextColor(70, 80, 110)
            if (doc.client_email) pdf.text(doc.client_email, toX + 4, y + 22)
            if (doc.client_phone) pdf.text(doc.client_phone, toX + 4, y + 27.5)
            if (doc.client_adresse) {
                const addrLines = pdf.splitTextToSize(doc.client_adresse, boxW - 8)
                addrLines.slice(0, 2).forEach((line: string, li: number) => {
                    pdf.text(line, toX + 4, y + 33 + li * 5.5)
                })
            }

            y += boxH + 10

            // ── ITEMS TABLE ────────────────────────────────────────
            const cols = [
                { header: 'DESCRIPTION DU SERVICE', w: 68, align: 'left' as const },
                { header: 'QT\u00c9', w: 14, align: 'center' as const },
                { header: 'PU HT (XOF)', w: 28, align: 'right' as const },
                { header: 'TVA %', w: 15, align: 'center' as const },
                { header: 'TVA (XOF)', w: 22, align: 'right' as const },
                { header: 'TOTAL HT (XOF)', w: 35, align: 'right' as const },
            ]

            // Header row
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

            // Item rows
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
                    { text: item.description || '\u2014', w: cols[0].w, align: 'left' },
                    { text: String(item.quantity), w: cols[1].w, align: 'center' },
                    { text: item.unit_price.toLocaleString('fr-FR'), w: cols[2].w, align: 'right' },
                    { text: item.tva + '%', w: cols[3].w, align: 'center' },
                    { text: tvaMnt.toLocaleString('fr-FR'), w: cols[4].w, align: 'right' },
                    { text: lineTotal.toLocaleString('fr-FR'), w: cols[5].w, align: 'right' },
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

            drawRow('Sous-total HT', `${doc.sous_total.toLocaleString('fr-FR')} XOF`)
            drawRow('TVA (18%)', `+ ${doc.total_tva.toLocaleString('fr-FR')} XOF`)
            if (doc.remise > 0) drawRow('Remise', `- ${doc.remise.toLocaleString('fr-FR')} XOF`, false, true)

            pdf.setDrawColor(150, 175, 210)
            pdf.setLineWidth(0.5)
            pdf.line(totX2 - 2, y - 2, pw - mr, y - 2)

            pdf.setFillColor(0, 135, 81)
            pdf.roundedRect(totX2 - 4, y - 1, totW + 4, 12, 2, 2, 'F')
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(10)
            pdf.setTextColor(255, 255, 255)
            pdf.text('TOTAL TTC', totX2, y + 7.5)
            pdf.text(`${doc.total.toLocaleString('fr-FR')} XOF`, pw - mr, y + 7.5, { align: 'right' })
            y += 18

            // ── PAYMENT SECTION (facture) ──────────────────────────
            if (doc.type === 'facture') {
                pdf.setFillColor(240, 248, 255)
                pdf.setDrawColor(180, 210, 245)
                pdf.setLineWidth(0.4)
                pdf.roundedRect(ml, y, 92, 30, 2, 2, 'FD')
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(7)
                pdf.setTextColor(60, 100, 160)
                pdf.text('MODALIT\u00c9S DE PAIEMENT', ml + 4, y + 8)
                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(7.5)
                pdf.setTextColor(60, 80, 115)
                pdf.text('Virement bancaire / Mobile Money', ml + 4, y + 15)
                pdf.text(`D\u00e9lai de paiement : ${doc.validite || '30 jours'}`, ml + 4, y + 21)
                pdf.text(`R\u00e9f\u00e9rence \u00e0 indiquer : ${doc.numero}`, ml + 4, y + 27)
                y += 38
            }

            // ── CONDITIONS ─────────────────────────────────────────
            if (doc.conditions) {
                const condLines = pdf.splitTextToSize(doc.conditions, cw - 8)
                const condH = condLines.length * 4.5 + 12
                if (y + condH < ph - 30) {
                    pdf.setFillColor(250, 250, 252)
                    pdf.setDrawColor(210, 215, 225)
                    pdf.setLineWidth(0.3)
                    pdf.roundedRect(ml, y, cw, condH, 2, 2, 'FD')
                    pdf.setFont('helvetica', 'bold')
                    pdf.setFontSize(6.5)
                    pdf.setTextColor(90, 95, 115)
                    pdf.text('CONDITIONS G\u00c9N\u00c9RALES', ml + 4, y + 7)
                    pdf.setFont('helvetica', 'normal')
                    pdf.setFontSize(7)
                    pdf.setTextColor(100, 105, 125)
                    pdf.text(condLines, ml + 4, y + 12)
                    y += condH + 6
                }
            }

            // ── NOTES ──────────────────────────────────────────────
            if (doc.notes) {
                const noteLines = pdf.splitTextToSize(doc.notes, cw - 8)
                const noteH = noteLines.length * 4.5 + 12
                if (y + noteH < ph - 30) {
                    pdf.setFillColor(255, 252, 235)
                    pdf.setDrawColor(230, 200, 100)
                    pdf.setLineWidth(0.3)
                    pdf.roundedRect(ml, y, cw, noteH, 2, 2, 'FD')
                    pdf.setFont('helvetica', 'bold')
                    pdf.setFontSize(6.5)
                    pdf.setTextColor(140, 110, 20)
                    pdf.text('NOTES', ml + 4, y + 7)
                    pdf.setFont('helvetica', 'normal')
                    pdf.setFontSize(7)
                    pdf.setTextColor(120, 95, 30)
                    pdf.text(noteLines, ml + 4, y + 12)
                    y += noteH + 6
                }
            }

            // ── SIGNATURE ZONE (devis) ─────────────────────────────
            if (doc.type === 'devis' && y + 28 < ph - 20) {
                const sigW = (cw - 8) / 2
                pdf.setFillColor(242, 255, 248)
                pdf.setDrawColor(0, 135, 81)
                pdf.setLineWidth(0.4)
                pdf.roundedRect(ml, y, sigW, 26, 2, 2, 'FD')
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(7)
                pdf.setTextColor(0, 100, 60)
                pdf.text('BON POUR ACCORD', ml + 4, y + 8)
                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(6.5)
                pdf.setTextColor(90, 100, 95)
                pdf.text('Signature & Cachet du client :', ml + 4, y + 15)
                pdf.text('Date :  ____/____/________', ml + 4, y + 22)

                const sig2X = ml + sigW + 8
                pdf.setFillColor(242, 245, 255)
                pdf.setDrawColor(100, 110, 200)
                pdf.roundedRect(sig2X, y, sigW, 26, 2, 2, 'FD')
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(7)
                pdf.setTextColor(70, 80, 170)
                pdf.text('RETOUR GAGNANT B\u00c9NIN', sig2X + 4, y + 8)
                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(6.5)
                pdf.setTextColor(90, 95, 130)
                pdf.text('Signature & Cachet officiel', sig2X + 4, y + 15)
                pdf.text(`\u00c9tabli le ${new Date(doc.created_at).toLocaleDateString('fr-FR')}`, sig2X + 4, y + 22)
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
                pdf.text('PAY\u00c9', pw / 2, ph / 2, { align: 'center', angle: 40 })
            }

            // ── LEGAL FOOTER ───────────────────────────────────────
            pdf.setFillColor(10, 16, 24)
            pdf.rect(0, ph - 15, pw, 15, 'F')
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(6.5)
            pdf.setTextColor(100, 120, 145)
            pdf.text('RETOUR GAGNANT B\u00c9NIN \u2014 RCCM: BJ-COT-2024-XXXX \u2014 NIF: XXXXXXXX-P \u2014 Cotonou, B\u00e9nin', pw / 2, ph - 9, { align: 'center' })
            pdf.text(`Document N\u00b0 ${doc.numero} \u2014 G\u00e9n\u00e9r\u00e9 le ${new Date().toLocaleDateString('fr-FR')}`, pw / 2, ph - 5, { align: 'center' })

            pdf.save(`${doc.type}_${doc.numero}.pdf`)
        } catch (err) {
            console.error('PDF generation error:', err)
        }
        setGenerating(false)
    }

    const sendByEmail = (doc: Devis) => {
        const subject = `${doc.type === 'devis' ? 'Devis' : 'Facture'} N\u00b0${doc.numero} \u2014 RETOUR GAGNANT`
        const body = `Bonjour ${doc.client_prenom || doc.client_nom},\n\nVeuillez trouver ci-joint votre ${doc.type} N\u00b0${doc.numero}.\n\nMontant total TTC : ${doc.total.toLocaleString('fr-FR')} FCFA\n\nCordialement,\nRETOUR GAGNANT B\u00c9NIN`
        window.open(`mailto:${doc.client_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
        handleUpdateStatus(doc.id, 'envoye')
    }

    const sendByWhatsApp = (doc: Devis) => {
        const msg = `Bonjour ${doc.client_prenom || doc.client_nom},\n\nVoici votre ${doc.type} N\u00b0${doc.numero}.\n\n${doc.items.map((it: DevisItem) => `\u2022 ${it.description}: ${(it.quantity * it.unit_price).toLocaleString('fr-FR')} XOF`).join('\n')}\n\n*Total TTC: ${doc.total.toLocaleString('fr-FR')} XOF*\n\nCordialement,\nRETOUR GAGNANT B\u00c9NIN`
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
        envoye: { color: 'bg-blue-500/20 text-blue-400', label: 'Envoy\u00e9' },
        accepte: { color: 'bg-emerald-500/20 text-emerald-400', label: 'Accept\u00e9' },
        refuse: { color: 'bg-red-500/20 text-red-400', label: 'Refus\u00e9' },
        paye: { color: 'bg-green-500/20 text-green-400', label: 'Pay\u00e9' },
    }

    if (loading) {
        return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
    }

    const totalCA = documents.filter(d => d.status === 'paye').reduce((s, d) => s + d.total, 0)

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
                    <p className="text-gray-500 text-sm mt-1">{documents.length} document(s) — Normes internationales ISO</p>
                </div>
                <button type="button" onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all">
                    <Plus size={16} /> Nouveau Document
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Devis', value: documents.filter(d => d.type === 'devis').length, icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { label: 'Factures', value: documents.filter(d => d.type === 'facture').length, icon: Receipt, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'Envoyés', value: documents.filter(d => ['envoye', 'accepte', 'paye'].includes(d.status)).length, icon: Send, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                    { label: 'CA Encaissé', value: totalCA > 0 ? `${totalCA.toLocaleString('fr-FR')} XOF` : '0 XOF', icon: CreditCard, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                        <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>
                            <stat.icon size={15} className={stat.color} />
                        </div>
                        <p className="text-xl font-black text-white">{stat.value}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Search + Filter */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par numéro ou client..." title="Rechercher" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
                </div>
                <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                    {[{ k: 'all', l: 'Tous' }, { k: 'devis', l: 'Devis' }, { k: 'facture', l: 'Factures' }].map(f => (
                        <button key={f.k} type="button" onClick={() => setFilterType(f.k as typeof filterType)} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${filterType === f.k ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:text-white'}`}>{f.l}</button>
                    ))}
                </div>
            </div>

            {/* Document List */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center text-gray-500">
                        <Receipt size={40} className="mx-auto mb-3 text-gray-700" />
                        <p className="text-sm font-semibold">Aucun document trouvé</p>
                    </div>
                ) : filtered.map((doc, i) => (
                    <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 hover:border-emerald-500/20 transition-all">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${doc.type === 'devis' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                    {doc.type === 'devis' ? <FileText size={18} /> : <Receipt size={18} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold text-white font-mono">{doc.numero}</p>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusConfig[doc.status]?.color || ''}`}>{statusConfig[doc.status]?.label || doc.status}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">{doc.client_nom} {doc.client_prenom} • {new Date(doc.created_at).toLocaleDateString('fr-FR')}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <p className="text-sm font-bold text-white font-mono">{doc.total?.toLocaleString('fr-FR')} <span className="text-[10px] text-gray-500 font-normal">XOF</span></p>
                                <div className="flex gap-1">
                                    <button type="button" onClick={() => setShowPreview(doc)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-emerald-400 transition-colors" title="Aperçu"><Eye size={14} /></button>
                                    <button type="button" onClick={() => generatePDF(doc)} disabled={generating} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-blue-400 transition-colors" title="Télécharger PDF">
                                        {generating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                    </button>
                                    <button type="button" onClick={() => handleDelete(doc.id)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-red-400 transition-colors" title="Supprimer"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
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
                                <div>
                                    <p className="text-emerald-400 text-xl font-black tracking-wider">RETOUR GAGNANT</p>
                                    <p className="text-gray-600 text-xs mt-0.5">Agence de Services Internationaux — Cotonou, Bénin</p>
                                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600">
                                        <span>RCCM: BJ-COT-2024-XXXX</span>
                                        <span>NIF: XXXXXXXX-P</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-3xl font-black ${showPreview.type === 'devis' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {showPreview.type === 'devis' ? 'DEVIS' : 'FACTURE'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1 font-mono">N° {showPreview.numero}</p>
                                    <p className="text-xs text-gray-600">{new Date(showPreview.created_at).toLocaleDateString('fr-FR')}</p>
                                    <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${statusConfig[showPreview.status]?.color || ''}`}>
                                        {statusConfig[showPreview.status]?.label}
                                    </span>
                                </div>
                            </div>

                            <div className="overflow-y-auto flex-1 p-5 space-y-5">
                                {/* FROM / TO */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-[#0c1a28] border border-white/5 rounded-xl p-4">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Building2 size={11} className="text-blue-400" />
                                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Émetteur</p>
                                        </div>
                                        <p className="text-sm font-bold text-white">RETOUR GAGNANT BÉNIN</p>
                                        <p className="text-xs text-gray-500 mt-1">Cotonou, République du Bénin</p>
                                        <p className="text-xs text-gray-600">contact@retour-gagnant.bj</p>
                                    </div>
                                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <User size={11} className="text-emerald-400" />
                                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Destinataire</p>
                                        </div>
                                        <p className="text-sm font-bold text-white">{showPreview.client_nom} {showPreview.client_prenom}</p>
                                        {showPreview.client_email && <p className="text-xs text-gray-500 mt-1">{showPreview.client_email}</p>}
                                        {showPreview.client_phone && <p className="text-xs text-gray-600">{showPreview.client_phone}</p>}
                                        {showPreview.client_adresse && <p className="text-xs text-gray-600 mt-0.5">{showPreview.client_adresse}</p>}
                                    </div>
                                </div>

                                {/* Meta */}
                                <div className="flex items-center gap-4 text-[10px] text-gray-600 bg-white/[0.02] rounded-xl p-3">
                                    <span className="flex items-center gap-1"><Hash size={10} /> {showPreview.numero}</span>
                                    <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(showPreview.created_at).toLocaleDateString('fr-FR')}</span>
                                    <span className="flex items-center gap-1"><ArrowRight size={10} /> {showPreview.type === 'facture' ? 'Délai' : 'Validité'}: {showPreview.validite}</span>
                                </div>

                                {/* Items Table */}
                                <div className="overflow-x-auto rounded-xl overflow-hidden border border-white/5">
                                    <table className="w-full text-sm">
                                        <thead className="bg-[#0c1420]">
                                            <tr>
                                                <th className="text-left py-3 px-3 text-[10px] font-bold text-gray-400 uppercase">Description</th>
                                                <th className="text-center py-3 px-2 text-[10px] font-bold text-gray-400 uppercase">Qté</th>
                                                <th className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase">PU HT</th>
                                                <th className="text-center py-3 px-2 text-[10px] font-bold text-gray-400 uppercase">TVA</th>
                                                <th className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase">TVA Mnt</th>
                                                <th className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase">Total HT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {showPreview.items?.map((item: DevisItem, i: number) => {
                                                const tvaMnt = item.quantity * item.unit_price * item.tva / 100
                                                const lineTotal = item.quantity * item.unit_price
                                                return (
                                                    <tr key={i} className="border-b border-white/5 even:bg-white/[0.01]">
                                                        <td className="py-2.5 px-3 text-gray-300 text-xs">{item.description}</td>
                                                        <td className="py-2.5 px-2 text-gray-400 text-center text-xs">{item.quantity}</td>
                                                        <td className="py-2.5 px-3 text-gray-400 text-right text-xs font-mono">{item.unit_price?.toLocaleString('fr-FR')}</td>
                                                        <td className="py-2.5 px-2 text-gray-400 text-center text-xs">{item.tva}%</td>
                                                        <td className="py-2.5 px-3 text-gray-500 text-right text-xs font-mono">{tvaMnt.toLocaleString('fr-FR')}</td>
                                                        <td className="py-2.5 px-3 text-white font-bold text-right text-xs font-mono">{lineTotal.toLocaleString('fr-FR')}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Totals */}
                                <div className="flex justify-end">
                                    <div className="w-72 space-y-2">
                                        <div className="flex justify-between text-xs text-gray-400 py-1"><span>Sous-total HT</span><span className="font-mono">{showPreview.sous_total?.toLocaleString('fr-FR')} XOF</span></div>
                                        <div className="flex justify-between text-xs text-gray-400 py-1"><span>TVA (18%)</span><span className="font-mono">+ {showPreview.total_tva?.toLocaleString('fr-FR')} XOF</span></div>
                                        {showPreview.remise > 0 && <div className="flex justify-between text-xs text-red-400 py-1"><span>Remise</span><span className="font-mono">- {showPreview.remise?.toLocaleString('fr-FR')} XOF</span></div>}
                                        <div className="flex justify-between font-black text-base text-white bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                                            <span>TOTAL TTC</span>
                                            <span className="text-emerald-400 font-mono">{showPreview.total?.toLocaleString('fr-FR')} XOF</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment (facture) */}
                                {showPreview.type === 'facture' && (
                                    <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CreditCard size={13} className="text-blue-400" />
                                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Modalités de paiement</p>
                                        </div>
                                        <p className="text-xs text-gray-400">Virement bancaire / Mobile Money</p>
                                        <p className="text-xs text-gray-500 mt-1">Délai : {showPreview.validite} • Réf. à indiquer : {showPreview.numero}</p>
                                    </div>
                                )}

                                {/* Notes */}
                                {showPreview.notes && (
                                    <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
                                        <p className="text-[10px] font-bold text-amber-400 uppercase mb-1">Notes</p>
                                        <p className="text-xs text-gray-400">{showPreview.notes}</p>
                                    </div>
                                )}

                                {/* Status + Actions */}
                                <div className="border-t border-white/5 pt-4">
                                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Statut:</p>
                                        {Object.entries(statusConfig).map(([key, cfg]) => (
                                            <button key={key} type="button" onClick={() => handleUpdateStatus(showPreview.id, key)} className={`text-[10px] font-bold px-2 py-1 rounded-full transition-all ${showPreview.status === key ? cfg.color : 'bg-white/5 text-gray-600 hover:text-white'}`}>{cfg.label}</button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        <button type="button" onClick={() => generatePDF(showPreview)} disabled={generating} className="flex-1 min-w-24 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold hover:bg-blue-500/30 transition-all">
                                            {generating ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF
                                        </button>
                                        <button type="button" onClick={() => sendByEmail(showPreview)} className="flex-1 min-w-24 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold hover:bg-purple-500/30 transition-all">
                                            <Mail size={12} /> Email
                                        </button>
                                        {showPreview.client_phone && (
                                            <button type="button" onClick={() => sendByWhatsApp(showPreview)} className="flex-1 min-w-24 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 font-bold hover:bg-green-500/30 transition-all">
                                                <Phone size={12} /> WhatsApp
                                            </button>
                                        )}
                                        <button type="button" onClick={() => setShowPreview(null)} className="px-3 py-2.5 rounded-xl border border-white/10 text-gray-500 hover:text-white transition-colors" title="Fermer"><X size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* CREATE FORM MODAL */}
            <AnimatePresence>
                {showForm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-[#080e15] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-lg font-bold text-white">Nouveau Document</h3>
                                <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white" title="Fermer"><X size={18} /></button>
                            </div>

                            {/* Type toggle */}
                            <div className="flex gap-2 mb-5">
                                {(['devis', 'facture'] as const).map(t => (
                                    <button key={t} type="button" onClick={() => setFormType(t)} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${formType === t ? (t === 'devis' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30') : 'bg-white/5 text-gray-500 border-white/5 hover:text-white'}`}>
                                        {t === 'devis' ? 'Devis' : 'Facture'}
                                    </button>
                                ))}
                            </div>

                            {/* Client info */}
                            <div className="flex items-center gap-2 mb-2">
                                <User size={12} className="text-gray-500" />
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Informations Client</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <input type="text" value={clientNom} onChange={e => setClientNom(e.target.value)} placeholder="Nom *" title="Nom" className="bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                <input type="text" value={clientPrenom} onChange={e => setClientPrenom(e.target.value)} placeholder="Prénom" title="Prénom" className="bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="Email" title="Email" className="bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                <input type="text" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="Téléphone / WhatsApp" title="Téléphone" className="bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                <input type="text" value={clientAdresse} onChange={e => setClientAdresse(e.target.value)} placeholder="Adresse complète" title="Adresse" className="col-span-2 bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                            </div>

                            {/* Validity */}
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar size={12} className="text-gray-500" />
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{formType === 'facture' ? 'Délai de Paiement' : 'Validité du Devis'}</p>
                            </div>
                            <input type="text" value={validite} onChange={e => setValidite(e.target.value)} placeholder="Ex: 30 jours" title="Validité" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 mb-4" />

                            {/* Items */}
                            <div className="flex items-center gap-2 mb-2">
                                <Calculator size={12} className="text-gray-500" />
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Prestations / Services</p>
                            </div>
                            <div className="grid grid-cols-12 gap-2 mb-1 px-1">
                                <p className="col-span-5 text-[9px] font-bold text-gray-600 uppercase">Description</p>
                                <p className="col-span-2 text-[9px] font-bold text-gray-600 uppercase text-center">Qté</p>
                                <p className="col-span-2 text-[9px] font-bold text-gray-600 uppercase text-right">Prix HT</p>
                                <p className="col-span-2 text-[9px] font-bold text-gray-600 uppercase text-center">TVA %</p>
                            </div>
                            <div className="space-y-2 mb-3">
                                {items.map((item, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                        <input type="text" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Description" title="Description" className="col-span-5 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-xs placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                        <input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)} title="Quantité" className="col-span-2 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-xs text-center focus:outline-none focus:border-emerald-500/50" />
                                        <input type="number" min="0" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)} title="Prix HT" className="col-span-2 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-xs text-right focus:outline-none focus:border-emerald-500/50" />
                                        <input type="number" min="0" max="100" value={item.tva} onChange={e => updateItem(i, 'tva', parseInt(e.target.value) || 0)} title="TVA %" className="col-span-2 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-xs text-center focus:outline-none focus:border-emerald-500/50" />
                                        <button type="button" onClick={() => removeItem(i)} className="col-span-1 text-gray-600 hover:text-red-400 transition-colors flex justify-center" title="Supprimer"><Trash2 size={13} /></button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addItem} className="text-xs text-emerald-400 font-bold flex items-center gap-1 mb-4 hover:text-emerald-300 transition-colors"><Plus size={12} /> Ajouter une ligne</button>

                            {/* Totals preview */}
                            <div className="bg-white/[0.03] rounded-xl p-4 mb-4 space-y-1.5">
                                <div className="flex justify-between text-xs text-gray-400"><span>Sous-total HT</span><span className="font-mono">{sousTotal.toLocaleString('fr-FR')} XOF</span></div>
                                <div className="flex justify-between text-xs text-gray-400"><span>TVA</span><span className="font-mono">+ {totalTVA.toLocaleString('fr-FR')} XOF</span></div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-400">Remise (XOF)</span>
                                    <input type="number" min="0" value={remise} onChange={e => setRemise(parseFloat(e.target.value) || 0)} title="Remise" className="w-28 bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-white text-xs text-right focus:outline-none focus:border-emerald-500/50" />
                                </div>
                                <div className="flex justify-between text-sm font-black text-emerald-400 border-t border-white/5 pt-2"><span>TOTAL TTC</span><span className="font-mono">{totalFinal.toLocaleString('fr-FR')} XOF</span></div>
                            </div>

                            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes internes (optionnel)" title="Notes" rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none mb-3" />
                            <textarea value={conditions} onChange={e => setConditions(e.target.value)} placeholder="Conditions générales" title="Conditions" rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none mb-4" />

                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-bold">Annuler</button>
                                <button type="button" onClick={handleSave} disabled={saving || !clientNom.trim()} className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-emerald-500/30 transition-all">
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Sauvegarder
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
