// ══════════════════════════════════════════════════════════════
// Paiement des documents financiers (DEVIS / FACTURES) — confirmation
// côté serveur unique, partagée par :
//   - POST /api/documents/confirm-payment  (portail public /portail/[id])
//   - POST /api/client/payment/confirm     (panel client /client/payer/[id])
//   - /api/webhooks/kkiapay                (filet de sécurité serveur)
// Garanties : vérification de la transaction chez le provider, contrôle du
// montant, garde atomique anti-double-traitement, alerte email équipe +
// reçu de paiement client envoyés UNE seule fois (par le chemin qui gagne
// la transition impayé → payé).
// ══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'
import { sendEmail, getEmailConfig } from '@/lib/email'
import { convertCurrency, type CurrencyCode } from '@/lib/currency'
import { generateInvoicePdf, InvoicePdfItem } from './invoice-pdf-generator'
import { nextDocumentNumber } from './document-numbering'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
)

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

const STAFF_RECIPIENTS = [
    'kevinrtgagnant@gmail.com',
    'pdg.retourgagnantbenin@gmail.com',
    'ornelmitchai6@gmail.com',
    'jeanbaptiste01rgb@gmail.com',
    'tiamiounadjathrgb@gmail.com',
]

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const frDate = () => new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Porto-Novo' })

interface DocRow {
    id: string
    type: string            // 'devis' | 'facture'
    numero?: string | null
    total: number
    currency: string
    status: string
    client_nom?: string | null
    client_prenom?: string | null
    client_email?: string | null
    client_phone?: string | null
    client_adresse?: string | null
    items?: any[] | null
    sous_total?: number | null
    total_tva?: number | null
    remise?: number | null
    notes?: string | null
    paid_at?: string | null
}

/* ── Vérifications provider (montants en XOF côté passerelles africaines) ── */
async function loadSettings(keys: string[]): Promise<Record<string, string>> {
    const { data } = await supabase.from('settings').select('key, value').in('key', keys)
    const m: Record<string, string> = {}
    for (const s of data || []) m[s.key] = s.value
    return m
}

async function verifyKkiapay(txId: string): Promise<{ ok: boolean; amount?: number; reason?: string }> {
    const sm = await loadSettings(['kkiapay_public_key', 'kkiapay_private_key', 'kkiapay_secret_key', 'kkiapay_sandbox', 'kkiapay_sandbox_public_key', 'kkiapay_sandbox_private_key'])
    const sandbox = sm.kkiapay_sandbox === 'true'
    const base = sandbox ? 'https://api-sandbox.kkiapay.me' : 'https://api.kkiapay.me'
    try {
        const res = await fetch(`${base}/api/v1/transactions/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': sandbox ? (sm.kkiapay_sandbox_public_key || sm.kkiapay_public_key || '') : (sm.kkiapay_public_key || ''),
                'x-private-key': sandbox ? (sm.kkiapay_sandbox_private_key || sm.kkiapay_private_key || '') : (sm.kkiapay_private_key || ''),
                'x-secret-key': sm.kkiapay_secret_key || '',
            },
            body: JSON.stringify({ transactionId: txId }),
        })
        const data = await res.json()
        return data?.status === 'SUCCESS'
            ? { ok: true, amount: data?.amount }
            : { ok: false, reason: data?.status || 'not_success' }
    } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : 'verify_failed' }
    }
}

async function verifyFedapay(txId: string): Promise<{ ok: boolean; amount?: number; reason?: string }> {
    const sm = await loadSettings(['fedapay_secret_key', 'fedapay_sandbox'])
    const base = sm.fedapay_sandbox === 'true' ? 'https://sandbox-api.fedapay.com' : 'https://api.fedapay.com'
    try {
        const res = await fetch(`${base}/v1/transactions/${encodeURIComponent(txId)}`, {
            headers: { Authorization: `Bearer ${sm.fedapay_secret_key || ''}` },
        })
        const data = await res.json()
        const tx = data?.['v1/transaction'] || data?.transaction || data
        return tx?.status === 'approved'
            ? { ok: true, amount: Number(tx?.amount) }
            : { ok: false, reason: tx?.status || 'not_approved' }
    } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : 'verify_failed' }
    }
}

/** Le provider a-t-il encaissé (au moins) le montant du document ? (XOF, tolérance 2%) */
function amountOk(providerAmountXOF: number | undefined, docTotal: number, docCurrency: string): boolean {
    if (providerAmountXOF === undefined || providerAmountXOF === null) return false
    const expectedXOF = docCurrency === 'XOF'
        ? docTotal
        : convertCurrency(docTotal, docCurrency as CurrencyCode, 'XOF')
    return providerAmountXOF >= Math.floor(expectedXOF * 0.98)
}

/* ── Emails ────────────────────────────────────────────────────── */
async function sendDocPaymentEmails(doc: DocRow, provider: string, txId: string): Promise<void> {
    const typeLabel = doc.type === 'devis' ? 'Devis' : 'Facture'
    const clientName = `${doc.client_prenom || ''} ${doc.client_nom || ''}`.trim() || doc.client_email || 'Client'
    const numero = doc.numero || doc.id.slice(0, 8).toUpperCase()

    // 1. Alerte équipe
    try {
        const config = await getEmailConfig()
        const recipients = [...new Set([...STAFF_RECIPIENTS, ...(config.adminEmail ? [config.adminEmail] : [])])]
        await sendEmail({
            to: recipients.join(', '),
            subject: `Paiement reçu — ${typeLabel} ${numero} — ${clientName} (${doc.total} ${doc.currency})`,
            html: `
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #eef2f1;border-radius:14px;overflow:hidden">
              <div style="height:5px;background:linear-gradient(90deg,#008751 0 33%,#FCD116 33% 66%,#E8112D 66% 100%)"></div>
              <div style="padding:26px 28px">
                <p style="margin:0 0 4px;color:#047857;font-size:13px;font-weight:800">Retour Gagnant Bénin — Alerte Paiement</p>
                <h1 style="margin:0 0 6px;color:#1B2A4A;font-size:20px;font-weight:800">Paiement reçu — ${typeLabel} ${esc(numero)}</h1>
                <p style="margin:0 0 18px;color:#8B94A6;font-size:13px">${esc(frDate())}</p>
                <div style="background:#F4FAF6;border:1px solid rgba(0,135,81,0.2);border-radius:10px;padding:16px 18px;text-align:center;margin:0 0 18px">
                  <p style="margin:0;font-size:11px;font-weight:800;color:#047857;text-transform:uppercase;letter-spacing:.15em">Montant encaissé</p>
                  <p style="margin:6px 0 0;font-size:30px;font-weight:900;color:#008751">${esc(doc.total)} ${esc(doc.currency)}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#8B94A6">via ${esc(provider)} — Réf. <span style="font-family:monospace">${esc(txId)}</span></p>
                </div>
                <table style="width:100%;border-collapse:collapse;background:#F8FAF9;border-radius:10px;overflow:hidden;margin:0 0 20px">
                  <tr><td style="padding:9px 14px;color:#8B94A6;font-size:12px;width:150px">Client</td><td style="padding:9px 14px;color:#1B2A4A;font-size:13px;font-weight:700">${esc(clientName)}</td></tr>
                  ${doc.client_email ? `<tr><td style="padding:9px 14px;color:#8B94A6;font-size:12px">Email</td><td style="padding:9px 14px;color:#1B2A4A;font-size:13px">${esc(doc.client_email)}</td></tr>` : ''}
                  <tr><td style="padding:9px 14px;color:#8B94A6;font-size:12px">Document</td><td style="padding:9px 14px;color:#1B2A4A;font-size:13px;font-weight:700">${typeLabel} ${esc(numero)}</td></tr>
                </table>
                <a href="${SITE}/admin/facturation" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:800;font-size:13px">Ouvrir la facturation</a>
                <p style="margin:18px 0 0;color:#9aa5b1;font-size:11px;text-align:center">Notification automatique — Retour Gagnant Bénin</p>
              </div>
            </div>`,
            context: 'doc_payment_alert',
            relatedId: doc.id,
        })
    } catch (e) {
        console.error('[DOC-PAYMENT] alerte staff échouée (non bloquant):', e instanceof Error ? e.message : e)
    }

    // 2. Reçu client
    if (doc.client_email) {
        try {
            // Générer le PDF en PJ
            let pdfBase64 = ''
            try {
                const isXof = doc.currency === 'XOF' || doc.currency === 'FCFA'
                const pdfItems: InvoicePdfItem[] = (doc.items || []).map((it: any) => ({
                    description: it.description || '',
                    quantity: Number(it.quantity) || 1,
                    unit_price: Number(it.unit_price) || 0,
                    tva: Number(it.tva) || 18
                }))

                const finalSousTotal = isXof ? Math.round(Number(doc.sous_total) || 0) : Math.round((Number(doc.sous_total) || 0) * 100) / 100
                const finalTotal = isXof ? Math.round(Number(doc.total) || 0) : Math.round((Number(doc.total) || 0) * 100) / 100
                const finalTva = finalTotal - finalSousTotal

                pdfBase64 = generateInvoicePdf({
                    invoiceRef: numero,
                    date: new Date().toLocaleDateString('fr-FR', {
                        year: 'numeric', month: 'long', day: 'numeric'
                    }),
                    paidAt: doc.paid_at || new Date().toISOString(),
                    isPaid: true,
                    clientName: `${doc.client_prenom || ''} ${doc.client_nom || ''}`.trim() || 'Client',
                    clientEmail: doc.client_email || undefined,
                    clientPhone: doc.client_phone || undefined,
                    clientAddress: doc.client_adresse || undefined,
                    items: pdfItems,
                    currency: doc.currency || 'XOF',
                    sous_total: finalSousTotal,
                    total_tva: finalTva,
                    remise: isXof ? Math.round(Number(doc.remise) || 0) : Math.round((Number(doc.remise) || 0) * 100) / 100,
                    total: finalTotal,
                    notes: doc.notes || `Paiement en ligne via ${provider}\nTransaction: ${txId}`,
                    conditions: 'Paiement effectué en ligne.',
                    isManual: true
                })
            } catch (pdfErr) {
                console.error('[sendDocPaymentEmails] PDF Generation failed:', pdfErr)
            }

            await sendEmail({
                to: doc.client_email,
                subject: `Reçu de paiement — ${typeLabel} ${numero} — ${doc.total} ${doc.currency}`,
                html: `
                <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;">
                    <div style="background:linear-gradient(135deg,#006b40,#008751);padding:28px 40px;text-align:center;">
                        <img src="${SITE}/logo.jpg" alt="Retour Gagnant Bénin" width="60" height="60" style="border-radius:14px;object-fit:cover;border:3px solid rgba(255,255,255,0.4);margin-bottom:12px;" />
                        <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;letter-spacing:0.5px;">Retour Gagnant Bénin</h1>
                        <p style="color:#FCD116;font-size:11px;text-transform:uppercase;letter-spacing:3px;margin:6px 0 0;font-weight:600;">Reçu de paiement</p>
                    </div>
                    <div style="background:#f0fdf6;padding:16px 40px;border-bottom:1px solid #e5e7eb;text-align:center;">
                        <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">${typeLabel} N°</p>
                        <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#008751;font-family:monospace;letter-spacing:2px;">${esc(numero)}</p>
                    </div>
                    <div style="padding:32px 40px;color:#1f2937;font-size:15px;line-height:1.8;">
                        <p>Cher(e) ${esc(clientName)},</p>
                        <p>Nous accusons réception de votre paiement. Votre facture acquittée est disponible en pièce jointe à cet email.</p>
                        <table style="width:100%;border-collapse:collapse;margin:22px 0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
                            <tr style="background:#f9fafb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;width:180px;">Montant réglé</td><td style="padding:12px 16px;color:#008751;font-size:18px;font-weight:800;">${esc(doc.total)} ${esc(doc.currency)}</td></tr>
                            <tr><td style="padding:12px 16px;color:#6b7280;font-size:13px;">Document</td><td style="padding:12px 16px;color:#1f2937;font-size:14px;">${typeLabel} ${esc(numero)}</td></tr>
                            <tr style="background:#f9fafb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;">Moyen de paiement</td><td style="padding:12px 16px;color:#1f2937;font-size:14px;text-transform:capitalize;">${esc(provider)}</td></tr>
                            <tr><td style="padding:12px 16px;color:#6b7280;font-size:13px;">Réf. transaction</td><td style="padding:12px 16px;color:#1f2937;font-size:13px;font-family:monospace;">${esc(txId)}</td></tr>
                            <tr style="background:#f9fafb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;">Date</td><td style="padding:12px 16px;color:#1f2937;font-size:14px;">${esc(frDate())}</td></tr>
                        </table>
                        <p>Pour toute question, répondez simplement à cet email ou contactez-nous au +229 01 60 32 21 21.</p>
                        <p style="margin-top:24px;">Avec toute notre considération,<br><strong>L'équipe Retour Gagnant Bénin</strong></p>
                    </div>
                    <div style="padding:16px 40px;background:#0d1117;text-align:center;">
                        <p style="margin:0;color:#6b7280;font-size:11px;line-height:1.6;">
                            Ce reçu vaut preuve de paiement. Conservez-le précieusement.<br>
                            &copy; ${new Date().getFullYear()} Retour Gagnant Bénin — <a href="${SITE}" style="color:#008751;text-decoration:none;">${SITE.replace('https://', '')}</a>
                        </p>
                    </div>
                </div>`,
                context: 'doc_payment_receipt',
                relatedId: doc.id,
                ...(pdfBase64 ? {
                    attachments: [{
                        filename: `facture-${numero.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`,
                        content: pdfBase64,
                        contentType: 'application/pdf'
                    }]
                } : {})
            })
        } catch (e) {
            console.error('[DOC-PAYMENT] reçu client échoué (non bloquant):', e instanceof Error ? e.message : e)
        }
    }
}

/* ── Confirmation centrale ─────────────────────────────────────── */
export async function confirmDocumentPayment(opts: {
    docId: string
    provider: 'kkiapay' | 'fedapay'
    transactionId: string
}): Promise<{ success: boolean; alreadyPaid?: boolean; error?: string; status?: number }> {
    const { docId, provider, transactionId } = opts
    if (!docId || !transactionId) return { success: false, error: 'Paramètres manquants', status: 400 }

    const { data: doc, error: docErr } = await supabase
        .from('documents_financiers')
        .select('id, type, numero, total, currency, status, client_nom, client_prenom, client_email, client_phone, client_adresse, items, sous_total, total_tva, remise, notes, paid_at')
        .eq('id', docId)
        .maybeSingle()
    if (docErr || !doc) return { success: false, error: 'Document introuvable', status: 404 }
    if (doc.status === 'paye') return { success: true, alreadyPaid: true }

    // Vérification provider + montant (anti-fraude)
    const verify = provider === 'kkiapay' ? await verifyKkiapay(transactionId) : await verifyFedapay(transactionId)
    if (!verify.ok) return { success: false, error: `Paiement non confirmé (${verify.reason})`, status: 402 }
    if (!amountOk(verify.amount, Number(doc.total), doc.currency)) {
        return { success: false, error: 'Montant divergent', status: 402 }
    }

    // Garde atomique : seul le chemin qui gagne la transition envoie les emails.
    // NB colonnes réelles : payment_provider + payment_transaction_id (le portail
    // écrivait `payment_id`, colonne inexistante → update rejeté silencieusement).
    // TRAÇABILITÉ COMPTABLE : un DEVIS payé est automatiquement converti en
    // FACTURE (type='facture' + n° de facture) pour entrer dans la comptabilité,
    // qui ne comptabilise l'encaissé que sur les factures.
    const convertToInvoice = doc.type === 'devis'
    // Une facture porte TOUJOURS un numéro de la série FAC (jamais le n° DEV
    // d'origine) — exigence de numérotation par série. Le devis d'origine
    // est conservé en note pour la traçabilité.
    let invoiceNumero = doc.numero
    const updatePayload: Record<string, unknown> = {
        status: 'paye',
        payment_provider: provider,
        payment_method: provider,
        payment_transaction_id: transactionId,
        paid_at: new Date().toISOString(),
    }
    if (convertToInvoice) {
        invoiceNumero = await nextDocumentNumber(supabase, 'facture')
        updatePayload.type = 'facture'
        updatePayload.numero = invoiceNumero
        updatePayload.notes = `${doc.notes ? doc.notes + '\n' : ''}Facture issue du devis ${doc.numero || '(sans n°)'} accepté et payé.`
    }
    const { data: updated, error: updErr } = await supabase
        .from('documents_financiers')
        .update(updatePayload)
        .eq('id', docId)
        .neq('status', 'paye')
        .select('id')
    if (updErr) return { success: false, error: updErr.message, status: 500 }
    if (!updated || updated.length === 0) return { success: true, alreadyPaid: true }

    // Notification in-app + emails (fire-and-forget)
    const typeLabel = doc.type === 'devis' ? 'Devis' : 'Facture'
    void supabase.from('messages').insert([{
        nom: `${doc.client_prenom || ''} ${doc.client_nom || ''}`.trim() || doc.client_email || 'Client',
        email: doc.client_email || 'contact@retourgagnantbenin.bj',
        sujet: `Paiement reçu — ${typeLabel} ${doc.numero || doc.id.slice(0, 8)}`,
        message: `${typeLabel} ${doc.numero || doc.id} payé(e) : ${doc.total} ${doc.currency} via ${provider} (TX ${transactionId}).`,
        type: 'paiement',
        lu: false,
    }]).then(() => {})
    void sendDocPaymentEmails(doc as DocRow, provider, transactionId)

    return { success: true }
}

/** Envoi des emails pour un document DÉJÀ marqué payé par un autre chemin
 *  (utilisé par /api/client/payment/confirm qui a sa propre garde atomique). */
export async function sendDocumentPaymentEmails(docId: string, provider: string, transactionId: string): Promise<void> {
    const { data: doc } = await supabase
        .from('documents_financiers')
        .select('id, type, numero, total, currency, status, client_nom, client_prenom, client_email, client_phone, client_adresse, items, sous_total, total_tva, remise, notes, paid_at')
        .eq('id', docId)
        .maybeSingle()
    if (doc) await sendDocPaymentEmails(doc as DocRow, provider, transactionId)
}
