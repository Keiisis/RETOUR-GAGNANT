// ══════════════════════════════════════════════════════════════
//  Ouvrir une transaction PAYSTACK pour une commande de la boutique.
//
//  Même contrat que Stripe et Revolut : le client envoie un `order_id`, le
//  serveur relit la commande EN BASE. Le montant n'est jamais accepté depuis le
//  navigateur — règle posée après l'incident des 0,39 EUR au lieu de 260 EUR.
//
//  Paystack tient le franc CFA : aucune conversion, contrairement à Revolut.
// ══════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp, rateLimitHeaders, PAYMENT_ROUTE_LIMIT } from '@/lib/rate-limit'
import { initierPaystack, DEVISES_PAYSTACK } from '@/lib/paystack'
import { convertWithMargin } from '@/lib/currency-convert'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
    try {
        const rl = rateLimit(`paystack-init:${getClientIp(request)}`, PAYMENT_ROUTE_LIMIT)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Trop de tentatives. Veuillez patienter avant de réessayer.' },
                { status: 429, headers: rateLimitHeaders(rl) },
            )
        }
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 503 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const { order_id } = await request.json().catch(() => ({ order_id: '' }))
        if (!order_id) return NextResponse.json({ error: 'order_id requis' }, { status: 400 })

        const { data: reglages } = await supabase
            .from('settings').select('key, value')
            .in('key', ['paystack_secret_key', 'paystack_enabled', 'paystack_currency'])
        const r: Record<string, string> = {}
        for (const x of reglages || []) r[x.key] = x.value || ''

        if (r.paystack_enabled !== 'true') {
            return NextResponse.json({ error: 'Paystack désactivé' }, { status: 503 })
        }
        if (!r.paystack_secret_key) {
            return NextResponse.json({ error: 'Paystack non configuré (clé secrète manquante)' }, { status: 503 })
        }

        const { data: order, error } = await supabase
            .from('orders')
            .select('amount, currency, customer_name, customer_email, payment_status, payment_method')
            .eq('id', order_id)
            .single()

        if (error || !order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
        if (order.payment_method !== 'paystack') {
            return NextResponse.json({ error: 'Commande non associée à Paystack' }, { status: 400 })
        }
        if (order.payment_status === 'completed') {
            return NextResponse.json({ error: 'Commande déjà payée' }, { status: 400 })
        }

        /* Paystack exige une adresse e-mail : c'est son identifiant de client.
           Sans elle, l'API refuse la transaction — autant le dire clairement
           plutôt que de laisser un « échec » sans cause lisible. */
        const email = String(order.customer_email || '').trim()
        if (!email) {
            return NextResponse.json(
                { error: 'Une adresse e-mail est nécessaire pour payer avec Paystack.' },
                { status: 400 },
            )
        }

        /* Devise : celle de la commande si Paystack la tient (c'est le cas du
           XOF), sinon celle configurée, avec conversion et marge. */
        const deviseCommande = (order.currency || 'XOF').toUpperCase()
        const tenue = (DEVISES_PAYSTACK as readonly string[]).includes(deviseCommande)
        const devise = tenue ? deviseCommande : (r.paystack_currency || 'XOF').toUpperCase()
        const montant = tenue ? Number(order.amount) : convertWithMargin(Number(order.amount), deviseCommande, devise)

        if (!(montant > 0)) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })

        const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'
        const res = await initierPaystack(
            { secretKey: r.paystack_secret_key },
            {
                montant,
                devise,
                email,
                /* NOTRE identifiant de commande sert de référence : Paystack le
                   renvoie tel quel, ce qui rattache le paiement sans ambiguïté. */
                reference: order_id,
                callbackUrl: `${site}/boutique/payment/return?provider=paystack&order_id=${encodeURIComponent(order_id)}`,
            },
        )

        if (!res.ok || !res.data) {
            console.error('[Paystack] initialisation refusée :', res.erreur)
            return NextResponse.json({ error: res.erreur || 'Paystack a refusé la transaction' }, { status: 502 })
        }

        await supabase.from('orders').update({ transaction_id: res.data.reference }).eq('id', order_id)

        return NextResponse.json({
            authorization_url: res.data.authorization_url,
            access_code: res.data.access_code,
            reference: res.data.reference,
            montant,
            devise,
        })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur Paystack'
        console.error('[Paystack] erreur :', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}