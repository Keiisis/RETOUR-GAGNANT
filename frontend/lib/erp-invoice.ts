import type { SupabaseClient } from '@supabase/supabase-js'
// ══════════════════════════════════════════════════════════════
//  FACTURE ERP AUTO : chemin webhook
//  Même logique que /api/checkout/verify (chemin navigateur) :
//  après un paiement confirmé par WEBHOOK (client ayant fermé la
//  page), on crée la facture documents_financiers → la compta ne
//  rate plus aucun paiement. Garde d'idempotence par référence de
//  commande : si verify ou un autre webhook l'a déjà créée, skip.
// ══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'
import { nextDocumentNumber } from './document-numbering'
import { classifyProposalPayment } from './proposal-classify'
import { TVA_RATE } from './tax'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function createErpInvoiceForOrder(opts: {
    orderId: string
    method: string
    transactionId: string
}): Promise<void> {
    const { orderId, method, transactionId } = opts
    const supabase = createClient(supabaseUrl, serviceKey)
    try {
        const orderRef = orderId.slice(0, 8).toUpperCase()
        const { data: existingInvoice } = await supabase
            .from('documents_financiers')
            .select('id')
            .ilike('notes', `%${orderRef}%`)
            .maybeSingle()
        if (existingInvoice) return

        const { data: fullOrder } = await supabase
            .from('orders').select('*').eq('id', orderId).single()
        if (!fullOrder) return

        // Consultation Fa payee -> le rendez-vous entre dans le calendrier
        await createFaAppointment(supabase, fullOrder)

        // Commande issue d'une proposition / lien de paiement : classification
        // UNIQUE et idempotente (jamais de facture « Boutique » ici → anti-doublon).
        if (fullOrder.shipping_zone === 'proposal') {
            await classifyProposalPayment(supabase, String(fullOrder.shipping_address || ''), fullOrder)
            return
        }

        const { data: eventReg } = await supabase
            .from('event_registrations')
            .select('id')
            .eq('order_id', orderId)
            .maybeSingle()
        const sourceLabel = eventReg ? 'Événement' : 'Boutique en ligne'

        type CartItemRaw = { title?: string; name?: string; price?: number; sale_price?: number; quantity?: number }
        const cartItems: CartItemRaw[] =
            Array.isArray(fullOrder.cart_items) && fullOrder.cart_items.length > 0
                ? fullOrder.cart_items
                : [{
                    title: fullOrder.product_title || sourceLabel,
                    price: fullOrder.amount / (fullOrder.quantity || 1),
                    quantity: fullOrder.quantity || 1,
                }]

        // TVA EN SUS : prix produits HORS TAXE, TVA 18 % sur les marchandises.
        const invoiceItems = cartItems.map((item) => ({
            description: item.title || item.name || 'Article',
            quantity: item.quantity || 1,
            unit_price: (item.sale_price && item.sale_price < (item.price || 0))
                ? item.sale_price
                : (item.price || 0),
            tva: TVA_RATE,
        }))
        const sousTotal = invoiceItems.reduce((sum, it) => sum + it.quantity * it.unit_price, 0)

        // Livraison : frais à part, hors TVA (tva = 0).
        const shippingFee = fullOrder.shipping_fee || 0
        if (shippingFee > 0) {
            invoiceItems.push({
                description: `Frais de livraison${fullOrder.shipping_zone ? ` (${fullOrder.shipping_zone})` : ''}`,
                quantity: 1,
                unit_price: shippingFee,
                tva: 0,
            })
        }

        const invoiceNumero = await nextDocumentNumber(supabase, 'facture')

        const orderCurrency = (fullOrder.currency || 'XOF').toUpperCase()
        let invoiceExchangeRate = 1
        if (orderCurrency !== 'XOF') {
            const { data: curData } = await supabase
                .from('currencies').select('exchange_rate_to_base').eq('code', orderCurrency).single()
            if (curData) invoiceExchangeRate = Number(curData.exchange_rate_to_base)
        }

        await supabase.from('documents_financiers').insert({
            type: 'facture',
            numero: invoiceNumero,
            client_nom: fullOrder.customer_name || 'Client',
            client_prenom: '',
            client_email: fullOrder.customer_email || '',
            client_phone: fullOrder.customer_phone || '',
            client_adresse: fullOrder.shipping_address || '',
            currency: orderCurrency,
            exchange_rate_applied: invoiceExchangeRate,
            items: invoiceItems,
            // sous_total = HT marchandises + livraison ; total_tva = TVA sur les
            // marchandises, dérivée du montant réellement payé pour garantir
            // sous_total + total_tva = total (aucune dérive d'arrondi).
            sous_total: sousTotal + shippingFee,
            total_tva: Math.max(0, Number(fullOrder.amount) - (sousTotal + shippingFee)),
            remise: 0,
            total: fullOrder.amount,
            status: 'paye',
            notes: `Facture auto-générée : ${sourceLabel} (webhook)\nCommande: ${orderRef}\nMéthode: ${method}\nTransaction: ${transactionId}`,
            conditions: 'Document généré automatiquement après paiement vérifié.',
            validite: 'Acquittée',
        })
        console.log(`[ERP webhook] Facture auto-générée: ${invoiceNumero} pour commande ${orderRef}`)
    } catch (err) {
        // Non-bloquant : le webhook ne doit jamais échouer pour la facturation
        console.error('[ERP webhook] Erreur auto-génération facture:', err)
    }
}

/**
 * Consultation Fa payee : cree le RENDEZ-VOUS correspondant.
 * Sans cela, le client payait sa seance sans qu'aucune date n'entre
 * dans le systeme (« notre equipe vous rappelle »). Idempotent.
 */
export async function createFaAppointment(
    supabase: SupabaseClient,
    order: {
        id: string
        customer_name?: string | null
        customer_email?: string | null
        customer_phone?: string | null
        cart_items?: unknown
    },
): Promise<void> {
    try {
        const items = Array.isArray(order.cart_items) ? order.cart_items as Array<Record<string, unknown>> : []
        const fa = items.find(i => i && i.service === 'consultation-fa-racines')
        if (!fa) return
        const date = fa.rdv_date ? String(fa.rdv_date) : null
        const heure = fa.rdv_heure ? String(fa.rdv_heure) : null
        if (!date || !heure) return

        const ref = `FA-${order.id.slice(0, 8).toUpperCase()}`
        const { data: existing } = await supabase
            .from('rdv_requests').select('id').ilike('notes', `%${ref}%`).maybeSingle()
        if (existing) return

        const priest = fa.priest_name ? String(fa.priest_name) : null
        await supabase.from('rdv_requests').insert({
            client_email: order.customer_email || null,
            date,
            heure,
            type: 'consultation-fa',
            motif: `Consultation Fa & Racines (${fa.mode === 'visio' ? 'Visio' : 'Présentiel'})`
                + (priest ? ` : ${priest}` : ''),
            notes: `${ref} : paiement confirmé. Client : ${order.customer_name || ''} ${order.customer_phone || ''}`.trim(),
            statut: 'confirme',
        })
    } catch (e) {
        console.error('[createFaAppointment]', e instanceof Error ? e.message : e)
    }
}
