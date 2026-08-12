// ══════════════════════════════════════════════════════════════
//  PUBLIC : Catégories de permis de conduire (avec prix + durée)
//  Ne renvoie QUE les catégories actives, triées par ordre d'affichage.
// ══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const db = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET() {
    const { data, error } = await db()
        .from('permis_types')
        .select('id, category, label, description, age_min, price_eur, duration, order_index')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
    if (error) return NextResponse.json({ types: [] })
    return NextResponse.json({ types: data || [] })
}
