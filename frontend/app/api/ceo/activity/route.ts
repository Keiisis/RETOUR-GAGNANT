import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
}

// GET /api/ceo/activity — flux d'activité des 72 dernières heures
export async function GET() {
    const supabase = sb()
    const h72 = new Date(Date.now() - 72 * 3600_000).toISOString()

    const [orders, clients, msgs, dossiers, natReqs, partApps] = await Promise.allSettled([
        supabase.from('orders')
            .select('id, created_at, total_amount, status, client_email')
            .gte('created_at', h72).order('created_at', { ascending: false }).limit(30),
        supabase.from('user_profiles')
            .select('id, created_at, full_name, email')
            .eq('role', 'client')
            .gte('created_at', h72).order('created_at', { ascending: false }).limit(30),
        supabase.from('messages')
            .select('id, created_at, name, sujet, subject')
            .gte('created_at', h72).order('created_at', { ascending: false }).limit(30),
        supabase.from('dossiers')
            .select('id, created_at, client_name, type')
            .gte('created_at', h72).order('created_at', { ascending: false }).limit(20),
        supabase.from('nationalite_requests')
            .select('id, created_at, full_name')
            .gte('created_at', h72).order('created_at', { ascending: false }).limit(20),
        supabase.from('partner_applications')
            .select('id, created_at, company_name, status')
            .gte('created_at', h72).order('created_at', { ascending: false }).limit(20),
    ])

    return NextResponse.json({
        orders:              orders.status === 'fulfilled'   ? (orders.value.data   || []) : [],
        clients:             clients.status === 'fulfilled'  ? (clients.value.data  || []) : [],
        messages:            msgs.status === 'fulfilled'     ? (msgs.value.data     || []) : [],
        dossiers:            dossiers.status === 'fulfilled' ? (dossiers.value.data || []) : [],
        nationalite_requests: natReqs.status === 'fulfilled' ? (natReqs.value.data  || []) : [],
        partner_applications: partApps.status === 'fulfilled'? (partApps.value.data || []) : [],
    })
}
