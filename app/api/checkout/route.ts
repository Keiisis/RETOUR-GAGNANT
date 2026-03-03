import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const body = await request.json()

        const {
            product_id,
            product_title,
            quantity,
            amount,
            currency,
            customer_name,
            customer_email,
            customer_phone,
            payment_method,
            cart_items,
            coupon_id,
            shipping_zone,
            shipping_fee,
        } = body

        // Validation
        if (!customer_name || !customer_phone || !payment_method || !amount) {
            return NextResponse.json(
                { error: 'Champs obligatoires manquants' },
                { status: 400 }
            )
        }

        // ═══ STOCK RESERVATION (Atomic) ═══════════════════════════
        // Reserve stock for each product before creating the order.
        // If any reservation fails, roll back all previous ones.
        const itemsToReserve = cart_items && cart_items.length > 0
            ? cart_items
            : [{ product_id, quantity: quantity || 1 }]

        const reservedItems: { product_id: string, quantity: number }[] = []

        for (const item of itemsToReserve) {
            if (!item.product_id) continue

            const { data: result, error: rpcError } = await supabase.rpc('reserve_stock', {
                p_product_id: item.product_id,
                p_quantity: item.quantity || 1,
            })

            if (rpcError || (result && !result.success)) {
                // Rollback all previously reserved items
                for (const reserved of reservedItems) {
                    await supabase.rpc('release_stock', {
                        p_product_id: reserved.product_id,
                        p_quantity: reserved.quantity,
                    })
                }

                const errorMsg = result?.error || rpcError?.message || 'Erreur de réservation du stock'
                return NextResponse.json({ error: errorMsg }, { status: 409 })
            }

            reservedItems.push({ product_id: item.product_id, quantity: item.quantity || 1 })
        }

        // ═══ ORDER CREATION ═══════════════════════════════════════
        const { data, error } = await supabase
            .from('orders')
            .insert({
                product_id: product_id || null,
                product_title: product_title || '',
                quantity: quantity || 1,
                amount,
                currency: currency || 'XOF',
                customer_name,
                customer_email: customer_email || null,
                customer_phone,
                payment_method,
                payment_status: 'pending',
                cart_items: cart_items || [],
                coupon_id: coupon_id || null,
                shipping_zone: shipping_zone || null,
                shipping_fee: shipping_fee || 0,
            })
            .select('id')
            .single()

        if (error) {
            // Rollback stock if order creation fails
            for (const reserved of reservedItems) {
                await supabase.rpc('release_stock', {
                    p_product_id: reserved.product_id,
                    p_quantity: reserved.quantity,
                })
            }
            console.error('Order creation error:', error)
            return NextResponse.json(
                { error: 'Erreur lors de la création de la commande' },
                { status: 500 }
            )
        }

        // Increment coupon use if any
        if (coupon_id) {
            await supabase.rpc('increment_coupon_use', { c_id: coupon_id })
        }

        return NextResponse.json({ order_id: data.id })
    } catch {
        return NextResponse.json(
            { error: 'Erreur serveur' },
            { status: 500 }
        )
    }
}
