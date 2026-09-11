// ══════════════════════════════════════════════════════════════
//  Ouvrir un paiement FLUTTERWAVE pour une commande de la boutique.
//
//  Flutterwave héberge sa page de paiement : la route renvoie un LIEN vers
//  lequel envoyer le client. Aucune donnée de carte ne passe par nous.
//
//  Comme ailleurs : le montant est relu EN BASE, jamais accepté du navigateur.
//  Flutterwave tient le franc CFA — aucune conversion dans le cas courant.
// ══════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp, rateLimitHeaders, PAYMENT_ROUTE_LIMIT } from '@/lib/rate-limit'
import { initierFlutterwave, DEVISES_FLUTTERWAVE, deviseDeRepliFlutterwave } from '@/lib/flutterwave'
import { convertWithMargin } from '@/lib/currency-convert'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
    try {
        const rl = rateLimit(`flutterwave-init:${getClientIp(request)}`, PAYMENT_ROUTE_LIMIT)
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
            .in('key', ['flutterwave_secret_key', 'flutterwave_enabled', 'flutterwave_currency'])
        const r: Record<string, string> = {}
        for (const x of reglages || []) r[x.key] = x.value || ''

        if (r.flutterwave_enabled !== 'true') {
            return NextResponse.json({ error: 'Flutterwave désactivé' }, { status: 503 })
        }
        if (!r.flutterwave_secret_key) {
            return NextResponse.json({ error: 'Flutterwave non configuré (clé secrète manquante)' }, { status: 503 })
        }

        const { data: order, error } = await supabase
            .from('orders')
            .select('amount, currency, customer_name, customer_email, customer_phone, payment_status, payment_method')
            .eq('id', order_id)
            .single()

        if (error || !order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
        if (order.payment_method !== 'flutterwave') {
            return NextResponse.json({ error: 'Commande non associée à Flutterwave' }, { status: 400 })
        }
        if (order.payment_status === 'completed') {
            return NextResponse.json({ error: 'Commande déjà payée' }, { status: 400 })
        }

        const email = String(order.customer_email || '').trim()
        if (!email) {
            return NextResponse.json(
                { error: 'Une adresse e-mail est nécessaire pour payer avec Flutterwave.' },
                { status: 400 },
            )
        }

        const deviseCommande = (order.currency || 'XOF').toUpperCase()
        const tenue = (DEVISES_FLUTTERWAVE as readonly string[]).includes(deviseCommande)
        const devise = tenue ? deviseCommande : deviseDeRepliFlutterwave(r.flutterwave_currency)
        const montant = tenue ? Number(order.amount) : convertWithMargin(Number(order.amount), deviseCommande, devise)

        if (!(montant > 0)) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })

        const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'
        const res = await initierFlutterwave(
            { secretKey: r.flutterwave_secret_key },
            {
                montant,
                devise,
                /* NOTRE identifiant de commande sert de `tx_ref` : il revient
                   dans la transaction vérifiée et rattache le paiement. */
                txRef: order_id,
                redirectUrl: `${site}/boutique/payment/return?provider=flutterwave&order_id=${encodeURIComponent(order_id)}`,
                email,
                nom: order.customer_name,
                telephone: order.customer_phone,
                titre: 'Retour Gagnant Bénin',
                description: `Commande ${String(order_id).slice(0, 8).toUpperCase()}`,
            },
        )

        if (!res.ok || !res.data?.link) {
            console.error('[Flutterwave] initialisation refusée :', res.erreur)
            return NextResponse.json({ error: res.erreur || 'Flutterwave a refusé le paiement' }, { status: 502 })
        }

        /* On garde NOTRE référence : l'identifiant de transaction Flutterwave
           n'existe qu'après le paiement, et il arrivera par le retour ou le
           webhook. */
        await supabase.from('orders').update({ transaction_id: order_id }).eq('id', order_id)

        return NextResponse.json({ link: res.data.link, montant, devise })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur Flutterwave'
        console.error('[Flutterwave] erreur :', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}