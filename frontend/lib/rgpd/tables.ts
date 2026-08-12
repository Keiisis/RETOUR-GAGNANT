// ══════════════════════════════════════════════════════════════
// RGPD : Cartographie des tables contenant des données personnelles
// Source de vérité UNIQUE, partagée par :
//   • /api/admin/rgpd            (export + effacement admin)
//   • /api/rgpd/{request,data,delete}  (self-service public vérifié)
//
// • mode 'delete'    → suppression pure (aucune obligation légale de garder).
// • mode 'anonymize' → la ligne reste (obligation comptable/légale) mais les
//   données personnelles sont neutralisées.
// • kind 'document'  → ne jamais AFFICHER le contenu en aperçu : seulement
//   compter et mentionner (sécurité / confidentialité des pièces).
//
// Chaque table déclare plusieurs colonnes email candidates : le moteur essaie
// chacune et ignore silencieusement celles qui n'existent pas (tolérant).
// ══════════════════════════════════════════════════════════════

export type RgpdMode = 'delete' | 'anonymize'
export type RgpdKind = 'data' | 'document'

export interface RgpdTable {
    table: string
    emailCols: string[]
    mode: RgpdMode
    kind: RgpdKind
    label: string
}

export const ANON = '[supprimé : RGPD]'

export const RGPD_TABLES: RgpdTable[] = [
    // ── Données effaçables (pas d'obligation légale de conservation) ──
    { table: 'messages',               emailCols: ['email'],                        mode: 'delete',    kind: 'data',     label: 'Messages de contact' },
    { table: 'dossier_tracking',       emailCols: ['client_email'],                 mode: 'delete',    kind: 'data',     label: 'Suivi de dossier' },
    { table: 'rdv_requests',           emailCols: ['client_email', 'email'],        mode: 'delete',    kind: 'data',     label: 'Demandes de rendez-vous' },
    { table: 'eligibility_results',    emailCols: ['client_email', 'email'],        mode: 'delete',    kind: 'data',     label: 'Résultats du simulateur' },
    { table: 'event_registrations',    emailCols: ['email'],                        mode: 'delete',    kind: 'data',     label: 'Inscriptions aux événements' },
    { table: 'newsletter_subscribers', emailCols: ['email'],                        mode: 'delete',    kind: 'data',     label: 'Abonnement newsletter' },
    { table: 'partners',               emailCols: ['email'],                        mode: 'delete',    kind: 'data',     label: 'Candidature partenaire' },
    { table: 'ai_prospection_leads',   emailCols: ['email'],                        mode: 'delete',    kind: 'data',     label: 'Prospection' },
    { table: 'testimonials',           emailCols: ['email'],                        mode: 'delete',    kind: 'data',     label: 'Avis & témoignages' },
    { table: 'client_classement',      emailCols: ['email'],                        mode: 'delete',    kind: 'data',     label: 'Suivi client (CRM)' },

    // ── Comptes & profils : anonymisés (préserve l'intégrité référentielle) ──
    { table: 'client_profiles',        emailCols: ['email', 'client_email'],        mode: 'anonymize', kind: 'data',     label: 'Profil client' },

    // ── Documents : comptés/mentionnés seulement, jamais affichés ──
    { table: 'client_documents',       emailCols: ['client_email'],                 mode: 'delete',    kind: 'document', label: 'Documents transmis' },

    // ── Obligation légale (comptabilité, ~10 ans) : anonymisation ──
    { table: 'orders',                 emailCols: ['customer_email', 'client_email', 'email'], mode: 'anonymize', kind: 'data',     label: 'Commandes' },
    { table: 'documents_financiers',   emailCols: ['client_email', 'customer_email', 'email'], mode: 'anonymize', kind: 'document', label: 'Pièces comptables' },
]

// Colonnes PII à neutraliser lors d'une anonymisation.
export const PII_COLUMNS = [
    'email', 'client_email', 'customer_email',
    'nom', 'prenom', 'client_nom', 'client_prenom', 'customer_name', 'full_name',
    'phone', 'telephone', 'whatsapp', 'client_phone', 'client_adresse', 'address', 'adresse',
]

// ── Aperçu sûr : ne montrer que des champs « affichables » ──
// On affiche les champs lisibles par l'utilisateur (ce qu'on détient sur lui)
// et on masque tout ce qui est technique ou sensible (URLs, fichiers, jetons…).
const DISPLAY_DENY = /(id$|_id$|url|file|path|content|document|token|password|secret|hash|signature|ip_|user_agent|metadata|payload|stripe|paypal|kkiapay|fedapay)/i
const DISPLAY_ALLOW = /(email|nom|prenom|name|phone|telephone|whatsapp|message|sujet|subject|service|statut|status|date|created_at|updated_at|titre|title|note|montant|amount|total|adresse|address|ville|pays|country|description|categorie|category)/i

export function safePreviewRow(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row || {})) {
        if (v === null || v === undefined || v === '') continue
        if (DISPLAY_DENY.test(k)) continue
        if (!DISPLAY_ALLOW.test(k)) continue
        // tronque les valeurs trop longues
        out[k] = typeof v === 'string' && v.length > 280 ? v.slice(0, 280) + '…' : v
    }
    return out
}

export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
