// ══════════════════════════════════════════════════════════════
// Emails liés au PAIEMENT d'une demande de nationalité :
//   1. notifyStaffNationalityPayment — alerte l'équipe qu'un client a payé
//      (incident 2026-06 : deux clients avaient payé sans qu'aucune
//       notification ne parte → dossiers perdus. Ne plus jamais reproduire.)
//   2. sendNationalityPaymentReceipt — reçu de paiement officiel au client
//      (le flux boutique a ses factures via `orders`/`invoices`, mais la
//       nationalité ne crée pas d'order → reçu dédié envoyé ici).
// Les deux sont appelés en fire-and-forget : jamais bloquants pour le client.
// ══════════════════════════════════════════════════════════════

import { sendEmail, getEmailConfig } from '@/lib/email'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

// Destinataires fixes des alertes équipe (mêmes que les relances Classement)
const STAFF_RECIPIENTS = [
    'kevinrtgagnant@gmail.com',
    'pdg.retourgagnantbenin@gmail.com',
    'ornelmitchai6@gmail.com',
    'jeanbaptiste01rgb@gmail.com',
    'tiamiounadjathrgb@gmail.com',
]

export interface NationalityPaymentInfo {
    nom: string
    prenom: string
    email: string
    telephone?: string | null
    refDossier: string
    amount: number
    currency: string
    paymentMethod: string
    paymentRef?: string | null
    /** Libellé du service (défaut : « Demande de nationalité »). */
    service?: string
}

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const frDate = () => new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Porto-Novo' })

/* ── 1. Alerte équipe : un client a payé ─────────────────────── */
export async function notifyStaffNationalityPayment(p: NationalityPaymentInfo): Promise<void> {
    try {
        const config = await getEmailConfig()
        const recipients = [...new Set([...STAFF_RECIPIENTS, ...(config.adminEmail ? [config.adminEmail] : [])])]

        const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #eef2f1;border-radius:14px;overflow:hidden">
          <div style="height:5px;background:#008751;background:linear-gradient(90deg,#008751 0 33%,#FCD116 33% 66%,#E8112D 66% 100%)"></div>
          <div style="padding:26px 28px">
            <p style="margin:0 0 4px;color:#047857;font-size:13px;font-weight:800">Retour Gagnant Bénin — Alerte Paiement</p>
            <h1 style="margin:0 0 6px;color:#1B2A4A;font-size:20px;font-weight:800">Paiement reçu — ${esc(p.service || 'Demande de nationalité')}</h1>
            <p style="margin:0 0 18px;color:#8B94A6;font-size:13px">${esc(frDate())}</p>

            <div style="background:#F4FAF6;border:1px solid rgba(0,135,81,0.2);border-radius:10px;padding:16px 18px;text-align:center;margin:0 0 18px">
              <p style="margin:0;font-size:11px;font-weight:800;color:#047857;text-transform:uppercase;letter-spacing:.15em">Montant encaissé</p>
              <p style="margin:6px 0 0;font-size:30px;font-weight:900;color:#008751">${esc(p.amount)} ${esc(p.currency)}</p>
              <p style="margin:4px 0 0;font-size:12px;color:#8B94A6">via ${esc(p.paymentMethod)}${p.paymentRef ? ` — Réf. transaction <span style="font-family:monospace">${esc(p.paymentRef)}</span>` : ''}</p>
            </div>

            <table style="width:100%;border-collapse:collapse;background:#F8FAF9;border-radius:10px;overflow:hidden;margin:0 0 20px">
              <tr><td style="padding:9px 14px;color:#8B94A6;font-size:12px;width:150px">Client</td><td style="padding:9px 14px;color:#1B2A4A;font-size:13px;font-weight:700">${esc(p.prenom)} ${esc(p.nom)}</td></tr>
              <tr><td style="padding:9px 14px;color:#8B94A6;font-size:12px">Email</td><td style="padding:9px 14px;color:#1B2A4A;font-size:13px">${esc(p.email)}</td></tr>
              ${p.telephone ? `<tr><td style="padding:9px 14px;color:#8B94A6;font-size:12px">Téléphone</td><td style="padding:9px 14px;color:#1B2A4A;font-size:13px">${esc(p.telephone)}</td></tr>` : ''}
              <tr><td style="padding:9px 14px;color:#8B94A6;font-size:12px">Dossier</td><td style="padding:9px 14px;color:#1B2A4A;font-size:13px;font-weight:700;font-family:monospace">${esc(p.refDossier)}</td></tr>
            </table>

            <a href="${SITE}/admin/nationalite" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:800;font-size:13px">Ouvrir les demandes de nationalité</a>
            <p style="margin:18px 0 0;color:#9aa5b1;font-size:11px;text-align:center">Notification automatique — Retour Gagnant Bénin</p>
          </div>
        </div>`

        await sendEmail({
            to: recipients.join(', '),
            subject: `Paiement reçu — ${p.service || 'Nationalité'} — ${p.prenom} ${p.nom} (${p.amount} ${p.currency})`,
            html,
            context: 'nationality_payment_alert',
            relatedId: p.refDossier,
        })
    } catch (e) {
        console.error('[NAT-PAYMENT] alerte staff échouée (non bloquant):', e instanceof Error ? e.message : e)
    }
}

/* ── 2. Reçu de paiement officiel au client ──────────────────── */
export async function sendNationalityPaymentReceipt(p: NationalityPaymentInfo): Promise<void> {
    try {
        const html = `
        <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;">
            <div style="background:#008751;background:linear-gradient(135deg,#006b40,#008751);padding:28px 40px;text-align:center;">
                <img src="${SITE}/logo.jpg" alt="Retour Gagnant Bénin" width="60" height="60" style="border-radius:14px;object-fit:cover;border:3px solid rgba(255,255,255,0.4);margin-bottom:12px;" />
                <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;letter-spacing:0.5px;">Retour Gagnant Bénin</h1>
                <p style="color:#FCD116;font-size:11px;text-transform:uppercase;letter-spacing:3px;margin:6px 0 0;font-weight:600;">Reçu de paiement</p>
            </div>

            <div style="background:#f0fdf6;padding:16px 40px;border-bottom:1px solid #e5e7eb;text-align:center;">
                <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Dossier N°</p>
                <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#008751;font-family:monospace;letter-spacing:3px;">${esc(p.refDossier)}</p>
            </div>

            <div style="padding:32px 40px;color:#1f2937;font-size:15px;line-height:1.8;">
                <p>Cher(e) ${esc(p.prenom)} ${esc(p.nom)},</p>
                <p>Nous accusons réception de votre paiement pour votre demande de reconnaissance de la nationalité béninoise. Le présent reçu en atteste officiellement.</p>

                <table style="width:100%;border-collapse:collapse;margin:22px 0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
                    <tr style="background:#f9fafb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;width:180px;">Montant réglé</td><td style="padding:12px 16px;color:#008751;font-size:18px;font-weight:800;">${esc(p.amount)} ${esc(p.currency)}</td></tr>
                    <tr><td style="padding:12px 16px;color:#6b7280;font-size:13px;">Objet</td><td style="padding:12px 16px;color:#1f2937;font-size:14px;">Frais de traitement — Reconnaissance de la nationalité béninoise</td></tr>
                    <tr style="background:#f9fafb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;">Moyen de paiement</td><td style="padding:12px 16px;color:#1f2937;font-size:14px;text-transform:capitalize;">${esc(p.paymentMethod)}</td></tr>
                    ${p.paymentRef ? `<tr><td style="padding:12px 16px;color:#6b7280;font-size:13px;">Réf. transaction</td><td style="padding:12px 16px;color:#1f2937;font-size:13px;font-family:monospace;">${esc(p.paymentRef)}</td></tr>` : ''}
                    <tr style="background:#f9fafb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;">Date</td><td style="padding:12px 16px;color:#1f2937;font-size:14px;">${esc(frDate())}</td></tr>
                </table>

                <p>Votre dossier est entre les mains de notre service juridique. Vous pouvez suivre son avancement à tout moment avec votre référence <strong>${esc(p.refDossier)}</strong>.</p>

                <div style="text-align:center;margin:28px 0 8px;">
                    <a href="${SITE}/suivi-dossier" style="display:inline-block;background:#008751;color:#fff;text-decoration:none;padding:13px 34px;border-radius:10px;font-weight:700;font-size:14px;">Suivre mon dossier</a>
                </div>

                <p style="margin-top:24px;">Avec toute notre considération,<br><strong>L'équipe Retour Gagnant Bénin</strong></p>
            </div>

            <div style="padding:16px 40px;background:#0d1117;text-align:center;">
                <p style="margin:0;color:#6b7280;font-size:11px;line-height:1.6;">
                    Ce reçu vaut preuve de paiement. Conservez-le précieusement.<br>
                    &copy; ${new Date().getFullYear()} Retour Gagnant Bénin — <a href="${SITE}" style="color:#008751;text-decoration:none;">${SITE.replace('https://', '')}</a>
                </p>
            </div>
        </div>`

        await sendEmail({
            to: p.email,
            subject: `Reçu de paiement — ${p.amount} ${p.currency} — Dossier ${p.refDossier}`,
            html,
            context: 'nationality_payment_receipt',
            relatedId: p.refDossier,
        })
    } catch (e) {
        console.error('[NAT-PAYMENT] reçu client échoué (non bloquant):', e instanceof Error ? e.message : e)
    }
}
