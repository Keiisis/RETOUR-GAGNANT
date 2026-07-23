import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

function sb() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
}

export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const supabase = sb()

    const [invoicesRes, quotesRes, ordersRes] = await Promise.allSettled([
        supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('quotes').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('orders').select('id, created_at, total_amount, status, client_email, client_name')
            .order('created_at', { ascending: false }).limit(300),
    ])

    const invoices = invoicesRes.status === 'fulfilled' ? invoicesRes.value.data || [] : []
    const quotes   = quotesRes.status   === 'fulfilled' ? quotesRes.value.data   || [] : []
    const orders   = ordersRes.status   === 'fulfilled' ? ordersRes.value.data   || [] : []

    // Si pas de table invoices/quotes, on utilise les commandes comme source
    const docs = invoices.length > 0 || quotes.length > 0
        ? [...invoices, ...quotes].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        : orders.map(o => ({
            ...o,
            type: 'commande',
            amount: o.total_amount,
            client: o.client_name || o.client_email,
        }))

    return NextResponse.json({ docs, source: invoices.length > 0 ? 'invoices' : 'orders' })
}
