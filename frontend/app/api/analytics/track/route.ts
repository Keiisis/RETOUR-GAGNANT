import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardPublic, TELEMETRY_LIMIT } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Cache géolocalisation IP (évite les appels répétés) ──
const geoCache = new Map<string, { data: GeoData | null; ts: number }>()
const GEO_CACHE_TTL = 3_600_000 // 1 heure

interface GeoData {
    country: string;     country_code: string
    city: string;        region: string
    latitude: number;    longitude: number
    continent: string;   continent_code: string
    isp: string;         timezone: string
    is_vpn: boolean;     is_proxy: boolean;  is_tor: boolean
}

async function getGeoFromIP(ip: string): Promise<GeoData | null> {
    // IPs locales → simuler Cotonou pour les tests dev
    const isLocal = !ip || ip === '127.0.0.1' || ip === '::1'
        || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')
    if (isLocal) {
        return {
            country: 'Bénin', country_code: 'BJ', city: 'Cotonou', region: 'Littoral',
            latitude: 6.36, longitude: 2.42,
            continent: 'Afrique', continent_code: 'AF',
            isp: 'Réseau local', timezone: 'Africa/Porto-Novo',
            is_vpn: false, is_proxy: false, is_tor: false,
        }
    }

    const cached = geoCache.get(ip)
    if (cached && Date.now() - cached.ts < GEO_CACHE_TTL) return cached.data

    // ── Provider 1 : ipwho.is (HTTPS, données enrichies : ISP, sécurité, continent) ──
    try {
        const res = await fetch(`https://ipwho.is/${ip}`, { signal: AbortSignal.timeout(5000) })
        if (res.ok) {
            const j = await res.json()
            if (j.success === true) {
                const geo: GeoData = {
                    country:        j.country        || 'Inconnu',
                    country_code:   j.country_code   || 'XX',
                    city:           j.city           || '',
                    region:         j.region         || '',
                    latitude:       j.latitude       || 0,
                    longitude:      j.longitude      || 0,
                    continent:      j.continent      || '',
                    continent_code: j.continent_code || '',
                    isp:            j.connection?.isp || j.connection?.org || '',
                    timezone:       j.timezone?.id   || '',
                    is_vpn:         j.security?.vpn   === true,
                    is_proxy:       j.security?.proxy === true,
                    is_tor:         j.security?.tor   === true,
                }
                geoCache.set(ip, { data: geo, ts: Date.now() })
                return geo
            }
        }
    } catch { /* ipwho.is indisponible → fallback */ }

    // ── Provider 2 : ip-api.com (HTTP fallback, inclut isp) ────────────────────────
    try {
        const res = await fetch(
            `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,regionName,lat,lon,isp,org`,
            { signal: AbortSignal.timeout(3000) }
        )
        if (res.ok) {
            const j = await res.json()
            if (j.status === 'success') {
                const geo: GeoData = {
                    country:        j.country     || 'Inconnu',
                    country_code:   j.countryCode || 'XX',
                    city:           j.city        || '',
                    region:         j.regionName  || '',
                    latitude:       j.lat         || 0,
                    longitude:      j.lon         || 0,
                    continent: '', continent_code: '',
                    isp:            j.isp || j.org || '',
                    timezone:       '',
                    is_vpn: false, is_proxy: false, is_tor: false,
                }
                geoCache.set(ip, { data: geo, ts: Date.now() })
                return geo
            }
        }
    } catch { /* ip-api.com indisponible → geo null */ }

    geoCache.set(ip, { data: null, ts: Date.now() })
    return null
}

function parseUserAgent(ua: string): { browser: string; browser_version: string; os: string; device_type: string } {
    const browser =
        /Edg\//i.test(ua)           ? 'Edge'
        : /OPR\//i.test(ua)         ? 'Opera'
        : /Firefox\//i.test(ua)     ? 'Firefox'
        : /SamsungBrowser/i.test(ua)? 'Samsung'
        : /Chrome\//i.test(ua)      ? 'Chrome'
        : /Safari\//i.test(ua)      ? 'Safari'
        : /MSIE|Trident/i.test(ua)  ? 'IE'
        : 'Autre'

    const vMatch = ua.match(
        browser === 'Chrome'   ? /Chrome\/([\d.]+)/
        : browser === 'Firefox'? /Firefox\/([\d.]+)/
        : browser === 'Safari' ? /Version\/([\d.]+)/
        : browser === 'Edge'   ? /Edg\/([\d.]+)/
        : browser === 'Opera'  ? /OPR\/([\d.]+)/
        : browser === 'Samsung'? /SamsungBrowser\/([\d.]+)/
        : /rv:([\d.]+)/
    )
    const browser_version = vMatch ? vMatch[1].split('.').slice(0, 2).join('.') : ''

    const os =
        /Windows NT 10/i.test(ua) ? 'Windows 10/11'
        : /Windows/i.test(ua)     ? 'Windows'
        : /iPhone/i.test(ua)      ? 'iOS (iPhone)'
        : /iPad/i.test(ua)        ? 'iOS (iPad)'
        : /Android/i.test(ua)     ? 'Android'
        : /Mac OS X/i.test(ua)    ? 'macOS'
        : /Linux/i.test(ua)       ? 'Linux'
        : 'Autre'

    const device_type =
        /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ? 'mobile'
        : /iPad|Tablet|tablet/i.test(ua) ? 'tablet'
        : 'desktop'

    return { browser, browser_version, os, device_type }
}

function getRealIP(req: NextRequest): string {
    return (
        req.headers.get('cf-connecting-ip')
        || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')
        || '127.0.0.1'
    )
}

// ═══════════════════════════════════════════════════════
// POST /api/analytics/track — Enregistrer une visite
// ═══════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
    const trop = guardPublic(req, 'analytics/track', TELEMETRY_LIMIT)
    if (trop) return trop

    try {
        const body = await req.json()
        const {
            session_id, page, referrer,
            utm_source, utm_medium, utm_campaign,
            // Signaux client (VisitorTracker)
            screen_resolution, viewport_size,
            language, timezone: clientTimezone,
            connection_type, hardware_concurrency, device_memory,
            is_returning, page_load_ms, scroll_depth,
        } = body

        if (!session_id?.trim()) return NextResponse.json({ ok: false }, { status: 400 })

        const ip = getRealIP(req)
        const ua = req.headers.get('user-agent') || ''
        const { browser, browser_version, os, device_type } = parseUserAgent(ua)
        const geo = await getGeoFromIP(ip)
        const now = new Date().toISOString()

        // ── Payload complet (schéma migré) ──────────────────────────
        const fullPayload = {
            session_id,
            ip,
            country:        geo?.country        ?? 'Inconnu',
            country_code:   geo?.country_code   ?? 'XX',
            city:           geo?.city           ?? '',
            region:         geo?.region         ?? '',
            latitude:       geo?.latitude       ?? 0,
            longitude:      geo?.longitude      ?? 0,
            continent:      geo?.continent      ?? '',
            continent_code: geo?.continent_code ?? '',
            isp:            geo?.isp            ?? '',
            timezone:       geo?.timezone || clientTimezone || '',
            is_vpn:         geo?.is_vpn         ?? false,
            is_proxy:       geo?.is_proxy       ?? false,
            is_tor:         geo?.is_tor         ?? false,
            device_type, browser, browser_version, os,
            page:           page     || '/',
            referrer:       referrer || '',
            utm_source:     utm_source  || '',
            utm_medium:     utm_medium  || '',
            utm_campaign:   utm_campaign || '',
            screen_resolution:    screen_resolution    || '',
            viewport_size:        viewport_size        || '',
            language:             language             || '',
            connection_type:      connection_type      || '',
            hardware_concurrency: hardware_concurrency || 0,
            device_memory:        device_memory        || 0,
            is_returning:         is_returning         || false,
            page_load_ms:         page_load_ms         || 0,
            scroll_depth:         scroll_depth         || 0,
            last_seen_at:         now,
        }

        const { error } = await supabase
            .from('visitor_sessions')
            .upsert(fullPayload, { onConflict: 'session_id,page' })

        if (error) {
            // Fallback : schéma original (table pas encore migrée)
            const { error: err2 } = await supabase
                .from('visitor_sessions')
                .upsert({
                    session_id, ip,
                    country:      fullPayload.country,
                    country_code: fullPayload.country_code,
                    city:         fullPayload.city,
                    region:       fullPayload.region,
                    latitude:     fullPayload.latitude,
                    longitude:    fullPayload.longitude,
                    device_type, browser, browser_version, os,
                    page:         fullPayload.page,
                    referrer:     fullPayload.referrer,
                    utm_source:   fullPayload.utm_source,
                    utm_medium:   fullPayload.utm_medium,
                    utm_campaign: fullPayload.utm_campaign,
                    last_seen_at: now,
                }, { onConflict: 'session_id,page' })
            if (err2) throw err2
        }

        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error('[analytics/track POST]', err)
        return NextResponse.json({ ok: false }, { status: 500 })
    }
}
