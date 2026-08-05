'use client'

import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export interface SitePoint {
    ville: string
    count: number
    lat: number
    lng: number
    min?: number
    devise?: string
}

const money = (n: number, d = 'XOF') => `${Math.round(n).toLocaleString('fr-FR')} ${d === 'XOF' ? 'FCFA' : d}`

/**
 * Carte des sites du programme. On utilise `CircleMarker` (SVG) plutôt que les
 * marqueurs image de Leaflet : aucun asset d'icône à charger, aucun bug de
 * chemin. Tuiles Carto (autorisées par la CSP).
 */
export default function SitesMap({ points, onSelect }: { points: SitePoint[]; onSelect?: (ville: string) => void }) {
    const valid = points.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number')
    const center: [number, number] = valid.length
        ? [valid.reduce((s, p) => s + p.lat, 0) / valid.length, valid.reduce((s, p) => s + p.lng, 0) / valid.length]
        : [9.3, 2.3] // Bénin
    const max = Math.max(1, ...valid.map(p => p.count))

    return (
        <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.3)]">
            <MapContainer center={center} zoom={7} scrollWheelZoom={false} style={{ height: 380, width: '100%', background: '#F7F9F8' }}>
                <TileLayer
                    attribution='&copy; OpenStreetMap &copy; CARTO'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
                {valid.map(p => {
                    const r = 9 + 14 * Math.sqrt(p.count / max)
                    return (
                        <CircleMarker
                            key={p.ville}
                            center={[p.lat, p.lng]}
                            radius={r}
                            pathOptions={{ color: '#00643C', fillColor: '#008751', fillOpacity: 0.55, weight: 2 }}
                            eventHandlers={{ click: () => onSelect?.(p.ville) }}
                        >
                            <Tooltip direction="top" offset={[0, -4]}>
                                <div style={{ fontWeight: 800 }}>{p.ville}</div>
                                <div style={{ fontSize: 11 }}>{p.count} logement{p.count > 1 ? 's' : ''}{p.min ? ` · dès ${money(p.min, p.devise)}` : ''}</div>
                            </Tooltip>
                        </CircleMarker>
                    )
                })}
            </MapContainer>
        </div>
    )
}
