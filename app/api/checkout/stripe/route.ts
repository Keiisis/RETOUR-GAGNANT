import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabase } from '@/lib/supabase'

// XOF et autres devises sans centimes — Stripe n'applique pas *100
const ZERO_DECIMAL = new Set([
    'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
    'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

export async function POST(request: Request) {
    try {
        const { order_id } = await request.json()

        if (!order_id) {
            return NextResponse.json({ error: 'order_id requis' }, { status: 400 })
        }

        // Récupérer la clé secrète depuis les settings Supabase
        const { data: settingsData } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['stripe_secret_key'])

        const secretKey = settingsData?.find(s => s.key === 'stripe_secret_key')?.value
        if (!secretKey) {
            return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })
        }

        // Récupérer les détails de la commande
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('amount, currency, customer_name, customer_email, payment_status')
            .eq('id', order_id)
            .single()

        if (orderError || !order) {
            return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
        }

        if (order.payment_status === 'completed') {
            return NextResponse.json({ error: 'Commande déjà payée' }, { status: 400 })
        }

        const stripe = new Stripe(secretKey)
        const currency = (order.currency || 'XOF').toUpperCase()

        // Montant selon le type de devise (XOF = zéro-décimal)
        const amount = ZERO_DECIMAL.has(currency)
            ? Math.round(order.amount)
            : Math.round(order.amount * 100)

        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: currency.toLowerCase(),
            metadata: { order_id },
            receipt_email: order.customer_email || undefined,
            description: `Retour Gagnant Bénin — Commande ${order_id.slice(0, 8).toUpperCase()}`,
        })

        // Stocker l'ID du PaymentIntent pour la vérification ultérieure
        await supabase
            .from('orders')
            .update({ transaction_id: paymentIntent.id })
            .eq('id', order_id)

        return NextResponse.json({ client_secret: paymentIntent.client_secret })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Erreur Stripe'
        console.error('Stripe PaymentIntent error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
