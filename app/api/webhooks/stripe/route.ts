import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabase } from '@/lib/supabase'

// Next.js App Router — désactiver le body parser pour lire le raw body
export const runtime = 'nodejs'

export async function POST(request: Request) {
    try {
        const body = await request.text()
        const sig = request.headers.get('stripe-signature')

        // Récupérer la clé secrète et le webhook secret
        const { data: settingsData } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['stripe_secret_key', 'stripe_webhook_secret'])

        const sm: Record<string, string> = {}
        for (const s of settingsData || []) sm[s.key] = s.value

        const secretKey = sm.stripe_secret_key
        const webhookSecret = sm.stripe_webhook_secret

        if (!secretKey) {
            return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })
        }

        const stripe = new Stripe(secretKey)

        let event: Stripe.Event

        // Vérification de la signature du webhook
        if (webhookSecret && sig) {
            try {
                event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Signature invalide'
                console.error('Stripe webhook signature error:', msg)
                return NextResponse.json({ error: `Signature invalide: ${msg}` }, { status: 400 })
            }
        } else {
            // Sans secret configuré, parse sans vérification (à configurer en production)
            event = JSON.parse(body) as Stripe.Event
        }

        switch (event.type) {
            case 'payment_intent.succeeded': {
                const pi = event.data.object as Stripe.PaymentIntent
                const orderId = pi.metadata?.order_id
                if (!orderId) break

                // Idempotence
                const { data: order } = await supabase
                    .from('orders')
                    .select('payment_status, product_id, quantity')
                    .eq('id', orderId)
                    .single()

                if (!order || order.payment_status === 'completed') break

                await supabase
                    .from('orders')
                    .update({ payment_status: 'completed', transaction_id: pi.id })
                    .eq('id', orderId)

                if (order.product_id) {
                    await supabase.rpc('decrement_stock', {
                        p_id: order.product_id,
                        qty: order.quantity || 1,
                    })
                }

                await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/notifications/order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: orderId, type: 'payment_success' }),
                }).catch(() => {})
                break
            }

            case 'payment_intent.payment_failed': {
                const pi = event.data.object as Stripe.PaymentIntent
                const orderId = pi.metadata?.order_id
                if (orderId) {
                    await supabase
                        .from('orders')
                        .update({ payment_status: 'failed', transaction_id: pi.id })
                        .eq('id', orderId)
                }
                break
            }

            case 'charge.refunded': {
                const charge = event.data.object as Stripe.Charge
                const pi = charge.payment_intent as string | null
                if (pi) {
                    await supabase
                        .from('orders')
                        .update({ payment_status: 'refunded' })
                        .eq('transaction_id', pi)
                }
                break
            }

            default:
                // Évènement non géré — on répond 200 pour que Stripe ne retry pas
                break
        }

        return NextResponse.json({ ok: true, event_type: event.type })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Webhook error'
        console.error('Stripe webhook error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
