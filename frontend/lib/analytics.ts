import { track } from '@vercel/analytics'

type Props = Record<string, string | number | boolean | null | undefined>

// Envoie un évènement de conversion à Vercel Analytics ET à GA4 (si présent).
// À appeler dans les handlers de succès (soumission de formulaire, achat…).
export function trackEvent(name: string, props?: Props) {
    try { track(name, props as Record<string, string | number | boolean | null>) } catch { /* noop */ }
    try {
        const w = window as unknown as { gtag?: (...a: unknown[]) => void }
        if (typeof w.gtag === 'function') w.gtag('event', name, props || {})
    } catch { /* noop */ }
}
