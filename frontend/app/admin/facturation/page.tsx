'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    FileText, Plus, Trash2, Loader2, Search,
    Download, Eye, Calculator, Receipt, Undo2, X, AlertTriangle, ShieldCheck, BadgeDollarSign, ExternalLink,
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
        // NB : PAS de join `agent:agent_id(email)` — il n'existe aucune relation
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

    // En-tête d'auth (token session) — les UPDATE/DELETE directs sont bloqués
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
        if (res.ok) {
            setDocuments(prev => prev.map(d => d.id === id ? { ...d, status } : d))
            if (showPreview?.id === id) setShowPreview(prev => prev ? { ...prev, status } : null)
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

    const fmtN = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    // Libellé de devise du DOCUMENT (jamais forcer XOF sur une facture EUR/USD)
    const curLabel = (c?: string) => (!c || c === 'XOF' || c === 'FCFA') ? 'FCFA' : c === 'EUR' ? '€' : c === 'USD' ? '$' : c
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
            const typeLabel = doc.type === 'devis' ? 'DEVIS' : doc.type === 'avoir' ? 'AVOIR' : 'FACTURE'
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(24)
            if (doc.type === 'devis') {
                pdf.setTextColor(180, 120, 0)
            } else if (doc.type === 'avoir') {
                pdf.setTextColor(200, 90, 20)   // orange — note de crédit
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
            // Validité uniquement pour les devis — jamais de « Délai » sur une facture
            if (doc.validite && doc.type === 'devis') {
                pdf.text(safe('Validite : ' + doc.validite), pw - mr, headerTop + 32, { align: 'right' })
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

            // Même habillage clair que la case DESTINATAIRE (plus de fond noir)
            pdf.setFillColor(248, 250, 255)
            pdf.setDrawColor(200, 215, 240)
            pdf.setLineWidth(0.3)
            pdf.roundedRect(ml, y, boxW, boxH, 2, 2, 'FD')

            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(6)
            pdf.setTextColor(100, 110, 160)
            pdf.text('EMETTEUR', ml + 4, y + 6)
            const headerLines = pdf.splitTextToSize(devisHeader, boxW - 8)
            headerLines.forEach((l: string, i: number) => {
                const isFirst = i === 0
                if (isFirst) {
                    pdf.setFont('helvetica', 'bold')
                    pdf.setFontSize(9)
                    pdf.setTextColor(30, 40, 70)
                } else {
                    pdf.setFont('helvetica', 'normal')
                    pdf.setFontSize(6.5)
                    pdf.setTextColor(70, 80, 110)
                }
                const offset = isFirst ? 13 : (19 + (i - 1) * 5.2)
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
            if (doc.client_ifu) { pdf.text('IFU : ' + doc.client_ifu, toX + 4, clientY); clientY += 5.5 }
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
                // Intitulé complet du service : multi-lignes, la hauteur de la
                // rangée s'adapte (plus jamais de description tronquée)
                const descLines: string[] = pdf.splitTextToSize(safe(item.description || '-'), cols[0].w - 5)
                const rowH = Math.max(9.5, descLines.length * 4.2 + 5)
                const even = i % 2 === 0
                pdf.setFillColor(even ? 252 : 247, even ? 253 : 249, even ? 254 : 252)
                pdf.rect(ml, y, cw, rowH, 'F')
                pdf.setDrawColor(220, 228, 238)
                pdf.setLineWidth(0.2)
                pdf.line(ml, y + rowH, ml + cw, y + rowH)

                const tvaMnt = item.quantity * item.unit_price * item.tva / 100
                const lineTotal = item.quantity * item.unit_price
                const rowData = [
                    { text: String(item.quantity), w: cols[1].w, align: 'center', x: ml + cols[0].w },
                    { text: fmtN(item.unit_price), w: cols[2].w, align: 'right', x: ml + cols[0].w + cols[1].w },
                    { text: item.tva + '%', w: cols[3].w, align: 'center', x: ml + cols[0].w + cols[1].w + cols[2].w },
                    { text: fmtN(tvaMnt), w: cols[4].w, align: 'right', x: ml + cols[0].w + cols[1].w + cols[2].w + cols[3].w },
                    { text: fmtN(lineTotal), w: cols[5].w, align: 'right', x: ml + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w },
                ]
                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(8)
                pdf.setTextColor(40, 55, 75)
                descLines.forEach((line, li) => {
                    pdf.text(line, ml + 3, y + 6 + li * 4.2)
                })
                const midY = y + rowH / 2 + 1.4
                rowData.forEach(cell => {
                    if (cell.align === 'right') {
                        pdf.text(cell.text, cell.x + cell.w - 2, midY, { align: 'right' })
                    } else {
                        pdf.text(cell.text, cell.x + cell.w / 2, midY, { align: 'center' })
                    }
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
                if (doc.type === 'avoir') {
                    // AVOIR : note de crédit — référence la facture annulée
                    pdf.setFont('helvetica', 'bold')
                    pdf.setFontSize(7)
                    pdf.setTextColor(200, 90, 20)
                    pdf.text('NOTE DE CREDIT', ml + 4, y + 8)
                    pdf.setFont('helvetica', 'normal')
                    pdf.setFontSize(6.5)
                    pdf.setTextColor(90, 100, 95)
                    const motifLines = pdf.splitTextToSize(safe(doc.motif_avoir ? 'Motif : ' + doc.motif_avoir : (doc.notes || 'Avoir sur facture')), sigW - 8)
                    motifLines.slice(0, 3).forEach((l: string, i: number) => pdf.text(l, ml + 4, y + 15 + i * 4.5))
                    pdf.setTextColor(120, 120, 120)
                    pdf.text('Etabli le ' + formatDate(doc.created_at), ml + 4, y + 31)
                } else if (doc.type === 'facture') {
                    // FACTURE : preuve de règlement — jamais de « Bon pour accord »
                    pdf.setFont('helvetica', 'bold')
                    pdf.setFontSize(7)
                    pdf.setTextColor(0, 100, 60)
                    pdf.text('CONFIRMATION DE PAIEMENT', ml + 4, y + 8)
                    pdf.setFont('helvetica', 'bold')
                    pdf.setFontSize(9)
                    pdf.setTextColor(0, 135, 81)
                    pdf.text('PAIEMENT ENREGISTRE', ml + 4, y + 17)
                    pdf.setFont('helvetica', 'normal')
                    pdf.setFontSize(6.5)
                    pdf.setTextColor(90, 100, 95)
                    pdf.text('Facture acquittee - reglement recu par Retour Gagnant Benin', ml + 4, y + 24)
                    pdf.text('Etablie le ' + formatDate(doc.created_at), ml + 4, y + 30)
                } else {
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
                }

                // ── Réplique exacte de la case DIRECTION GÉNÉRALE de la
                //    Grille Tarifaire (titre, société, PDG, cachet officiel) ──
                const sig2X = ml + sigW + 8
                pdf.setFillColor(242, 245, 255)
                pdf.setDrawColor(100, 110, 200)
                pdf.roundedRect(sig2X, y, sigW, sigBoxH, 2, 2, 'FD')
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(7)
                pdf.setTextColor(70, 80, 170)
                pdf.text('DIRECTION GENERALE', sig2X + 4, y + 6)
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(6.5)
                pdf.setTextColor(30, 40, 70)
                pdf.text('RETOUR GAGNANT BENIN', sig2X + 4, y + 11)

                // Signature manuscrite (script) — police times italique, encre bleue
                pdf.setFont('times', 'italic')
                pdf.setFontSize(15)
                pdf.setTextColor(20, 40, 110)
                pdf.text(safe(presidentName), sig2X + 5, y + 22)
                pdf.setDrawColor(20, 40, 110)
                pdf.setLineWidth(0.3)
                pdf.line(sig2X + 5, y + 24, sig2X + 5 + Math.min(sigW - 44, pdf.getTextWidth(safe(presidentName)) * 0.5), y + 24)

                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(5.8)
                pdf.setTextColor(90, 95, 130)
                pdf.text('Signature et Cachet officiel — Fait a Cotonou, le ' + formatDate(doc.created_at), sig2X + 4, y + sigBoxH - 3)

                // Cachet officiel — grande taille (place liberee), a droite
                if (STAMP_BASE64) {
                    try {
                        const stampData = STAMP_BASE64.startsWith('data:') ? STAMP_BASE64 : `data:image/png;base64,${STAMP_BASE64}`
                        const cs = 40
                        pdf.addImage(stampData, 'PNG', sig2X + sigW - cs - 1, y + (sigBoxH - cs) / 2, cs, cs)
                    } catch (e) {
                        console.error('Error adding stamp:', e)
                    }
                }
            }

            // ── CERTIFICATION FISCALE e-MCF / MECeF (DGI Bénin) ─────
            // N'apparaît que sur les factures/avoirs certifiés (données
            // saisies ou récupérées de l'API DGI). QR de vérification à gauche.
            if ((doc.type === 'facture' || doc.type === 'avoir') && (doc.mecef_code || doc.mecef_nim)) {
                const mY = Math.min(y + 4, ph - 62)
                const boxMH = 30
                pdf.setFillColor(245, 250, 247)
                pdf.setDrawColor(0, 135, 81)
                pdf.setLineWidth(0.4)
                pdf.roundedRect(ml, mY, cw, boxMH, 2, 2, 'FD')
                // QR
                if (doc.mecef_qr) {
                    try {
                        const QR = (await import('qrcode')).default
                        const qrData = await QR.toDataURL(doc.mecef_qr, { margin: 0, width: 200 })
                        pdf.addImage(qrData, 'PNG', ml + 3, mY + 3, 24, 24)
                    } catch { /* QR non généré : on garde le bloc texte */ }
                }
                const tX = ml + (doc.mecef_qr ? 31 : 4)
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(7)
                pdf.setTextColor(0, 100, 60)
                pdf.text('FACTURE CERTIFIEE - e-MCF / MECeF (DGI BENIN)', tX, mY + 6)
                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(6.5)
                pdf.setTextColor(60, 70, 90)
                let mLine = mY + 12
                if (doc.mecef_code) { pdf.text(safe('Code de controle : ' + doc.mecef_code), tX, mLine); mLine += 4.5 }
                if (doc.mecef_nim) { pdf.text(safe('NIM : ' + doc.mecef_nim), tX, mLine); mLine += 4.5 }
                if (doc.mecef_counters) { pdf.text(safe('Compteurs : ' + doc.mecef_counters), tX, mLine); mLine += 4.5 }
                if (doc.mecef_datetime) { pdf.text('Certifie le ' + formatDate(doc.mecef_datetime), tX, mLine) }
                y = mY + boxMH + 4
            }

            // ── WATERMARK ──────────────────────────────────────────
            // Uniquement pour les brouillons. Le filigrane « PAYE » est retiré :
            // le statut en en-tête suffit largement (pas de doublon).
            if (doc.status === 'brouillon') {
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(75)
                pdf.setTextColor(210, 215, 222)
                pdf.text('BROUILLON', pw / 2, ph / 2, { align: 'center', angle: 40 })
            }

            // ── LEGAL FOOTER (police agrandie, toutes les lignes) ──
            const footerLines = devisFooter.split('\n').filter(Boolean)
            const footH = footerLines.length * 4 + 9
            pdf.setFillColor(10, 16, 24)
            pdf.rect(0, ph - footH, pw, footH, 'F')
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(7)
            pdf.setTextColor(165, 185, 205)
            footerLines.forEach((l: string, i: number) => {
                pdf.text(safe(l), pw / 2, ph - footH + 5 + i * 4, { align: 'center' })
            })
            pdf.setFontSize(6.5)
            pdf.setTextColor(120, 140, 160)
            pdf.text('Document N. ' + doc.numero + ' - Genere le ' + formatDate(new Date().toISOString()), pw / 2, ph - 2.5, { align: 'center' })

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
        valide: { color: 'bg-orange-500/20 text-orange-400', label: 'Avoir émis' },
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
                                                <button onClick={() => toggleFacturePaid(doc)} className={`p-2 rounded-lg transition-all ${doc.status === 'paye' ? 'text-emerald-500 hover:text-amber-500 hover:bg-amber-500/10' : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10'}`} title={doc.status === 'paye' ? 'Payée — cliquer pour marquer impayée' : 'Marquer cette facture comme payée'}><BadgeDollarSign size={16} /></button>
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
