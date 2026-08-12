'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// ══════════════════════════════════════════════════════════════
// VisitorTracker : OPTIMISÉ QUOTA EDGE (incident Vercel 75% du quota) :
//   AVANT : ping/page + heartbeat 30s REDÉMARRÉ à chaque navigation + unload
//   APRÈS : ping/page + UN SEUL heartbeat global 120s pour toute la session,
//           suspendu quand l'onglet est en arrière-plan (visibilitychange),
//           + sendBeacon au unload. Réduction ~4-8x des requêtes.
// ══════════════════════════════════════════════════════════════

const HEARTBEAT_MS = 120_000

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

function send(payload: object) {
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

export function VisitorTracker() {
    const pathname = usePathname()
    const scrollDepthRef = useRef(0)
    // Réfs partagées entre le ping par page et le heartbeat global
    const pathnameRef = useRef(pathname)
    const payloadRef = useRef<() => object>(() => ({}))

    // ── Effet PAR PAGE : 1 ping + suivi du scroll (aucun timer ici) ──
    useEffect(() => {
        if (pathname.startsWith('/admin') || pathname.startsWith('/agent')) return

        const { sid: sessionId, is_returning } = getSessionId()
        if (!sessionId) return

        pathnameRef.current = pathname
        scrollDepthRef.current = 0

        const onScroll = () => {
            const scrolled = window.scrollY + window.innerHeight
            const total = document.documentElement.scrollHeight
            if (total > 0) {
                const pct = Math.min(100, Math.round((scrolled / total) * 100))
                if (pct > scrollDepthRef.current) scrollDepthRef.current = pct
            }
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        onScroll()

        const clientSignals = getClientSignals(is_returning)
        const utmParams = new URLSearchParams(window.location.search)

        payloadRef.current = () => ({
            session_id: sessionId,
            page: pathnameRef.current,
            referrer: document.referrer || '',
            utm_source: utmParams.get('utm_source') || '',
            utm_medium: utmParams.get('utm_medium') || '',
            utm_campaign: utmParams.get('utm_campaign') || '',
            scroll_depth: scrollDepthRef.current,
            ...clientSignals,
        })

        // UN ping par page : pas de heartbeat par page
        send(payloadRef.current())

        return () => {
            window.removeEventListener('scroll', onScroll)
        }
    }, [pathname])

    // ── Effet SESSION (monté UNE fois) : heartbeat global 120s + pause
    //    arrière-plan + ping final au unload ──
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null

        const startBeat = () => {
            if (interval) return
            interval = setInterval(() => {
                // Ne rien envoyer depuis les panels internes
                if (pathnameRef.current.startsWith('/admin') || pathnameRef.current.startsWith('/agent')) return
                send(payloadRef.current())
            }, HEARTBEAT_MS)
        }
        const stopBeat = () => {
            if (interval) { clearInterval(interval); interval = null }
        }

        // Pause complète quand l'onglet est en arrière-plan (30-50% d'économie)
        const onVisibility = () => {
            if (document.hidden) stopBeat()
            else startBeat()
        }
        document.addEventListener('visibilitychange', onVisibility)
        if (!document.hidden) startBeat()

        // Ping final : capture le scroll_depth définitif (sendBeacon survit au unload)
        const onUnload = () => {
            if (pathnameRef.current.startsWith('/admin') || pathnameRef.current.startsWith('/agent')) return
            send(payloadRef.current())
        }
        window.addEventListener('pagehide', onUnload)

        return () => {
            stopBeat()
            document.removeEventListener('visibilitychange', onVisibility)
            window.removeEventListener('pagehide', onUnload)
        }
    }, [])

    return null
}
