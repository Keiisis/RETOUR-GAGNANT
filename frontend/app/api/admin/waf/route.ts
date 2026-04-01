import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { invalidateIpCache } from '@/lib/waf'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/admin/waf?view=logs|blocks&limit=100&offset=0
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const { searchParams } = request.nextUrl
    const view   = searchParams.get('view') || 'summary'
    const limit  = Math.min(parseInt(searchParams.get('limit')  || '100'), 500)
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = createClient(supabaseUrl, serviceKey)

    if (view === 'logs') {
        const { data, count, error } = await supabase
            .from('waf_logs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        return NextResponse.json({ logs: data || [], total: count || 0, error: error?.message })
    }

    if (view === 'blocks') {
        const { data, count, error } = await supabase
            .from('ip_blocks')
            .select('*', { count: 'exact' })
            .is('unblocked_at', null)
            .order('blocked_at', { ascending: false })
            .range(offset, offset + limit - 1)

        return NextResponse.json({ blocks: data || [], total: count || 0, error: error?.message })
    }

    // Vue résumé
    const [logsRes, blocksRes, statsRes] = await Promise.all([
        supabase.from('waf_logs').select('threat_type, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('ip_blocks').select('*').is('unblocked_at', null).order('blocked_at', { ascending: false }).limit(100),
        supabase.from('waf_logs').select('ip, threat_type').gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ])

    // Stats par type de menace (24h)
    const threatStats: Record<string, number> = {}
    for (const row of (statsRes.data || [])) {
        threatStats[row.threat_type] = (threatStats[row.threat_type] || 0) + 1
    }

    // IPs les plus actives (24h)
    const ipCounts: Record<string, number> = {}
    for (const row of (statsRes.data || [])) {
        ipCounts[row.ip] = (ipCounts[row.ip] || 0) + 1
    }
    const topIps = Object.entries(ipCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count }))

    return NextResponse.json({
        recentLogs:   (logsRes.data || []).slice(0, 20),
        blockedIps:   blocksRes.data || [],
        threatStats,
        topIps,
        totalLogs24h: statsRes.data?.length || 0,
        totalBlocked: blocksRes.data?.length || 0,
    })
}

// POST /api/admin/waf — Bloquer une IP manuellement
// Body: { ip: "1.2.3.4", reason: "..." }
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const { ip, reason } = body as { ip?: string; reason?: string }

    if (!ip || !/^[\d.:a-f]+$/i.test(ip)) {
        return NextResponse.json({ error: 'IP invalide' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const { error } = await supabase.from('ip_blocks').upsert({
        ip,
        reason: reason || 'Blocage manuel',
        blocked_by: 'manual',
        unblocked_at: null,
    }, { onConflict: 'ip' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    invalidateIpCache(ip)
    return NextResponse.json({ success: true })
}

// DELETE /api/admin/waf?ip=1.2.3.4 — Débloquer une IP
export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const ip = request.nextUrl.searchParams.get('ip')
    if (!ip) return NextResponse.json({ error: 'IP requise' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceKey)
    const { error } = await supabase
        .from('ip_blocks')
        .update({ unblocked_at: new Date().toISOString() })
        .eq('ip', ip)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    invalidateIpCache(ip)
    return NextResponse.json({ success: true })
}
