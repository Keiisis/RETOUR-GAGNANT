import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export interface EmailConfig {
    host: string;
    port: number;
    user: string;
    pass: string;
    fromName: string;
    fromEmail: string;
    adminEmail: string;
}

/**
 * Fetch SMTP email configuration from the `settings` table in Supabase.
 * Falls back to safe defaults if not configured yet.
 */
export async function getEmailConfig(): Promise<EmailConfig> {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
        .from('settings')
        .select('key, value')
        .eq('category', 'email');

    const map: Record<string, string> = {};
    (data || []).forEach((row: { key: string; value: string }) => {
        map[row.key] = row.value;
    });

    return {
        host: map['smtp_host'] || '',
        port: parseInt(map['smtp_port'] || '587'),
        user: map['smtp_user'] || '',
        pass: map['smtp_pass'] || '',
        fromName: map['smtp_from_name'] || 'Retour Gagnant Bénin',
        fromEmail: map['smtp_from_email'] || '',
        adminEmail: map['email_admin_destination'] || '',
    };
}

/**
 * Create a Nodemailer transporter from database config.
 * Returns null if SMTP is not configured yet.
 */
export async function createTransporter() {
    const config = await getEmailConfig();

    if (!config.host || !config.user || !config.pass) {
        console.log('[EMAIL] SMTP not configured yet — skipping email send.');
        return null;
    }

    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: {
            user: config.user,
            pass: config.pass,
        },
        tls: {
            rejectUnauthorized: false
        }
    });
}

/**
 * Send an email using the SMTP config from the database.
 * Logs the email to `email_logs` table for traceability.
 */
export async function sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
    context?: string;    // 'auto_reply' | 'agent_reply' | 'admin_notification' | 'lead_notification'
    relatedId?: string;  // ID of the message/lead this email is about
}): Promise<{ success: boolean; error?: string }> {
    try {
        const config = await getEmailConfig();
        const transporter = await createTransporter();

        if (!transporter) {
            return { success: false, error: 'SMTP non configuré. Allez dans Admin > Paramètres > Email.' };
        }

        const info = await transporter.sendMail({
            from: `"${config.fromName}" <${config.fromEmail}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            replyTo: options.replyTo || config.fromEmail,
        });

        // Log the email
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('email_logs').insert({
            to_email: options.to,
            subject: options.subject,
            body_html: options.html,
            context: options.context || 'manual',
            related_id: options.relatedId || null,
            status: 'sent',
            smtp_response: info.messageId || '',
        });

        return { success: true };
    } catch (err) {
        let errorMessage = 'Unknown error';
        if (err instanceof Error) {
            errorMessage = err.message;
        } else if (typeof err === 'string') {
            errorMessage = err;
        }
        console.error('[EMAIL] Send error:', errorMessage);

        // Log the failure
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('email_logs').insert({
            to_email: options.to,
            subject: options.subject,
            body_html: options.html,
            context: options.context || 'manual',
            related_id: options.relatedId || null,
            status: 'failed',
            smtp_response: errorMessage,
        });

        return { success: false, error: errorMessage };
    }
}

// ═══════════════════════════════════════════════════════
// EMAIL TEMPLATES — Bénin-themed, premium design
// ═══════════════════════════════════════════════════════

const EMAIL_WRAPPER = (content: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f141e;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" style="max-width:600px;margin:0 auto;background:#1a2332;border-radius:16px;overflow:hidden;">
    <!-- Flag header -->
    <tr><td style="height:4px;background:linear-gradient(to right,#008751,#FCD116,#E8112D);"></td></tr>
    <!-- Logo area -->
    <tr><td style="padding:30px 30px 10px;text-align:center;">
      <h1 style="margin:0;font-size:22px;color:#008751;font-weight:900;">RETOUR <span style="color:#E8112D;">GAGNANT</span></h1>
      <p style="margin:4px 0 0;font-size:10px;color:#666;letter-spacing:3px;text-transform:uppercase;">BÉNIN</p>
    </td></tr>
    <!-- Content -->
    <tr><td style="padding:20px 30px 30px;">
      ${content}
    </td></tr>
    <!-- Footer -->
    <tr><td style="padding:20px 30px;background:#0f141e;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
      <p style="margin:0;font-size:11px;color:#555;">© 2025 Retour Gagnant Bénin — Tradition, Modernité, Excellence</p>
      <p style="margin:6px 0 0;font-size:10px;color:#444;">Cet email a été envoyé automatiquement. Ne pas répondre directement.</p>
    </td></tr>
  </table>
</body>
</html>
`;

export const EMAIL_TEMPLATES = {
    /** Auto-reply sent to a client after they submit a contact/rdv/oracle form */
    autoReply: (clientName: string, aiMessage: string) => EMAIL_WRAPPER(`
        <h2 style="margin:0 0 15px;font-size:18px;color:#FCD116;">Merci ${clientName} 🤝</h2>
        <p style="color:#ccc;font-size:14px;line-height:1.7;margin:0 0 20px;">
            Nous avons bien reçu votre demande et notre équipe l'examine avec attention.
        </p>
        <div style="background:rgba(0,135,81,0.1);border-left:3px solid #008751;padding:15px 20px;border-radius:0 8px 8px 0;margin:0 0 20px;">
            <p style="margin:0;font-size:13px;color:#aaa;font-style:italic;line-height:1.6;">${aiMessage}</p>
        </div>
        <p style="color:#888;font-size:13px;line-height:1.6;margin:0 0 20px;">
            Un expert de notre équipe vous contactera dans les plus brefs délais pour un accompagnement personnalisé.
        </p>
        <a href="https://retour-gagnant.vercel.app/rendez-vous" style="display:inline-block;background:#008751;color:white;text-decoration:none;padding:12px 30px;border-radius:8px;font-weight:bold;font-size:13px;">Réserver un rendez-vous gratuit</a>
    `),

    /** Notification sent to agents/admin when a new lead arrives */
    newLeadNotification: (leadName: string, leadEmail: string, score: number, service: string, source: string) => EMAIL_WRAPPER(`
        <h2 style="margin:0 0 15px;font-size:18px;color:#FCD116;">🔔 Nouveau Lead — ${source}</h2>
        <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
            <tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);">Nom</td><td style="padding:8px 0;color:#fff;font-size:13px;font-weight:bold;border-bottom:1px solid rgba(255,255,255,0.05);">${leadName}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);">Email</td><td style="padding:8px 0;color:#fff;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);">${leadEmail}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);">Score</td><td style="padding:8px 0;color:${score >= 70 ? '#4ade80' : '#fbbf24'};font-size:18px;font-weight:900;border-bottom:1px solid rgba(255,255,255,0.05);">${score}%</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Service</td><td style="padding:8px 0;color:#FCD116;font-size:13px;font-weight:bold;">${service}</td></tr>
        </table>
        <a href="https://retour-gagnant.vercel.app/agent/leads" style="display:inline-block;background:#FCD116;color:#1a2332;text-decoration:none;padding:12px 30px;border-radius:8px;font-weight:bold;font-size:13px;">Voir dans le Dashboard Agent</a>
    `),

    /** Agent reply sent from the dashboard */
    agentReply: (clientName: string, agentMessage: string) => EMAIL_WRAPPER(`
        <h2 style="margin:0 0 15px;font-size:18px;color:#FCD116;">Bonjour ${clientName},</h2>
        <div style="color:#ccc;font-size:14px;line-height:1.8;margin:0 0 20px;white-space:pre-wrap;">${agentMessage}</div>
        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.05);margin:20px 0;" />
        <p style="color:#666;font-size:12px;margin:0;">
            Cet email vous a été envoyé par un conseiller de Retour Gagnant Bénin.<br/>
            Pour toute réponse, envoyez un email à contact@retour-gagnant.bj
        </p>
    `),
};
