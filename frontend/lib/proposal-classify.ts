// ══════════════════════════════════════════════════════════════
//  CLASSIFICATION D'UN PAIEMENT DE PROPOSITION / LIEN DE PAIEMENT
//  AUTORITÉ UNIQUE et IDEMPOTENTE : appelée par TOUS les chemins de
//  succès (checkout/verify, webhooks via erp-invoice, proposal-paid).
//  Empêche les DOUBLONS : une proposition payée ne produit QU'UN seul
//  enregistrement comptable, dans la catégorie choisie à la création
//  du lien (marqueur [CAT:x] dans notes) :
//   - factures (défaut) : 1 facture (onglet Factures) + la commande
//     boutique redondante est supprimée
//   - boutique          : la commande reste (onglet Boutique), pas de facture
//   - paiements         : 1 encaissement direct (onglet Paiements) + commande supprimée
// ══════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import { nextDocumentNumber } from './document-numbering'
import { sendDocumentPaymentEmails } from './document-payment'
import { sendEmail } from './email'
import { insertOnce } from './payment-integrity'
import { fromHt, TVA_RATE } from './tax'

type OrderLike = { id?: string; amount?: number; currency?: string } | null | undefined

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'
const CUR_SYM: Record<string, string> = { XOF: 'FCFA', EUR: '€', USD: '$', GBP: '£' }
const fmtMoney = (n: number, c: string) => `${Math.round(n).toLocaleString('fr-FR')} ${CUR_SYM[c] || c}`

/** Reçu de paiement léger (encaissement direct sans facture — catégorie « paiements »). */
async function sendSimplePaymentReceipt(email: string, name: string, libelle: string, montant: number, currency: string): Promise<void> {
    const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    await sendEmail({
        to: email,
        subject: `Reçu de paiement — ${libelle} — ${fmtMoney(montant, currency)}`,
        html: `
        <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
          <div style="height:5px;background:linear-gradient(90deg,#008751 0 33%,#FCD116 33% 66%,#E8112D 66% 100%)"></div>
          <div style="background:linear-gradient(135deg,#006b40,#008751);padding:26px 32px;text-align:center">
            <h1 style="color:#fff;font-size:20px;font-weight:800;margin:0">Retour Gagnant Bénin</h1>
            <p style="color:#FCD116;font-size:11px;text-transform:uppercase;letter-spacing:3px;margin:6px 0 0;font-weight:700">Reçu de paiement</p>
          </div>
          <div style="padding:30px 34px;color:#1f2937;font-size:15px;line-height:1.8">
            <p>Cher(e) ${esc(name)},</p>
            <p>Nous accusons réception de votre paiement pour <strong>${esc(libelle)}</strong>. Merci de votre confiance.</p>
            <div style="background:#f0fdf6;border:1px solid rgba(0,135,81,0.2);border-radius:10px;padding:18px;text-align:center;margin:18px 0">
              <p style="margin:0;font-size:11px;font-weight:800;color:#047857;text-transform:uppercase;letter-spacing:.15em">Montant réglé</p>
              <p style="margin:6px 0 0;font-size:28px;font-weight:900;color:#008751">${esc(fmtMoney(montant, currency))}</p>
            </div>
            <p style="color:#6b7280;font-size:13px">Pour toute question, contactez-nous au +229 01 60 32 21 21.</p>
          </div>
          <div style="padding:14px 32px;background:#0d1117;text-align:center">
            <p style="margin:0;color:#6b7280;font-size:11px">Ce reçu vaut preuve de paiement — &copy; ${new Date().getFullYear()} Retour Gagnant Bénin — <a href="${SITE}" style="color:#008751;text-decoration:none">${SITE.replace('https://', '')}</a></p>
          </div>
        </div>`,
        context: 'proposal_payment_receipt',
        relatedId: email,
    })
}

export function extractCategory(notes: string | null | undefined): 'factures' | 'boutique' | 'paiements' {
    const m = String(notes || '').match(/\[CAT:(\w+)\]/)
    const c = m?.[1]
    return c === 'boutique' || c === 'paiements' ? c : 'factures'
}

export async function classifyProposalPayment(
    supabase: SupabaseClient,
    proposalId: string,
    order?: OrderLike,
): Promise<void> {
    if (!proposalId) return
    try {
        const { data: proposal } = await supabase
            .from('ai_client_proposals').select('*').eq('id', proposalId).single()
        if (!proposal) return

        const category = extractCategory(proposal.notes)
        const shortId = proposalId.slice(0, 12)

        // ── BOUTIQUE : la commande est l'enregistrement comptable, rien d'autre ──
        if (category === 'boutique') return

        // ── PAIEMENTS : encaissement direct (paiements_manuels) ──
        if (category === 'paiements') {
            const { data: exists } = await supabase
                .from('paiements_manuels').select('id').ilike('notes', `%[PROP:${shortId}]%`).maybeSingle()
            if (!exists) {
                const montant = Math.round(Number(order?.amount) || Number(proposal.total_amount) || 0)
                const ins = await insertOnce(supabase, 'paiements_manuels', {
                    document_id: null,
                    type: 'virement',
                    montant,
                    date_paiement: new Date().toISOString().slice(0, 10),
                    reference: 'Lien de paiement',
                    notes: `[EXTERNE] ${proposal.destination || 'Paiement'} — ${proposal.client_name || ''} [PROP:${shortId}]`,
                }, `proposal:${shortId}`, { column: 'notes', pattern: `%[PROP:${shortId}]%` })
                if (ins.status !== 'created') { if (order?.id) await supabase.from('orders').delete().eq('id', order.id); return }
                // Reçu de paiement au client (encaissement sans facture)
                if (proposal.client_email) {
                    try {
                        await sendSimplePaymentReceipt(
                            proposal.client_email,
                            proposal.client_name || 'Client',
                            proposal.destination || 'Paiement',
                            montant,
                            (proposal.currency || 'XOF').toUpperCase(),
                        )
                    } catch (mailErr) {
                        console.error('[classifyProposalPayment] reçu paiement échoué:', mailErr instanceof Error ? mailErr.message : mailErr)
                    }
                }
            }
            if (order?.id) await supabase.from('orders').delete().eq('id', order.id)
            return
        }

        // ── FACTURES (défaut) : une seule facture ERP ──
        const { data: existF } = await supabase
            .from('documents_financiers').select('id').ilike('notes', `%Proposal: ${shortId}%`).maybeSingle()
        if (!existF) {
            const { data: proposalItems } = await supabase
                .from('ai_proposal_items').select('*').eq('proposal_id', proposalId).order('order_index', { ascending: true })

            const currency = (proposal.currency || 'XOF').toUpperCase()

            // TVA EN SUS : selling_price est le prix HORS TAXE saisi par
            // l'agent. La TVA s'AJOUTE dessus (100 HT -> 118 TTC). C'est ce
            // que le client a payé (le checkout charge HT × 1,18) et ce que
            // le devis lui a présenté. La facture enregistre donc HT + TVA.
            const facturables = (proposalItems || [])
                .filter((it: { type?: string; selling_price?: number }) => it.type !== 'hero' && it.type !== 'pricing' && (it.selling_price || 0) > 0)

            const invoiceItems = facturables
                .map((it: { title?: string; location?: string; selling_price?: number; original_price?: number }) => ({
                    description: `${it.title || 'Prestation'}${it.location ? ` — ${it.location}` : ''}`,
                    quantity: 1,
                    unit_price: it.selling_price || 0,   // HT (prix saisi)
                    unit_cost: it.original_price || 0,
                    tva: TVA_RATE,
                }))
            if (invoiceItems.length === 0) {
                invoiceItems.push({
                    description: `${proposal.destination || 'Prestation'}`,
                    quantity: 1,
                    unit_price: Number(proposal.total_amount) || 0,
                    unit_cost: 0,
                    tva: TVA_RATE,
                })
            }

            // Base HT = somme des prestations (ou total_amount). La TVA s'ajoute :
            // fromHt garantit sous_total(HT) + total_tva = total(TTC) au centime.
            const htBase = facturables.reduce(
                (s: number, it: { selling_price?: number }) => s + (it.selling_price || 0), 0)
                || Number(proposal.total_amount) || 0
            const { ht: sousTotal, tva: totalTva, ttc: totalTTC } = fromHt(htBase, currency)

            let exchangeRate = 1
            if (currency !== 'XOF') {
                const { data: cur } = await supabase.from('currencies').select('exchange_rate_to_base').eq('code', currency).single()
                if (cur) exchangeRate = Number(cur.exchange_rate_to_base)
            }
            const numero = await nextDocumentNumber(supabase, 'facture')
            const createdFacture = await insertOnce(supabase, 'documents_financiers', {
                type: 'facture',
                numero,
                client_nom: proposal.client_name || 'Client',
                client_prenom: '',
                client_email: proposal.client_email || '',
                client_phone: proposal.client_phone || '',
                client_adresse: '',
                currency,
                exchange_rate_applied: exchangeRate,
                items: invoiceItems,
                sous_total: sousTotal,
                total_tva: totalTva,
                remise: 0,
                total: totalTTC,
                status: 'paye',
                paid_at: new Date().toISOString(),
                notes: `Facture auto-générée — Lien de paiement / Proposition\nProposal: ${shortId.toUpperCase()}\nClient: ${proposal.client_name || 'N/A'}`,
                conditions: 'Document généré automatiquement après paiement.',
                validite: 'Acquittée',
            }, `proposal:${shortId}`, { column: 'notes', pattern: `%Proposal: ${shortId}%` })
            if (createdFacture.status === 'error') console.error('[classifyProposalPayment]', createdFacture.message)

            // ── EMAIL : reçu RGB officiel + PDF de la facture au client, alerte
            //    équipe. Envoyé UNE seule fois (dans le bloc de création) — évite
            //    que le client ne reçoive que le reçu Kkiapay sans facture RGB.
            if (createdFacture.status === 'created' && createdFacture.id && proposal.client_email) {
                try {
                    await sendDocumentPaymentEmails(createdFacture.id, 'Lien de paiement', `PROP-${shortId.toUpperCase()}`)
                } catch (mailErr) {
                    console.error('[classifyProposalPayment] email facture échoué:', mailErr instanceof Error ? mailErr.message : mailErr)
                }
            }
        }
        // La commande boutique est redondante (la facture est l'enregistrement) → supprimée
        if (order?.id) await supabase.from('orders').delete().eq('id', order.id)
    } catch (e) {
        console.error('[classifyProposalPayment]', e instanceof Error ? e.message : e)
    }
}
