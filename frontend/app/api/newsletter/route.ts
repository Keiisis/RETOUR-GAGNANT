import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardPublic, EMAIL_LIMIT } from '@/lib/api-guard'

export async function POST(request: Request) {
    const trop = guardPublic(request, 'newsletter', EMAIL_LIMIT)
    if (trop) return trop

    try {
        const { email } = await request.json()

        if (!email || !email.includes('@')) {
            return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const clean = email.toLowerCase().trim()
        // Validation plus stricte
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
            return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
        }

        // Upsert : réabonne (status active) si l'email existait déjà / était désinscrit
        const { error } = await supabase
            .from('newsletter_subscribers')
            .upsert(
                {
                    email: clean,
                    status: 'active',
                    unsubscribed_at: null,
                    subscribed_at: new Date().toISOString(),
                    source: 'site',
                },
                { onConflict: 'email' }
            )

        if (error) {
            console.error('Newsletter subscribe error:', error)
            return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
