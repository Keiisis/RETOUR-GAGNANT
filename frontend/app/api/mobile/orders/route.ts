import { NextRequest, NextResponse } from 'next/server'
import { sendInvoiceEmail } from '@/lib/send-invoice-email'
import { ttcFromHt } from '@/lib/tax'
import { toXOFStrict } from '@/lib/server-rates'
import { getMobileUserId } from '@/lib/mobile-auth'
import { supabaseServeur as supabase } from '@/lib/supabase-serveur'
import {
    verifierKkiapay, montantCouvert, usagesTransaction,
    emailDuProfil, motifOuRien, estUuid,
} from '@/lib/mobile-paiement'

/* ════════════════════════════════════════════════════════════════════════════
   Mobile orders endpoint.
   - POST  : create boutique order after Kkiapay success (verify + decrement stock)
   - GET   : list current client's orders, detail (?order_id=), OR search by
             tracking_code (?tracking=xxx, public : le code fait office de secret)

   ⚠️ `orders` N'A PAS de colonne `client_id` (schéma PostgREST vérifié le
   2026-09-28). Cette route l'insérait et filtrait dessus : toute commande
   mobile échouait en 500 APRÈS encaissement, la liste « Mes commandes »
   aussi, et le détail répondait 404 (la garde de propriété lisait la même
   colonne absente). L'appartenance se fait donc par `customer_email`, pris
   sur le PROFIL rattaché au jeton, comparé sans jokers (motifEmailExact).
   ════════════════════════════════════════════════════════════════════════════ */

interface CartItemPayload {
    product_id: string
    title?: string
    quantity: number
    unit_price?: number
}

interface ShippingPayload {
    address?: string | null
    city?: string | null
    postal?: string | null
    country?: string | null
    notes?: string | null
}

interface OrderBody {
    customer_name: string
    customer_phone: string
    customer_email?: string | null
    cart_items: CartItemPayload[]
    amount?: number
    transaction_id: string
    shipping?: ShippingPayload
}

const CHAMPS_DETAIL = `
    id, customer_name, customer_email, customer_phone,
    amount, currency, payment_method, payment_status, transaction_id,
    cart_items, product_title, source,
    shipping_address, shipping_city, shipping_postal, shipping_country, shipping_notes,
    tracking_code, tracking_carrier, tracking_url, shipping_status,
    shipped_at, delivered_at, created_at, updated_at
`

const texte = (v: unknown, max = 300) => String(v ?? '').trim().slice(0, max)

// ─── GET : list client orders OR search by tracking_code ────────────────────
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const tracking = searchParams.get('tracking')
        const orderId = searchParams.get('order_id')

        // 1. Suivi par code (public) : le code fait office de secret.
        if (tracking) {
            const code = tracking.trim().toUpperCase().slice(0, 64)
            const { data: order, error } = await supabase
                .from('orders')
                .select(`
                    id, customer_name, amount, currency,
                    cart_items, product_title, payment_status,
                    shipping_city, shipping_country,
                    tracking_code, tracking_carrier, tracking_url, shipping_status,
                    shipped_at, delivered_at, created_at
                `)
                .eq('tracking_code', code)
                .maybeSingle()
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            if (!order) return NextResponse.json({ found: false }, { status: 200 })

            const { data: events } = await supabase
                .from('order_tracking_events')
                .select('id, status, label, description, location, created_at')
                .eq('order_id', order.id)
                .order('created_at', { ascending: false })

            return NextResponse.json({ found: true, order, events: events || [] })
        }

        // Tout le reste exige l'identité dérivée du JETON (anti-IDOR).
        const clientId = await getMobileUserId(req)
        if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
        const email = await emailDuProfil(supabase, clientId)

        // 2. Détail : uniquement SA commande (sinon 404, sans rien révéler).
        if (orderId) {
            if (!estUuid(orderId) || !email) {
                return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
            }
            const { data: order, error } = await supabase
                .from('orders')
                .select(CHAMPS_DETAIL)
                .eq('id', orderId)
                .ilike('customer_email', motifOuRien(email))
                .maybeSingle()
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

            const { data: events, error: evErr } = await supabase
                .from('order_tracking_events')
                .select('id, status, label, description, location, created_at')
                .eq('order_id', orderId)
                .order('created_at', { ascending: false })
            if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 })

            return NextResponse.json({ order, events: events || [] })
        }

        // 3. Liste : les commandes passées avec l'email du compte.
        if (!email) return NextResponse.json({ orders: [] })
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id, amount, currency, payment_method, payment_status, transaction_id,
                cart_items, product_title, source,
                tracking_code, tracking_carrier, shipping_status,
                shipped_at, delivered_at, created_at
            `)
            .ilike('customer_email', motifOuRien(email))
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ orders: orders || [] })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

// ─── POST : create order after Kkiapay success ──────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = (await req.json().catch(() => ({}))) as OrderBody

        // Identité : le jeton, jamais un client_id du corps. Sans jeton, commande
        // invitée (email saisi) : le paiement reste vérifié plus bas.
        const authUid = await getMobileUserId(req)
        const emailProfil = authUid ? await emailDuProfil(supabase, authUid) : ''

        const transactionId = texte(body.transaction_id, 128)
        if (!transactionId) {
            return NextResponse.json({ error: 'transaction_id manquant' }, { status: 400 })
        }
        if (!texte(body.customer_name) || !texte(body.customer_phone)) {
            return NextResponse.json({ error: 'customer_name et customer_phone requis' }, { status: 400 })
        }
        if (!Array.isArray(body.cart_items) || body.cart_items.length === 0) {
            return NextResponse.json({ error: 'cart_items vide' }, { status: 400 })
        }
        if (body.cart_items.length > 50) {
            return NextResponse.json({ error: 'Trop d\'articles (max 50)' }, { status: 400 })
        }
        if (body.cart_items.some(c => !estUuid(c?.product_id))) {
            return NextResponse.json({ error: 'Produit invalide' }, { status: 400 })
        }

        // Idempotence : rejeu de la même transaction (file de reprise mobile).
        const { data: existing, error: exErr } = await supabase
            .from('orders')
            .select('id, payment_status, customer_email')
            .eq('transaction_id', transactionId)
            .maybeSingle()
        if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })
        if (existing) {
            const aLui = !emailProfil
                || String(existing.customer_email || '').trim().toLowerCase() === emailProfil
            if (existing.payment_status === 'completed' && aLui) {
                return NextResponse.json({ ok: true, order_id: existing.id, message: 'Already processed' })
            }
            return NextResponse.json({ error: 'Transaction déjà utilisée' }, { status: 409 })
        }

        // Transaction déjà consommée par un autre parcours (billet, dossier, facture…).
        const { usages, erreur: errUsage } = await usagesTransaction(supabase, transactionId)
        if (errUsage) return NextResponse.json({ error: 'Vérification indisponible' }, { status: 503 })
        if (usages.length > 0) {
            return NextResponse.json({ error: 'Transaction déjà utilisée' }, { status: 409 })
        }

        // Verify payment
        const verify = await verifierKkiapay(supabase, transactionId)
        if (!verify.ok) {
            return NextResponse.json(
                { error: `Paiement non confirmé (${verify.status})` },
                { status: 402 }
            )
        }

        // Montant recalculé depuis les prix EN BASE (jamais ceux du téléphone).
        const productIds = [...new Set(body.cart_items.map(c => c.product_id))]
        const { data: dbProducts, error: prodErr } = await supabase
            .from('products')
            .select('id, price, sale_price, currency, stock, is_active, title')
            .in('id', productIds)
        if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 })

        if (!dbProducts || dbProducts.length !== productIds.length) {
            return NextResponse.json({ error: 'Un ou plusieurs produits introuvables' }, { status: 400 })
        }

        let totalHtXof = 0
        const lignes: Array<{ product_id: string; title: string; quantity: number; unit_price: number; currency: string }> = []
        for (const item of body.cart_items) {
            const p = dbProducts.find(d => d.id === item.product_id)
            if (!p) return NextResponse.json({ error: `Produit ${item.product_id} introuvable` }, { status: 400 })
            if (!p.is_active) return NextResponse.json({ error: `Produit "${p.title}" indisponible` }, { status: 400 })
            const qty = parseInt(String(item.quantity), 10)
            if (!Number.isFinite(qty) || qty < 1 || qty > 1000) {
                return NextResponse.json({ error: `Quantité invalide pour "${p.title}"` }, { status: 400 })
            }
            if (Number(p.stock) < qty) {
                return NextResponse.json({ error: `Stock insuffisant pour "${p.title}" (reste ${p.stock})` }, { status: 400 })
            }
            const unit = (p.sale_price && p.sale_price < p.price) ? Number(p.sale_price) : Number(p.price)
            const unitXof = await toXOFStrict(unit, p.currency || 'XOF')
            if (unitXof === null) {
                return NextResponse.json({ error: `Devise non prise en charge pour "${p.title}"` }, { status: 400 })
            }
            totalHtXof += unitXof * qty
            lignes.push({ product_id: p.id, title: String(p.title || ''), quantity: qty, unit_price: unitXof, currency: 'XOF' })
        }

        /* TVA « en sus » (lib/tax) : le client paie le TTC. On accepte encore un
           encaissement au HT (ancienne version de l'app, avant la TVA en sus),
           mais c'est le MONTANT ENCAISSÉ par la passerelle qui tranche — plus
           le montant annoncé par le téléphone. */
        const totalTtcXof = ttcFromHt(totalHtXof, 'XOF')
        let chargedAmount: number
        if (montantCouvert(verify.montant, totalTtcXof)) chargedAmount = totalTtcXof
        else if (montantCouvert(verify.montant, totalHtXof)) chargedAmount = totalHtXof
        else {
            console.warn(`[mobile/orders] Montant insuffisant : ${verify.montant} XOF reçus pour ${totalTtcXof} XOF (tx ${transactionId})`)
            return NextResponse.json(
                { error: `Montant encaissé insuffisant (${verify.montant} XOF pour ${totalTtcXof} XOF). Référence : ${transactionId}` },
                { status: 402 },
            )
        }

        // L'email du COMPTE porte la commande (c'est lui qui la retrouve dans
        // « Mes commandes ») ; sans compte, l'email saisi.
        const emailSaisi = texte(body.customer_email, 254).toLowerCase() || null
        const emailCommande = emailProfil || emailSaisi
        const shipping = body.shipping || {}
        const orderPayload = {
            customer_name: texte(body.customer_name, 200),
            customer_phone: texte(body.customer_phone, 40),
            customer_email: emailCommande,
            amount: chargedAmount,
            currency: 'XOF',
            payment_method: 'kkiapay',
            payment_status: 'completed',
            transaction_id: transactionId,
            cart_items: lignes,
            product_title: lignes.length === 1 ? lignes[0].title : `${lignes.length} articles`,
            quantity: lignes.reduce((s, l) => s + l.quantity, 0),
            source: 'mobile',
            shipping_address: texte(shipping.address) || null,
            shipping_city: texte(shipping.city, 120) || null,
            shipping_postal: texte(shipping.postal, 20) || null,
            shipping_country: texte(shipping.country, 80) || null,
            shipping_notes: texte(shipping.notes, 1000) || null,
            shipping_status: 'preparing',
        }
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .insert(orderPayload)
            .select('id')
            .single()

        if (orderErr || !order) {
            console.error('[mobile/orders] Insert error:', orderErr?.message)
            return NextResponse.json({ error: orderErr?.message || 'Erreur création commande' }, { status: 500 })
        }

        // Stock decrement (quantités validées ci-dessus, pas celles du corps brut)
        for (const l of lignes) {
            const p = dbProducts.find(d => d.id === l.product_id)
            if (!p) continue
            const { error: stockErr } = await supabase
                .from('products')
                .update({ stock: Math.max(0, Number(p.stock) - l.quantity) })
                .eq('id', l.product_id)
            if (stockErr) console.error('[mobile/orders] stock non décrémenté :', l.product_id, stockErr.message)
        }

        // Initial tracking event (preparation started)
        const { error: trkErr } = await supabase.from('order_tracking_events').insert({
            order_id: order.id,
            status: 'preparing',
            label: 'Commande en préparation',
            description: 'Votre commande a été confirmée et est en cours de préparation par notre équipe.',
        })
        if (trkErr) console.error('[mobile/orders] suivi initial non créé :', trkErr.message)

        // ── Envoi email facture (best-effort, ne bloque pas la réponse) ──
        const destinataire = emailSaisi || emailProfil
        if (destinataire) {
            const baseUrl = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'
            sendInvoiceEmail({
                orderId: order.id,
                toEmail: destinataire,
                baseUrl,
            }).catch(e => console.error('[mobile/orders] sendInvoiceEmail failed:', e))
        }

        return NextResponse.json({ ok: true, order_id: order.id, amount: chargedAmount, currency: 'XOF' })
    } catch (e) {
        console.error('[mobile/orders] Exception:', e)
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
