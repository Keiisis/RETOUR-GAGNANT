/* ═══════════════════════════════════════════════════════════
   E-mail de confirmation de compte : « code d'abord »

   Le client reçoit un code à 8 chiffres qu'il saisit dans l'application
   mobile (ou sur le site). Le lien de confirmation reste proposé en secours
   pour ceux qui préfèrent un navigateur.

   Direction artistique : identique à l'écran d'accueil de l'app.
   Fond blanc, encre anthracite (#3C3C3C, jamais de noir pur), accent vert
   Bénin (#008751), fin liseré tricolore en tête. Aucune autre couleur.
   HTML e-mail compatible (tableaux, styles inline, pas de flexbox).
═══════════════════════════════════════════════════════════ */

const GREEN = '#008751'
const YELLOW = '#FCD116'
const RED = '#E8112D'
const INK = '#3C3C3C'
const INK_MUTED = '#6B6B6B'
const INK_FAINT = '#9A9A9A'
const LINE = '#EFEFEF'
const GREEN_SOFT = '#E6F3ED'

export interface ConfirmEmailOptions {
    prenom?: string
    code: string
    confirmUrl: string
}

/** Découpe le code en cases individuelles pour un rendu premium. */
function renderCodeCells(code: string): string {
    const chars = (code || '').split('')
    const cells = chars.map(c => `
        <td style="padding:0 4px;">
            <div style="width:38px;height:48px;line-height:48px;text-align:center;
                        background:#FFFFFF;border:1px solid ${LINE};border-radius:12px;
                        font-family:'Courier New',monospace;font-size:24px;font-weight:700;
                        color:${INK};letter-spacing:1px;">${c}</div>
        </td>`).join('')
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>${cells}</tr></table>`
}

export function buildConfirmEmail(opts: ConfirmEmailOptions): string {
    const { prenom, code, confirmUrl } = opts
    const salutation = prenom ? `Bonjour ${prenom},` : 'Bonjour,'

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#F5F5F5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:32px 12px;">
<tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0"
           style="max-width:600px;width:100%;background:#FFFFFF;border-radius:20px;overflow:hidden;
                  box-shadow:0 12px 32px rgba(60,60,60,0.06);">

        <!-- Liseré tricolore, signature de la maison -->
        <tr><td style="height:6px;padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="background:${GREEN};height:6px;"></td>
                <td style="background:${YELLOW};height:6px;"></td>
                <td style="background:${RED};height:6px;"></td>
            </tr></table>
        </td></tr>

        <tr><td style="padding:40px 40px 8px 40px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;
                        letter-spacing:1.2px;text-transform:uppercase;color:${GREEN};">Vérification</div>
            <h1 style="margin:8px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;
                       line-height:32px;color:${INK};font-weight:700;">Confirmez votre compte</h1>
        </td></tr>

        <tr><td style="padding:16px 40px 0 40px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${INK_MUTED};">
                ${salutation} merci de votre inscription sur <strong style="color:${INK};">Retour Gagnant Bénin</strong>.
                Saisissez le code ci-dessous dans l'application pour activer votre compte.
            </p>
        </td></tr>

        <!-- Le code, mis en scène -->
        <tr><td style="padding:28px 40px 8px 40px;" align="center">
            <div style="background:${GREEN_SOFT};border-radius:16px;padding:24px 16px;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;
                            letter-spacing:1px;text-transform:uppercase;color:${GREEN};margin-bottom:14px;">
                    Votre code de confirmation
                </div>
                ${renderCodeCells(code)}
            </div>
        </td></tr>

        <tr><td style="padding:8px 40px 0 40px;" align="center">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${INK_FAINT};">
                Ce code est valable 1 heure. Ne le partagez avec personne.
            </p>
        </td></tr>

        <!-- Séparateur -->
        <tr><td style="padding:28px 40px 0 40px;">
            <div style="border-top:1px solid ${LINE};"></div>
        </td></tr>

        <!-- Lien de secours -->
        <tr><td style="padding:20px 40px 0 40px;" align="center">
            <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:${INK_MUTED};">
                Vous préférez confirmer depuis un navigateur ?
            </p>
            <a href="${confirmUrl}"
               style="display:inline-block;background:${GREEN};color:#FFFFFF;text-decoration:none;
                      font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;
                      padding:13px 28px;border-radius:12px;">Confirmer mon adresse email</a>
        </td></tr>

        <tr><td style="padding:32px 40px 40px 40px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;color:${INK_FAINT};">
                Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.
            </p>
        </td></tr>
    </table>

    <p style="margin:20px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${INK_FAINT};">
        Retour Gagnant Bénin : Cotonou, Bénin
    </p>
</td></tr>
</table>
</body>
</html>`
}
