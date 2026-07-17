import { NextResponse } from 'next/server'
import { createErpInvoiceForOrder } from '@/lib/erp-invoice'
import { supabase } from '@/lib/supabase'

async function getPayPalAccessToken(
    clientId: string,
    clientSecret: string,
    sandbox: boolean
): Promise<string> {
    const base = sandbox
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com'

    const res = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: 'grant_type=client_credentials',
    })
    const data = await res.json()
    if (!data.access_token) throw new Error('PayPal token error')
    return data.access_token
}

export async function POST(request: Request) {
    try {
        const body = await request.text()
        const headers: Record<string, string> = {}
        request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v })

        const eventData = JSON.parse(body)
        const eventType: string = eventData.event_type || ''

        // Récupérer les credentials pour la vérification de signature
        const { data: settingsData } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['paypal_client_id', 'paypal_client_secret', 'paypal_sandbox', 'paypal_webhook_id'])

        const sm: Record<string, string> = {}
        for (const s of settingsData || []) sm[s.key] = s.value

        const clientId = sm.paypal_client_id
        const clientSecret = sm.paypal_client_secret
        const sandbox = sm.paypal_sandbox === 'true'
        const webhookId = sm.paypal_webhook_id

        // Vérification de signature PayPal — OBLIGATOIRE (fail-closed)
        // Si les credentials sont incomplets → rejet immédiat.
        // Ne jamais traiter un webhook sans vérification cryptographique.
        if (!clientId || !clientSecret || !webhookId) {
            console.error('[PayPal Webhook] Credentials incomplets (paypal_client_id/secret/webhook_id) — rejeté')
            return NextResponse.json(
                { error: 'Webhook PayPal non configuré — ajoutez paypal_webhook_id dans les settings admin' },
                { status: 403 }
            )
        }

        try {
            const base = sandbox
                ? 'https://api-m.sandbox.paypal.com'
                : 'https://api-m.paypal.com'
            const accessToken = await getPayPalAccessToken(clientId, clientSecret, sandbox)

            const verifyRes = await fetch(
                `${base}/v1/notifications/verify-webhook-signature`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                        auth_algo: headers['paypal-auth-algo'],
                        cert_url: headers['paypal-cert-url'],
                        transmission_id: headers['paypal-transmission-id'],
                        transmission_sig: headers['paypal-transmission-sig'],
                        transmission_time: headers['paypal-transmission-time'],
                        webhook_id: webhookId,
                        webhook_event: eventData,
                    }),
                }
            )

            const verifyData = await verifyRes.json()
            if (verifyData.verification_status !== 'SUCCESS') {
                console.error('PayPal webhook signature invalid:', verifyData)
                return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
            }
        } catch (e) {
            // Fail-closed : toute erreur de vérification de signature = rejet
            // Ne JAMAIS traiter un webhook dont la signature ne peut pas être vérifiée
            console.error('[PayPal Webhook] Erreur de vérification de signature — rejeté:', e)
            return NextResponse.json(
                { error: 'Vérification de signature échouée' },
                { status: 400 }
            )
        }

        const resource = eventData.resource || {}

        switch (eventType) {
            case 'PAYMENT.CAPTURE.COMPLETED': {
                const captureId = resource.id
                const customId =
                    resource.custom_id ||
                    resource.invoice_id ||
                    resource.purchase_units?.[0]?.custom_id

                if (!customId) break

                const { data: order } = await supabase
                    .from('orders')
                    .select('payment_status, product_id, quantity, payment_method')
                    .eq('id', customId)
                    .single()

                if (!order || order.payment_status === 'completed') break

                // Vérifier que la commande est bien une commande PayPal
                if (order.payment_method !== 'paypal') {
                    console.warn(`[PayPal Webhook] Tentative sur commande ${customId} (méthode: ${order.payment_method})`)
                    break
                }

                // Garde atomique + vérification du résultat pour éviter la double-décrémentation du stock.
                // PayPal peut re-livrer le même webhook. Deux livraisons simultanées peuvent toutes deux
                // passer le check en mémoire avant que l'une n'écrive.
                // Seule la livraison qui obtient 1 ligne mise à jour doit décrémenter le stock.
                const { data: updatedPaypal } = await supabase
                    .from('orders')
                    .update({ payment_status: 'completed', transaction_id: captureId })
                    .eq('id', customId)
                    .eq('payment_status', 'pending')
                    .select('id')

                if (!updatedPaypal || updatedPaypal.length === 0) break // Déjà traité

                if (order.product_id) {
                    await supabase.rpc('decrement_stock', {
                        p_id: order.product_id,
                        qty: order.quantity || 1,
                    })
                }

                await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/notifications/order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: customId, type: 'payment_success' }),
                }).catch(() => {})

                // Facture ERP → compta (idempotent : skip si verify l'a déjà créée)
                await createErpInvoiceForOrder({ orderId: customId, method: 'paypal', transactionId: captureId })
                break
            }

            case 'PAYMENT.CAPTURE.DENIED':
            case 'PAYMENT.CAPTURE.DECLINED': {
                const customId = resource.custom_id
                if (customId) {
                    // Garde atomique : ne jamais écraser une commande déjà complétée
                    await supabase
                        .from('orders')
                        .update({ payment_status: 'failed', transaction_id: resource.id })
                        .eq('id', customId)
                        .eq('payment_status', 'pending')
                }
                break
            }

            case 'PAYMENT.CAPTURE.REFUNDED': {
                const customId = resource.custom_id
                if (customId) {
                    // Remboursement : ne s'applique qu'à une commande déjà complétée
                    await supabase
                        .from('orders')
                        .update({ payment_status: 'refunded', transaction_id: resource.id })
                        .eq('id', customId)
                        .eq('payment_status', 'completed')
                }
                break
            }

            default:
                break
        }

        return NextResponse.json({ ok: true, event_type: eventType })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Webhook error'
        console.error('PayPal webhook error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
