import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createErpInvoiceForOrder } from '@/lib/erp-invoice'

// Webhook Zeyow — notification asynchrone de paiement (appel serveur-à-serveur uniquement)
export async function POST(request: Request) {
    try {
        // Vérification du secret partagé Zeyow (serveur → serveur uniquement)
        // Le secret est stocké dans settings.zeyow_webhook_secret
        // et configuré dans le tableau de bord Zeyow comme header/paramètre de callback.
        const { data: secretSetting } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'zeyow_webhook_secret')
            .maybeSingle()

        const configuredSecret = secretSetting?.value || ''

        // Si un secret est configuré, l'exiger obligatoirement
        if (configuredSecret) {
            const receivedSecret =
                request.headers.get('x-zeyow-secret') ||
                request.headers.get('x-webhook-secret') ||
                request.headers.get('authorization')?.replace('Bearer ', '')

            if (!receivedSecret || receivedSecret !== configuredSecret) {
                console.warn('[Zeyow Webhook] Tentative non autorisée — secret invalide ou manquant')
                return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
            }
        } else {
            // Aucun secret configuré : refuser les appels pour éviter les faux paiements
            // (configurer zeyow_webhook_secret dans les settings admin)
            console.warn('[Zeyow Webhook] Rejeté : zeyow_webhook_secret non configuré — configurez-le dans les settings admin')
            return NextResponse.json(
                { error: 'Webhook Zeyow non configuré — contactez l\'administrateur' },
                { status: 403 }
            )
        }

        const body = await request.json()

        const {
            order_id,
            transaction_id,
            status,
            amount,
        } = body

        // Montant obligatoire — on refuse les webhooks sans montant (vecteur d'attaque)
        if (amount === undefined || amount === null || amount === '') {
            console.warn('[Zeyow Webhook] Montant manquant dans le payload')
            return NextResponse.json({ error: 'Montant requis' }, { status: 400 })
        }

        if (!order_id) {
            return NextResponse.json({ error: 'order_id manquant' }, { status: 400 })
        }

        const { data: order, error: fetchErr } = await supabase
            .from('orders')
            .select('payment_status, amount, product_id, quantity, payment_method')
            .eq('id', order_id)
            .single()

        if (fetchErr || !order) {
            return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
        }

        // Vérifier que la commande est bien une commande Zeyow
        if (order.payment_method !== 'zeyow') {
            console.warn(`[Zeyow Webhook] Tentative sur commande ${order_id} (méthode: ${order.payment_method})`)
            return NextResponse.json({ error: 'Méthode de paiement incorrecte' }, { status: 400 })
        }

        // Idempotence
        if (order.payment_status === 'completed') {
            return NextResponse.json({ ok: true, message: 'Déjà traité' })
        }

        const success =
            status === 'success' ||
            status === 'SUCCESS' ||
            status === 'completed' ||
            status === 'COMPLETED' ||
            status === 'paid' ||
            status === 'PAID'

        if (success) {
            // Vérification de montant si fourni
            if (amount && parseFloat(String(amount)) < order.amount * 0.99) {
                console.error('Zeyow amount mismatch:', { received: amount, expected: order.amount })
                return NextResponse.json({ error: 'Montant incorrect' }, { status: 400 })
            }

            // Garde atomique + vérification du résultat pour éviter la double-décrémentation du stock.
            // Zeyow peut re-livrer le même webhook. Deux livraisons simultanées peuvent toutes deux
            // passer le check en mémoire avant que l'une n'écrive.
            // Seule la livraison qui obtient 1 ligne mise à jour doit décrémenter le stock.
            const { data: updatedZeyow } = await supabase
                .from('orders')
                .update({
                    payment_status: 'completed',
                    transaction_id: transaction_id || `zeyow-${order_id}`,
                })
                .eq('id', order_id)
                .eq('payment_status', 'pending')
                .select('id')

            if (!updatedZeyow || updatedZeyow.length === 0) {
                return NextResponse.json({ ok: true, message: 'Déjà traité (livraison simultanée)' })
            }

            if (order.product_id) {
                await supabase.rpc('decrement_stock', {
                    p_id: order.product_id,
                    qty: order.quantity || 1,
                })
            }

            // Facture ERP + email facture au client (comme FedaPay / Stripe / PayPal).
            // Absent jusqu'ici : les paiements Zeyow n'émettaient AUCUNE facture.
            await createErpInvoiceForOrder({
                orderId: String(order_id),
                method: 'zeyow',
                transactionId: String(transaction_id || `zeyow-${order_id}`),
            })

            await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/notifications/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id, type: 'payment_success' }),
            }).catch(() => {})

            return NextResponse.json({ ok: true, message: 'Paiement confirmé' })
        }

        // Paiement échoué ou annulé
        const newStatus =
            status === 'refunded' || status === 'REFUNDED' ? 'refunded' : 'failed'

        await supabase
            .from('orders')
            .update({
                payment_status: newStatus,
                transaction_id: transaction_id || null,
            })
            .eq('id', order_id)
            .eq('payment_status', 'pending')

        return NextResponse.json({ ok: true, message: `Statut: ${newStatus}` })
    } catch {
        return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
    }
}
