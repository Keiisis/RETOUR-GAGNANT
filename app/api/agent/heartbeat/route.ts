import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { userId } = body

        if (!userId) {
            return NextResponse.json({ error: 'userId requis' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { error } = await supabase
            .from('user_profiles')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', userId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Heartbeat error:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
