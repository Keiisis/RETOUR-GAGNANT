import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service Role → bypass RLS complet
function sb() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
}

export async function GET() {
    try {
        const supabase = sb()
        const now   = new Date()
        const day   = new Date(now); day.setHours(0, 0, 0, 0)
        const month = new Date(now); month.setDate(1); month.setHours(0, 0, 0, 0)
        const h24   = new Date(Date.now() - 86_400_000).toISOString()

        const [
            rAll, rMonth, rToday,
            oPending, oTotal,
            clients, agents,
            msgs, msgsBoth,
            wafAll, wafBlk, ips,
            partApps, natReqs, dossiers,
        ] = await Promise.allSettled([
            supabase.from('orders').select('total_amount').in('status', ['completed', 'paid']),
            supabase.from('orders').select('total_amount').in('status', ['completed', 'paid']).gte('created_at', month.toISOString()),
            supabase.from('orders').select('total_amount').in('status', ['completed', 'paid']).gte('created_at', day.toISOString()),
            supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('orders').select('id', { count: 'exact', head: true }),
            // Clients : essai client_profiles puis user_profiles role=client
            supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
            supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'agent'),
            // Messages : table messages (champ lu)
            supabase.from('messages').select('id', { count: 'exact', head: true }).eq('lu', false),
            // Fallback contact_messages (champ is_read)
            supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('is_read', false),
            supabase.from('waf_logs').select('id', { count: 'exact', head: true }).gte('created_at', h24),
            supabase.from('waf_logs').select('id', { count: 'exact', head: true }).eq('is_blocked', true).gte('created_at', h24),
            supabase.from('ip_blocks').select('id', { count: 'exact', head: true }).is('unblocked_at', null),
            supabase.from('partner_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('nationalite_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('dossiers').select('id', { count: 'exact', head: true }),
        ])

        type SumRes = PromiseSettledResult<{ data: Array<{ total_amount: number }> | null }>
        type CntRes = PromiseSettledResult<{ count: number | null }>

        const sum = (r: SumRes) =>
            r.status === 'fulfilled' ? (r.value.data || []).reduce((a, x) => a + (x.total_amount || 0), 0) : 0
        const cnt = (r: CntRes) =>
            r.status === 'fulfilled' ? (r.value.count || 0) : 0

        const wafBlkCount = cnt(wafBlk as CntRes)
        const ipCount     = cnt(ips as CntRes)
        const score       = Math.round(Math.max(0, 100 - Math.min(50, ipCount * 5) - Math.min(30, wafBlkCount / 10)))

        // Unread messages : priorité table 'messages', fallback 'contact_messages'
        const msgsCount     = cnt(msgs as CntRes)
        const msgsBothCount = cnt(msgsBoth as CntRes)
        const unreadMsgs    = msgsCount > 0 ? msgsCount : msgsBothCount

        return NextResponse.json({
            revenue_total:   sum(rAll as SumRes),
            revenue_month:   sum(rMonth as SumRes),
            revenue_today:   sum(rToday as SumRes),
            orders_total:    cnt(oTotal as CntRes),
            orders_pending:  cnt(oPending as CntRes),
            clients_total:   cnt(clients as CntRes),
            agents_count:    cnt(agents as CntRes),
            messages_unread: unreadMsgs,
            waf_events_24h:  cnt(wafAll as CntRes),
            waf_blocked_24h: wafBlkCount,
            ip_blocked:      ipCount,
            security_score:  score,
            partner_apps_pending:   cnt(partApps as CntRes),
            nationalite_pending:    cnt(natReqs as CntRes),
            dossiers_total:         cnt(dossiers as CntRes),
        })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
