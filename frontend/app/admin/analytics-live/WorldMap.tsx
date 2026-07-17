'use client'

import { useEffect, useRef, useState, memo } from 'react'
import { motion } from 'framer-motion'

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
    x: number
    y: number
    title: string
    lines: string[]
}

function formatPage(page: string): string {
    if (page === '/' || page === '') return 'Accueil'
    return page.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function bubbleRadius(count: number, max: number): number {
    const r = 6 + 14 * Math.sqrt(count / Math.max(max, 1))
    return Math.min(r, 20)
}

const WorldMap = memo(function WorldMap({ sessions, countryPoints = [] }: {
    sessions: Session[]
    countryPoints?: CountryPoint[]
}) {
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const [tooltip, setTooltip] = useState<TooltipData | null>(null)
    const [leafletLoaded, setLeafletLoaded] = useState(false)

    // Chargement dynamique de Leaflet côté client
    useEffect(() => {
        if (typeof window === 'undefined') return

        // Injection du CSS de Leaflet si non présent
        if (!document.querySelector('link[href*="leaflet"]')) {
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
            document.head.appendChild(link)
        }

        setLeafletLoaded(true)
    }, [])

    useEffect(() => {
        if (!leafletLoaded || !mapContainerRef.current) return

        let map: any
        let markers: any[] = []
        let active = true

        const initMap = async () => {
            const L = (await import('leaflet')).default

            if (!active || !mapContainerRef.current) return

            // Nettoyage de l'instance précédente
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove()
                mapInstanceRef.current = null
            }

            // Initialisation de la carte
            map = L.map(mapContainerRef.current, {
                center: [20, 0],
                zoom: 1.5,
                minZoom: 1,
                maxZoom: 12,
                zoomControl: false,
                attributionControl: false
            })

            // Contrôle de zoom en bas à droite
            L.control.zoom({ position: 'bottomright' }).addTo(map)

            // Fond de carte sombre de CartoDB (très propre, moderne, montre les continents et pays)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
                maxZoom: 18
            }).addTo(map)

            mapInstanceRef.current = map

            const updateMarkers = () => {
                // Nettoyer les marqueurs
                markers.forEach(m => m.remove())
                markers = []

                const maxCount = countryPoints.reduce((m, p) => Math.max(m, p.count), 1)

                // 1. Marqueurs des pays (Bulle émeraude de trafic sur 24h)
                countryPoints.forEach(p => {
                    if (p.lat === undefined || p.lon === undefined || isNaN(p.lat) || isNaN(p.lon)) return

                    const r = bubbleRadius(p.count, maxCount)
                    
                    const icon = L.divIcon({
                        className: 'leaflet-country-bubble',
                        html: `
                            <div style="
                                width: ${r * 2}px;
                                height: ${r * 2}px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                position: relative;
                            ">
                                <div style="
                                    position: absolute;
                                    width: 100%;
                                    height: 100%;
                                    border-radius: 50%;
                                    background: rgba(16, 185, 129, 0.25);
                                    border: 1.5px solid rgba(52, 211, 153, 0.9);
                                "></div>
                                <div style="
                                    position: absolute;
                                    width: 5px;
                                    height: 5px;
                                    border-radius: 50%;
                                    background: #34d399;
                                "></div>
                                <span style="
                                    position: absolute;
                                    top: -${r + 14}px;
                                    font-size: 9.5px;
                                    color: #A7F3D0;
                                    font-weight: 800;
                                    font-family: monospace;
                                    white-space: nowrap;
                                    background: rgba(14, 27, 46, 0.85);
                                    padding: 1px 4px;
                                    border-radius: 4px;
                                    border: 1px solid rgba(52, 211, 153, 0.35);
                                    pointer-events: none;
                                ">${p.code} · ${p.count}</span>
                            </div>
                        `,
                        iconSize: [r * 2, r * 2],
                        iconAnchor: [r, r]
                    })

                    const marker = L.marker([p.lat, p.lon], { icon }).addTo(map)

                    marker.on('mouseover', (evt: any) => {
                        const containerRect = mapContainerRef.current?.getBoundingClientRect()
                        if (containerRect) {
                            const originalEvent = evt.originalEvent
                            setTooltip({
                                x: originalEvent.clientX - containerRect.left,
                                y: originalEvent.clientY - containerRect.top,
                                title: p.country,
                                lines: [`${p.count} visiteur${p.count > 1 ? 's' : ''} sur 24 h`]
                            })
                        }
                    })

                    marker.on('mouseout', () => {
                        setTooltip(null)
                    })

                    markers.push(marker)
                })

                // 2. Sessions actives temps réel (Points or pulsants)
                sessions.filter(s => s.latitude && s.longitude && !isNaN(s.latitude) && !isNaN(s.longitude)).forEach(s => {
                    const icon = L.divIcon({
                        className: 'leaflet-session-dot',
                        html: `
                            <div style="
                                width: 24px;
                                height: 24px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                position: relative;
                            ">
                                <div class="animate-ping" style="
                                    position: absolute;
                                    width: 16px;
                                    height: 16px;
                                    border-radius: 50%;
                                    background: rgba(226, 201, 126, 0.4);
                                    animation-duration: 2s;
                                "></div>
                                <div style="
                                    position: absolute;
                                    width: 8px;
                                    height: 8px;
                                    border-radius: 50%;
                                    background: #E2C97E;
                                    border: 1.5px solid #C9A84C;
                                    box-shadow: 0 0 6px rgba(226, 201, 126, 0.9);
                                "></div>
                            </div>
                        `,
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    })

                    const marker = L.marker([s.latitude, s.longitude], { icon }).addTo(map)

                    marker.on('mouseover', (evt: any) => {
                        const containerRect = mapContainerRef.current?.getBoundingClientRect()
                        if (containerRect) {
                            const originalEvent = evt.originalEvent
                            setTooltip({
                                x: originalEvent.clientX - containerRect.left,
                                y: originalEvent.clientY - containerRect.top,
                                title: s.city ? `${s.city}, ${s.country}` : (s.country || 'Localisation inconnue'),
                                lines: [
                                    'En ligne maintenant',
                                    `${s.browser || 'Navigateur inconnu'} — ${s.device_type || 'desktop'}`,
                                    `Page : ${formatPage(s.page)}`,
                                ]
                            })
                        }
                    })

                    marker.on('mouseout', () => {
                        setTooltip(null)
                    })

                    markers.push(marker)
                })
            }

            updateMarkers()

            // Observer de redimensionnement de carte
            const resizeObserver = new ResizeObserver(() => {
                map.invalidateSize()
            })
            resizeObserver.observe(mapContainerRef.current)

            return () => {
                resizeObserver.disconnect()
            }
        }

        let cleanupResize: (() => void) | undefined
        initMap().then((cleanup) => {
            cleanupResize = cleanup
        })

        return () => {
            active = false
            if (cleanupResize) cleanupResize()
            if (map) {
                map.remove()
                mapInstanceRef.current = null
            }
        }
    }, [leafletLoaded, sessions, countryPoints])

    return (
        <div className="relative w-full h-full overflow-hidden rounded-b-2xl bg-[#0E1B2E]" style={{ minHeight: 300 }}>
            {/* Conteneur Leaflet */}
            <div ref={mapContainerRef} className="w-full h-full z-0" />

            {/* Tooltip custom */}
            {tooltip && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ left: Math.min(tooltip.x + 14, typeof window !== 'undefined' ? window.innerWidth - 200 : 230), top: Math.max(tooltip.y - 56, 8) }}
                    className="absolute pointer-events-none bg-[#0E1B2E] border border-white/20 rounded-xl px-3.5 py-2.5 text-xs z-30 shadow-2xl min-w-[170px]"
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
            <div className="absolute bottom-3 left-4 flex items-center gap-4 text-[10px] text-gray-300 bg-[#0E1B2E]/90 rounded-lg px-3 py-1.5 border border-white/10 z-[1000] pointer-events-none">
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
            <div className="absolute bottom-3 right-12 text-[9px] text-gray-400 font-mono bg-[#0E1B2E]/90 rounded px-2 py-1 z-[1000] pointer-events-none">
                Utilisez le zoom +/- pour explorer
            </div>
        </div>
    )
})

export default WorldMap
