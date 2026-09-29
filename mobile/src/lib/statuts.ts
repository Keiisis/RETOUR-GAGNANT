/* ═══════════════════════════════════════════════════════════
   Statuts : COPIE des valeurs de frontend/lib/constants/statuts.ts
   (référence unique admin/agent/API). Copie et non import : le mobile
   ne dépend pas du code du site. Toute évolution se fait des deux côtés.
═══════════════════════════════════════════════════════════ */

/** dossier_tracking.statut (valeurs réellement stockées). */
export const DOSSIER_STATUTS = ['reception', 'verification', 'traitement', 'validation', 'finalisation', 'termine', 'annule'] as const
export type DossierStatut = typeof DOSSIER_STATUTS[number]

/** Dossier encore ouvert = ni terminé ni annulé. */
export const DOSSIER_STATUTS_ACTIFS: DossierStatut[] = ['reception', 'verification', 'traitement', 'validation', 'finalisation']

/** Valeurs historiques encore écrites par d'anciens chemins → valeur canonique. */
export const DOSSIER_ALIAS: Record<string, DossierStatut> = {
    en_cours: 'traitement',
    en_attente: 'reception',
    soumis: 'reception',
    verifie: 'verification',
    completed: 'termine',
}

/** Statuts d'affichage mobile (dossiers.status). */
export type DossierMobileStatut = 'soumis' | 'verifie' | 'traitement' | 'validation' | 'termine' | 'annule'

/** dossier_tracking.statut → statut d'affichage mobile (DOSSIER_VERS_MOBILE du web). */
export const DOSSIER_VERS_MOBILE: Record<DossierStatut, DossierMobileStatut> = {
    reception: 'soumis',
    verification: 'verifie',
    traitement: 'traitement',
    validation: 'validation',
    finalisation: 'validation',
    termine: 'termine',
    annule: 'annule',
}

/** Statut brut (canonique OU historique) → statut d'affichage mobile. */
export function statutDossierMobile(v: string | null | undefined): DossierMobileStatut {
    const s = String(v || '')
    const canon = (DOSSIER_STATUTS as readonly string[]).includes(s) ? (s as DossierStatut) : DOSSIER_ALIAS[s]
    return canon ? DOSSIER_VERS_MOBILE[canon] : 'soumis'
}

/** rdv_requests.statut (validé serveur par /api/rdv/[id]). */
export const RDV_STATUTS = ['en_attente', 'confirme', 'annule', 'termine'] as const
export type RdvStatut = typeof RDV_STATUTS[number]

/** nationality_applications.status (colonne `status`, pas `statut`). */
export const NATIONALITE_STATUTS = ['revue_myafro', 'brouillon', 'soumis', 'en_traitement', 'verification', 'approuve', 'rejete'] as const
export type NationaliteStatut = typeof NATIONALITE_STATUTS[number]
