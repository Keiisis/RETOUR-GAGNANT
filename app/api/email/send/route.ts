import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, EMAIL_TEMPLATES } from '@/lib/email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * POST /api/email/send
 * 
 * Send emails from agent/admin dashboard.
 * Body: { to, subject, message, clientName, context, relatedId }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { to, subject, message, clientName, context, relatedId } = body;

        if (!to || !message) {
            return NextResponse.json({ error: 'Email et message requis.' }, { status: 400 });
        }

        // Generate the HTML based on context
        let html: string;
        if (context === 'agent_reply') {
            html = EMAIL_TEMPLATES.agentReply(clientName || 'Client', message);
        } else {
            html = EMAIL_TEMPLATES.agentReply(clientName || 'Client', message);
        }

        const result = await sendEmail({
            to,
            subject: subject || `Retour Gagnant — Réponse à votre demande`,
            html,
            context: context || 'agent_reply',
            relatedId: relatedId || '',
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Email envoyé avec succès !' });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur serveur'
        console.error('[EMAIL SEND] Error:', message);
        return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
    }
}
