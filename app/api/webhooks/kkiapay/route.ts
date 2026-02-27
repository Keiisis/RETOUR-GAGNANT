import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Kkiapay sends POST webhook notifications when payment status changes
export async function POST(request: Request) {
    try {
        const body = await request.json()

        // Kkiapay webhook payload structure
        const {
            transactionId,
            status,
            amount,
            data,
        } = body

        const orderId = data?.order_id

        if (!transactionId || !orderId) {
            return NextResponse.json({ error: 'Missing transactionId or order_id' }, { status: 400 })
        }

        // Fetch order to verify it exists and is still pending
        const { data: order, error: fetchErr } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single()

        if (fetchErr || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        // Idempotency: skip if already processed
        if (order.payment_status === 'completed') {
            return NextResponse.json({ ok: true, message: 'Already processed' })
        }

        if (status === 'SUCCESS' || status === 'TRANSACTION_APPROVED') {
            // Server-side verification with Kkiapay API
            const verifyRes = await fetch(`https://api.kkiapay.me/api/v1/transactions/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactionId }),
            })

            const verifyData = await verifyRes.json()

            if (verifyData.status === 'SUCCESS' && verifyData.amount >= order.amount) {
                // Update order to completed
                await supabase
                    .from('orders')
                    .update({
                        payment_status: 'completed',
                        transaction_id: transactionId,
                    })
                    .eq('id', orderId)

                // Decrement product stock
                if (order.product_id) {
                    await supabase.rpc('decrement_stock', {
                        p_id: order.product_id,
                        qty: order.quantity || 1,
                    })
                }

                // Send notification
                await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/notifications/order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: orderId, type: 'payment_success' }),
                }).catch(() => { })

                return NextResponse.json({ ok: true, message: 'Payment verified and confirméed' })
            }
        }

        // Payment failed
        await supabase
            .from('orders')
            .update({ payment_status: 'failed', transaction_id: transactionId })
            .eq('id', orderId)

        return NextResponse.json({ ok: true, message: 'Payment status updated to failed' })
    } catch {
        return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
    }
}
