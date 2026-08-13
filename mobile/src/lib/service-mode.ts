/* ═══════════════════════════════════════════════════════════
   PARCOURS RÉEL D'UN SERVICE : miroir de frontend/lib/service-mode.ts
   À MODIFIER EN PAIRE avec le web : même règle sur les trois surfaces.

   Ce module ne DÉCIDE rien : il REPRODUIT ce que le site public fait déjà.
   Toute valeur ci-dessous a été relevée dans le code du web, qui reste la
   référence. Aucune invention, aucun parcours simulé.

   Relevé du site public (app/(routes)/services/…) :

   · TOUS les services      → encart « Prêt à démarrer ? » → « Prendre
                              Rendez-vous » vers /rendez-vous?service=<slug>,
                              premier appel de 15 min gratuit.
                              AUCUN paiement en ligne.
   · consultation-fa-racines → annuaire des prêtres (FaPriestsDirectory) +
                              réservation présentiel/visio (FaConsultationBooking)
                              → /api/services/fa-checkout → widget Kkiapay ou
                              FedaPay → /api/checkout/verify.
                              SEUL service payable directement depuis sa fiche.
   · langues-racines        → choix Présentiel/Visio puis rendez-vous
                              (premier rendez-vous gratuit, devis ensuite).
   · recherche-ancestrale   → /rendez-vous?service=recherche-ancestrale
   · nationalite-vip        → parcours dédié /nationalite (le paiement se fait
                              dans le formulaire, pas sur la fiche service).

   Conséquence : le mode par défaut est « rendez-vous », PAS « paiement ».
   C'est l'inverse de ce que faisait l'app mobile, qui affichait « Payer avec
   Kkiapay » sur tous les services.
═══════════════════════════════════════════════════════════ */

export type ServiceMode =
    | 'booking'      // réservation avec paiement en ligne (Consultation Fa)
    | 'appointment'  // prise de rendez-vous, aucun paiement en ligne (défaut)
    | 'form'         // parcours dédié avec son propre formulaire (Nationalité)
    | 'shop'         // boutique e-commerce

/** Parcours dédiés relevés sur le site public, par slug. */
const ROUTES: Record<string, { mode: ServiceMode; web: string }> = {
    'consultation-fa-racines': { mode: 'booking', web: '/services/consultation-fa-racines' },
    'nationalite-vip': { mode: 'form', web: '/nationalite' },
    'nationalite': { mode: 'form', web: '/nationalite' },
    'boutique': { mode: 'shop', web: '/boutique' },
}

export interface ServiceModeInput {
    slug?: string | null
    /** Colonne explicite si elle existe un jour en base (prioritaire). */
    delivery_mode?: string | null
}

export function getServiceMode(svc: ServiceModeInput): ServiceMode {
    const explicit = String(svc.delivery_mode || '').toLowerCase().trim()
    if (explicit === 'booking' || explicit === 'appointment' || explicit === 'form' || explicit === 'shop') {
        return explicit
    }
    const slug = String(svc.slug || '').trim()
    if (slug && ROUTES[slug]) return ROUTES[slug].mode
    // Défaut = ce que fait le site public sur toutes les autres fiches.
    return 'appointment'
}

/**
 * Un libellé tarifaire n'est un montant FERME que s'il ne comporte ni « sur
 * devis », ni « à partir de ». Prélever un prix d'appel reviendrait à facturer
 * une somme que le client n'a jamais validée.
 */
export function firmAmountFrom(label: string | number | null | undefined): number | null {
    if (label == null) return null
    const s = String(label).toLowerCase()
    if (/devis|consulter|sur\s*mesure|gratuit/.test(s)) return null
    if (/à\s*partir|a\s*partir|dès\s|des\s|from\s|min\./.test(s)) return null
    const m = s.replace(/\s/g, '').match(/(\d+(?:[.,]\d+)?)/)
    if (!m) return null
    const n = Number(m[1].replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? n : null
}

/** Libellés identiques sur les trois surfaces. */
export const MODE_COPY: Record<ServiceMode, { cta: string; note: string }> = {
    booking: {
        cta: 'Réserver ma consultation',
        note: 'Choisissez votre prêtre et votre formule, puis réglez en ligne par Mobile Money ou carte.',
    },
    appointment: {
        cta: 'Prendre rendez-vous',
        note: 'Ce service démarre par un rendez-vous. Premier appel de 15 minutes gratuit, aucun paiement en ligne à cette étape.',
    },
    form: {
        cta: 'Déposer ma demande',
        note: 'Ce service dispose de son propre formulaire de dossier. Le règlement se fait à la fin du parcours.',
    },
    shop: {
        cta: 'Ouvrir la boutique',
        note: 'Produits et ressources disponibles à la commande, avec livraison.',
    },
}
