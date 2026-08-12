import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Route publique : utilise la service role key pour contourner RLS
// Les pages publiques (ServicesGrid, [slug]) appellent cette route au lieu du client anon

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET() {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ services: [] })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Essai 1 : schéma migré (avec is_active + order_index)
        let data: Array<Record<string, unknown>> | null = null
        let error: unknown = null

        const result1 = await supabase
            .from('services')
            .select('id, title, subtitle, slug, description, icon_type, image_url, color, is_active, order_index, price_display, pricing_options, features, duration, documents, processus')

        if (!result1.error) {
            data = result1.data as Array<Record<string, unknown>>
        } else {
            // Essai 2 : ancien schéma (sans is_active ni order_index)
            const result2 = await supabase
                .from('services')
                .select('id, title, subtitle, slug, description, icon_type, image_url, color, "order", price_display, pricing_options, features, duration, documents, processus')
            data = result2.data as Array<Record<string, unknown>>
            error = result2.error
        }

        if (error || !data) {
            return NextResponse.json({ services: [] })
        }

        const services = data
            .filter((s) => s.is_active !== false)
            .sort((a, b) => ((a.order_index ?? a.order ?? 0) as number) - ((b.order_index ?? b.order ?? 0) as number))

        return NextResponse.json({ services })
    } catch {
        return NextResponse.json({ services: [] })
    }
}
