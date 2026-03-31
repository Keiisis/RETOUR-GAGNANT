import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const XOF_TO: Record<string, number> = {
    EUR: 655.957,
    USD: 600,
    GBP: 760,
    CAD: 440,
    CHF: 720,
}

function convertFromXOF(amount: number, targetCurrency: string): number {
    if (targetCurrency === 'XOF') return Math.round(amount)
    const rate = XOF_TO[targetCurrency]
    if (!rate) throw new Error(`Devise non supportée: ${targetCurrency}`)
    return Math.round((amount / rate) * 100) / 100
}

async function getPayPalToken(clientId: string, secret: string, sandbox: boolean) {
    const base = sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
    const res = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
        },
        body: 'grant_type=client_credentials',
    })
    const data = await res.json()
    if (!data.access_token) throw new Error(`PayPal auth error: ${data.error_description}`)
    return { token: data.access_token, base }
}

export async function POST(req: NextRequest) {
    try {
        const { doc_id, user_id, email } = await req.json()

        if (!doc_id || !user_id) {
            return NextResponse.json({ error: 'doc_id et user_id requis' }, { status: 400 })
        }

        // Vérifier l'accès au document
        const { data: doc } = await supabase
            .from('documents_financiers')
            .select('id, numero, total, currency, client_id, client_email, type, status')
            .eq('id', doc_id)
            .single()

        if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
        if (doc.client_id !== user_id && doc.client_email !== email) {
            return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
        }
        if (doc.type !== 'facture') return NextResponse.json({ error: 'Pas une facture' }, { status: 400 })
        if (doc.status === 'paye') return NextResponse.json({ error: 'Déjà payé' }, { status: 400 })

        // Settings PayPal
        const { data: settings } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['paypal_client_id', 'paypal_client_secret', 'paypal_sandbox', 'paypal_currency'])

        const sm: Record<string, string> = {}
        for (const s of settings || []) sm[s.key] = s.value

        if (!sm.paypal_client_id || !sm.paypal_client_secret) {
            return NextResponse.json({ error: 'PayPal non configuré' }, { status: 503 })
        }

        const sandbox = sm.paypal_sandbox === 'true'
        const currency = (sm.paypal_currency || 'EUR').toUpperCase()
        const convertedAmount = convertFromXOF(doc.total, currency)
        const amountStr = convertedAmount.toFixed(2)

        const { token, base } = await getPayPalToken(sm.paypal_client_id, sm.paypal_client_secret, sandbox)

        const origin = req.headers.get('origin') || 'https://retour-gagnant.com'

        const orderRes = await fetch(`${base}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                'PayPal-Request-Id': `facture-${doc_id}`,
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [
                    {
                        reference_id: doc_id,
                        custom_id: doc_id,
                        description: `Facture ${doc.numero} — Retour Gagnant Bénin`,
                        amount: { currency_code: currency, value: amountStr },
                    },
                ],
                application_context: {
                    brand_name: 'Retour Gagnant Bénin',
                    locale: 'fr-FR',
                    user_action: 'PAY_NOW',
                    shipping_preference: 'NO_SHIPPING',
                    return_url: `${origin}/client/payer/${doc_id}?paypal_success=1`,
                    cancel_url: `${origin}/client/payer/${doc_id}?paypal_cancelled=1`,
                },
            }),
        })

        const orderData = await orderRes.json()
        if (!orderData.id) {
            console.error('PayPal create error:', JSON.stringify(orderData))
            return NextResponse.json({ error: orderData.message || 'Erreur PayPal' }, { status: 500 })
        }

        const approveLink = orderData.links?.find((l: any) => l.rel === 'approve')?.href
        return NextResponse.json({ paypal_order_id: orderData.id, approve_url: approveLink })
    } catch (err) {
        console.error('Erreur client/payment/paypal/create:', err)
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur PayPal' }, { status: 500 })
    }
}
