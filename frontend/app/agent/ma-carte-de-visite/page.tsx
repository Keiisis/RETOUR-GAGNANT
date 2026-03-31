'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import { CreditCard, Download, FileImage, Loader2, RotateCcw, Info } from 'lucide-react'
import { CardRecto, CardVerso, type CardData } from '@/components/business-card/BusinessCard'

export default function MaCarteDeVisite() {
    const [card, setCard] = useState<CardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'recto' | 'verso'>('recto')
    const [flipping, setFlipping] = useState(false)
    const [downloading, setDownloading] = useState<string | null>(null)

    const rectoRef = useRef<HTMLDivElement>(null)
    const versoRef = useRef<HTMLDivElement>(null)

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

    const downloadPNG = async (side: 'recto' | 'verso') => {
        const ref = side === 'recto' ? rectoRef : versoRef
        if (!ref.current || !card) return
        setDownloading(side + '-png')
        try {
            await new Promise(r => setTimeout(r, 300))
            const dataUrl = await toPng(ref.current, { pixelRatio: 4, cacheBust: true })
            const link = document.createElement('a')
            link.download = `ma-carte-${side}-${card.prenom}-${card.nom}.png`
            link.href = dataUrl
            link.click()
        } finally {
            setDownloading(null)
        }
    }

    const downloadPDF = async () => {
        if (!rectoRef.current || !versoRef.current || !card) return
        setDownloading('pdf')
        try {
            await new Promise(r => setTimeout(r, 300))
            const [rectoUrl, versoUrl] = await Promise.all([
                toPng(rectoRef.current, { pixelRatio: 4, cacheBust: true }),
                toPng(versoRef.current, { pixelRatio: 4, cacheBust: true }),
            ])
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85, 55] })
            pdf.addImage(rectoUrl, 'PNG', 0, 0, 85, 55)
            pdf.addPage([85, 55], 'landscape')
            pdf.addImage(versoUrl, 'PNG', 0, 0, 85, 55)
            pdf.save(`ma-carte-de-visite-${card.prenom}-${card.nom}.pdf`)
        } finally {
            setDownloading(null)
        }
    }

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
                    <span className="text-[#C9A84C] text-xs font-bold uppercase tracking-wider">Ma Carte de Visite</span>
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">{card.prenom} {card.nom}</h1>
                <p className="text-gray-400 text-sm">{card.position}</p>
            </motion.div>

            {/* Carte interactive */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col items-center gap-5"
            >
                {/* Toggle recto/verso */}
                <div className="flex rounded-xl overflow-hidden border border-white/10 bg-white/[0.02]">
                    <button type="button" onClick={() => setView('recto')}
                        className={`px-5 py-2.5 text-sm font-bold transition-colors ${view === 'recto' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-500 hover:text-gray-300'}`}>
                        RECTO
                    </button>
                    <button type="button" onClick={() => setView('verso')}
                        className={`px-5 py-2.5 text-sm font-bold transition-colors ${view === 'verso' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-500 hover:text-gray-300'}`}>
                        VERSO
                    </button>
                </div>

                {/* Carte avec effet flip */}
                <div
                    className="cursor-pointer select-none"
                    onClick={flip}
                    title="Cliquez pour retourner la carte"
                >
                    <motion.div
                        animate={{ opacity: flipping ? 0 : 1, scaleX: flipping ? 0.1 : 1 }}
                        transition={{ duration: 0.2 }}
                        style={{ transformOrigin: 'center' }}
                    >
                        <div style={{ transform: 'scale(0.9)', transformOrigin: 'top center' }}>
                            {view === 'recto' ? <CardRecto data={card} /> : <CardVerso data={card} />}
                        </div>
                    </motion.div>
                </div>

                {/* Hint flip */}
                <p className="text-gray-600 text-xs flex items-center gap-1">
                    <RotateCcw size={11} /> Cliquez sur la carte pour la retourner
                </p>
            </motion.div>

            {/* Boutons de téléchargement */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6"
            >
                <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Download size={15} className="text-[#C9A84C]" /> Télécharger ma carte
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button type="button" onClick={() => downloadPNG('recto')} disabled={downloading !== null}
                        className="flex items-center justify-center gap-2 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-gray-300 hover:text-white hover:border-white/20 transition-all disabled:opacity-40 font-medium">
                        {downloading === 'recto-png' ? <Loader2 size={15} className="animate-spin" /> : <FileImage size={15} />}
                        Recto — PNG
                    </button>
                    <button type="button" onClick={() => downloadPNG('verso')} disabled={downloading !== null}
                        className="flex items-center justify-center gap-2 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-gray-300 hover:text-white hover:border-white/20 transition-all disabled:opacity-40 font-medium">
                        {downloading === 'verso-png' ? <Loader2 size={15} className="animate-spin" /> : <FileImage size={15} />}
                        Verso — PNG
                    </button>
                    <button type="button" onClick={downloadPDF} disabled={downloading !== null}
                        className="flex items-center justify-center gap-2 py-3 bg-[#C9A84C]/15 border border-[#C9A84C]/30 rounded-xl text-sm text-[#C9A84C] hover:bg-[#C9A84C]/25 transition-all disabled:opacity-40 font-bold">
                        {downloading === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                        PDF Recto+Verso
                    </button>
                </div>

                <div className="mt-4 flex items-start gap-2 text-xs text-gray-600">
                    <Info size={12} className="mt-0.5 flex-shrink-0 text-[#C9A84C]/50" />
                    <p>Les fichiers PNG sont exportés en haute résolution (300 DPI) pour une impression professionnelle. Le PDF contient les deux faces sur deux pages A6 paysage (85×55mm).</p>
                </div>
            </motion.div>

            {/* Full-size refs for download — off-screen to allow image loading */}
            <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }} aria-hidden>
                <CardRecto ref={rectoRef} data={card} scale={1} />
                <CardVerso ref={versoRef} data={card} scale={1} />
            </div>
        </div>
    )
}
