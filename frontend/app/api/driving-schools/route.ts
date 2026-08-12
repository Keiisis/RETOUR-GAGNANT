// ══════════════════════════════════════════════════════════════
//  PUBLIC : Auto-écoles partenaires (Permis de Conduire Béninois)
//  Ne renvoie QUE les écoles actives, avec leur prix et leur durée.
//  Les coordonnées internes (téléphone / email) ne sortent jamais.
// ══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const db = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET() {
    const supabase = db()
    const { data, error } = await supabase
        .from('driving_schools')
        .select('id, nom, ville, description, photo_url, price_eur, duration, features, order_index')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ schools: [] })
    return NextResponse.json({ schools: data || [] })
}
