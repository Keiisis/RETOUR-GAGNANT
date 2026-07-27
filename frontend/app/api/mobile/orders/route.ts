import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendInvoiceEmail } from '@/lib/send-invoice-email'
import { ttcFromHt } from '@/lib/tax'
import { assertOwnership, createSupabaseOwnershipResolver } from '@/lib/waf'
import { getMobileUserId } from '@/lib/mobile-auth'

/* ════════════════════════════════════════════════════════════════════════════
   Mobile orders endpoint.
   - POST  : create boutique order after Kkiapay success (verify + decrement stock)
   - GET   : list current client's orders, OR search by tracking_code (?tracking=xxx)
   ════════════════════════════════════════════════════════════════════════════ */

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CartItemPayload {
    product_id: string
    title: string
    quantity: number
    unit_price: number
}

interface ShippingPayload {
    address?: string | null
    city?: string | null
    postal?: string | null
    country?: string | null
    notes?: string | null
}

interface OrderBody {
    client_id?: string | null
    customer_name: string
    customer_phone: string
    customer_email?: string | null
    cart_items: CartItemPayload[]
    amount: number
    currency?: string
    transaction_id: string
    shipping?: ShippingPayload
}

// ── Verify a Kkiapay transaction server-side ─────────────────────────────────
async function verifyKkiapayTransaction(transactionId: string): Promise<{ ok: boolean; status: string; amount?: number }> {
    const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['kkiapay_private_key', 'kkiapay_secret_key', 'kkiapay_sandbox'])
    const privateKey = settings?.find(s => s.key === 'kkiapay_private_key')?.value
    const secretKey = settings?.find(s => s.key === 'kkiapay_secret_key')?.value
    const sandbox = settings?.find(s => s.key === 'kkiapay_sandbox')?.value === 'true'
    const apiUrl = sandbox
        ? 'https://api-sandbox.kkiapay.me/api/v1/transactions/status'
        : 'https://api.kkiapay.me/api/v1/transactions/status'

    if (!privateKey || !secretKey) {
        return { ok: false, status: 'config_missing' }
    }

    try {
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-private-key': String(privateKey),
                'x-secret-key': String(secretKey),
            },
            body: JSON.stringify({ transactionId }),
        })
        if (!res.ok) return { ok: false, status: `kkiapay_http_${res.status}` }
        const data = await res.json()
        const isSuccess = data?.status === 'SUCCESS'
        return { ok: isSuccess, status: data?.status || 'unknown', amount: data?.amount }
    } catch (e) {
        return { ok: false, status: e instanceof Error ? e.message : 'verify_failed' }
    }
}

// ─── GET : list client orders OR search by tracking_code ────────────────────
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const tracking = searchParams.get('tracking')
        const orderId = searchParams.get('order_id')
        // Suivi par code = public (le code fait office de secret). Tout le reste
        // exige l'identité dérivée du JETON (anti-IDOR) — on ignore tout client_id fourni.
        const clientId = tracking ? null : await getMobileUserId(req)
        if (!tracking && !clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        // 1. Detail by order_id
        if (orderId) {
            // ── WAF #1 : autorisation objet (anti-IDOR/BOLA) ──────────────
            // Sans ça, incrémenter order_id permettait de lire les PII (nom,
            // email, téléphone, adresse) de N'IMPORTE QUELLE commande.
            // On exige le client_id du demandeur et on vérifie qu'il possède
            // bien la commande. rejectMode 'deceive' → 404 (ne révèle pas
            // l'existence de la commande à un non-propriétaire).
            if (!clientId) {
                return NextResponse.json({ error: 'client_id requis' }, { status: 400 })
            }
            const { rejection } = await assertOwnership({
                userId: clientId,
                resourceType: 'order',
                resourceId: orderId,
                resolver: createSupabaseOwnershipResolver(supabase),
                rejectMode: 'deceive',
            })
            if (rejection) return rejection

            const { data: order, error } = await supabase
                .from('orders')
                .select(`
                    id, client_id, customer_name, customer_email, customer_phone,
                    amount, currency, payment_method, payment_status, transaction_id,
                    cart_items, product_title, source,
                    shipping_address, shipping_city, shipping_postal, shipping_country, shipping_notes,
                    tracking_code, tracking_carrier, tracking_url, shipping_status,
                    shipped_at, delivered_at, created_at, updated_at
                `)
                .eq('id', orderId)
                .maybeSingle()
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

            const { data: events } = await supabase
                .from('order_tracking_events')
                .select('id, status, label, description, location, created_at')
                .eq('order_id', orderId)
                .order('created_at', { ascending: false })

            return NextResponse.json({ order, events: events || [] })
        }

        // 2. Search by tracking_code (any client)
        if (tracking) {
            const code = tracking.trim().toUpperCase()
            const { data: order, error } = await supabase
                .from('orders')
                .select(`
                    id, customer_name, customer_phone, amount, currency,
                    cart_items, product_title, payment_status,
                    shipping_address, shipping_city, shipping_country,
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

        // 3. List by client_id
        if (!clientId) {
            return NextResponse.json({ error: 'client_id, tracking ou order_id requis' }, { status: 400 })
        }

        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id, amount, currency, payment_status, transaction_id,
                cart_items, product_title, source,
                tracking_code, tracking_carrier, shipping_status,
                shipped_at, delivered_at, created_at
            `)
            .eq('client_id', clientId)
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
        const body = (await req.json()) as OrderBody

        // Si un jeton est fourni, l'identité prime sur tout client_id du corps
        // (anti-usurpation). Sinon commande invitée (client_id null) — le paiement
        // reste vérifié serveur plus bas.
        const authUid = await getMobileUserId(req)

        if (!body.transaction_id || typeof body.transaction_id !== 'string') {
            return NextResponse.json({ error: 'transaction_id manquant' }, { status: 400 })
        }
        if (!body.customer_name || !body.customer_phone) {
            return NextResponse.json({ error: 'customer_name et customer_phone requis' }, { status: 400 })
        }
        if (!Array.isArray(body.cart_items) || body.cart_items.length === 0) {
            return NextResponse.json({ error: 'cart_items vide' }, { status: 400 })
        }
        if (body.cart_items.length > 50) {
            return NextResponse.json({ error: 'Trop d\'articles (max 50)' }, { status: 400 })
        }
        const amount = Number(body.amount)
        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
        }

        // Idempotence
        const { data: existing } = await supabase
            .from('orders')
            .select('id, payment_status')
            .eq('transaction_id', body.transaction_id)
            .maybeSingle()
        if (existing?.payment_status === 'completed') {
            return NextResponse.json({ ok: true, order_id: existing.id, message: 'Already processed' })
        }

        // Verify payment
        const verify = await verifyKkiapayTransaction(body.transaction_id)
        if (!verify.ok) {
            return NextResponse.json(
                { error: `Paiement non confirmé (${verify.status})` },
                { status: 402 }
            )
        }

        // Validate amount from DB prices (anti-fraud)
        const productIds = body.cart_items.map(c => c.product_id)
        const { data: dbProducts } = await supabase
            .from('products')
            .select('id, price, sale_price, stock, is_active, title')
            .in('id', productIds)

        if (!dbProducts || dbProducts.length !== productIds.length) {
            return NextResponse.json({ error: 'Un ou plusieurs produits introuvables' }, { status: 400 })
        }

        let serverTotal = 0
        for (const item of body.cart_items) {
            const p = dbProducts.find(d => d.id === item.product_id)
            if (!p) return NextResponse.json({ error: `Produit ${item.product_id} introuvable` }, { status: 400 })
            if (!p.is_active) return NextResponse.json({ error: `Produit "${p.title}" indisponible` }, { status: 400 })
            const qty = parseInt(String(item.quantity), 10)
            if (!Number.isFinite(qty) || qty < 1 || qty > 1000) {
                return NextResponse.json({ error: `Quantité invalide pour "${p.title}"` }, { status: 400 })
            }
            if (p.stock < qty) {
                return NextResponse.json({ error: `Stock insuffisant pour "${p.title}" (reste ${p.stock})` }, { status: 400 })
            }
            const unit = (p.sale_price && p.sale_price < p.price) ? p.sale_price : p.price
            serverTotal += unit * qty
        }
        // TVA « en sus » : les prix produits sont HORS TAXE. Le client paie le
        // TTC (HT × 1,18), comme sur le web. On accepte l'ancien montant HT
        // (app pas encore mise à jour) OU le TTC (nouvelle app) → non-bloquant.
        const serverTotalHt = serverTotal
        const serverTotalTtc = ttcFromHt(serverTotalHt)
        const okHt = Math.abs(amount - serverTotalHt) <= 1
        const okTtc = Math.abs(amount - serverTotalTtc) <= 1
        if (!okHt && !okTtc) {
            return NextResponse.json({ error: 'Montant incohérent — actualisez votre panier' }, { status: 400 })
        }
        // On enregistre le montant RÉELLEMENT payé (celui validé côté client).
        const chargedAmount = okTtc ? serverTotalTtc : serverTotalHt

        // Create order with shipping if provided
        const shipping = body.shipping || {}
        const orderPayload = {
            client_id: authUid || body.client_id || null,
            customer_name: body.customer_name,
            customer_phone: body.customer_phone,
            customer_email: body.customer_email || null,
            amount: chargedAmount,
            currency: body.currency || 'XOF',
            payment_method: 'kkiapay',
            payment_status: 'completed',
            transaction_id: body.transaction_id,
            cart_items: body.cart_items,
            source: 'mobile',
            shipping_address: shipping.address || null,
            shipping_city: shipping.city || null,
            shipping_postal: shipping.postal || null,
            shipping_country: shipping.country || null,
            shipping_notes: shipping.notes || null,
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

        // Stock decrement
        for (const item of body.cart_items) {
            const p = dbProducts.find(d => d.id === item.product_id)
            if (!p) continue
            const newStock = Math.max(0, p.stock - item.quantity)
            await supabase
                .from('products')
                .update({ stock: newStock })
                .eq('id', item.product_id)
        }

        // Initial tracking event (preparation started)
        await supabase.from('order_tracking_events').insert({
            order_id: order.id,
            status: 'preparing',
            label: 'Commande en préparation',
            description: 'Votre commande a été confirmée et est en cours de préparation par notre équipe.',
        })

        // ── Envoi email facture (best-effort, ne bloque pas la réponse) ──
        // Le trigger SQL `auto_create_invoice_on_order_completion` a déjà créé
        // la ligne `invoices`. On déclenche l'envoi sans bloquer le client mobile.
        if (body.customer_email) {
            // fire-and-forget : on ne bloque pas la réponse mobile
            const baseUrl = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'
            sendInvoiceEmail({
                orderId: order.id,
                toEmail: body.customer_email,
                baseUrl,
            }).catch(e => console.error('[mobile/orders] sendInvoiceEmail failed:', e))
        }

        return NextResponse.json({ ok: true, order_id: order.id })
    } catch (e) {
        console.error('[mobile/orders] Exception:', e)
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
