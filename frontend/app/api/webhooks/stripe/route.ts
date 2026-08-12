import { NextResponse } from 'next/server'
import { createErpInvoiceForOrder } from '@/lib/erp-invoice'
import Stripe from 'stripe'
import { supabase } from '@/lib/supabase'

// Next.js App Router : désactiver le body parser pour lire le raw body
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

        // Vérification de la signature du webhook : OBLIGATOIRE
        // Accepter un webhook non signé serait une porte ouverte à la fraude
        if (!webhookSecret) {
            console.error('[Stripe Webhook] stripe_webhook_secret non configuré : rejeté')
            return NextResponse.json(
                { error: 'Webhook Stripe non configuré : configurez stripe_webhook_secret dans les settings admin' },
                { status: 403 }
            )
        }

        if (!sig) {
            console.error('[Stripe Webhook] En-tête stripe-signature manquant')
            return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
        }

        try {
            event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Signature invalide'
            console.error('[Stripe Webhook] Signature invalide:', msg)
            return NextResponse.json({ error: `Signature invalide: ${msg}` }, { status: 400 })
        }

        switch (event.type) {
            case 'payment_intent.succeeded': {
                const pi = event.data.object as Stripe.PaymentIntent
                const orderId = pi.metadata?.order_id
                if (!orderId) break

                const { data: order } = await supabase
                    .from('orders')
                    .select('payment_status, product_id, quantity, payment_method')
                    .eq('id', orderId)
                    .single()

                if (!order) break

                // Vérifier que c'est bien une commande Stripe (non falsifiable : défini côté serveur).
                // Empêche un PaymentIntent créé avec un order_id arbitraire en metadata de compléter
                // une commande d'un autre gateway.
                if (order.payment_method !== 'stripe') {
                    console.warn(`[Stripe Webhook] payment_intent.succeeded: commande ${orderId} n'est pas Stripe (méthode: ${order.payment_method})`)
                    break
                }

                if (order.payment_status === 'completed') break

                // Garde atomique + lecture du résultat pour éviter la double-décrémentation du stock.
                // Stripe peut re-livrer le même webhook. Si deux livraisons arrivent simultanément,
                // seule celle qui passe le filtre .eq('payment_status', 'pending') mettra à jour la DB.
                const { data: updated } = await supabase
                    .from('orders')
                    .update({ payment_status: 'completed', transaction_id: pi.id })
                    .eq('id', orderId)
                    .eq('payment_status', 'pending')
                    .select('id')

                // Aucune ligne mise à jour = déjà traité par une autre livraison du webhook → ne pas décrémenter
                if (!updated || updated.length === 0) break

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

                // Facture ERP → compta (idempotent : skip si verify l'a déjà créée)
                await createErpInvoiceForOrder({ orderId, method: 'stripe', transactionId: pi.id })
                break
            }

            case 'payment_intent.payment_failed': {
                const pi = event.data.object as Stripe.PaymentIntent
                const orderId = pi.metadata?.order_id
                if (orderId) {
                    // Vérifier payment_method avant toute mise à jour
                    const { data: failOrder } = await supabase
                        .from('orders')
                        .select('payment_method')
                        .eq('id', orderId)
                        .single()

                    if (!failOrder || failOrder.payment_method !== 'stripe') break

                    // Garde atomique : ne jamais écraser une commande déjà complétée
                    await supabase
                        .from('orders')
                        .update({ payment_status: 'failed', transaction_id: pi.id })
                        .eq('id', orderId)
                        .eq('payment_status', 'pending')
                }
                break
            }

            case 'charge.refunded': {
                const charge = event.data.object as Stripe.Charge
                const pi = charge.payment_intent as string | null
                if (pi) {
                    // Garde : un remboursement ne peut s'appliquer qu'à une commande déjà complétée.
                    // .eq('payment_status', 'completed') empêche d'écraser un statut 'pending' ou 'failed'.
                    await supabase
                        .from('orders')
                        .update({ payment_status: 'refunded' })
                        .eq('transaction_id', pi)
                        .eq('payment_status', 'completed')
                }
                break
            }

            default:
                // Évènement non géré : on répond 200 pour que Stripe ne retry pas
                break
        }

        return NextResponse.json({ ok: true, event_type: event.type })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Webhook error'
        console.error('Stripe webhook error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
