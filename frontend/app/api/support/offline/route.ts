import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nom, prenom, email, whatsapp, message } = body;

    if (!nom || !prenom || !email || !whatsapp || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settingsData } = await supabase.from('settings').select('key, value').in('key', [
      'email_smtp_host', 'email_smtp_port', 'email_smtp_user', 'email_smtp_pass', 'email_from_name', 'email_from_email'
    ]);

    let smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    let smtpPort = 587;
    let smtpUser = process.env.SMTP_USER || '';
    let smtpPass = process.env.SMTP_PASS || '';
    let fromName = 'Retour Gagnant Bénin';
    let fromEmail = process.env.SMTP_FROM || '';

    if (settingsData && settingsData.length > 0) {
      settingsData.forEach(s => {
        if (s.key === 'email_smtp_host' && s.value) smtpHost = s.value;
        if (s.key === 'email_smtp_port' && s.value) smtpPort = parseInt(s.value, 10) || 587;
        if (s.key === 'email_smtp_user' && s.value) smtpUser = s.value;
        if (s.key === 'email_smtp_pass' && s.value) smtpPass = s.value;
        if (s.key === 'email_from_name' && s.value) fromName = s.value;
        if (s.key === 'email_from_email' && s.value) fromEmail = s.value;
      });
    }

    // 1. Sauvegarde dans la BD (Panel Admin / Section Messages)
    const { error: dbError } = await supabase.from('messages').insert({
      nom: nom,
      prenom: prenom,
      email: email,
      sujet: "Ticket Support (WhatsApp: " + whatsapp + ")",
      message: message,
      type: 'support',
      lu: false
    });

    if (dbError) throw dbError;

    // 2. Envoi du mail intelligent au client
    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
            </head>
            <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #05080a; margin: 0; padding: 0;">
              <div style="max-width: 600px; margin: 40px auto; background-color: #0f141e; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
                <div style="background: linear-gradient(135deg, #008751 0%, #004d2e 100%); padding: 50px 30px; text-align: center;">
                  <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 800; letter-spacing: 2px;">RETOUR <span style="color: #E8112D;">GAGNANT</span></h1>
                  <p style="color: #FCD116; font-family: monospace; letter-spacing: 5px; font-weight: 600; font-size: 11px; margin-top: 10px; text-transform: uppercase;">Assistance Premium Active</p>
                </div>
                <div style="padding: 40px 30px; color: #e5e7eb; line-height: 1.8;">
                  <h2 style="font-size: 20px; font-weight: 700; color: #008751; margin-bottom: 24px;">Votre demande a été enregistrée avec succès.</h2>
                  <p style="font-size: 15px;">Cher(e) <strong>${prenom} ${nom}</strong>,</p>
                  <p style="font-size: 15px;">Nous vous confirmons la bonne réception de votre demande d'assistance via l'intelligence artificielle du site. À l'instant de votre requête, nos agents étaient indisponibles en direct, néanmoins votre dossier a été immédiatement assigné en <strong>priorité absolue</strong>.</p>
                  
                  <div style="background: rgba(255,255,255,0.03); border-left: 4px solid #FCD116; padding: 24px; border-radius: 12px; margin: 35px 0; border-top: 1px solid rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <p style="margin: 0; font-size: 14px; color: #a3a8b4; font-style: italic;">" ${message} "</p>
                  </div>

                  <p style="font-size: 15px;">L'un de nos agents spécialisés va prendre le relais et vous répondra d'ici quelques minutes directement sur l'application WhatsApp au numéro : <strong style="color: #fff;">${whatsapp}</strong>.</p>
                  <p style="font-size: 15px; font-weight: 600; color: #FCD116; margin-top: 35px;">L'excellence de votre retour est notre engagement.<br><span style="color: #008751;">L'équipe Expertise Retour Gagnant</span></p>
                </div>
                <div style="text-align: center; padding: 25px 30px; background: rgba(0,0,0,0.5); border-top: 1px solid rgba(255,255,255,0.05);">
                  <p style="margin: 0; color: #666; font-size: 11px; letter-spacing: 1px; text-transform: uppercase;">© ${new Date().getFullYear()} Retour Gagnant Bénin. La symbiose de l'humain et de la technologie.</p>
                </div>
              </div>
            </body>
            </html>
            `;

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: "✨ [URGENT] Votre Super Assistance Retour Gagnant",
        html: emailHtml,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Support Offline Error:", error);
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
