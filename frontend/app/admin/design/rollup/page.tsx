'use client'

import { useState, useRef } from 'react'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import { CreditCard, Download, FileImage, Plus, Trash as Trash2, CheckCircle, WarningCircle as AlertCircle, CircleNotch as Loader2, Eye, BookOpen, CaretRight as ChevronRight } from '@phosphor-icons/react';
import Link from 'next/link'
import { RollUp, type RollUpData } from '@/components/roll-up/RollUp'

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

async function preloadImages(root: HTMLElement): Promise<void> {
    const imgs = Array.from(root.querySelectorAll('img'))
    await Promise.all(imgs.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve()
        return new Promise<void>((resolve) => {
            img.onload = () => resolve()
            img.onerror = () => resolve() // On resout meme si echec pour ne pas bloquer
        })
    }))
    if ('fonts' in document) {
        try { await document.fonts.ready } catch { /* no-op */ }
    }
}

async function captureRollUp(ref: React.RefObject<HTMLDivElement | null>, pixelRatio = 3): Promise<string> {
    if (!ref.current) throw new Error('Élément non trouvé')
    await preloadImages(ref.current)
    await new Promise(r => setTimeout(r, 300))
    // Rendu DOM 850x2000 (base), pixelRatio=3 -> image finale 2550x6000px (qualite print 150 DPI minimum)
    return toPng(ref.current, {
        pixelRatio,
        cacheBust: true,
        skipFonts: false,
        imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    })
}

async function downloadPNG(ref: React.RefObject<HTMLDivElement | null>, filename: string) {
    const dataUrl = await captureRollUp(ref, 3) // 3x pixel ratio
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    link.click()
}

async function downloadPDF(
    ref: React.RefObject<HTMLDivElement | null>,
    name: string
) {
    // 3x pixel ratio gives good print quality while preventing memory crashes
    const dataUrl = await captureRollUp(ref, 3) 

    // Création du PDF au format exact (85cm x 200cm)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'cm', format: [85, 200] })
    
    // Ajout de l'image (prend tout l'espace 85x200)
    pdf.addImage(dataUrl, 'PNG', 0, 0, 85, 200, undefined, 'FAST')
    
    pdf.save(`Roll-Up-${name.toLowerCase().replace(/\s+/g, '-')}.pdf`)
}

function getErrorMessage(e: unknown): string {
    if (!e) return 'Erreur inconnue'
    if (e instanceof Error) return e.message
    // Cas specifique : html-to-image reject avec l'event onerror d'une image cassee
    if (typeof Event !== 'undefined' && e instanceof Event) {
        const target = e.target as HTMLImageElement | null
        const src = target?.src || target?.currentSrc
        return src
            ? `Image inaccessible : ${src.split('/').pop()} (verifiez que le fichier existe dans public/)`
            : `Erreur de chargement de ressource (${e.type})`
    }
    if (typeof e === 'object' && e !== null && 'message' in e) {
        return String((e as { message: unknown }).message)
    }
    return String(e)
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function RollUpPage() {
    const [data, setData] = useState<RollUpData>({
        phone1: '+229 01 60 32 21 21',
        phone2: '+229 01 94 35 50 50',
        email: 'contact@retourgagnantbenin.bj',
        website: 'www.retourgagnantbenin.bj',
        address: 'Haie-Vive Cocotiers, Carré N°1158, Cotonou - BÉNIN',
    })

    const [downloading, setDownloading] = useState<string | null>(null)
    const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

    const rollUpRef = useRef<HTMLDivElement>(null)

    const set = (k: keyof RollUpData) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setData(p => ({ ...p, [k]: e.target.value }))

    const handleDownload = async (type: 'png' | 'pdf') => {
        setDownloading(type)
        setStatus(null)
        try {
            if (type === 'png') await downloadPNG(rollUpRef, 'Roll-Up-RGB.png')
            else if (type === 'pdf') await downloadPDF(rollUpRef, 'RGB')
            setStatus({ type: 'success', msg: `Téléchargement ${type.toUpperCase()} réussi.` })
        } catch (e) {
            setStatus({ type: 'error', msg: `Erreur export : ${getErrorMessage(e)}` })
        } finally {
            setDownloading(null)
        }
    }

    return (
        <div className="space-y-8 pb-20">
            {/* ── Navigation sous-sections ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link href="/admin/design"
                    className="group relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-[#C9A84C]/30 hover:bg-[#C9A84C]/5 p-5 flex items-center gap-4 transition-all">
                    <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] group-hover:bg-[#C9A84C]/15 group-hover:border-[#C9A84C]/25 flex items-center justify-center flex-shrink-0 transition-all">
                        <CreditCard size={20} className="text-gray-500 group-hover:text-[#C9A84C] transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-gray-300 font-bold text-sm group-hover:text-white transition-colors">Cartes de Visite</p>
                        <p className="text-gray-600 text-xs">Format 85×55mm — Recto / Verso</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-600 group-hover:text-[#C9A84C] transition-colors" />
                </Link>
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
                <div className="relative overflow-hidden rounded-2xl bg-[#C9A84C]/8 border-2 border-[#C9A84C]/30 p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-[#C9A84C]/20 border border-[#C9A84C]/30 flex items-center justify-center flex-shrink-0">
                        <FileImage size={20} className="text-[#C9A84C]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm">Roll-Ups</p>
                        <p className="text-gray-500 text-xs">85×200cm — Haute Définition</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-[#C9A84C]" />
                </div>
            </div>

            {/* ── Header ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#C9A84C]/15 via-[#0f141e] to-[#071525]/80 border border-white/10 p-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A84C]/5 rounded-full blur-[80px]" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-[#C9A84C]/15 border border-[#C9A84C]/30 flex items-center justify-center">
                            <FileImage size={22} className="text-[#C9A84C]" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">Générateur de Roll-Up</h1>
                            <p className="text-gray-400 text-sm">Format Impression 85x200cm, 150 DPI min, avec marge de sécurité</p>
                        </div>
                    </div>
                </div>
            </div>

            {status && (
                <div className={`p-4 rounded-xl flex gap-3 text-sm font-medium ${
                    status.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'
                }`}>
                    {status.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                    {status.msg}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_500px] gap-8 items-start">
                {/* ── COLONNE GAUCHE : FORMULAIRE ── */}
                <div className="space-y-6">
                    <div className="p-6 rounded-2xl bg-[#0f141e] border border-white/5 space-y-5">
                        <h2 className="text-sm font-bold text-[#C9A84C] uppercase tracking-wider mb-2">Informations de contact</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs text-gray-400 ml-1">Téléphone 1</label>
                                <input value={data.phone1} onChange={set('phone1')} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50 transition-colors" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-400 ml-1">Téléphone 2</label>
                                <input value={data.phone2} onChange={set('phone2')} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50 transition-colors" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-gray-400 ml-1">Email</label>
                            <input value={data.email} onChange={set('email')} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50 transition-colors" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-gray-400 ml-1">Site Web (Aussi généré en QR Code)</label>
                            <input value={data.website} onChange={set('website')} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50 transition-colors" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-gray-400 ml-1">Adresse Complète</label>
                            <input value={data.address} onChange={set('address')} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50 transition-colors" />
                        </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-[#0f141e] border border-white/5 space-y-4">
                        <h2 className="text-sm font-bold text-[#C9A84C] uppercase tracking-wider mb-2">Exportation Haute Qualité</h2>
                        
                        <div className="p-4 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-xl text-sm text-gray-300">
                            <strong>Note :</strong> La zone imprimable en bas tient compte des 3 à 5 cm d'enroulement dans le mécanisme du Roll-Up.
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handleDownload('png')}
                                disabled={downloading !== null}
                                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all"
                            >
                                {downloading === 'png' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                Télécharger PNG
                            </button>

                            <button
                                onClick={() => handleDownload('pdf')}
                                disabled={downloading !== null}
                                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-[#C9A84C] hover:bg-[#B08D3A] text-[#1A1A2E] font-bold transition-all"
                            >
                                {downloading === 'pdf' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                Exporter PDF (HD)
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── COLONNE DROITE : PREVIEW ── */}
                <div className="flex flex-col items-center gap-4">
                    <div className="text-gray-400 text-sm flex items-center gap-2">
                        <Eye size={16} /> Aperçu (Échelle 15%)
                    </div>
                    {/* Conteneur caché pour le rendu HD */}
                    <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                        <RollUp ref={rollUpRef} data={data} scale={1} />
                    </div>

                    {/* Aperçu visible */}
                    <div className="shadow-2xl rounded-lg overflow-hidden border-4 border-gray-800" style={{ transformOrigin: 'top center' }}>
                        {/* On affiche le composant à une échelle de 0.15 (15%) pour l'interface */}
                        <div style={{ width: 850 * 0.42, height: 2000 * 0.42, transform: 'scale(0.35)', transformOrigin: 'top left' }}>
                            <RollUp data={data} scale={1} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
