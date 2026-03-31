'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// ── Session ID : persisté en sessionStorage (1 par onglet) ──
function getSessionId(): { sid: string; is_returning: boolean } {
    if (typeof window === 'undefined') return { sid: '', is_returning: false }

    let sid = sessionStorage.getItem('_rg_visitor_sid')
    let is_returning = false

    if (!sid) {
        sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
        sessionStorage.setItem('_rg_visitor_sid', sid)
        // Visiteur fidèle si déjà venu dans une session précédente (localStorage)
        is_returning = !!localStorage.getItem('_rg_ret')
        sessionStorage.setItem('_rg_is_ret', is_returning ? '1' : '0')
        localStorage.setItem('_rg_ret', Date.now().toString())
    } else {
        is_returning = sessionStorage.getItem('_rg_is_ret') === '1'
    }

    return { sid, is_returning }
}

// ── Signaux client collectés une fois par page ────────────────
type NavConn = { effectiveType?: string; type?: string; downlink?: number }

function getClientSignals(is_returning: boolean) {
    const screen_resolution = `${window.screen.width}x${window.screen.height}`
    const viewport_size = `${window.innerWidth}x${window.innerHeight}`
    const language = navigator.language || ''
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''

    // Network Information API (Chrome / Android)
    const conn = (navigator as unknown as { connection?: NavConn }).connection
    const connection_type = conn?.effectiveType || conn?.type || ''

    // Indices matériel (indicateurs de gamme d'appareil)
    const hardware_concurrency = navigator.hardwareConcurrency || 0
    const device_memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 0

    // Temps de chargement via Navigation Timing Level 2
    let page_load_ms = 0
    try {
        const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
        if (nav?.loadEventEnd > 0) {
            page_load_ms = Math.round(nav.loadEventEnd - nav.startTime)
        }
    } catch { /* API non disponible */ }

    return {
        screen_resolution, viewport_size,
        language, timezone, connection_type,
        hardware_concurrency, device_memory,
        is_returning, page_load_ms,
    }
}

export function VisitorTracker() {
    const pathname = usePathname()
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const scrollDepthRef = useRef(0)

    useEffect(() => {
        if (pathname.startsWith('/admin') || pathname.startsWith('/agent')) return

        const { sid: sessionId, is_returning } = getSessionId()
        if (!sessionId) return

        // Réinitialiser la profondeur de défilement à chaque changement de page
        scrollDepthRef.current = 0

        // Tracker le scroll max vu sur cette page
        const onScroll = () => {
            const scrolled = window.scrollY + window.innerHeight
            const total = document.documentElement.scrollHeight
            if (total > 0) {
                const pct = Math.min(100, Math.round((scrolled / total) * 100))
                if (pct > scrollDepthRef.current) scrollDepthRef.current = pct
            }
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        onScroll() // capture l'état initial (contenu visible sans scroll)

        const clientSignals = getClientSignals(is_returning)
        const utmParams = new URLSearchParams(window.location.search)

        const buildPayload = () => ({
            session_id: sessionId,
            page: pathname,
            referrer: document.referrer || '',
            utm_source: utmParams.get('utm_source') || '',
            utm_medium: utmParams.get('utm_medium') || '',
            utm_campaign: utmParams.get('utm_campaign') || '',
            scroll_depth: scrollDepthRef.current,
            ...clientSignals,
        })

        const send = (payload: object) => {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
            if (navigator.sendBeacon) {
                navigator.sendBeacon('/api/analytics/track', blob)
            } else {
                fetch('/api/analytics/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    keepalive: true,
                }).catch(() => {})
            }
        }

        // Premier ping immédiat
        send(buildPayload())

        // Heartbeat toutes les 30s (met à jour scroll_depth + last_seen_at)
        heartbeatRef.current = setInterval(() => send(buildPayload()), 30_000)

        // Ping final avant fermeture de page (capture le scroll_depth final)
        const onUnload = () => send(buildPayload())
        window.addEventListener('beforeunload', onUnload)

        return () => {
            if (heartbeatRef.current) clearInterval(heartbeatRef.current)
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('beforeunload', onUnload)
        }
    }, [pathname])

    return null
}
