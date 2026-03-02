import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Webhook Zeyow — notification asynchrone de paiement
export async function POST(request: Request) {
    try {
        const body = await request.json()

        const {
            order_id,
            transaction_id,
            status,
            amount,
        } = body

        if (!order_id) {
            return NextResponse.json({ error: 'order_id manquant' }, { status: 400 })
        }

        const { data: order, error: fetchErr } = await supabase
            .from('orders')
            .select('payment_status, amount, product_id, quantity')
            .eq('id', order_id)
            .single()

        if (fetchErr || !order) {
            return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
        }

        // Idempotence
        if (order.payment_status === 'completed') {
            return NextResponse.json({ ok: true, message: 'Déjà traité' })
        }

        const success =
            status === 'success' ||
            status === 'SUCCESS' ||
            status === 'completed' ||
            status === 'COMPLETED' ||
            status === 'paid' ||
            status === 'PAID'

        if (success) {
            // Vérification de montant si fourni
            if (amount && parseFloat(String(amount)) < order.amount * 0.99) {
                console.error('Zeyow amount mismatch:', { received: amount, expected: order.amount })
                return NextResponse.json({ error: 'Montant incorrect' }, { status: 400 })
            }

            await supabase
                .from('orders')
                .update({
                    payment_status: 'completed',
                    transaction_id: transaction_id || `zeyow-${order_id}`,
                })
                .eq('id', order_id)

            if (order.product_id) {
                await supabase.rpc('decrement_stock', {
                    p_id: order.product_id,
                    qty: order.quantity || 1,
                })
            }

            await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/notifications/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id, type: 'payment_success' }),
            }).catch(() => {})

            return NextResponse.json({ ok: true, message: 'Paiement confirmé' })
        }

        // Paiement échoué ou annulé
        const newStatus =
            status === 'refunded' || status === 'REFUNDED' ? 'refunded' : 'failed'

        await supabase
            .from('orders')
            .update({
                payment_status: newStatus,
                transaction_id: transaction_id || null,
            })
            .eq('id', order_id)

        return NextResponse.json({ ok: true, message: `Statut: ${newStatus}` })
    } catch {
        return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
    }
}
