import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { collectByEmail } from '@/lib/rgpd/erase'
import { makeRgpdToken } from '@/lib/rgpd/token'
import { isEmail } from '@/lib/rgpd/tables'
import { sendEmail } from '@/lib/email'
import { guardPublic, EMAIL_LIMIT } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

// ══════════════════════════════════════════════════════════════
// POST /api/rgpd/request  { email }
// Self-service public : envoie un LIEN SÉCURISÉ à l'email saisi.
// Réponse TOUJOURS identique (anti-énumération) : on ne révèle jamais
// si l'email existe en base. Seul le propriétaire de la boîte reçoit le lien.
// ══════════════════════════════════════════════════════════════

const GENERIC = {
    success: true,
    message: 'Si des données sont associées à cette adresse, un lien sécurisé vient de vous être envoyé par e-mail. Vérifiez votre boîte de réception (et vos spams).',
}

// Anti-abus mémoire (best-effort, par instance)
const lastSent = new Map<string, number>()
const COOLDOWN_MS = 2 * 60 * 1000

export async function POST(request: NextRequest) {
    const trop = guardPublic(request, 'rgpd/request', EMAIL_LIMIT)
    if (trop) return trop

    const body = await request.json().catch(() => ({}))
    const email = String(body.email || '').toLowerCase().trim()

    // Toujours la même réponse, quelle que soit la validité/existence
    if (!isEmail(email)) return NextResponse.json(GENERIC)

    const now = Date.now()
    const prev = lastSent.get(email)
    if (prev && now - prev < COOLDOWN_MS) return NextResponse.json(GENERIC)
    lastSent.set(email, now)

    try {
        const supabase = createClient(supabaseUrl, serviceKey)
        const preview = await collectByEmail(supabase, email)

        // N'envoyer un lien que si des données existent réellement
        if (preview.found) {
            const token = makeRgpdToken(email)
            const link = `${SITE_URL}/mes-donnees?token=${encodeURIComponent(token)}`
            await sendEmail({
                to: email,
                subject: 'Accès à vos données personnelles — Retour Gagnant Bénin',
                context: 'rgpd_request',
                html: rgpdEmailHtml(link),
            })
        }
    } catch (err) {
        console.error('[RGPD request]', err)
        // on garde la réponse générique même en cas d'erreur
    }

    return NextResponse.json(GENERIC)
}

function rgpdEmailHtml(link: string): string {
    return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #eef2f1;border-radius:14px;overflow:hidden">
        <div style="height:5px;background:linear-gradient(90deg,#008751 0 33%,#FCD116 33% 66%,#E8112D 66% 100%)"></div>
        <div style="padding:28px 30px">
            <h1 style="margin:0 0 4px;color:#047857;font-size:19px">Retour Gagnant Bénin</h1>
            <p style="margin:0 0 20px;color:#718096;font-size:12px">Accompagnement de la diaspora · Cotonou, Bénin</p>
            <h2 style="color:#1a2332;font-size:17px;margin:0 0 12px">Accès à vos données personnelles</h2>
            <p style="color:#4A5568;font-size:14px;line-height:1.6;margin:0 0 18px">
                Vous avez demandé à consulter ou supprimer les données que nous détenons sur vous.
                Pour des raisons de sécurité, nous devons vérifier que vous êtes bien le propriétaire de cette adresse e-mail.
                Cliquez sur le bouton ci-dessous pour accéder à votre espace sécurisé :
            </p>
            <p style="text-align:center;margin:24px 0">
                <a href="${link}" style="background:#10B981;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:bold;font-size:14px;display:inline-block">Accéder à mes données</a>
            </p>
            <p style="color:#718096;font-size:12px;line-height:1.6;margin:18px 0 0">
                Ce lien est valable <strong>1 heure</strong> et ne fonctionne qu'une fois ouvert depuis votre boîte.
                Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail : aucune action ne sera effectuée.
            </p>
            <hr style="border:none;border-top:1px solid #eef2f1;margin:22px 0">
            <p style="color:#9aa5b1;font-size:11px;margin:0;text-align:center">
                contact@retourgagnantbenin.bj · www.retourgagnantbenin.bj · +229 01 60 32 21 21
            </p>
        </div>
    </div>`
}
