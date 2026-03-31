'use client'

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

interface TooltipData {
    x: number; y: number
    city: string; country: string
    browser: string; page: string
    device_type: string
}

// Deduplique par coordonnées proches et groupe les visiteurs
function groupByLocation(sessions: Session[]): {
    lat: number; lon: number; count: number; sessions: Session[]
}[] {
    const groups: Map<string, { lat: number; lon: number; count: number; sessions: Session[] }> = new Map()
    for (const s of sessions) {
        if (!s.latitude && !s.longitude) continue
        // Arrondi à 1 degré pour grouper les visiteurs proches
        const key = `${Math.round(s.latitude)},${Math.round(s.longitude)}`
        const existing = groups.get(key)
        if (existing) {
            existing.count++
            existing.sessions.push(s)
        } else {
            groups.set(key, { lat: s.latitude, lon: s.longitude, count: 1, sessions: [s] })
        }
    }
    return Array.from(groups.values())
}

function formatPage(page: string): string {
    if (page === '/' || page === '') return 'Accueil'
    return page.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const DEVICE_EMOJI: Record<string, string> = { mobile: '📱', tablet: '📲', desktop: '🖥️' }

const WorldMap = memo(function WorldMap({ sessions }: { sessions: Session[] }) {
    const [tooltip, setTooltip] = useState<TooltipData | null>(null)
    const groups = groupByLocation(sessions)

    return (
        <div className="relative w-full h-full bg-[#050c18] overflow-hidden rounded-b-2xl">
            {/* Grille de fond */}
            <div className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: 'linear-gradient(rgba(129,140,248,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(129,140,248,0.4) 1px, transparent 1px)',
                    backgroundSize: '30px 30px'
                }}
            />

            <ComposableMap
                projection="geoNaturalEarth1"
                style={{ width: '100%', height: '100%' }}
                projectionConfig={{ scale: 130 }}
            >
                <ZoomableGroup center={[20, 15]} zoom={1} minZoom={1} maxZoom={8}>
                    {/* Pays */}
                    <Geographies geography={GEO_URL}>
                        {({ geographies }) =>
                            geographies.map(geo => (
                                <Geography
                                    key={geo.rsmKey}
                                    geography={geo}
                                    style={{
                                        default: { fill: '#0d1f35', stroke: '#1e3a5f', strokeWidth: 0.5, outline: 'none' },
                                        hover: { fill: '#152840', stroke: '#2563eb', strokeWidth: 0.7, outline: 'none' },
                                        pressed: { fill: '#1e3a5f', outline: 'none' },
                                    }}
                                />
                            ))
                        }
                    </Geographies>

                    {/* Markers visiteurs */}
                    {groups.map((g, i) => (
                        <Marker
                            key={i}
                            coordinates={[g.lon, g.lat]}
                            onMouseEnter={(evt) => {
                                const s = g.sessions[0]
                                const rect = (evt.target as SVGElement).closest('svg')?.getBoundingClientRect()
                                setTooltip({
                                    x: evt.clientX - (rect?.left ?? 0),
                                    y: evt.clientY - (rect?.top ?? 0),
                                    city: s.city || s.country || 'Inconnu',
                                    country: s.country || '',
                                    browser: s.browser || '',
                                    page: formatPage(s.page),
                                    device_type: s.device_type || 'desktop',
                                })
                            }}
                            onMouseLeave={() => setTooltip(null)}
                        >
                            {/* Pulse externe */}
                            <circle
                                r={g.count > 3 ? 12 : g.count > 1 ? 9 : 7}
                                fill="rgba(34, 197, 94, 0.08)"
                                className="animate-ping"
                                style={{ transformOrigin: 'center', animationDuration: '2s' }}
                            />
                            {/* Point central */}
                            <circle
                                r={g.count > 3 ? 6 : g.count > 1 ? 5 : 4}
                                fill="#22c55e"
                                stroke="rgba(34,197,94,0.4)"
                                strokeWidth={2}
                                style={{ cursor: 'pointer', filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.8))' }}
                            />
                            {/* Badge count si > 1 */}
                            {g.count > 1 && (
                                <text
                                    textAnchor="middle"
                                    y={-10}
                                    style={{ fontSize: 9, fill: '#86efac', fontWeight: 700, fontFamily: 'monospace' }}
                                >
                                    {g.count}
                                </text>
                            )}
                        </Marker>
                    ))}
                </ZoomableGroup>
            </ComposableMap>

            {/* Tooltip */}
            {tooltip && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ left: Math.min(tooltip.x + 12, 220), top: Math.max(tooltip.y - 60, 8) }}
                    className="absolute pointer-events-none bg-[#0a1929] border border-white/15 rounded-xl px-3 py-2 text-xs z-20 shadow-2xl min-w-[160px]"
                >
                    <p className="text-white font-bold">{tooltip.city}</p>
                    {tooltip.country !== tooltip.city && (
                        <p className="text-gray-500 text-[10px]">{tooltip.country}</p>
                    )}
                    <div className="border-t border-white/10 mt-1.5 pt-1.5 space-y-0.5">
                        <p className="text-gray-400 text-[10px]">{DEVICE_EMOJI[tooltip.device_type]} {tooltip.browser}</p>
                        <p className="text-purple-400 text-[10px]">📄 {tooltip.page}</p>
                    </div>
                </motion.div>
            )}

            {/* Légende */}
            <div className="absolute bottom-3 left-4 flex items-center gap-2 text-[10px] text-gray-600">
                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
                Visiteur actif
            </div>

            {/* Info zoom */}
            <div className="absolute bottom-3 right-4 text-[9px] text-gray-700 font-mono">
                Molette pour zoomer
            </div>
        </div>
    )
})

export default WorldMap
