import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Route publique : retourne un service par slug avec toutes ses données
// Utilise la service role key pour contourner RLS Supabase

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ service: null }, { status: 503 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { data, error } = await supabase
            .from('services')
            .select('*')
            .eq('slug', slug)
            .single()

        if (error || !data) {
            return NextResponse.json({ service: null }, { status: 404 })
        }

        return NextResponse.json({ service: data })
    } catch {
        return NextResponse.json({ service: null }, { status: 500 })
    }
}
