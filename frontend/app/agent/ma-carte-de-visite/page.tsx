'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import { CreditCard, Download, FileImage, FileText as FileType, CircleNotch as Loader2, ArrowCounterClockwise as RotateCcw, Info, Buildings as Building2, Compass } from '@phosphor-icons/react';
import { CardRecto as RGBRecto, CardVerso as RGBVerso, type CardData } from '@/components/business-card/BusinessCard'
import { CardRecto as OuidahRecto, CardVerso as OuidahVerso } from '@/components/business-card/OuidahCard'
import { downloadSVGCard } from '@/lib/svg-card-generator'
import { downloadOuidahSVGCard } from '@/lib/svg-ouidah-generator'

/* ══════════════════════════════════════════════════════════════
   TABS CONFIG
══════════════════════════════════════════════════════════════ */

type TabKey = 'rgb' | 'ouidah'

const TABS: { key: TabKey; label: string; icon: typeof Building2; accent: string; accentBg: string }[] = [
    { key: 'rgb', label: 'Retour Gagnant', icon: Building2, accent: '#C9A84C', accentBg: '#C9A84C' },
    { key: 'ouidah', label: 'Ouidah Heritage Tour', icon: Compass, accent: '#C88B2A', accentBg: '#1B2A4A' },
]

/* ══════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════ */

export default function MaCarteDeVisite() {
    const [card, setCard] = useState<CardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<TabKey>('rgb')
    const [view, setView] = useState<'recto' | 'verso'>('recto')
    const [flipping, setFlipping] = useState(false)
    const [downloading, setDownloading] = useState<string | null>(null)

    const rgbRectoRef = useRef<HTMLDivElement>(null)
    const rgbVersoRef = useRef<HTMLDivElement>(null)
    const ouidahRectoRef = useRef<HTMLDivElement>(null)
    const ouidahVersoRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session?.user) { setLoading(false); return }

                const { data } = await supabase
                    .from('business_cards')
                    .select('employee_prenom, employee_nom, position, phone, email')
                    .eq('agent_id', session.user.id)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                if (data) {
                    setCard({
                        prenom: data.employee_prenom,
                        nom: data.employee_nom,
                        position: data.position,
                        phone: data.phone || '',
                        email: data.email || '',
                    })
                }
            } catch {
                // No card assigned
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const flip = () => {
        setFlipping(true)
        setTimeout(() => {
            setView(v => v === 'recto' ? 'verso' : 'recto')
            setFlipping(false)
        }, 200)
    }

    const getActiveRefs = () => {
        return activeTab === 'rgb'
            ? { recto: rgbRectoRef, verso: rgbVersoRef }
            : { recto: ouidahRectoRef, verso: ouidahVersoRef }
    }

    const downloadPNG = async (side: 'recto' | 'verso') => {
        const refs = getActiveRefs()
        const ref = side === 'recto' ? refs.recto : refs.verso
        if (!ref.current || !card) return
        setDownloading(side + '-png')
        try {
            await new Promise(r => setTimeout(r, 300))
            const dataUrl = await toPng(ref.current, { pixelRatio: 4, cacheBust: true })
            const link = document.createElement('a')
            const prefix = activeTab === 'rgb' ? 'rgb' : 'ouidah'
            link.download = `${prefix}-carte-${side}-${card.prenom}-${card.nom}.png`
            link.href = dataUrl
            link.click()
        } finally {
            setDownloading(null)
        }
    }

    const handleDownloadSvg = async () => {
        if (!card) return
        setDownloading('svg')
        try {
            const prefix = activeTab === 'rgb' ? 'RGB' : 'Ouidah-Heritage'
            if (activeTab === 'ouidah') {
                await downloadOuidahSVGCard(card, `Carte-VIP-${prefix}-${card.prenom}-${card.nom}`)
            } else {
                await downloadSVGCard(card, `Carte-VIP-${prefix}-${card.prenom}-${card.nom}`)
            }
        } finally {
            setDownloading(null)
        }
    }

    const downloadPDF = async () => {
        const refs = getActiveRefs()
        if (!refs.recto.current || !refs.verso.current || !card) return
        setDownloading('pdf')
        try {
            const W = refs.recto.current.offsetWidth
            const H = refs.recto.current.offsetHeight
            await new Promise(r => setTimeout(r, 400))
            const captureOpts = { pixelRatio: 4, cacheBust: true, skipFonts: false, width: W, height: H }
            const [rectoUrl, versoUrl] = await Promise.all([
                toPng(refs.recto.current, captureOpts),
                toPng(refs.verso.current, captureOpts),
            ])

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
            const cardW = 85, cardH = 55
            const x = 62.5, y = 121
            const cropLen = 8, cropOff = 3

            const drawCropMarks = (label: string) => {
                pdf.setDrawColor(0, 0, 0)
                pdf.setLineWidth(0.15)
                pdf.line(x - cropOff - cropLen, y, x - cropOff, y)
                pdf.line(x, y - cropOff - cropLen, x, y - cropOff)
                pdf.line(x + cardW + cropOff, y, x + cardW + cropOff + cropLen, y)
                pdf.line(x + cardW, y - cropOff - cropLen, x + cardW, y - cropOff)
                pdf.line(x - cropOff - cropLen, y + cardH, x - cropOff, y + cardH)
                pdf.line(x, y + cardH + cropOff, x, y + cardH + cropOff + cropLen)
                pdf.line(x + cardW + cropOff, y + cardH, x + cardW + cropOff + cropLen, y + cardH)
                pdf.line(x + cardW, y + cardH + cropOff, x + cardW, y + cardH + cropOff + cropLen)
                pdf.setFontSize(7)
                pdf.setTextColor(100, 100, 100)
                pdf.text(label, x + cardW / 2, y - cropOff - cropLen - 2, { align: 'center' })
                pdf.setFontSize(5.5)
                pdf.setTextColor(130, 130, 130)
                pdf.text(`${cardW} × ${cardH} mm : Imprimer à TAILLE RÉELLE (100%)`, x + cardW / 2, y + cardH + cropOff + cropLen + 4, { align: 'center' })
            }

            pdf.addImage(rectoUrl, 'PNG', x, y, cardW, cardH)
            drawCropMarks('RECTO')
            pdf.addPage('a4', 'portrait')
            pdf.addImage(versoUrl, 'PNG', x, y, cardW, cardH)
            drawCropMarks('VERSO')

            const prefix = activeTab === 'rgb' ? 'RGB' : 'Ouidah-Heritage'
            pdf.save(`Carte-VIP-${prefix}-${card.prenom}-${card.nom}.pdf`)
        } finally {
            setDownloading(null)
        }
    }

    const currentTab = TABS.find(t => t.key === activeTab)!

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 size={28} className="animate-spin text-[#C9A84C]" />
            </div>
        )
    }

    if (!card) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center">
                    <CreditCard size={28} className="text-[#C9A84C]/60" />
                </div>
                <h2 className="text-lg font-bold text-white">Aucune carte de visite</h2>
                <p className="text-gray-500 text-sm max-w-sm">
                    Votre administrateur n&apos;a pas encore généré votre carte de visite.
                    Contactez l&apos;administration pour en demander une.
                </p>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
            >
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-full mb-4">
                    <CreditCard size={14} className="text-[#C9A84C]" />
                    <span className="text-[#C9A84C] text-xs font-bold uppercase tracking-wider">Mes Cartes de Visite</span>
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">{card.prenom} {card.nom}</h1>
                <p className="text-gray-400 text-sm">{card.position}</p>
            </motion.div>

            {/* ═══ TABS : RGB / Ouidah Heritage Tour ═══ */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02] p-1 gap-1"
            >
                {TABS.map(tab => {
                    const isActive = activeTab === tab.key
                    const TabIcon = tab.icon
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => { setActiveTab(tab.key); setView('recto') }}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300"
                            style={{
                                background: isActive
                                    ? tab.key === 'ouidah'
                                        ? `linear-gradient(135deg, ${tab.accentBg}, #0F1C33)`
                                        : `${tab.accent}20`
                                    : 'transparent',
                                color: isActive ? tab.accent : '#6B7280',
                                border: isActive ? `1px solid ${tab.accent}30` : '1px solid transparent',
                            }}
                        >
                            <TabIcon size={16} />
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className="sm:hidden">{tab.key === 'rgb' ? 'RGB' : 'Ouidah'}</span>
                        </button>
                    )
                })}
            </motion.div>

            {/* Carte interactive */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center gap-5"
                >
                    {/* Toggle recto/verso */}
                    <div className="flex rounded-xl overflow-hidden border border-white/10 bg-white/[0.02]">
                        <button type="button" onClick={() => setView('recto')}
                            className="px-5 py-2.5 text-sm font-bold transition-colors"
                            style={{
                                background: view === 'recto' ? `${currentTab.accent}20` : 'transparent',
                                color: view === 'recto' ? currentTab.accent : '#6B7280',
                            }}>
                            RECTO
                        </button>
                        <button type="button" onClick={() => setView('verso')}
                            className="px-5 py-2.5 text-sm font-bold transition-colors"
                            style={{
                                background: view === 'verso' ? `${currentTab.accent}20` : 'transparent',
                                color: view === 'verso' ? currentTab.accent : '#6B7280',
                            }}>
                            VERSO
                        </button>
                    </div>

                    {/* Carte avec effet flip */}
                    <div className="cursor-pointer select-none" onClick={flip} title="Cliquez pour retourner la carte">
                        <motion.div
                            animate={{ opacity: flipping ? 0 : 1, scaleX: flipping ? 0.1 : 1 }}
                            transition={{ duration: 0.2 }}
                            style={{ transformOrigin: 'center' }}
                        >
                            <div>
                                {activeTab === 'rgb' ? (
                                    view === 'recto'
                                        ? <RGBRecto data={card} scale={0.63} />
                                        : <RGBVerso data={card} scale={0.63} />
                                ) : (
                                    view === 'recto'
                                        ? <OuidahRecto data={card} scale={0.63} />
                                        : <OuidahVerso data={card} scale={0.63} />
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Hint flip */}
                    <p className="text-gray-600 text-xs flex items-center gap-1">
                        <RotateCcw size={11} /> Cliquez sur la carte pour la retourner
                    </p>
                </motion.div>
            </AnimatePresence>

            {/* Boutons de téléchargement */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6"
            >
                <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Download size={15} style={{ color: currentTab.accent }} />
                    Télécharger : {currentTab.label}
                </h2>

                {/* ── Formats Vectoriels (Recommandés) ── */}
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: currentTab.accent }} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: currentTab.accent }}>Vectoriel : Recommandé pour impression</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button type="button" onClick={handleDownloadSvg} disabled={downloading !== null}
                            className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-all disabled:opacity-40 font-bold"
                            style={{
                                background: `${currentTab.accent}15`,
                                border: `1px solid ${currentTab.accent}30`,
                                color: currentTab.accent,
                            }}>
                            {downloading === 'svg' ? <Loader2 size={15} className="animate-spin" /> : <FileType size={15} />}
                            SVG Recto+Verso
                        </button>
                        <button type="button" onClick={downloadPDF} disabled={downloading !== null}
                            className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-all disabled:opacity-40 font-bold"
                            style={{
                                background: `${currentTab.accent}15`,
                                border: `1px solid ${currentTab.accent}30`,
                                color: currentTab.accent,
                            }}>
                            {downloading === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                            PDF Recto+Verso
                        </button>
                    </div>
                </div>

                {/* ── Formats Raster (Classiques) ── */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">Raster : Usage écran / web</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button type="button" onClick={() => downloadPNG('recto')} disabled={downloading !== null}
                            className="flex items-center justify-center gap-2 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-gray-300 hover:text-white hover:border-white/20 transition-all disabled:opacity-40 font-medium">
                            {downloading === 'recto-png' ? <Loader2 size={15} className="animate-spin" /> : <FileImage size={15} />}
                            Recto : PNG
                        </button>
                        <button type="button" onClick={() => downloadPNG('verso')} disabled={downloading !== null}
                            className="flex items-center justify-center gap-2 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-gray-300 hover:text-white hover:border-white/20 transition-all disabled:opacity-40 font-medium">
                            {downloading === 'verso-png' ? <Loader2 size={15} className="animate-spin" /> : <FileImage size={15} />}
                            Verso : PNG
                        </button>
                    </div>
                </div>

                <div className="mt-4 flex items-start gap-2 text-xs text-gray-600">
                    <Info size={12} className="mt-0.5 flex-shrink-0" style={{ color: `${currentTab.accent}80` }} />
                    <p><strong style={{ color: `${currentTab.accent}` }}>SVG (vectoriel)</strong> : tracés nets, aucune pixellisation, Recto+Verso dans un seul fichier avec traits de coupe. Compatible impression et gravure laser. <strong>PNG</strong> : haute résolution (4×) pour usage web.</p>
                </div>
            </motion.div>

            {/* Full-size refs for download : off-screen */}
            <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }} aria-hidden>
                <RGBRecto ref={rgbRectoRef} data={card} scale={1} />
                <RGBVerso ref={rgbVersoRef} data={card} scale={1} />
                <OuidahRecto ref={ouidahRectoRef} data={card} scale={1} />
                <OuidahVerso ref={ouidahVersoRef} data={card} scale={1} />
            </div>
        </div>
    )
}
