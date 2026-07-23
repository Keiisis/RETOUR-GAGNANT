import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getEmailTemplates, getEmailConfig } from '@/lib/email'
import { sendWhatsAppNotification } from '@/lib/whatsapp'
import { trackClient } from '@/lib/classement/track'
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(req: NextRequest) {
    const trop = guardPublic(req, 'nationality/lead', PUBLIC_FORM_LIMIT)
    if (trop) return trop

    try {
        const body = await req.json()
        const { nom, prenom, email, telephone, pays_residence, lang } = body as {
            nom?: string
            prenom?: string
            email?: string
            telephone?: string
            pays_residence?: string
            lang?: string
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
        }
        if (!nom || !prenom) {
            return NextResponse.json({ error: 'Nom et prénom requis' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseKey)
        const cleanEmail = email.toLowerCase().trim()
        const clientName = `${prenom} ${nom}`.trim()

        // Anti-doublon : si un lead existe déjà pour cet email + objectif nationalité, on réutilise
        const { data: existing } = await supabase
            .from('eligibility_results')
            .select('id')
            .eq('client_email', cleanEmail)
            .eq('objective', 'nationalite')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        let leadId = existing?.id || ''

        if (!leadId) {
            const { data: inserted, error } = await supabase.from('eligibility_results').insert({
                client_nom: nom,
                client_prenom: prenom,
                client_email: cleanEmail,
                client_whatsapp: telephone || '',
                answers: {
                    objective: 'nationalite',
                    origin: 'oui',
                    pays_residence: pays_residence || '',
                    timeline: 'exploration',
                    source: 'nationalite_formulaire_intro',
                },
                recommended_service: 'Reconnaissance de Nationalité',
                recommended_slug: 'nationalite',
                eligibility_score: 60,
                has_origins: true,
                objective: 'nationalite',
                is_contacted: false,
            }).select('id').single()

            if (error) {
                console.error('[NAT-LEAD] Insert error:', error.message)
                return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 })
            }
            leadId = inserted?.id || ''
        }

        // Envois email en fire-and-forget — jamais bloquant pour l'utilisateur
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'
        const registerUrl = `${siteUrl}/client/register?email=${encodeURIComponent(cleanEmail)}&nom=${encodeURIComponent(nom)}&prenom=${encodeURIComponent(prenom)}&phone=${encodeURIComponent(telephone || '')}&pays=${encodeURIComponent(pays_residence || '')}&source=nationalite`

        ;(async () => {
            try {
                const templates = await getEmailTemplates(lang || 'fr')
                await sendEmail({
                    to: cleanEmail,
                    subject: 'Retour Gagnant Bénin — Finalisez votre inscription',
                    html: await templates.accountInvite(clientName, registerUrl),
                    context: 'account_invite',
                    relatedId: leadId,
                })

                const config = await getEmailConfig()
                if (config.adminEmail) {
                    await sendEmail({
                        to: config.adminEmail,
 subject: `Nouveau prospect nationalité — ${clientName}`,
                        html: await templates.newLeadNotification(
                            clientName,
                            cleanEmail,
                            60,
                            'Reconnaissance de Nationalité',
                            'Formulaire nationalité',
                        ),
                        context: 'lead_notification',
                        relatedId: leadId,
                    })
                }
            } catch (e) {
                console.log('[NAT-LEAD] Email send failed (non-blocking):', e)
            }

            // Notification WhatsApp automatique (no-op si non configuré)
            try {
                await sendWhatsAppNotification(
                    `🇧🇯 Nouveau prospect nationalité — Retour Gagnant\n` +
                    `Nom : ${clientName}\n` +
                    `Email : ${cleanEmail}\n` +
                    `Tél : ${telephone || 'non communiqué'}\n` +
                    `Pays : ${pays_residence || 'non précisé'}`
                )
            } catch (waErr) {
                console.log('[NAT-LEAD] WhatsApp non-blocking:', waErr)
            }

            // Classement Client automatique (CRM)
            await trackClient({ email: cleanEmail, full_name: clientName, phone: telephone, serviceLabel: 'nationalite-vip', source: 'nationalite' })
        })()

        return NextResponse.json({ success: true, leadId })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur serveur'
        console.error('[NAT-LEAD] Error:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
