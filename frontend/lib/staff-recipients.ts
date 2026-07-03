// ══════════════════════════════════════════════════════════════
// Destinataires des notifications internes (RDV, paiements, prospects).
// Les 5 adresses fixes de l'équipe + l'email admin configuré
// (Admin > Paramètres > Email), dédupliqués.
// ══════════════════════════════════════════════════════════════

import { getEmailConfig } from '@/lib/email'

export const STAFF_RECIPIENTS = [
    'kevinrtgagnant@gmail.com',
    'pdg.retourgagnantbenin@gmail.com',
    'ornelmitchai6@gmail.com',
    'jeanbaptiste01rgb@gmail.com',
    'tiamiounadjathrgb@gmail.com',
]

/** Ligne « to » complète : 5 fixes + adminEmail configuré (dédupliqués). */
export async function getStaffToLine(): Promise<string> {
    try {
        const config = await getEmailConfig()
        return [...new Set([...STAFF_RECIPIENTS, ...(config.adminEmail ? [config.adminEmail] : [])])].join(', ')
    } catch {
        return STAFF_RECIPIENTS.join(', ')
    }
}
