import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientUser } from '@/lib/client-auth'
import { guardPublic } from '@/lib/api-guard'
import { PAYMENT_ROUTE_LIMIT } from '@/lib/rate-limit'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    const trop = guardPublic(req, 'client/payment/paypal', PAYMENT_ROUTE_LIMIT)
    if (trop) return trop

    // Identité prise sur la session : « user_id » et « email » envoyés par
    // l'appelant ne prouvaient rien.
    const user = await getClientUser(req)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    try {
        const { paypal_order_id, doc_id } = await req.json()

        if (!paypal_order_id || !doc_id) {
            return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
        }

        // Vérifier l'accès au document
        const { data: doc } = await supabase
            .from('documents_financiers')
            .select('id, client_id, client_email, status')
            .eq('id', doc_id)
            .single()

        if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
        const aLui = doc.client_id === user.id
            || (!!doc.client_email && doc.client_email.toLowerCase() === user.email.toLowerCase())
        if (!aLui) {
            return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
        }
        if (doc.status === 'paye') return NextResponse.json({ success: true, already_paid: true })

        // Settings PayPal
        const { data: settings } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['paypal_client_id', 'paypal_client_secret', 'paypal_sandbox'])

        const sm: Record<string, string> = {}
        for (const s of settings || []) sm[s.key] = s.value

        if (!sm.paypal_client_id || !sm.paypal_client_secret) {
            return NextResponse.json({ error: 'PayPal non configuré' }, { status: 503 })
        }

        const sandbox = sm.paypal_sandbox === 'true'
        const { token, base } = await getPayPalToken(sm.paypal_client_id, sm.paypal_client_secret, sandbox)

        // Capturer le paiement
        const captureRes = await fetch(`${base}/v2/checkout/orders/${paypal_order_id}/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        })

        const captureData = await captureRes.json()

        if (captureData.status !== 'COMPLETED') {
            console.error('PayPal capture error:', JSON.stringify(captureData))
            return NextResponse.json({ error: captureData.message || 'Capture PayPal échouée' }, { status: 500 })
        }

        // ── La commande PayPal doit désigner CETTE facture ────────
        // /create pose reference_id ET custom_id = doc_id. Sans cette
        // relecture, une commande PayPal payée pour un autre document
        // (ou d'un autre montant) soldait celui-ci.
        const unite = captureData.purchase_units?.[0]
        const refPayPal = unite?.custom_id || unite?.reference_id
        if (refPayPal !== doc_id) {
            return NextResponse.json(
                { error: 'Cette transaction ne correspond pas à la facture.' },
                { status: 409 },
            )
        }

        // Marquer le document comme payé
        await supabase
            .from('documents_financiers')
            .update({
                status: 'paye',
                payment_provider: 'paypal',
                payment_transaction_id: paypal_order_id,
                paid_at: new Date().toISOString(),
            })
            .eq('id', doc_id)

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Erreur client/payment/paypal/capture:', err)
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur PayPal' }, { status: 500 })
    }
}
