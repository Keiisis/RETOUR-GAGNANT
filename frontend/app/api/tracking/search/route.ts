import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(request: Request) {
    const trop = guardPublic(request, 'tracking/search', PUBLIC_FORM_LIMIT)
    if (trop) return trop

    try {
        const body = await request.json()
        const { numDossier, email } = body

        if (!numDossier || !email) {
            return NextResponse.json({ error: 'Veuillez renseigner tous les champs.' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseKey)
        const refUpper = numDossier.trim().toUpperCase()
        const emailLower = email.trim().toLowerCase()

        // 1. Try dossier_tracking table first (general tracking)
        const { data: trackingData } = await supabase
            .from('dossier_tracking')
            .select('*')
            .eq('num_dossier', refUpper)
            .eq('client_email', emailLower)
            .single()

        if (trackingData) {
            return NextResponse.json({
                found: true,
                dossier: {
                    num_dossier: trackingData.num_dossier,
                    client_nom: trackingData.client_nom,
                    client_prenom: trackingData.client_prenom,
                    service_type: trackingData.service_type,
                    statut: trackingData.statut,
                    progression: trackingData.progression,
                    etapes: trackingData.etapes,
                    documents_manquants: trackingData.documents_manquants,
                    created_at: trackingData.created_at,
                    updated_at: trackingData.updated_at
                }
            })
        }

        // 2. Try nationality_applications table (nationality-specific)
        const { data: natData } = await supabase
            .from('nationality_applications')
            .select('*')
            .eq('application_ref', refUpper)
            .eq('email', emailLower)
            .single()

        if (natData) {
            // Build timeline steps from nationality application status
            const statusMap: Record<string, { progression: number, etapes: { id: number, label: string, status: string, date: string | null, note: string }[] }> = {
                'soumis': {
                    progression: 25,
                    etapes: [
                        { id: 1, label: 'Demande soumise', status: 'completed', date: natData.submitted_at, note: 'Votre demande a été reçue et enregistrée.' },
                        { id: 2, label: 'Vérification des documents', status: 'in_progress', date: null, note: 'Nos équipes vérifient vos pièces justificatives.' },
                        { id: 3, label: 'Examen du dossier', status: 'pending', date: null, note: 'Examen approfondi par notre service juridique.' },
                        { id: 4, label: 'Décision finale', status: 'pending', date: null, note: '' },
                    ]
                },
                'en_examen': {
                    progression: 50,
                    etapes: [
                        { id: 1, label: 'Demande soumise', status: 'completed', date: natData.submitted_at, note: 'Votre demande a été reçue et enregistrée.' },
                        { id: 2, label: 'Vérification des documents', status: 'completed', date: natData.submitted_at, note: 'Pièces justificatives validées.' },
                        { id: 3, label: 'Examen du dossier', status: 'in_progress', date: null, note: 'Votre dossier est en cours d\'examen par notre service juridique.' },
                        { id: 4, label: 'Décision finale', status: 'pending', date: null, note: '' },
                    ]
                },
                'approuvé': {
                    progression: 100,
                    etapes: [
                        { id: 1, label: 'Demande soumise', status: 'completed', date: natData.submitted_at, note: 'Votre demande a été reçue et enregistrée.' },
                        { id: 2, label: 'Vérification des documents', status: 'completed', date: natData.submitted_at, note: 'Pièces justificatives validées.' },
                        { id: 3, label: 'Examen du dossier', status: 'completed', date: natData.decision_date || null, note: 'Dossier examiné et validé.' },
                        { id: 4, label: 'Décision finale : Approuvé', status: 'completed', date: natData.decision_date || null, note: 'Félicitations ! Votre demande de nationalité a été approuvée. ' },
                    ]
                },
                'rejeté': {
                    progression: 100,
                    etapes: [
                        { id: 1, label: 'Demande soumise', status: 'completed', date: natData.submitted_at, note: 'Votre demande a été reçue et enregistrée.' },
                        { id: 2, label: 'Vérification des documents', status: 'completed', date: natData.submitted_at, note: 'Pièces justificatives vérifiées.' },
                        { id: 3, label: 'Examen du dossier', status: 'completed', date: natData.decision_date || null, note: 'Dossier examiné.' },
                        { id: 4, label: 'Décision finale : Rejeté', status: 'completed', date: natData.decision_date || null, note: natData.agent_notes || 'Votre demande n\'a pas été retenue. Contactez-nous pour plus d\'informations.' },
                    ]
                },
            }

            const statusInfo = statusMap[natData.status] || statusMap['soumis']

            return NextResponse.json({
                found: true,
                dossier: {
                    num_dossier: natData.application_ref,
                    client_nom: natData.nom,
                    client_prenom: natData.prenom,
                    service_type: 'Demande de Nationalité Béninoise',
                    statut: natData.status,
                    progression: statusInfo.progression,
                    etapes: statusInfo.etapes,
                    documents_manquants: [],
                    created_at: natData.created_at || natData.submitted_at,
                    updated_at: natData.decision_date || natData.submitted_at,
                }
            })
        }

        // 3. Nothing found
        return NextResponse.json({
            found: false,
            message: 'Aucun dossier trouvé. Vérifiez votre numéro de référence et votre email.'
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
