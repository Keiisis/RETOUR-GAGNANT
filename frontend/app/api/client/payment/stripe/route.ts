import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ZERO_DECIMAL = new Set([
    'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
    'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

export async function POST(req: NextRequest) {
    try {
        const { doc_id, user_id, email } = await req.json()

        if (!doc_id || !user_id) {
            return NextResponse.json({ error: 'doc_id et user_id requis' }, { status: 400 })
        }

        // Récupérer le document et vérifier l'accès
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

        // Clé secrète Stripe depuis settings
        const { data: settings } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['stripe_secret_key', 'stripe_sandbox'])

        const sm: Record<string, string> = {}
        for (const s of settings || []) sm[s.key] = s.value

        if (!sm.stripe_secret_key) {
            return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })
        }

        const stripe = new Stripe(sm.stripe_secret_key)
        const currency = (doc.currency || 'XOF').toUpperCase()
        const amount = ZERO_DECIMAL.has(currency) ? Math.round(doc.total) : Math.round(doc.total * 100)
        const origin = req.headers.get('origin') || 'https://retour-gagnant.com'

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            currency: currency.toLowerCase(),
            line_items: [
                {
                    price_data: {
                        currency: currency.toLowerCase(),
                        product_data: { name: `Facture ${doc.numero}` },
                        unit_amount: amount,
                    },
                    quantity: 1,
                },
            ],
            success_url: `${origin}/client/payer/${doc_id}?stripe_success=1&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/client/payer/${doc_id}?stripe_cancelled=1`,
            metadata: { doc_id, user_id },
            customer_email: email || undefined,
        })

        return NextResponse.json({ session_id: session.id, url: session.url })
    } catch (err) {
        console.error('Erreur client/payment/stripe:', err)
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur Stripe' }, { status: 500 })
    }
}

// Vérification du paiement Stripe après redirection
export async function GET(req: NextRequest) {
    try {
        const params = req.nextUrl.searchParams
        const session_id = params.get('session_id')
        const doc_id = params.get('doc_id')
        const user_id = params.get('user_id')
        const email = params.get('email') || ''

        if (!session_id || !doc_id || !user_id) {
            return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
        }

        // Vérifier l'accès au document
        const { data: doc } = await supabase
            .from('documents_financiers')
            .select('id, client_id, client_email, status')
            .eq('id', doc_id)
            .single()

        if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
        if (doc.client_id !== user_id && doc.client_email !== email) {
            return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
        }
        if (doc.status === 'paye') return NextResponse.json({ success: true, already_paid: true })

        // Récupérer la clé secrète
        const { data: settings } = await supabase
            .from('settings')
            .select('key, value')
            .eq('key', 'stripe_secret_key')

        const secretKey = settings?.[0]?.value
        if (!secretKey) return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })

        const stripe = new Stripe(secretKey)
        const session = await stripe.checkout.sessions.retrieve(session_id)

        if (session.payment_status !== 'paid') {
            return NextResponse.json({ error: 'Paiement non complété' }, { status: 400 })
        }

        // Marquer comme payé
        await supabase
            .from('documents_financiers')
            .update({
                status: 'paye',
                payment_provider: 'stripe',
                payment_transaction_id: session.payment_intent as string || session_id,
                paid_at: new Date().toISOString(),
            })
            .eq('id', doc_id)

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Erreur vérification Stripe:', err)
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur Stripe' }, { status: 500 })
    }
}
