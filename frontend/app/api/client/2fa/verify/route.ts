import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySync } from 'otplib'
import { decryptString } from '@/lib/encryption'
import { signer2FA, COOKIE_2FA, optionsCookie2FA, TENTATIVES_2FA } from '@/lib/totp-cookie'
import { guardPublic } from '@/lib/api-guard'
import { getClientUser } from '@/lib/client-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// POST /api/client/2fa/verify  { code, action: 'setup' | 'login' }
export async function POST(request: NextRequest) {
    const user = await getClientUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    // Plafond d'essais par compte (pas par IP : l'attaquant change d'IP, pas de compte)
    const trop = guardPublic(request, '2fa-client', TENTATIVES_2FA, `u:${user.id}`)
    if (trop) return trop

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

    // Preuve 2FA de session (8 h) lue par le middleware : jeton signé, lié à ce client
    const res = NextResponse.json({ success: true })
    res.cookies.set(COOKIE_2FA.client, await signer2FA('client', user.id), optionsCookie2FA)
    return res
}
