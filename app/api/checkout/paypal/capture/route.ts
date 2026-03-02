import { NextResponse } from 'next/server'
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
        const { paypal_order_id, order_id } = await request.json()

        if (!paypal_order_id || !order_id) {
            return NextResponse.json(
                { success: false, error: 'Paramètres manquants' },
                { status: 400 }
            )
        }

        // Idempotence — vérifier si déjà traité
        const { data: existingOrder, error: fetchErr } = await supabase
            .from('orders')
            .select('payment_status, amount, product_id, quantity')
            .eq('id', order_id)
            .single()

        if (fetchErr || !existingOrder) {
            return NextResponse.json(
                { success: false, error: 'Commande introuvable' },
                { status: 404 }
            )
        }

        if (existingOrder.payment_status === 'completed') {
            return NextResponse.json({ success: true, message: 'Déjà traité' })
        }

        // Récupérer les credentials PayPal
        const { data: settingsData } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['paypal_client_id', 'paypal_client_secret', 'paypal_sandbox'])

        const sm: Record<string, string> = {}
        for (const s of settingsData || []) sm[s.key] = s.value

        const clientId = sm.paypal_client_id
        const clientSecret = sm.paypal_client_secret
        const sandbox = sm.paypal_sandbox === 'true'

        if (!clientId || !clientSecret) {
            return NextResponse.json(
                { success: false, error: 'PayPal non configuré' },
                { status: 503 }
            )
        }

        const base = sandbox
            ? 'https://api-m.sandbox.paypal.com'
            : 'https://api-m.paypal.com'

        const accessToken = await getPayPalAccessToken(clientId, clientSecret, sandbox)

        // Capturer le paiement PayPal
        const captureRes = await fetch(
            `${base}/v2/checkout/orders/${paypal_order_id}/capture`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        )

        const captureData = await captureRes.json()

        if (captureData.status !== 'COMPLETED') {
            console.error('PayPal capture failed:', JSON.stringify(captureData))
            await supabase
                .from('orders')
                .update({ payment_status: 'failed', transaction_id: paypal_order_id })
                .eq('id', order_id)
            return NextResponse.json(
                { success: false, error: captureData.message || 'Capture PayPal échouée' },
                { status: 400 }
            )
        }

        const captureUnit = captureData.purchase_units?.[0]?.payments?.captures?.[0]
        const captureId = captureUnit?.id
        const capturedAmount = parseFloat(captureUnit?.amount?.value || '0')

        // Vérification de montant (tolérance 1% pour les arrondis)
        if (capturedAmount > 0 && capturedAmount < existingOrder.amount * 0.99) {
            console.error('PayPal amount mismatch:', { capturedAmount, expected: existingOrder.amount })
            return NextResponse.json(
                { success: false, error: 'Montant capturé incorrect' },
                { status: 400 }
            )
        }

        // Mettre à jour la commande en "completed"
        await supabase
            .from('orders')
            .update({
                payment_status: 'completed',
                transaction_id: captureId || paypal_order_id,
            })
            .eq('id', order_id)

        // Décrémenter le stock
        if (existingOrder.product_id) {
            await supabase.rpc('decrement_stock', {
                p_id: existingOrder.product_id,
                qty: existingOrder.quantity || 1,
            })
        }

        // Envoyer la notification email
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/notifications/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id, type: 'payment_success' }),
        }).catch(() => {})

        return NextResponse.json({ success: true, capture_id: captureId })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Erreur PayPal'
        console.error('PayPal capture error:', msg)
        return NextResponse.json({ success: false, error: msg }, { status: 500 })
    }
}
