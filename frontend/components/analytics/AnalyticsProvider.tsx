'use client'

import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { GoogleAnalytics } from '@next/third-parties/google'

/**
 * Analytics du site :
 *  - Vercel Web Analytics + Speed Insights : sans cookie, conformes RGPD →
 *    toujours actifs (mesure d'audience anonyme + Core Web Vitals).
 *  - Google Analytics 4 : chargé UNIQUEMENT si `NEXT_PUBLIC_GA_ID` est défini
 *    ET si l'utilisateur a accepté les cookies (bandeau CookieConsent →
 *    localStorage `rg_cookie_consent` = 'accepted'). Réactif au consentement.
 */
export default function AnalyticsProvider() {
    const gaId = process.env.NEXT_PUBLIC_GA_ID
    const [consented, setConsented] = useState(false)

    useEffect(() => {
        const check = () => setConsented(localStorage.getItem('rg_cookie_consent') === 'accepted')
        check()
        window.addEventListener('storage', check)
        // Le clic « Accepter » (même onglet) ne déclenche pas l'event storage :
        // on repasse régulièrement pour activer GA dès l'acceptation.
        const t = setInterval(check, 2500)
        return () => { window.removeEventListener('storage', check); clearInterval(t) }
    }, [])

    return (
        <>
            <Analytics />
            <SpeedInsights />
            {gaId && consented ? <GoogleAnalytics gaId={gaId} /> : null}
        </>
    )
}
