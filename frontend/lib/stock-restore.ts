// ══════════════════════════════════════════════════════════════
//  RESTITUTION DU STOCK
//  Le stock était décrémenté à l'encaissement mais JAMAIS restitué :
//  ni sur annulation, ni sur remboursement. Chaque commande annulée
//  faisait donc disparaître définitivement des articles de l'inventaire,
//  qui dérivait à la baisse sans explication.
//
//  Miroir exact de la décrémentation de /api/checkout/verify :
//  produits « legacy » + inventory_items, avec mouvement tracé.
//  Idempotent : une même commande ne peut être restituée deux fois.
// ══════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

interface CartLine { id?: string; product_id?: string; quantity?: number }

export async function restoreStockForOrder(
    supabase: SupabaseClient,
    orderId: string,
    raison: 'annulation' | 'remboursement' = 'annulation',
): Promise<{ restored: number }> {
    let restored = 0
    try {
        const { data: order } = await supabase
            .from('orders')
            .select('id, product_id, quantity, cart_items, payment_status')
            .eq('id', orderId)
            .maybeSingle()
        if (!order) return { restored: 0 }

        // Idempotence : un retour déjà tracé pour cette commande ?
        const { data: deja } = await supabase
            .from('inventory_movements')
            .select('id')
            .eq('reference_id', orderId)
            .eq('type', 'return')
            .limit(1)
        if (deja && deja.length > 0) return { restored: 0 }

        const lignes: CartLine[] = Array.isArray(order.cart_items) && order.cart_items.length > 0
            ? (order.cart_items as CartLine[])
            : [{ id: order.product_id as string | undefined, quantity: order.quantity || 1 }]

        for (const l of lignes) {
            const targetId = l.id || l.product_id
            const qty = Number(l.quantity) || 1
            if (!targetId || qty <= 0) continue

            // 1. Produits « legacy » : silencieux si la RPC n'existe pas
            try {
                await supabase.rpc('increment_stock', { p_id: targetId, qty })
            } catch { /* produit hors legacy */ }

            // 2. Inventaire tracé
            const { data: invItem } = await supabase
                .from('inventory_items')
                .select('id, track_inventory, current_stock')
                .eq('id', targetId)
                .maybeSingle()

            if (invItem && invItem.track_inventory) {
                const nouveau = (Number(invItem.current_stock) || 0) + qty
                await supabase.from('inventory_items')
                    .update({ current_stock: nouveau })
                    .eq('id', invItem.id)

                await supabase.from('inventory_movements').insert({
                    item_id: invItem.id,
                    type: 'return',
                    quantity_change: qty,
                    stock_after: nouveau,
                    reference_id: orderId,
                    notes: `Retour en stock : ${raison} (Réf. ${orderId.slice(0, 8).toUpperCase()})`,
                })
                restored += qty
            }
        }
    } catch (e) {
        console.error('[restoreStockForOrder]', e instanceof Error ? e.message : e)
    }
    return { restored }
}
