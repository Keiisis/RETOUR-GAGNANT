// ══════════════════════════════════════════════════════════════
// Liste canonique des services proposés au rendez-vous.
// Source unique partagée par le formulaire /rendez-vous et les pages
// service (pré-sélection via ?service=<slug>).
// Les 9 services officiels + « Autre ».
// ══════════════════════════════════════════════════════════════

export interface RdvService {
    slug: string
    label: string
}

export const RDV_SERVICES: RdvService[] = [
    { slug: 'passeport', label: 'Passeport & Documents Officiels' },
    { slug: 'logement', label: 'Acheter ou Louer un Bien' },
    { slug: 'business', label: "Création d'Entreprise" },
    { slug: 'culture', label: 'Tourisme & Culture' },
    { slug: 'construction', label: 'Suivi de Chantier' },
    { slug: 'investissement', label: 'Investissement' },
    { slug: 'nationalite-vip', label: 'Nationalité VIP' },
    { slug: 'recherche-ancestrale', label: 'Recherche Ancestrale' },
    { slug: 'autres', label: 'Autres Services' },
    { slug: 'autre', label: 'Autre / Je ne sais pas encore' },
]

const SLUG_TO_LABEL = new Map(RDV_SERVICES.map(s => [s.slug, s.label]))

/** Convertit un slug de service (depuis l'URL) en libellé du formulaire. */
export function serviceSlugToLabel(slug: string | null | undefined): string | null {
    if (!slug) return null
    const key = slug.toLowerCase().trim()
    return SLUG_TO_LABEL.get(key) || null
}

/** Libellé du premier service (valeur par défaut du formulaire). */
export const DEFAULT_RDV_SERVICE = RDV_SERVICES[0].label
