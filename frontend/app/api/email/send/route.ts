import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { sendEmail, getEmailTemplates } from '@/lib/email'

/**
 * POST /api/email/send
 *
 * Send emails from agent/admin dashboard.
 * Body: { to, subject, message, clientName, context, relatedId, language }
 */
export async function POST(req: NextRequest) {
    const auth = await verifyApiAuth(req, 'agent')
    if (!auth.authenticated) return auth.error!

    try {
        const body = await req.json()
        const { to, subject, message, clientName, context, relatedId, language } = body

        if (!to || !message) {
            return NextResponse.json({ error: 'Email et message requis.' }, { status: 400 })
        }

        // Validation email + protection injection SMTP
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
            return NextResponse.json({ error: 'Email destinataire invalide.' }, { status: 400 })
        }
        if (/[\r\n]/.test(to) || (subject && /[\r\n]/.test(subject))) {
            return NextResponse.json({ error: 'Caractères non autorisés dans les champs email.' }, { status: 400 })
        }

        // Résoudre la langue : priorité au paramètre 'language', sinon 'fr'
        const emailLang = language || 'fr'

        // Générer le HTML dans la bonne langue
        const templates = await getEmailTemplates(emailLang)

        let html: string
        if (context === 'agent_reply') {
            html = await templates.agentReply(clientName || 'Client', message, emailLang)
        } else if (context === 'auto_reply') {
            html = await templates.autoReply(clientName || 'Client', message)
        } else {
            html = await templates.agentReply(clientName || 'Client', message, emailLang)
        }

        const result = await sendEmail({
            to,
            subject: subject || `Retour Gagnant — Réponse à votre demande`,
            html,
            context: context || 'agent_reply',
            relatedId: relatedId || '',
        })

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Email envoyé avec succès !' })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur serveur'
        console.error('[EMAIL SEND] Error:', message)
        return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
    }
}
