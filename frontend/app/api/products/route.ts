import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic';

/**
 * GET /api/products
 * Retourne tous les produits actifs depuis la table `products` (gérée par admin/boutique).
 * La table `inventory_items` est réservée à l'ERP (devis/factures) : elle n'alimente
 * plus la boutique publique afin d'éviter toute désynchronisation.
 */
export async function GET() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Products fetch error:', error)
            return NextResponse.json({ products: [] })
        }

        const products = (data || []).map((item: Record<string, unknown>) => ({
            id: item.id,
            title: item.title || '',
            description: item.description || '',
            long_description: item.long_description || '',
            price: item.price || 0,
            sale_price: item.sale_price || null,
            currency: item.currency || 'XOF',
            images: item.images || [],
            category: item.category || 'general',
            stock: item.stock || 0,
            is_active: item.is_active ?? true,
            is_featured: item.is_featured ?? false,
        }))

        return NextResponse.json({ products })
    } catch {
        return NextResponse.json({ products: [] })
    }
}
