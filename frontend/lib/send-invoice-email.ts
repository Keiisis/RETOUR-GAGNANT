import { createClient } from '@supabase/supabase-js'
import { sendEmail } from './email'
import { generateInvoicePdf, InvoicePdfItem } from './invoice-pdf-generator'

/* ════════════════════════════════════════════════════════════════════════════
   Send invoice email to a client.
   Idempotent : if `invoices.sent_to_email = true`, no-op.
   Re-uses the existing /api/invoices/[id] route to render the HTML (so the
   email body is identical to the web view, including signature + QR code).
   ════════════════════════════════════════════════════════════════════════════ */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface SendInvoiceEmailOptions {
    orderId: string
    /** Optional: override the recipient email (defaults to order.customer_email). */
    toEmail?: string
    /** Optional: skip if already sent (default true). */
    skipIfAlreadySent?: boolean
    /** Optional: pass a base URL to construct the invoice fetch URL. */
    baseUrl?: string
}

interface SendInvoiceEmailResult {
    success: boolean
    skipped?: boolean
    invoiceId?: string
    error?: string
}

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

export async function sendInvoiceEmail(opts: SendInvoiceEmailOptions): Promise<SendInvoiceEmailResult> {
    const { orderId, skipIfAlreadySent = true } = opts
    const baseUrl = opts.baseUrl || APP_URL
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        // 1. Trouver l'order
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .select('id, customer_name, customer_email, customer_phone, shipping_address, shipping_country, amount, currency, payment_status, transaction_id, payment_method, product_title, cart_items, created_at, quantity, shipping_fee, coupon_id')
            .eq('id', orderId)
            .maybeSingle()

        if (orderErr || !order) {
            return { success: false, error: orderErr?.message || 'Commande introuvable' }
        }

        const recipient = opts.toEmail || order.customer_email
        if (!recipient) {
            return { success: false, error: 'Aucune adresse email client' }
        }

        // 2. Trouver l'invoice associée (auto-créée par trigger SQL)
        const { data: invoice } = await supabase
            .from('invoices')
            .select('id, invoice_ref, sent_to_email')
            .eq('order_id', orderId)
            .maybeSingle()

        if (skipIfAlreadySent && invoice?.sent_to_email) {
            return { success: true, skipped: true, invoiceId: invoice.id }
        }

        // 3. Récupérer le HTML de la facture (route existante avec signature client auto-injectée)
        const invoiceUrl = `${baseUrl}/api/invoices/${orderId}`
        const htmlRes = await fetch(invoiceUrl, {
            headers: { 'Accept': 'text/html', 'X-Internal-Mailer': '1' },
        })
        if (!htmlRes.ok) {
            return { success: false, error: `Génération HTML facture échouée (HTTP ${htmlRes.status})` }
        }
        const html = await htmlRes.text()

        // 4. Construire le body email (le HTML de facture + un wrapper court d'introduction)
        const invoiceRef = invoice?.invoice_ref || `RG-${orderId.slice(0, 8).toUpperCase()}`
        const subject = `Votre facture ${invoiceRef} — Retour Gagnant Bénin`

        const wrapper = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
            body{margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f6fa;color:#1a2035}
            .intro{max-width:600px;margin:0 auto 20px;padding:24px;background:#ffffff;border-radius:8px}
            .intro h1{margin:0 0 8px;font-size:18px;color:#008751}
            .intro p{margin:6px 0;font-size:13px;line-height:1.5;color:#445}
            .invoice-wrap{background:#ffffff;border-radius:8px;overflow:hidden;max-width:900px;margin:0 auto;padding:0}
        </style></head><body>
            <div class="intro">
                <h1>Bonjour ${escapeHtml(order.customer_name || 'Client')},</h1>
                <p>Veuillez trouver ci-dessous votre facture <strong>${escapeHtml(invoiceRef)}</strong> pour votre récente commande.</p>
                <p>Pour toute question, répondez à cet email ou contactez-nous au +229 01 60 32 21 21.</p>
            </div>
            <div class="invoice-wrap">${stripHtmlDocWrappers(html)}</div>
        </body></html>`

        // 5. Générer le PDF en PJ
        let pdfBase64 = ''
        try {
            const isXof = order.currency === 'XOF' || order.currency === 'FCFA'
            const grandTotal = order.amount
            const shippingFee = order.shipping_fee || 0
            const couponDiscount = order.coupon_id ? Math.max(0, (order.amount + 1) * 0.1) : 0 // approximate or fallback

            // Parser les items du panier
            interface CartItem {
                product_id?: string
                title?: string
                product_title?: string
                name?: string
                price?: number
                unit_price?: number
                sale_price?: number
                quantity?: number
            }

            const cartItems: CartItem[] = (order.cart_items && Array.isArray(order.cart_items) && order.cart_items.length > 0)
                ? order.cart_items
                : [{ title: order.product_title, price: order.amount / (order.quantity || 1), quantity: order.quantity || 1 }]

            const resolveItemPrice = (item: CartItem): number => {
                if (item.unit_price !== undefined) return item.unit_price
                if (item.sale_price !== undefined && item.price !== undefined && item.sale_price < item.price) return item.sale_price
                return item.price || 0
            }
            const resolveItemTitle = (item: CartItem): string =>
                item.title || item.product_title || item.name || order.product_title || 'Produit'

            const pdfItems: InvoicePdfItem[] = cartItems.map(item => {
                const price = resolveItemPrice(item)
                const qty = item.quantity || 1
                const unitHT = isXof ? Math.round(price / 1.18) : Math.round((price / 1.18) * 100) / 100
                return {
                    description: resolveItemTitle(item),
                    quantity: qty,
                    unit_price: unitHT,
                    tva: 18
                }
            })

            const subTotal = pdfItems.reduce((acc, item) => acc + item.unit_price * item.quantity, 0)
            const finalSousTotal = isXof ? Math.round(subTotal) : Math.round(subTotal * 100) / 100
            const finalTotal = isXof ? Math.round(grandTotal) : Math.round(grandTotal * 100) / 100
            const finalTva = finalTotal - finalSousTotal

            pdfBase64 = generateInvoicePdf({
                invoiceRef,
                date: new Date(order.created_at || Date.now()).toLocaleDateString('fr-FR', {
                    year: 'numeric', month: 'long', day: 'numeric'
                }),
                isPaid: order.payment_status === 'completed',
                clientName: order.customer_name || 'Client',
                clientEmail: order.customer_email || undefined,
                clientPhone: order.customer_phone || undefined,
                clientAddress: order.shipping_address || undefined,
                items: pdfItems,
                currency: order.currency || 'XOF',
                sous_total: finalSousTotal,
                total_tva: finalTva,
                remise: isXof ? Math.round(couponDiscount) : Math.round(couponDiscount * 100) / 100,
                total: finalTotal,
                notes: `Facture boutique via ${order.payment_method || 'En ligne'}\nTransaction: ${order.transaction_id || ''}`,
                conditions: 'Paiement effectué en ligne.',
                isManual: false
            })
        } catch (pdfErr) {
            console.error('[sendInvoiceEmail] PDF Generation failed (will send email without attachment):', pdfErr)
        }

        // 6. Envoyer
        const result = await sendEmail({
            to: recipient,
            subject,
            html: wrapper,
            context: 'invoice',
            relatedId: orderId,
            ...(pdfBase64 ? {
                attachments: [{
                    filename: `facture-${invoiceRef.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`,
                    content: pdfBase64,
                    contentType: 'application/pdf'
                }]
            } : {})
        })

        if (!result.success) {
            return { success: false, error: result.error || 'Échec envoi email' }
        }

        // 6. Marquer comme envoyée
        if (invoice?.id) {
            await supabase
                .from('invoices')
                .update({ sent_to_email: true })
                .eq('id', invoice.id)
        }

        return { success: true, invoiceId: invoice?.id }
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Erreur inconnue'
        console.error('[sendInvoiceEmail] Exception:', message)
        return { success: false, error: message }
    }
}

/** Strip <html><head><body> wrappers so the invoice HTML can be embedded
 *  inside another email template without nested <html> tags breaking layout. */
function stripHtmlDocWrappers(html: string): string {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    return bodyMatch ? bodyMatch[1] : html
}

function escapeHtml(s: string): string {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}
