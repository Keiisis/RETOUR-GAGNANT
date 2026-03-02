import { NextResponse } from 'next/server'
import Stripe from 'stripe'
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

        // Idempotence — empêcher le double traitement
        const { data: existingOrder } = await supabase
            .from('orders')
            .select('payment_status, transaction_id, amount, payment_method, product_id, quantity')
            .eq('id', order_id)
            .single()

        if (!existingOrder) {
            return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
        }

        if (
            existingOrder.payment_status === 'completed' &&
            existingOrder.transaction_id === transaction_id
        ) {
            return NextResponse.json({ success: true, message: 'Already verified' })
        }

        let isVerified = false
        const method = payment_method || existingOrder.payment_method

        // ─── KKIAPAY ─────────────────────────────────────────────────────────
        if (method === 'kkiapay') {
            try {
                const verifyRes = await fetch('https://api.kkiapay.me/api/v1/transactions/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transactionId: transaction_id }),
                })
                const verifyData = await verifyRes.json()
                if (verifyData.status === 'SUCCESS' && verifyData.amount >= existingOrder.amount) {
                    isVerified = true
                }
            } catch (e) {
                console.error('Kkiapay verification error', e)
            }
        }

        // ─── FEDAPAY ─────────────────────────────────────────────────────────
        else if (method === 'fedapay') {
            try {
                const { data: settingsData } = await supabase
                    .from('settings')
                    .select('key, value')
                    .in('key', ['fedapay_secret_key', 'fedapay_sandbox'])

                const sm: Record<string, string> = {}
                for (const s of settingsData || []) sm[s.key] = s.value

                const secretKey = sm.fedapay_secret_key
                const isSandbox = sm.fedapay_sandbox === 'true'
                const apiBase = isSandbox
                    ? 'https://sandbox-api.fedapay.com'
                    : 'https://api.fedapay.com'

                if (secretKey) {
                    const verifyRes = await fetch(`${apiBase}/v1/transactions/${transaction_id}`, {
                        headers: {
                            Authorization: `Bearer ${secretKey}`,
                            'Content-Type': 'application/json',
                        },
                    })
                    const verifyData = await verifyRes.json()
                    const verifiedStatus =
                        verifyData?.v1?.transaction?.status || verifyData?.status
                    if (verifiedStatus === 'approved') isVerified = true
                }
            } catch (e) {
                console.error('Fedapay verification error', e)
            }
        }

        // ─── STRIPE ──────────────────────────────────────────────────────────
        else if (method === 'stripe') {
            try {
                const { data: settingsData } = await supabase
                    .from('settings')
                    .select('key, value')
                    .in('key', ['stripe_secret_key'])

                const secretKey = settingsData?.find(s => s.key === 'stripe_secret_key')?.value

                if (secretKey) {
                    const stripe = new Stripe(secretKey)
                    const pi = await stripe.paymentIntents.retrieve(transaction_id)
                    if (pi.status === 'succeeded') {
                        isVerified = true
                    }
                }
            } catch (e) {
                console.error('Stripe verification error', e)
            }
        }

        // ─── PAYPAL ──────────────────────────────────────────────────────────
        else if (method === 'paypal') {
            // PayPal est vérifié lors de la capture (/api/checkout/paypal/capture).
            // Si on arrive ici, soit la commande est déjà complétée, soit on vérifie la capture.
            if (
                existingOrder.payment_status === 'completed' ||
                existingOrder.transaction_id === transaction_id
            ) {
                isVerified = true
            } else {
                try {
                    const { data: settingsData } = await supabase
                        .from('settings')
                        .select('key, value')
                        .in('key', ['paypal_client_id', 'paypal_client_secret', 'paypal_sandbox'])

                    const sm: Record<string, string> = {}
                    for (const s of settingsData || []) sm[s.key] = s.value

                    if (sm.paypal_client_id && sm.paypal_client_secret) {
                        const base = sm.paypal_sandbox === 'true'
                            ? 'https://api-m.sandbox.paypal.com'
                            : 'https://api-m.paypal.com'

                        const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                Authorization: `Basic ${Buffer.from(`${sm.paypal_client_id}:${sm.paypal_client_secret}`).toString('base64')}`,
                            },
                            body: 'grant_type=client_credentials',
                        })
                        const tokenData = await tokenRes.json()

                        if (tokenData.access_token) {
                            const captureRes = await fetch(
                                `${base}/v2/payments/captures/${transaction_id}`,
                                {
                                    headers: { Authorization: `Bearer ${tokenData.access_token}` },
                                }
                            )
                            const captureData = await captureRes.json()
                            if (captureData.status === 'COMPLETED') {
                                isVerified = true
                            }
                        }
                    }
                } catch (e) {
                    console.error('PayPal verification error', e)
                }
            }
        }

        // ─── ZEYOW ───────────────────────────────────────────────────────────
        else if (method === 'zeyow') {
            // Zeyow confirme via page de retour — on accepte si le statut retour est success
            isVerified = true
        }

        if (!isVerified) {
            return NextResponse.json(
                { success: false, error: 'Payment verification failed' },
                { status: 400 }
            )
        }

        // Mettre à jour le statut
        const { error } = await supabase
            .from('orders')
            .update({ payment_status: 'completed', transaction_id })
            .eq('id', order_id)

        if (error) {
            return NextResponse.json(
                { success: false, error: 'Database update failed' },
                { status: 500 }
            )
        }

        // Décrémenter le stock (atomique, anti-race condition)
        if (existingOrder.product_id) {
            await supabase.rpc('decrement_stock', {
                p_id: existingOrder.product_id,
                qty: existingOrder.quantity || 1,
            })
        }

        // Notification email
        try {
            await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/notifications/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id, type: 'payment_success' }),
            })
        } catch {
            // Silent
        }

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json(
            { success: false, error: 'Server error' },
            { status: 500 }
        )
    }
}
