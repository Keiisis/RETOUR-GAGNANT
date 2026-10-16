import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function GET() {
    try {
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Compter les agents/admins vus dans les 5 dernières minutes.
        // Les trois libellés d'administrateur comptent (mêmes rôles que lib/api-guard).
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

        const { count, error } = await supabase
            .from('user_profiles')
            .select('id', { count: 'exact', head: true })
            .in('role', ['agent', 'admin', 'super_admin', 'superadmin'])
            .gte('last_seen_at', fiveMinutesAgo)

        if (error) throw error

        const onlineAgents = count || 0

        // Route publique : ni nom ni rôle de l'équipe. Seulement la disponibilité
        // et le nombre, affiché par ChatAssistant (« (n) agent(s) en ligne »).
        return NextResponse.json({
            disponible: onlineAgents > 0,
            onlineAgents,
        })
    } catch (error) {
        console.error('Support status error:', error)
        return NextResponse.json({ disponible: false, onlineAgents: 0 }, { status: 500 })
    }
}
