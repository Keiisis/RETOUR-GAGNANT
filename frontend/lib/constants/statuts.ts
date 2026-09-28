// ══════════════════════════════════════════════════════════════
//  Statuts : RÉFÉRENCE UNIQUE (admin, agent, espace client, mobile, API).
//
//  Pourquoi : chaque écran tenait sa propre liste. Résultat constaté
//  (audit du 2026-09-28) : un dossier « annulé » par l'admin disparaissait
//  du kanban agent, un statut écrit par la synchro boutique (`en_cours`)
//  n'avait ni libellé ni couleur, des filtres cherchaient des valeurs que
//  la base ne contient jamais (`expire`, `paid`…).
//
//  Règle : une valeur n'existe que si elle figure ici. Les VALEURS sont
//  celles réellement stockées en base (vérifiées en lecture le 2026-09-28
//  et, quand elle existe, par la contrainte CHECK). Les libellés et
//  couleurs sont ceux déjà majoritaires dans les panels : rien d'inventé.
//
//  Couleurs : `hex` (graphiques, PDF, styles inline) et `badge` (classes
//  Tailwind lisibles en thème sombre ET clair : fond et bordure translucides).
// ══════════════════════════════════════════════════════════════

export interface DefStatut<V extends string = string> {
    value: V
    label: string
    hex: string
    badge: string
}

type Palette = 'gris' | 'bleu' | 'cyan' | 'ambre' | 'jaune' | 'violet' | 'emeraude' | 'vert' | 'rouge' | 'orange' | 'zinc' | 'ciel'

const BADGE: Record<Palette, { hex: string; badge: string }> = {
    gris:     { hex: '#6b7280', badge: 'bg-gray-500/15 text-gray-400 border border-gray-500/25' },
    ciel:     { hex: '#0ea5e9', badge: 'bg-sky-500/15 text-sky-400 border border-sky-500/25' },
    bleu:     { hex: '#3b82f6', badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/25' },
    cyan:     { hex: '#06b6d4', badge: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25' },
    ambre:    { hex: '#f59e0b', badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/25' },
    jaune:    { hex: '#FCD116', badge: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25' },
    violet:   { hex: '#8b5cf6', badge: 'bg-purple-500/15 text-purple-400 border border-purple-500/25' },
    emeraude: { hex: '#10b981', badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' },
    vert:     { hex: '#008751', badge: 'bg-green-500/15 text-green-400 border border-green-500/25' },
    rouge:    { hex: '#ef4444', badge: 'bg-red-500/15 text-red-400 border border-red-500/25' },
    orange:   { hex: '#f97316', badge: 'bg-orange-500/15 text-orange-400 border border-orange-500/25' },
    zinc:     { hex: '#71717a', badge: 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/25' },
}

function def<V extends string>(value: V, label: string, p: Palette): DefStatut<V> {
    return { value, label, ...BADGE[p] }
}

/** Statut inconnu : affiché tel quel, en gris, plutôt que masqué. */
function inconnu(value: string): DefStatut {
    return { value, label: value || '—', ...BADGE.gris }
}

function indexer<V extends string>(liste: readonly DefStatut<V>[]): Record<V, DefStatut<V>> {
    return Object.fromEntries(liste.map(d => [d.value, d])) as Record<V, DefStatut<V>>
}

// ──────────────────────────────────────────────────────────────
//  dossier_tracking.statut  (pas de contrainte CHECK en base)
//  Écrit par : admin/dossiers, agent/dossiers (kanban), lib/dossier-service,
//  lib/sync-dossiers. Lu par : admin, agent, espace client, mobile.
// ──────────────────────────────────────────────────────────────
export const DOSSIER_STATUTS = [
    def('reception', 'Réception', 'ciel'),
    def('verification', 'Vérification', 'bleu'),
    def('traitement', 'Traitement', 'ambre'),
    def('validation', 'Validation', 'violet'),
    def('finalisation', 'Finalisation', 'vert'),
    def('termine', 'Terminé', 'emeraude'),
    def('annule', 'Annulé', 'rouge'),
] as const
export type DossierStatut = typeof DOSSIER_STATUTS[number]['value']
export const DOSSIER_STATUT = indexer<DossierStatut>(DOSSIER_STATUTS)

/** Ordre du parcours (kanban, « étape suivante »). `annule` est hors parcours. */
export const DOSSIER_PARCOURS: DossierStatut[] = ['reception', 'verification', 'traitement', 'validation', 'finalisation', 'termine']
/** Dossier encore ouvert = ni terminé ni annulé. */
export const DOSSIER_STATUTS_ACTIFS: DossierStatut[] = ['reception', 'verification', 'traitement', 'validation', 'finalisation']
export const DOSSIER_STATUTS_CLOS: DossierStatut[] = ['termine', 'annule']
/** Progression (%) associée à chaque statut (reprise de admin/dossiers). */
export const DOSSIER_PROGRESSION: Record<DossierStatut, number> = {
    reception: 10, verification: 30, traitement: 60, validation: 80, finalisation: 95, termine: 100, annule: 0,
}

/** Valeurs historiques encore écrites par d'anciens chemins → valeur canonique. */
export const DOSSIER_ALIAS: Record<string, DossierStatut> = {
    en_cours: 'traitement',   // lib/sync-dossiers (commandes boutique)
    en_attente: 'reception',  // lib/dossier-service (ancienne liste STATUTS_ACTIFS)
    soumis: 'reception',
    verifie: 'verification',
    completed: 'termine',
}

export function normaliserStatutDossier(v?: string | null): DossierStatut | string {
    const s = String(v || '')
    return (DOSSIER_STATUT as Record<string, DefStatut>)[s] ? s : (DOSSIER_ALIAS[s] || s)
}
export function statutDossier(v?: string | null): DefStatut {
    const n = normaliserStatutDossier(v)
    return (DOSSIER_STATUT as Record<string, DefStatut>)[n] || inconnu(String(v || ''))
}

// ──────────────────────────────────────────────────────────────
//  dossiers.status  (table « mobile », miroir de dossier_tracking)
// ──────────────────────────────────────────────────────────────
export const DOSSIER_MOBILE_STATUTS = [
    def('soumis', 'Dossier soumis', 'bleu'),
    def('en_attente', 'En attente de documents', 'ambre'),
    def('verifie', 'En cours de vérification', 'bleu'),
    def('en_cours', 'En cours de traitement', 'ambre'),
    def('traitement', 'En traitement', 'ambre'),
    def('validation', 'En validation', 'violet'),
    def('termine', 'Terminé', 'emeraude'),
    def('annule', 'Annulé', 'rouge'),
] as const
export type DossierMobileStatut = typeof DOSSIER_MOBILE_STATUTS[number]['value']
export const DOSSIER_MOBILE_STATUT = indexer<DossierMobileStatut>(DOSSIER_MOBILE_STATUTS)

/** dossier_tracking.statut → dossiers.status (identique à mobile HomeScreen). */
export const DOSSIER_VERS_MOBILE: Record<DossierStatut, DossierMobileStatut> = {
    reception: 'soumis',
    verification: 'verifie',
    traitement: 'traitement',
    validation: 'validation',
    finalisation: 'validation',
    termine: 'termine',
    annule: 'annule',
}

// ──────────────────────────────────────────────────────────────
//  documents_financiers.status
//  CHECK (supabase_migration_erp.sql) : brouillon, envoye, accepte, refuse,
//  paye, en_retard, annule. Aucune autre valeur ne peut être écrite :
//  `expire`, `paid`, `pending`, `signe`, `completed` ne doivent pas servir
//  de filtre (ils ne trouvent jamais rien).
// ──────────────────────────────────────────────────────────────
export const DOC_FIN_STATUTS = [
    def('brouillon', 'Brouillon', 'gris'),
    def('envoye', 'Envoyé', 'bleu'),
    def('accepte', 'Accepté', 'emeraude'),
    def('refuse', 'Refusé', 'rouge'),
    def('paye', 'Payé', 'vert'),
    def('en_retard', 'En retard', 'orange'),
    def('annule', 'Annulé', 'zinc'),
] as const
export type DocFinStatut = typeof DOC_FIN_STATUTS[number]['value']
export const DOC_FIN_STATUT = indexer<DocFinStatut>(DOC_FIN_STATUTS)
/** Libellés côté client (espace client / portail) : un devis accepté = « Signé ». */
export const DOC_FIN_LIBELLE_CLIENT: Record<DocFinStatut, string> = {
    brouillon: 'Brouillon', envoye: 'En attente', accepte: 'Signé', refuse: 'Refusé',
    paye: 'Payé', en_retard: 'En retard', annule: 'Annulé',
}
/** En attente d'encaissement (trésorerie). */
export const DOC_FIN_EN_ATTENTE: DocFinStatut[] = ['envoye', 'accepte', 'en_retard']
/** Devis sortis du pipeline commercial. */
export const DOC_FIN_CLOS: DocFinStatut[] = ['paye', 'annule', 'refuse']
/** Couleurs RVB des PDF (reprises de admin/facturation). */
export const DOC_FIN_RGB: Record<DocFinStatut, [number, number, number]> = {
    brouillon: [120, 120, 120], envoye: [59, 130, 246], accepte: [0, 160, 90],
    refuse: [220, 50, 50], paye: [16, 185, 110], en_retard: [220, 120, 20], annule: [90, 90, 90],
}
export function statutDocFin(v?: string | null): DefStatut {
    return (DOC_FIN_STATUT as Record<string, DefStatut>)[String(v || '')] || inconnu(String(v || ''))
}

/** documents_financiers.type. ⚠ `avoir` est écrit par /api/admin/avoirs mais
 *  la contrainte CHECK d'origine n'autorise que devis/facture : à vérifier. */
export const DOC_FIN_TYPES = ['devis', 'facture', 'avoir'] as const
export type DocFinType = typeof DOC_FIN_TYPES[number]

// ──────────────────────────────────────────────────────────────
//  nationality_applications.status  (colonne `status`, PAS `statut`)
//  `revue_myafro` : dossier MyAfroOrigins en revue dans /admin/documents,
//  exclu des listes « Toutes » tant qu'il n'est pas approuvé (→ soumis).
// ──────────────────────────────────────────────────────────────
export const NATIONALITE_STATUTS = [
    def('revue_myafro', 'Revue MyAfroOrigins', 'cyan'),
    def('brouillon', 'Brouillon', 'gris'),
    def('soumis', 'Soumis', 'bleu'),
    def('en_traitement', 'En traitement', 'ambre'),
    def('verification', 'Vérification', 'violet'),
    def('approuve', 'Approuvé', 'emeraude'),
    def('rejete', 'Rejeté', 'rouge'),
] as const
export type NationaliteStatut = typeof NATIONALITE_STATUTS[number]['value']
export const NATIONALITE_STATUT = indexer<NationaliteStatut>(NATIONALITE_STATUTS)
/** Statuts que l'on peut choisir à la main (admin ET agent). */
export const NATIONALITE_STATUTS_EDITABLES: NationaliteStatut[] = ['soumis', 'en_traitement', 'verification', 'approuve', 'rejete']
/** Exclus de la vue « Toutes » des panels. */
export const NATIONALITE_HORS_LISTE: NationaliteStatut[] = ['revue_myafro']
/** Statuts qui fixent `decision_date`. */
export const NATIONALITE_DECISIONS: NationaliteStatut[] = ['approuve', 'rejete']
export function statutNationalite(v?: string | null): DefStatut {
    return (NATIONALITE_STATUT as Record<string, DefStatut>)[String(v || '')] || inconnu(String(v || ''))
}

/** nationality_applications.payment_status : la base contient `payé` (accent,
 *  écrit par le webhook Kkiapay et /api/nationality) et `en_attente`. */
export function nationalitePayee(v?: string | null): boolean {
    const s = String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return ['paye', 'paid', 'success', 'reussi', 'completed', 'ok'].includes(s)
}

// ──────────────────────────────────────────────────────────────
//  rdv_requests.statut  (validé serveur par /api/rdv/[id])
// ──────────────────────────────────────────────────────────────
export const RDV_STATUTS = [
    def('en_attente', 'En attente', 'jaune'),
    def('confirme', 'Confirmé', 'emeraude'),
    def('annule', 'Annulé', 'rouge'),
    def('termine', 'Terminé', 'gris'),
] as const
export type RdvStatut = typeof RDV_STATUTS[number]['value']
export const RDV_STATUT = indexer<RdvStatut>(RDV_STATUTS)
export function statutRdv(v?: string | null): DefStatut {
    return (RDV_STATUT as Record<string, DefStatut>)[String(v || '')] || inconnu(String(v || ''))
}

// ──────────────────────────────────────────────────────────────
//  orders : DEUX colonnes distinctes. `orders.status` N'EXISTE PAS.
//  - payment_status  : cycle du paiement
//  - shipping_status : cycle de la livraison (validé par
//    /api/admin/orders/[id]/tracking, ALLOWED_STATUS)
// ──────────────────────────────────────────────────────────────
export const COMMANDE_PAIEMENT_STATUTS = [
    def('pending', 'En attente', 'ambre'),
    def('completed', 'Payée', 'emeraude'),
    def('failed', 'Échouée', 'rouge'),
    def('abandoned', 'Abandonnée', 'gris'),
    def('refunded', 'Remboursée', 'violet'),
] as const
export type CommandePaiementStatut = typeof COMMANDE_PAIEMENT_STATUTS[number]['value']
export const COMMANDE_PAIEMENT_STATUT = indexer<CommandePaiementStatut>(COMMANDE_PAIEMENT_STATUTS)

export const COMMANDE_LIVRAISON_STATUTS = [
    def('pending', 'En attente', 'gris'),
    def('preparing', 'En préparation', 'ambre'),
    def('shipped', 'Expédié', 'bleu'),
    def('in_transit', 'En transit', 'cyan'),
    def('delivered', 'Livré', 'emeraude'),
    def('failed', 'Échec', 'rouge'),
    def('returned', 'Retourné', 'orange'),
] as const
export type CommandeLivraisonStatut = typeof COMMANDE_LIVRAISON_STATUTS[number]['value']
export const COMMANDE_LIVRAISON_STATUT = indexer<CommandeLivraisonStatut>(COMMANDE_LIVRAISON_STATUTS)

// ──────────────────────────────────────────────────────────────
//  messages : le drapeau de lecture canonique est `lu`.
//  `messages.is_read` existe aussi mais n'est jamais mis à jour par les
//  panels (toujours false en base) : ne JAMAIS l'utiliser pour compter.
//  (`notifications.is_read` et `voice_messages.is_read`, eux, sont les bons.)
// ──────────────────────────────────────────────────────────────
export const MESSAGE_CHAMP_LU = 'lu' as const
export const MESSAGE_TYPES = [
    def('contact', 'Contact', 'bleu'),
    def('nationality', 'Nationalité', 'vert'),
    def('rdv', 'Rendez-vous', 'violet'),
    def('live_chat', 'Chat en direct', 'cyan'),
] as const
/** `rendez-vous` coexiste en base avec `rdv` (même sens). */
export const MESSAGE_TYPE_ALIAS: Record<string, string> = { 'rendez-vous': 'rdv' }
