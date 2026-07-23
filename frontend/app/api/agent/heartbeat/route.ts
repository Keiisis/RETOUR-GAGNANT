import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    try {
        const body = await request.json()
        const { userId } = body

        if (!userId) {
            return NextResponse.json({ error: 'userId requis' }, { status: 400 })
        }

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('[Heartbeat] Variables env manquantes:', {
                url: !!supabaseUrl,
                key: !!supabaseServiceKey,
            })
            return NextResponse.json({ error: 'Config serveur manquante' }, { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const now = new Date().toISOString()

        const { error, count } = await supabase
            .from('user_profiles')
            .update({ last_seen_at: now }, { count: 'exact' })
            .eq('id', userId)

        if (error) {
            console.error('[Heartbeat] Erreur UPDATE:', error.message, '| userId:', userId)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (count === 0) {
            // Ligne introuvable → tenter un UPSERT minimal pour créer la ligne si absente
            console.warn('[Heartbeat] 0 lignes affectées pour userId:', userId, '— ligne absente?')
            return NextResponse.json({ success: false, warning: 'Aucune ligne affectée — profil inexistant?', userId })
        }

        return NextResponse.json({ success: true, updated: count, timestamp: now })
    } catch (error) {
        console.error('[Heartbeat] Exception:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
