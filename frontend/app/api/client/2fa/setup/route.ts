import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateSecret, generateURI } from 'otplib'
import QRCode from 'qrcode'
import { encryptString } from '@/lib/encryption'
import { getClientUser } from '@/lib/client-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP_NAME = 'Retour Gagnant Bénin'

// POST /api/client/2fa/setup — génère un secret TOTP + QR (non activé)
export async function POST(request: NextRequest) {
    const user = await getClientUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const supabase = createClient(supabaseUrl, serviceKey)
    const secret = generateSecret()
    const otpAuthUrl = generateURI({ label: `${APP_NAME}:${user.email}`, issuer: APP_NAME, secret })
    const qrCode = await QRCode.toDataURL(otpAuthUrl)

    const { error } = await supabase.from('totp_secrets').upsert(
        { user_id: user.id, secret: encryptString(secret), enabled: false },
        { onConflict: 'user_id' }
    )
    if (error) return NextResponse.json({ error: 'Erreur sauvegarde secret 2FA' }, { status: 500 })

    return NextResponse.json({ qrCode, secret })
}
