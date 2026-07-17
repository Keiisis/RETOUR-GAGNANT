import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TICKET_SECRET = process.env.TICKET_HMAC_SECRET || 'rgb-ticket-secret-2026'

// Notification API — sends email notifications for order events using SMTP
export async function POST(request: Request) {
  try {
    const { order_id, type } = await request.json()

    if (!order_id) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Notification: SUPABASE_SERVICE_ROLE_KEY manquante')
      return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 503 })
    }

    // Utiliser service role pour lire la commande (bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch order details
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderErr || !order) {
      console.error('Notification: commande introuvable:', orderErr?.message, '| order_id:', order_id)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // ════ [INTEGRATION ÉVÉNEMENTS RGB] ════
    let eventTicket = null
    if (type === 'payment_success') {
      const { data: registration } = await supabase
        .from('event_registrations')
        .select('*, events(slug, title)')
        .eq('order_id', order_id)
        .single()

      if (registration) {
        // Maj du statut
        await supabase.from('event_registrations').update({ payment_status: 'completed' }).eq('id', registration.id)

        // Verifier si le ticket existe deja
        const { data: existingTicket } = await supabase.from('event_tickets').select('*').eq('registration_id', registration.id).single()

        if (!existingTicket) {
          // Generer le code 
          const eventData = registration.events as Record<string, unknown>
          const prefix = (String(eventData?.slug || 'EVNT')).slice(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X')
          const random = crypto.randomBytes(4).toString('hex').toUpperCase()
          const ticketCode = `RGB-${prefix}-${random}`

          // Generer le payload + signature HMAC
          const payload = { ticket_code: ticketCode, event_id: registration.event_id, registration_id: registration.id }
          const hmac = crypto.createHmac('sha256', TICKET_SECRET).update(JSON.stringify(payload)).digest('hex')
          const qrData = JSON.stringify({ ...payload, hash: hmac })

          const { data: newTicket } = await supabase.from('event_tickets').insert({
            registration_id: registration.id,
            event_id: registration.event_id,
            ticket_code: ticketCode,
            qr_data: qrData,
            ticket_type: registration.ticket_type
          }).select().single()

          eventTicket = { ...newTicket, event_title: eventData?.title }
        } else {
          const eventData = registration.events as Record<string, unknown>
          eventTicket = { ...existingTicket, event_title: eventData?.title }
        }
      }
    }
    // ══════════════════════════════════════
    
    // Auto-create Nexus Tracker entry for order tracking on payment success
    if (type === 'payment_success') {
        const orderRef = `RG-CMD-${(order.id as string).substring(0, 8).toUpperCase()}`
        const orderSteps = [
            { id: 1, label: 'Commande reçue', status: 'completed', date: new Date().toISOString().split('T')[0], note: 'Commande en ligne' },
            { id: 2, label: 'Confirmation de paiement', status: 'completed', date: new Date().toISOString().split('T')[0], note: '' },
            { id: 3, label: 'Préparation de la commande', status: 'pending', date: null, note: '' },
            { id: 4, label: 'Expédition / Livraison', status: 'pending', date: null, note: '' },
            { id: 5, label: 'Livré / Terminé', status: 'pending', date: null, note: '' },
        ]

        // Ne pas créer en double si ça existe déjà (idempotence)
        const { data: existingDossier } = await supabase.from('dossier_tracking').select('id').eq('num_dossier', orderRef).maybeSingle()
        if (!existingDossier) {
            await supabase.from('dossier_tracking').insert({
                num_dossier: orderRef,
                client_nom: order.customer_name,
                client_prenom: '',
                client_email: (order.customer_email || '').toLowerCase(),
                client_whatsapp: order.customer_phone || '',
                client_phone: order.customer_phone || '',
                service_type: 'Commande Boutique',
                service: 'boutique',
                statut: 'reception',
                etapes: orderSteps,
                progression: Math.round((2 / orderSteps.length) * 100),
                notes_internes: `Commande automatique.\nProduit: ${order.product_title || 'Panier'}\nMontant: ${order.amount} ${order.currency || 'XOF'}\nMéthode: ${order.payment_method}`,
            })
        }
    }

    // Fetch admin & SMTP settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', [
        'contact_email', 'contact_phone', 'hero_title',
        'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass',
        'smtp_from_email', 'smtp_from_name'
      ])


    const settings: Record<string, string> = {}
    for (const s of settingsData || []) {
      settings[s.key] = s.value
    }

    const adminEmail = settings.contact_email || ''
    const siteName = settings.hero_title || 'Retour Gagnant Bénin'

    const formatPrice = (amount: number) => new Intl.NumberFormat('fr-FR').format(amount)

    // Store notification in the database for admin panel
    await supabase.from('notifications').insert({
      type: type === 'abandoned' ? 'cart_abandoned' : (type || 'order_update'),
      title: type === 'payment_success'
        ? `Nouvelle commande payée - ${order.product_title}`
        : type === 'abandoned'
        ? ` Panier abandonné - ${order.product_title}`
        : `Commande mise à jour - ${order.product_title}`,
      message: type === 'payment_success'
        ? `${order.customer_name} a payé ${formatPrice(order.amount)} ${order.currency || 'XOF'} pour "${order.product_title}" (x${order.quantity || 1}). Tel: ${order.customer_phone}`
        : type === 'abandoned'
        ? `${order.customer_name} a abandonné son panier (${order.product_title} — ${formatPrice(order.amount)} ${order.currency || 'XOF'}). Tel: ${order.customer_phone}${order.customer_email ? `, Email: ${order.customer_email}` : ''}. Relancez ce client !`
        : `La commande #${order_id.slice(0, 8)} a été mise à jour. Statut: ${order.payment_status}`,
      order_id,
      is_read: false,
    })

    // Email notification via Nodemailer
    console.log('[Notification] SMTP config:', { host: settings.smtp_host || 'MANQUANT', user: settings.smtp_user || 'MANQUANT', pass: settings.smtp_pass ? '***' : 'MANQUANT', port: settings.smtp_port || '(default 465)' })
    console.log('[Notification] Admin email:', adminEmail || 'MANQUANT', '| Client email:', order.customer_email || 'MANQUANT')

    if (settings.smtp_host && settings.smtp_user && settings.smtp_pass) {
      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: Number(settings.smtp_port) || 465,
        secure: Number(settings.smtp_port) === 465,
        auth: {
          user: settings.smtp_user,
          pass: settings.smtp_pass
        }
      });

      const fromString = `"${settings.smtp_from_name || siteName}" <${settings.smtp_from_email || settings.smtp_user}>`;
      const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj';

      // Send to Admin
      if (adminEmail) {
        try {
          console.log('[Notification] Envoi email admin →', adminEmail)
          await transporter.sendMail({
            from: fromString,
            to: adminEmail,
            replyTo: settings.smtp_user,
            subject: type === 'payment_success'
              ? `[${siteName}] Nouvelle commande - ${order.product_title}`
              : type === 'abandoned'
              ? `[${siteName}]  Panier abandonné - ${order.product_title}`
              : `[${siteName}] Commande #${order_id.slice(0, 8)} mise a jour`,
            html: generateOrderEmailHTML(order, siteName, type, baseUrl),
          })
          console.log('[Notification] Email admin envoyé OK')
        } catch (emailErr) {
          console.error('[Notification] ERREUR email admin:', emailErr)
        }
      }

      // Send to Customer
      if (order.customer_email && type === 'payment_success') {
        try {
          console.log('[Notification] Envoi facture client →', order.customer_email)
          await transporter.sendMail({
            from: fromString,
            to: order.customer_email,
            replyTo: settings.smtp_from_email,
 subject: `Facture & Confirmation de commande — ${siteName}`,
            html: generateCustomerEmailHTML(order, siteName, baseUrl, eventTicket, settings),
          })
          console.log('[Notification] Email client envoyé OK')
        } catch (emailErr) {
          console.error('[Notification] ERREUR email client:', emailErr)
        }
      } else {
        console.warn('[Notification] Pas d\'email client — customer_email:', order.customer_email, '| type:', type)
      }
    } else {
      console.error("[Notification] SMTP NON CONFIGURÉ — smtp_host:", settings.smtp_host, "smtp_user:", settings.smtp_user, "smtp_pass:", settings.smtp_pass ? 'présent' : 'MANQUANT')
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("Notif Error", e);
    return NextResponse.json({ error: 'Notification error' }, { status: 500 })
  }
}

function generateOrderEmailHTML(order: Record<string, unknown>, siteName: string, type: string, baseUrl: string): string {
  const f = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
  const logoUrl = `${baseUrl}/logo.jpg`
  const ref = `RG-${(order.id as string).slice(0, 8).toUpperCase()}`
  const payMethodLabel: Record<string, string> = {
    kkiapay: 'Mobile Money — Kkiapay', fedapay: 'Mobile Money — FedaPay',
    stripe: 'Carte bancaire — Stripe', paypal: 'PayPal Business', zeyow: 'Zeyow',
  }
  const payLabel = payMethodLabel[order.payment_method as string] || String(order.payment_method || '').toUpperCase()

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#0d1117;border-radius:16px;overflow:hidden;border:1px solid #1e2a3a;">
    <div style="background:linear-gradient(135deg,#006b40,#008751);padding:32px 40px;display:flex;align-items:center;gap:16px;">
      <img src="${logoUrl}" alt="${siteName}" width="52" height="52" style="border-radius:10px;object-fit:cover;border:2px solid rgba(255,255,255,.3);" />
      <div>
        <div style="font-size:20px;font-weight:900;color:#fff;">${siteName}</div>
        <div style="font-size:10px;color:#FCD116;text-transform:uppercase;letter-spacing:3px;margin-top:3px;">${type === 'payment_success' ? ' Nouvelle commande reçue' : type === 'abandoned' ? ' Panier abandonné par le client' : 'Mise à jour commande'}</div>
      </div>
    </div>
    <div style="padding:32px 40px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:10px 0;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Client</td><td style="padding:10px 0;text-align:right;font-weight:800;color:#fff;font-size:14px;">${order.customer_name}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:12px;">Téléphone</td><td style="padding:6px 0;text-align:right;color:#d1d5db;font-size:13px;">${order.customer_phone}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:12px;">Produit</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#fff;font-size:13px;">${order.product_title}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:12px;">Quantité</td><td style="padding:6px 0;text-align:right;color:#d1d5db;font-size:13px;">${order.quantity || 1}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:12px;">Méthode</td><td style="padding:6px 0;text-align:right;color:#d1d5db;font-size:13px;">${payLabel}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:12px;">Référence</td><td style="padding:6px 0;text-align:right;font-family:monospace;color:#FCD116;font-size:12px;">${ref}</td></tr>
        <tr style="border-top:1px solid #1e2a3a;">
          <td style="padding:18px 0 8px;color:#FCD116;font-weight:900;font-size:13px;text-transform:uppercase;">${type === 'payment_success' ? 'TOTAL REÇU' : 'TOTAL (NON ENCAISSÉ)'}</td>
          <td style="padding:18px 0 8px;text-align:right;font-size:22px;font-weight:900;color:#FCD116;">${f(order.amount as number)} ${order.currency || 'FCFA'}</td>
        </tr>
      </table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${baseUrl}/admin/orders" style="display:inline-block;background:#008751;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:800;font-size:13px;letter-spacing:.5px;">Gérer sur le dashboard →</a>
      </div>
    </div>
    <div style="padding:16px 40px;background:#080d14;text-align:center;border-top:1px solid #1e2a3a;">
      <p style="margin:0;color:#4b5563;font-size:11px;">${siteName} — Notification automatique · Ne pas répondre</p>
    </div>
  </div>`
}

function generateCustomerEmailHTML(
  order: Record<string, unknown>,
  siteName: string,
  baseUrl: string,
  eventTicket: Record<string, string> | null = null,
  settings: Record<string, string> = {}
): string {
  const f = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
  const invoiceUrl = `${baseUrl}/api/invoices/${order.id}`
  const logoUrl = `${baseUrl}/logo.jpg`
  const ref = `RG-${(order.id as string).slice(0, 8).toUpperCase()}`
  const date = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
  const siteEmail = settings.contact_email || 'contact@retourgagnantbenin.bj'
  const sitePhone = settings.contact_phone || '+229 01 60 32 21 21  ·  +229 01 94 35 50 50'
  const payMethodLabel: Record<string, string> = {
    kkiapay: 'Mobile Money — Kkiapay', fedapay: 'Mobile Money — FedaPay',
    stripe: 'Carte bancaire — Stripe', paypal: 'PayPal Business', zeyow: 'Zeyow',
  }
  const payLabel = payMethodLabel[order.payment_method as string] || String(order.payment_method || '').toUpperCase()

  // ── Lignes des articles ──
  type CartItem = { title?: string; name?: string; price?: number; sale_price?: number; quantity?: number }
  const cartItems: CartItem[] = (
    Array.isArray(order.cart_items) && (order.cart_items as CartItem[]).length > 0
  )
    ? order.cart_items as CartItem[]
    : [{ title: order.product_title as string, price: (order.amount as number) / ((order.quantity as number) || 1), quantity: (order.quantity as number) || 1 }]

  const productRows = cartItems.map((item: CartItem) => {
    const price = item.sale_price && item.sale_price < (item.price || 0) ? item.sale_price : (item.price || 0)
    const total = price * (item.quantity || 1)
    return `<tr>
      <td style="padding:14px 16px;font-size:13px;color:#f3f4f6;border-bottom:1px solid #1e293b;">${item.title || item.name || order.product_title}</td>
      <td style="padding:14px 16px;font-size:13px;color:#94a3b8;text-align:center;border-bottom:1px solid #1e293b;">${item.quantity || 1}</td>
      <td style="padding:14px 16px;font-size:13px;color:#94a3b8;text-align:right;border-bottom:1px solid #1e293b;">${f(price)} FCFA</td>
      <td style="padding:14px 16px;font-size:13px;font-weight:700;color:#FCD116;text-align:right;border-bottom:1px solid #1e293b;">${f(total)} FCFA</td>
    </tr>`
  }).join('')

  const shippingFee = (order.shipping_fee as number) || 0
  const shippingRow = shippingFee > 0 ? `<tr>
    <td colspan="3" style="padding:12px 16px;font-size:12px;color:#94a3b8;text-align:right;border-bottom:1px solid #1e293b;">Frais de livraison${order.shipping_zone ? ` (${order.shipping_zone})` : ''}</td>
    <td style="padding:12px 16px;font-size:12px;color:#f3f4f6;font-weight:600;text-align:right;border-bottom:1px solid #1e293b;">+ ${f(shippingFee)} FCFA</td>
  </tr>` : ''

  const ticketHtml = eventTicket ? `
  <div style="background:#0f172a;border-radius:12px;padding:24px;margin:24px 0;text-align:center;border:1px solid #FCD116;">
    <p style="margin:0 0 6px;font-size:9px;color:#FCD116;text-transform:uppercase;letter-spacing:2px;font-weight:800;">Votre ticket d'accès (VIP)</p>
    <h3 style="margin:0 0 16px;font-size:18px;color:#ffffff;">${eventTicket.event_title || order.product_title}</h3>
    <div style="background:#fff;padding:12px;border-radius:8px;display:inline-block;margin-bottom:12px;">
       <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(eventTicket.qr_data || eventTicket.ticket_code)}" width="140" height="140" alt="QR" style="display:block;" />
    </div>
    <p style="margin:0;font-size:22px;font-family:'Courier New',Courier,monospace;font-weight:900;color:#FCD116;letter-spacing:4px;">${eventTicket.ticket_code}</p>
  </div>` : ''

  return `
<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#020617;margin:0;padding:40px 10px;">
  <div style="max-width:640px;margin:0 auto;background:#0a0e17;border-radius:0;overflow:hidden;border:1px solid #1e293b;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
    
    <!-- LIGNE BÉNIN -->
    <div style="display:flex;height:4px;width:100%;">
      <div style="flex:1;background:#008751;"></div>
      <div style="flex:1;background:#FCD116;"></div>
      <div style="flex:1;background:#E8112D;"></div>
    </div>

    <!-- EN-TÊTE PREMIUM -->
    <div style="padding:40px 40px 30px;text-align:center;border-bottom:1px solid #1e293b;">
       <img src="${logoUrl}" alt="${siteName}" width="70" height="70" style="border-radius:12px;object-fit:cover;border:1px solid #334155;margin-bottom:16px;" />
       <h1 style="margin:0;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">${siteName}</h1>
       <p style="margin:6px 0 0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:3px;">Facture & Confirmation</p>
    </div>

    <div style="padding:32px 40px;">
      <!-- RÉFÉRENCES -->
      <table style="width:100%;margin-bottom:32px;background:#0f172a;border-radius:8px;padding:20px;">
        <tr>
          <td style="padding:15px 20px;">
            <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#64748b;">Client</p>
            <p style="margin:0;font-size:15px;font-weight:700;color:#ffffff;">${order.customer_name}</p>
          </td>
          <td style="padding:15px 20px;text-align:right;">
            <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#64748b;">N° Facture</p>
            <p style="margin:0;font-size:15px;font-weight:900;color:#FCD116;">${ref}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 20px 15px;">
            <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#64748b;">Date</p>
            <p style="margin:0;font-size:13px;color:#cbd5e1;">${date}</p>
          </td>
          <td style="padding:0 20px 15px;text-align:right;">
            <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#64748b;">Statut</p>
            <div style="display:inline-block;padding:4px 10px;background:rgba(0,135,81,0.2);border:1px solid rgba(0,135,81,0.5);border-radius:4px;color:#10b981;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Payée</div>
          </td>
        </tr>
      </table>

      ${ticketHtml}

      <!-- TABLEAU DES DESIGNATIONS -->
      <h2 style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;margin:0 0 12px;border-bottom:1px solid #1e293b;padding-bottom:10px;">Désignations</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr>
            <th style="padding:10px 16px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#64748b;text-align:left;border-bottom:1px solid #334155;">Description</th>
            <th style="padding:10px 16px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#64748b;text-align:center;border-bottom:1px solid #334155;">Qté</th>
            <th style="padding:10px 16px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#64748b;text-align:right;border-bottom:1px solid #334155;">P.U.</th>
            <th style="padding:10px 16px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#FCD116;text-align:right;border-bottom:1px solid #334155;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${productRows}
          ${shippingRow}
        </tbody>
      </table>

      <!-- TOTAL BOX -->
      <table style="width:100%;margin-bottom:32px;">
        <tr>
          <td style="width:50%;vertical-align:top;">
            <p style="margin:0 0 4px;font-size:11px;color:#64748b;">Moyen de paiement</p>
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#f3f4f6;">${payLabel}</p>
            ${order.transaction_id ? `<p style="margin:0;font-size:10px;color:#475569;font-family:monospace;">Tx: ${order.transaction_id}</p>` : ''}
          </td>
          <td style="width:50%;text-align:right;">
             <div style="background:#0f172a;border-left:4px solid #FCD116;padding:16px 20px;display:inline-block;">
                <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;">Montant Réglé (TTC)</p>
                <p style="margin:0;font-size:24px;font-weight:900;color:#FCD116;">${f(order.amount as number)} <span style="font-size:14px;color:#94a3b8;">FCFA</span></p>
             </div>
          </td>
        </tr>
      </table>

      <!-- BOUTONS D'ACTION -->
      <div style="text-align:center;margin:40px 0 20px;">
        <a href="${invoiceUrl}" style="display:inline-block;background:#FCD116;color:#0f172a;text-decoration:none;padding:16px 36px;border-radius:4px;font-weight:900;font-size:13px;text-transform:uppercase;letter-spacing:1px;transition:all 0.2s;">Télécharger au format PDF</a>
      </div>

    </div>

    <!-- FOOTER PREMIUM -->
    <div style="padding:32px 40px;background:#06080d;text-align:center;border-top:1px solid #1e293b;">
      <p style="margin:0 0 12px;font-size:12px;color:#94a3b8;">
        Besoin d'aide ? Contactez-nous à <a href="mailto:${siteEmail}" style="color:#FCD116;text-decoration:none;">${siteEmail}</a>
        ${sitePhone ? ` ou au ${sitePhone}` : ''}
      </p>
      <p style="margin:0;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:1px;">
        <strong>${siteName}</strong> · Haie-Vive Cocotiers, Carré n°1158, Cotonou — République du Bénin
      </p>
    </div>

  </div>
</div>`
}
