'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Person } from '@/lib/genealogy/types';
import { useTheme } from '@/lib/theme/ThemeContext';

/* ─── Types ─── */
interface GeoPoint {
  lat: number;
  lng: number;
  person: Person;
  type: 'birth' | 'death';
  label: string;
}

interface FamilyMapProps {
  persons: Person[];
}

/* ─── Geocoding cache ─── */
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

async function geocodePlace(place: string): Promise<{ lat: number; lng: number } | null> {
  if (geocodeCache.has(place)) return geocodeCache.get(place)!;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}&limit=1`,
      { headers: { 'User-Agent': 'RetourGagnant/1.0' } }
    );
    const data = await res.json();
    if (data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache.set(place, result);
      return result;
    }
  } catch {
    /* silent fail */
  }
  geocodeCache.set(place, null);
  return null;
}

/* ─── Role to generation color ─── */
function getGenerationColor(person: Person): string {
  const role = person.relation_role;
  if (person.is_self || role === 'self') return '#008751'; // green
  if (role === 'father' || role === 'mother') return '#3B82F6'; // blue
  if (role?.includes('grandfather') || role?.includes('grandmother')) return '#8B5CF6'; // purple
  if (role?.startsWith('paternal_gg') || role?.startsWith('maternal_gg')) return '#EC4899'; // pink
  if (role === 'child') return '#10B981'; // emerald
  if (role === 'brother' || role === 'sister' || role === 'sibling') return '#F59E0B'; // amber
  if (role?.includes('uncle') || role?.includes('aunt')) return '#6366F1'; // indigo
  return '#6B7280'; // gray
}

/* ─── Component ─── */
export default function FamilyMap({ persons }: FamilyMapProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  // Get all places to geocode
  const places = useMemo(() => {
    const result: { person: Person; place: string; type: 'birth' | 'death' }[] = [];
    for (const p of persons) {
      if (p.birth_place) result.push({ person: p, place: p.birth_place, type: 'birth' });
      if (p.death_place) result.push({ person: p, place: p.death_place, type: 'death' });
    }
    return result;
  }, [persons]);

  // Geocode all places
  useEffect(() => {
    if (places.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const results: GeoPoint[] = [];
      let done = 0;

      for (const entry of places) {
        if (cancelled) break;
        const geo = await geocodePlace(entry.place);
        done++;
        setProgress(Math.round((done / places.length) * 100));
        if (geo) {
          const name = `${entry.person.first_name || ''} ${entry.person.last_name || ''}`.trim();
          results.push({
            lat: geo.lat,
            lng: geo.lng,
            person: entry.person,
            type: entry.type,
            label: `${name}\n${entry.type === 'birth' ? '🎂 Naissance' : '✝ Décès'} — ${entry.place}`,
          });
        }
      }

      if (!cancelled) {
        setPoints(results);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [places]);

  // Init map
  useEffect(() => {
    if (loading || !mapRef.current) return;

    // Dynamic import of Leaflet (client only)
    (async () => {
      const L = (await import('leaflet')).default;

      // Inject Leaflet CSS via link tag (avoids TS module resolution issues)
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Clean previous
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapRef.current!, {
        zoomControl: true,
        attributionControl: true,
      });

      // Tile layer — dark/light
      const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

      L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 18,
      }).addTo(map);

      // Add markers
      if (points.length > 0) {
        const markers = points.map(pt => {
          const color = getGenerationColor(pt.person);
          const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
              width: 14px; height: 14px;
              background: ${color};
              border: 2.5px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            "></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });

          const name = `${pt.person.first_name || ''} ${pt.person.last_name || ''}`.trim();
          const marker = L.marker([pt.lat, pt.lng], { icon });
          marker.bindPopup(`
            <div style="font-family: Inter, sans-serif; font-size: 13px; line-height: 1.5;">
              <strong style="color: ${color};">${name || 'Inconnu'}</strong><br/>
              <span style="color: #666;">${pt.type === 'birth' ? '🎂 Naissance' : '✝ Décès'}</span><br/>
              <em>${pt.person[pt.type === 'birth' ? 'birth_place' : 'death_place']}</em>
              ${pt.person[pt.type === 'birth' ? 'birth_date' : 'death_date'] ? `<br/><small>${pt.person[pt.type === 'birth' ? 'birth_date' : 'death_date']}</small>` : ''}
            </div>
          `);
          return marker;
        });

        const group = L.featureGroup(markers);
        group.addTo(map);
        map.fitBounds(group.getBounds().pad(0.3));
      } else {
        // Default: center on Benin
        map.setView([9.3077, 2.3158], 7);
      }

      mapInstanceRef.current = map;
    })();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading, points, isDark]);

  // Legend data
  const legendItems = [
    { color: '#008751', label: 'Proposant (Self)' },
    { color: '#3B82F6', label: 'Parents' },
    { color: '#8B5CF6', label: 'Grands-parents' },
    { color: '#EC4899', label: 'Arrière-grands-parents' },
    { color: '#10B981', label: 'Enfants' },
    { color: '#F59E0B', label: 'Fratrie' },
  ];

  if (places.length === 0) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-3"
        style={{ color: 'var(--panel-text-muted)' }}
      >
        <div className="text-4xl">🗺️</div>
        <p className="text-sm font-medium">Aucun lieu renseigné</p>
        <p className="text-xs opacity-60">
          Ajoutez des lieux de naissance ou de décès aux membres pour visualiser la carte.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Loading overlay */}
      {loading && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-20"
          style={{
            background: isDark ? 'rgba(7,11,19,0.9)' : 'rgba(255,255,255,0.9)',
          }}
        >
          <div className="w-48 h-2 rounded-full overflow-hidden" style={{ background: isDark ? '#1e293b' : '#e2e8f0' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: '#008751' }}
            />
          </div>
          <p className="mt-3 text-xs font-medium" style={{ color: 'var(--panel-text-muted)' }}>
            Géolocalisation des lieux… {progress}%
          </p>
        </div>
      )}

      {/* Map */}
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: 400 }} />

      {/* Legend */}
      <div
        className="absolute bottom-4 left-4 z-10 rounded-xl px-3 py-2 shadow-lg backdrop-blur-md"
        style={{
          background: isDark ? 'rgba(7,11,19,0.85)' : 'rgba(255,255,255,0.9)',
          border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--panel-text-muted)' }}>
          Légende
        </p>
        {legendItems.map(item => (
          <div key={item.label} className="flex items-center gap-2 py-0.5">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: item.color, boxShadow: `0 0 4px ${item.color}40` }}
            />
            <span className="text-[10px]" style={{ color: 'var(--panel-text-muted)' }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Stats badge */}
      <div
        className="absolute top-4 right-4 z-10 rounded-xl px-3 py-2 shadow-lg"
        style={{
          background: isDark ? 'rgba(7,11,19,0.85)' : 'rgba(255,255,255,0.9)',
          border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
        }}
      >
        <p className="text-[10px] font-bold" style={{ color: 'var(--panel-text-muted)' }}>
          {points.length} lieu{points.length > 1 ? 'x' : ''} trouvé{points.length > 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
