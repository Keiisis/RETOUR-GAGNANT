import { NextResponse } from 'next/server'
import { createErpInvoiceForOrder } from '@/lib/erp-invoice'
import { supabase } from '@/lib/supabase'

// FedaPay sends webhook notifications via POST
export async function POST(request: Request) {
    try {
        // Lire order_id depuis query params (passé via callback_url) ou depuis le body
        const { searchParams } = new URL(request.url)
        const orderIdFromUrl = searchParams.get('order_id')

        const body = await request.json()

        // FedaPay webhook structure
        const entity = body?.entity || 'transaction'
        const eventData = body?.object || body

        // Only handle transaction events
        if (entity !== 'transaction') {
            return NextResponse.json({ ok: true, message: 'Event ignored' })
        }

        const transactionId = String(eventData?.id || '')
        const status = eventData?.status // 'approved', 'declined', 'canceled', 'refunded'
        const meta = eventData?.meta || eventData?.custom_metadata || {}
        // Priorité : query param > custom_metadata > meta
        const orderId = orderIdFromUrl || meta?.order_id || meta?.orderId

        if (!transactionId || !orderId) {
            console.warn('FedaPay webhook: transactionId ou orderId manquant', { transactionId, orderId, orderIdFromUrl })
            return NextResponse.json({ error: 'Missing transaction ID or order_id' }, { status: 400 })
        }

        // Fetch order
        const { data: order, error: fetchErr } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single()

        if (fetchErr || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        // Vérifier que la commande est bien une commande FedaPay (non falsifiable : défini côté serveur)
        // Empêche d'utiliser cet endpoint pour manipuler des commandes d'autres gateways
        if (order.payment_method !== 'fedapay') {
            console.warn(`[FedaPay Webhook] Tentative sur commande ${orderId} (méthode: ${order.payment_method})`)
            return NextResponse.json({ error: 'Méthode de paiement incorrecte' }, { status: 400 })
        }

        // Idempotency check
        if (order.payment_status === 'completed') {
            return NextResponse.json({ ok: true, message: 'Already processed' })
        }

        if (status === 'approved') {
            // Server-side verification: fetch from FedaPay API
            const { data: settingsData } = await supabase
                .from('settings')
                .select('key, value')
                .in('key', ['fedapay_secret_key', 'fedapay_sandbox'])

            const settingsMap: Record<string, string> = {}
            for (const s of settingsData || []) {
                settingsMap[s.key] = s.value
            }

            const secretKey = settingsMap.fedapay_secret_key
            const isSandbox = settingsMap.fedapay_sandbox === 'true'
            const apiBase = isSandbox ? 'https://sandbox-api.fedapay.com' : 'https://api.fedapay.com'

            if (secretKey) {
                const verifyRes = await fetch(`${apiBase}/v1/transactions/${transactionId}`, {
                    headers: {
                        'Authorization': `Bearer ${secretKey}`,
                        'Content-Type': 'application/json',
                    },
                })

                const verifyData = await verifyRes.json()
                const txObject = verifyData?.['v1/transaction'] || verifyData?.v1?.transaction || verifyData?.transaction || verifyData
                const verifiedStatus = txObject?.status || verifyData?.status

                if (verifiedStatus !== 'approved' && verifiedStatus !== 'transferred') {
                    await supabase
                        .from('orders')
                        .update({ payment_status: 'failed', transaction_id: transactionId })
                        .eq('id', orderId)
                        .eq('payment_status', 'pending')
                    return NextResponse.json({ ok: false, message: 'Vérification FedaPay échouée' })
                }

                // Vérification du montant : FedaPay retourne le montant en XOF directement (zero-decimal)
                const txAmount = txObject?.amount
                if (txAmount !== undefined && txAmount !== null) {
                    // XOF est zero-decimal : 10 000 XOF = 10 000 (pas de centimes)
                    const verifiedAmountXof = txAmount
                    if (verifiedAmountXof < order.amount * 0.99) {
                        console.error('[FedaPay Webhook] Montant incorrect:', {
                            verifiedAmountXof,
                            expectedXof: order.amount,
                        })
                        await supabase
                            .from('orders')
                            .update({ payment_status: 'failed', transaction_id: transactionId })
                            .eq('id', orderId)
                            .eq('payment_status', 'pending')
                        return NextResponse.json({ ok: false, message: 'Montant FedaPay incorrect' })
                    }
                }
            } else {
                // Pas de clé secrète → impossible de vérifier → refus par sécurité
                console.error('[FedaPay Webhook] Clé secrète manquante : vérification impossible')
                return NextResponse.json({ error: 'Configuration FedaPay manquante' }, { status: 503 })
            }

            // Anti-replay : vérifier que ce transactionId n'a pas déjà servi pour une autre commande complétée.
            // Empêche un attaquant de rejouer une transaction FedaPay valide via un faux webhook.
            const { data: existingTx } = await supabase
                .from('orders')
                .select('id')
                .eq('transaction_id', transactionId)
                .eq('payment_status', 'completed')
                .neq('id', orderId)
                .maybeSingle()

            if (existingTx) {
                console.error(`[FedaPay Webhook] Transaction ${transactionId} déjà utilisée : commande ${existingTx.id}`)
                // Garde atomique : ne pas écraser une commande déjà complétée (race condition)
                await supabase
                    .from('orders')
                    .update({ payment_status: 'failed', transaction_id: transactionId })
                    .eq('id', orderId)
                    .eq('payment_status', 'pending')
                return NextResponse.json({ ok: false, message: 'Transaction déjà utilisée pour une autre commande' })
            }

            // Garde atomique + vérification du résultat pour éviter la double-décrémentation du stock.
            // FedaPay peut re-livrer le même webhook. Deux livraisons simultanées peuvent toutes deux
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

            // Decrement stock
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

            // Facture ERP → compta (idempotent : skip si verify l'a déjà créée)
            await createErpInvoiceForOrder({ orderId, method: 'fedapay', transactionId: String(transactionId ?? '') })

            return NextResponse.json({ ok: true, message: 'Paiement confirmé' })
        }

        if (status === 'refunded') {
            await supabase
                .from('orders')
                .update({ payment_status: 'refunded', transaction_id: transactionId })
                .eq('id', orderId)
                .eq('payment_status', 'completed')
            return NextResponse.json({ ok: true, message: 'Remboursement enregistré' })
        }

        // declined / canceled : garde atomique : ne pas écraser une commande déjà complétée
        await supabase
            .from('orders')
            .update({ payment_status: 'failed', transaction_id: transactionId })
            .eq('id', orderId)
            .eq('payment_status', 'pending')

        return NextResponse.json({ ok: true, message: 'Payment failed/canceled' })
    } catch {
        return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
    }
}
