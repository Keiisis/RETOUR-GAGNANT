import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySync } from 'otplib'
import { verifyApiAuth } from '@/lib/api-auth'
import { decryptString } from '@/lib/encryption'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// DELETE /api/admin/2fa/disable
// Body: { code: "123456" } : nécessite un code valide pour désactiver
export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const { code } = body as { code?: string }

    if (!code || !/^\d{6}$/.test(code)) {
        return NextResponse.json({ error: 'Code TOTP requis pour désactiver la 2FA' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const userId = auth.userId!

    const { data: totpRow } = await supabase
        .from('totp_secrets')
        .select('secret, enabled')
        .eq('user_id', userId)
        .maybeSingle()

    if (!totpRow?.enabled) {
        return NextResponse.json({ error: '2FA non activée' }, { status: 400 })
    }

    let secret: string
    try {
        secret = decryptString(totpRow.secret)
    } catch {
        return NextResponse.json({ error: 'Erreur déchiffrement' }, { status: 500 })
    }

    const result = verifySync({ token: code, secret })
    const isValid = typeof result === 'object' ? result.valid : Boolean(result)

    if (!isValid) {
        return NextResponse.json({ error: 'Code incorrect' }, { status: 401 })
    }

    await supabase.from('totp_secrets').delete().eq('user_id', userId)

    const res = NextResponse.json({ success: true })
    res.cookies.delete('totp_verified')
    return res
}
