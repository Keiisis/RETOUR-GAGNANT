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
    const now = new Date()

    // Derniers 12 mois
    const months: { label: string; from: string; to: string }[] = []
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
        months.push({
            label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
            from:  d.toISOString(),
            to:    end.toISOString(),
        })
    }

    // Résultats mensuels
    const monthlyData = await Promise.all(months.map(async m => {
        const { data } = await supabase
            .from('orders')
            .select('total_amount, status')
            .gte('created_at', m.from)
            .lt('created_at', m.to)

        const revenue  = (data || []).filter(o => ['completed', 'paid'].includes(o.status)).reduce((a, o) => a + (o.total_amount || 0), 0)
        const orders   = (data || []).length
        return { label: m.label, revenue, orders }
    }))

    // Tops
    const [allOrders, allClients, partApps, natReqs, dossiers] = await Promise.allSettled([
        supabase.from('orders').select('total_amount, status, client_email').in('status', ['completed', 'paid']),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
        supabase.from('partner_applications').select('status'),
        supabase.from('nationalite_requests').select('status'),
        supabase.from('dossiers').select('id', { count: 'exact', head: true }),
    ])

    const orders    = allOrders.status    === 'fulfilled' ? allOrders.value.data || []  : []
    const totalRev  = orders.reduce((a, o) => a + (o.total_amount || 0), 0)
    const clientCnt = allClients.status   === 'fulfilled' ? allClients.value.count || 0 : 0
    const partCnt   = partApps.status     === 'fulfilled' ? (partApps.value.data || []).length : 0
    const natCnt    = natReqs.status      === 'fulfilled' ? (natReqs.value.data || []).length  : 0
    const dosCnt    = dossiers.status     === 'fulfilled' ? dossiers.value.count || 0  : 0

    return NextResponse.json({
        monthly:         monthlyData,
        total_revenue:   totalRev,
        total_orders:    orders.length,
        total_clients:   clientCnt,
        partner_apps:    partCnt,
        nationalite_reqs: natCnt,
        dossiers_total:  dosCnt,
    })
}
