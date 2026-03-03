import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single()

        if (error || !data) {
            return NextResponse.json({ product: null }, { status: 404 })
        }

        return NextResponse.json({
            product: {
                id: data.id,
                title: data.title || '',
                description: data.description || '',
                long_description: data.long_description || '',
                price: data.price || 0,
                sale_price: data.sale_price || null,
                currency: data.currency || 'XOF',
                images: data.images || [],
                category: data.category || 'general',
                stock: data.stock || 0,
                is_active: data.is_active ?? true,
                is_featured: data.is_featured ?? false,
            },
        })
    } catch {
        return NextResponse.json({ product: null }, { status: 500 })
    }
}
