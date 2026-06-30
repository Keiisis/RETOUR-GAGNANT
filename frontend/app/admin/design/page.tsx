'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import { Document, Packer, Paragraph, ImageRun, AlignmentType } from 'docx'
import { saveAs } from 'file-saver'
import {
    CreditCard, Download, FileImage, FileType, User, Plus, Trash2,
    CheckCircle, AlertCircle, Loader2, Eye, UserCheck, RefreshCw,
    Search, ExternalLink, BookOpen, ChevronRight, Building2, Compass
} from 'lucide-react'
import Link from 'next/link'
import { CardRecto as RGBRecto, CardVerso as RGBVerso, type CardData } from '@/components/business-card/BusinessCard'
import { CardRecto as OuidahRecto, CardVerso as OuidahVerso } from '@/components/business-card/OuidahCard'
import { downloadSVGCard } from '@/lib/svg-card-generator'
import { downloadOuidahSVGCard } from '@/lib/svg-ouidah-generator'

type TabKey = 'rgb' | 'ouidah'

const TABS: { key: TabKey; label: string; icon: typeof Building2; accent: string; accentBg: string }[] = [
    { key: 'rgb', label: 'Retour Gagnant', icon: Building2, accent: '#C9A84C', accentBg: '#C9A84C' },
    { key: 'ouidah', label: 'Ouidah Heritage Tour', icon: Compass, accent: '#C88B2A', accentBg: '#1B2A4A' },
]

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface Agent {
    id: string
    full_name: string
    role: string
}

interface SavedCard {
    id: string
    employee_prenom: string
    employee_nom: string
    position: string
    phone: string
    email: string
    agent_id: string | null
    created_at: string
    is_active: boolean
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

async function captureCard(ref: React.RefObject<HTMLDivElement | null>, pixelRatio = 3): Promise<string> {
    if (!ref.current) throw new Error('Élément non trouvé')
    await new Promise(r => setTimeout(r, 300))
    return toPng(ref.current, { pixelRatio, cacheBust: true, skipFonts: false })
}

async function downloadPNG(ref: React.RefObject<HTMLDivElement | null>, filename: string) {
    const dataUrl = await captureCard(ref)
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    link.click()
}

async function downloadPDF(
    rectoRef: React.RefObject<HTMLDivElement | null>,
    versoRef: React.RefObject<HTMLDivElement | null>,
    name: string
) {
    if (!rectoRef.current || !versoRef.current) throw new Error('Ref manquante')

    // ── Forcer les deux captures à EXACTEMENT la même taille pixel ──
    const W = rectoRef.current.offsetWidth
    const H = rectoRef.current.offsetHeight
    await new Promise(r => setTimeout(r, 400))

    const captureOpts = { pixelRatio: 4, cacheBust: true, skipFonts: false, width: W, height: H }
    const [rectoUrl, versoUrl] = await Promise.all([
        toPng(rectoRef.current, captureOpts),
        toPng(versoRef.current, captureOpts),
    ])

    // ═══ PDF — 2 pages A4 Portrait, carte 85×55mm centrée ═══
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const cardW = 85, cardH = 55
    const x = 62.5            // (210 - 85) / 2 = 62.5
    const y = 121              // (297 - 55) / 2 = 121
    const cropLen = 8, cropOff = 3

    // ── Traits de coupe identiques recto & verso ──
    const drawCropMarks = (label: string) => {
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(0.15)
        // Haut-gauche
        pdf.line(x - cropOff - cropLen, y, x - cropOff, y)
        pdf.line(x, y - cropOff - cropLen, x, y - cropOff)
        // Haut-droit
        pdf.line(x + cardW + cropOff, y, x + cardW + cropOff + cropLen, y)
        pdf.line(x + cardW, y - cropOff - cropLen, x + cardW, y - cropOff)
        // Bas-gauche
        pdf.line(x - cropOff - cropLen, y + cardH, x - cropOff, y + cardH)
        pdf.line(x, y + cardH + cropOff, x, y + cardH + cropOff + cropLen)
        // Bas-droit
        pdf.line(x + cardW + cropOff, y + cardH, x + cardW + cropOff + cropLen, y + cardH)
        pdf.line(x + cardW, y + cardH + cropOff, x + cardW, y + cardH + cropOff + cropLen)
        // Label
        pdf.setFontSize(7)
        pdf.setTextColor(100, 100, 100)
        pdf.text(label, x + cardW / 2, y - cropOff - cropLen - 2, { align: 'center' })
        pdf.setFontSize(5.5)
        pdf.setTextColor(130, 130, 130)
        pdf.text(`${cardW} × ${cardH} mm — Imprimer à TAILLE RÉELLE (100%)`, x + cardW / 2, y + cardH + cropOff + cropLen + 4, { align: 'center' })
    }

    // Page 1 — RECTO
    pdf.addImage(rectoUrl, 'PNG', x, y, cardW, cardH)
    drawCropMarks('RECTO')

    // Page 2 — VERSO (position strictement identique)
    pdf.addPage('a4', 'portrait')
    pdf.addImage(versoUrl, 'PNG', x, y, cardW, cardH)
    drawCropMarks('VERSO')

    pdf.save(`Carte-VIP-${name.toLowerCase().replace(/\s+/g, '-')}.pdf`)
}


async function downloadDOCX(
    rectoRef: React.RefObject<HTMLDivElement | null>,
    versoRef: React.RefObject<HTMLDivElement | null>,
    name: string
) {
    const [rectoUrl, versoUrl] = await Promise.all([
        captureCard(rectoRef, 4),
        captureCard(versoRef, 4),
    ])
    const toBuffer = async (dataUrl: string) => {
        const res = await fetch(dataUrl)
        return await res.arrayBuffer()
    }
    const [rectoBuf, versoBuf] = await Promise.all([toBuffer(rectoUrl), toBuffer(versoUrl)])

    const cardW = 340
    const cardH = 204
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new ImageRun({ data: rectoBuf, transformation: { width: cardW, height: cardH }, type: 'png' })],
                }),
                new Paragraph({ children: [] }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new ImageRun({ data: versoBuf, transformation: { width: cardW, height: cardH }, type: 'png' })],
                }),
            ],
        }],
    })
    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `Carte-VIP-${name.toLowerCase().replace(/\s+/g, '-')}.docx`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
}


/** Extrait le message d'une erreur (Error, Supabase PostgrestError, ou objet quelconque) */
function getErrorMessage(e: unknown): string {
    if (!e) return 'Erreur inconnue'
    if (e instanceof Error) return e.message
    if (typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
    return String(e)
}

/* ═══════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
   ═══════════════════════════════════════════════════════════════ */

export default function AdminDesignPage() {
    const [form, setForm] = useState<CardData>({ prenom: '', nom: '', position: '', phone: '', email: '' })
    const [activeView, setActiveView] = useState<'recto' | 'verso'>('recto')
    const [activeTab, setActiveTab] = useState<TabKey>('rgb')

    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedAgent, setSelectedAgent] = useState<string>('')
    const [agentSearch, setAgentSearch] = useState('')

    const [savedCards, setSavedCards] = useState<SavedCard[]>([])
    const [loadingCards, setLoadingCards] = useState(true)
    const [tableReady, setTableReady] = useState<boolean | null>(null)
    const [sqlCopied, setSqlCopied] = useState(false)

    const [saving, setSaving] = useState(false)
    const [downloading, setDownloading] = useState<string | null>(null)
    const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

    const rgbRectoRef = useRef<HTMLDivElement>(null)
    const rgbVersoRef = useRef<HTMLDivElement>(null)
    const ouidahRectoRef = useRef<HTMLDivElement>(null)
    const ouidahVersoRef = useRef<HTMLDivElement>(null)

    const getActiveRefs = () => activeTab === 'rgb' ? { recto: rgbRectoRef, verso: rgbVersoRef } : { recto: ouidahRectoRef, verso: ouidahVersoRef }

    const isValid = !!(form.prenom.trim() && form.nom.trim() && form.position.trim())

    const set = (k: keyof CardData) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(p => ({ ...p, [k]: e.target.value }))

    /* ─── Chargement agents + cartes ─── */
    const load = useCallback(async () => {
        setLoadingCards(true)
        try {
            // ① Agents via API (service role → bypass RLS, retourne tous les agents/admins)
            const usersRes = await fetch('/api/admin/users')
            if (usersRes.ok) {
                const json = await usersRes.json()
                const validRoles = ['agent', 'admin', 'super_admin', 'superadmin']
                const agentList: Agent[] = (json.users || [])
                    .filter((u: { role?: string }) => u.role && validRoles.includes(u.role))
                    .map((u: { id: string; full_name?: string; role: string }) => ({
                        id: u.id,
                        full_name: u.full_name || '—',
                        role: u.role,
                    }))
                setAgents(agentList)
            }

            // ② Cartes sauvegardées
            const cardsRes = await supabase
                .from('business_cards')
                .select('id, employee_prenom, employee_nom, position, phone, email, agent_id, created_at, is_active')
                .order('created_at', { ascending: false })

            if (cardsRes.data) {
                setSavedCards(cardsRes.data)
                setTableReady(true)
            } else if (cardsRes.error) {
                const msg = cardsRes.error.message || ''
                if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache') || msg.includes('not found')) {
                    setTableReady(false)
                } else {
                    console.warn('[Design] cards:', msg)
                }
            }
        } catch (e) {
            console.error('[Design] load error:', getErrorMessage(e))
        } finally {
            setLoadingCards(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    /* ─── Sauvegarde ─── */
    const save = async () => {
        if (!isValid) return
        setSaving(true)
        setStatus(null)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const { error } = await supabase.from('business_cards').insert({
                employee_prenom: form.prenom.trim(),
                employee_nom:    form.nom.trim(),
                position:        form.position.trim(),
                phone:           form.phone.trim(),
                email:           form.email.trim(),
                agent_id:        selectedAgent || null,
                created_by:      session?.user?.id || null,
                is_active:       true,
            })
            if (error) {
                const msg = error.message || 'Erreur Supabase'
                if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache') || msg.includes('not found')) {
                    setTableReady(false)
                    setStatus({ type: 'error', msg: 'La table business_cards est introuvable. Créez-la via le SQL affiché ci-dessus.' })
                } else {
                    setStatus({ type: 'error', msg })
                }
                return
            }
            setStatus({ type: 'success', msg: 'Carte sauvegardée avec succès !' })
            await load()
            setTimeout(() => setStatus(null), 4000)
        } catch (e) {
            setStatus({ type: 'error', msg: getErrorMessage(e) })
        } finally {
            setSaving(false)
        }
    }

    const handleDownloadPdf = async () => {
        setDownloading('pdf')
        try {
            const name = isValid ? `${form.prenom}-${form.nom}` : 'vide'
            const refs = getActiveRefs()
            await downloadPDF(refs.recto, refs.verso, name)
            setStatus({ type: 'success', msg: 'PDF exporté avec les normes d\'impression !' })
        } catch (e) {
            console.error('Erreur export :', e)
            setStatus({ type: 'error', msg: `Erreur export PDF : ${getErrorMessage(e)}` })
        } finally {
            setDownloading(null)
        }
    }

    const handleDownloadPng = async () => {
        setDownloading('png')
        try {
            const name = isValid ? `${form.prenom}-${form.nom}` : 'vide'
            const refs = getActiveRefs()
            
            const rectoUrl = await captureCard(refs.recto, 4)
            const versoUrl = await captureCard(refs.verso, 4)

            const downloadImage = (dataUrl: string, filename: string) => {
                const link = document.createElement("a")
                link.href = dataUrl
                link.download = filename
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
            }

            downloadImage(rectoUrl, `Carte-VIP-${name}-RECTO.png`)
            setTimeout(() => {
                downloadImage(versoUrl, `Carte-VIP-${name}-VERSO.png`)
            }, 500)

            setStatus({ type: 'success', msg: 'Images PNG importables (Canva/Word) téléchargées avec succès !' })
        } catch (e) {
            console.error('Erreur export :', e)
            setStatus({ type: 'error', msg: `Erreur export PNG : ${getErrorMessage(e)}` })
        } finally {
            setDownloading(null)
        }
    }

    const handleDownloadSvg = async () => {
        setDownloading('svg')
        try {
            const name = isValid ? `${form.prenom}-${form.nom}` : 'vide'
            if (activeTab === 'ouidah') {
                await downloadOuidahSVGCard(form, `Carte-VIP-Ouidah-${name}`)
            } else {
                await downloadSVGCard(form, `Carte-VIP-${name}`)
            }
            setStatus({ type: 'success', msg: 'SVG vectoriel natif Recto+Verso téléchargé ! Tracés nets, prêt pour Illustrator, Inkscape, impression et gravure laser.' })
        } catch (e) {
            console.error('Erreur export SVG :', e)
            setStatus({ type: 'error', msg: `Erreur export SVG : ${getErrorMessage(e)}` })
        } finally {
            setDownloading(null)
        }
    }

    /* ─── Suppression ─── */
    const deleteCard = async (id: string) => {
        if (!confirm('Supprimer cette carte ?')) return
        const { error } = await supabase.from('business_cards').delete().eq('id', id)
        if (error) console.error('[Design] delete:', error.message)
        await load()
    }

    /* ─── Attribution à un agent ─── */
    const assignCard = async (cardId: string, agentId: string) => {
        const { error } = await supabase.from('business_cards').update({ agent_id: agentId }).eq('id', cardId)
        if (error) console.error('[Design] assign:', error.message)
        await load()
    }

    /* ─── Téléchargement depuis une carte sauvegardée ─── */
    const downloadSaved = async (card: SavedCard, type: 'recto-png' | 'verso-png' | 'svg' | 'pdf' | 'docx') => {
        setDownloading(card.id + type)
        const cardData: CardData = {
            prenom:   card.employee_prenom,
            nom:      card.employee_nom,
            position: card.position,
            phone:    card.phone,
            email:    card.email,
        }
        setForm(cardData)
        await new Promise(r => setTimeout(r, 250))
        try {
            const fullName = `${card.employee_prenom}-${card.employee_nom}`
            const refs = getActiveRefs()
            if (type === 'recto-png')      await downloadPNG(refs.recto, `recto-${fullName}.png`)
            else if (type === 'verso-png') await downloadPNG(refs.verso, `verso-${fullName}.png`)
            else if (type === 'svg') {
                if (activeTab === 'ouidah') {
                    await downloadOuidahSVGCard(cardData, `Carte-VIP-Ouidah-${fullName}`)
                } else {
                    await downloadSVGCard(cardData, `Carte-VIP-${fullName}`)
                }
            }
            else if (type === 'pdf')       await downloadPDF(refs.recto, refs.verso, fullName)
            else if (type === 'docx')      await downloadDOCX(refs.recto, refs.verso, fullName)
        } catch (e) {
            alert('Erreur export : ' + getErrorMessage(e))
        } finally {
            setDownloading(null)
        }
    }

    const filteredAgents = agents.filter(a =>
        a.full_name?.toLowerCase().includes(agentSearch.toLowerCase())
    )

    /* ─── Nom de l'agent lié à une carte ─── */
    const agentName = (card: SavedCard) =>
        agents.find(a => a.id === card.agent_id)?.full_name || null

    /* ═══ RENDER ═══ */
    return (
        <div className="space-y-8">

            {/* ── Navigation sous-sections ── */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="relative overflow-hidden rounded-2xl bg-[#C9A84C]/8 border-2 border-[#C9A84C]/30 p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-[#C9A84C]/20 border border-[#C9A84C]/30 flex items-center justify-center flex-shrink-0">
                        <CreditCard size={20} className="text-[#C9A84C]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm">Cartes de Visite</p>
                        <p className="text-gray-500 text-xs">Format 85×55mm — Recto / Verso</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-[#C9A84C]" />
                </div>
                <Link href="/admin/design/depliant"
                    className="group relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-[#C9A84C]/30 hover:bg-[#C9A84C]/5 p-5 flex items-center gap-4 transition-all">
                    <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] group-hover:bg-[#C9A84C]/15 group-hover:border-[#C9A84C]/25 flex items-center justify-center flex-shrink-0 transition-all">
                        <BookOpen size={20} className="text-gray-500 group-hover:text-[#C9A84C] transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-gray-300 font-bold text-sm group-hover:text-white transition-colors">Dépliant A3</p>
                        <p className="text-gray-600 text-xs">2 volets · Français / English</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-600 group-hover:text-[#C9A84C] transition-colors" />
                </Link>
                <Link href="/admin/design/rollup"
                    className="group relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-[#C9A84C]/30 hover:bg-[#C9A84C]/5 p-5 flex items-center gap-4 transition-all">
                    <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] group-hover:bg-[#C9A84C]/15 group-hover:border-[#C9A84C]/25 flex items-center justify-center flex-shrink-0 transition-all">
                        <FileImage size={20} className="text-gray-500 group-hover:text-[#C9A84C] transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-gray-300 font-bold text-sm group-hover:text-white transition-colors">Roll-Ups</p>
                        <p className="text-gray-600 text-xs">85×200cm — Haute Définition</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-600 group-hover:text-[#C9A84C] transition-colors" />
                </Link>
                <Link href="/admin/design/plexiglas"
                    className="group relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-emerald-500/30 hover:bg-emerald-500/5 p-5 flex items-center gap-4 transition-all text-left">
                    <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] group-hover:bg-emerald-500/15 group-hover:border-emerald-500/25 flex items-center justify-center flex-shrink-0 transition-all">
                        <Download size={20} className="text-gray-500 group-hover:text-emerald-400 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-gray-300 font-bold text-sm group-hover:text-white transition-colors">Plexiglas SVG</p>
                        <p className="text-gray-600 text-xs">80×120cm — Forme arche</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
                </Link>
                <Link href="/admin/design/plexiglas-horaires"
                    className="group relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-[#C88B2A]/30 hover:bg-[#C88B2A]/5 p-5 flex items-center gap-4 transition-all text-left">
                    <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] group-hover:bg-[#C88B2A]/15 group-hover:border-[#C88B2A]/25 flex items-center justify-center flex-shrink-0 transition-all">
                        <Download size={20} className="text-gray-500 group-hover:text-[#C88B2A] transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-gray-300 font-bold text-sm group-hover:text-white transition-colors">Plexiglas Horaires</p>
                        <p className="text-gray-600 text-xs">80×120cm — R.G.B / O.H.T / A.C.S.T</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-600 group-hover:text-[#C88B2A] transition-colors" />
                </Link>
            </div>

            {/* ── Header ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#C9A84C]/15 via-[#0f141e] to-[#071525]/80 border border-white/10 p-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A84C]/5 rounded-full blur-[80px]" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-[#C9A84C]/15 border border-[#C9A84C]/30 flex items-center justify-center">
                            <CreditCard size={22} className="text-[#C9A84C]" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">Cartes de Visite</h1>
                            <p className="text-gray-400 text-sm">Génération automatique — format 85×55mm, recto/verso</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href="/notre-histoire" target="_blank"
                            className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white transition-all">
                            <ExternalLink size={12} /> Site public
                        </a>
                        <button type="button" onClick={load}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white hover:border-white/20 transition-all">
                            <RefreshCw size={14} /> Actualiser
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Bannière SQL — visible uniquement si table manquante ── */}
            {tableReady === false && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-500/8 border border-amber-500/25 rounded-2xl overflow-hidden">
                    <div className="flex items-start gap-4 p-5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <AlertCircle size={18} className="text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-white font-bold text-sm mb-1">Table <code className="bg-white/8 px-1.5 py-0.5 rounded text-amber-300 text-xs">business_cards</code> introuvable</h3>
                            <p className="text-gray-400 text-xs mb-3">
                                Exécutez ce SQL dans votre tableau de bord Supabase pour créer la table, puis cliquez <strong className="text-white">Actualiser</strong>.
                            </p>
                            <div className="relative">
                                <pre className="bg-black/40 border border-white/[0.06] rounded-xl p-4 text-[11px] text-gray-300 overflow-x-auto font-mono leading-relaxed">{`CREATE TABLE public.business_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_prenom TEXT NOT NULL,
  employee_nom TEXT NOT NULL,
  position TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  agent_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);
ALTER TABLE public.business_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.business_cards
  FOR ALL USING (true) WITH CHECK (true);`}</pre>
                            </div>
                            <div className="flex items-center gap-3 mt-3">
                                <button type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(`CREATE TABLE public.business_cards (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  employee_prenom TEXT NOT NULL,\n  employee_nom TEXT NOT NULL,\n  position TEXT NOT NULL,\n  phone TEXT DEFAULT '',\n  email TEXT DEFAULT '',\n  agent_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,\n  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,\n  created_at TIMESTAMPTZ DEFAULT NOW(),\n  is_active BOOLEAN DEFAULT true\n);\nALTER TABLE public.business_cards ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Admins full access" ON public.business_cards\n  FOR ALL USING (true) WITH CHECK (true);`)
                                        setSqlCopied(true)
                                        setTimeout(() => setSqlCopied(false), 2500)
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 bg-amber-500/15 border border-amber-500/25 rounded-lg text-xs text-amber-300 hover:bg-amber-500/25 transition-all font-medium">
                                    {sqlCopied ? <CheckCircle size={13} className="text-green-400" /> : <ExternalLink size={13} />}
                                    {sqlCopied ? 'Copié !' : 'Copier le SQL'}
                                </button>
                                <a href="https://supabase.com/dashboard/project/_/sql/new" target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white transition-all">
                                    <ExternalLink size={13} /> Ouvrir l&apos;éditeur SQL Supabase
                                </a>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* ═══ FORMULAIRE ═══ */}
                <div className="space-y-5">
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                        <h2 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
                            <User size={16} className="text-[#C9A84C]" /> Informations de l&apos;employé
                        </h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Prénom *</label>
                                    <input value={form.prenom} onChange={set('prenom')} placeholder="Nathalie"
                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]/50 transition-colors" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Nom *</label>
                                    <input value={form.nom} onChange={set('nom')} placeholder="Germany"
                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]/50 transition-colors" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Poste / Fonction *</label>
                                <input value={form.position} onChange={set('position')} placeholder="Fondatrice & Directrice Générale"
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]/50 transition-colors" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Téléphone</label>
                                <input value={form.phone} onChange={set('phone')} placeholder="+229 01 XX XX XX XX"
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]/50 transition-colors" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Email</label>
                                <input value={form.email} onChange={set('email')} type="email" placeholder="n.germany@retourgagnantbenin.bj"
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]/50 transition-colors" />
                            </div>
                        </div>
                    </div>

                    {/* Attribuer à un agent */}
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                        <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <UserCheck size={16} className="text-[#008751]" /> Attribuer à un agent (optionnel)
                        </h2>

                        {agents.length === 0 && !loadingCards && (
                            <div className="text-xs text-gray-500 bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5 mb-3">
                                Aucun agent disponible — vérifiez que des utilisateurs avec le rôle <code className="bg-white/5 px-1 rounded text-gray-400">agent</code> existent dans la base.
                            </div>
                        )}

                        <div className="relative mb-3">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                value={agentSearch}
                                onChange={e => setAgentSearch(e.target.value)}
                                placeholder="Chercher un agent..."
                                className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#008751]/50 transition-colors"
                            />
                        </div>

                        <div className="space-y-1.5 max-h-44 overflow-y-auto">
                            <button type="button"
                                onClick={() => setSelectedAgent('')}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!selectedAgent ? 'bg-[#008751]/15 border border-[#008751]/30 text-[#008751]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'}`}
                            >
                                Aucun agent (carte générique)
                            </button>
                            {filteredAgents.map(a => (
                                <button type="button" key={a.id}
                                    onClick={() => setSelectedAgent(a.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedAgent === a.id ? 'bg-[#008751]/15 border border-[#008751]/30 text-[#008751]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'}`}
                                >
                                    {a.full_name || '—'} <span className="opacity-50 text-xs">— {a.role}</span>
                                </button>
                            ))}
                            {loadingCards && (
                                <div className="flex items-center gap-2 px-3 py-2 text-gray-600 text-xs">
                                    <Loader2 size={12} className="animate-spin" /> Chargement des agents…
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={save} disabled={!isValid || saving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#C9A84C]/20 border border-[#C9A84C]/40 text-[#C9A84C] rounded-xl text-sm font-bold hover:bg-[#C9A84C]/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            Sauvegarder la carte
                        </button>
                        <button
                            onClick={handleDownloadPdf}
                            disabled={!isValid || downloading !== null}
                            className="flex w-full sm:w-auto items-center justify-center gap-2 group px-6 py-3.5 bg-gradient-to-r from-red-600 to-red-500 rounded-xl font-semibold text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all hover:-translate-y-1 overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                            {downloading === 'pdf' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                            <span>Imprimer (PDF - 90x54)</span>
                        </button>
                        
                        <button
                            onClick={handleDownloadSvg}
                            disabled={!isValid || downloading !== null}
                            className="flex w-full sm:w-auto items-center justify-center gap-2 group px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-xl font-semibold text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all hover:-translate-y-1 overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                            {downloading === 'svg' ? <Loader2 size={18} className="animate-spin" /> : <FileType size={18} />}
                            <span>Vectoriel (SVG)</span>
                        </button>
                        <button
                            onClick={handleDownloadPng}
                            disabled={!isValid || downloading !== null}
                            className="flex w-full sm:w-auto items-center justify-center gap-2 group px-6 py-3.5 bg-gradient-to-r from-[#C9A84C] to-[#A88836] rounded-xl font-semibold text-[#1A1F2C] shadow-lg shadow-[#C9A84C]/20 hover:shadow-[#C9A84C]/40 transition-all hover:-translate-y-1 overflow-hidden relative"
                        >
                            {downloading === 'png' ? <Loader2 size={18} className="animate-spin text-[#1A1F2C]" /> : <FileImage size={18} className="text-[#1A1F2C]" />}
                            <span>Télécharger en Images (HQ)</span>
                        </button>
                    </div>

                    {/* Status toast */}
                    <AnimatePresence>
                        {status && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className={`flex items-start gap-2 p-3 rounded-xl text-sm ${status.type === 'success'
                                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                                    : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}
                            >
                                {status.type === 'success'
                                    ? <CheckCircle size={15} className="mt-0.5 flex-shrink-0" />
                                    : <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />}
                                <span>{status.msg}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ═══ APERÇU CARTE ═══ */}
                <div className="space-y-5">
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                <Eye size={16} className="text-[#C9A84C]" /> Aperçu en temps réel
                            </h2>
                        </div>

                        <div className="flex rounded-lg overflow-hidden border border-white/10 mb-4 bg-white/[0.02]">
                            {TABS.map(tab => {
                                const isActive = activeTab === tab.key
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => { setActiveTab(tab.key); setActiveView('recto') }}
                                        className="flex-1 py-2 text-xs font-bold transition-colors"
                                        style={{
                                            background: isActive ? `${tab.accent}20` : 'transparent',
                                            color: isActive ? tab.accent : '#6B7280',
                                        }}>
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </div>
                        
                        <div className="flex justify-center mb-4">
                            <div className="flex rounded-lg overflow-hidden border border-white/10">
                                <button type="button" onClick={() => setActiveView('recto')}
                                    className={`px-3 py-1.5 text-xs font-bold transition-colors ${activeView === 'recto' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-500 hover:text-gray-300'}`}>
                                    RECTO
                                </button>
                                <button type="button" onClick={() => setActiveView('verso')}
                                    className={`px-3 py-1.5 text-xs font-bold transition-colors ${activeView === 'verso' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-500 hover:text-gray-300'}`}>
                                    VERSO
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-center overflow-hidden">
                            <div style={{ transform: 'scale(0.82)', transformOrigin: 'top center', marginBottom: -40 }}>
                                <AnimatePresence mode="wait">
                                    {activeView === 'recto' ? (
                                        <motion.div key="recto"
                                            initial={{ opacity: 0, rotateY: -15 }}
                                            animate={{ opacity: 1, rotateY: 0 }}
                                            exit={{ opacity: 0, rotateY: 15 }}
                                            transition={{ duration: 0.3 }}>
                                            {activeTab === 'rgb' 
                                                ? <RGBRecto data={isValid ? form : { prenom: 'PRÉNOM', nom: 'NOM', position: 'Fonction', phone: '', email: '' }} />
                                                : <OuidahRecto data={isValid ? form : { prenom: 'PRÉNOM', nom: 'NOM', position: 'Fonction', phone: '', email: '' }} />
                                            }
                                        </motion.div>
                                    ) : (
                                        <motion.div key="verso"
                                            initial={{ opacity: 0, rotateY: 15 }}
                                            animate={{ opacity: 1, rotateY: 0 }}
                                            exit={{ opacity: 0, rotateY: -15 }}
                                            transition={{ duration: 0.3 }}>
                                            {activeTab === 'rgb'
                                                ? <RGBVerso data={isValid ? form : { prenom: 'PRÉNOM', nom: 'NOM', position: 'Fonction', phone: '+229 01 XX XX XX', email: 'email@exemple.bj' }} />
                                                : <OuidahVerso data={isValid ? form : { prenom: 'PRÉNOM', nom: 'NOM', position: 'Fonction', phone: '+229 01 XX XX XX', email: 'email@exemple.bj' }} />
                                            }
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <p className="text-center text-gray-600 text-xs mt-2">
                            Format réel : 85 × 55 mm — export 300+ DPI
                        </p>
                    </div>

                    {/* Refs pour export — off-screen pour permettre le chargement des images */}
                    <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }} aria-hidden>
                        <RGBRecto ref={rgbRectoRef} data={form} scale={1} />
                        <RGBVerso ref={rgbVersoRef} data={form} scale={1} />
                        <OuidahRecto ref={ouidahRectoRef} data={form} scale={1} />
                        <OuidahVerso ref={ouidahVersoRef} data={form} scale={1} />
                    </div>
                </div>
            </div>

            {/* ═══ CARTES SAUVEGARDÉES ═══ */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl">
                <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <CreditCard size={16} className="text-[#C9A84C]" />
                        Cartes générées ({savedCards.length})
                    </h2>
                </div>

                {loadingCards ? (
                    <div className="flex items-center justify-center py-12 text-gray-500">
                        <Loader2 size={20} className="animate-spin mr-2" /> Chargement…
                    </div>
                ) : savedCards.length === 0 ? (
                    <div className="text-center py-12 text-gray-600">
                        <CreditCard size={32} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Aucune carte générée pour le moment</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {savedCards.map(card => {
                            const linkedAgent = agentName(card)
                            return (
                                <div key={card.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors">
                                    {/* Miniature */}
                                    <div style={{ transform: 'scale(0.28)', transformOrigin: 'top left', width: 340 * 0.28, height: 220 * 0.28, flexShrink: 0, pointerEvents: 'none' }}>
                                        {activeTab === 'rgb' ? (
                                            <RGBRecto data={{
                                                prenom: card.employee_prenom,
                                                nom: card.employee_nom,
                                                position: card.position,
                                                phone: card.phone,
                                                email: card.email,
                                            }} />
                                        ) : (
                                            <OuidahRecto data={{
                                                prenom: card.employee_prenom,
                                                nom: card.employee_nom,
                                                position: card.position,
                                                phone: card.phone,
                                                email: card.email,
                                            }} />
                                        )}
                                    </div>

                                    {/* Infos */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-bold text-sm">{card.employee_prenom} {card.employee_nom}</p>
                                        <p className="text-gray-400 text-xs">{card.position}</p>
                                        {linkedAgent ? (
                                            <p className="text-[#008751] text-xs mt-0.5 flex items-center gap-1">
                                                <UserCheck size={10} /> Attribuée à {linkedAgent}
                                            </p>
                                        ) : (
                                            <p className="text-gray-600 text-xs mt-0.5">Non attribuée</p>
                                        )}
                                        <p className="text-gray-600 text-xs mt-0.5">
                                            {!card.created_at || isNaN(new Date(card.created_at).getTime()) ? '—' : new Date(card.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {/* Dropdown attribution */}
                                        {agents.length > 0 && (
                                            <select
                                                title="Attribuer cette carte à un agent"
                                                onChange={e => e.target.value && assignCard(card.id, e.target.value)}
                                                className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-400 focus:outline-none focus:border-[#008751]/50 max-w-[160px]"
                                                value={card.agent_id || ''}
                                            >
                                                <option value="" disabled={!!card.agent_id}>
                                                    {card.agent_id ? '↻ Réattribuer…' : 'Attribuer à…'}
                                                </option>
                                                {agents.map(a => (
                                                    <option key={a.id} value={a.id}>{a.full_name}</option>
                                                ))}
                                            </select>
                                        )}
                                        <button type="button"
                                            onClick={() => downloadSaved(card, 'recto-png')}
                                            disabled={downloading !== null}
                                            className="flex items-center gap-1 px-2 py-1.5 bg-white/[0.03] border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40"
                                            title="PNG Recto">
                                            <FileImage size={12} /> R
                                        </button>
                                        <button type="button"
                                            onClick={() => downloadSaved(card, 'verso-png')}
                                            disabled={downloading !== null}
                                            className="flex items-center gap-1 px-2 py-1.5 bg-white/[0.03] border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40"
                                            title="PNG Verso">
                                            <FileImage size={12} /> V
                                        </button>
                                        <button type="button"
                                            onClick={() => downloadSaved(card, 'svg')}
                                            disabled={downloading !== null}
                                            className="flex items-center gap-1 px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
                                            title="SVG Vectoriel Recto+Verso">
                                            <FileType size={12} /> SVG
                                        </button>
                                        <button type="button"
                                            onClick={() => downloadSaved(card, 'pdf')}
                                            disabled={downloading !== null}
                                            className="flex items-center gap-1 px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                                            title="PDF Recto+Verso">
                                            <Download size={12} /> PDF
                                        </button>
                                        <button type="button"
                                            onClick={() => downloadSaved(card, 'docx')}
                                            disabled={downloading !== null}
                                            className="flex items-center gap-1 px-2 py-1.5 bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-lg text-xs text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-40"
                                            title="DOCX Modifiable">
                                            <FileImage size={12} /> DOCX
                                        </button>
                                        <button type="button"
                                            onClick={() => deleteCard(card.id)}
                                            className="flex items-center gap-1 px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 hover:bg-red-500/20 transition-colors"
                                            title="Supprimer">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
