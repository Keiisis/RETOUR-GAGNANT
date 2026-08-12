// ══════════════════════════════════════════════════════════════
// Classement Client : catégories de service, jalons de relance, statuts.
// Source unique partagée par l'API, le cron de relances et l'UI.
// ══════════════════════════════════════════════════════════════

export interface ServiceCategory {
    slug: string
    label: string
    color: string   // couleur d'accent (hex)
    icon: string    // nom d'icône lucide-react (résolu côté UI, pas d'emoji)
}

// Les 9 services officiels + « Autres ». slug aligné sur les pages service.
// `icon` = nom d'un composant lucide-react (mappé dans l'UI).
export const SERVICE_CATEGORIES: ServiceCategory[] = [
    { slug: 'passeport',             label: 'Passeport & Documents', color: '#10B981', icon: 'FileText' },
    { slug: 'logement',              label: 'Immobilier & Foncier',  color: '#0EA5E9', icon: 'Home' },
    { slug: 'business',              label: "Création d'Entreprise",  color: '#6366F1', icon: 'Briefcase' },
    { slug: 'culture',               label: 'Tourisme & Culture',     color: '#F59E0B', icon: 'Globe' },
    { slug: 'construction',          label: 'Suivi de Chantier',      color: '#EF4444', icon: 'HardHat' },
    { slug: 'investissement',        label: 'Investissement',         color: '#14B8A6', icon: 'TrendingUp' },
    { slug: 'nationalite-vip',       label: 'Nationalité VIP',        color: '#C9A84C', icon: 'Award' },
    { slug: 'recherche-ancestrale',  label: 'Recherche Ancestrale',   color: '#A855F7', icon: 'Dna' },
    { slug: 'autres',                label: 'Autres Services',        color: '#64748B', icon: 'LayoutGrid' },
]

const CATEGORY_BY_SLUG = new Map(SERVICE_CATEGORIES.map(c => [c.slug, c]))

export function getCategory(slug: string): ServiceCategory {
    return CATEGORY_BY_SLUG.get(slug) || SERVICE_CATEGORIES[SERVICE_CATEGORIES.length - 1]
}

// Règles de classification depuis un texte libre (libellé/slug de service ou motif).
const CATEGORY_RULES: { slug: string; match: string[] }[] = [
    { slug: 'passeport',            match: ['passeport', 'document', 'administratif', 'cip', 'état civil', 'etat civil', 'enrôlement', 'enrolement'] },
    { slug: 'logement',             match: ['logement', 'immobilier', 'louer', 'acheter', 'foncier', 'terrain', 'bien', 'maison'] },
    { slug: 'business',             match: ['entreprise', 'business', 'société', 'societe', 'création', 'rccm', 'ifu'] },
    { slug: 'culture',              match: ['culture', 'tourisme', 'guide', 'cauris', 'racines', 'voyage'] },
    { slug: 'construction',         match: ['chantier', 'construction', 'bâtir', 'batir', 'travaux'] },
    { slug: 'investissement',       match: ['investissement', 'investir', 'rendement', 'affaires', 'placement'] },
    { slug: 'nationalite-vip',      match: ['nationalité', 'nationalite', 'vip', 'citoyenneté', 'citoyennete', 'reconnaissance'] },
    { slug: 'recherche-ancestrale', match: ['ancestral', 'ancêtre', 'ancetre', 'généalogie', 'genealogie', 'esclav'] },
]

/** Classe un texte libre (libellé de service, motif, slug) dans une catégorie. */
export function categorize(input?: string | null): string {
    const s = (input || '').toLowerCase()
    if (!s.trim()) return 'autres'
    // slug exact d'abord
    if (CATEGORY_BY_SLUG.has(s)) return s
    const hit = CATEGORY_RULES.find(r => r.match.some(m => s.includes(m)))
    return hit?.slug || 'autres'
}

// ── Jalons de relance (jours depuis le premier contact) ──
export const RELANCE_MILESTONES = [15, 20, 30, 45, 60, 75, 90] as const

/** Nombre de jours pleins écoulés depuis une date ISO. */
export function daysSince(iso: string | null | undefined): number {
    if (!iso) return 0
    const t = new Date(iso).getTime()
    if (isNaN(t)) return 0
    return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

/** Prochain jalon de relance non encore atteint (ou null si tous passés). */
export function nextMilestone(days: number): number | null {
    return RELANCE_MILESTONES.find(m => m > days) ?? null
}

/** Jalons dûs : atteints (<= days) et pas encore envoyés. */
export function dueMilestones(days: number, sent: number[]): number[] {
    return RELANCE_MILESTONES.filter(m => m <= days && !sent.includes(m))
}

// ── Statuts de suivi ──
export interface StatusInfo { value: string; label: string; color: string }

export const CLIENT_STATUSES: StatusInfo[] = [
    { value: 'nouveau',            label: 'Nouveau',            color: '#3B82F6' },
    { value: 'en_cours',          label: 'En cours',           color: '#C9A84C' },
    { value: 'en_attente_client', label: 'En attente client',  color: '#F59E0B' },
    { value: 'bloque',            label: 'Bloqué',             color: '#EF4444' },
    { value: 'converti',          label: 'Payé',               color: '#10B981' },
    { value: 'termine',           label: 'Terminé',            color: '#059669' },
    { value: 'perdu',             label: 'Perdu',              color: '#94A3B8' },
]

const STATUS_BY_VALUE = new Map(CLIENT_STATUSES.map(s => [s.value, s]))
export function getStatus(value: string): StatusInfo {
    return STATUS_BY_VALUE.get(value) || CLIENT_STATUSES[0]
}

/**
 * Éligibilité aux relances automatiques (décision 2026-07-02) :
 * on ne relance QUE les clients qui ont payé (statut « Payé », valeur DB
 * `converti` : posée automatiquement par markClientConverted au paiement).
 * Règle unique partagée par le cron, le badge de nav et le board UI.
 */
export function isRelanceEligible(status: string): boolean {
    return status === 'converti'
}
