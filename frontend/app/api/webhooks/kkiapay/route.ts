import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Kkiapay sends POST webhook notifications when payment status changes
export async function POST(request: Request) {
    try {
        const body = await request.json()

        // Kkiapay webhook payload structure
        const {
            transactionId,
            status,
            data,
        } = body

        const orderId = data?.order_id

        if (!transactionId || !orderId) {
            return NextResponse.json({ error: 'Missing transactionId or order_id' }, { status: 400 })
        }

        // Fetch order to verify it exists and is still pending
        const { data: order, error: fetchErr } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single()

        if (fetchErr || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        // Vérifier que la commande est bien une commande Kkiapay (non falsifiable — défini côté serveur)
        // Empêche d'utiliser cet endpoint pour manipuler des commandes d'autres gateways
        if (order.payment_method !== 'kkiapay') {
            console.warn(`[Kkiapay Webhook] Tentative sur commande ${orderId} (méthode: ${order.payment_method})`)
            return NextResponse.json({ error: 'Méthode de paiement incorrecte' }, { status: 400 })
        }

        // Idempotency: skip if already processed
        if (order.payment_status === 'completed') {
            return NextResponse.json({ ok: true, message: 'Already processed' })
        }

        if (status === 'SUCCESS' || status === 'TRANSACTION_APPROVED') {
            // Charger la clé privée depuis la DB (comme dans verify/route.ts)
            const { data: settingsData } = await supabase
                .from('settings')
                .select('key, value')
                .in('key', ['kkiapay_public_key', 'kkiapay_private_key', 'kkiapay_secret_key', 'kkiapay_sandbox', 'kkiapay_sandbox_public_key', 'kkiapay_sandbox_private_key'])

            const sm: Record<string, string> = {}
            for (const s of settingsData || []) sm[s.key] = s.value

            const isSandbox = sm.kkiapay_sandbox === 'true'
            const privateKey = isSandbox
                ? (sm.kkiapay_sandbox_private_key || sm.kkiapay_private_key || '')
                : (sm.kkiapay_private_key || '')
            const kkiapayBase = isSandbox
                ? 'https://api-sandbox.kkiapay.me'
                : 'https://api.kkiapay.me'

            // Server-side verification — le SDK officiel envoie les 3 headers
            const verifyRes = await fetch(`${kkiapayBase}/api/v1/transactions/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': isSandbox ? (sm.kkiapay_sandbox_public_key || sm.kkiapay_public_key || '') : (sm.kkiapay_public_key || ''),
                    'x-private-key': privateKey,
                    'x-secret-key': sm.kkiapay_secret_key || '',
                },
                body: JSON.stringify({ transactionId }),
            })

            const verifyData = await verifyRes.json()

            if (verifyData.status === 'SUCCESS' && verifyData.amount >= order.amount) {
                // Anti-replay : vérifier que ce transactionId n'a pas déjà servi pour une autre commande complétée.
                // Empêche un attaquant de rejouer une transaction Kkiapay valide via un faux webhook.
                const { data: existingTx } = await supabase
                    .from('orders')
                    .select('id')
                    .eq('transaction_id', transactionId)
                    .eq('payment_status', 'completed')
                    .neq('id', orderId)
                    .maybeSingle()

                if (existingTx) {
                    console.error(`[Kkiapay Webhook] Transaction ${transactionId} déjà utilisée — commande ${existingTx.id}`)
                    return NextResponse.json({ error: 'Transaction déjà utilisée pour une autre commande' }, { status: 400 })
                }

                // Garde atomique + vérification du résultat pour éviter la double-décrémentation du stock.
                // Kkiapay peut re-livrer le même webhook. Deux livraisons simultanées peuvent toutes deux
                // passer le check en mémoire (payment_status !== 'completed') avant que l'une n'écrive.
                // Seule la livraison qui obtient 1 ligne mise à jour doit décrémenter le stock.
                const { data: updatedOrder } = await supabase
                    .from('orders')
                    .update({
                        payment_status: 'completed',
                        transaction_id: transactionId,
                    })
                    .eq('id', orderId)
                    .eq('payment_status', 'pending')
                    .select('id')

                // Aucune ligne mise à jour = déjà traité par une autre livraison → ne pas décrémenter
                if (!updatedOrder || updatedOrder.length === 0) {
                    return NextResponse.json({ ok: true, message: 'Already processed (concurrent delivery)' })
                }

                // Decrement product stock
                if (order.product_id) {
                    await supabase.rpc('decrement_stock', {
                        p_id: order.product_id,
                        qty: order.quantity || 1,
                    })
                }

                // Send notification
                await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/notifications/order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: orderId, type: 'payment_success' }),
                }).catch(() => { })

                return NextResponse.json({ ok: true, message: 'Paiement vérifié et confirmé' })
            }
        }

        // Payment failed — garde atomique : ne pas écraser une commande déjà complétée
        await supabase
            .from('orders')
            .update({ payment_status: 'failed', transaction_id: transactionId })
            .eq('id', orderId)
            .eq('payment_status', 'pending')

        return NextResponse.json({ ok: true, message: 'Payment status updated to failed' })
    } catch {
        return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
    }
}
