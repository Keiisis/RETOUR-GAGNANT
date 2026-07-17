import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ═══════════════════════════════════════════════════════
// GET /api/analytics/live — Données live + stats 24h enrichies
// ═══════════════════════════════════════════════════════
export async function GET() {
    try {
        const now = Date.now()
        const since5min  = new Date(now -  5 * 60 * 1000).toISOString()
        const since30min = new Date(now - 30 * 60 * 1000).toISOString()
        const since24h   = new Date(now - 24 * 60 * 60 * 1000).toISOString()

        // ── Sessions actives (30 dernières minutes) ──────────────
        const { data: liveSessions } = await supabase
            .from('visitor_sessions')
            .select('*')
            .gte('last_seen_at', since30min)
            .order('last_seen_at', { ascending: false })
            .limit(300)

        // ── En ligne maintenant (5 dernières minutes) ────────────
        const activeNow = new Set(
            (liveSessions || [])
                .filter(s => s.last_seen_at >= since5min)
                .map(s => s.session_id)
        ).size

        // ── Toutes les rows 24h (select * pour les nouvelles colonnes) ──
        const { data: all24h } = await supabase
            .from('visitor_sessions')
            .select('*')
            .gte('created_at', since24h)
            .limit(100000)

        const rows = all24h || []

        // ── Visiteurs uniques (1 session = 1 visiteur) ───────────
        // On garde le premier enregistrement de chaque session
        const sessionMap = new Map<string, typeof rows[0]>()
        for (const r of rows) {
            if (!sessionMap.has(r.session_id)) sessionMap.set(r.session_id, r)
        }
        const uniqueSessions = Array.from(sessionMap.values())

        // ── Top pages ────────────────────────────────────────────
        const pageCounts: Record<string, number> = {}
        for (const r of rows) pageCounts[r.page] = (pageCounts[r.page] || 0) + 1
        const topPages = Object.entries(pageCounts)
            .sort(([, a], [, b]) => b - a).slice(0, 10)
            .map(([page, count]) => ({ page, count }))

        // ── Top pays ─────────────────────────────────────────────
        const countryMap: Record<string, { count: number; code: string }> = {}
        for (const r of rows) {
            const c = r.country || 'Inconnu'
            if (!countryMap[c]) countryMap[c] = { count: 0, code: r.country_code || 'XX' }
            countryMap[c].count++
        }
        const topCountries = Object.entries(countryMap)
            .sort(([, a], [, b]) => b.count - a.count).slice(0, 10)
            .map(([country, { count, code }]) => ({ country, count, code }))

        // ── Points pays pour la carte monde (visiteurs uniques 24h,
        //    position = centre moyen des sessions géolocalisées) ────
        const ptsMap: Record<string, { code: string; count: number; latSum: number; lonSum: number; nGeo: number }> = {}
        for (const r of uniqueSessions) {
            const c = r.country || 'Inconnu'
            if (!ptsMap[c]) ptsMap[c] = { code: r.country_code || 'XX', count: 0, latSum: 0, lonSum: 0, nGeo: 0 }
            ptsMap[c].count++
            if (r.latitude && r.longitude) {
                ptsMap[c].latSum += Number(r.latitude)
                ptsMap[c].lonSum += Number(r.longitude)
                ptsMap[c].nGeo++
            }
        }
        const countryPoints = Object.entries(ptsMap)
            .filter(([, v]) => v.nGeo > 0)
            .map(([country, v]) => ({
                country, code: v.code, count: v.count,
                lat: v.latSum / v.nGeo, lon: v.lonSum / v.nGeo,
            }))
            .sort((a, b) => b.count - a.count)

        // ── Appareils ────────────────────────────────────────────
        const deviceCounts: Record<string, number> = {}
        for (const r of rows) deviceCounts[r.device_type] = (deviceCounts[r.device_type] || 0) + 1

        // ── Navigateurs ──────────────────────────────────────────
        const browserCounts: Record<string, number> = {}
        for (const r of rows) browserCounts[r.browser] = (browserCounts[r.browser] || 0) + 1

        // ── Graphique horaire (24 dernières heures) ───────────────
        const hourly: Record<string, number> = {}
        for (let h = 0; h < 24; h++) {
            hourly[new Date(now - h * 3600000).toISOString().slice(0, 13)] = 0
        }
        for (const r of rows) {
            const h = r.created_at?.slice(0, 13)
            if (h && hourly[h] !== undefined) hourly[h]++
        }
        const hourlyChart = Object.entries(hourly)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([hour, count]) => ({ hour: hour.slice(11) + 'h', count }))

        // ── Top FAI / Opérateurs ──────────────────────────────────
        const ispCounts: Record<string, number> = {}
        for (const r of rows) {
            const isp = r.isp?.trim()
            if (isp) ispCounts[isp] = (ispCounts[isp] || 0) + 1
        }
        const topIsp = Object.entries(ispCounts)
            .sort(([, a], [, b]) => b - a).slice(0, 8)
            .map(([isp, count]) => ({ isp, count }))

        // ── Langues navigateur ────────────────────────────────────
        const langCounts: Record<string, number> = {}
        for (const r of uniqueSessions) {
            const lang = r.language?.split('-')[0]?.toUpperCase()
            if (lang) langCounts[lang] = (langCounts[lang] || 0) + 1
        }
        const topLanguages = Object.entries(langCounts)
            .sort(([, a], [, b]) => b - a).slice(0, 8)
            .map(([language, count]) => ({ language, count }))

        // ── Type de connexion (4g, wifi, 3g…) ────────────────────
        const connCounts: Record<string, number> = {}
        for (const r of uniqueSessions) {
            const c = r.connection_type?.trim()
            if (c) connCounts[c] = (connCounts[c] || 0) + 1
        }

        // ── Résolutions écran ─────────────────────────────────────
        const screenCounts: Record<string, number> = {}
        for (const r of uniqueSessions) {
            const s = r.screen_resolution?.trim()
            if (s) screenCounts[s] = (screenCounts[s] || 0) + 1
        }
        const topScreens = Object.entries(screenCounts)
            .sort(([, a], [, b]) => b - a).slice(0, 6)
            .map(([resolution, count]) => ({ resolution, count }))

        // ── Fidélité : visiteurs de retour vs nouveaux ────────────
        const returningCount = uniqueSessions.filter(s => s.is_returning === true).length
        const newCount = uniqueSessions.length - returningCount

        // ── Sécurité : VPN / Proxy / Tor ─────────────────────────
        const vpnCount   = uniqueSessions.filter(s => s.is_vpn   === true).length
        const proxyCount = uniqueSessions.filter(s => s.is_proxy === true).length
        const torCount   = uniqueSessions.filter(s => s.is_tor   === true).length

        // ── Profondeur de défilement (scroll depth) ───────────────
        const scrollRows = rows.filter(r => (r.scroll_depth || 0) > 0)
        const avgScrollDepth = scrollRows.length > 0
            ? Math.round(scrollRows.reduce((a, r) => a + (r.scroll_depth || 0), 0) / scrollRows.length)
            : 0

        // ── Temps de chargement moyen ─────────────────────────────
        const loadRows = rows.filter(r => (r.page_load_ms || 0) > 100 && (r.page_load_ms || 0) < 30000)
        const avgPageLoadMs = loadRows.length > 0
            ? Math.round(loadRows.reduce((a, r) => a + (r.page_load_ms || 0), 0) / loadRows.length)
            : 0

        return NextResponse.json({
            live: liveSessions || [],
            stats: {
                active_now:           activeNow,
                unique_visitors_24h:  uniqueSessions.length,
                page_views_24h:       rows.length,
                countries_24h:        Object.keys(countryMap).length,
            },
            top_pages:       topPages,
            top_countries:   topCountries,
            country_points:  countryPoints,
            device_stats:    deviceCounts,
            browser_stats:   browserCounts,
            hourly_chart:    hourlyChart,
            // Nouvelles métriques enrichies
            top_isp:         topIsp,
            top_languages:   topLanguages,
            connection_stats: connCounts,
            top_screens:     topScreens,
            returning_stats: { returning: returningCount, new_visitors: newCount },
            security_stats:  { vpn: vpnCount, proxy: proxyCount, tor: torCount },
            avg_scroll_depth:  avgScrollDepth,
            avg_page_load_ms:  avgPageLoadMs,
        })
    } catch (err) {
        console.error('[analytics/live GET]', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
