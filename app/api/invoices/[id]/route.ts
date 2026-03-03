import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { escapeHtml } from '@/lib/security'
import QRCode from 'qrcode'

// Generate a downloadable HTML invoice for an order
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    // 🛡️ SECURITY: Basic obfuscation/verification (auth ideally)
    if (error || !order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    // Fetch site settings for branding
    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['contact_email', 'contact_phone', 'hero_title'])

    const settings: Record<string, string> = {}
    for (const s of settingsData || []) settings[s.key] = s.value

    const siteName = settings.hero_title || 'Retour Gagnant Benin'
    const siteEmail = settings.contact_email || 'contact@retourgagnant.bj'
    const sitePhone = settings.contact_phone || '+229 XX XX XX XX'

    const formatPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
    const invoiceRef = `RG-${orderId.slice(0, 8).toUpperCase()}`
    const date = new Date(order.created_at).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

    const unitPrice = order.amount / (order.quantity || 1)

    // Generate Verification QR Code
    const baseUrl = request.headers.get('origin') || request.url.split('/api')[0];
    const verificationUrl = `${baseUrl}/api/invoices/${orderId}`;
    let qrCodeBase64 = '';
    try {
      qrCodeBase64 = await QRCode.toDataURL(verificationUrl, {
        color: { dark: '#008751', light: '#ffffff' },
        width: 120,
        margin: 1
      });
    } catch { console.error("QR Error"); }

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture ${invoiceRef}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1a1a1a; background: #fff; }
    .invoice { max-width: 800px; margin: 0 auto; padding: 60px 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 60px; padding-bottom: 30px; border-bottom: 3px solid #008751; }
    .brand h1 { font-size: 28px; font-weight: 900; color: #008751; }
    .brand p { font-size: 11px; color: #888; margin-top: 4px; }
    .invoice-meta { text-align: right; }
    .invoice-meta h2 { font-size: 32px; font-weight: 900; color: #1a1a1a; margin-bottom: 8px; }
    .invoice-meta p { font-size: 12px; color: #666; line-height: 1.8; }
    .invoice-meta strong { color: #1a1a1a; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 50px; }
    .party { width: 45%; }
    .party-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; color: #008751; margin-bottom: 12px; }
    .party p { font-size: 13px; color: #444; line-height: 1.8; }
    .party strong { color: #1a1a1a; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #008751; color: white; padding: 14px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; text-align: left; }
    th:last-child, td:last-child { text-align: right; }
    td { padding: 16px; font-size: 14px; border-bottom: 1px solid #eee; }
    .total-row { background: #f8f9fa; }
    .total-row td { font-weight: 900; font-size: 18px; color: #008751; border-bottom: 3px solid #008751; padding: 20px 16px; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; }
    .footer p { font-size: 11px; color: #aaa; line-height: 1.8; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .badge-paid { background: #e6f7ee; color: #008751; }
    .badge-pending { background: #fff8e6; color: #cc8800; }
    @media print { body { -webkit-print-color-adjust: exact; } .invoice { padding: 20px; } }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="brand">
        <h1>${escapeHtml(siteName)}</h1>
        <p>Cotonou, Benin</p>
      </div>
      <div class="invoice-meta">
        <h2>FACTURE</h2>
        <p>
          <strong>Ref:</strong> ${invoiceRef}<br>
          <strong>Date:</strong> ${date}<br>
          <strong>Statut:</strong> <span class="badge ${order.payment_status === 'completed' ? 'badge-paid' : 'badge-pending'}">${order.payment_status === 'completed' ? 'Paye' : 'En attente'}</span>
        </p>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="party-label">Emetteur</div>
        <p>
          <strong>${escapeHtml(siteName)}</strong><br>
          ${escapeHtml(siteEmail)}<br>
          ${escapeHtml(sitePhone)}<br>
          Cotonou, Benin
        </p>
      </div>
      <div class="party">
        <div class="party-label">Client</div>
        <p>
          <strong>${escapeHtml(order.customer_name) || 'Client'}</strong><br>
          ${escapeHtml(order.customer_phone || '')}<br>
          ${escapeHtml(order.customer_email || '')}
        </p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Quantitée</th>
          <th>Prix unitaire</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(order.product_title) || 'Produit'}</td>
          <td>${order.quantity || 1}</td>
          <td>${formatPrice(unitPrice)} ${order.currency || 'XOF'}</td>
          <td>${formatPrice(order.amount)} ${order.currency || 'XOF'}</td>
        </tr>
        <tr class="total-row">
          <td colspan="3">TOTAL TTC</td>
          <td>${formatPrice(order.amount)} ${order.currency || 'XOF'}</td>
        </tr>
      </tbody>
    </table>

    <p style="font-size: 12px; color: #888; margin-bottom: 10px;">
      <strong>Methode de paiement:</strong> ${(order.payment_method || '').toUpperCase()}
      ${order.transaction_id ? ` | <strong>Transaction:</strong> ${order.transaction_id}` : ''}
    </p>

    <div class="footer" style="display: flex; justify-content: space-between; align-items: flex-end; text-align: left;">
      <div>
        <h4 style="color: #008751; font-size: 14px; margin-bottom: 5px;">Facture Certifiée et Sécurisée</h4>
        <p>
          ${siteName} — Haie Vive, Cotonou, Benin<br>
          ${siteEmail} | ${sitePhone}<br>
          Merci pour votre confiance.
        </p>
      </div>
      ${qrCodeBase64 ? `<div style="text-align: right;">
        <img src="${qrCodeBase64}" alt="Verification QR Code" style="width: 100px; height: 100px; border-radius: 8px; border: 2px solid #eee; padding: 4px;" />
        <p style="font-size: 9px; margin-top: 5px; color: #888; text-transform: uppercase;">Scannez pour valider</p>
      </div>` : ''}
    </div>
  </div>
</body>
</html>`

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="facture-${invoiceRef}.html"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erreçur generation facture' }, { status: 500 })
  }
}
