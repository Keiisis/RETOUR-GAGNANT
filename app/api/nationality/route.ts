import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
// On préfère la clé Service Role côté serveur pour contourner les restrictions RLS (sécurité maximale)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

const sendConfirmationEmail = async (data: {
    nom: string
    prenom: string
    email: string
    nationalite: string
    refId: string
}) => {
    try {
        // 1. Récupération du template dynamique
        const { data: template } = await supabase
            .from('email_templates')
            .select('*')
            .eq('slug', 'nationality_confirmation')
            .eq('is_active', true)
            .single()

        if (!template) {
            console.warn('[EMAIL] Aucun template actif trouvé pour "nationality_confirmation".')
            return false
        }

        let htmlBody = template.html_body
        htmlBody = htmlBody.replace(/\{\{nom\}\}/g, data.nom)
        htmlBody = htmlBody.replace(/\{\{prenom\}\}/g, data.prenom)
        htmlBody = htmlBody.replace(/\{\{nationalite\}\}/g, data.nationalite)
        htmlBody = htmlBody.replace(/\{\{ref\}\}/g, data.refId)

        const resendKey = process.env.RESEND_API_KEY

        if (resendKey) {
            // Optionnel : permettre à l'admin de définir l'email d'envoi dans .env (ou via la table settings)
            const fromEmail = process.env.RESEND_FROM_EMAIL || 'Retour Gagnant <contact@retourgagnant.bj>'

            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${resendKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: fromEmail,
                    to: [data.email],
                    subject: template.subject,
                    html: htmlBody,
                }),
            })

            if (!response.ok) {
                const errData = await response.json()
                console.error('[EMAIL] Erreçur Resend (Domaine non vérifié ?):', errData)
                return false
            }
            return true
        }

        console.log('[EMAIL] Mode simulation (RESEND_API_KEY manquant) -> Envoi à :', data.email)
        return false // On retourne false pour ne pas marquer "envoyé" s'il n'y a pas de clé vraie
    } catch (error) {
        console.error('[EMAIL] Erreçur fatale lors de l\'envoi:', error)
        return false
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { nom, prenom, email, nationalite_actuelle, motivation } = body

        if (!nom || !prenom || !email) {
            return NextResponse.json(
                { error: 'Nom, prénom et email sont requis' },
                { status: 400 }
            )
        }

        // 1. Insert nationality request into DB
        const { data: inserted, error: insertError } = await supabase
            .from('nationality_requests')
            .insert([{
                nom,
                prenom,
                email,
                nationalite_actuelle: nationalite_actuelle || 'Non spécifiée',
                motivation: motivation || '',
                statut: 'nouveau',
            }])
            .select()
            .single()

        if (insertError) {
            console.error('Insert error:', insertError)
            return NextResponse.json(
                { error: 'Erreçur lors de l\'enregistrement' },
                { status: 500 }
            )
        }

        const refId = String(inserted.id).padStart(6, '0')

        // 2. Create message for admin/agents
        await supabase.from('messages').insert([{
            name: `${prenom} ${nom}`,
            email,
            subject: `Demande de nationalité #RG-${refId}`,
            message: `Nouvelle demande de nationalité béninoise.\n\nNom: ${prenom} ${nom}\nEmail: ${email}\nNationalité actuelle: ${nationalite_actuelle || 'Non spécifiée'}\nMotivation: ${motivation || 'Non précisée'}\n\nRéférence: #RG-${refId}`,
            type: 'nationality',
            is_read: false,
        }])

        // 3. Send auto email to client
        const emailSent = await sendConfirmationEmail({
            nom,
            prenom,
            email,
            nationalite: nationalite_actuelle || 'Non spécifiée',
            refId,
        })

        // 4. Update email_sent status
        if (emailSent) {
            await supabase
                .from('nationality_requests')
                .update({ email_sent: true })
                .eq('id', inserted.id)
        }

        return NextResponse.json({
            success: true,
            reference: `#RG-${refId}`,
            emailSent,
            message: 'Votre demande a été reçue avec succès.',
        })
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error('Nationality API error:', errMsg)
        return NextResponse.json(
            { error: 'Une erreçur est survenue. Veuillez réessayer.' },
            { status: 500 }
        )
    }
}
