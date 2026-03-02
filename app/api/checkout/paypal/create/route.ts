import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Devises sans décimales pour PayPal
const ZERO_DECIMAL = new Set([
    'JPY', 'KRW', 'VND', 'XOF', 'XAF', 'GNF', 'BIF', 'RWF', 'UGX', 'MGA', 'KMF',
])

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
    if (!data.access_token) {
        throw new Error(`PayPal auth error: ${data.error_description || 'token manquant'}`)
    }
    return data.access_token
}

export async function POST(request: Request) {
    try {
        const { order_id } = await request.json()

        if (!order_id) {
            return NextResponse.json({ error: 'order_id requis' }, { status: 400 })
        }

        // Récupérer les settings PayPal
        const { data: settingsData } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['paypal_client_id', 'paypal_client_secret', 'paypal_sandbox', 'paypal_currency'])

        const sm: Record<string, string> = {}
        for (const s of settingsData || []) sm[s.key] = s.value

        const clientId = sm.paypal_client_id
        const clientSecret = sm.paypal_client_secret
        const sandbox = sm.paypal_sandbox === 'true'
        const configCurrency = sm.paypal_currency || 'XOF'

        if (!clientId || !clientSecret) {
            return NextResponse.json({ error: 'PayPal non configuré' }, { status: 503 })
        }

        // Récupérer la commande
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('amount, currency, customer_name, customer_email')
            .eq('id', order_id)
            .single()

        if (orderError || !order) {
            return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
        }

        const currency = configCurrency.toUpperCase()
        const amountStr = ZERO_DECIMAL.has(currency)
            ? String(Math.round(order.amount))
            : order.amount.toFixed(2)

        const base = sandbox
            ? 'https://api-m.sandbox.paypal.com'
            : 'https://api-m.paypal.com'

        const accessToken = await getPayPalAccessToken(clientId, clientSecret, sandbox)

        const orderRes = await fetch(`${base}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'PayPal-Request-Id': order_id, // Clé d'idempotence
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [
                    {
                        reference_id: order_id,
                        custom_id: order_id,
                        description: `Retour Gagnant Bénin — ${order_id.slice(0, 8).toUpperCase()}`,
                        amount: {
                            currency_code: currency,
                            value: amountStr,
                        },
                    },
                ],
                application_context: {
                    brand_name: 'Retour Gagnant Bénin',
                    locale: 'fr-FR',
                    user_action: 'PAY_NOW',
                    shipping_preference: 'NO_SHIPPING',
                },
            }),
        })

        const orderData = await orderRes.json()

        if (!orderData.id) {
            console.error('PayPal create order error:', JSON.stringify(orderData))
            return NextResponse.json(
                { error: orderData.message || 'Erreur création commande PayPal' },
                { status: 500 }
            )
        }

        return NextResponse.json({ paypal_order_id: orderData.id })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Erreur PayPal'
        console.error('PayPal create error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
