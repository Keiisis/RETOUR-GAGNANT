import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateSecret, generateURI } from 'otplib'
import QRCode from 'qrcode'
import { encryptString } from '@/lib/encryption'
import { getClientUser } from '@/lib/client-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP_NAME = 'Retour Gagnant Bénin'

// POST /api/client/2fa/setup : génère un secret TOTP + QR (non activé)
export async function POST(request: NextRequest) {
    const user = await getClientUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    /* Tout est encapsulé : `encryptString` LÈVE si ENCRYPTION_KEY manque en
       production, et une exception non rattrapée fait répondre à Next une
       page d'erreur HTML. L'application mobile, elle, appelle `res.json()`
       sur cette page, échoue à la lire et affiche « Erreur de connexion » —
       un message qui désigne le réseau alors que le réseau va très bien.
       Le vrai motif doit remonter jusqu'à l'écran. */
    try {
        const supabase = createClient(supabaseUrl, serviceKey)
        const secret = generateSecret()
        const otpAuthUrl = generateURI({ label: `${APP_NAME}:${user.email}`, issuer: APP_NAME, secret })
        const qrCode = await QRCode.toDataURL(otpAuthUrl)

        const { error } = await supabase.from('totp_secrets').upsert(
            { user_id: user.id, secret: encryptString(secret), enabled: false },
            { onConflict: 'user_id' }
        )
        if (error) {
            console.error('[2fa/setup] enregistrement du secret :', error.message)
            return NextResponse.json({ error: 'Enregistrement du secret impossible.' }, { status: 500 })
        }

        return NextResponse.json({ qrCode, secret })
    } catch (e) {
        const motif = e instanceof Error ? e.message : 'Erreur inconnue'
        console.error('[2fa/setup]', motif)
        const cle = motif.includes('ENCRYPTION_KEY')
        return NextResponse.json({
            error: cle
                ? "La double authentification n'est pas configurée sur le serveur (clé de chiffrement absente). Contactez le support."
                : 'Activation impossible pour le moment.',
        }, { status: 500 })
    }
}
