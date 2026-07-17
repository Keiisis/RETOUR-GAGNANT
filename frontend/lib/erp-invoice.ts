// ══════════════════════════════════════════════════════════════
//  FACTURE ERP AUTO — chemin webhook
//  Même logique que /api/checkout/verify (chemin navigateur) :
//  après un paiement confirmé par WEBHOOK (client ayant fermé la
//  page), on crée la facture documents_financiers → la compta ne
//  rate plus aucun paiement. Garde d'idempotence par référence de
//  commande : si verify ou un autre webhook l'a déjà créée, skip.
// ══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

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

        const invoiceItems = cartItems.map((item) => ({
            description: item.title || item.name || 'Article',
            quantity: item.quantity || 1,
            unit_price: (item.sale_price && item.sale_price < (item.price || 0))
                ? item.sale_price
                : (item.price || 0),
            tva: 0,
        }))
        const sousTotal = invoiceItems.reduce((sum, it) => sum + it.quantity * it.unit_price, 0)

        const shippingFee = fullOrder.shipping_fee || 0
        if (shippingFee > 0) {
            invoiceItems.push({
                description: `Frais de livraison${fullOrder.shipping_zone ? ` (${fullOrder.shipping_zone})` : ''}`,
                quantity: 1,
                unit_price: shippingFee,
                tva: 0,
            })
        }

        const now = new Date()
        const invoiceNumero = `FAC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(Date.now() % 10000).padStart(4, '0')}`

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
            sous_total: sousTotal + shippingFee,
            total_tva: 0,
            remise: 0,
            total: fullOrder.amount,
            status: 'paye',
            notes: `Facture auto-générée — ${sourceLabel} (webhook)\nCommande: ${orderRef}\nMéthode: ${method}\nTransaction: ${transactionId}`,
            conditions: 'Document généré automatiquement après paiement vérifié.',
            validite: 'Acquittée',
        })
        console.log(`[ERP webhook] Facture auto-générée: ${invoiceNumero} pour commande ${orderRef}`)
    } catch (err) {
        // Non-bloquant : le webhook ne doit jamais échouer pour la facturation
        console.error('[ERP webhook] Erreur auto-génération facture:', err)
    }
}
