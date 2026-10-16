import { NextResponse } from 'next/server'
import { supabaseServeur as supabase } from '@/lib/supabase-serveur'
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'
import { evaluerCoupon, COLONNES_COUPON } from '@/lib/boutique-tarifs'

// POST: Validate a coupon code and return discount info
export async function POST(request: Request) {
    // Plafond par IP : sans lui, la route permettait de deviner les codes promo en rafale.
    const trop = guardPublic(request, 'coupons/validate', PUBLIC_FORM_LIMIT)
    if (trop) return trop

    try {
        const { code, order_amount } = await request.json()

        if (!code || typeof code !== 'string') {
            return NextResponse.json({ valid: false, error: 'Code manquant' })
        }

        const { data: coupon, error } = await supabase
            .from('coupons')
            .select(COLONNES_COUPON)
            .eq('code', code.toUpperCase())
            .single()

        if (error || !coupon) {
            return NextResponse.json({ valid: false, error: 'Code invalide' })
        }

        // Aperçu pour l'affichage : la remise réelle est recalculée par /api/checkout
        // sur le sous-total serveur au moment de créer la commande.
        const verdict = evaluerCoupon(coupon, Number(order_amount) || 0)
        if (!verdict.valide) {
            return NextResponse.json({ valid: false, error: verdict.erreur })
        }

        // Seuls les champs lus par CartCheckoutModal (`id` est renvoyé à /api/checkout
        // en `coupon_id` ; l'ancien nom `coupon_id` ici faisait perdre le coupon en route).
        return NextResponse.json({
            valid: true,
            id: coupon.id,
            code: coupon.code,
            discount_amount: verdict.remise,
        })
    } catch {
        return NextResponse.json({ valid: false, error: 'Erreur serveur' })
    }
}
