import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { executerCron } from '@/lib/cron-journal'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

const RECOVERY_INTERVAL_DAYS = 5   // Relance toutes les 5 jours
const MAX_RECOVERY_EMAILS = 3       // Maximum 3 relances par panier
const ABANDON_DELAY_HOURS = 2       // Considérer abandonné après 2h sans paiement

/**
 * POST /api/cron/cart-recovery
 *
 * Système de récupération de paniers abandonnés ultra-dynamique.
 *
 * Détection : commandes avec payment_status='pending' depuis > 2h avec email client.
 * Relance : email personnalisé tous les 5 jours, maximum 3 fois.
 * Tracking : colonne `recovery_emails_count` + `last_recovery_at` sur la table orders.
 * Arrêt automatique : après 3 emails ou si la commande est complétée/annulée.
 *
 * Séquence des emails :
 *   Email 1 (J+2h à J+5) : rappel doux "votre panier vous attend"
 *   Email 2 (J+5 à J+10) : urgence légère "articles limités"
 *   Email 3 (J+10 à J+15) : dernière chance + offre de contact
 */
export async function POST(request: Request) {
    return executerCron('cart-recovery', request, async () => {
    try {

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Configuration manquante' }, { status: 503 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // ── SMTP config ────────────────────────────────────────────────────────
        const { data: smtpData } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_email', 'smtp_from_name'])

        const smtp: Record<string, string> = {}
        for (const s of smtpData || []) smtp[s.key] = s.value

        if (!smtp.smtp_host) {
            return NextResponse.json({ error: 'SMTP non configuré', sent: 0 })
        }

        const transporter = nodemailer.createTransport({
            host: smtp.smtp_host,
            port: Number(smtp.smtp_port) || 465,
            secure: Number(smtp.smtp_port) === 465,
            auth: { user: smtp.smtp_user, pass: smtp.smtp_pass },
            tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
        })

        const fromString = `"${smtp.smtp_from_name || 'Retour Gagnant Bénin'}" <${smtp.smtp_from_email || smtp.smtp_user}>`

        // ── Trouver les paniers abandonnés ─────────────────────────────────────
        const cutoff = new Date(Date.now() - ABANDON_DELAY_HOURS * 3600 * 1000).toISOString()
        const maxAge = new Date(Date.now() - RECOVERY_INTERVAL_DAYS * MAX_RECOVERY_EMAILS * 24 * 3600 * 1000).toISOString()

        const { data: abandoned, error: fetchErr } = await supabase
            .from('orders')
            .select('id, customer_name, customer_email, product_title, amount, currency, cart_items, created_at, recovery_emails_count, last_recovery_at')
            .eq('payment_status', 'pending')
            .not('customer_email', 'is', null)
            .neq('customer_email', '')
            .lt('created_at', cutoff)       // Abandonné depuis au moins 2h
            .gt('created_at', maxAge)       // Pas plus vieux que la fenêtre max
            .lt('recovery_emails_count', MAX_RECOVERY_EMAILS)  // Moins de 3 emails envoyés
            .order('created_at', { ascending: false })

        if (fetchErr) {
            console.error('[cart-recovery] Erreur fetch:', fetchErr.message)
            return NextResponse.json({ error: fetchErr.message }, { status: 500 })
        }

        let sent = 0
        let skipped = 0
        const now = new Date()

        for (const order of abandoned || []) {
            // Vérifier l'intervalle depuis le dernier email
            if (order.last_recovery_at) {
                const lastSent = new Date(order.last_recovery_at)
                const daysSince = (now.getTime() - lastSent.getTime()) / (1000 * 3600 * 24)
                if (daysSince < RECOVERY_INTERVAL_DAYS) {
                    skipped++
                    continue
                }
            }

            const emailNum = (order.recovery_emails_count || 0) + 1
            const html = buildRecoveryEmail(order, emailNum)

            try {
                await transporter.sendMail({
                    from: fromString,
                    to: order.customer_email,
                    subject: getSubject(emailNum, order.customer_name),
                    html,
                })

                // Mettre à jour les compteurs
                await supabase
                    .from('orders')
                    .update({
                        recovery_emails_count: emailNum,
                        last_recovery_at: now.toISOString(),
                    })
                    .eq('id', order.id)

                sent++
                console.log(`[cart-recovery] Email ${emailNum}/3 → ${order.customer_email} (order: ${order.id.slice(0, 8)})`)
            } catch (mailErr) {
                console.error(`[cart-recovery] Échec email → ${order.customer_email}:`, mailErr)
            }
        }

        return NextResponse.json({
            sent,
            skipped,
            total: (abandoned || []).length,
            message: `${sent} email(s) de relance envoyé(s)`,
        })

    } catch (err) {
        console.error('[cart-recovery] Erreur inattendue:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
    })
}

export async function GET(request: Request) {
    return POST(request)
}

// ── Sujets personnalisés selon le numéro de relance ───────────────────────────
function getSubject(emailNum: number, name: string): string {
    const prenom = (name || '').split(' ')[0] || 'vous'
    switch (emailNum) {
        case 1: return ` ${prenom}, votre panier vous attend sur Retour Gagnant Bénin`
        case 2: return ` ${prenom}, vos articles sont encore disponibles : mais pour combien de temps ?`
        case 3: return ` Dernière chance, ${prenom} : votre panier expire bientôt`
        default: return `Votre panier Retour Gagnant Bénin`
    }
}

// ── Template HTML dynamique selon le numéro de relance ───────────────────────
function buildRecoveryEmail(order: {
    id: string
    customer_name?: string
    customer_email?: string
    product_title?: string
    amount?: number
    currency?: string
    cart_items?: Array<{ title?: string; product_title?: string; quantity?: number; unit_price?: number; sale_price?: number; price?: number }>
}, emailNum: number): string {
    const prenom = (order.customer_name || '').split(' ')[0] || 'cher client'
    const boutiquUrl = `${SITE_URL}/boutique`

    // Construire la liste des articles
    const items: Array<{ title: string; qty: number; price: number }> = []
    if (Array.isArray(order.cart_items) && order.cart_items.length > 0) {
        for (const item of order.cart_items) {
            items.push({
                title: item.title || item.product_title || 'Article',
                qty: item.quantity || 1,
                price: (item.sale_price && item.sale_price < (item.price || 0)) ? item.sale_price : (item.unit_price || item.price || 0),
            })
        }
    } else if (order.product_title) {
        items.push({ title: order.product_title, qty: 1, price: order.amount || 0 })
    }

    const total = order.amount || 0
    const currency = order.currency || 'XOF'
    const totalDisplay = currency === 'XOF'
        ? `${total.toLocaleString('fr-FR')} FCFA`
        : `${total.toLocaleString('fr-FR')} ${currency}`

    const itemsHtml = items.map(item => `
        <tr>
            <td style="padding:10px 16px;color:#1f2937;font-size:14px;border-bottom:1px solid #f3f4f6;">
                ${item.title} × ${item.qty}
            </td>
            <td style="padding:10px 16px;color:#1f2937;font-size:14px;font-weight:bold;border-bottom:1px solid #f3f4f6;text-align:right;">
                ${(item.price * item.qty).toLocaleString('fr-FR')} FCFA
            </td>
        </tr>`).join('')

    // Messages selon le numéro de relance
    const messages: Record<number, { headline: string; body: string; cta: string; urgency: string }> = {
        1: {
            headline: `Vous avez oublié quelque chose, ${prenom} !`,
            body: `Vous avez ajouté des articles à votre panier sur Retour Gagnant Bénin mais n'avez pas finalisé votre commande. Vos articles vous attendent toujours !`,
            cta: 'Finaliser ma commande',
            urgency: '',
        },
        2: {
            headline: ` Vos articles sont encore disponibles, ${prenom} !`,
            body: `Votre panier est toujours enregistré chez nous. Mais les stocks de certains articles sont limités : nous ne pouvons pas garantir leur disponibilité indéfiniment.`,
            cta: 'Sécuriser ma commande maintenant',
            urgency: `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 18px;margin:20px 0;">
                <p style="color:#c2410c;font-weight:bold;margin:0;font-size:13px;"> Stock limité : commandez avant qu'il ne soit trop tard !</p>
            </div>`,
        },
        3: {
            headline: ` Dernière chance, ${prenom} !`,
            body: `C'est votre dernier rappel concernant votre panier. Après cela, nous libérerons vos articles pour d'autres clients. Profitez-en maintenant ou contactez-nous si vous avez besoin d'aide.`,
            cta: 'Commander avant qu\'il ne soit trop tard',
            urgency: `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 18px;margin:20px 0;">
                <p style="color:#dc2626;font-weight:bold;margin:0 0 6px;font-size:13px;">⏰ Votre panier sera libéré dans 5 jours</p>
                <p style="color:#991b1b;margin:0;font-size:12px;">Besoin d'aide ? Répondez à cet email ou contactez-nous sur WhatsApp : +229 01 60 32 21 21</p>
            </div>`,
        },
    }

    const msg = messages[emailNum] || messages[1]

    return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <tr>
        <td style="background:linear-gradient(135deg,#1a3a6b 0%,#0d5c4a 100%);padding:32px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:900;letter-spacing:1px;">🇧🇯 RETOUR GAGNANT BÉNIN</h1>
            <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:2px;">Votre panier vous attend</p>
        </td>
    </tr>

    <!-- Body -->
    <tr>
        <td style="padding:36px 40px;">
            <h2 style="color:#111827;font-size:20px;font-weight:800;margin:0 0 12px;">${msg.headline}</h2>
            <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 20px;">${msg.body}</p>

            ${msg.urgency}

            <!-- Récapitulatif panier -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin:20px 0;">
                <div style="background:#1e293b;padding:12px 16px;">
                    <p style="color:#fff;margin:0;font-size:13px;font-weight:bold;"> Votre panier</p>
                </div>
                <table width="100%" cellpadding="0" cellspacing="0">
                    ${itemsHtml}
                    <tr>
                        <td style="padding:12px 16px;font-weight:bold;font-size:15px;color:#111827;">Total</td>
                        <td style="padding:12px 16px;font-weight:900;font-size:16px;color:#0d5c4a;text-align:right;">${totalDisplay}</td>
                    </tr>
                </table>
            </div>

            <!-- CTA -->
            <div style="text-align:center;margin:28px 0;">
                <a href="${boutiquUrl}" style="display:inline-block;background:linear-gradient(135deg,#008751,#006b40);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:900;font-size:15px;letter-spacing:0.5px;box-shadow:0 4px 16px rgba(0,135,81,0.3);">
                    ${msg.cta} →
                </a>
            </div>

            <p style="color:#9ca3af;font-size:12px;text-align:center;margin:16px 0 0;">
                Des questions ? Contactez-nous : <a href="mailto:contact@retourgagnantbenin.bj" style="color:#008751;">contact@retourgagnantbenin.bj</a>
            </p>
        </td>
    </tr>

    <!-- Footer -->
    <tr>
        <td style="background:#f1f5f9;padding:20px 40px;text-align:center;">
            <p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6;">
                © ${new Date().getFullYear()} Retour Gagnant Bénin : Votre partenaire pour un retour réussi au Bénin<br>
                <span style="font-size:10px;">Vous recevez cet email car vous avez initié un achat sur notre plateforme. Référence commande : ${order.id.slice(0, 8).toUpperCase()}</span>
            </p>
        </td>
    </tr>

</table>
</td></tr>
</table>
</body>
</html>`
}
