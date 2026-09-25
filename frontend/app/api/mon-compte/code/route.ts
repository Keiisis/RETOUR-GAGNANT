// POST /api/mon-compte/code — envoie un code d'accès à l'adresse saisie.
// Réponse identique que l'adresse soit connue ou non (aucune fuite
// d'existence de dossier). Voir lib/espace-email.ts.
import { NextRequest, NextResponse } from 'next/server'
import { guardPublic, EMAIL_LIMIT } from '@/lib/api-guard'
import { creerDefi, normaliserEmail } from '@/lib/espace-email'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
    const trop = guardPublic(req, 'mon-compte/code', EMAIL_LIMIT)
    if (trop) return trop

    const body = await req.json().catch(() => ({}))
    const email = normaliserEmail(body?.email)
    if (!email) return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 })

    // Second compteur par adresse : empêche d'inonder une boîte depuis plusieurs IP.
    const tropAdresse = guardPublic(req, 'mon-compte/code-adresse', EMAIL_LIMIT, `mc:${email}`)
    if (tropAdresse) return tropAdresse

    const { code, defi } = creerDefi(email)
    const envoi = await sendEmail({
        to: email,
        subject: `Votre code d'accès : ${code}`,
        context: 'mon-compte-code',
        html: `<p>Bonjour,</p>
<p>Voici votre code d'accès à votre espace Retour Gagnant Bénin :</p>
<p style="font-size:28px;font-weight:800;letter-spacing:6px;margin:16px 0">${code}</p>
<p>Il est valable 10 minutes. Si vous n'avez rien demandé, ignorez ce message : personne ne peut accéder à votre espace sans ce code.</p>`,
    })
    if (!envoi.success) {
        return NextResponse.json({ error: "L'email n'a pas pu être envoyé. Réessayez dans un instant." }, { status: 502 })
    }
    return NextResponse.json({ defi })
}
