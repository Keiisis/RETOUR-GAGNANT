'use client'

// ══════════════════════════════════════════════════════════════
//  PRÉSENCE MONDIALE — carte temps réel lisible
//  Deux couches de données réelles :
//   • Bulles émeraude = visiteurs uniques par pays (24 h), taille
//     proportionnelle au trafic, libellé code pays + compteur
//   • Points or pulsants = sessions en ligne maintenant
//  Fond open-source : world-atlas (Natural Earth) via react-simple-maps
// ══════════════════════════════════════════════════════════════

import { useState, memo } from 'react'
import {
    ComposableMap,
    Geographies,
    Geography,
    Marker,
    ZoomableGroup,
} from 'react-simple-maps'
import { motion } from 'framer-motion'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

interface Session {
    session_id: string
    city: string
    country: string
    country_code: string
    latitude: number
    longitude: number
    browser: string
    device_type: string
    page: string
    last_seen_at: string
}

export interface CountryPoint {
    country: string
    code: string
    count: number
    lat: number
    lon: number
}

interface TooltipData {
    x: number; y: number
    title: string
    lines: string[]
}

function formatPage(page: string): string {
    if (page === '/' || page === '') return 'Accueil'
    return page.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Rayon proportionnel au trafic (racine carrée pour rester lisible)
function bubbleRadius(count: number, max: number): number {
    const r = 6 + 14 * Math.sqrt(count / Math.max(max, 1))
    return Math.min(r, 20)
}

const WorldMap = memo(function WorldMap({ sessions, countryPoints = [] }: {
    sessions: Session[]
    countryPoints?: CountryPoint[]
}) {
    const [tooltip, setTooltip] = useState<TooltipData | null>(null)
    const maxCount = countryPoints.reduce((m, p) => Math.max(m, p.count), 1)

    const showTooltip = (evt: React.MouseEvent, title: string, lines: string[]) => {
        const rect = (evt.target as SVGElement).closest('svg')?.getBoundingClientRect()
        setTooltip({
            x: evt.clientX - (rect?.left ?? 0),
            y: evt.clientY - (rect?.top ?? 0),
            title, lines,
        })
    }

    return (
        <div className="relative w-full h-full overflow-hidden rounded-b-2xl" style={{ background: 'linear-gradient(180deg, #0E1B2E 0%, #12233B 100%)' }}>
            <ComposableMap
                projection="geoNaturalEarth1"
                style={{ width: '100%', height: '100%' }}
                projectionConfig={{ scale: 130 }}
            >
                <ZoomableGroup center={[10, 12]} zoom={1.15} minZoom={1} maxZoom={8}>
                    {/* Pays — contraste net, lisible */}
                    <Geographies geography={GEO_URL}>
                        {({ geographies }) =>
                            geographies.map(geo => (
                                <Geography
                                    key={geo.rsmKey}
                                    geography={geo}
                                    style={{
                                        default: { fill: '#2A3F5C', stroke: '#4C6485', strokeWidth: 0.6, outline: 'none' },
                                        hover: { fill: '#35507A', stroke: '#6B87AD', strokeWidth: 0.8, outline: 'none' },
                                        pressed: { fill: '#35507A', outline: 'none' },
                                    }}
                                />
                            ))
                        }
                    </Geographies>

                    {/* Couche 1 — visiteurs par pays (24 h) */}
                    {countryPoints.map((p) => {
                        const r = bubbleRadius(p.count, maxCount)
                        return (
                            <Marker
                                key={`c-${p.code}-${p.country}`}
                                coordinates={[p.lon, p.lat]}
                                onMouseEnter={(evt) => showTooltip(evt, p.country,
                                    [`${p.count} visiteur${p.count > 1 ? 's' : ''} sur 24 h`])}
                                onMouseLeave={() => setTooltip(null)}
                            >
                                <circle r={r} fill="rgba(16,185,129,0.22)" stroke="rgba(52,211,153,0.85)" strokeWidth={1.5} style={{ cursor: 'pointer' }} />
                                <circle r={2.5} fill="#34D399" />
                                <text textAnchor="middle" y={-r - 4}
                                    style={{ fontSize: 9.5, fill: '#A7F3D0', fontWeight: 800, fontFamily: 'monospace', pointerEvents: 'none' }}>
                                    {p.code} · {p.count}
                                </text>
                            </Marker>
                        )
                    })}

                    {/* Couche 2 — en ligne maintenant (or, pulsant) */}
                    {sessions.filter(s => s.latitude && s.longitude).map((s) => (
                        <Marker
                            key={`l-${s.session_id}`}
                            coordinates={[s.longitude, s.latitude]}
                            onMouseEnter={(evt) => showTooltip(evt,
                                s.city ? `${s.city}, ${s.country}` : (s.country || 'Localisation inconnue'),
                                [
                                    'En ligne maintenant',
                                    `${s.browser || 'Navigateur inconnu'} — ${s.device_type || 'desktop'}`,
                                    `Page : ${formatPage(s.page)}`,
                                ])}
                            onMouseLeave={() => setTooltip(null)}
                        >
                            <circle r={9} fill="rgba(201,168,76,0.15)" className="animate-ping"
                                style={{ transformOrigin: 'center', animationDuration: '2s' }} />
                            <circle r={4} fill="#E2C97E" stroke="#C9A84C" strokeWidth={1.5}
                                style={{ cursor: 'pointer', filter: 'drop-shadow(0 0 5px rgba(226,201,126,0.9))' }} />
                        </Marker>
                    ))}
                </ZoomableGroup>
            </ComposableMap>

            {/* Tooltip */}
            {tooltip && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ left: Math.min(tooltip.x + 14, 230), top: Math.max(tooltip.y - 56, 8) }}
                    className="absolute pointer-events-none bg-[#0E1B2E] border border-white/20 rounded-xl px-3.5 py-2.5 text-xs z-20 shadow-2xl min-w-[170px]"
                >
                    <p className="text-white font-bold">{tooltip.title}</p>
                    <div className="border-t border-white/10 mt-1.5 pt-1.5 space-y-0.5">
                        {tooltip.lines.map((l, i) => (
                            <p key={i} className="text-gray-300 text-[10.5px]">{l}</p>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Légende */}
            <div className="absolute bottom-3 left-4 flex items-center gap-4 text-[10px] text-gray-300 bg-[#0E1B2E]/80 rounded-lg px-3 py-1.5 border border-white/10">
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full border border-emerald-300/80 bg-emerald-400/25" />
                    Visiteurs 24 h (par pays)
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#E2C97E] shadow-[0_0_6px_rgba(226,201,126,0.9)]" />
                    En ligne maintenant
                </span>
            </div>

            {/* Info zoom */}
            <div className="absolute bottom-3 right-4 text-[9px] text-gray-400 font-mono bg-[#0E1B2E]/80 rounded px-2 py-1">
                Molette pour zoomer
            </div>
        </div>
    )
})

export default WorldMap
