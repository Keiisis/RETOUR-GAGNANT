import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { pageMeta } from '@/lib/seo'
import ProductDetailClient from './ProductDetailClient'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        )
        const { data } = await supabase
            .from('products')
            .select('title, description, images')
            .eq('id', id)
            .maybeSingle()
        if (data) {
            const title = `${data.title} | Boutique — Retour Gagnant`
            const desc = ((data.description || '') as string).replace(/\s+/g, ' ').trim().slice(0, 160)
                || 'Produits authentiques du Bénin sélectionnés par Retour Gagnant.'
            const img = Array.isArray(data.images) ? (data.images[0] as string) : undefined
            return pageMeta(title, desc, `/boutique/${id}`, img)
        }
    } catch { /* fallback */ }
    return pageMeta('Produit | Boutique — Retour Gagnant', 'Produits authentiques du Bénin sélectionnés par Retour Gagnant.', `/boutique/${id}`)
}

export default function Page() {
    return <ProductDetailClient />
}
