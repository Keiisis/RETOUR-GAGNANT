import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySync } from 'otplib'
import { verifyApiAuth } from '@/lib/api-auth'
import { decryptString } from '@/lib/encryption'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// POST /api/admin/2fa/verify
// Body: { code: "123456", action: "setup" | "login" }
// - action="setup" → active la 2FA si le code est correct
// - action="login" → valide le code lors de la connexion (retourne un cookie)
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const { code, action } = body as { code?: string; action?: string }

    if (!code || !/^\d{6}$/.test(code)) {
        return NextResponse.json({ error: 'Code TOTP invalide (6 chiffres requis)' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const userId = auth.userId!

    const { data: totpRow } = await supabase
        .from('totp_secrets')
        .select('secret, enabled')
        .eq('user_id', userId)
        .maybeSingle()

    if (!totpRow?.secret) {
        return NextResponse.json({ error: 'La 2FA n\'est pas configurée. Lancez d\'abord le setup.' }, { status: 400 })
    }

    let secret: string
    try {
        secret = decryptString(totpRow.secret)
    } catch {
        return NextResponse.json({ error: 'Erreur déchiffrement secret 2FA' }, { status: 500 })
    }

    const result = verifySync({ token: code, secret })
    const isValid = typeof result === 'object' ? result.valid : Boolean(result)

    if (!isValid) {
        return NextResponse.json({ error: 'Code incorrect' }, { status: 401 })
    }

    // Activation initiale
    if (action === 'setup' && !totpRow.enabled) {
        await supabase.from('totp_secrets')
            .update({ enabled: true, verified_at: new Date().toISOString() })
            .eq('user_id', userId)
    }

    // Retourner un cookie de session 2FA (valable 8h)
    const res = NextResponse.json({ success: true })
    res.cookies.set('totp_verified', 'true', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 8 * 60 * 60, // 8 heures
    })
    return res
}
