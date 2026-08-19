// ══════════════════════════════════════════════════════════════
//  Ouverture du widget Kkiapay — point d'entrée UNIQUE.
//
//  Chaque page ouvrait le widget à sa façon et n'écoutait que « succès » et
//  « échec ». Quand le client refermait la fenêtre sans payer, RIEN ne se
//  passait : le bouton restait en « paiement en cours », la commande créée
//  juste avant restait `pending`, et le client repartait sans savoir si son
//  argent avait bougé. C'est le pire état possible — l'incertitude.
//
//  Le SDK émet pourtant `PAYMENT_ABORTED` à la fermeture, et détruit son
//  élément `<kkiapay-widget>` du DOM. On écoute les deux : le signal officiel,
//  et la disparition de l'élément en filet de sécurité (versions anciennes du
//  SDK, fermeture par la touche Échap, clic hors du cadre).
//
//  Garantie : exactement UN des trois retours est appelé, une seule fois.
// ══════════════════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */

/* Les pages déclarent déjà `openKkiapayWidget` sur Window de façon stricte :
   on ne redéclare rien, on lit la fenêtre au travers d'un type local. */
type FenetreKkiapay = {
    openKkiapayWidget?: (config: any) => void
    addKkiapayListener?: (evenement: string, rappel: (donnees: any) => void) => void
    removeKkiapayListener?: (evenement: string) => void
}

export interface ConfigKkiapay {
    amount: number
    key: string
    sandbox?: boolean
    position?: string
    phone?: string
    email?: string
    name?: string
    data?: string
    [k: string]: unknown
}

export interface RetoursKkiapay {
    /** Transaction confirmée par le widget — À VÉRIFIER CÔTÉ SERVEUR ensuite. */
    onSucces: (transactionId: string) => void
    /** La passerelle a refusé (solde, carte, délai). */
    onEchec?: (motif?: string) => void
    /** Le client a fermé sans payer. Rien n'a été débité. */
    onAnnule?: () => void
}

/** Délai laissé à un événement officiel avant de conclure à un abandon. */
const GRACE_MS = 400

let observateur: MutationObserver | null = null
let minuteur: ReturnType<typeof setTimeout> | null = null

function nettoyer() {
    observateur?.disconnect()
    observateur = null
    if (minuteur) { clearTimeout(minuteur); minuteur = null }
}

/** Le widget est-il encore à l'écran ? */
function widgetPresent(): boolean {
    return typeof document !== 'undefined' && !!document.querySelector('kkiapay-widget')
}

/**
 * Ouvre le widget et garantit un retour, quoi que fasse le client.
 *
 * Renvoie `false` si le SDK n'est pas encore chargé — l'appelant doit alors
 * afficher un message plutôt que de laisser un bouton sans effet.
 */
export function ouvrirKkiapay(config: ConfigKkiapay, retours: RetoursKkiapay): boolean {
    if (typeof window === 'undefined') return false
    const w = window as unknown as FenetreKkiapay
    if (typeof w.openKkiapayWidget !== 'function') return false

    let termine = false
    const conclure = (action: () => void) => {
        if (termine) return
        termine = true
        nettoyer()
        action()
    }

    // ── Signaux officiels du SDK ────────────────────────────────
    // `addKkiapayListener` ÉCRASE le rappel précédent pour un événement donné :
    // passer par ce module garantit qu'il n'y a qu'un seul propriétaire.
    w.addKkiapayListener?.('success', (d: any) => {
        const tx = String(d?.transactionId || d?.transaction_id || '')
        conclure(() => retours.onSucces(tx))
    })

    w.addKkiapayListener?.('failed', (d: any) => {
        const motif = typeof d?.reason === 'string' ? d.reason : undefined
        conclure(() => retours.onEchec?.(motif))
    })

    // Émis quand le client referme la fenêtre sans aller au bout.
    w.addKkiapayListener?.('aborted', () => {
        // Une fermeture suit parfois de quelques millisecondes un succès : on
        // laisse le succès arriver d'abord, sinon on annoncerait une annulation
        // sur un paiement réussi.
        minuteur = setTimeout(() => conclure(() => retours.onAnnule?.()), GRACE_MS)
    })

    // ── Filet : disparition de l'élément du DOM ─────────────────
    // Certaines fermetures (Échap, clic hors cadre, anciennes versions du SDK)
    // n'émettent pas `aborted`. On surveille alors le retrait de l'élément.
    if (typeof MutationObserver !== 'undefined') {
        nettoyer()
        let vuALEcran = false
        observateur = new MutationObserver(() => {
            if (termine) return
            if (widgetPresent()) { vuALEcran = true; return }
            // Il a été affiché puis retiré, sans succès ni échec : c'est un abandon.
            if (vuALEcran) {
                if (minuteur) clearTimeout(minuteur)
                minuteur = setTimeout(() => conclure(() => retours.onAnnule?.()), GRACE_MS)
            }
        })
        observateur.observe(document.body, { childList: true, subtree: true })
    }

    try {
        w.openKkiapayWidget(config)
        return true
    } catch {
        nettoyer()
        return false
    }
}

/** À appeler si l'écran est démonté pendant qu'un paiement est ouvert. */
export function arreterSurveillanceKkiapay() {
    nettoyer()
}

/**
 * Variante légère : surveille UNIQUEMENT l'abandon.
 *
 * Pour les écrans qui gèrent déjà succès et échec à leur façon et qu'il serait
 * risqué de réécrire (panier, portail de facture, lien de paiement). On
 * n'inscrit pas de rappel « success »/« failed » — donc rien n'est écrasé —
 * et l'on se désarme dès que la page signale une issue via `resoudre()`.
 */
export function surveillerAbandonKkiapay(onAnnule: () => void): () => void {
    if (typeof window === 'undefined') return () => { }
    const w = window as unknown as FenetreKkiapay

    let termine = false
    let observateurLocal: MutationObserver | null = null
    let minuteurLocal: ReturnType<typeof setTimeout> | null = null

    const resoudre = () => {
        termine = true
        observateurLocal?.disconnect()
        if (minuteurLocal) clearTimeout(minuteurLocal)
    }

    const declencher = () => {
        if (termine) return
        // Une fermeture suit parfois un succès de quelques millisecondes :
        // on laisse la page annoncer son issue avant de crier à l'abandon.
        if (minuteurLocal) clearTimeout(minuteurLocal)
        minuteurLocal = setTimeout(() => {
            if (termine) return
            resoudre()
            onAnnule()
        }, GRACE_MS)
    }

    w.addKkiapayListener?.('aborted', declencher)

    if (typeof MutationObserver !== 'undefined') {
        let vuALEcran = false
        observateurLocal = new MutationObserver(() => {
            if (termine) return
            if (widgetPresent()) { vuALEcran = true; return }
            if (vuALEcran) declencher()
        })
        observateurLocal.observe(document.body, { childList: true, subtree: true })
    }

    return resoudre
}
