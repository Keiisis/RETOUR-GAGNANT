// ══════════════════════════════════════════════════════════════
//  FACTURE D'UN PAIEMENT DE SERVICE — le maillon qui manquait.
//
//  Un règlement de service depuis l'application (Consultation Fa, Permis,
//  Logement, Recherche ancestrale, Récap MyAfroOrigins…) ouvrait un dossier et
//  s'arrêtait là : AUCUNE facture, AUCUNE écriture comptable, AUCUN email. Le
//  client voyait « une facture vous a été envoyée » sans qu'aucune ne parte, et
//  la comptabilité ne comptait que la boutique, la nationalité et les
//  propositions. L'écart n'était visible nulle part.
//
//  Ici, un seul point de passage : après un encaissement VÉRIFIÉ, on écrit la
//  facture dans `documents_financiers` — la même table que le panel, la même
//  série de numéros, la même comptabilité — puis on déclenche le reçu client
//  (email + PDF en pièce jointe) par la fonction déjà utilisée par le portail.
//
//  Deux garanties, parce qu'un doublon de facture est un faux revenu :
//    · UNE facture par encaissement — deux lectures préalables (la transaction
//      en colonne, puis dans les notes des factures nées d'une commande) et,
//      pour les appels vraiment simultanés, l'unicité tenue par la base via
//      `insertOnce` sur `source_ref` ;
//    · montant = celui CONFIRMÉ par la passerelle, jamais celui annoncé par
//      le téléphone.
// ══════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { nextDocumentNumber } from './document-numbering'
import { sendDocumentPaymentEmails } from './document-payment'
import { insertOnce } from './payment-integrity'
import { TVA_RATE } from './tax'

const supabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

export interface PaiementServiceAFacturer {
    /** Transaction de la passerelle : c'est la clé d'idempotence. */
    transactionId: string
    /** Montant RÉELLEMENT encaissé, en XOF, tel que la passerelle le confirme. */
    montantXof: number
    /** Libellé de la prestation, tel qu'il apparaîtra sur la facture. */
    libelle: string
    /** Compte client (jeton mobile / session) : porte la signature et l'accès. */
    clientId?: string | null
    clientNom?: string | null
    clientPrenom?: string | null
    clientEmail?: string | null
    clientPhone?: string | null
    provider?: string
    /** Origine, pour la traçabilité : 'mobile', 'web', nom du service… */
    source?: string
    /** Référence métier (n° de dossier, référence de demande…). */
    reference?: string | null
    notes?: string
}

export interface ResultatFacturation {
    ok: boolean
    /** Identifiant du document dans `documents_financiers`. */
    id?: string
    numero?: string
    /** Vrai quand la facture existait déjà (rejeu, webhook doublé). */
    existante?: boolean
    erreur?: string
}

/**
 * Facture un paiement de service déjà VÉRIFIÉ auprès de la passerelle.
 *
 * N'échoue jamais bruyamment : un dossier payé ne doit pas être refusé parce
 * que la facturation a trébuché. Le retour dit ce qui s'est passé, l'appelant
 * décide s'il le remonte.
 */
export async function facturerPaiementService(
    p: PaiementServiceAFacturer,
    client?: SupabaseClient,
): Promise<ResultatFacturation> {
    const supabase = client || supabaseAdmin()

    if (!p.transactionId) return { ok: false, erreur: 'Transaction absente' }
    if (!(p.montantXof > 0)) return { ok: false, erreur: 'Montant encaissé inconnu' }

    try {
        // ── Idempotence : cette transaction a-t-elle déjà sa facture ? ──
        const { data: deja } = await supabase
            .from('documents_financiers')
            .select('id, numero')
            .eq('payment_transaction_id', p.transactionId)
            .maybeSingle()
        if (deja?.id) return { ok: true, id: deja.id, numero: deja.numero || undefined, existante: true }

        /* Deuxième garde, indispensable : certains parcours passent par une
           COMMANDE (`/api/checkout` → `/api/checkout/verify`) qui facture
           déjà, puis ouvrent en plus un dossier avec la même transaction —
           c'est le cas du Permis de conduire. Sans ce contrôle, le même
           encaissement produirait DEUX factures, donc un chiffre d'affaires
           faux. Ces factures-là ne portent pas encore la transaction en
           colonne : elle est inscrite dans les notes. */
        const { data: parLaCommande } = await supabase
            .from('documents_financiers')
            .select('id, numero')
            .ilike('notes', `%${p.transactionId}%`)
            .limit(1)
            .maybeSingle()
        if (parLaCommande?.id) {
            return { ok: true, id: parLaCommande.id, numero: parLaCommande.numero || undefined, existante: true }
        }

        const numero = await nextDocumentNumber(supabase, 'facture')

        /* TVA : le taux de l'agence (aujourd'hui 0 — exonération). Le montant
           encaissé fait foi ; le HT s'en déduit pour que
           sous_total + total_tva = total, sans dérive d'arrondi. */
        const total = Math.round(p.montantXof)
        const ht = TVA_RATE > 0 ? Math.round(total / (1 + TVA_RATE / 100)) : total
        const tva = total - ht

        const lignes = [{
            description: p.libelle,
            quantity: 1,
            unit_price: ht,
            tva: TVA_RATE,
        }]

        const notes = [
            `Paiement en ligne (${p.provider || 'kkiapay'})`,
            `Transaction: ${p.transactionId}`,
            p.reference ? `Référence: ${p.reference}` : '',
            p.source ? `Origine: ${p.source}` : '',
            p.notes || '',
        ].filter(Boolean).join('\n')

        /* L'insertion passe par `insertOnce` : l'unicité est alors garantie par
           la BASE (index unique sur `source_ref`), pas par la lecture faite
           trois lignes plus haut. Deux appels simultanés — double tape, écran
           et webhook au même instant — ne peuvent plus produire deux factures
           pour un seul encaissement. */
        const insertion = await insertOnce(
            supabase,
            'documents_financiers',
            {
                type: 'facture',
                numero,
                client_id: p.clientId || null,
                client_nom: p.clientNom || '',
                client_prenom: p.clientPrenom || '',
                client_email: p.clientEmail || '',
                client_phone: p.clientPhone || '',
                currency: 'XOF',
                exchange_rate_applied: 1,
                items: lignes,
                sous_total: ht,
                total_tva: tva,
                remise: 0,
                total,
                status: 'paye',
                paid_at: new Date().toISOString(),
                payment_provider: p.provider || 'kkiapay',
                payment_method: p.provider || 'kkiapay',
                payment_transaction_id: p.transactionId,
                notes,
                conditions: 'Paiement effectué en ligne.',
                validite: 'Acquittée',
            },
            // La clé d'unicité : l'encaissement, pas la référence métier.
            `paiement:${p.transactionId}`,
            { column: 'notes', pattern: `%Transaction: ${p.transactionId}%` },
        )

        if (insertion.status === 'duplicate') {
            const { data: rattrapage } = await supabase
                .from('documents_financiers')
                .select('id, numero')
                .eq('payment_transaction_id', p.transactionId)
                .maybeSingle()
            return {
                ok: true, existante: true,
                id: rattrapage?.id, numero: rattrapage?.numero || undefined,
            }
        }

        if (insertion.status === 'error' || !insertion.id) {
            console.error('[facturerPaiementService] insertion refusée:', insertion.status === 'error' ? insertion.message : 'sans identifiant')
            return { ok: false, erreur: insertion.status === 'error' ? insertion.message : 'Facture non créée' }
        }

        /* Reçu client (email + PDF signé en pièce jointe) et alerte équipe :
           la fonction du portail, pour que le client reçoive EXACTEMENT le même
           document, quel que soit le canal de paiement. Volontairement non
           attendu : l'écran n'a pas à patienter derrière un serveur SMTP. */
        void sendDocumentPaymentEmails(insertion.id, p.provider || 'kkiapay', p.transactionId)
            .catch(e => console.error('[facturerPaiementService] reçu non envoyé:', e))

        return { ok: true, id: insertion.id, numero }
    } catch (e) {
        console.error('[facturerPaiementService]', e instanceof Error ? e.message : e)
        return { ok: false, erreur: e instanceof Error ? e.message : 'Erreur facturation' }
    }
}
