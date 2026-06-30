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

        // Déjà annulée ou abandonnée — idempotent
        if (order.payment_status === 'cancelled' || order.payment_status === 'abandoned') {
            return NextResponse.json({ success: true })
        }

        // Marquer la commande comme panier abandonné
        await supabase
            .from('orders')
            .update({ payment_status: 'abandoned' })
            .eq('id', order_id)

        // Déclencher la notification d'abandon
        try {
            const proto = request.headers.get('x-forwarded-proto') || 'http'
            const host = request.headers.get('host')
            const notifUrl = new URL('/api/notifications/order', `${proto}://${host}`).toString()
            await fetch(notifUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id, type: 'abandoned' })
            })
        } catch (e) {
            console.error('Erreur notification abandon:', e)
        }

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
