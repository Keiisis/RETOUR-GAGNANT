import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { rateLimit, getClientIp, type RateLimitConfig } from '@/lib/rate-limit'
import { guardPublic, EMAIL_LIMIT } from '@/lib/api-guard'
import { buildConfirmEmail } from '@/lib/emails/confirm-email'

// Limite par IP (en plus de la limite par email) : empêche un attaquant de
// faire tourner les emails pour épuiser le quota SMTP.
const RESEND_IP_LIMIT: RateLimitConfig = { limit: 10, window: 60 * 60 * 1000, blockDuration: 60 * 60 * 1000 }

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Rate limiting : max 3 renvois par email par heure
const resendAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_RESEND = 3
const WINDOW_MS = 60 * 60 * 1000

function isRateLimited(email: string): boolean {
    const now = Date.now()
    const entry = resendAttempts.get(email)
    if (!entry || now > entry.resetAt) {
        resendAttempts.set(email, { count: 1, resetAt: now + WINDOW_MS })
        return false
    }
    entry.count++
    return entry.count > MAX_RESEND
}

export async function POST(req: NextRequest) {
    const trop = guardPublic(req, 'client/resend-confirmation', EMAIL_LIMIT)
    if (trop) return trop

    try {
        // Limite par IP (anti-abus SMTP par rotation d'emails)
        const ipLimit = rateLimit(`resend:${getClientIp(req)}`, RESEND_IP_LIMIT)
        if (!ipLimit.allowed) {
            return NextResponse.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, { status: 429 })
        }

        const body = await req.json()
        const email = body?.email
        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Email requis' }, { status: 400 })
        }
        const normalizedEmail = email.toLowerCase().trim()

        if (isRateLimited(normalizedEmail)) {
            return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans 1 heure.' }, { status: 429 })
        }

        // Vérifier que l'utilisateur existe
        const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
        const users = usersData?.users ?? []
        const existingUser = users.find((u: { email?: string; email_confirmed_at?: string | null }) => u.email === normalizedEmail)

        // Succès silencieux si absent ou déjà confirmé
        if (!existingUser || existingUser.email_confirmed_at) {
            return NextResponse.json({ success: true })
        }

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

        // Utilise magiclink pour confirmer l'email ET connecter l'utilisateur en un clic
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: normalizedEmail,
            options: {
                redirectTo: siteUrl + '/auth/callback?next=/client/auth-confirm'
            }
        })

        if (linkError || !linkData?.properties?.action_link) {
            throw new Error(linkError?.message || 'Impossible de générer le lien de confirmation')
        }

        const actionLink = linkData.properties.action_link
        // Code à 8 chiffres saisi dans l'app (vérifié via verifyOtp — l'écran
        // mobile essaie le type 'magiclink' en plus de 'signup').
        const emailOtp = linkData.properties.email_otp || ''
        const existingPrenom = (existingUser.user_metadata?.prenom as string) || (existingUser.user_metadata?.nom as string) || ''

        // Config SMTP depuis Supabase settings
        const { data: settingsData } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_email', 'smtp_from_name'])

        const settings: Record<string, string> = {}
        for (const s of settingsData ?? []) settings[s.key] = s.value

        if (!settings.smtp_host) {
            throw new Error('Configuration SMTP manquante — vérifiez l\'admin')
        }

        const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: Number(settings.smtp_port) || 465,
            secure: Number(settings.smtp_port) === 465,
            auth: { user: settings.smtp_user, pass: settings.smtp_pass },
            tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' }
        })

        const fromName = settings.smtp_from_name || 'Retour Gagnant Bénin'
        const fromEmail = settings.smtp_from_email || settings.smtp_user
        const fromString = '"' + fromName + '" <' + fromEmail + '>'

        const htmlContent = buildConfirmEmail({
            prenom: existingPrenom,
            code: emailOtp,
            confirmUrl: actionLink,
        })

        await transporter.sendMail({
            from: fromString,
            to: normalizedEmail,
            subject: `Votre code de confirmation : ${emailOtp} — Retour Gagnant Bénin`,
            html: htmlContent
        })

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[resend-confirmation]', err)
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
