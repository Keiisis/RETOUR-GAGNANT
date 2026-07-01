import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendExpoPush } from '@/lib/notify/push'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ══════════════════════════════════════════════════════════════
// POST /api/notifications/push  { user_id, title, body }
// Appelé par le trigger Postgres (via pg_net) quand une notification
// est créée. Envoie le push Expo au(x) token(s) du client.
// Sécurisé par un secret partagé (header x-push-secret).
// ══════════════════════════════════════════════════════════════

const PUSH_SECRET = process.env.PUSH_SECRET || process.env.CRON_SECRET || ''

export async function POST(request: NextRequest) {
    // Vérif du secret (le trigger l'envoie ; sans lui, refus)
    const provided = request.headers.get('x-push-secret') || ''
    if (!PUSH_SECRET || provided !== PUSH_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const userId = String(body.user_id || '')
    const title = String(body.title || 'Retour Gagnant Bénin')
    const message = String(body.body || '')
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 })

    try {
        const { data: profile } = await supabase
            .from('client_profiles')
            .select('push_token')
            .eq('id', userId)
            .maybeSingle()

        const token = profile?.push_token
        if (!token) return NextResponse.json({ ok: true, sent: 0, reason: 'no_token' })

        const sent = await sendExpoPush([token], { title, body: message, data: { type: body.type || 'general' } })
        return NextResponse.json({ ok: true, sent })
    } catch (e) {
        console.error('[notifications/push]', e)
        return NextResponse.json({ error: 'push_failed' }, { status: 500 })
    }
}
