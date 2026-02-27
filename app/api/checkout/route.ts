import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
    try {
        const body = await request.json()

        const {
            product_id, // For backward compatibility/single items
            product_title,
            quantity,
            amount,
            currency,
            customer_name,
            customer_email,
            customer_phone,
            payment_method,
            cart_items,
            coupon_id
        } = body

        // Validation
        if (!customer_name || !customer_phone || !payment_method || !amount) {
            return NextResponse.json(
                { error: 'Champs obligatoires manquants' },
                { status: 400 }
            )
        }

        // Create the order with pending status
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
                coupon_id: coupon_id || null
            })
            .select('id')
            .single()

        if (error) {
            console.error('Order creation error:', error)
            return NextResponse.json(
                { error: 'Erreçur lors de la creation de la commande' },
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
            { error: 'Erreçur serveur' },
            { status: 500 }
        )
    }
}
