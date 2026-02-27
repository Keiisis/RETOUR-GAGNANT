import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import nodemailer from 'nodemailer'

// Notification API — sends email notifications for order events using SMTP
export async function POST(request: Request) {
    try {
        const { order_id, type } = await request.json()

        if (!order_id) {
            return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })
        }

        // Fetch order details
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .select('*')
            .eq('id', order_id)
            .single()

        if (orderErr || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
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
        const siteName = settings.hero_title || 'Retour Gagnant'

        const formatPrice = (amount: number) => new Intl.NumberFormat('fr-FR').format(amount)

        // Store notification in the database for admin panel
        await supabase.from('notifications').insert({
            type: type || 'order_update',
            title: type === 'payment_success'
                ? `Nouvelle commande payée - ${order.product_title}`
                : `Commande mise à jour - ${order.product_title}`,
            message: type === 'payment_success'
                ? `${order.customer_name} a payé ${formatPrice(order.amount)} ${order.currency || 'XOF'} pour "${order.product_title}" (x${order.quantity || 1}). Tel: ${order.customer_phone}`
                : `La commande #${order_id.slice(0, 8)} a été mise à jour. Statut: ${order.payment_status}`,
            order_id,
            is_read: false,
        })

        // Email notification via Nodemailer
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
            const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://retourgagnant.bj';

            // Send to Admin
            if (adminEmail) {
                try {
                    await transporter.sendMail({
                        from: fromString,
                        to: adminEmail,
                        replyTo: settings.smtp_user,
                        subject: type === 'payment_success'
                            ? `[${siteName}] Nouvelle commande - ${order.product_title}`
                            : `[${siteName}] Commande #${order_id.slice(0, 8)} mise a jour`,
                        html: generateOrderEmailHTML(order, siteName, type, baseUrl),
                    })
                } catch (emailErr) {
                    console.error('Admin Email send error:', emailErr)
                }
            }

            // Send to Customer
            if (order.customer_email && type === 'payment_success') {
                try {
                    await transporter.sendMail({
                        from: fromString,
                        to: order.customer_email,
                        replyTo: settings.smtp_from_email,
                        subject: `Confirmation de paiement & Facture - ${siteName}`,
                        html: generateCustomerEmailHTML(order, siteName, baseUrl),
                    })
                } catch (emailErr) {
                    console.error('Customer email error:', emailErr)
                }
            }
        } else {
            console.log("SMTP not configuréed. Skipping emails.")
        }

        return NextResponse.json({ ok: true })
    } catch (e) {
        console.error("Notif Error", e);
        return NextResponse.json({ error: 'Notification error' }, { status: 500 })
    }
}

function generateOrderEmailHTML(order: Record<string, unknown>, siteName: string, type: string, baseUrl: string): string {
    const formatPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0f18; color: white; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #FCD116, #008751); padding: 32px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0a0f18;">${siteName}</h1>
        <p style="margin: 8px 0 0; font-size: 12px; color: #0a0f18; text-transform: uppercase; letter-spacing: 3px;">
          ${type === 'payment_success' ? 'Nouvelle Commande Receuillie' : 'Mise a jour'}
        </p>
      </div>
      <div style="padding: 32px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #888; font-size: 12px;">Client</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${order.customer_name}</td></tr>
          <tr><td style="padding: 8px 0; color: #888; font-size: 12px;">Telephone</td><td style="padding: 8px 0; text-align: right;">${order.customer_phone}</td></tr>
          <tr><td style="padding: 8px 0; color: #888; font-size: 12px;">Produit</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${order.product_title}</td></tr>
          <tr><td style="padding: 8px 0; color: #888; font-size: 12px;">Quantitée</td><td style="padding: 8px 0; text-align: right;">${order.quantity || 1}</td></tr>
          <tr style="border-top: 1px solid #333;"><td style="padding: 16px 0 8px; color: #FCD116; font-weight: bold;">TOTAL</td><td style="padding: 16px 0 8px; text-align: right; font-size: 20px; font-weight: 900; color: #FCD116;">${formatPrice(order.amount as number)} ${order.currency || 'XOF'}</td></tr>
          <tr><td style="padding: 4px 0; color: #888; font-size: 12px;">Methode</td><td style="padding: 4px 0; text-align: right; text-transform: uppercase;">${order.payment_method}</td></tr>
          <tr><td style="padding: 4px 0; color: #888; font-size: 12px;">Ref</td><td style="padding: 4px 0; text-align: right; font-family: monospace; font-size: 11px;">${(order.id as string).slice(0, 8).toUpperCase()}</td></tr>
        </table>

        <div style="margin-top: 30px; text-align: center;">
          <a href="${baseUrl}/admin/orders" style="display: inline-block; background: #008751; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 14px;">GÉRER SUR LE DASHBOARD</a>
        </div>
      </div>
    </div>
  `
}

function generateCustomerEmailHTML(order: Record<string, unknown>, siteName: string, baseUrl: string): string {
    const formatPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
    const invoiceUrl = `${baseUrl}/api/invoices/${order.id}`
    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background: #008751; padding: 40px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: white;">${siteName}</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Facture & Confirmation</p>
      </div>
      <div style="padding: 40px;">
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin-top: 0;">Bonjour <strong>${order.customer_name}</strong>,</p>
        <p style="color: #666; font-size: 15px; line-height: 1.6;">Nous accusons bonne réception de votre paiement de <strong style="color: #008751;">${formatPrice(order.amount as number)} ${order.currency || 'XOF'}</strong> pour le service/produit <strong>"${order.product_title}"</strong>.</p>
        
        <div style="background: #f8f9fa; border-radius: 16px; padding: 24px; margin: 30px 0; text-align: center; border: 1px dashed #ced4da;">
          <p style="margin: 0 0 16px; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">Réf: ${(order.id as string).slice(0, 8).toUpperCase()}</p>
          <a href="${invoiceUrl}" style="display: inline-block; background: #1a1a1a; color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Consulter ma Facture</a>
          <p style="margin: 16px 0 0; font-size: 11px; color: #888;">(PDF téléchargeable depuis la page)</p>
        </div>
        
        <p style="color: #888; font-size: 13px; line-height: 1.6;">Notre équipe prendra rapidement contact avec vous au <strong>${order.customer_phone}</strong> afin d'organiser la suite.</p>
      </div>
      <div style="padding: 24px 40px; background: #f9fafb; text-align: center; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #aaa; font-size: 11px; line-height: 1.6;">${siteName} — Agence de Confiance<br>Cotonou, République du Bénin</p>
      </div>
    </div>
  `
}
