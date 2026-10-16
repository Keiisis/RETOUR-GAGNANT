// Lien de facture boutique : signé et limité dans le temps (audit 2026-10-12, C4).
// Sans jeton valide, /api/invoices/[id] exige le client propriétaire connecté ou le personnel.
import { signerJeton, verifierJeton } from '@/lib/signature-serveur'

const USAGE = 'facture-boutique-v1'
export const DUREE_LIEN_FACTURE_S = 180 * 24 * 3600   // 6 mois : le client rouvre sa facture depuis l'email

export async function lienFacture(baseUrl: string, orderId: string): Promise<string> {
    return `${baseUrl}/api/invoices/${orderId}?t=${encodeURIComponent(await signerJeton(USAGE, orderId, DUREE_LIEN_FACTURE_S))}`
}

export function jetonFactureValide(orderId: string, jeton: string | null): Promise<boolean> {
    return verifierJeton(USAGE, orderId, jeton)
}
