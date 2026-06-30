import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { invalidateIpCache } from '@/lib/waf'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IpBlockRow = Record<string, any>

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/admin/waf?view=logs|blocks|fingerprints|deceptions|honeypots|campaigns|tarpits|canaries|honey_records|ssrf_attempts|idor_patterns&limit=100&offset=0
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

    // ── Nouvelles vues Défense Active ─────────────────────────
    if (view === 'fingerprints') {
        const { data, count, error } = await supabase
            .from('waf_device_fingerprints')
            .select('*', { count: 'exact' })
            .order('last_seen', { ascending: false })
            .range(offset, offset + limit - 1)

        return NextResponse.json({ fingerprints: data || [], total: count || 0, error: error?.message })
    }

    if (view === 'deceptions') {
        const { data, count, error } = await supabase
            .from('waf_honeypot_interactions')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        return NextResponse.json({ deceptions: data || [], total: count || 0, error: error?.message })
    }

    if (view === 'honeypots') {
        const { data, error } = await supabase
            .from('waf_deception_payloads')
            .select('*')
            .order('attack_type', { ascending: true })

        return NextResponse.json({ payloads: data || [], error: error?.message })
    }

    if (view === 'campaigns') {
        const { data, count, error } = await supabase
            .from('waf_attack_campaigns')
            .select('*', { count: 'exact' })
            .order('last_seen', { ascending: false })
            .range(offset, offset + limit - 1)

        return NextResponse.json({ campaigns: data || [], total: count || 0, error: error?.message })
    }

    if (view === 'tarpits') {
        const { data: config } = await supabase
            .from('waf_tarpit_config')
            .select('*')
            .order('trust_min', { ascending: true })

        const { data: tarpitedIps } = await supabase
            .from('waf_ip_memory')
            .select('ip, trust_score, tarpit_level, last_action, last_seen')
            .gt('tarpit_level', 0)
            .order('tarpit_level', { ascending: false })
            .limit(50)

        return NextResponse.json({ config: config || [], tarpitedIps: tarpitedIps || [] })
    }

    // ── Vues Système Immunitaire ───────────────────────────────
    if (view === 'canaries') {
        const { data, count, error } = await supabase
            .from('waf_canary_tokens')
            .select('*', { count: 'exact' })
            .order('triggered_count', { ascending: false })
            .range(offset, offset + limit - 1)

        return NextResponse.json({ canaries: data || [], total: count || 0, error: error?.message })
    }

    if (view === 'honey_records') {
        const { data, count, error } = await supabase
            .from('waf_honey_records')
            .select('*', { count: 'exact' })
            .order('access_count', { ascending: false })
            .range(offset, offset + limit - 1)

        return NextResponse.json({ honeyRecords: data || [], total: count || 0, error: error?.message })
    }

    if (view === 'ssrf_attempts') {
        const { data, count, error } = await supabase
            .from('waf_logs')
            .select('*', { count: 'exact' })
            .in('threat_type', ['ssrf', 'protocol_attack'])
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        return NextResponse.json({ ssrfAttempts: data || [], total: count || 0, error: error?.message })
    }

    if (view === 'idor_patterns') {
        const { data, count, error } = await supabase
            .from('waf_idor_tracking')
            .select('*', { count: 'exact' })
            .eq('is_suspicious', true)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        return NextResponse.json({ idorPatterns: data || [], total: count || 0, error: error?.message })
    }

    // ── Vue résumé enrichie (utilise RPC get_waf_stats) ───────
    try {
        const { data: rpcStats, error: rpcError } = await supabase.rpc('get_waf_stats', { p_hours: 24 })

        if (!rpcError && rpcStats) {
            // Ajouter les logs récents et IPs bloquées
            const [logsRes, blocksRes] = await Promise.all([
                supabase.from('waf_logs').select('*').order('created_at', { ascending: false }).limit(20),
                supabase.from('ip_blocks').select('*').is('unblocked_at', null).order('blocked_at', { ascending: false }).limit(100),
            ])

            // Normaliser les top_threats (JSON array) en threatStats (Record)
            const threatStats: Record<string, number> = {}
            if (Array.isArray(rpcStats.top_threats)) {
                for (const t of rpcStats.top_threats) {
                    if (t?.threat_type) threatStats[t.threat_type] = t.count || 0
                }
            }

            // Normaliser top_attackers en topIps
            const topIps = Array.isArray(rpcStats.top_attackers)
                ? rpcStats.top_attackers.map((a: { ip: string; count: number }) => ({ ip: a.ip, count: a.count }))
                : []

            return NextResponse.json({
                recentLogs:   logsRes.data || [],
                blockedIps:   blocksRes.data || [],
                threatStats,
                topIps,
                totalLogs24h: rpcStats.total_events || 0,
                totalBlocked: rpcStats.ip_blocks_active || blocksRes.data?.length || 0,
                // Champs enrichis depuis le RPC
                tarpit_count:     rpcStats.tarpit_count || 0,
                deceive_count:    rpcStats.deceive_count || 0,
                honeypot_count:   rpcStats.honeypot_count || 0,
                ip_hoppers:       rpcStats.ip_hoppers || 0,
                active_campaigns: rpcStats.active_campaigns || 0,
                learned_rules:    rpcStats.learned_rules || 0,
                known_bad_fps:    rpcStats.known_bad_fps || 0,
                total_fingerprints: rpcStats.total_fingerprints || 0,
            })
        }
    } catch { /* fallback ci-dessous */ }

    // Fallback si RPC indisponible
    let logsData: { threat_type: string; created_at: string }[] = []
    let blocksData: IpBlockRow[] = []
    let statsData: { ip: string; threat_type: string }[] = []

    try {
        const [logsRes, blocksRes, statsRes] = await Promise.all([
            supabase.from('waf_logs').select('threat_type, created_at').order('created_at', { ascending: false }).limit(500),
            supabase.from('ip_blocks').select('*').is('unblocked_at', null).order('blocked_at', { ascending: false }).limit(100),
            supabase.from('waf_logs').select('ip, threat_type').gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        ])
        logsData = logsRes.data || []
        blocksData = blocksRes.data || []
        statsData = statsRes.data || []
    } catch { /* tables might not exist yet */ }

    const threatStats: Record<string, number> = {}
    for (const row of statsData) {
        threatStats[row.threat_type] = (threatStats[row.threat_type] || 0) + 1
    }

    const ipCounts: Record<string, number> = {}
    for (const row of statsData) {
        ipCounts[row.ip] = (ipCounts[row.ip] || 0) + 1
    }
    const topIps = Object.entries(ipCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count }))

    return NextResponse.json({
        recentLogs:   logsData.slice(0, 20),
        blockedIps:   blocksData,
        threatStats,
        topIps,
        totalLogs24h: statsData.length || 0,
        totalBlocked: blocksData.length || 0,
    })
}

// POST /api/admin/waf — Actions: block_ip, lockdown, maintenance
// Body: { action: "block_ip", ip: "1.2.3.4", reason: "..." }
//        { action: "lockdown" }
//        { action: "maintenance" }
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const { action, ip, reason } = body as { action?: string; ip?: string; reason?: string }

    const supabase = createClient(supabaseUrl, serviceKey)

    // ── Mode urgence : lockdown ──────────────────────────────
    if (action === 'lockdown') {
        const { data, error } = await supabase.rpc('waf_emergency_lockdown')
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, lockdown: data })
    }

    // ── Maintenance manuelle ─────────────────────────────────
    if (action === 'maintenance') {
        const { data, error } = await supabase.rpc('waf_daily_maintenance')
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, maintenance: data })
    }

    // ── Nuclear Challenge — Mode Miroir ──────────────────────
    if (action === 'nuclear_challenge') {
        const targetIp = ip || ''
        const { data, error } = await supabase.rpc('waf_trigger_nuclear_challenge', {
            p_ip: targetIp,
            p_reason: reason || 'admin_manual',
        })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, nuclear: data })
    }

    // ── Bloquer une IP manuellement (action par défaut) ──────
    const targetIp = ip
    if (!targetIp || !/^[\d.:a-f]+$/i.test(targetIp)) {
        return NextResponse.json({ error: 'IP invalide' }, { status: 400 })
    }

    const { error } = await supabase.from('ip_blocks').upsert({
        ip: targetIp,
        reason: reason || 'Blocage manuel',
        blocked_by: 'manual',
        unblocked_at: null,
    }, { onConflict: 'ip' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    invalidateIpCache(targetIp)
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
