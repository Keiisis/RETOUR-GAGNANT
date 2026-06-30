import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyApiAuth } from '@/lib/api-auth';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
    try {
        // 🛡️ SECURITY: Require 'admin' role
        const auth = await verifyApiAuth(request, 'admin');
        if (!auth.authenticated) return auth.error!;

        const body = await request.json();
        const { email } = body;

        // 1. Fetch email settings from Supabase
        const { data: settingsData } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_email', 'smtp_from_name']);

        const settings: Record<string, string> = {};
        for (const s of settingsData || []) settings[s.key] = s.value;

        if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
            return NextResponse.json({ success: false, error: "Identifiants SMTP manquants dans la base de données." }, { status: 400 });
        }

        // 2. Transporter configuration
        const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: Number(settings.smtp_port) || 465,
            secure: Number(settings.smtp_port) === 465,
            auth: {
                user: settings.smtp_user,
                pass: settings.smtp_pass
            },
            tls: {
                rejectUnauthorized: process.env.NODE_ENV === 'production'
            }
        });

        const fromString = `"${settings.smtp_from_name || 'Retour Gagnant Bénin'}" <${settings.smtp_from_email || settings.smtp_user}>`;

        // 3. Send test email
        const info = await transporter.sendMail({
            from: fromString,
            replyTo: settings.smtp_from_email,
            to: email || settings.smtp_user,
            subject: "Système de Messagerie - Test de Configuration",
            html: `
            <div style="font-family: Arial, sans-serif; background: #f8f9fa; padding: 40px; color: #1a1a1a;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 16px; border-top: 5px solid #3b82f6;">
                    <h2 style="margin-top: 0; color: #3b82f6; font-size: 24px;">Authentification Réussie</h2>
                    <p style="font-size: 16px; line-height: 1.6; color: #333;">
                        Félicitations ! Le système SMTP de votre tableau de bord Retour Gagnant communique parfaitement avec Nodemailer.
                    </p>
                    <p style="font-size: 14px; color: #666; background: #f0f4f8; padding: 16px; border-radius: 8px;">
                        <strong>Hôte :</strong> ${settings.smtp_host}<br>
                        <strong>Port :</strong> ${settings.smtp_port}<br>
                        <strong>Compte d'envoi :</strong> ${settings.smtp_user}
                    </p>
                    <p style="font-size: 12px; color: #999; margin-top: 30px; text-align: center;">
                        Ceci est un message automatisé généré par Retour Gagnant Bénin.
                    </p>
                </div>
            </div>`
        });

        return NextResponse.json({ success: true, messageId: info.messageId });
    } catch (e) {
        console.error("Test email error", e);
        const message = e instanceof Error ? e.message : "Erreur de connexion SMTP"
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
