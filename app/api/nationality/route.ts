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
                console.error('[EMAIL] Erreur Resend (Domaine non vérifié ?):', errData)
                return false
            }
            return true
        }

        console.log('[EMAIL] Mode simulation (RESEND_API_KEY manquant) -> Envoi à :', data.email)
        return false // On retourne false pour ne pas marquer "envoyé" s'il n'y a pas de clé vraie
    } catch (error) {
        console.error('[EMAIL] Erreur fatale lors de l\'envoi:', error)
        return false
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { nom, prenom, email, nationalite, motivation, afro_descendant_description, payment_ref, payment_method, documents } = body

        if (!nom || !prenom || !email) {
            return NextResponse.json(
                { error: 'Nom, prénom et email sont requis' },
                { status: 400 }
            )
        }

        const ref = `RG-NAT-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`

        // 1. Insert nationality application into DB (Centralized table)
        const { error: insertError } = await supabase
            .from('nationality_applications')
            .insert([{
                ...body, // On spread tout pour avoir les champs dynamiques (assurant qu'ils matchent les colonnes)
                application_ref: ref,
                status: 'soumis',
                submitted_at: new Date().toISOString(),
                // On s'assure que les champs calculés ou re-mappés sont corrects
                nom,
                prenom,
                email,
                nationalite: nationalite || 'Non spécifiée',
                afro_descendant_description: afro_descendant_description || motivation || '',
                documents_uploaded: documents || [],
                payment_status: payment_ref ? 'payé' : 'en_attente',
                payment_ref,
                payment_method
            }])

        if (insertError) {
            console.error('Insert error:', insertError)
            return NextResponse.json(
                { error: 'Erreur lors de l\'enregistrement dans la base de données' },
                { status: 500 }
            )
        }

        // 2. Create message for admin/agents
        await supabase.from('messages').insert([{
            nom: `${prenom} ${nom}`,
            email,
            sujet: `Demande de nationalité #${ref}`,
            message: `Nouvelle demande de nationalité béninoise.\n\nNom: ${prenom} ${nom}\nEmail: ${email}\nRéférence: ${ref}\n\nMotivation: ${afro_descendant_description || motivation || 'Non précisée'}\n\nStatut Paiement: ${payment_ref ? 'Payé' : 'Non payé'}`,
            type: 'nationality',
            lu: false,
            payload: body
        }])

        // 3. Send auto email to client
        const emailSent = await sendConfirmationEmail({
            nom,
            prenom,
            email,
            nationalite: nationalite || 'Non spécifiée',
            refId: ref,
        })

        return NextResponse.json({
            success: true,
            reference: ref,
            emailSent,
            message: 'Votre demande a été reçue avec succès.',
        })
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error('Nationality API error:', errMsg)
        return NextResponse.json(
            { error: 'Une erreur est survenue lors du traitement. Veuillez réessayer.' },
            { status: 500 }
        )
    }
}
