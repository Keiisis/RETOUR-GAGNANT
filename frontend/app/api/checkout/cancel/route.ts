import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { error: 'Configuration serveur manquante' },
                { status: 503 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const { order_id } = await request.json()

        if (!order_id) {
            return NextResponse.json({ error: 'order_id manquant' }, { status: 400 })
        }

        // Récupérer la commande
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('payment_status, cart_items, product_id, quantity')
            .eq('id', order_id)
            .single()

        if (fetchError || !order) {
            return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
        }

        // Ne pas annuler une commande déjà payée/complétée
        if (order.payment_status === 'completed' || order.payment_status === 'paid') {
            return NextResponse.json({ error: 'Commande déjà payée, annulation impossible' }, { status: 409 })
        }

        // Déjà annulée — idempotent
        if (order.payment_status === 'cancelled') {
            return NextResponse.json({ success: true })
        }

        // Libérer le stock (inverse de reserve_stock)
        const itemsToRelease: { product_id: string; quantity: number }[] =
            order.cart_items && order.cart_items.length > 0
                ? order.cart_items
                : [{ product_id: order.product_id, quantity: order.quantity || 1 }]

        for (const item of itemsToRelease) {
            if (!item.product_id) continue
            await supabase.rpc('release_stock', {
                p_product_id: item.product_id,
                p_quantity: item.quantity || 1,
            })
        }

        // Marquer la commande comme annulée
        await supabase
            .from('orders')
            .update({ payment_status: 'cancelled' })
            .eq('id', order_id)

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
