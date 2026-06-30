import { createClient } from '@supabase/supabase-js'

// Cache 5 min — évite de refaire les requêtes à chaque message
let _cache: { data: string; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

export async function getCachedRgbContext(): Promise<string> {
    const now = Date.now()
    if (_cache && now - _cache.ts < CACHE_TTL) return _cache.data
    const data = await buildRgbContext()
    _cache = { data, ts: now }
    return data
}

export function invalidateContextCache() { _cache = null }

function sb() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
}

function xof(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M FCFA`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K FCFA`
    return `${n.toLocaleString('fr-FR')} FCFA`
}

export interface GemmaMemoryEntry {
    id: string; type: string; content: string; importance: number; tags?: string[]; created_at: string
}

export async function buildRgbContext(): Promise<string> {
    const supabase = sb()
    const now   = new Date()
    const month = new Date(now); month.setDate(1); month.setHours(0, 0, 0, 0)
    const day   = new Date(now); day.setHours(0, 0, 0, 0)
    const h24   = new Date(Date.now() - 86_400_000).toISOString()

    // 10 requêtes regroupées (au lieu de 23)
    const [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10] = await Promise.allSettled([
        // 1. Revenus : une seule requête avec toutes les commandes payées
        supabase.from('orders').select('total_amount, created_at, status, client_name, client_email').in('status', ['completed', 'paid']).order('created_at', { ascending: false }).limit(200),
        // 2. Commandes en attente
        supabase.from('orders').select('id, created_at, total_amount, client_name, client_email, status').eq('status', 'pending').order('created_at', { ascending: false }).limit(8),
        // 3. Clients
        supabase.from('user_profiles').select('id, created_at, full_name, role').in('role', ['client', 'agent']),
        // 4. Messages non lus
        supabase.from('messages').select('id, created_at, name, sujet, content').eq('lu', false).order('created_at', { ascending: false }).limit(6),
        // 5. Dossiers récents
        supabase.from('dossiers').select('id, created_at, client_name, type, status').order('created_at', { ascending: false }).limit(5),
        // 6. Partenaires & nationalité
        supabase.from('partner_applications').select('id, created_at, company_name, status').order('created_at', { ascending: false }).limit(4),
        // 7. Nationalité
        supabase.from('nationalite_requests').select('id, created_at, full_name, status').order('created_at', { ascending: false }).limit(4),
        // 8. Sécurité WAF
        supabase.from('waf_logs').select('id', { count: 'exact', head: true }).eq('is_blocked', true).gte('created_at', h24),
        // 9. Settings
        supabase.from('settings').select('key, value').in('key', ['site_name', 'contact_email', 'contact_phone', 'contact_whatsapp', 'address']),
        // 10. Mémoire Gemma
        supabase.from('gemma_memory').select('type, content, importance').order('importance', { ascending: false }).limit(15),
    ])

    type Order = { total_amount?: number; created_at: string; status?: string; client_name?: string; client_email?: string }
    type User  = { id: string; created_at: string; full_name?: string; role: string }
    type Msg   = { id: string; created_at: string; name?: string; sujet?: string; content?: string }
    type Dos   = { id: string; created_at: string; client_name?: string; type?: string; status?: string }
    type App   = { id: string; created_at: string; company_name?: string; status?: string }
    type Nat   = { id: string; created_at: string; full_name?: string; status?: string }
    type Mem   = { type: string; content: string; importance: number }
    type Set   = { key: string; value: string }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = <T>(r: PromiseSettledResult<any>): T[] =>
        r.status === 'fulfilled' ? (r.value.data as T[]) || [] : []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gc = (r: PromiseSettledResult<any>): number =>
        r.status === 'fulfilled' ? r.value.count || 0 : 0

    const allPaidOrders = g<Order>(r1)
    const pendingOrders = g<Order>(r2)
    const allUsers      = g<User>(r3)
    const unreadMsgs    = g<Msg>(r4)
    const dossiers      = g<Dos>(r5)
    const partApps      = g<App>(r6)
    const natReqs       = g<Nat>(r7)
    const wafCount      = gc(r8)
    const settings      = g<Set>(r9)
    const memory        = g<Mem>(r10)

    const settMap = Object.fromEntries(settings.map(s => [s.key, s.value]))
    const clients = allUsers.filter(u => u.role === 'client')
    const agents  = allUsers.filter(u => u.role === 'agent')

    const revenueTotal = allPaidOrders.reduce((a, o) => a + (o.total_amount || 0), 0)
    const revenueMonth = allPaidOrders.filter(o => o.created_at >= month.toISOString()).reduce((a, o) => a + (o.total_amount || 0), 0)
    const revenueToday = allPaidOrders.filter(o => o.created_at >= day.toISOString()).reduce((a, o) => a + (o.total_amount || 0), 0)
    const clientsMonth = clients.filter(c => c.created_at >= month.toISOString()).length

    const fd = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })

    // Contexte compact — même info, beaucoup moins de tokens
    const lines = [
        `[RGB — ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}]`,
        `Site: ${settMap.site_name || 'Retour Gagnant Bénin'} | Email: ${settMap.contact_email || '—'} | Tél: ${settMap.contact_phone || '—'}`,
        '',
        `FINANCES: Revenu total=${xof(revenueTotal)} | Ce mois=${xof(revenueMonth)} | Aujourd'hui=${xof(revenueToday)}`,
        `COMMANDES: ${allPaidOrders.length} payées | ${pendingOrders.length} en attente`,
        `ÉQUIPE: ${clients.length} clients (${clientsMonth} ce mois) | ${agents.length} agents`,
        `MESSAGES: ${unreadMsgs.length} non lu(s) | DOSSIERS: ${dossiers.length} récents`,
        `SÉCURITÉ: ${wafCount} attaques bloquées (24h)`,
        '',
    ]

    if (pendingOrders.length > 0) {
        lines.push(`COMMANDES EN ATTENTE:`)
        pendingOrders.forEach(o => lines.push(`  ${fd(o.created_at)} | ${o.client_name || o.client_email || '?'} | ${xof(o.total_amount || 0)}`))
        lines.push('')
    }

    if (unreadMsgs.length > 0) {
        lines.push(`MESSAGES NON LUS:`)
        unreadMsgs.forEach(m => {
            lines.push(`  ${fd(m.created_at)} | ${m.name || '?'} — ${m.sujet || '—'}`)
            if (m.content) lines.push(`    > ${m.content.slice(0, 100)}`)
        })
        lines.push('')
    }

    if (dossiers.length > 0) {
        lines.push(`DOSSIERS RÉCENTS: ${dossiers.map(d => `${d.client_name || '?'}(${d.status || '?'})`).join(', ')}`)
    }
    if (partApps.length > 0) {
        lines.push(`PARTENAIRES: ${partApps.map(p => `${p.company_name || '?'}(${p.status || '?'})`).join(', ')}`)
    }
    if (natReqs.length > 0) {
        lines.push(`NATIONALITÉ: ${natReqs.map(n => `${n.full_name || '?'}(${n.status || '?'})`).join(', ')}`)
    }

    if (memory.length > 0) {
        lines.push('', `MÉMOIRE GEMMA:`)
        memory.forEach(m => lines.push(`  [${m.type}] ${m.content}`))
    }

    return lines.join('\n')
}

// Auto-extraction mémoire légère (fire & forget)
export async function autoExtractMemory(userMsg: string, response: string): Promise<void> {
    const combined = userMsg + ' ' + response
    const decisionKw = ['décidé', 'stratégie', 'objectif', 'priorité', 'lancer', 'arrêter', 'plan']
    if (!decisionKw.some(k => combined.toLowerCase().includes(k))) return

    try {
        const supabase = sb()
        await supabase.from('gemma_memory').insert({
            type: 'decision',
            content: `[${new Date().toLocaleDateString('fr-FR')}] ${response.slice(0, 150).replace(/\n/g, ' ')}`,
            importance: 3,
            tags: ['auto'],
        })
    } catch { /* silent */ }
}
