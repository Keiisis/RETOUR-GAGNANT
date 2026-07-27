// ══════════════════════════════════════════════════════════════
// Email « Finalisez votre dossier » (lien de complément signé, sans repaiement).
// Partagé par :
//   - POST /api/agent/nationalite/relance  (bouton « Relancer » des panels)
//   - le cron de récupération des fiches webhook incomplètes
// Le contexte email_logs `nationality_relance` sert d'idempotence : le cron
// n'enverra jamais de doublon si une relance (auto ou manuelle) est déjà partie.
// ══════════════════════════════════════════════════════════════

import { sendEmail } from '@/lib/email'
import { signResumeToken } from '@/lib/nationality-token'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

export interface ResumeEmailTarget {
    id: string
    application_ref: string
    nom?: string | null
    prenom?: string | null
    email: string
}

function relanceHtml(prenom: string, nom: string, ref: string, link: string) {
    const civil = prenom ? prenom : nom
    return `
    <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;">
        <div style="background:linear-gradient(135deg,#006b40,#008751);padding:30px 40px;text-align:center;">
            <img src="${SITE}/logo.jpg" alt="Retour Gagnant Bénin" width="60" height="60" style="border-radius:14px;object-fit:cover;border:3px solid rgba(255,255,255,0.4);margin-bottom:12px;" />
            <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;letter-spacing:0.5px;">Retour Gagnant Bénin</h1>
            <p style="color:#FCD116;font-size:11px;text-transform:uppercase;letter-spacing:3px;margin:6px 0 0;font-weight:600;">Reconnaissance de la Nationalité Béninoise</p>
        </div>

        <div style="padding:36px 40px;color:#1f2937;font-size:15px;line-height:1.85;">
            <p>Cher(e) ${civil || 'client(e)'},</p>

            <p>Votre démarche de reconnaissance de la nationalité béninoise nous tient particulièrement à cœur, et je tenais personnellement à vous accompagner dans sa finalisation.</p>

            <p>Afin que notre service juridique puisse instruire votre dossier <strong>(référence ${ref})</strong> dans les meilleures conditions et sans délai, il nous reste à réunir vos pièces justificatives. Pour vous simplifier au maximum cette étape, nous avons préparé un <strong>espace personnel sécurisé</strong> qui reprend l'intégralité de vos informations : vous n'aurez qu'à y déposer vos documents.</p>

            <p style="background:#f0fdf6;border-left:4px solid #008751;padding:14px 18px;border-radius:6px;color:#065f46;">
                <strong>Aucun paiement ne vous sera redemandé.</strong> Vos frais de traitement sont déjà réglés — cet espace sert uniquement à joindre vos pièces en toute sérénité.
            </p>

            <div style="text-align:center;margin:32px 0;">
                <a href="${link}" style="display:inline-block;background:#008751;color:#fff;text-decoration:none;padding:15px 42px;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:0.3px;">
                    Déposer mes documents
                </a>
                <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;">Lien personnel et confidentiel — à n'utiliser que par vos soins.</p>
            </div>

            <p>Nos équipes restent naturellement à votre entière disposition pour vous guider, à chaque instant, jusqu'à l'aboutissement de votre dossier. C'est une démarche profondément symbolique : celle du retour vers la terre de vos ancêtres, et nous sommes honorés de la mener à vos côtés.</p>

            <p style="margin-top:26px;">Avec tout notre dévouement,<br><strong>Votre conseiller dédié</strong><br>Retour Gagnant Bénin</p>
        </div>

        <div style="padding:18px 40px;background:#0d1117;text-align:center;">
            <p style="margin:0;color:#6b7280;font-size:11px;line-height:1.6;">
                &copy; ${new Date().getFullYear()} Retour Gagnant Bénin — Tous droits réservés<br>
                <a href="${SITE}" style="color:#008751;text-decoration:none;">${SITE.replace('https://', '')}</a>
            </p>
        </div>
    </div>`
}

export async function sendNationalityResumeEmail(
    app: ResumeEmailTarget,
    mode: 'docs' | 'full' = 'docs',
): Promise<{ success: boolean; error?: string }> {
    if (!app.email) return { success: false, error: 'Aucune adresse email pour ce dossier' }

    const token = signResumeToken(app.id, 30)
    // mode=docs → écran léger « pièces jointes seules » ; mode=full → formulaire
    // complet pré-rempli (utile si des informations aussi sont à corriger).
    const link = `${SITE}/nationalite/formulaire?resume=${encodeURIComponent(token)}${mode === 'docs' ? '&mode=docs' : ''}`

    const res = await sendEmail({
        to: app.email,
        subject: `Finalisez votre dossier de nationalité — Réf. ${app.application_ref}`,
        html: relanceHtml(app.prenom || '', app.nom || '', app.application_ref, link),
        context: 'nationality_relance',
        relatedId: app.id,
    })

    return res.success ? { success: true } : { success: false, error: res.error || 'Échec de l\'envoi de l\'email' }
}
