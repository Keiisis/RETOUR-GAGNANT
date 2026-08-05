import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
)

export const revalidate = 60

// GET /api/logements?programme=…&ville=… — catalogue public (actifs uniquement).
export async function GET(request: NextRequest) {
    const programme = request.nextUrl.searchParams.get('programme')
    const ville = request.nextUrl.searchParams.get('ville')

    let q = supabase.from('logements').select('*').eq('is_active', true)
    if (programme) q = q.eq('programme', programme)
    if (ville) q = q.eq('ville', ville)
    q = q.order('ordre', { ascending: true }).order('created_at', { ascending: false })

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message, logements: [] }, { status: 500 })
    return NextResponse.json({ logements: data || [] })
}
