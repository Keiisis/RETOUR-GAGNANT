import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { order_id, transaction_id, payment_method } = body

        if (!order_id || !transaction_id) {
            return NextResponse.json(
                { success: false, error: 'Missing order_id or transaction_id' },
                { status: 400 }
            )
        }

        // Check if already verified (idempotency — prevent double processing)
        const { data: existingOrder } = await supabase
            .from('orders')
            .select('payment_status, transaction_id, amount, payment_method, product_id, quantity')
            .eq('id', order_id)
            .single()

        if (!existingOrder) {
            return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
        }

        if (existingOrder.payment_status === 'completed' && existingOrder.transaction_id === transaction_id) {
            return NextResponse.json({ success: true, message: 'Already verified' })
        }

        let isVerified = false

        // 🛡️ SECURITY: Server-side Verification with Payment Providers
        if (payment_method === 'kkiapay' || existingOrder.payment_method === 'kkiapay') {
            try {
                const verifyRes = await fetch(`https://api.kkiapay.me/api/v1/transactions/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transactionId: transaction_id }),
                })
                const verifyData = await verifyRes.json()
                if (verifyData.status === 'SUCCESS' && verifyData.amount >= existingOrder.amount) {
                    isVerified = true
                }
            } catch (e) {
                console.error('Kkiapay verification error')
            }
        } else if (payment_method === 'fedapay' || existingOrder.payment_method === 'fedapay') {
            try {
                const { data: settingsData } = await supabase
                    .from('settings')
                    .select('key, value')
                    .in('key', ['fedapay_secret_key', 'fedapay_sandbox'])

                const settingsMap: Record<string, string> = {}
                for (const s of settingsData || []) settingsMap[s.key] = s.value

                const secretKey = settingsMap.fedapay_secret_key
                const isSandbox = settingsMap.fedapay_sandbox === 'true'
                const apiBase = isSandbox ? 'https://sandbox-api.fedapay.com' : 'https://api.fedapay.com'

                if (secretKey) {
                    const verifyRes = await fetch(`${apiBase}/v1/transactions/${transaction_id}`, {
                        headers: {
                            'Authorization': `Bearer ${secretKey}`,
                            'Content-Type': 'application/json',
                        },
                    })
                    const verifyData = await verifyRes.json()
                    const verifiedStatus = verifyData?.v1?.transaction?.status || verifyData?.status
                    if (verifiedStatus === 'approved') {
                        isVerified = true
                    }
                }
            } catch (e) {
                console.error('Fedapay verification error')
            }
        }

        if (!isVerified) {
            return NextResponse.json(
                { success: false, error: 'Payment verification failed' },
                { status: 400 }
            )
        }

        // Update order status
        const { error } = await supabase
            .from('orders')
            .update({
                payment_status: 'completed',
                transaction_id,
            })
            .eq('id', order_id)

        if (error) {
            return NextResponse.json(
                { success: false, error: 'Database update failed' },
                { status: 500 }
            )
        }

        // 🛡️ SECURITY: Atomically decrease stock using RPC to prevent race conditions
        if (existingOrder.product_id) {
            await supabase.rpc('decrement_stock', {
                p_id: existingOrder.product_id,
                qty: existingOrder.quantity || 1,
            })
        }

        // Send Notification Email
        try {
            await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/notifications/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id, type: 'payment_success' }),
            });
        } catch (e) {
            // Silent catch
        }

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json(
            { success: false, error: 'Server error' },
            { status: 500 }
        )
    }
}
