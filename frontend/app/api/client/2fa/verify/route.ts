import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySync } from 'otplib'
import { decryptString } from '@/lib/encryption'
import { getClientUser } from '@/lib/client-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// POST /api/client/2fa/verify  { code, action: 'setup' | 'login' }
export async function POST(request: NextRequest) {
    const user = await getClientUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { code, action } = body as { code?: string; action?: string }
    if (!code || !/^\d{6}$/.test(code)) {
        return NextResponse.json({ error: 'Code TOTP invalide (6 chiffres requis)' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: totpRow } = await supabase
        .from('totp_secrets').select('secret, enabled').eq('user_id', user.id).maybeSingle()
    if (!totpRow?.secret) {
        return NextResponse.json({ error: 'La 2FA n\'est pas configurée.' }, { status: 400 })
    }

    let secret: string
    try { secret = decryptString(totpRow.secret) } catch {
        return NextResponse.json({ error: 'Erreur déchiffrement secret 2FA' }, { status: 500 })
    }

    const result = verifySync({ token: code, secret })
    const isValid = typeof result === 'object' ? result.valid : Boolean(result)
    if (!isValid) return NextResponse.json({ error: 'Code incorrect' }, { status: 401 })

    if (action === 'setup' && !totpRow.enabled) {
        await supabase.from('totp_secrets')
            .update({ enabled: true, verified_at: new Date().toISOString() })
            .eq('user_id', user.id)
    }

    // Cookie de session 2FA (8h) : lu par le middleware pour /client
    const res = NextResponse.json({ success: true })
    res.cookies.set('client_totp_verified', 'true', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 8 * 60 * 60,
    })
    return res
}
