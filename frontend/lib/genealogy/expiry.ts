import type { DocType } from './types'

/**
 * ═══════════════════════════════════════════════════════════════
 * SOURCE UNIQUE DE VÉRITÉ : Expiration des documents généalogiques
 * ═══════════════════════════════════════════════════════════════
 * Avant : 3 systèmes divergeaient (engine = 92j pour tout ; cron =
 * vocabulaire `acte_naissance`/`casier_judiciaire` qui ne matchait
 * JAMAIS les doc_type réels ; uploader = liste à part). Désormais,
 * engine.ts, le cron check-expired ET l'uploader importent CE module.
 *
 * Règle : seuls les documents administratifs « à fraîcheur » expirent.
 * Les actes historiques (naissance, décès, mariage, registres…) NE
 * périment JAMAIS (un extrait de naissance d'ancêtre est éternel).
 */

/** Durée de validité en mois, par type de document. Absent = n'expire jamais. */
export const EXPIRY_MONTHS: Partial<Record<DocType, number>> = {
    address_proof: 3,       // justificatif de domicile < 3 mois
    criminal_record: 3,     // casier judiciaire < 3 mois
    profession_proof: 3,    // preuve de profession < 3 mois
    afro_descent_proof: 6,  // preuve d'afro-descendance < 6 mois
}

/** Types soumis à une date d'émission + suivi d'expiration. */
export const EXPIRABLE_DOC_TYPES: string[] = Object.keys(EXPIRY_MONTHS)

/** Nombre de mois de validité d'un type, ou null s'il n'expire jamais. */
export function expiryMonthsFor(docType: string): number | null {
    return EXPIRY_MONTHS[docType as DocType] ?? null
}

/** Date d'expiration calculée (ou null si non applicable). */
export function expiryDateOf(docType: string, issuedDate?: string | null): Date | null {
    const months = expiryMonthsFor(docType)
    if (!months || !issuedDate) return null
    const issued = new Date(issuedDate)
    if (isNaN(issued.getTime())) return null
    const d = new Date(issued)
    d.setMonth(d.getMonth() + months)
    return d
}

/** true si le document est périmé (jamais pour les types non expirables). */
export function isDocExpired(docType: string, issuedDate?: string | null): boolean {
    const exp = expiryDateOf(docType, issuedDate)
    if (!exp) return false
    return Date.now() > exp.getTime()
}

/** Jours restants avant expiration (négatif = déjà expiré ; null = n'expire pas). */
export function daysUntilExpiry(docType: string, issuedDate?: string | null): number | null {
    const exp = expiryDateOf(docType, issuedDate)
    if (!exp) return null
    return Math.floor((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}
