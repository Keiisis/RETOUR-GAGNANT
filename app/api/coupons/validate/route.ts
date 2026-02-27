import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST: Validate a coupon code and return discount info
export async function POST(request: Request) {
    try {
        const { code, order_amount } = await request.json()

        if (!code) {
            return NextResponse.json({ valid: false, error: 'Code manquant' })
        }

        const { data: coupon, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('code', code.toUpperCase())
            .single()

        if (error || !coupon) {
            return NextResponse.json({ valid: false, error: 'Code invalide' })
        }

        // Check if active
        if (!coupon.is_active) {
            return NextResponse.json({ valid: false, error: 'Ce code n\'est plus actif' })
        }

        // Check expiry
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
            return NextResponse.json({ valid: false, error: 'Ce code a expire' })
        }

        // Check usage limit
        if (coupon.current_uses >= coupon.max_uses) {
            return NextResponse.json({ valid: false, error: 'Ce code a atteint sa limite d\'utilisation' })
        }

        // Check minimum order
        if (order_amount && coupon.min_order_amount > 0 && order_amount < coupon.min_order_amount) {
            return NextResponse.json({
                valid: false,
                error: `Commande minimum: ${new Intl.NumberFormat('fr-FR').format(coupon.min_order_amount)} XOF`
            })
        }

        // Calculate discount
        let discountAmount = 0
        if (coupon.discount_type === 'percentage') {
            discountAmount = Math.round((order_amount || 0) * coupon.discount_value / 100)
        } else {
            discountAmount = coupon.discount_value
        }

        return NextResponse.json({
            valid: true,
            coupon_id: coupon.id,
            code: coupon.code,
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value,
            discount_amount: discountAmount,
        })
    } catch {
        return NextResponse.json({ valid: false, error: 'Erreçur serveur' })
    }
}
