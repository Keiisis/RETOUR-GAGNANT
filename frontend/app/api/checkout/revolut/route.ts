// ══════════════════════════════════════════════════════════════
//  Créer une commande REVOLUT PAY pour une commande de la boutique.
//
//  Même contrat que `checkout/stripe` : le client envoie un `order_id`, le
//  serveur relit la commande EN BASE et renvoie de quoi ouvrir le widget. Le
//  montant n'est jamais accepté depuis le navigateur — c'est la règle posée
//  après l'incident des 0,39 EUR facturés au lieu de 260 EUR.
// ══════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp, rateLimitHeaders, PAYMENT_ROUTE_LIMIT } from '@/lib/rate-limit'
import { creerCommandeRevolut, DEVISES_REVOLUT } from '@/lib/revolut'
import { convertWithMargin } from '@/lib/currency-convert'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
    try {
        const ip = getClientIp(request)
        const rl = rateLimit(`revolut-order:${ip}`, PAYMENT_ROUTE_LIMIT)
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
            .in('key', ['revolut_secret_key', 'revolut_sandbox', 'revolut_currency', 'revolut_enabled'])
        const r: Record<string, string> = {}
        for (const x of reglages || []) r[x.key] = x.value || ''

        if (r.revolut_enabled !== 'true') {
            return NextResponse.json({ error: 'Revolut Pay désactivé' }, { status: 503 })
        }
        if (!r.revolut_secret_key) {
            return NextResponse.json({ error: 'Revolut non configuré (clé secrète manquante)' }, { status: 503 })
        }

        const { data: order, error } = await supabase
            .from('orders')
            .select('amount, currency, customer_name, customer_email, payment_status, payment_method')
            .eq('id', order_id)
            .single()

        if (error || !order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

        // La méthode est posée côté serveur à la création : elle n'est pas
        // falsifiable, et une commande destinée à Kkiapay ne part pas chez Revolut.
        if (order.payment_method !== 'revolut') {
            return NextResponse.json({ error: 'Commande non associée à Revolut' }, { status: 400 })
        }
        if (order.payment_status === 'completed') {
            return NextResponse.json({ error: 'Commande déjà payée' }, { status: 400 })
        }

        /* Devise d'encaissement : celle du compte Revolut Business. Revolut ne
           tient pas le franc CFA — une commande en XOF serait refusée par
           l'API. On convertit avec la marge appliquée aux autres passerelles,
           et on RENVOIE le montant réellement présenté : l'écran doit annoncer
           ce qui sera débité, pas le prix d'affichage. */
        const deviseCompte = (r.revolut_currency || 'EUR').toUpperCase()
        if (!(DEVISES_REVOLUT as readonly string[]).includes(deviseCompte)) {
            return NextResponse.json(
                { error: `Devise d'encaissement « ${deviseCompte} » non tenue par Revolut.` },
                { status: 503 },
            )
        }

        const deviseCommande = (order.currency || 'XOF').toUpperCase()
        const montant = deviseCommande === deviseCompte
            ? Number(order.amount)
            : convertWithMargin(Number(order.amount), deviseCommande, deviseCompte)

        if (!(montant > 0)) {
            return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
        }

        const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'
        const res = await creerCommandeRevolut(
            {
                secretKey: r.revolut_secret_key,
                sandbox: r.revolut_sandbox === 'true',
                devise: deviseCompte,
            },
            {
                montant,
                reference: order_id,
                description: `Retour Gagnant Benin : commande ${String(order_id).slice(0, 8).toUpperCase()}`,
                email: order.customer_email,
                nom: order.customer_name,
                redirectUrl: `${site}/boutique/payment/return?provider=revolut&order_id=${encodeURIComponent(order_id)}`,
            },
        )

        if (!res.ok || !res.data) {
            console.error('[Revolut] création de commande refusée :', res.statut, res.erreur)
            return NextResponse.json({ error: res.erreur || 'Revolut a refusé la commande' }, { status: 502 })
        }

        /* On garde l'identifiant REVOLUT, pas le jeton : le jeton est temporaire
           et ne sert qu'au widget, tandis que la vérification serveur relira la
           commande par son identifiant permanent. */
        await supabase.from('orders').update({ transaction_id: res.data.id }).eq('id', order_id)

        return NextResponse.json({
            token: res.data.token,
            order_ref: res.data.id,
            checkout_url: res.data.checkout_url || null,
            sandbox: r.revolut_sandbox === 'true',
            montant,
            devise: deviseCompte,
        })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur Revolut'
        console.error('[Revolut] erreur :', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}