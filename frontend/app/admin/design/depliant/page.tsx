'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import {
    ArrowLeft, Download, FileImage, Loader2, Info,
    BookOpen, CheckCircle, AlertCircle
} from 'lucide-react'
import {
    Panel1Recto, Panel1Verso, Panel2Verso, Panel2Recto,
    BASE_W, BASE_H
} from '@/components/brochure/BrochurePanel'

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

async function capturePng(ref: React.RefObject<HTMLDivElement | null>): Promise<string> {
    if (!ref.current) throw new Error('Élément non trouvé')
    await new Promise(r => setTimeout(r, 300))
    return toPng(ref.current, { pixelRatio: 4, cacheBust: true, skipFonts: false })
}

function getErrorMessage(e: unknown): string {
    if (!e) return 'Erreur inconnue'
    if (e instanceof Error) return e.message
    if (typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
    return String(e)
}

/* ══════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════ */

type DownloadKey = 'p1r' | 'p1v' | 'p2v' | 'p2r' | 'pdf-outside' | 'pdf-inside' | 'pdf-a4'

export default function DepliantPage() {
    const [downloading, setDownloading] = useState<DownloadKey | null>(null)
    const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

    /* Refs pour capture haute résolution (hidden, scale=1) */
    const r1rRef = useRef<HTMLDivElement>(null)
    const r1vRef = useRef<HTMLDivElement>(null)
    const r2vRef = useRef<HTMLDivElement>(null)
    const r2rRef = useRef<HTMLDivElement>(null)

    const showStatus = (type: 'success' | 'error', msg: string) => {
        setStatus({ type, msg })
        setTimeout(() => setStatus(null), 4000)
    }

    /* ─── Téléchargements ─── */

    const downloadPanelPng = async (key: DownloadKey, ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
        setDownloading(key)
        try {
            const url = await capturePng(ref)
            const a = document.createElement('a')
            a.download = filename
            a.href = url
            a.click()
            showStatus('success', `${filename} téléchargé`)
        } catch (e) {
            showStatus('error', getErrorMessage(e))
        } finally {
            setDownloading(null)
        }
    }

    /**
     * PDF A3 paysage = 420×297mm
     * Chaque panneau A4 = 210×297mm
     */
    const downloadA3Pdf = async (key: DownloadKey, leftRef: React.RefObject<HTMLDivElement | null>, rightRef: React.RefObject<HTMLDivElement | null>, filename: string) => {
        setDownloading(key)
        try {
            const [leftUrl, rightUrl] = await Promise.all([capturePng(leftRef), capturePng(rightRef)])
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
            pdf.addImage(leftUrl,  'PNG', 0,   0, 210, 297)
            pdf.addImage(rightUrl, 'PNG', 210, 0, 210, 297)
            pdf.save(filename)
            showStatus('success', `${filename} généré`)
        } catch (e) {
            showStatus('error', getErrorMessage(e))
        } finally {
            setDownloading(null)
        }
    }

    /**
     * PDF A4 portrait — 4 pages, un panneau par page
     */
    const downloadA4Pdf = async () => {
        setDownloading('pdf-a4')
        try {
            const refs = [r1rRef, r1vRef, r2vRef, r2rRef]
            const urls = await Promise.all(refs.map(r => capturePng(r)))
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
            urls.forEach((url, i) => {
                if (i > 0) pdf.addPage('a4', 'portrait')
                pdf.addImage(url, 'PNG', 0, 0, 210, 297)
            })
            pdf.save('depliant-rgb-a4-4pages.pdf')
            showStatus('success', 'PDF A4 généré (4 pages)')
        } catch (e) {
            showStatus('error', getErrorMessage(e))
        } finally {
            setDownloading(null)
        }
    }

    /* ─── Preview scale ─── */
    const PREVIEW_SCALE = 0.44  // 595 * 0.44 ≈ 262px de large

    const panels = [
        { key: 'p1r' as DownloadKey, label: 'Face 1 Recto', sub: 'Couverture', ref: r1rRef, Component: Panel1Recto },
        { key: 'p1v' as DownloadKey, label: 'Face 1 Verso', sub: 'Français', ref: r1vRef, Component: Panel1Verso },
        { key: 'p2v' as DownloadKey, label: 'Face 2 Verso', sub: 'English', ref: r2vRef, Component: Panel2Verso },
        { key: 'p2r' as DownloadKey, label: 'Face 2 Recto', sub: '4e de couverture', ref: r2rRef, Component: Panel2Recto },
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
                            <p className="text-gray-400 text-sm">2 volets · 4 panneaux · Format A3 paysage (420×297mm)</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Toast status */}
            {status && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`flex items-center gap-2 p-3 rounded-xl text-sm ${status.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                    {status.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                    {status.msg}
                </motion.div>
            )}

            {/* Grille aperçu 2×2 */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                {panels.map(({ key, label, sub, ref, Component }) => (
                    <div key={key} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 flex flex-col gap-4">
                        {/* Aperçu */}
                        <div className="overflow-hidden rounded-xl border border-white/[0.06] flex justify-center bg-black/20">
                            <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top center', marginBottom: -(BASE_H * (1 - PREVIEW_SCALE)) }}>
                                <Component scale={1} />
                            </div>
                        </div>
                        {/* Label */}
                        <div>
                            <p className="text-white font-bold text-sm">{label}</p>
                            <p className="text-gray-500 text-xs">{sub}</p>
                        </div>
                        {/* Bouton PNG */}
                        <button type="button"
                            onClick={() => downloadPanelPng(key, ref, `rgb-depliant-${key}.png`)}
                            disabled={downloading !== null}
                            className="flex items-center justify-center gap-2 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-gray-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-40 font-medium">
                            {downloading === key ? <Loader2 size={14} className="animate-spin" /> : <FileImage size={14} />}
                            Télécharger PNG
                        </button>
                    </div>
                ))}
            </motion.div>

            {/* Boutons PDF */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <Download size={15} className="text-[#C9A84C]" /> Export PDF
                </h2>
                <p className="text-gray-500 text-xs mb-5">
                    Générez les PDF prêts à l&apos;impression pour impression professionnelle.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* A3 — face extérieure */}
                    <button type="button"
                        onClick={() => downloadA3Pdf('pdf-outside', r2rRef, r1rRef, 'rgb-depliant-exterieur-a3.pdf')}
                        disabled={downloading !== null}
                        className="flex flex-col items-center gap-2 py-4 bg-[#C9A84C]/10 border border-[#C9A84C]/25 rounded-xl text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-all disabled:opacity-40">
                        {downloading === 'pdf-outside' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                        <span className="font-bold text-sm">PDF A3 — Extérieur</span>
                        <span className="text-xs opacity-70">Face 2 Recto + Face 1 Recto</span>
                    </button>

                    {/* A3 — face intérieure */}
                    <button type="button"
                        onClick={() => downloadA3Pdf('pdf-inside', r1vRef, r2vRef, 'rgb-depliant-interieur-a3.pdf')}
                        disabled={downloading !== null}
                        className="flex flex-col items-center gap-2 py-4 bg-[#C9A84C]/10 border border-[#C9A84C]/25 rounded-xl text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-all disabled:opacity-40">
                        {downloading === 'pdf-inside' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                        <span className="font-bold text-sm">PDF A3 — Intérieur</span>
                        <span className="text-xs opacity-70">Face 1 Verso + Face 2 Verso</span>
                    </button>

                    {/* A4 — 4 pages */}
                    <button type="button"
                        onClick={downloadA4Pdf}
                        disabled={downloading !== null}
                        className="flex flex-col items-center gap-2 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-gray-300 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
                        {downloading === 'pdf-a4' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                        <span className="font-bold text-sm">PDF A4 — 4 pages</span>
                        <span className="text-xs text-gray-500">Un panneau par page</span>
                    </button>
                </div>

                <div className="mt-5 flex items-start gap-2 text-xs text-gray-600">
                    <Info size={12} className="mt-0.5 flex-shrink-0 text-[#C9A84C]/50" />
                    <div>
                        <span className="text-[#C9A84C]/70 font-semibold">Impression professionnelle :</span>
                        {' '}Les PNG sont exportés à 300 DPI (pixelRatio 4×). Pour le PDF A3, donnez les 2 fichiers à votre imprimeur : extérieur et intérieur. Le pli se fait au centre de chaque A3 (en A4 portrait).
                    </div>
                </div>
            </motion.div>

            {/* Disposition du dépliant */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                <h2 className="text-sm font-bold text-white mb-4">Schéma de disposition</h2>
                <div className="grid grid-cols-2 gap-0.5 max-w-sm mx-auto text-[10px] text-center text-gray-500">
                    <div className="border border-[#C9A84C]/30 bg-[#C9A84C]/5 rounded-tl-lg p-3">
                        <div className="text-[#C9A84C] font-bold">Face 2 Recto</div>
                        <div>4e de couverture</div>
                        <div className="text-gray-600 mt-1">Dos / infos contact</div>
                    </div>
                    <div className="border border-[#C9A84C]/30 bg-[#C9A84C]/5 rounded-tr-lg p-3">
                        <div className="text-[#C9A84C] font-bold">Face 1 Recto</div>
                        <div>Couverture</div>
                        <div className="text-gray-600 mt-1">Front cover</div>
                    </div>
                    <div className="border border-white/10 bg-white/[0.02] rounded-bl-lg p-3">
                        <div className="text-white/70 font-bold">Face 1 Verso</div>
                        <div>Intérieur gauche</div>
                        <div className="text-gray-600 mt-1">Texte français</div>
                    </div>
                    <div className="border border-white/10 bg-white/[0.02] rounded-br-lg p-3">
                        <div className="text-white/70 font-bold">Face 2 Verso</div>
                        <div>Intérieur droit</div>
                        <div className="text-gray-600 mt-1">Texte anglais</div>
                    </div>
                    <div className="col-span-2 text-gray-600 text-[9px] mt-2">
                        ↑ Extérieur (fermé) &nbsp;·&nbsp; ↓ Intérieur (ouvert)
                    </div>
                </div>
            </motion.div>

            {/* Refs pour capture haute résolution — off-screen pour permettre le chargement des images */}
            <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }} aria-hidden>
                <Panel1Recto ref={r1rRef} scale={1} />
                <Panel1Verso ref={r1vRef} scale={1} />
                <Panel2Verso ref={r2vRef} scale={1} />
                <Panel2Recto ref={r2rRef} scale={1} />
            </div>
        </div>
    )
}
