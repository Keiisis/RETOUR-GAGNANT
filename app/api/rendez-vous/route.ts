import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, EMAIL_TEMPLATES, getEmailConfig } from '@/lib/email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Generate a personalized AI auto-reply using Groq
 */
async function generateAutoReply(clientName: string, service: string): Promise<string> {
    try {
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) return 'Votre demande de rendez-vous est confirmée. Notre équipe la prépare.';

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: `Tu es l'assistant de Retour Gagnant Bénin. Génère un court message personnalisé (2-3 phrases max) pour confirmer la réception d'une demande de rendez-vous pour le service donné. Sois chaleureux, rassurant et professionnel. Ne donne AUCUN prix et AUCUNE date (l'agent s'en chargera). NE PAS utiliser de markdown.`
                    },
                    {
                        role: 'user',
                        content: `Le client "${clientName}" a demandé un rendez-vous pour le service "${service}".`
                    }
                ],
                temperature: 0.7,
                max_tokens: 150,
            }),
        });

        const data = await res.json();
        return data.choices?.[0]?.message?.content || 'Votre demande de rendez-vous est confirmée.';
    } catch {
        return 'Nous avons bien reçu votre demande de rendez-vous et allons vous confirmer un créneau très prochainement.';
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { nom, prenom, email, telephone, service, message, date, timeSlot, contactMethod } = body;

        if (!nom || !email) {
            return NextResponse.json(
                { error: 'Nom et email sont requis.' },
                { status: 400 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const clientName = `${prenom || ''} ${nom}`.trim();
        const sujetRdv = `RDV (${service}) : ${date || 'Date N/A'} - ${timeSlot || 'Créneau N/A'} [${contactMethod}]`;

        // Save to Supabase
        const { data: insertedMsg, error: supabaseError } = await supabase
            .from('messages')
            .insert([{
                nom,
                prenom: prenom || '',
                email,
                telephone: telephone || '',
                sujet: sujetRdv,
                message: message || '',
                type: 'rendez-vous',
                lu: false,
            }])
            .select('id')
            .single();

        if (supabaseError) throw supabaseError;
        const msgId = insertedMsg?.id || '';

        // Fire-and-forget: Auto-reply + Agent notification
        (async () => {
            try {
                // Generate AI reply
                const aiReply = await generateAutoReply(clientName, service || 'Consultation');

                // Send auto-reply to client
                await sendEmail({
                    to: email,
                    subject: `Retour Gagnant — Votre demande de rendez-vous`,
                    html: EMAIL_TEMPLATES.autoReply(clientName, aiReply),
                    context: 'auto_reply',
                    relatedId: msgId,
                });

                // Send notification to admin/agents
                const config = await getEmailConfig();
                if (config.adminEmail) {
                    await sendEmail({
                        to: config.adminEmail,
                        subject: `📅 Nouvelle Demande de RDV — ${clientName} (${service})`,
                        html: EMAIL_TEMPLATES.newLeadNotification(clientName, email, 0, service || 'Consultation', 'Formulaire de Rendez-vous'),
                        context: 'admin_notification',
                        relatedId: msgId,
                    });
                }
            } catch (emailErr) {
                console.log('[RDV] Email send failed (non-blocking):', emailErr);
            }
        })();

        return NextResponse.json({ success: true, message: 'Demande de rendez-vous envoyée !' });
    } catch (error) {
        return NextResponse.json(
            { error: 'Erreur lors de la soumission.' },
            { status: 500 }
        );
    }
}
