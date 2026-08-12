'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, CircleNotch as Loader2, ArrowClockwise as RefreshCw, ArrowLeft, Eye, ArrowsOut as Maximize2, ArrowsIn as Minimize2, Clock } from '@phosphor-icons/react';
import Link from 'next/link'
import { generatePlexiglasHorairesSVG, downloadPlexiglasHorairesSVG } from '@/lib/svg-plexiglas-horaires-generator'

/* ═══════════════════════════════════════════════════════
   Styles CSS-in-JS pour le rendu 3D réaliste plexiglas
   ═══════════════════════════════════════════════════════ */

const WALL_BG = `
  radial-gradient(ellipse at 50% 30%, #d4cfc6 0%, #b8b0a4 40%, #8a8074 100%)
`

const mockupContainerStyle: React.CSSProperties = {
    perspective: '1800px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '50px 30px',
    background: WALL_BG,
    minHeight: '700px',
    position: 'relative',
    overflow: 'hidden',
}

const wallOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: `url("data:image/svg+xml,%3Csvg width='6' height='6' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='6' height='6' fill='%23a09888' opacity='0.08'/%3E%3Crect x='0' y='0' width='3' height='3' fill='%23b0a898' opacity='0.06'/%3E%3C/svg%3E")`,
    pointerEvents: 'none',
}

const panelWrapperStyle: React.CSSProperties = {
    position: 'relative',
    transformStyle: 'preserve-3d',
    transform: 'rotateY(-2deg) rotateX(1deg)',
    transition: 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
}

const wallShadowStyle: React.CSSProperties = {
    position: 'absolute',
    inset: '15px -5px -20px -5px',
    background: 'rgba(0,0,0,0.35)',
    borderRadius: '8px',
    filter: 'blur(25px)',
    transform: 'translateZ(-30px) scaleY(1.02)',
    zIndex: 0,
}

const edgeStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    border: '3px solid rgba(255,255,255,0.25)',
    borderRadius: '4px',
    boxShadow: `
        inset 0 0 0 1px rgba(255,255,255,0.15),
        0 0 1px rgba(0,0,0,0.3),
        4px 4px 0 rgba(0,0,0,0.08),
        6px 6px 0 rgba(0,0,0,0.05),
        8px 8px 0 rgba(0,0,0,0.03)
    `,
    pointerEvents: 'none',
    zIndex: 3,
}

const glossStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: `
        linear-gradient(
            135deg,
            rgba(255,255,255,0.35) 0%,
            rgba(255,255,255,0.12) 20%,
            rgba(255,255,255,0) 45%,
            rgba(255,255,255,0) 55%,
            rgba(255,255,255,0.05) 75%,
            rgba(255,255,255,0.15) 100%
        )
    `,
    pointerEvents: 'none',
    zIndex: 4,
}

const spotlightStyle: React.CSSProperties = {
    position: 'absolute',
    top: '5%',
    left: '15%',
    width: '50%',
    height: '25%',
    background: 'radial-gradient(ellipse, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 70%)',
    pointerEvents: 'none',
    zIndex: 5,
    borderRadius: '50%',
}

const edgeGlintStyle: React.CSSProperties = {
    position: 'absolute',
    top: '8%',
    left: 0,
    width: '2px',
    height: '60%',
    background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 30%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.2) 80%, rgba(255,255,255,0) 100%)',
    pointerEvents: 'none',
    zIndex: 6,
}

export default function PlexiglasHorairesPage() {
    const [svgContent, setSvgContent] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [downloading, setDownloading] = useState(false)
    const [fullscreen, setFullscreen] = useState(false)
    const [hovered, setHovered] = useState(false)

    const loadPreview = useCallback(async () => {
        setLoading(true)
        try {
            const svg = await generatePlexiglasHorairesSVG()
            setSvgContent(svg)
        } catch (e) {
            console.error('[Plexiglas-Horaires] Erreur preview:', e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadPreview() }, [loadPreview])

    const handleDownload = async () => {
        setDownloading(true)
        try { await downloadPlexiglasHorairesSVG() } finally { setDownloading(false) }
    }

    const panelDynStyle: React.CSSProperties = {
        ...panelWrapperStyle,
        transform: hovered
            ? 'rotateY(0deg) rotateX(0deg) scale(1.02)'
            : 'rotateY(-2deg) rotateX(1deg)',
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 flex-wrap">
                <Link href="/admin/design"
                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#C9A84C]/10 hover:border-[#C9A84C]/30 transition-all">
                    <ArrowLeft size={18} className="text-gray-400" />
                </Link>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Clock size={20} className="text-[#C9A84C]" />
                        Plexiglas Horaires &amp; Jours d&apos;ouverture
                    </h1>
                    <p className="text-sm text-gray-500">80cm &times; 120cm &mdash; R.G.B / O.H.T / A.C.S.T &mdash; SVG vectoriel</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={loadPreview} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all text-sm font-medium disabled:opacity-50">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Rafra&icirc;chir
                    </button>
                    <button onClick={() => setFullscreen(!fullscreen)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all text-sm font-medium">
                        {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        {fullscreen ? 'Réduire' : 'Plein écran'}
                    </button>
                    <button onClick={handleDownload} disabled={downloading || loading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A84C] text-[#1A1A2E] font-bold text-sm hover:bg-[#d4b35c] transition-all disabled:opacity-50 shadow-lg shadow-[#C9A84C]/20">
                        {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        T&eacute;l&eacute;charger SVG
                    </button>
                </div>
            </div>

            {/* Infos techniques */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Dimensions', value: '80 × 120 cm', sub: '800 × 1200 mm' },
                    { label: 'Contenu', value: '3 Entités + Horaires', sub: 'R.G.B / O.H.T / A.C.S.T' },
                    { label: 'Découpe', value: 'Contour bleu marine', sub: 'CNC / Laser' },
                    { label: 'Forme', value: 'Rectangle + Arche', sub: 'Rayon 400mm' },
                ].map(info => (
                    <div key={info.label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{info.label}</p>
                        <p className="text-white font-bold text-sm mt-1">{info.value}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{info.sub}</p>
                    </div>
                ))}
            </div>

            {/* Horaires résumé */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <div>
                        <p className="text-white font-bold text-sm">Lundi : Vendredi</p>
                        <p className="text-gray-400 text-xs">08h00à 17h30</p>
                    </div>
                </div>
                <div className="rounded-xl bg-[#C9A84C]/5 border border-[#C9A84C]/20 p-4 flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#C9A84C]" />
                    <div>
                        <p className="text-white font-bold text-sm">Samedi</p>
                        <p className="text-gray-400 text-xs">08h00à 13h00 (sur RDV)</p>
                    </div>
                </div>
                <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4 flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div>
                        <p className="text-white font-bold text-sm">Dimanche</p>
                        <p className="text-gray-400 text-xs">Fermé</p>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════
               PREVIEW 3D RÉALISTE
               ═══════════════════════════════════════ */}
            <div className={`relative rounded-2xl border border-white/10 overflow-hidden transition-all ${
                fullscreen ? 'fixed inset-4 z-50' : ''
            }`}>
                {/* Label flottant */}
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
                    <Eye size={14} className="text-[#C9A84C]" />
                    <span className="text-xs text-gray-300 font-medium">Rendu 3D &mdash; Plexiglas Horaires</span>
                </div>

                {fullscreen && (
                    <button onClick={() => setFullscreen(false)}
                        className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-gray-300 hover:text-white transition-colors">
                        <Minimize2 size={18} />
                    </button>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-4" style={{ background: WALL_BG }}>
                        <Loader2 size={32} className="animate-spin text-[#C9A84C]" />
                        <p className="text-gray-600 text-sm font-medium">Génération du mockup plexiglas horaires...</p>
                    </div>
                ) : (
                    <div style={mockupContainerStyle} className={fullscreen ? 'min-h-screen' : ''}>
                        {/* Texture mur */}
                        <div style={wallOverlayStyle} />

                        {/* Panneau 3D */}
                        <div
                            style={panelDynStyle}
                            onMouseEnter={() => setHovered(true)}
                            onMouseLeave={() => setHovered(false)}
                        >
                            {/* Ombre murale */}
                            <div style={wallShadowStyle} />

                            {/* SVG du plexiglas */}
                            <div
                                style={{
                                    position: 'relative',
                                    zIndex: 2,
                                    maxWidth: fullscreen ? '450px' : '360px',
                                    width: '100%',
                                }}
                                dangerouslySetInnerHTML={{ __html: svgContent }}
                            />

                            {/* Épaisseur 3D */}
                            <div style={edgeStyle} />

                            {/* Reflet glossy */}
                            <div style={glossStyle} />

                            {/* Spot lumineux */}
                            <div style={spotlightStyle} />

                            {/* Reflet arête gauche */}
                            <div style={edgeGlintStyle} />
                        </div>
                    </div>
                )}
            </div>

            {/* Notes production */}
            <div className="rounded-xl bg-[#C9A84C]/5 border border-[#C9A84C]/20 p-4">
                <p className="text-[#C9A84C] font-bold text-sm mb-2"> Notes pour l&apos;imprimeur</p>
                <ul className="text-gray-400 text-xs space-y-1 list-disc list-inside">
                    <li>Le <strong className="text-white">contour bleu marine extérieur</strong> est le trait de découpe CNC/laser</li>
                    <li>Contient les <strong className="text-white">3 entités</strong> : R.G.B, O.H.T et A.C.S.T avec noms complets</li>
                    <li>Horaires <strong className="text-white">Lun-Ven 8h-17h30</strong> / <strong className="text-white">Samedi 8h-13h sur RDV</strong> / <strong className="text-white">Dimanche Fermé</strong></li>
                    <li>Tous les textes sont en <strong className="text-white">vectoriel pur</strong> &mdash; éditables dans Illustrator</li>
                    <li>Dimensions exactes : <strong className="text-white">800mm &times; 1200mm</strong> (1 unité SVG = 1mm)</li>
                    <li>Police : <strong className="text-white">Montserrat</strong> (Google Fonts)</li>
                </ul>
            </div>
        </div>
    )
}
