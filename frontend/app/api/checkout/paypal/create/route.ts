import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit, getClientIp, rateLimitHeaders, PAYMENT_ROUTE_LIMIT } from '@/lib/rate-limit'
import { toXOFStrict, fromXOFStrict } from '@/lib/server-rates'

// Les taux viennent de la table `currencies` (lib/server-rates), jamais du
// code : les valeurs « approximatives » figées ici dérivaient du taux réel
// et faussaient chaque montant présenté à PayPal.

/**
 * Montant à présenter à PayPal, dans la devise cible.
 *
 * La commande est libellée dans SA devise (un devis peut être en EUR) :
 * on la ramène d'abord au XOF de tenue, puis vers la devise PayPal.
 * Renvoie `null` si un des deux taux manque — mieux vaut refuser le
 * paiement que débiter un montant inventé.
 */
async function montantPayPal(
    amount: number,
    fromCurrency: string,
    targetCurrency: string,
): Promise<number | null> {
    const xof = await toXOFStrict(amount, fromCurrency)
    if (xof === null) return null
    return fromXOFStrict(xof, targetCurrency)
}

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
        // ═══ RATE LIMITING ════════════════════════════════════════════
        const clientIp = getClientIp(request)
        const rl = rateLimit(`paypal-create:${clientIp}`, PAYMENT_ROUTE_LIMIT)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Trop de tentatives. Veuillez patienter avant de réessayer.' },
                { status: 429, headers: rateLimitHeaders(rl) }
            )
        }

        const body = await request.json()
        const { order_id, display_currency, display_amount } = body

        if (!order_id) {
            return NextResponse.json({ error: 'order_id requis' }, { status: 400 })
        }

        // Paramètres d'affichage optionnels transmis par le modal (devise choisie + montant converti avec marge)
        const VALID_CURRENCIES = new Set(['XOF', 'EUR', 'USD', 'GBP', 'CAD', 'CHF', 'HTG'])
        const useDisplayParams = (
            display_currency &&
            VALID_CURRENCIES.has(String(display_currency).toUpperCase()) &&
            display_amount &&
            !isNaN(parseFloat(String(display_amount))) &&
            parseFloat(String(display_amount)) > 0
        )

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

        // Devise : utiliser celle choisie par l'utilisateur si fournie, sinon la devise PayPal configurée
        const currency = useDisplayParams
            ? String(display_currency).toUpperCase()
            : (sm.paypal_currency || 'EUR').toUpperCase()

        if (!clientId || !clientSecret) {
            return NextResponse.json({ error: 'PayPal non configuré' }, { status: 503 })
        }

        // Récupérer la commande — le montant est TOUJOURS stocké en XOF dans la DB
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('amount, currency, customer_name, customer_email, payment_method, payment_status')
            .eq('id', order_id)
            .single()

        if (orderError || !order) {
            return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
        }

        // Vérifier que la commande est bien associée à PayPal (non falsifiable — défini côté serveur).
        // Empêche la création d'un PayPal order pour une commande d'un autre gateway.
        if (order.payment_method !== 'paypal') {
            console.warn(`[PayPal Create] Tentative sur commande ${order_id} (méthode: ${order.payment_method})`)
            return NextResponse.json({ error: 'Commande non associée à PayPal' }, { status: 400 })
        }

        if (order.payment_status === 'completed') {
            return NextResponse.json({ error: 'Commande déjà payée' }, { status: 400 })
        }

        // Si display_amount fourni par le modal (déjà converti avec marge 3%) → utiliser directement
        // Sinon → normaliser le montant de la commande (devise du devis, ex. EUR) en
        // XOF de base, puis reconvertir vers la devise PayPal cible.
        let rawAmount: number
        if (useDisplayParams) {
            rawAmount = parseFloat(String(display_amount))
        } else {
            const converti = await montantPayPal(order.amount, order.currency, currency)
            if (converti === null || converti <= 0) {
                return NextResponse.json(
                    { error: `Taux de change ${currency} indisponible — commande PayPal non créée.` },
                    { status: 503 }
                )
            }
            rawAmount = converti
        }
        const amountStr = ZERO_DECIMAL.has(currency)
            ? String(Math.round(rawAmount))
            : rawAmount.toFixed(2)

        const base = sandbox
            ? 'https://api-m.sandbox.paypal.com'
            : 'https://api-m.paypal.com'

        const accessToken = await getPayPalAccessToken(clientId, clientSecret, sandbox)

        const orderRes = await fetch(`${base}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'PayPal-Request-Id': order_id,
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
