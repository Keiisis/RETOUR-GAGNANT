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
        tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' }
    })
}

export interface EmailAttachment {
    filename: string
    content: string // base64 (avec ou sans prefixe data:...;base64,)
    contentType?: string
}

export async function sendEmail(options: {
    to: string
    subject: string
    html: string
    replyTo?: string
    context?: string
    relatedId?: string
    attachments?: EmailAttachment[]
}): Promise<{ success: boolean; error?: string }> {
    try {
        const config = await getEmailConfig()
        const transporter = await createTransporter()

        if (!transporter) {
            return { success: false, error: 'SMTP non configuré. Allez dans Admin > Paramètres > Email.' }
        }

        // Transforme les attachments base64 en buffers pour nodemailer
        const mailAttachments = (options.attachments || []).map(a => {
            const raw = a.content.includes(',') ? a.content.split(',')[1] : a.content
            return {
                filename: a.filename,
                content: Buffer.from(raw, 'base64'),
                contentType: a.contentType,
            }
        })

        const info = await transporter.sendMail({
            from: `"${config.fromName}" <${config.fromEmail}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            replyTo: options.replyTo || config.fromEmail,
            ...(mailAttachments.length ? { attachments: mailAttachments } : {}),
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
const LOGO_URL = `${SITE_URL}/assets/logo.png`
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

/** Bouton CTA « bulletproof » (rendu correct jusque dans Outlook via VML). */
export function emailButton(href: string, label: string, color: string = '#008751'): string {
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px auto 6px;"><tr><td align="center" bgcolor="${color}" style="border-radius:14px;">
      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:300px;" arcsize="28%" fillcolor="${color}" stroke="f"><w:anchorlock/><center style="color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:bold;">${label}</center></v:roundrect><![endif]-->
      <!--[if !mso]><!-- --><a href="${href}" style="display:inline-block;padding:14px 34px;border-radius:14px;background:${color};color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;">${label}</a><!--<![endif]-->
    </td></tr></table>`
}

/** Carte récapitulative / reçu : lignes [libellé, valeur]. */
export function emailInfoCard(rows: Array<[string, string]>): string {
    const trs = rows.map(([k, v]) => `<tr><td style="padding:9px 0;font-size:13px;color:#5A6680;border-bottom:1px solid #EEF1F6;">${k}</td><td style="padding:9px 0;font-size:13px;color:#1B2A4A;font-weight:700;text-align:right;border-bottom:1px solid #EEF1F6;">${v}</td></tr>`).join('')
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9FC;border:1px solid #E8ECF3;border-radius:14px;margin:18px 0;padding:6px 18px;">${trs}</table>`
}

export const EMAIL_WRAPPER = async (content: string, lang: string = 'fr', opts?: { preheader?: string; accent?: string; heroTitle?: string; heroEmoji?: string }) => {
    const t = getI18n(lang)
    const isRtl = resolveLocale(lang) === 'ar'
    const accent = opts?.accent || '#008751'
    const preheaderHtml = opts?.preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;font-size:1px;line-height:1px;color:#FFFFFF;">${opts.preheader}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>`
        : ''
    const heroBand = opts?.heroTitle
        ? `<tr><td bgcolor="${accent}" style="background:${accent};padding:30px 44px;text-align:center;">
            ${opts.heroEmoji ? `<div style="font-size:34px;line-height:1;margin-bottom:8px;">${opts.heroEmoji}</div>` : ''}
            <h2 style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:23px;font-weight:800;color:#FFFFFF;letter-spacing:0.3px;">${opts.heroTitle}</h2>
          </td></tr>`
        : ''

    // Fetch dynamic email template from ERP settings
    const emailTpl = await getEmailTemplate()

    // Footer institutionnel
    const footerContent = emailTpl.footer
        ? `<p style="margin:0 0 6px;font-size:11px;color:#5A6680;font-weight:600;letter-spacing:0.3px;">${emailTpl.footer.replace(/\n/g, '<br/>')}</p>`
        : `<p style="margin:0 0 6px;font-size:11px;color:#5A6680;font-weight:600;letter-spacing:0.3px;">${t.sentBy}</p>`

    return `<!DOCTYPE html>
<html lang="${resolveLocale(lang)}" ${isRtl ? 'dir="rtl"' : ''}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Retour Gagnant Bénin</title>
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
</head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;-webkit-font-smoothing:antialiased;color:#1B2A4A;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;padding:32px 16px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(27,42,74,0.10),0 4px 16px rgba(27,42,74,0.05);border:1px solid rgba(27,42,74,0.06);">

        <!-- ══════ FLAG STRIPE TOP ══════ -->
        <tr><td bgcolor="#008751" style="height:5px;background:linear-gradient(90deg,#008751 0%,#008751 33%,#FCD116 33%,#FCD116 66%,#E8112D 66%,#E8112D 100%);"></td></tr>

        <!-- ══════ HEADER BLANC — Logo à gauche + Nom à droite ══════ -->
        <tr><td style="padding:44px 44px 36px;background:#FFFFFF;">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <!-- Logo à gauche -->
              <td style="vertical-align:middle;padding-right:26px;">
                <img src="${LOGO_URL}" alt="Retour Gagnant Bénin" width="120" height="120" style="display:block;border:0;outline:0;max-width:120px;height:auto;" />
              </td>
              <!-- Nom à droite : RETOUR GAGNANT + BÉNIN en dessous -->
              <td style="vertical-align:middle;text-align:left;border-left:1px solid rgba(201,168,76,0.25);padding-left:26px;">
                <!-- RETOUR GAGNANT — ligne 1 -->
                <h1 style="margin:0;font-size:30px;font-weight:900;letter-spacing:2px;line-height:1;font-family:'Playfair Display','Segoe UI',Georgia,serif;white-space:nowrap;">
                  <span style="color:#008751;text-shadow:0 2px 18px rgba(0,135,81,0.22);">RETOUR</span>
                  <span style="color:#E6B800;text-shadow:0 2px 18px rgba(252,209,22,0.32);margin-left:8px;">GAGNANT</span>
                </h1>
                <!-- BÉNIN — ligne 2 sous RETOUR -->
                <div style="margin-top:9px;">
                  <span style="display:inline-block;font-size:22px;font-weight:900;letter-spacing:12px;color:#E8112D;text-shadow:0 2px 16px rgba(232,17,45,0.28);font-family:'Playfair Display','Segoe UI',Georgia,serif;padding-left:12px;">BÉNIN</span>
                </div>
                <!-- Tagline institutionnelle sous le nom -->
                <p style="margin:10px 0 0;font-size:9px;color:#C9A84C;letter-spacing:3.5px;text-transform:uppercase;font-weight:700;">Tradition · Modernité · Excellence</p>
              </td>
            </tr>
          </table>
          <!-- Accent or en bas du header -->
          <div style="margin:28px auto 0;height:2px;width:140px;background:linear-gradient(90deg,transparent,#C9A84C,transparent);"></div>
        </td></tr>

        ${heroBand}

        <!-- ══════ CONTENT ══════ -->
        <tr><td style="padding:24px 44px 40px;background:#FFFFFF;color:#1B2A4A;">
          ${content}
        </td></tr>

        <!-- ══════ SÉPARATEUR ORNEMENT ══════ -->
        <tr><td style="padding:0 44px;background:#FFFFFF;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.3),transparent);"></td>
            <td width="40" style="text-align:center;padding:0 12px;">
              <span style="display:inline-block;width:6px;height:6px;background:#C9A84C;border-radius:50%;box-shadow:0 0 10px rgba(201,168,76,0.5);"></span>
            </td>
            <td style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.3),transparent);"></td>
          </tr></table>
        </td></tr>

        <!-- ══════ FOOTER ══════ -->
        <tr><td style="padding:26px 44px 28px;text-align:center;background:#FFFFFF;">
          ${footerContent}
          <p style="margin:0 0 14px;font-size:11.5px;color:#5A6680;">
            ${t.replyTo} <a href="mailto:${CONTACT_EMAIL}" style="color:#008751;text-decoration:none;font-weight:700;border-bottom:1px solid rgba(0,135,81,0.3);">${CONTACT_EMAIL}</a>
          </p>
          <!-- Mini drapeau décoratif -->
          <table cellpadding="0" cellspacing="0" style="margin:16px auto 14px;">
            <tr>
              <td style="width:26px;height:3px;background:#008751;border-radius:2px 0 0 2px;"></td>
              <td style="width:26px;height:3px;background:#FCD116;"></td>
              <td style="width:26px;height:3px;background:#E8112D;border-radius:0 2px 2px 0;"></td>
            </tr>
          </table>
          <p style="margin:0 0 4px;font-size:10.5px;color:#6B7589;letter-spacing:0.4px;font-weight:600;">${t.footer}</p>
          <p style="margin:0;font-size:9.5px;color:#A9B0BE;letter-spacing:0.2px;">${t.autoSent}</p>
        </td></tr>

        <!-- ══════ FLAG STRIPE BOTTOM ══════ -->
        <tr><td bgcolor="#008751" style="height:5px;background:linear-gradient(90deg,#008751 0%,#008751 33%,#FCD116 33%,#FCD116 66%,#E8112D 66%,#E8112D 100%);"></td></tr>

      </table>

      <!-- Signature sous la carte -->
      <table cellpadding="0" cellspacing="0" style="margin-top:18px;">
        <tr><td style="text-align:center;">
          <p style="margin:0;font-size:10px;color:rgba(27,42,74,0.35);letter-spacing:2px;text-transform:uppercase;font-weight:600;">
            🇧🇯&nbsp;&nbsp;Retour Gagnant Bénin&nbsp;·&nbsp;${new Date().getFullYear()}
          </p>
        </td></tr>
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
        <p style="margin:0 0 18px;font-size:15px;color:#3E4A65;line-height:1.7;">Bonjour <strong style="color:#1B2A4A;">${clientName}</strong>,</p>
        <p style="color:#3E4A65;font-size:14.5px;line-height:1.8;margin:0 0 22px;">
            ${t.received}
        </p>
        <div style="background:#F4FAF6;border-left:3px solid #008751;padding:18px 22px;border-radius:0 12px 12px 0;margin:0 0 26px;">
            <p style="margin:0;font-size:13.5px;color:#3E4A65;font-style:italic;line-height:1.75;">${aiMessage}</p>
        </div>
        <p style="color:#5A6680;font-size:13.5px;line-height:1.75;margin:0 0 28px;">
            ${t.expertContact}
        </p>
        ${emailButton(`${SITE_URL}/rendez-vous`, t.bookBtn)}
    `, locale, { heroEmoji: '🤝', heroTitle: t.thankYou, preheader: t.received, accent: '#008751' }),

        /** Confirmation de demande de RDV — sans CTA "réserver" (redondant et illogique) */
        rdvConfirmation: (clientName: string, service: string, date: string | null, timeSlot: string, contactMethod: string, aiMessage: string, clientMessage: string = '') => EMAIL_WRAPPER(`
        <p style="margin:0 0 18px;font-size:15px;color:#3E4A65;line-height:1.7;">Bonjour <strong style="color:#1B2A4A;">${clientName}</strong>,</p>
        <p style="color:#3E4A65;font-size:14.5px;line-height:1.8;margin:0 0 22px;">
            Votre demande de rendez-vous a bien été enregistrée. Votre agent va l'examiner et vous confirmera le créneau très prochainement.
        </p>
        <div style="background:#FAF6EC;border:1px solid rgba(201,168,76,0.25);border-radius:14px;padding:20px 22px;margin:0 0 22px;">
            <p style="margin:0 0 14px;font-size:11px;font-weight:800;color:#8B94A6;text-transform:uppercase;letter-spacing:0.18em;">Récapitulatif de votre demande</p>
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="padding:7px 0;color:#8B94A6;font-size:12px;width:130px;">Service</td>
                    <td style="padding:7px 0;color:#1B2A4A;font-size:13.5px;font-weight:700;">${service}</td>
                </tr>
                <tr>
                    <td style="padding:7px 0;color:#8B94A6;font-size:12px;">Date souhaitée</td>
                    <td style="padding:7px 0;color:#1B2A4A;font-size:13px;">${date ? new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'À confirmer par votre agent'}</td>
                </tr>
                <tr>
                    <td style="padding:7px 0;color:#8B94A6;font-size:12px;">Créneau</td>
                    <td style="padding:7px 0;color:#1B2A4A;font-size:13px;">${timeSlot || 'Selon disponibilité'}</td>
                </tr>
                <tr>
                    <td style="padding:7px 0;color:#8B94A6;font-size:12px;">Mode de contact</td>
                    <td style="padding:7px 0;color:#1B2A4A;font-size:13px;">${contactMethod || 'À définir'}</td>
                </tr>
                ${clientMessage && clientMessage.trim() ? `<tr>
                    <td style="padding:7px 0;color:#8B94A6;font-size:12px;vertical-align:top;">Votre message</td>
                    <td style="padding:7px 0;color:#1B2A4A;font-size:13px;font-style:italic;">${clientMessage.trim().replace(/</g, '&lt;')}</td>
                </tr>` : ''}
            </table>
        </div>
        <div style="background:#F4FAF6;border-left:3px solid #008751;padding:18px 22px;border-radius:0 12px 12px 0;margin:0 0 22px;">
            <p style="margin:0;font-size:13.5px;color:#3E4A65;line-height:1.75;white-space:pre-wrap;">${aiMessage}</p>
        </div>
        <div style="background:#FFFBEB;border:1px solid rgba(201,168,76,0.3);border-radius:12px;padding:14px 18px;text-align:center;">
            <p style="margin:0;font-size:12.5px;color:#5A6680;line-height:1.65;">
                ⏱&nbsp; Votre agent vous confirmera ce rendez-vous sous <strong style="color:#1B2A4A;">24h</strong>.<br/>
                Vous recevrez un email de confirmation avec tous les détails.
            </p>
        </div>
    `, locale, { heroEmoji: '✅', heroTitle: 'Demande de rendez-vous reçue', preheader: 'Votre demande a bien été enregistrée — un agent vous confirme le créneau sous 24 h.', accent: '#008751' }),

        /** Notification to agents/admin for new lead */
        newLeadNotification: (leadName: string, leadEmail: string, score: number, service: string, source: string) => EMAIL_WRAPPER(`
        <h2 style="margin:0 0 18px;font-size:22px;color:#1B2A4A;font-weight:800;letter-spacing:-0.3px;">🔔 ${t.newLead} — ${source}</h2>
        <table style="width:100%;border-collapse:collapse;margin:0 0 26px;">
            <tr>
              <td style="padding:11px 0;color:#8B94A6;font-size:13px;border-bottom:1px solid rgba(27,42,74,0.08);width:110px;">${t.name}</td>
              <td style="padding:11px 0;color:#1B2A4A;font-size:13.5px;font-weight:700;border-bottom:1px solid rgba(27,42,74,0.08);">${leadName}</td>
            </tr>
            <tr>
              <td style="padding:11px 0;color:#8B94A6;font-size:13px;border-bottom:1px solid rgba(27,42,74,0.08);">${t.email}</td>
              <td style="padding:11px 0;color:#1B2A4A;font-size:13px;border-bottom:1px solid rgba(27,42,74,0.08);">${leadEmail}</td>
            </tr>
            <tr>
              <td style="padding:11px 0;color:#8B94A6;font-size:13px;border-bottom:1px solid rgba(27,42,74,0.08);">${t.score}</td>
              <td style="padding:11px 0;color:${score >= 70 ? '#008751' : '#C9A84C'};font-size:22px;font-weight:900;border-bottom:1px solid rgba(27,42,74,0.08);">${score}%</td>
            </tr>
            <tr>
              <td style="padding:11px 0;color:#8B94A6;font-size:13px;">${t.service}</td>
              <td style="padding:11px 0;color:#1B2A4A;font-size:13.5px;font-weight:700;">${service}</td>
            </tr>
        </table>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr><td>
            <a href="${SITE_URL}/agent/leads" style="display:inline-block;background:linear-gradient(135deg,#C9A84C,#B89538);color:#FFFFFF;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:800;font-size:13px;box-shadow:0 6px 18px rgba(201,168,76,0.32);">
              ${t.viewDashboard}
            </a>
          </td></tr>
        </table>
    `, 'fr'),

        /** Notification admin — nouvelle demande de RDV (sans score Oracle) */
        rdvAdminNotification: (clientName: string, clientEmail: string, service: string, date: string | null, timeSlot: string, contactMethod: string, telephone: string = '', clientMessage: string = '', aiReply: string = '') => EMAIL_WRAPPER(`
        <h2 style="margin:0 0 18px;font-size:22px;color:#1B2A4A;font-weight:800;letter-spacing:-0.3px;">📅 Nouvelle demande de RDV</h2>
        <table style="width:100%;border-collapse:collapse;margin:0 0 22px;">
            <tr>
              <td style="padding:11px 0;color:#8B94A6;font-size:13px;border-bottom:1px solid rgba(27,42,74,0.08);width:140px;">Client</td>
              <td style="padding:11px 0;color:#1B2A4A;font-size:13.5px;font-weight:700;border-bottom:1px solid rgba(27,42,74,0.08);">${clientName}</td>
            </tr>
            <tr>
              <td style="padding:11px 0;color:#8B94A6;font-size:13px;border-bottom:1px solid rgba(27,42,74,0.08);">Email</td>
              <td style="padding:11px 0;color:#1B2A4A;font-size:13px;border-bottom:1px solid rgba(27,42,74,0.08);"><a href="mailto:${clientEmail}" style="color:#008751;text-decoration:none;">${clientEmail}</a></td>
            </tr>
            <tr>
              <td style="padding:11px 0;color:#8B94A6;font-size:13px;border-bottom:1px solid rgba(27,42,74,0.08);">Téléphone / WhatsApp</td>
              <td style="padding:11px 0;color:#1B2A4A;font-size:13px;font-weight:700;border-bottom:1px solid rgba(27,42,74,0.08);">${telephone ? telephone.replace(/</g, '&lt;') : 'Non communiqué'}</td>
            </tr>
            <tr>
              <td style="padding:11px 0;color:#8B94A6;font-size:13px;border-bottom:1px solid rgba(27,42,74,0.08);">Service demandé</td>
              <td style="padding:11px 0;color:#1B2A4A;font-size:13.5px;font-weight:700;border-bottom:1px solid rgba(27,42,74,0.08);">${service}</td>
            </tr>
            <tr>
              <td style="padding:11px 0;color:#8B94A6;font-size:13px;border-bottom:1px solid rgba(27,42,74,0.08);">Date souhaitée</td>
              <td style="padding:11px 0;color:#1B2A4A;font-size:13px;border-bottom:1px solid rgba(27,42,74,0.08);">${date || 'À définir'}</td>
            </tr>
            <tr>
              <td style="padding:11px 0;color:#8B94A6;font-size:13px;border-bottom:1px solid rgba(27,42,74,0.08);">Créneau</td>
              <td style="padding:11px 0;color:#1B2A4A;font-size:13px;border-bottom:1px solid rgba(27,42,74,0.08);">${timeSlot || 'Non précisé'}</td>
            </tr>
            <tr>
              <td style="padding:11px 0;color:#8B94A6;font-size:13px;">Mode de contact</td>
              <td style="padding:11px 0;color:#1B2A4A;font-size:13px;">${contactMethod || 'Non précisé'}</td>
            </tr>
        </table>
        ${clientMessage && clientMessage.trim() ? `<div style="background:#FAF6EC;border:1px solid rgba(201,168,76,0.25);border-radius:12px;padding:16px 18px;margin:0 0 18px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:800;color:#8B94A6;text-transform:uppercase;letter-spacing:0.15em;">📝 Message du client</p>
            <p style="margin:0;font-size:13.5px;color:#1B2A4A;line-height:1.7;white-space:pre-wrap;">${clientMessage.trim().replace(/</g, '&lt;')}</p>
        </div>` : ''}
        ${aiReply && aiReply.trim() ? `<div style="background:#F4FAF6;border-left:3px solid #008751;padding:14px 18px;border-radius:0 10px 10px 0;margin:0 0 24px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#008751;text-transform:uppercase;letter-spacing:0.15em;">🤖 Réponse automatique déjà envoyée au client</p>
            <p style="margin:0;font-size:12.5px;color:#3E4A65;line-height:1.7;white-space:pre-wrap;">${aiReply.trim().replace(/</g, '&lt;')}</p>
        </div>` : ''}
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr><td>
            <a href="${SITE_URL}/agent/agenda" style="display:inline-block;background:linear-gradient(135deg,#C9A84C,#B89538);color:#FFFFFF;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:800;font-size:13px;box-shadow:0 6px 18px rgba(201,168,76,0.32);">
              Voir dans l'Agenda
            </a>
          </td></tr>
        </table>
    `, 'fr'),

        /** Agent reply email — sent from chat console */
        agentReply: (clientName: string, agentMessage: string, language: string = 'fr') => EMAIL_WRAPPER(`
        <h2 style="margin:0 0 22px;font-size:22px;color:#1B2A4A;font-weight:800;letter-spacing:-0.3px;">${getI18n(language).hello} ${clientName},</h2>
        <div style="color:#2D3A55;font-size:14.5px;line-height:1.9;margin:0 0 20px;white-space:pre-wrap;">${agentMessage}</div>
        <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.3),transparent);margin:28px 0 20px;"></div>
        <p style="margin:0;font-size:12.5px;color:#5A6680;line-height:1.7;">
            Cordialement,<br/>
            <strong style="color:#1B2A4A;">L'équipe Retour Gagnant Bénin</strong>
        </p>
    `, language),

        /** Invitation à créer un compte — après capture d'un prospect nationalité */
        accountInvite: (clientName: string, registerUrl: string) => EMAIL_WRAPPER(`
        <p style="margin:0 0 18px;font-size:15px;color:#3E4A65;line-height:1.7;">Bonjour <strong style="color:#1B2A4A;">${clientName}</strong>,</p>
        <p style="color:#3E4A65;font-size:14.5px;line-height:1.8;margin:0 0 20px;">
            Nous avons bien reçu votre intérêt pour la reconnaissance de la nationalité béninoise. Votre dossier est en cours de préparation — vous pouvez <strong style="color:#1B2A4A;">continuer votre démarche</strong> dès maintenant sur notre site.
        </p>
        <div style="background:#F4FAF6;border-left:3px solid #008751;padding:18px 22px;border-radius:0 12px 12px 0;margin:0 0 26px;">
            <p style="margin:0 0 8px;font-size:13.5px;color:#008751;font-weight:700;">Votre espace personnel vous attend</p>
            <p style="margin:0;font-size:13.5px;color:#3E4A65;line-height:1.75;">
                Créer votre compte vous permet de suivre l'avancement de votre dossier, d'échanger avec votre conseiller et de téléverser vos pièces en toute sécurité.
            </p>
        </div>
        ${emailButton(registerUrl, 'Créer mon compte sécurisé')}
        <p style="color:#8B94A6;font-size:12.5px;line-height:1.7;margin:14px 0 0;text-align:center;">
            Pas de pression — cette invitation ne bloque en rien votre démarche.<br/>
            Vous pouvez créer votre compte avant, pendant, ou après la soumission de votre dossier.
        </p>
    `, 'fr', { heroEmoji: '🇧🇯', heroTitle: 'Bienvenue chez Retour Gagnant', preheader: 'Créez votre espace pour suivre votre dossier et échanger avec votre conseiller.', accent: '#008751' }),

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
            let accentColor = '#C9A84C'
            let title = 'Rappel de paiement'
            let intro = ''
            let closing = ''

            if (daysOverdue <= 10) {
                level = 'friendly'
                emoji = '📋'
                accentColor = '#C9A84C'
                title = 'Petit rappel concernant votre facture'
                intro = `Nous espérons que tout va bien de votre côté ! Nous souhaitons simplement vous rappeler que la facture <strong>${invoiceNumero}</strong> d'un montant de <strong>${montant} ${currency}</strong> est en attente de règlement.`
                closing = 'N\'hésitez pas à nous contacter si vous avez la moindre question. Nous restons entièrement à votre disposition !'
            } else if (daysOverdue <= 25) {
                level = 'firm'
                emoji = '⏳'
                accentColor = '#d97706'
                title = 'Rappel — Facture en attente de règlement'
                intro = `Nous nous permettons de revenir vers vous concernant la facture <strong>${invoiceNumero}</strong> d'un montant de <strong>${montant} ${currency}</strong>, émise il y a ${daysOverdue} jours et toujours en attente de règlement.`
                closing = 'Nous vous serions reconnaissants de procéder au règlement dans les meilleurs délais, ou de nous contacter si un arrangement est nécessaire.'
            } else {
                level = 'formal'
                emoji = '🔴'
                accentColor = '#dc2626'
                title = 'Dernier rappel — Facture impayée'
                intro = `Malgré nos précédents rappels, la facture <strong>${invoiceNumero}</strong> d'un montant de <strong>${montant} ${currency}</strong> reste impayée depuis ${daysOverdue} jours. Nous vous prions de bien vouloir procéder au règlement dans les plus brefs délais.`
                closing = 'Sans règlement de votre part sous 7 jours, nous serons contraints d\'envisager des mesures complémentaires. Nous restons disponibles pour toute discussion amiable.'
            }

            const urgencyBadge = level === 'formal'
                ? `<div style="background:#FEF2F2;border:1px solid rgba(220,38,38,0.25);border-radius:8px;padding:12px 16px;margin:0 0 22px;text-align:center;">
                     <span style="color:#dc2626;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">⚠️ DERNIER RAPPEL — ACTION REQUISE</span>
                   </div>`
                : ''

            return EMAIL_WRAPPER(`
        ${urgencyBadge}
        <p style="color:#3E4A65;font-size:14.5px;line-height:1.8;margin:0 0 10px;">
            Bonjour <strong style="color:#1B2A4A;">${clientName}</strong>,
        </p>
        <p style="color:#3E4A65;font-size:14px;line-height:1.8;margin:0 0 26px;">
            ${intro}
        </p>

        <div style="background:#FAF6EC;border:1px solid rgba(201,168,76,0.22);border-radius:14px;padding:22px;margin:0 0 26px;">
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="padding:9px 0;color:#8B94A6;font-size:12px;text-transform:uppercase;letter-spacing:1px;">N° Facture</td>
                    <td style="padding:9px 0;text-align:right;color:#1B2A4A;font-size:14px;font-weight:700;font-family:monospace;">${invoiceNumero}</td>
                </tr>
                <tr>
                    <td style="padding:9px 0;color:#8B94A6;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-top:1px solid rgba(27,42,74,0.08);">Montant dû</td>
                    <td style="padding:9px 0;text-align:right;color:${accentColor};font-size:22px;font-weight:900;border-top:1px solid rgba(27,42,74,0.08);">${montant} ${currency}</td>
                </tr>
                <tr>
                    <td style="padding:9px 0;color:#8B94A6;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-top:1px solid rgba(27,42,74,0.08);">Retard</td>
                    <td style="padding:9px 0;text-align:right;color:${level === 'formal' ? '#dc2626' : '#5A6680'};font-size:13px;font-weight:600;border-top:1px solid rgba(27,42,74,0.08);">${daysOverdue} jours</td>
                </tr>
            </table>
        </div>

        <p style="color:#5A6680;font-size:13px;line-height:1.75;margin:0 0 26px;">
            ${closing}
        </p>

        ${portalUrl ? emailButton(portalUrl, 'Consulter ma facture', accentColor) : ''}
    `, 'fr', { heroEmoji: emoji, heroTitle: title, accent: accentColor, preheader: intro })
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
            const accentColor = hasMissingDocs ? '#dc2626' : '#008751';
            const icon = hasMissingDocs ? '⚠️' : '🔄';

            let docsHtml = '';
            if (hasMissingDocs) {
                docsHtml = `
                <div style="background:#FEF2F2;border:1px solid rgba(220,38,38,0.25);border-radius:12px;padding:20px;margin:24px 0;">
                    <h3 style="margin:0 0 12px;color:#dc2626;font-size:13.5px;text-transform:uppercase;letter-spacing:1px;font-weight:800;">Documents Requis d'Urgence</h3>
                    <ul style="margin:0;padding-left:20px;color:#3E4A65;font-size:14px;line-height:1.7;">
                        ${documentsManquants.map(doc => `<li style="margin-bottom:6px;"><strong style="color:#1B2A4A;">${doc}</strong></li>`).join('')}
                    </ul>
                </div>`;
            }

            return EMAIL_WRAPPER(`
        <p style="color:#3E4A65;font-size:15px;line-height:1.7;margin:0 0 18px;">
            Bonjour <strong style="color:#1B2A4A;">${clientName}</strong>,
        </p>
        <p style="color:#3E4A65;font-size:14px;line-height:1.8;margin:0 0 22px;">
            ${message}
        </p>

        <div style="background:#FAF6EC;border:1px solid rgba(201,168,76,0.22);border-radius:14px;padding:22px;margin:0 0 20px;">
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="padding:9px 0;color:#8B94A6;font-size:12px;text-transform:uppercase;letter-spacing:1px;">N° Dossier</td>
                    <td style="padding:9px 0;text-align:right;color:#1B2A4A;font-size:14px;font-weight:700;font-family:monospace;">${dossierNumero}</td>
                </tr>
                <tr>
                    <td style="padding:9px 0;color:#8B94A6;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-top:1px solid rgba(27,42,74,0.08);">Progression</td>
                    <td style="padding:9px 0;text-align:right;color:#C9A84C;font-size:18px;font-weight:900;border-top:1px solid rgba(27,42,74,0.08);">${progression}%</td>
                </tr>
            </table>
        </div>

        ${docsHtml}

        ${emailButton(trackerUrl, hasMissingDocs ? 'Fournir les documents' : 'Suivre mon dossier', accentColor)}
    `, 'fr', { heroEmoji: icon, heroTitle: title, accent: accentColor, preheader: hasMissingDocs ? 'Des documents sont requis pour faire avancer votre dossier.' : 'Votre dossier a été mis à jour.' })
        },
    }
}
