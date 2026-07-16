import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, getEmailTemplates } from '@/lib/email';

export async function POST(req: NextRequest) {
    try {
        const { rdvId, clientEmail, clientName, message } = await req.json();

        if (!clientEmail || !message?.trim()) {
            return NextResponse.json({ error: 'Email et message sont requis.' }, { status: 400 });
        }

        const templates = await getEmailTemplates('fr');

        const result = await sendEmail({
            to: clientEmail,
 subject: `Retour Gagnant — Réponse à votre demande de rendez-vous`,
            html: await templates.agentReply(clientName || clientEmail, message.trim(), 'fr'),
            context: 'rdv_reply',
            relatedId: rdvId || undefined,
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Échec de l\'envoi.' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[RDV REPLY]', error);
        return NextResponse.json({ error: 'Erreur lors de l\'envoi.' }, { status: 500 });
    }
}
