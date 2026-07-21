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

type OrderLike = { id?: string; amount?: number; currency?: string } | null | undefined

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
                await supabase.from('paiements_manuels').insert({
                    document_id: null,
                    type: 'virement',
                    montant: Math.round(Number(order?.amount) || Number(proposal.total_amount) || 0),
                    date_paiement: new Date().toISOString().slice(0, 10),
                    reference: 'Lien de paiement',
                    notes: `[EXTERNE] ${proposal.destination || 'Paiement'} — ${proposal.client_name || ''} [PROP:${shortId}]`,
                })
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

            const invoiceItems = (proposalItems || [])
                .filter((it: { type?: string; selling_price?: number }) => it.type !== 'hero' && it.type !== 'pricing' && (it.selling_price || 0) > 0)
                .map((it: { title?: string; location?: string; selling_price?: number; original_price?: number }) => ({
                    description: `${it.title || 'Prestation'}${it.location ? ` — ${it.location}` : ''}`,
                    quantity: 1,
                    unit_price: it.selling_price || 0,
                    unit_cost: it.original_price || 0,
                    tva: 0,
                }))
            if (invoiceItems.length === 0) {
                invoiceItems.push({
                    description: `${proposal.destination || 'Prestation'}`,
                    quantity: 1,
                    unit_price: Number(proposal.total_amount) || 0,
                    unit_cost: 0,
                    tva: 0,
                })
            }
            const sousTotal = invoiceItems.reduce((s: number, it: { quantity: number; unit_price: number }) => s + it.quantity * it.unit_price, 0)

            const currency = (proposal.currency || 'XOF').toUpperCase()
            let exchangeRate = 1
            if (currency !== 'XOF') {
                const { data: cur } = await supabase.from('currencies').select('exchange_rate_to_base').eq('code', currency).single()
                if (cur) exchangeRate = Number(cur.exchange_rate_to_base)
            }
            const numero = await nextDocumentNumber(supabase, 'facture')
            await supabase.from('documents_financiers').insert({
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
                total_tva: 0,
                remise: 0,
                total: Number(proposal.total_amount) || sousTotal,
                status: 'paye',
                notes: `Facture auto-générée — Lien de paiement / Proposition\nProposal: ${shortId.toUpperCase()}\nClient: ${proposal.client_name || 'N/A'}`,
                conditions: 'Document généré automatiquement après paiement.',
                validite: 'Acquittée',
            })
        }
        // La commande boutique est redondante (la facture est l'enregistrement) → supprimée
        if (order?.id) await supabase.from('orders').delete().eq('id', order.id)
    } catch (e) {
        console.error('[classifyProposalPayment]', e instanceof Error ? e.message : e)
    }
}
