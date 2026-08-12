// ══════════════════════════════════════════════════════════════
// Comptabilité : constantes partagées (admin + agent + exports).
// ══════════════════════════════════════════════════════════════

/** Catégories officielles de dépenses (décision boss 2026-07-16). */
export const EXPENSE_CATEGORIES: Array<{ value: string; label: string }> = [
    { value: 'loyer_charges',        label: 'Loyer et charges' },
    { value: 'deplacement_carburant', label: 'Déplacement et carburant' },
    { value: 'fourniture_bureau',    label: 'Fourniture bureau' },
    { value: 'telephone_internet',   label: 'Téléphone et internet' },
    { value: 'communication_pub',    label: 'Communication et publicité' },
    { value: 'sous_traitants',       label: 'Sous-traitants' },
    { value: 'frais_bancaires',      label: 'Frais bancaires' },
    { value: 'impots_taxes',         label: 'Impôts et taxes' },
    { value: 'frais_evenement',      label: 'Frais événement' },
    { value: 'formation',            label: 'Formation' },
    { value: 'materiel_equipement',  label: 'Matériel et équipement' },
    { value: 'salaires',             label: 'Salaires du personnel' },
    { value: 'autre',                label: 'Autre dépense' },
]

/** Libellé d'une catégorie (couvre aussi les anciennes valeurs historiques). */
const LEGACY_LABELS: Record<string, string> = {
    marketing: 'Communication et publicité',
    operationnel: 'Autre dépense',
    logistique: 'Déplacement et carburant',
    salaires: 'Salaires du personnel',
}
const CAT_MAP = new Map(EXPENSE_CATEGORIES.map(c => [c.value, c.label]))
export function expenseCategoryLabel(value?: string | null): string {
    const v = (value || 'autre').toLowerCase()
    return CAT_MAP.get(v) || LEGACY_LABELS[v] || 'Autre dépense'
}

/**
 * Accès à la Comptabilité côté AGENT : réservé à Ornel (décision boss
 * 2026-07-16). Les admins gardent l'accès via le panel Admin.
 */
export const COMPTA_AGENT_EMAILS = ['ornelmitchai6@gmail.com']
export function agentHasComptaAccess(email?: string | null): boolean {
    return !!email && COMPTA_AGENT_EMAILS.includes(email.toLowerCase().trim())
}
