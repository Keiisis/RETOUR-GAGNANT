// ══════════════════════════════════════════════════════════════
//  PAIEMENT D'UNE FACTURE PAR LE CLIENT (Stripe Checkout)
//
//  Deux contrôles portent tout le poids de cette route :
//   1. L'IDENTITÉ vient de la session client, jamais du corps de la
//      requête — sinon « user_id » et « email » sont de simples champs
//      que l'appelant choisit.
//   2. La session Stripe doit désigner CETTE facture (metadata.doc_id)
//      et en couvrir le montant. Sans ce lien, n'importe quelle session
//      payée — y compris de 1 000 F — soldait n'importe quelle facture.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getClientUser } from '@/lib/client-auth'
import { guardPublic } from '@/lib/api-guard'
import { PAYMENT_ROUTE_LIMIT } from '@/lib/rate-limit'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ZERO_DECIMAL = new Set([
    'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
    'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

/** Le document appartient-il bien au client connecté ? */
const estSonDocument = (
    doc: { client_id?: string | null; client_email?: string | null },
    user: { id: string; email: string },
) => doc.client_id === user.id
    || (!!doc.client_email && doc.client_email.toLowerCase() === user.email.toLowerCase())

export async function POST(req: NextRequest) {
    const trop = guardPublic(req, 'client/payment/stripe', PAYMENT_ROUTE_LIMIT)
    if (trop) return trop

    const user = await getClientUser(req)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    try {
        const { doc_id } = await req.json()

        if (!doc_id) {
            return NextResponse.json({ error: 'doc_id requis' }, { status: 400 })
        }

        // Récupérer le document et vérifier l'accès
        const { data: doc } = await supabase
            .from('documents_financiers')
            .select('id, numero, total, currency, client_id, client_email, type, status')
            .eq('id', doc_id)
            .single()

        if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
        if (!estSonDocument(doc, user)) {
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
            // metadata.doc_id : lien vérifié au retour (voir GET)
            metadata: { doc_id, user_id: user.id },
            customer_email: user.email || undefined,
        })

        return NextResponse.json({ session_id: session.id, url: session.url })
    } catch (err) {
        console.error('Erreur client/payment/stripe:', err)
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur Stripe' }, { status: 500 })
    }
}

// Vérification du paiement Stripe après redirection
export async function GET(req: NextRequest) {
    const trop = guardPublic(req, 'client/payment/stripe', PAYMENT_ROUTE_LIMIT)
    if (trop) return trop

    const user = await getClientUser(req)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    try {
        const params = req.nextUrl.searchParams
        const session_id = params.get('session_id')
        const doc_id = params.get('doc_id')

        if (!session_id || !doc_id) {
            return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
        }

        // Vérifier l'accès au document
        const { data: doc } = await supabase
            .from('documents_financiers')
            .select('id, client_id, client_email, status, total, currency')
            .eq('id', doc_id)
            .single()

        if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
        if (!estSonDocument(doc, user)) {
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

        // ── La session doit désigner CETTE facture ────────────────
        // Sans ce contrôle, un session_id payé pour 1 000 F soldait une
        // facture de 500 000 F : Stripe confirmait « payé », et la route
        // ne regardait jamais POUR QUOI.
        if (session.metadata?.doc_id !== doc_id) {
            return NextResponse.json(
                { error: 'Cette transaction ne correspond pas à la facture.' },
                { status: 409 },
            )
        }

        // ── Et en couvrir le montant ──────────────────────────────
        // amount_total est exprimé dans la plus petite unité, sauf pour
        // les devises sans décimale (XOF en fait partie) : même règle
        // qu'à la création, dans l'autre sens.
        const currency = (doc.currency || 'XOF').toUpperCase()
        const attendu = ZERO_DECIMAL.has(currency)
            ? Math.round(Number(doc.total) || 0)
            : Math.round((Number(doc.total) || 0) * 100)
        const encaisse = Number(session.amount_total) || 0

        // 2 % de tolérance : arrondis de conversion, jamais un rabais.
        if (encaisse < Math.floor(attendu * 0.98)) {
            return NextResponse.json(
                { error: 'Montant encaissé insuffisant pour cette facture.' },
                { status: 409 },
            )
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
