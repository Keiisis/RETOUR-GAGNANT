import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET() {
    const report: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        env: {
            supabaseUrl: supabaseUrl ? ' défini' : ' MANQUANT',
            serviceKey: supabaseServiceKey ? ' défini' : ' MANQUANT',
        }
    }

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ ...report, error: 'Variables d\'environnement manquantes' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Vérifier si last_seen_at existe dans user_profiles
    try {
        const { data: colCheck, error: colErr } = await supabase
            .from('user_profiles')
            .select('last_seen_at')
            .limit(1)

        report.column_last_seen_at = colErr
            ? ` ERREUR: ${colErr.message}`
            : ' colonne existe'
    } catch (e) {
        report.column_last_seen_at = ` EXCEPTION: ${e}`
    }

    // 2. Lister tous les agents/admins avec leur last_seen_at
    try {
        const { data: agents, error: agentsErr } = await supabase
            .from('user_profiles')
            .select('id, full_name, role, last_seen_at, email')
            .in('role', ['agent', 'admin'])

        if (agentsErr) {
            report.agents = ` ERREUR: ${agentsErr.message}`
        } else {
            report.agents = agents?.map(a => ({
                name: a.full_name,
                role: a.role,
                email: a.email,
                last_seen_at: a.last_seen_at || 'NULL',
                online: a.last_seen_at
                    ? new Date(a.last_seen_at) > new Date(Date.now() - 5 * 60 * 1000)
                    : false
            })) || []
            report.total_agents = agents?.length || 0
        }
    } catch (e) {
        report.agents = ` EXCEPTION: ${e}`
    }

    // 3. Vérifier la fenêtre 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    try {
        const { data: online, error: onlineErr } = await supabase
            .from('user_profiles')
            .select('id, full_name, role, last_seen_at')
            .in('role', ['agent', 'admin'])
            .gte('last_seen_at', fiveMinutesAgo)

        report.online_last_5min = onlineErr
            ? ` ERREUR: ${onlineErr.message}`
            : online?.length || 0
        report.five_min_threshold = fiveMinutesAgo
    } catch (e) {
        report.online_last_5min = ` EXCEPTION: ${e}`
    }

    // 4. Test d'un UPDATE simulé (sans userId réel — just schema check)
    try {
        const { error: schemaErr } = await supabase
            .from('user_profiles')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', '00000000-0000-0000-0000-000000000000') // ID inexistant volontairement

        report.update_schema_check = schemaErr
            ? ` ERREUR SCHEMA: ${schemaErr.message}`
            : ' schéma OK (0 lignes affectées — normal, ID fictif)'
    } catch (e) {
        report.update_schema_check = ` EXCEPTION: ${e}`
    }

    return NextResponse.json(report, { status: 200 })
}
