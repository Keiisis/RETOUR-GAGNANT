import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

function sb() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
}

// GET /api/ceo/clients — tous les clients (client_profiles ou user_profiles role=client)
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const supabase = sb()

    // Essai client_profiles
    const { data: cp, error: cpErr } = await supabase
        .from('client_profiles')
        .select('id, created_at, email, full_name, phone, city, country, avatar_url')
        .order('created_at', { ascending: false })
        .limit(1000)

    if (!cpErr && cp && cp.length > 0) {
        return NextResponse.json({ clients: cp, source: 'client_profiles' })
    }

    // Fallback user_profiles role=client
    const { data: up, error: upErr } = await supabase
        .from('user_profiles')
        .select('id, created_at, email, full_name, phone, city, country, avatar_url, last_seen_at')
        .eq('role', 'client')
        .order('created_at', { ascending: false })
        .limit(1000)

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    return NextResponse.json({ clients: up || [], source: 'user_profiles' })
}
