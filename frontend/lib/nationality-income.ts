// ══════════════════════════════════════════════════════════════
//  ENREGISTREMENT COMPTABLE D'UN PAIEMENT DE DOSSIER NATIONALITÉ
//  Les paiements en ligne (Kkiapay) du formulaire nationalité étaient
//  encaissés SANS trace dans facturation / comptabilité. Ce helper crée
//  UNE facture (statut payé) par dossier — idempotent via la référence
//  RG-NAT dans les notes. Le cas « facture manuelle sélectionnée » par
//  l'admin possède déjà sa propre facture : on ne double PAS.
// ══════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import { nextDocumentNumber } from './document-numbering'
import { generateInvoicePdf } from './invoice-pdf-generator'
import { sendEmail } from './email'
import { insertOnce } from './payment-integrity'
import { fromHt, TVA_RATE } from './tax'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function recordNationalityIncome(
    supabase: SupabaseClient,
    p: {
        ref: string                 // RG-NAT-YYYY-XXXX
        nom?: string | null
        prenom?: string | null
        email?: string | null
        phone?: string | null
        amount: number
        currency?: string | null
        paymentMethod?: string | null
        txId?: string | null
        isMyafro?: boolean
        label?: string              // libellé de la prestation (défaut : dossier nationalité)
    },
): Promise<void> {
    try {
        if (!p.ref || !p.amount || p.amount <= 0) return

        const currency = (p.currency || 'EUR').toUpperCase()
        let exchangeRate = 1
        if (currency !== 'XOF') {
            const { data: cur } = await supabase
                .from('currencies').select('exchange_rate_to_base').eq('code', currency).maybeSingle()
            if (cur) exchangeRate = Number(cur.exchange_rate_to_base) || 1
        }

        const label = p.label || (p.isMyafro
            ? 'Reprise de dossier de nationalité béninoise (MyAfroOrigins)'
            : 'Dossier de reconnaissance de nationalité béninoise')
        const numero = await nextDocumentNumber(supabase, 'facture')

        // TVA EN SUS : p.amount est le tarif HORS TAXE (frais de dossier). La
        // TVA 18 % s'ajoute — c'est ce que le client a payé (le widget charge
        // HT × 1,18). fromHt garantit HT + TVA = TTC.
        const { ht, tva, ttc } = fromHt(p.amount, currency)

        // Idempotence garantie par la BASE (index unique sur source_ref) :
        // deux chemins simultanes ne peuvent plus creer deux factures.
        const inserted = await insertOnce(supabase, 'documents_financiers', {
            type: 'facture',
            numero,
            client_nom: p.nom || 'Client',
            client_prenom: p.prenom || '',
            client_email: p.email || '',
            client_phone: p.phone || '',
            client_adresse: '',
            currency,
            exchange_rate_applied: exchangeRate,
            items: [{ description: label, quantity: 1, unit_price: ht, tva: TVA_RATE }],
            sous_total: ht,
            total_tva: tva,
            remise: 0,
            total: ttc,
            status: 'paye',
            paid_at: new Date().toISOString(),
            notes: `Facture auto-générée — Nationalité\nDossier: ${p.ref}\nMéthode: ${p.paymentMethod || 'en ligne'}${p.txId ? `\nTransaction: ${p.txId}` : ''}`,
            conditions: 'Document généré automatiquement après paiement vérifié.',
            validite: 'Acquittée',
        }, `nationality:${p.ref}`, { column: 'notes', pattern: `%${p.ref}%` })

        if (inserted.status === 'duplicate') return
        if (inserted.status === 'error') { console.error('[recordNationalityIncome]', inserted.message); return }

        // ── Envoi de la FACTURE officielle (PDF) au client ──────────────
        if (inserted.id && p.email) {
            await sendNationalityInvoiceEmail({
                numero, label, amount: p.amount, currency,
                nom: p.nom || '', prenom: p.prenom || '', email: p.email,
                phone: p.phone || '', ref: p.ref,
                paymentMethod: p.paymentMethod || 'en ligne', txId: p.txId || '',
            })
        }
    } catch (e) {
        console.error('[recordNationalityIncome]', e instanceof Error ? e.message : e)
    }
}

/** Facture officielle (PDF joint) envoyée au client après paiement. */
async function sendNationalityInvoiceEmail(f: {
    numero: string; label: string; amount: number; currency: string
    nom: string; prenom: string; email: string; phone: string; ref: string
    paymentMethod: string; txId: string
}): Promise<void> {
    try {
        // TVA EN SUS : f.amount est le tarif HORS TAXE ; la TVA s'ajoute.
        const { ht, tva, ttc } = fromHt(f.amount, f.currency)
        let pdfBase64 = ''
        try {
            pdfBase64 = generateInvoicePdf({
                invoiceRef: f.numero,
                date: new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }),
                paidAt: new Date().toISOString(),
                isPaid: true,
                clientName: `${f.prenom} ${f.nom}`.trim() || 'Client',
                clientEmail: f.email,
                clientPhone: f.phone || undefined,
                items: [{ description: f.label, quantity: 1, unit_price: ht, tva: TVA_RATE }],
                currency: f.currency,
                sous_total: ht,
                total_tva: tva,
                remise: 0,
                total: ttc,
                notes: `Dossier ${f.ref}\nPaiement ${f.paymentMethod}${f.txId ? ` — Transaction ${f.txId}` : ''}`,
                conditions: 'Paiement effectué en ligne.',
                isManual: true,
            })
        } catch (pdfErr) {
            console.error('[nationality-invoice] PDF échoué:', pdfErr)
        }

        const montant = `${Math.round(ttc).toLocaleString('fr-FR')} ${f.currency === 'XOF' ? 'FCFA' : f.currency === 'EUR' ? '€' : f.currency === 'USD' ? '$' : f.currency}`
        await sendEmail({
            to: f.email,
            subject: `Votre facture ${f.numero} — ${montant} — Dossier ${f.ref}`,
            html: `
            <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;">
              <div style="height:5px;background:linear-gradient(90deg,#008751 0 33%,#FCD116 33% 66%,#E8112D 66% 100%)"></div>
              <div style="background:linear-gradient(135deg,#006b40,#008751);padding:28px 40px;text-align:center;">
                <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;">Retour Gagnant Bénin</h1>
                <p style="color:#FCD116;font-size:11px;text-transform:uppercase;letter-spacing:3px;margin:6px 0 0;font-weight:600;">Facture acquittée</p>
              </div>
              <div style="background:#f0fdf6;padding:16px 40px;border-bottom:1px solid #e5e7eb;text-align:center;">
                <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Facture N°</p>
                <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#008751;font-family:monospace;letter-spacing:2px;">${esc(f.numero)}</p>
              </div>
              <div style="padding:30px 40px;color:#1f2937;font-size:15px;line-height:1.8;">
                <p>Cher(e) ${esc(`${f.prenom} ${f.nom}`.trim() || 'client(e)')},</p>
                <p>Nous accusons réception de votre paiement pour <strong>${esc(f.label)}</strong>. Votre facture acquittée est jointe à cet email.</p>
                <table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
                  <tr style="background:#f9fafb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;width:180px;">Montant réglé</td><td style="padding:12px 16px;color:#008751;font-size:18px;font-weight:800;">${esc(montant)}</td></tr>
                  <tr><td style="padding:12px 16px;color:#6b7280;font-size:13px;">Dossier</td><td style="padding:12px 16px;font-size:14px;font-family:monospace;">${esc(f.ref)}</td></tr>
                  <tr style="background:#f9fafb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;">Moyen de paiement</td><td style="padding:12px 16px;font-size:14px;text-transform:capitalize;">${esc(f.paymentMethod)}</td></tr>
                </table>
                <p style="color:#6b7280;font-size:13px;">Pour toute question : +229 01 60 32 21 21.</p>
                <p style="margin-top:22px;">Avec toute notre considération,<br><strong>L'équipe Retour Gagnant Bénin</strong></p>
              </div>
              <div style="padding:16px 40px;background:#0d1117;text-align:center;">
                <p style="margin:0;color:#6b7280;font-size:11px;">Cette facture vaut preuve de paiement. &copy; ${new Date().getFullYear()} Retour Gagnant Bénin — <a href="${SITE}" style="color:#008751;text-decoration:none;">${SITE.replace('https://', '')}</a></p>
              </div>
            </div>`,
            context: 'nationality_invoice',
            relatedId: f.ref,
            ...(pdfBase64 ? { attachments: [{ filename: `facture-${f.numero.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`, content: pdfBase64, contentType: 'application/pdf' }] } : {}),
        })
    } catch (e) {
        console.error('[nationality-invoice] envoi échoué:', e instanceof Error ? e.message : e)
    }
}
