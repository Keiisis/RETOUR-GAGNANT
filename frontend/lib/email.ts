import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export interface EmailConfig {
    host: string
    port: number
    user: string
    pass: string
    fromName: string
    fromEmail: string
    adminEmail: string
}

// ═══════════════════════════════════════════════════════
// SMTP CONFIG (from Supabase settings table)
// ═══════════════════════════════════════════════════════
export async function getEmailConfig(): Promise<EmailConfig> {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data } = await supabase
        .from('settings')
        .select('key, value')
        .eq('category', 'email')

    const map: Record<string, string> = {}
    ;(data || []).forEach((row: { key: string; value: string }) => {
        map[row.key] = row.value
    })

    return {
        host: map['smtp_host'] || '',
        port: parseInt(map['smtp_port'] || '587'),
        user: map['smtp_user'] || '',
        pass: map['smtp_pass'] || '',
        fromName: map['smtp_from_name'] || 'Retour Gagnant Bénin',
        fromEmail: map['smtp_from_email'] || '',
        adminEmail: map['email_admin_destination'] || '',
    }
}

export async function createTransporter() {
    const config = await getEmailConfig()

    if (!config.host || !config.user || !config.pass) {
        console.log('[EMAIL] SMTP not configured yet — skipping email send.')
        return null
    }

    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: {
            user: config.user,
            pass: config.pass,
        },
        tls: { rejectUnauthorized: false }
    })
}

export async function sendEmail(options: {
    to: string
    subject: string
    html: string
    replyTo?: string
    context?: string
    relatedId?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const config = await getEmailConfig()
        const transporter = await createTransporter()

        if (!transporter) {
            return { success: false, error: 'SMTP non configuré. Allez dans Admin > Paramètres > Email.' }
        }

        const info = await transporter.sendMail({
            from: `"${config.fromName}" <${config.fromEmail}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            replyTo: options.replyTo || config.fromEmail,
        })

        const supabase = createClient(supabaseUrl, supabaseKey)
        await supabase.from('email_logs').insert({
            to_email: options.to,
            subject: options.subject,
            body_html: options.html,
            context: options.context || 'manual',
            related_id: options.relatedId || null,
            status: 'sent',
            smtp_response: info.messageId || '',
        })

        return { success: true }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error('[EMAIL] Send error:', errorMessage)

        const supabase = createClient(supabaseUrl, supabaseKey)
        await supabase.from('email_logs').insert({
            to_email: options.to,
            subject: options.subject,
            body_html: options.html,
            context: options.context || 'manual',
            related_id: options.relatedId || null,
            status: 'failed',
            smtp_response: errorMessage,
        })

        return { success: false, error: errorMessage }
    }
}

// ═══════════════════════════════════════════════════════
// 🌍 MULTILINGUAL EMAIL TRANSLATIONS
// ═══════════════════════════════════════════════════════
interface EmailTranslations {
    greeting: string
    thankYou: string
    received: string
    expertContact: string
    bookBtn: string
    newLead: string
    name: string
    email: string
    score: string
    service: string
    viewDashboard: string
    sentBy: string
    replyTo: string
    footer: string
    autoSent: string
    hello: string
}

const EMAIL_I18N: Record<string, EmailTranslations> = {
    fr: {
        greeting: 'Bonjour',
        hello: 'Bonjour',
        thankYou: 'Merci',
        received: 'Nous avons bien reçu votre demande et notre équipe l\'examine avec attention.',
        expertContact: 'Un expert de notre équipe vous contactera dans les plus brefs délais pour un accompagnement personnalisé.',
        bookBtn: 'Réserver un rendez-vous gratuit',
        newLead: 'Nouveau Lead',
        name: 'Nom',
        email: 'Email',
        score: 'Score',
        service: 'Service',
        viewDashboard: 'Voir dans le Dashboard',
        sentBy: 'Cet email vous a été envoyé par un conseiller de Retour Gagnant Bénin.',
        replyTo: 'Pour toute réponse, envoyez un email à',
        footer: `© ${new Date().getFullYear()} Retour Gagnant Bénin — Tradition, Modernité, Excellence`,
        autoSent: 'Cet email a été envoyé automatiquement. Ne pas répondre directement.',
    },
    en: {
        greeting: 'Hello',
        hello: 'Hello',
        thankYou: 'Thank you',
        received: 'We have received your request and our team is carefully reviewing it.',
        expertContact: 'A member of our team will contact you shortly for personalized support.',
        bookBtn: 'Book a free consultation',
        newLead: 'New Lead',
        name: 'Name',
        email: 'Email',
        score: 'Score',
        service: 'Service',
        viewDashboard: 'View in Dashboard',
        sentBy: 'This email was sent by a consultant from Retour Gagnant Bénin.',
        replyTo: 'To reply, send an email to',
        footer: `© ${new Date().getFullYear()} Retour Gagnant Bénin — Tradition, Modernity, Excellence`,
        autoSent: 'This email was sent automatically. Do not reply directly.',
    },
    es: {
        greeting: 'Hola',
        hello: 'Hola',
        thankYou: 'Gracias',
        received: 'Hemos recibido su solicitud y nuestro equipo la está examinando con atención.',
        expertContact: 'Un experto de nuestro equipo se pondrá en contacto con usted en breve para un acompañamiento personalizado.',
        bookBtn: 'Reservar una consulta gratuita',
        newLead: 'Nuevo Lead',
        name: 'Nombre',
        email: 'Email',
        score: 'Puntuación',
        service: 'Servicio',
        viewDashboard: 'Ver en el Dashboard',
        sentBy: 'Este email fue enviado por un consultor de Retour Gagnant Bénin.',
        replyTo: 'Para responder, envíe un email a',
        footer: `© ${new Date().getFullYear()} Retour Gagnant Bénin — Tradición, Modernidad, Excelencia`,
        autoSent: 'Este email fue enviado automáticamente. No responda directamente.',
    },
    pt: {
        greeting: 'Olá',
        hello: 'Olá',
        thankYou: 'Obrigado',
        received: 'Recebemos o seu pedido e a nossa equipa está a analisá-lo com atenção.',
        expertContact: 'Um especialista da nossa equipa entrará em contacto consigo brevemente para um acompanhamento personalizado.',
        bookBtn: 'Agendar uma consulta gratuita',
        newLead: 'Novo Lead',
        name: 'Nome',
        email: 'Email',
        score: 'Pontuação',
        service: 'Serviço',
        viewDashboard: 'Ver no Dashboard',
        sentBy: 'Este email foi enviado por um consultor de Retour Gagnant Bénin.',
        replyTo: 'Para responder, envie um email para',
        footer: `© ${new Date().getFullYear()} Retour Gagnant Bénin — Tradição, Modernidade, Excelência`,
        autoSent: 'Este email foi enviado automaticamente. Não responda diretamente.',
    },
    ar: {
        greeting: 'مرحبا',
        hello: 'مرحبا',
        thankYou: 'شكرا',
        received: 'لقد تلقينا طلبك وفريقنا يفحصه بعناية.',
        expertContact: 'سيتصل بك أحد خبراء فريقنا في أقرب وقت ممكن لتقديم دعم مخصص.',
        bookBtn: 'حجز استشارة مجانية',
        newLead: 'عميل محتمل جديد',
        name: 'الاسم',
        email: 'البريد الإلكتروني',
        score: 'النقاط',
        service: 'الخدمة',
        viewDashboard: 'عرض في لوحة التحكم',
        sentBy: 'تم إرسال هذا البريد من قبل مستشار في Retour Gagnant Bénin.',
        replyTo: 'للرد، أرسل بريدًا إلكترونيًا إلى',
        footer: `© ${new Date().getFullYear()} Retour Gagnant Bénin — التقاليد، الحداثة، التميز`,
        autoSent: 'تم إرسال هذا البريد تلقائيًا. لا ترد مباشرة.',
    },
}

// Mapper les noms de langues détectées vers les codes
function resolveLocale(lang: string): string {
    const l = (lang || '').toLowerCase()
    if (l.includes('franç') || l.includes('french') || l === 'fr') return 'fr'
    if (l.includes('angl') || l.includes('english') || l === 'en') return 'en'
    if (l.includes('espag') || l.includes('spanish') || l === 'es') return 'es'
    if (l.includes('portug') || l === 'pt') return 'pt'
    if (l.includes('arab') || l === 'ar') return 'ar'
    return 'fr' // Défaut Bénin = Français
}

function getI18n(lang: string): EmailTranslations {
    return EMAIL_I18N[resolveLocale(lang)] || EMAIL_I18N['fr']
}

// ═══════════════════════════════════════════════════════
// 🎨 PREMIUM EMAIL WRAPPER — Ultra-shine, with logo, multilingual
// Unified design for ALL emails across the entire site
// Now dynamic: reads from document_templates (official_email)
// ═══════════════════════════════════════════════════════
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'
const LOGO_URL = `${SITE_URL}/logo.jpg`
const CONTACT_EMAIL = 'contact@retourgagnantbenin.bj'

// Cache to avoid fetching on every email call
let _cachedEmailTemplate: { header: string; footer: string } | null = null
let _cacheTimestamp = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getEmailTemplate(): Promise<{ header: string; footer: string }> {
    const now = Date.now()
    if (_cachedEmailTemplate && (now - _cacheTimestamp) < CACHE_TTL) {
        return _cachedEmailTemplate
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { data } = await supabase
            .from('document_templates')
            .select('content')
            .eq('id', 'official_email')
            .single()

        if (data?.content) {
            _cachedEmailTemplate = {
                header: data.content.header || '',
                footer: data.content.footer || '',
            }
            _cacheTimestamp = now
            return _cachedEmailTemplate
        }
    } catch (err) {
        console.error('[EMAIL] Failed to fetch email template:', err)
    }

    return { header: '', footer: '' }
}

const EMAIL_WRAPPER = async (content: string, lang: string = 'fr') => {
    const t = getI18n(lang)
    const isRtl = resolveLocale(lang) === 'ar'

    // Fetch dynamic email template from ERP settings
    const emailTpl = await getEmailTemplate()

    // Build dynamic header subtitle from ERP template (replaces hardcoded "BÉNIN")
    const headerSubtitle = emailTpl.header
        ? `<p style="margin:2px 0 0;font-size:9px;color:rgba(252,209,22,0.8);letter-spacing:2px;text-transform:uppercase;font-weight:700;">${emailTpl.header.split('\n')[0]}</p>`
        : `<p style="margin:2px 0 0;font-size:9px;color:rgba(252,209,22,0.8);letter-spacing:4px;text-transform:uppercase;font-weight:700;">BÉNIN</p>`

    // Build dynamic footer from ERP template
    const footerContent = emailTpl.footer
        ? `<p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.25);font-weight:600;letter-spacing:0.5px;">${emailTpl.footer.replace(/\n/g, '<br/>')}</p>`
        : `<p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.25);font-weight:600;letter-spacing:0.5px;">${t.sentBy}</p>`

    return `<!DOCTYPE html>
<html lang="${resolveLocale(lang)}" ${isRtl ? 'dir="rtl"' : ''}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Retour Gagnant Bénin</title>
</head>
<body style="margin:0;padding:0;background:#0a0e17;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e17;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111827;border-radius:20px;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.5);">

        <!-- ══════ FLAG STRIPE ══════ -->
        <tr><td style="height:5px;background:linear-gradient(90deg,#008751 33%,#FCD116 33%,#FCD116 66%,#E8112D 66%);"></td></tr>

        <!-- ══════ LOGO HEADER ══════ -->
        <tr><td style="padding:32px 40px 20px;text-align:center;background:linear-gradient(180deg,#111827 0%,#0f1729 100%);">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td style="vertical-align:middle;padding-right:14px;">
                <img src="${LOGO_URL}" alt="RGB" width="52" height="52" style="border-radius:14px;display:block;border:2px solid rgba(0,135,81,0.3);box-shadow:0 4px 20px rgba(0,135,81,0.2);" />
              </td>
              <td style="vertical-align:middle;text-align:left;">
                <h1 style="margin:0;font-size:20px;font-weight:900;letter-spacing:1px;">
                  <span style="color:#008751;">RETOUR</span> <span style="color:#E8112D;">GAGNANT</span>
                </h1>
                ${headerSubtitle}
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- ══════ DECORATIVE LINE ══════ -->
        <tr><td style="padding:0 40px;">
          <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(0,135,81,0.3),rgba(252,209,22,0.2),transparent);"></div>
        </td></tr>

        <!-- ══════ CONTENT ══════ -->
        <tr><td style="padding:28px 40px 36px;">
          ${content}
        </td></tr>

        <!-- ══════ FOOTER ══════ -->
        <tr><td style="padding:0 40px;">
          <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent);"></div>
        </td></tr>
        <tr><td style="padding:24px 40px;text-align:center;">
          ${footerContent}
          <p style="margin:0 0 12px;font-size:11px;color:rgba(255,255,255,0.2);">
            ${t.replyTo} <a href="mailto:${CONTACT_EMAIL}" style="color:#008751;text-decoration:none;font-weight:600;">${CONTACT_EMAIL}</a>
          </p>
          <div style="height:1px;background:rgba(255,255,255,0.04);margin:12px 0;"></div>
          <p style="margin:0 0 4px;font-size:10px;color:rgba(255,255,255,0.15);letter-spacing:0.3px;">${t.footer}</p>
          <p style="margin:0;font-size:9px;color:rgba(255,255,255,0.1);">${t.autoSent}</p>
        </td></tr>

        <!-- ══════ BOTTOM STRIPE ══════ -->
        <tr><td style="height:4px;background:linear-gradient(90deg,#008751 33%,#FCD116 33%,#FCD116 66%,#E8112D 66%);"></td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ═══════════════════════════════════════════════════════
// 📧 EMAIL TEMPLATES — Multilingual, Premium, Intelligent
// ═══════════════════════════════════════════════════════
import { getServerTranslation } from './server-translation'

export const getEmailTemplates = async (locale: string = 'fr') => {
    // Fallback to basic server translation for legacy support
    await getServerTranslation(locale).catch(() => {})
    const t = getI18n(locale)

    return {
        /** Auto-reply to client after form submission */
        autoReply: (clientName: string, aiMessage: string) => EMAIL_WRAPPER(`
        <h2 style="margin:0 0 16px;font-size:20px;color:#FCD116;font-weight:800;">${t.thankYou} ${clientName} 🤝</h2>
        <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.8;margin:0 0 20px;">
            ${t.received}
        </p>
        <div style="background:rgba(0,135,81,0.08);border-left:3px solid #008751;padding:16px 20px;border-radius:0 12px 12px 0;margin:0 0 24px;">
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);font-style:italic;line-height:1.7;">${aiMessage}</p>
        </div>
        <p style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.7;margin:0 0 24px;">
            ${t.expertContact}
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr><td>
            <a href="${SITE_URL}/rendez-vous" style="display:inline-block;background:linear-gradient(135deg,#008751,#00a664);color:white;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:800;font-size:13px;letter-spacing:0.5px;box-shadow:0 4px 15px rgba(0,135,81,0.3);">
              ${t.bookBtn}
            </a>
          </td></tr>
        </table>
    `, locale),

        /** Confirmation de demande de RDV — sans CTA "réserver" (redondant et illogique) */
        rdvConfirmation: (clientName: string, service: string, date: string | null, timeSlot: string, contactMethod: string, aiMessage: string) => EMAIL_WRAPPER(`
        <h2 style="margin:0 0 16px;font-size:20px;color:#FCD116;font-weight:800;">✅ Demande reçue, ${clientName} !</h2>
        <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.8;margin:0 0 20px;">
            Votre demande de rendez-vous a bien été enregistrée. Votre agent va l'examiner et vous confirmera le créneau très prochainement.
        </p>
        <div style="background:rgba(0,135,81,0.06);border:1px solid rgba(0,135,81,0.2);border-radius:12px;padding:20px;margin:0 0 20px;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:800;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.15em;">Récapitulatif de votre demande</p>
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="padding:6px 0;color:rgba(255,255,255,0.4);font-size:12px;width:120px;">Service</td>
                    <td style="padding:6px 0;color:#FCD116;font-size:13px;font-weight:700;">${service}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0;color:rgba(255,255,255,0.4);font-size:12px;">Date souhaitée</td>
                    <td style="padding:6px 0;color:#fff;font-size:13px;">${date ? new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'À confirmer par votre agent'}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0;color:rgba(255,255,255,0.4);font-size:12px;">Créneau</td>
                    <td style="padding:6px 0;color:#fff;font-size:13px;">${timeSlot || 'Selon disponibilité'}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0;color:rgba(255,255,255,0.4);font-size:12px;">Mode de contact</td>
                    <td style="padding:6px 0;color:#fff;font-size:13px;">${contactMethod || 'À définir'}</td>
                </tr>
            </table>
        </div>
        <div style="background:rgba(0,135,81,0.08);border-left:3px solid #008751;padding:16px 20px;border-radius:0 12px 12px 0;margin:0 0 20px;">
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);font-style:italic;line-height:1.7;">${aiMessage}</p>
        </div>
        <div style="background:rgba(252,209,22,0.05);border:1px solid rgba(252,209,22,0.15);border-radius:10px;padding:14px 18px;text-align:center;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);line-height:1.6;">
                ⏱&nbsp; Votre agent vous confirmera ce rendez-vous sous <strong style="color:rgba(255,255,255,0.8);">24h</strong>.<br/>
                Vous recevrez un email de confirmation avec tous les détails.
            </p>
        </div>
    `, locale),

        /** Notification to agents/admin for new lead */
        newLeadNotification: (leadName: string, leadEmail: string, score: number, service: string, source: string) => EMAIL_WRAPPER(`
        <h2 style="margin:0 0 16px;font-size:20px;color:#FCD116;font-weight:800;">🔔 ${t.newLead} — ${source}</h2>
        <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
            <tr>
              <td style="padding:10px 0;color:rgba(255,255,255,0.4);font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06);width:100px;">${t.name}</td>
              <td style="padding:10px 0;color:#fff;font-size:13px;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.06);">${leadName}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:rgba(255,255,255,0.4);font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06);">${t.email}</td>
              <td style="padding:10px 0;color:#fff;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06);">${leadEmail}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:rgba(255,255,255,0.4);font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06);">${t.score}</td>
              <td style="padding:10px 0;color:${score >= 70 ? '#4ade80' : '#fbbf24'};font-size:20px;font-weight:900;border-bottom:1px solid rgba(255,255,255,0.06);">${score}%</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:rgba(255,255,255,0.4);font-size:13px;">${t.service}</td>
              <td style="padding:10px 0;color:#FCD116;font-size:13px;font-weight:700;">${service}</td>
            </tr>
        </table>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr><td>
            <a href="${SITE_URL}/agent/leads" style="display:inline-block;background:linear-gradient(135deg,#FCD116,#f5c518);color:#111827;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:800;font-size:13px;box-shadow:0 4px 15px rgba(252,209,22,0.3);">
              ${t.viewDashboard}
            </a>
          </td></tr>
        </table>
    `, 'fr'),

        /** Notification admin — nouvelle demande de RDV (sans score Oracle) */
        rdvAdminNotification: (clientName: string, clientEmail: string, service: string, date: string | null, timeSlot: string, contactMethod: string) => EMAIL_WRAPPER(`
        <h2 style="margin:0 0 16px;font-size:20px;color:#FCD116;font-weight:800;">📅 Nouvelle demande de RDV</h2>
        <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
            <tr>
              <td style="padding:10px 0;color:rgba(255,255,255,0.4);font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06);width:130px;">Client</td>
              <td style="padding:10px 0;color:#fff;font-size:13px;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.06);">${clientName}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:rgba(255,255,255,0.4);font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06);">Email</td>
              <td style="padding:10px 0;color:#fff;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06);">${clientEmail}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:rgba(255,255,255,0.4);font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06);">Service demandé</td>
              <td style="padding:10px 0;color:#FCD116;font-size:13px;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.06);">${service}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:rgba(255,255,255,0.4);font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06);">Date souhaitée</td>
              <td style="padding:10px 0;color:#fff;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06);">${date || 'À définir'}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:rgba(255,255,255,0.4);font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06);">Créneau</td>
              <td style="padding:10px 0;color:#fff;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06);">${timeSlot || 'Non précisé'}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:rgba(255,255,255,0.4);font-size:13px;">Mode de contact</td>
              <td style="padding:10px 0;color:#fff;font-size:13px;">${contactMethod || 'Non précisé'}</td>
            </tr>
        </table>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr><td>
            <a href="${SITE_URL}/agent/agenda" style="display:inline-block;background:linear-gradient(135deg,#FCD116,#f5c518);color:#111827;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:800;font-size:13px;box-shadow:0 4px 15px rgba(252,209,22,0.3);">
              Voir dans l'Agenda
            </a>
          </td></tr>
        </table>
    `, 'fr'),

        /** Agent reply email — sent from chat console */
        agentReply: (clientName: string, agentMessage: string, language: string = 'fr') => EMAIL_WRAPPER(`
        <h2 style="margin:0 0 20px;font-size:20px;color:#FCD116;font-weight:800;">${getI18n(language).hello} ${clientName},</h2>
        <div style="color:rgba(255,255,255,0.75);font-size:14px;line-height:1.9;margin:0 0 24px;white-space:pre-wrap;">${agentMessage}</div>
    `, language),

        /** Invoice payment reminder — tone escalates with delay */
        invoiceReminder: (
            clientName: string,
            invoiceNumero: string,
            montant: string,
            currency: string,
            daysOverdue: number,
            portalUrl: string,
        ) => {
            // Déterminer le niveau de rappel et adapter le ton
            let level: 'friendly' | 'firm' | 'formal' = 'friendly'
            let emoji = '📋'
            let accentColor = '#FCD116'
            let title = 'Rappel de paiement'
            let intro = ''
            let closing = ''

            if (daysOverdue <= 10) {
                level = 'friendly'
                emoji = '📋'
                accentColor = '#FCD116'
                title = 'Petit rappel concernant votre facture'
                intro = `Nous espérons que tout va bien de votre côté ! Nous souhaitons simplement vous rappeler que la facture <strong>${invoiceNumero}</strong> d'un montant de <strong>${montant} ${currency}</strong> est en attente de règlement.`
                closing = 'N\'hésitez pas à nous contacter si vous avez la moindre question. Nous restons entièrement à votre disposition !'
            } else if (daysOverdue <= 25) {
                level = 'firm'
                emoji = '⏳'
                accentColor = '#f59e0b'
                title = 'Rappel — Facture en attente de règlement'
                intro = `Nous nous permettons de revenir vers vous concernant la facture <strong>${invoiceNumero}</strong> d'un montant de <strong>${montant} ${currency}</strong>, émise il y a ${daysOverdue} jours et toujours en attente de règlement.`
                closing = 'Nous vous serions reconnaissants de procéder au règlement dans les meilleurs délais, ou de nous contacter si un arrangement est nécessaire.'
            } else {
                level = 'formal'
                emoji = '🔴'
                accentColor = '#ef4444'
                title = 'Dernier rappel — Facture impayée'
                intro = `Malgré nos précédents rappels, la facture <strong>${invoiceNumero}</strong> d'un montant de <strong>${montant} ${currency}</strong> reste impayée depuis ${daysOverdue} jours. Nous vous prions de bien vouloir procéder au règlement dans les plus brefs délais.`
                closing = 'Sans règlement de votre part sous 7 jours, nous serons contraints d\'envisager des mesures complémentaires. Nous restons disponibles pour toute discussion amiable.'
            }

            const urgencyBadge = level === 'formal'
                ? `<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px 16px;margin:0 0 20px;text-align:center;">
                     <span style="color:#ef4444;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">⚠️ DERNIER RAPPEL — ACTION REQUISE</span>
                   </div>`
                : ''

            return EMAIL_WRAPPER(`
        <h2 style="margin:0 0 16px;font-size:20px;color:${accentColor};font-weight:800;">${emoji} ${title}</h2>
        ${urgencyBadge}
        <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.8;margin:0 0 8px;">
            Bonjour <strong style="color:#fff;">${clientName}</strong>,
        </p>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.8;margin:0 0 24px;">
            ${intro}
        </p>

        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin:0 0 24px;">
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="padding:8px 0;color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:1px;">N° Facture</td>
                    <td style="padding:8px 0;text-align:right;color:#fff;font-size:14px;font-weight:700;font-family:monospace;">${invoiceNumero}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0;color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:1px;border-top:1px solid rgba(255,255,255,0.05);">Montant dû</td>
                    <td style="padding:8px 0;text-align:right;color:${accentColor};font-size:20px;font-weight:900;border-top:1px solid rgba(255,255,255,0.05);">${montant} ${currency}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0;color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:1px;border-top:1px solid rgba(255,255,255,0.05);">Retard</td>
                    <td style="padding:8px 0;text-align:right;color:${level === 'formal' ? '#ef4444' : 'rgba(255,255,255,0.6)'};font-size:13px;font-weight:600;border-top:1px solid rgba(255,255,255,0.05);">${daysOverdue} jours</td>
                </tr>
            </table>
        </div>

        <p style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.7;margin:0 0 24px;">
            ${closing}
        </p>

        ${portalUrl ? `<table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr><td>
            <a href="${portalUrl}" style="display:inline-block;background:linear-gradient(135deg,${accentColor},${level === 'formal' ? '#dc2626' : (level === 'firm' ? '#d97706' : '#f5c518')});color:${level === 'friendly' ? '#111827' : '#fff'};text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:800;font-size:13px;letter-spacing:0.5px;box-shadow:0 4px 15px rgba(0,0,0,0.2);">
              Consulter ma facture →
            </a>
          </td></tr>
        </table>` : ''}
    `, 'fr')
        },

        /** Dossier status update & Document Request */
        dossierUpdate: (
            clientName: string,
            dossierNumero: string,
            message: string,
            documentsManquants: string[] = [],
            trackerUrl: string,
            progression: number
        ) => {
            const hasMissingDocs = documentsManquants.length > 0;
            const title = hasMissingDocs ? 'Action Requise : Documents manquants' : 'Mise à jour de votre dossier';
            const accentColor = hasMissingDocs ? '#ef4444' : '#008751';
            const icon = hasMissingDocs ? '⚠️' : '🔄';

            let docsHtml = '';
            if (hasMissingDocs) {
                docsHtml = `
                <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:20px;margin:24px 0;">
                    <h3 style="margin:0 0 12px;color:#ef4444;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Documents Requis d'Urgence</h3>
                    <ul style="margin:0;padding-left:20px;color:rgba(255,255,255,0.8);font-size:14px;line-height:1.6;">
                        ${documentsManquants.map(doc => `<li style="margin-bottom:6px;"><strong>${doc}</strong></li>`).join('')}
                    </ul>
                </div>`;
            }

            return EMAIL_WRAPPER(`
        <h2 style="margin:0 0 16px;font-size:20px;color:${accentColor};font-weight:800;">${icon} ${title}</h2>
        <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.8;margin:0 0 20px;">
            Bonjour <strong style="color:#fff;">${clientName}</strong>,
        </p>
        <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.8;margin:0 0 20px;">
            ${message}
        </p>

        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin:0 0 16px;">
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="padding:8px 0;color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:1px;">N° Dossier</td>
                    <td style="padding:8px 0;text-align:right;color:#fff;font-size:14px;font-weight:700;font-family:monospace;">${dossierNumero}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0;color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:1px;border-top:1px solid rgba(255,255,255,0.05);">Progression</td>
                    <td style="padding:8px 0;text-align:right;color:#FCD116;font-size:16px;font-weight:900;border-top:1px solid rgba(255,255,255,0.05);">${progression}%</td>
                </tr>
            </table>
        </div>

        ${docsHtml}

        <table cellpadding="0" cellspacing="0" style="margin:30px auto 0;">
          <tr><td>
            <a href="${trackerUrl}" style="display:inline-block;background:linear-gradient(135deg,${accentColor},${hasMissingDocs ? '#dc2626' : '#00a664'});color:white;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:800;font-size:13px;letter-spacing:0.5px;box-shadow:0 4px 15px rgba(${hasMissingDocs ? '239,68,68' : '0,135,81'},0.3);">
              ${hasMissingDocs ? 'Fournir les documents →' : 'Suivre mon dossier →'}
            </a>
          </td></tr>
        </table>
    `, 'fr')
        },
    }
}
