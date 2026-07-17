import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { escapeHtml } from '@/lib/security'
import QRCode from 'qrcode'
import { fetchWithGroqRotation, GROQ_KEYS } from '@/lib/groq'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ─── Message Groq personnalisé ──────────────────────────────────────────────
async function generateGroqMessage(
  customerName: string,
  productTitle: string,
  invoiceRef: string,
  date: string,
): Promise<string> {
  if (GROQ_KEYS.length === 0) return ''
  try {
    const res = await fetchWithGroqRotation({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 220,
      temperature: 0.72,
      messages: [
        {
          role: 'system',
          content: `Tu es le directeur de la relation client de Retour Gagnant Bénin, expert en communication persuasive et fidélisation.

Rédige un message de facture (3 à 4 phrases) qui sera affiché directement dans la facture officielle du client.

OBJECTIFS PSYCHOLOGIQUES :
1. Ancrer la décision d'achat comme un choix intelligent et stratégique (biais de cohérence)
2. Créer un sentiment d'appartenance à une communauté de personnes qui réussissent (appartenance sociale)
3. Ouvrir la porte à une prochaine interaction sans quémander ni promettre ce qui n'est pas garanti
4. Laisser une empreinte émotionnelle positive et durable — le client doit se souvenir de ce message

RÈGLES ABSOLUES :
- Mentionner naturellement le numéro de facture et la date dans la première phrase
- Ton : confiant, chaleureux, jamais servile ni excessif
- Pas de superlatifs creux ("excellent", "remarquable", "exceptionnel")
- Pas de promesses non vérifiables
- Pas de champs vides, pas de tirets de remplissage (---, ___)
- Répondre UNIQUEMENT avec le texte du message, sans titre ni méta-commentaire`,
        },
        {
          role: 'user',
          content: `Client : ${customerName} | Service : ${productTitle} | Facture : ${invoiceRef} | Date : ${date}`,
        },
      ],
    })
    const data = await res.json()
    const raw = (data.choices?.[0]?.message?.content?.trim() || '') as string
    if (!raw || raw.includes('___') || raw.includes('[ ') || raw.length > 800 || raw.length < 80) return ''
    return raw
  } catch {
    return ''
  }
}

// ─── Handler GET ────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 503 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Commande
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    // ── Signature client (si elle existe et auto_sign != 'never') ──
    // Injectée dans la zone "Bon pour accord — Client" de la facture.
    let clientSignatureDataUrl: string | null = null
    if (order.client_id) {
      const { data: sigRow } = await supabase
        .from('client_signatures')
        .select('signature_data, auto_sign')
        .eq('client_id', order.client_id)
        .maybeSingle()
      if (sigRow?.signature_data && sigRow.auto_sign !== 'never') {
        clientSignatureDataUrl = sigRow.signature_data
      }
    }

    // Settings site + template ERP (en parallèle)
    const [settingsRes, templateRes] = await Promise.all([
      supabase.from('settings').select('key, value')
        .in('key', ['contact_email', 'contact_phone', 'hero_title', 'contact_address']),
      supabase.from('document_templates').select('content')
        .eq('id', 'official_devis_facture').single(),
    ])

    const settings: Record<string, string> = {}
    for (const s of settingsRes.data || []) settings[s.key] = s.value

    const tpl = templateRes.data?.content || {}
    const erpHeader: string = tpl.header || 'RETOUR GAGNANT BÉNIN\nRCCM : RB/COT/26 B 42001 | IFU : 3202644573981\nHaie-Vive Cocotiers, Cotonou, Bénin\n+229 01 60 32 21 21 / +229 01 94 35 50 50\ncontact@retourgagnantbenin.bj'
    const erpFooter: string = tpl.footer || 'RETOUR GAGNANT BÉNIN — RCCM : RB/COT/26 B 42001 — IFU : 3202644573981\nSiège : Haie-Vive Cocotiers, Cotonou. Email : contact@retourgagnantbenin.bj\nTVA 18% applicable — En cas de litige, seules les juridictions béninoises sont compétentes.'
    const presidentTitle: string = tpl.signature_title || 'LA DIRECTION GÉNÉRALE'
    const presidentName: string = tpl.signature_name || 'Nathalie RIFFERT GERMANY'

    // Parse infos entreprise depuis l'en-tête ERP
    const erpLines = erpHeader.split('\n').map((l: string) => l.trim()).filter(Boolean)
    const companyName = erpLines[0] || 'RETOUR GAGNANT BÉNIN'
    const companyMeta = erpLines[1] || 'RCCM : RB/COT/26 B 42001 | IFU : 3202644573981'
    const companyAddress = erpLines[2] || 'Haie-Vive Cocotiers, Cotonou, Bénin'
    const companyPhone = erpLines[3] || '+229 01 60 32 21 21 / +229 01 94 35 50 50'
    const companyEmail = erpLines[4] || (settings.contact_email || 'contact@retourgagnantbenin.bj')

    const sitePhone = settings.contact_phone || companyPhone

    const baseUrl = (() => {
      const origin = request.headers.get('origin')
      if (origin) return origin
      return process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'
    })()

    const fmtPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'

    const invoiceRef = `RG-${orderId.slice(0, 8).toUpperCase()}`
    const date = new Date(order.created_at).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
    const isPaid = order.payment_status === 'completed'
    const statusLabel = isPaid ? 'PAYÉE' : order.payment_status === 'pending' ? 'EN ATTENTE' : (order.payment_status || 'EN COURS').toUpperCase()

    // Items panier
    type CartItem = {
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

    // Features produit
    const productIds = [...new Set(cartItems.map(i => i.product_id).filter((id): id is string => !!id))]
    const productFeatures: Record<string, string[]> = {}
    if (productIds.length > 0) {
      const { data: productsData } = await supabase.from('products').select('id, features, description').in('id', productIds)
      for (const p of productsData || []) {
        if (Array.isArray(p.features) && p.features.length > 0) {
          productFeatures[p.id] = p.features.map((f: unknown) => String(f))
        } else if (typeof p.features === 'string' && p.features.trim()) {
          productFeatures[p.id] = p.features.split(/[,\n]/).map((f: string) => f.trim()).filter(Boolean)
        }
      }
    }

    const subTotal = cartItems.reduce((acc: number, item: CartItem) =>
      acc + resolveItemPrice(item) * (item.quantity || 1), 0)
    const shippingFee = order.shipping_fee || 0
    const couponDiscount = order.coupon_id ? Math.max(0, subTotal + shippingFee - order.amount) : 0
    const grandTotal = order.amount

    const paymentMethodLabel: Record<string, string> = {
      kkiapay: 'Mobile Money — Kkiapay',
      fedapay: 'Mobile Money — FedaPay',
      stripe: 'Carte bancaire — Stripe',
      paypal: 'PayPal Business',
      zeyow: 'Zeyow',
    }
    const payLabel = paymentMethodLabel[order.payment_method] || (order.payment_method || '').toUpperCase()

    // Appels parallèles
    const verificationUrl = `${baseUrl}/api/invoices/${orderId}`
    const logoUrl = `${baseUrl}/logo.jpg`
    const stampUrl = `${baseUrl}/images/cachet-PDG.png`

    const [qrCodeBase64, groqMessage] = await Promise.all([
      QRCode.toDataURL(verificationUrl, {
        color: { dark: '#008751', light: '#ffffff' },
        width: 120, margin: 1,
      }).catch(() => ''),
      generateGroqMessage(order.customer_name || 'Client', order.product_title || 'notre service', invoiceRef, date),
    ])

    // Lignes produits — HTML
    const productRowsHtml = cartItems.map((item: CartItem, idx: number) => {
      const price = resolveItemPrice(item)
      const qty = item.quantity || 1
      const lineTotal = price * qty
      const title = resolveItemTitle(item)
      const pid = item.product_id || ''
      const features = productFeatures[pid] || []
      const evenRow = idx % 2 === 0

      const featuresHtml = features.length > 0
        ? `<ul style="margin:5px 0 0 0;padding:0;list-style:none;">${features.slice(0, 6).map(f =>
            `<li style="font-size:10px;color:#556;line-height:1.6;">
              <span style="color:#008751;margin-right:4px;"></span>${escapeHtml(f)}
            </li>`).join('')}</ul>`
        : ''

      return `<tr style="background:${evenRow ? '#fcfdfe' : '#f7f9fc'};">
        <td style="padding:10px 12px;font-size:12px;color:#1a2035;border-bottom:1px solid #e2e8f0;vertical-align:top;">
          <strong style="font-size:13px;">${escapeHtml(title)}</strong>${featuresHtml}
        </td>
        <td style="padding:10px 12px;font-size:12px;color:#445;text-align:center;border-bottom:1px solid #e2e8f0;vertical-align:top;">${qty}</td>
        <td style="padding:10px 12px;font-size:12px;color:#445;text-align:right;border-bottom:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;">${fmtPrice(price)}</td>
        <td style="padding:10px 12px;font-size:12px;color:#445;text-align:center;border-bottom:1px solid #e2e8f0;vertical-align:top;">18%</td>
        <td style="padding:10px 12px;font-size:12px;font-weight:700;color:#1a2035;text-align:right;border-bottom:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;">${fmtPrice(lineTotal)}</td>
      </tr>`
    }).join('')

    const groqSection = groqMessage ? `
      <div style="margin:20px 0;padding:16px 20px;background:linear-gradient(135deg,#f0fdf6,#f8fff4);border-left:4px solid #008751;border-radius:0 10px 10px 0;">
        <p style="margin:0;font-size:13px;color:#2d5a3d;line-height:1.75;font-style:italic;">&ldquo;${escapeHtml(groqMessage)}&rdquo;</p>
        <p style="margin:8px 0 0;font-size:10px;color:#008751;font-weight:800;text-transform:uppercase;letter-spacing:1px;">— L'équipe ${escapeHtml(companyName)}</p>
      </div>` : ''

    // Watermark SVG inline
    const watermarkText = isPaid ? 'PAYÉ' : (order.payment_status === 'brouillon' ? 'BROUILLON' : '')
    const watermarkColor = isPaid ? 'rgba(0,135,81,0.10)' : 'rgba(120,120,120,0.09)'
    const watermarkSvg = watermarkText ? `
      <div style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden;">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <text x="50%" y="50%" font-family="Arial,sans-serif" font-size="120" font-weight="900"
            fill="${watermarkColor}" text-anchor="middle" dominant-baseline="middle"
            transform="rotate(-35,400,400)">${watermarkText}</text>
        </svg>
      </div>` : ''

    const footerLines = erpFooter.split('\n').filter(Boolean)

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Facture ${invoiceRef} — ${escapeHtml(companyName)}</title>
  <link rel="icon" type="image/png" href="${baseUrl}/icon.png">
  <link rel="shortcut icon" href="${baseUrl}/icon.png">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#e8edf2;color:#1a2035;position:relative}
    .page{max-width:820px;margin:28px auto;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.14);position:relative;z-index:1}

    /* ── Bande drapeau Bénin ── */
    .flag-stripe{display:flex;height:5px}
    .flag-vert{flex:1;background:#008751}
    .flag-jaune{flex:1;background:#FCD116}
    .flag-rouge{flex:1;background:#E8112D}

    /* ── Header blanc ── */
    .header{background:#fff;padding:18px 32px 14px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #dde3ee}
    .brand{display:flex;align-items:center;gap:14px}
    .logo{width:48px;height:48px;border-radius:8px;object-fit:cover;border:1px solid #e0e6ef}
    .brand-text{}
    .brand-name{font-size:20px;font-weight:900;line-height:1.1;letter-spacing:-.3px}
    .brand-name .vert{color:#008751}
    .brand-name .rouge{color:#E8112D}
    .brand-benin{font-size:8px;font-weight:800;color:#888;letter-spacing:3px;text-transform:uppercase;margin-top:2px}
    .brand-slogan{font-size:9px;color:#aaa;margin-top:3px;max-width:220px;line-height:1.4}
    .invoice-meta{text-align:right}
    .inv-type{font-size:26px;font-weight:900;color:#008751;letter-spacing:1px;line-height:1}
    .inv-num{font-size:11px;font-weight:700;color:#445;margin-top:4px;font-family:monospace}
    .inv-date{font-size:10px;color:#888;margin-top:3px}
    .status-badge{display:inline-block;margin-top:6px;padding:3px 12px;border-radius:20px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px}
    .badge-paid{background:#008751;color:#fff}
    .badge-pending{background:#f59e0b;color:#fff}
    .badge-other{background:#6b7280;color:#fff}

    /* ── Corps ── */
    .body{padding:28px 32px}

    /* ── Boîtes émetteur/destinataire ── */
    .parties{display:flex;gap:16px;margin-bottom:24px}
    .party-emetteur{flex:1;background:#f0f4ff;border:1px solid #c8d5f0;border-radius:8px;padding:16px}
    .party-destinataire{flex:1;background:#f8faff;border:1px solid #c8d5f0;border-radius:8px;padding:16px}
    .party-label{font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:3px;margin-bottom:10px;padding-bottom:6px}
    .party-emetteur .party-label{color:#4d7cc4;border-bottom:1px solid #c8d5f0}
    .party-destinataire .party-label{color:#6478b0;border-bottom:1px solid #c8d5f0}
    .party-emetteur .company-name{font-size:13px;font-weight:800;color:#1e2d50;margin-bottom:4px}
    .party-emetteur .company-detail{font-size:10px;color:#4a5580;line-height:1.8}
    .party-destinataire .client-name{font-size:13px;font-weight:800;color:#1e2d50;margin-bottom:4px}
    .party-destinataire .client-detail{font-size:10px;color:#4a5580;line-height:1.8}

    /* ── Tableau produits ── */
    .table-wrap{border-radius:6px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.07);margin-bottom:0}
    table{width:100%;border-collapse:collapse}
    thead tr{background:#0a1018}
    thead th{padding:10px 12px;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#c8d7e6;text-align:left}
    thead th.right{text-align:right}
    thead th.center{text-align:center}

    /* ── Totaux ── */
    .totals-section{display:flex;justify-content:flex-end;margin-top:20px}
    .totals-box{min-width:300px;border:1px solid #c8d5f0;border-radius:8px;overflow:hidden}
    .total-row{display:flex;justify-content:space-between;padding:8px 16px;font-size:11px;color:#445;border-bottom:1px solid #eef1f7}
    .total-row:last-child{border-bottom:none}
    .total-final{background:#008751;display:flex;justify-content:space-between;align-items:center;padding:12px 16px}
    .total-final .lbl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#fff}
    .total-final .amt{font-size:18px;font-weight:900;color:#FCD116}

    /* ── Moyen de paiement ── */
    .payment-bar{margin-top:16px;padding:10px 14px;background:#f4f6fa;border-radius:8px;border:1px solid #e0e6ef;display:flex;align-items:center;gap:10px;font-size:11px;color:#445}
    .payment-bar strong{color:#1a2035}

    /* ── Zone signature ── */
    .sig-zone{display:flex;gap:16px;margin-top:24px}
    .sig-box-left{flex:1;border:1px solid #008751;border-radius:8px;padding:14px;background:#f0fff6;min-height:90px}
    .sig-box-right{flex:1;border:1px solid #6478b0;border-radius:8px;padding:14px;background:#f3f5ff;min-height:90px;position:relative;overflow:hidden}
    .sig-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px}
    .sig-box-left .sig-title{color:#006b40}
    .sig-box-right .sig-title{color:#3b4da0}
    .sig-line{border-bottom:1px solid #c5d5c8;margin:10px 0 4px;height:28px}
    .sig-client-img{max-width:100%;max-height:80px;object-fit:contain;display:block;margin:6px auto;filter:contrast(1.1) brightness(0.9)}
    .sig-date{font-size:9px;color:#888}
    .sig-cachet{position:absolute;right:-10px;bottom:-10px;width:80px;height:80px;opacity:.9;object-fit:contain}
    .sig-name{font-size:12px;font-weight:800;color:#2d3778;margin-top:6px}
    .sig-sub{font-size:9px;color:#667;margin-top:2px}

    /* ── Pied QR ── */
    .footer-zone{margin-top:20px;padding-top:18px;border-top:2px dashed #e0e6ef;display:flex;justify-content:space-between;align-items:flex-end;gap:20px}
    .footer-info h4{font-size:11px;font-weight:800;color:#008751;margin-bottom:4px}
    .footer-info p{font-size:10px;color:#888;line-height:1.8}
    .qr-wrap{text-align:center;flex-shrink:0}
    .qr-wrap img{border-radius:8px;border:2px solid #e0e6ef;padding:4px}
    .qr-label{font-size:8px;color:#aaa;margin-top:4px;text-transform:uppercase;letter-spacing:1px}

    /* ── Footer dark ── */
    .dark-footer{background:#0a1018;padding:12px 32px;text-align:center}
    .dark-footer p{font-size:11px;color:#7a9bc4;line-height:1.8}
    .dark-footer .doc-ref{font-size:10px;color:#3a5070;margin-top:2px}

    /* ── Bouton impression ── */
    .print-btn{display:block;margin:22px auto;padding:11px 36px;background:#008751;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;letter-spacing:.5px}
    .print-btn:hover{background:#006b40}

    @page{size:A4;margin:8mm 10mm}
    @media print{
      body{background:#fff}
      .page{box-shadow:none;border-radius:0;margin:0;max-width:100%}
      .flag-stripe{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .header{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .party-emetteur,.party-destinataire{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      thead tr{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .total-final{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .print-btn{display:none}
    }
  </style>
</head>
<body>
  ${watermarkSvg}
  <div class="page">

    <!-- DRAPEAU BÉNIN -->
    <div class="flag-stripe">
      <div class="flag-vert"></div>
      <div class="flag-jaune"></div>
      <div class="flag-rouge"></div>
    </div>

    <!-- HEADER BLANC (style ERP) -->
    <div class="header">
      <div class="brand">
        <img src="${logoUrl}" alt="${escapeHtml(companyName)}" class="logo" onerror="this.style.display='none'" />
        <div class="brand-text">
          <div class="brand-name">
            <span class="vert">RETOUR </span><span class="rouge">GAGNANT</span>
          </div>
          <div class="brand-benin">Bénin</div>
          <div class="brand-slogan">L'agence d'accompagnement à la Nationalité Béninoise et au retour des Afro-descendants.</div>
        </div>
      </div>
      <div class="invoice-meta">
        <div class="inv-type">FACTURE</div>
        <div class="inv-num">N° ${invoiceRef}</div>
        <div class="inv-date">Date : ${date}</div>
        ${order.transaction_id ? `<div class="inv-date" style="font-family:monospace">Réf. : ${escapeHtml(String(order.transaction_id).slice(0, 18))}</div>` : ''}
        <div>
          <span class="status-badge ${isPaid ? 'badge-paid' : order.payment_status === 'pending' ? 'badge-pending' : 'badge-other'}">${statusLabel}</span>
        </div>
      </div>
    </div>

    <div class="body">

      <!-- ÉMETTEUR / DESTINATAIRE -->
      <div class="parties">
        <div class="party-emetteur">
          <div class="party-label">Émetteur</div>
          <div class="company-name">${escapeHtml(companyName)}</div>
          <div class="company-detail">
            ${escapeHtml(companyMeta)}<br>
            ${escapeHtml(companyAddress)}<br>
            📱 WhatsApp : (+229) 01 94 35 50 50 / 01 60 32 21 21<br>
            📞 Appel direct : (+229) 01 66 73 89 71<br>
            ${escapeHtml(companyEmail)}
          </div>
        </div>
        <div class="party-destinataire">
          <div class="party-label">Destinataire / Facturé à</div>
          <div class="client-name">${escapeHtml(order.customer_name || 'Client')}</div>
          <div class="client-detail">
            ${order.customer_phone ? escapeHtml(order.customer_phone) + '<br>' : ''}
            ${order.customer_email ? escapeHtml(order.customer_email) + '<br>' : ''}
            ${order.shipping_country ? escapeHtml(order.shipping_country) + '<br>' : ''}
            ${order.shipping_address ? escapeHtml(order.shipping_address) : ''}
          </div>
        </div>
      </div>

      <!-- MESSAGE GROQ -->
      ${groqSection}

      <!-- TABLEAU PRODUITS -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Description &amp; Contenu du pack</th>
              <th class="center" style="width:52px">Qté</th>
              <th class="right" style="width:130px">Prix unitaire</th>
              <th class="center" style="width:50px">TVA</th>
              <th class="right" style="width:130px">Total</th>
            </tr>
          </thead>
          <tbody>
            ${productRowsHtml}
            ${shippingFee > 0 ? `
            <tr style="background:#fafbfc">
              <td colspan="4" style="padding:9px 12px;font-size:11px;color:#667;border-bottom:1px solid #e2e8f0;">
                Frais de livraison — ${escapeHtml(order.shipping_country || order.shipping_zone || '')}
              </td>
              <td style="padding:9px 12px;font-size:12px;font-weight:700;color:#1a2035;text-align:right;border-bottom:1px solid #e2e8f0;white-space:nowrap;">
                + ${fmtPrice(shippingFee)}
              </td>
            </tr>` : ''}
            ${couponDiscount > 0 ? `
            <tr style="background:#fafbfc">
              <td colspan="4" style="padding:9px 12px;font-size:11px;color:#008751;border-bottom:1px solid #e2e8f0;">
                Réduction coupon appliquée
              </td>
              <td style="padding:9px 12px;font-size:12px;font-weight:700;color:#008751;text-align:right;border-bottom:1px solid #e2e8f0;white-space:nowrap;">
                − ${fmtPrice(couponDiscount)}
              </td>
            </tr>` : ''}
          </tbody>
        </table>
      </div>

      <!-- TOTAUX -->
      <div class="totals-section">
        <div class="totals-box">
          ${(shippingFee > 0 || couponDiscount > 0) ? `
          <div class="total-row">
            <span>Sous-total produits</span>
            <span style="font-weight:700">${fmtPrice(subTotal)}</span>
          </div>` : ''}
          ${shippingFee > 0 ? `
          <div class="total-row">
            <span>Frais de livraison</span>
            <span style="font-weight:700">+ ${fmtPrice(shippingFee)}</span>
          </div>` : ''}
          ${couponDiscount > 0 ? `
          <div class="total-row">
            <span>Réduction coupon</span>
            <span style="font-weight:700;color:#008751">− ${fmtPrice(couponDiscount)}</span>
          </div>` : ''}
          <div class="total-final">
            <span class="lbl">Total TTC</span>
            <span class="amt">${fmtPrice(grandTotal)}</span>
          </div>
        </div>
      </div>

      <!-- MOYEN DE PAIEMENT -->
      <div class="payment-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#008751" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        <span>Méthode de paiement : </span>
        <strong>${escapeHtml(payLabel)}</strong>
        ${order.transaction_id ? `<span style="color:#aaa"> &nbsp;|&nbsp; Réf. transaction : <strong>${escapeHtml(String(order.transaction_id))}</strong></span>` : ''}
      </div>

      <!-- ZONE SIGNATURE (style ERP) -->
      <div class="sig-zone">
        <div class="sig-box-left">
          <div class="sig-title">Bon pour accord — Client</div>
          ${clientSignatureDataUrl
            ? `<img src="${clientSignatureDataUrl}" alt="Signature client" class="sig-client-img" />
               <div class="sig-date" style="text-align:center">${escapeHtml(order.customer_name || '')}</div>
               <div class="sig-date" style="margin-top:4px;text-align:center">Apposée le ${date}</div>`
            : `<div class="sig-line"></div>
               <div class="sig-date">Signature et cachet du client</div>
               <div class="sig-date" style="margin-top:6px">Date : ____/____/________</div>`}
        </div>
        <div class="sig-box-right">
          <div class="sig-title">${escapeHtml(presidentTitle)}</div>
          <div class="sig-name">${escapeHtml(presidentName)}</div>
          <div class="sig-sub">Signature et Cachet officiel</div>
          <div class="sig-sub" style="margin-top:4px">Établi le ${date}</div>
          <img src="${stampUrl}" alt="Cachet" class="sig-cachet" onerror="this.style.display='none'" />
        </div>
      </div>

      <!-- PIED QR + CERTIF -->
      <div class="footer-zone">
        <div class="footer-info">
          <h4>Facture certifiée et sécurisée</h4>
          <p>
            ${escapeHtml(companyName)} · ${escapeHtml(companyAddress)}<br>
            ${escapeHtml(companyEmail)} · ${escapeHtml(sitePhone)}<br>
            Scannez le QR code pour vérifier l'authenticité de ce document.
          </p>
        </div>
        ${qrCodeBase64 ? `
        <div class="qr-wrap">
          <img src="${qrCodeBase64}" alt="QR Vérification" width="96" height="96" />
          <div class="qr-label">Vérifier</div>
        </div>` : ''}
      </div>

      <button class="print-btn" onclick="window.print()">&nbsp; Télécharger / Imprimer</button>
    </div>

    <!-- FOOTER DARK (style ERP) -->
    <div class="dark-footer">
      ${footerLines.map((l: string) => `<p>${escapeHtml(l)}</p>`).join('')}
      <div class="doc-ref">Document N° ${invoiceRef} — Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
    </div>

  </div>
</body>
</html>`

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="facture-${invoiceRef}.html"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erreur génération facture' }, { status: 500 })
  }
}
