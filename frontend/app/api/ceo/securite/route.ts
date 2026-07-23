import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

function sb() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
}

// GET /api/ceo/securite?hours=24
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24')
    const since = new Date(Date.now() - hours * 3_600_000).toISOString()
    const supabase = sb()

    const [logsRes, blocksRes, memRes] = await Promise.allSettled([
        supabase.from('waf_logs')
            .select('id, created_at, ip, threat_type, path, is_blocked, country_code')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(200),
        supabase.from('ip_blocks')
            .select('*')
            .is('unblocked_at', null)
            .order('created_at', { ascending: false })
            .limit(100),
        supabase.from('waf_ip_memory')
            .select('id, trust_score', { count: 'exact' }),
    ])

    return NextResponse.json({
        logs:    logsRes.status   === 'fulfilled' ? logsRes.value.data   || [] : [],
        blocks:  blocksRes.status === 'fulfilled' ? blocksRes.value.data || [] : [],
        memory:  memRes.status    === 'fulfilled' ? memRes.value.data    || [] : [],
    })
}

// DELETE /api/ceo/securite — débloquer une IP
export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const { error } = await sb()
        .from('ip_blocks')
        .update({ unblocked_at: new Date().toISOString() })
        .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
