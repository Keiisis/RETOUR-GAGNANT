import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateSecret, generateURI } from 'otplib'
import QRCode from 'qrcode'
import { verifyApiAuth } from '@/lib/api-auth'
import { encryptString } from '@/lib/encryption'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP_NAME    = 'Retour Gagnant Admin'

// POST /api/admin/2fa/setup
// Génère un secret TOTP + QR code pour l'admin connecté
// Ne l'active PAS encore — nécessite une vérification via /verify
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const supabase = createClient(supabaseUrl, serviceKey)
    const userId = auth.userId!

    // Récupérer l'email de l'admin
    const { data: userRow } = await supabase.auth.admin.getUserById(userId)
    const email = userRow?.user?.email || userId

    // Générer un nouveau secret TOTP
    const secret = generateSecret()
    const otpAuthUrl = generateURI({ label: `${APP_NAME}:${email}`, issuer: APP_NAME, secret })
    const qrCode = await QRCode.toDataURL(otpAuthUrl)

    // Sauvegarder le secret chiffré (non activé encore)
    const encryptedSecret = encryptString(secret)
    const { error } = await supabase.from('totp_secrets').upsert(
        { user_id: userId, secret: encryptedSecret, enabled: false },
        { onConflict: 'user_id' }
    )

    if (error) {
        return NextResponse.json({ error: 'Erreur sauvegarde secret 2FA' }, { status: 500 })
    }

    return NextResponse.json({ qrCode, secret }) // secret en clair pour saisie manuelle
}
