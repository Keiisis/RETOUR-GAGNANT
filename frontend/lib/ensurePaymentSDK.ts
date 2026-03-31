/**
 * Chargement dynamique des SDK de paiement (Kkiapay, FedaPay, Stripe)
 * Utilisé quand le modal de paiement est ouvert depuis une page
 * qui ne charge pas les SDK via boutique/layout.tsx
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = () => window as any

/** Charge un script dans le DOM et attend son exécution. */
function loadScript(src: string, timeout = 15000): Promise<void> {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
        if (existing) {
            // Le tag existe — on résout immédiatement, waitForGlobal prendra le relai
            resolve()
            return
        }
        const s = document.createElement('script')
        s.src = src
        s.async = true

        let settled = false
        const settle = (fn: () => void) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            fn()
        }

        const timer = setTimeout(() => settle(() => reject(new Error(`Timeout chargement SDK: ${src}`))), timeout)
        s.onload = () => settle(resolve)
        s.onerror = () => settle(() => reject(new Error(`Échec chargement SDK: ${src}`)))
        document.head.appendChild(s)
    })
}

/** Poll jusqu'à ce qu'un global window[name] soit défini. */
function waitForGlobal(name: string, timeout = 12000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (win()[name]) { resolve(); return }
        const check = setInterval(() => {
            if (win()[name]) { clearInterval(check); clearTimeout(timer); resolve() }
        }, 100)
        const timer = setTimeout(() => {
            clearInterval(check)
            reject(new Error(`SDK ${name} non disponible après ${timeout}ms`))
        }, timeout)
    })
}

/** Retire le script tag existant pour forcer un rechargement propre. */
function removeScript(hostname: string) {
    const el = document.querySelector(`script[src*="${hostname}"]`)
    if (el) el.remove()
}

// ── Kkiapay ──────────────────────────────────────────────────────────────────

const KKIAPAY_URL = 'https://cdn.kkiapay.me/k.js'
const KKIAPAY_HOST = 'cdn.kkiapay.me'

/** Charge le SDK Kkiapay si pas déjà disponible.
 *  Stratégie robuste : attend d'abord que le global apparaisse (pour le cas
 *  où le <Script> de layout est déjà en train de charger), puis force un
 *  rechargement complet si rien n'est visible après 8 s. */
export async function ensureKkiapaySDK(): Promise<void> {
    if (typeof win().openKkiapayWidget === 'function') return

    // 1ère tentative — le script est peut-être déjà en train de charger
    //   (ajouté par boutique/layout.tsx strategy="afterInteractive")
    const existing = document.querySelector(`script[src*="${KKIAPAY_HOST}"]`)
    if (existing) {
        try {
            await waitForGlobal('openKkiapayWidget', 8000)
            return
        } catch {
            // Script en DOM mais global jamais apparu → retirer et recharger
            removeScript(KKIAPAY_HOST)
        }
    }

    // 2ème tentative — charger une copie fraîche
    await loadScript(KKIAPAY_URL, 15000)
    await waitForGlobal('openKkiapayWidget', 12000)
}

// ── FedaPay ──────────────────────────────────────────────────────────────────

const FEDAPAY_URL = 'https://cdn.fedapay.com/checkout.js?v=1.1.7'
const FEDAPAY_HOST = 'cdn.fedapay.com'

export async function ensureFedaPaySDK(): Promise<void> {
    if (win().FedaPay) return

    const existing = document.querySelector(`script[src*="${FEDAPAY_HOST}"]`)
    if (existing) {
        try {
            await waitForGlobal('FedaPay', 8000)
            return
        } catch {
            removeScript(FEDAPAY_HOST)
        }
    }

    await loadScript(FEDAPAY_URL, 15000)
    await waitForGlobal('FedaPay', 12000)
}

// ── Stripe ────────────────────────────────────────────────────────────────────

const STRIPE_URL = 'https://js.stripe.com/v3/'
const STRIPE_HOST = 'js.stripe.com'

export async function ensureStripeSDK(): Promise<void> {
    if (win().Stripe) return

    const existing = document.querySelector(`script[src*="${STRIPE_HOST}"]`)
    if (existing) {
        try {
            await waitForGlobal('Stripe', 8000)
            return
        } catch {
            removeScript(STRIPE_HOST)
        }
    }

    await loadScript(STRIPE_URL, 15000)
    await waitForGlobal('Stripe', 12000)
}
