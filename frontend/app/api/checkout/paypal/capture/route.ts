import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit, getClientIp, rateLimitHeaders, PAYMENT_ROUTE_LIMIT } from '@/lib/rate-limit'
import { toXOFStrict, fromXOFStrict } from '@/lib/server-rates'

// Les taux viennent de la table `currencies` via lib/server-rates.
// L'ancienne table locale (USD à 600 au lieu de 574,71) faisait rejeter
// des paiements légitimes — et acceptait des montants faux dans l'autre
// sens dès que le taux réel s'en écartait.

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
        // ═══ RATE LIMITING ════════════════════════════════════════════
        const clientIp = getClientIp(request)
        const rl = rateLimit(`paypal-capture:${clientIp}`, PAYMENT_ROUTE_LIMIT)
        if (!rl.allowed) {
            return NextResponse.json(
                { success: false, error: 'Trop de tentatives. Veuillez patienter avant de réessayer.' },
                { status: 429, headers: rateLimitHeaders(rl) }
            )
        }

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
            // `currency` est indispensable : sans elle, un montant en EUR
            // était comparé comme s'il était en XOF.
            .select('payment_status, amount, currency, product_id, quantity, payment_method')
            .eq('id', order_id)
            .single()

        if (fetchErr || !existingOrder) {
            return NextResponse.json(
                { success: false, error: 'Commande introuvable' },
                { status: 404 }
            )
        }

        // Vérifier que la commande est bien associée à PayPal (défini côté serveur — non falsifiable)
        if (existingOrder.payment_method !== 'paypal') {
            console.warn(`[PayPal Capture] Tentative sur commande ${order_id} (méthode: ${existingOrder.payment_method})`)
            return NextResponse.json(
                { success: false, error: 'Méthode de paiement incorrecte pour cette commande' },
                { status: 400 }
            )
        }

        if (existingOrder.payment_status === 'completed') {
            return NextResponse.json({ success: true, message: 'Déjà traité' })
        }

        // Récupérer les credentials et la devise PayPal configurée
        const { data: settingsData } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['paypal_client_id', 'paypal_client_secret', 'paypal_sandbox', 'paypal_currency'])

        const sm: Record<string, string> = {}
        for (const s of settingsData || []) sm[s.key] = s.value

        const clientId = sm.paypal_client_id
        const clientSecret = sm.paypal_client_secret
        const sandbox = sm.paypal_sandbox === 'true'
        const paypalCurrency = (sm.paypal_currency || 'EUR').toUpperCase()

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
            // Garde atomique : ne jamais écraser une commande déjà complétée.
            // Scénario : deux appels simultanés, le premier capture et complete l'ordre,
            // le second reçoit "ORDER_ALREADY_CAPTURED" de PayPal et ne doit pas écraser 'completed'.
            await supabase
                .from('orders')
                .update({ payment_status: 'failed', transaction_id: paypal_order_id })
                .eq('id', order_id)
                .eq('payment_status', 'pending')
            return NextResponse.json(
                { success: false, error: captureData.message || 'Capture PayPal échouée' },
                { status: 400 }
            )
        }

        const captureUnit = captureData.purchase_units?.[0]?.payments?.captures?.[0]
        const captureId = captureUnit?.id
        const capturedAmount = parseFloat(captureUnit?.amount?.value || '0')
        // Utiliser la devise réellement capturée (pas la config admin) car l'utilisateur
        // peut choisir une devise différente via le modal (ex: USD au lieu de EUR)
        const capturedCurrency = (captureUnit?.amount?.currency_code || paypalCurrency).toUpperCase()

        // ── Montant attendu, calculé avec les taux réels ──────────
        // Deux conversions successives : la commande est libellée dans SA
        // devise (ex. un devis en EUR), on la ramène au XOF de tenue, puis
        // vers la devise réellement capturée par PayPal.
        const xofBase = await toXOFStrict(existingOrder.amount, existingOrder.currency)
        const expectedPaypalAmount = xofBase === null
            ? null
            : await fromXOFStrict(xofBase, capturedCurrency)

        if (expectedPaypalAmount === null || expectedPaypalAmount <= 0) {
            return NextResponse.json(
                { success: false, error: `Taux de change ${capturedCurrency} indisponible — capture non validée.` },
                { status: 503 }
            )
        }

        // On refuse le SOUS-paiement, pas le sur-paiement : le modal peut
        // appliquer une marge de conversion de 3 %, et un client qui paie
        // plus que dû ne doit pas voir sa commande rejetée.
        // 2 % de tolérance basse couvre les arrondis de conversion.
        const minimumAccepte = expectedPaypalAmount * 0.98 - 0.02
        if (capturedAmount <= 0 || capturedAmount < minimumAccepte) {
            console.error('[PayPal Capture] Montant incorrect:', {
                capturedAmount,
                expectedPaypalAmount,
                orderAmountXof: existingOrder.amount,
                capturedCurrency,
                diff: Math.abs(capturedAmount - expectedPaypalAmount),
            })
            return NextResponse.json(
                { success: false, error: 'Montant capturé incorrect — paiement rejeté' },
                { status: 400 }
            )
        }

        // Mettre à jour la commande en "completed" — garde atomique anti-race condition
        await supabase
            .from('orders')
            .update({
                payment_status: 'completed',
                transaction_id: captureId || paypal_order_id,
            })
            .eq('id', order_id)
            .eq('payment_status', 'pending')

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
