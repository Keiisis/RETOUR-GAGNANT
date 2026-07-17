'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import {
    ArrowLeft, Download, FileImage, Loader2, Info,
    BookOpen, CheckCircle, AlertCircle, Globe, Languages
} from 'lucide-react'
import {
    Panel1Recto, Panel1Verso, Panel2Verso, Panel2Recto,
    FullPageVersoFR, FullPageVersoEN,
    BASE_W, BASE_H, A3_W, A3_H
} from '@/components/brochure/BrochurePanel'

/* ═══════ HELPERS ═══════ */

async function captureCanvas(ref: React.RefObject<HTMLDivElement | null>): Promise<HTMLCanvasElement> {
    const el = ref.current
    if (!el) throw new Error('Élément non trouvé')

    const canvas = await html2canvas(el, {
        scale: 1.5, // 1.5x scale for HD quality without memory overflow
        useCORS: true,
        backgroundColor: '#0b1a3a', // fallback
        logging: false
    })

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error('Capture échouée — dimensions nulles')
    }
    return canvas
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function getErrorMessage(e: unknown): string {
    if (!e) return 'Erreur inconnue'
    if (e instanceof Error) return e.message
    if (typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
    return String(e)
}

/* ═══════ PAGE ═══════ */

type DlKey = 'p1r' | 'p1v' | 'p2v' | 'p2r' | 'fp-fr' | 'fp-en' | 'pdf-outside' | 'pdf-inside' | 'pdf-a4' | 'pdf-fr-ext' | 'pdf-fr-int' | 'pdf-en-ext' | 'pdf-en-int'
type TabKey = 'bilingue' | 'francais' | 'english'

export default function DepliantPage() {
    const [downloading, setDownloading] = useState<DlKey | null>(null)
    const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
    const [activeTab, setActiveTab] = useState<TabKey>('bilingue')

    /* Refs — bilingue */
    const r1rRef = useRef<HTMLDivElement>(null)
    const r1vRef = useRef<HTMLDivElement>(null)
    const r2vRef = useRef<HTMLDivElement>(null)
    const r2rRef = useRef<HTMLDivElement>(null)
    /* Refs — A3 pleine page */
    const fpFrRef = useRef<HTMLDivElement>(null)
    const fpEnRef = useRef<HTMLDivElement>(null)

    const showStatus = (type: 'success' | 'error', msg: string) => {
        setStatus({ type, msg })
        setTimeout(() => setStatus(null), 4000)
    }

    /* ─── Downloads ─── */

    const downloadPanelPng = async (key: DlKey, ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
        setDownloading(key)
        try {
            const canvas = await captureCanvas(ref)
            canvas.toBlob((blob) => {
                if (!blob) throw new Error("Échec de la conversion PNG")
                downloadBlob(blob, filename)
                showStatus('success', `${filename} téléchargé`)
            }, 'image/png')
        } catch (e) {
            showStatus('error', getErrorMessage(e))
        } finally {
            setDownloading(null)
        }
    }

    const downloadA3Pdf = async (key: DlKey, leftRef: React.RefObject<HTMLDivElement | null>, rightRef: React.RefObject<HTMLDivElement | null>, filename: string) => {
        setDownloading(key)
        try {
            const [leftCanvas, rightCanvas] = await Promise.all([captureCanvas(leftRef), captureCanvas(rightRef)])
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true })
            pdf.addImage(leftCanvas,  'JPEG', 0,   0, 210, 297, undefined, 'FAST')
            pdf.addImage(rightCanvas, 'JPEG', 210, 0, 210, 297, undefined, 'FAST')
            pdf.save(filename)
            showStatus('success', `${filename} généré`)
        } catch (e) {
            showStatus('error', getErrorMessage(e))
        } finally {
            setDownloading(null)
        }
    }

    const downloadA4Pdf = async () => {
        setDownloading('pdf-a4')
        try {
            const refs = [r1rRef, r1vRef, r2vRef, r2rRef]
            const canvases = await Promise.all(refs.map(r => captureCanvas(r)))
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
            canvases.forEach((canvas, i) => {
                if (i > 0) pdf.addPage('a4', 'portrait')
                pdf.addImage(canvas, 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
            })
            pdf.save('depliant-rgb-a4-4pages.pdf')
            showStatus('success', 'PDF A4 généré (4 pages)')
        } catch (e) {
            showStatus('error', getErrorMessage(e))
        } finally {
            setDownloading(null)
        }
    }

    /* PDF A3 pour version monolingue — le verso est déjà A3 en un seul ref */
    const downloadA3SinglePdf = async (key: DlKey, versoRef: React.RefObject<HTMLDivElement | null>, filename: string) => {
        setDownloading(key)
        try {
            const canvas = await captureCanvas(versoRef)
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true })
            pdf.addImage(canvas, 'JPEG', 0, 0, 420, 297, undefined, 'FAST')
            pdf.save(filename)
            showStatus('success', `${filename} généré`)
        } catch (e) {
            showStatus('error', getErrorMessage(e))
        } finally {
            setDownloading(null)
        }
    }

    /* Preview scales */
    const PREVIEW_SCALE = 0.44
    const A3_PREVIEW_SCALE = 0.22  // A3 is double width

    const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
        { key: 'bilingue', label: 'Bilingue (FR/EN)', icon: <Languages size={14} /> },
        { key: 'francais', label: 'Français', icon: <span className="text-xs font-black">FR</span> },
        { key: 'english', label: 'English', icon: <Globe size={14} /> },
    ]

    const bilingualPanels = [
        { key: 'p1r' as DlKey, label: 'Face 1 Recto', sub: 'Couverture', ref: r1rRef, Component: Panel1Recto },
        { key: 'p1v' as DlKey, label: 'Face 1 Verso', sub: 'Français', ref: r1vRef, Component: Panel1Verso },
        { key: 'p2v' as DlKey, label: 'Face 2 Verso', sub: 'English', ref: r2vRef, Component: Panel2Verso },
        { key: 'p2r' as DlKey, label: 'Face 2 Recto', sub: '4e de couverture', ref: r2rRef, Component: Panel2Recto },
    ]

    return (
        <div className="space-y-8">

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#C9A84C]/15 via-[#0f141e] to-[#071525]/80 border border-white/10 p-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A84C]/5 rounded-full blur-[80px]" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href="/admin/design"
                            className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all">
                            <ArrowLeft size={16} />
                        </Link>
                        <div className="w-12 h-12 rounded-xl bg-[#C9A84C]/15 border border-[#C9A84C]/30 flex items-center justify-center">
                            <BookOpen size={22} className="text-[#C9A84C]" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">Dépliant A3 — Retour Gagnant Bénin</h1>
                            <p className="text-gray-400 text-sm">2 volets · Format A3 paysage (420×297mm)</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Sub-tabs */}
            <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1.5">
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                            activeTab === tab.key
                                ? 'bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30'
                                : 'text-gray-500 hover:text-white border border-transparent'
                        }`}>{tab.icon}{tab.label}</button>
                ))}
            </div>

            {/* Toast */}
            {status && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex items-center gap-2 p-3 rounded-xl text-sm ${status.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                    {status.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                    {status.msg}
                </motion.div>
            )}

            {/* ═══ TAB: BILINGUE ═══ */}
            {activeTab === 'bilingue' && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                        {bilingualPanels.map(({ key, label, sub, ref, Component }) => (
                            <div key={key} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 flex flex-col gap-4">
                                <div className="overflow-hidden rounded-xl border border-white/[0.06] flex justify-center bg-black/20">
                                    <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top center', marginBottom: -(BASE_H * (1 - PREVIEW_SCALE)) }}>
                                        <Component scale={1} />
                                    </div>
                                </div>
                                <div><p className="text-white font-bold text-sm">{label}</p><p className="text-gray-500 text-xs">{sub}</p></div>
                                <button type="button" onClick={() => downloadPanelPng(key, ref, `rgb-depliant-${key}.png`)} disabled={downloading !== null}
                                    className="flex items-center justify-center gap-2 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-gray-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-40 font-medium">
                                    {downloading === key ? <Loader2 size={14} className="animate-spin" /> : <FileImage size={14} />}Télécharger PNG
                                </button>
                            </div>
                        ))}
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                        className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                        <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Download size={15} className="text-[#C9A84C]" /> Export PDF — Bilingue</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                            <button type="button" onClick={() => downloadA3Pdf('pdf-outside', r2rRef, r1rRef, 'rgb-depliant-exterieur-a3.pdf')} disabled={downloading !== null}
                                className="flex flex-col items-center gap-2 py-4 bg-[#C9A84C]/10 border border-[#C9A84C]/25 rounded-xl text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-all disabled:opacity-40">
                                {downloading === 'pdf-outside' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                <span className="font-bold text-sm">PDF A3 — Extérieur</span><span className="text-xs opacity-70">Face 2 Recto + Face 1 Recto</span>
                            </button>
                            <button type="button" onClick={() => downloadA3Pdf('pdf-inside', r1vRef, r2vRef, 'rgb-depliant-interieur-a3.pdf')} disabled={downloading !== null}
                                className="flex flex-col items-center gap-2 py-4 bg-[#C9A84C]/10 border border-[#C9A84C]/25 rounded-xl text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-all disabled:opacity-40">
                                {downloading === 'pdf-inside' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                <span className="font-bold text-sm">PDF A3 — Intérieur</span><span className="text-xs opacity-70">Face 1 Verso + Face 2 Verso</span>
                            </button>
                            <button type="button" onClick={downloadA4Pdf} disabled={downloading !== null}
                                className="flex flex-col items-center gap-2 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-gray-300 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
                                {downloading === 'pdf-a4' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                <span className="font-bold text-sm">PDF A4 — 4 pages</span><span className="text-xs text-gray-500">Un panneau par page</span>
                            </button>
                        </div>
                    </motion.div>
                </>
            )}

            {/* ═══ TAB: FRANÇAIS ═══ */}
            {activeTab === 'francais' && (
                <>
                    {/* Recto = Extérieur A3 (Face 2 Recto + Face 1 Recto) */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2"> Recto — Extérieur (A3 paysage)</h2>
                        <p className="text-gray-500 text-xs">Face 2 Recto (QR Code) à gauche + Face 1 Recto (Couverture) à droite — identique au bilingue</p>
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
                            <div className="overflow-hidden rounded-xl border border-white/[0.06] flex justify-center bg-black/20">
                                <div style={{ display: 'flex', transform: `scale(${A3_PREVIEW_SCALE})`, transformOrigin: 'top center', marginBottom: -(BASE_H * (1 - A3_PREVIEW_SCALE)) }}>
                                    <Panel2Recto scale={1} />
                                    <Panel1Recto scale={1} />
                                </div>
                            </div>
                        </div>
                        <button type="button" onClick={() => downloadA3Pdf('pdf-fr-ext', r2rRef, r1rRef, 'rgb-depliant-FR-exterieur-a3.pdf')} disabled={downloading !== null}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-[#C9A84C]/10 border border-[#C9A84C]/25 rounded-xl text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-all disabled:opacity-40 font-bold text-sm">
                            {downloading === 'pdf-fr-ext' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            Télécharger PDF A3 Recto (Extérieur)
                        </button>
                    </motion.div>

                    {/* Verso = Intérieur A3 Français pleine page */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-3">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2"> Verso — Intérieur Français (A3 paysage pleine page)</h2>
                        <p className="text-gray-500 text-xs">Contenu français étendu sur toute la surface A3 · Police agrandie · Mise en page optimale</p>
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
                            <div className="overflow-hidden rounded-xl border border-white/[0.06] flex justify-center bg-black/20">
                                <div style={{ transform: `scale(${A3_PREVIEW_SCALE})`, transformOrigin: 'top center', marginBottom: -(A3_H * (1 - A3_PREVIEW_SCALE)) }}>
                                    <FullPageVersoFR scale={1} />
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button type="button" onClick={() => downloadPanelPng('fp-fr', fpFrRef, 'rgb-depliant-FR-interieur-a3.png')} disabled={downloading !== null}
                                className="flex items-center justify-center gap-2 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-gray-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-40 font-bold">
                                {downloading === 'fp-fr' ? <Loader2 size={16} className="animate-spin" /> : <FileImage size={16} />}
                                Télécharger PNG Verso
                            </button>
                            <button type="button" onClick={() => downloadA3SinglePdf('pdf-fr-int', fpFrRef, 'rgb-depliant-FR-interieur-a3.pdf')} disabled={downloading !== null}
                                className="flex items-center justify-center gap-2 py-3 bg-[#C9A84C]/10 border border-[#C9A84C]/25 rounded-xl text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-all disabled:opacity-40 font-bold text-sm">
                                {downloading === 'pdf-fr-int' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                Télécharger PDF A3 Verso (Intérieur FR)
                            </button>
                        </div>
                    </motion.div>
                </>
            )}

            {/* ═══ TAB: ENGLISH ═══ */}
            {activeTab === 'english' && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2"> Recto — Outside (A3 Landscape)</h2>
                        <p className="text-gray-500 text-xs">Panel 2 Recto (QR Code) left + Panel 1 Recto (Cover) right — same as bilingual</p>
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
                            <div className="overflow-hidden rounded-xl border border-white/[0.06] flex justify-center bg-black/20">
                                <div style={{ display: 'flex', transform: `scale(${A3_PREVIEW_SCALE})`, transformOrigin: 'top center', marginBottom: -(BASE_H * (1 - A3_PREVIEW_SCALE)) }}>
                                    <Panel2Recto scale={1} />
                                    <Panel1Recto scale={1} />
                                </div>
                            </div>
                        </div>
                        <button type="button" onClick={() => downloadA3Pdf('pdf-en-ext', r2rRef, r1rRef, 'rgb-brochure-EN-outside-a3.pdf')} disabled={downloading !== null}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-[#C9A84C]/10 border border-[#C9A84C]/25 rounded-xl text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-all disabled:opacity-40 font-bold text-sm">
                            {downloading === 'pdf-en-ext' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            Download PDF A3 Recto (Outside)
                        </button>
                    </motion.div>

                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-3">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2"> Verso — Inside English (A3 Landscape Full Page)</h2>
                        <p className="text-gray-500 text-xs">English content spread across the full A3 surface · Enlarged fonts · Professional layout</p>
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
                            <div className="overflow-hidden rounded-xl border border-white/[0.06] flex justify-center bg-black/20">
                                <div style={{ transform: `scale(${A3_PREVIEW_SCALE})`, transformOrigin: 'top center', marginBottom: -(A3_H * (1 - A3_PREVIEW_SCALE)) }}>
                                    <FullPageVersoEN scale={1} />
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button type="button" onClick={() => downloadPanelPng('fp-en', fpEnRef, 'rgb-brochure-EN-inside-a3.png')} disabled={downloading !== null}
                                className="flex items-center justify-center gap-2 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-gray-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-40 font-bold">
                                {downloading === 'fp-en' ? <Loader2 size={16} className="animate-spin" /> : <FileImage size={16} />}
                                Download PNG Verso
                            </button>
                            <button type="button" onClick={() => downloadA3SinglePdf('pdf-en-int', fpEnRef, 'rgb-brochure-EN-inside-a3.pdf')} disabled={downloading !== null}
                                className="flex items-center justify-center gap-2 py-3 bg-[#C9A84C]/10 border border-[#C9A84C]/25 rounded-xl text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-all disabled:opacity-40 font-bold text-sm">
                                {downloading === 'pdf-en-int' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                Download PDF A3 Verso (Inside EN)
                            </button>
                        </div>
                    </motion.div>
                </>
            )}

            {/* Info */}
            <div className="flex items-start gap-2 text-xs text-gray-600 px-2">
                <Info size={12} className="mt-0.5 flex-shrink-0 text-[#C9A84C]/50" />
                <div>
                    <span className="text-[#C9A84C]/70 font-semibold">Impression professionnelle :</span>
                    {' '}Les versions monolingues (FR/EN) produisent un dépliant avec le contenu étendu sur toute la surface A3 intérieure. Exportez le Recto (extérieur) + le Verso (intérieur) et donnez les 2 PDF à votre imprimeur.
                </div>
            </div>

            {/* Capture elements — pushed off-screen to ensure they are rendered by the browser without overlapping the UI */}
            <div style={{ position: 'absolute', top: -10000, left: -10000 }} aria-hidden>
                <Panel1Recto ref={r1rRef} scale={1} />
                <Panel1Verso ref={r1vRef} scale={1} />
                <Panel2Verso ref={r2vRef} scale={1} />
                <Panel2Recto ref={r2rRef} scale={1} />
                <FullPageVersoFR ref={fpFrRef} scale={1} />
                <FullPageVersoEN ref={fpEnRef} scale={1} />
            </div>
        </div>
    )
}
