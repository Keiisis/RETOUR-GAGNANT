import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp, rateLimitHeaders, PAYMENT_ROUTE_LIMIT } from '@/lib/rate-limit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// XOF et autres devises sans centimes : Stripe n'applique pas *100
const ZERO_DECIMAL = new Set([
    'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
    'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

export async function POST(request: Request) {
    try {
        // ═══ RATE LIMITING ════════════════════════════════════════════
        const clientIp = getClientIp(request)
        const rl = rateLimit(`stripe-intent:${clientIp}`, PAYMENT_ROUTE_LIMIT)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Trop de tentatives. Veuillez patienter avant de réessayer.' },
                { status: 429, headers: rateLimitHeaders(rl) }
            )
        }

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 503 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const { order_id } = await request.json()

        // Devise d'affichage optionnelle transmise par le modal (x-display-currency / x-display-amount)
        const displayCurrencyHeader = request.headers.get('x-display-currency')?.toUpperCase()
        const displayAmountHeader = request.headers.get('x-display-amount')
        const VALID_CURRENCIES = new Set(['XOF', 'EUR', 'USD', 'GBP', 'HTG'])
        const useDisplayCurrency = (
            displayCurrencyHeader &&
            VALID_CURRENCIES.has(displayCurrencyHeader) &&
            displayAmountHeader &&
            !isNaN(parseFloat(displayAmountHeader)) &&
            parseFloat(displayAmountHeader) > 0
        )
        const effectiveCurrency = useDisplayCurrency ? displayCurrencyHeader! : null
        const effectiveAmount = useDisplayCurrency ? parseFloat(displayAmountHeader!) : null

        if (!order_id) {
            return NextResponse.json({ error: 'order_id requis' }, { status: 400 })
        }

        // Récupérer la clé secrète depuis les settings Supabase (service role)
        const { data: settingsData } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['stripe_secret_key'])

        const secretKey = settingsData?.find(s => s.key === 'stripe_secret_key')?.value
        if (!secretKey) {
            return NextResponse.json({ error: 'Stripe non configuré (clé secrète manquante)' }, { status: 503 })
        }

        // Récupérer les détails de la commande
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('amount, currency, customer_name, customer_email, payment_status, payment_method')
            .eq('id', order_id)
            .single()

        if (orderError || !order) {
            return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
        }

        // Vérifier que la commande est bien associée à Stripe (défini côté serveur : non falsifiable)
        if (order.payment_method !== 'stripe') {
            console.warn(`[Stripe Intent] Tentative sur commande ${order_id} (méthode: ${order.payment_method})`)
            return NextResponse.json({ error: 'Commande non associée à Stripe' }, { status: 400 })
        }

        if (order.payment_status === 'completed') {
            return NextResponse.json({ error: 'Commande déjà payée' }, { status: 400 })
        }

        const stripe = new Stripe(secretKey)
        // Si une devise d'affichage valide est transmise, l'utiliser : sinon fallback XOF
        const currency = (effectiveCurrency || order.currency || 'XOF').toUpperCase()
        const rawAmount = effectiveAmount ?? order.amount

        // Montant selon le type de devise (XOF = zéro-décimal)
        const amount = ZERO_DECIMAL.has(currency)
            ? Math.round(rawAmount)
            : Math.round(rawAmount * 100)

        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: currency.toLowerCase(),
            metadata: { order_id },
            receipt_email: order.customer_email || undefined,
            description: `Retour Gagnant Bénin : Commande ${order_id.slice(0, 8).toUpperCase()}`,
        })

        // Stocker l'ID du PaymentIntent pour la vérification ultérieure
        const { error: updateError } = await supabase
            .from('orders')
            .update({ transaction_id: paymentIntent.id })
            .eq('id', order_id)

        if (updateError) {
            console.error('Stripe: échec mise à jour transaction_id:', updateError.message)
        }

        return NextResponse.json({ client_secret: paymentIntent.client_secret })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Erreur Stripe'
        console.error('Stripe PaymentIntent error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
