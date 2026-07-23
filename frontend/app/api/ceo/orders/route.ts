import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

function sb() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
}

// GET /api/ceo/orders?since=ISO&status=all|pending|...&limit=500
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const { searchParams } = new URL(request.url)
    const since  = searchParams.get('since')
    const status = searchParams.get('status')
    const limit  = Math.min(parseInt(searchParams.get('limit') || '500'), 1000)

    const supabase = sb()
    let q = supabase
        .from('orders')
        .select('id, created_at, total_amount, status, client_email, client_name, items, notes, payment_method')
        .order('created_at', { ascending: false })
        .limit(limit)

    if (since)              q = q.gte('created_at', since)
    if (status && status !== 'all') q = q.eq('status', status)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ orders: data || [] })
}

// PATCH /api/ceo/orders — mettre à jour le statut d'une commande
export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const { id, status, notes } = await request.json()
    if (!id || !status) return NextResponse.json({ error: 'id et status requis' }, { status: 400 })

    const update: Record<string, string> = { status }
    if (notes !== undefined) update.notes = notes

    const { error } = await sb().from('orders').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
}
