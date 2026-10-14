// ══════════════════════════════════════════════════════════════
//  Fiche de synthèse d'enregistrement MyAfroOrigins (PDF).
//
//  GET  ?lang=fr → télécharge la fiche.
//  POST { lang } → l'envoie au client (à l'e-mail de suivi saisi), PDF joint ;
//                  l'envoi est daté sur la fiche.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { estNature } from '@/lib/myafro-enregistrement'
import { lireEnregistrement, noterFicheEnvoyee } from '@/lib/myafro-enregistrement-serveur'
import { dessinerFicheSuivi, messageFiche, nomFichierFiche } from '@/lib/fiche-suivi-pdf'
import { langueDoc } from '@/lib/document-langues'
import { sendEmail, EMAIL_WRAPPER } from '@/lib/email'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Ctx = { params: Promise<{ nature: string; id: string }> }

async function charger(request: NextRequest, ctx: Ctx) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return { erreur: auth.error! }
    const { nature, id } = await ctx.params
    if (!estNature(nature) || !UUID.test(id)) return { erreur: NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 }) }
    const e = await lireEnregistrement(nature, id)
    if (!e) return { erreur: NextResponse.json({ error: "Aucun enregistrement MyAfroOrigins pour ce dossier : renseignez-le d'abord." }, { status: 404 }) }
    return { e }
}

export async function GET(request: NextRequest, ctx: Ctx) {
    const r = await charger(request, ctx)
    if (r.erreur) return r.erreur
    const pdf = dessinerFicheSuivi(r.e, langueDoc(request.nextUrl.searchParams.get('lang')))
    return new NextResponse(new Uint8Array(pdf.output('arraybuffer')), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(nomFichierFiche(r.e))}"; filename*=UTF-8''${encodeURIComponent(nomFichierFiche(r.e))}`,
            'Cache-Control': 'private, no-store',
        },
    })
}

export async function POST(request: NextRequest, ctx: Ctx) {
    const r = await charger(request, ctx)
    if (r.erreur) return r.erreur
    const body = await request.json().catch(() => ({})) as { lang?: string }
    const lang = langueDoc(body.lang)
    const e = r.e
    const pdf = dessinerFicheSuivi(e, lang)
    const m = messageFiche(lang, e.demandeur.prenom, e.numeroDossier)
    const html = await EMAIL_WRAPPER(`<p style="font-size:15px;line-height:1.7;color:#1B2A4A;">${m.corps}</p>`, lang, { heroTitle: m.titre })
    const envoi = await sendEmail({
        to: e.emailSuivi,
        subject: m.sujet,
        html,
        context: 'fiche_suivi_myafro',
        relatedId: e.dossierId,
        attachments: [{ filename: nomFichierFiche(e), content: Buffer.from(pdf.output('arraybuffer')).toString('base64'), contentType: 'application/pdf' }],
    })
    if (!envoi.success) return NextResponse.json({ error: envoi.error || 'Envoi impossible' }, { status: 502 })
    await noterFicheEnvoyee(e, e.emailSuivi)
    return NextResponse.json({ ok: true, envoyeeA: e.emailSuivi })
}
