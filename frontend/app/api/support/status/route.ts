import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function GET() {
    try {
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Compter les agents/admins vus dans les 5 dernières minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

        const { data, error } = await supabase
            .from('user_profiles')
            .select('id, full_name, role, last_seen_at')
            .in('role', ['agent', 'admin'])
            .gte('last_seen_at', fiveMinutesAgo)

        if (error) throw error

        const onlineAgents = data?.length || 0

        return NextResponse.json({
            onlineAgents,
            agents: data?.map(a => ({ name: a.full_name, role: a.role })) || [],
            message: 'Système interrogé avec succès'
        })
    } catch (error) {
        console.error('Support status error:', error)
        return NextResponse.json({ onlineAgents: 0 }, { status: 500 })
    }
}
