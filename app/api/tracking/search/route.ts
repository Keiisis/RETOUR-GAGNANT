import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { numDossier, email } = body

        if (!numDossier || !email) {
            return NextResponse.json({ error: 'Veuillez renseigner tous les champs.' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        const { data, error } = await supabase
            .from('dossier_tracking')
            .select('*')
            .eq('num_dossier', numDossier.trim().toUpperCase())
            .eq('client_email', email.trim().toLowerCase())
            .single()

        if (error || !data) {
            return NextResponse.json({
                found: false,
                message: 'Aucun dossier trouvé. Vérifiez votre numéro et votre email.'
            })
        }

        return NextResponse.json({
            found: true,
            dossier: {
                num_dossier: data.num_dossier,
                client_nom: data.client_nom,
                client_prenom: data.client_prenom,
                service_type: data.service_type,
                statut: data.statut,
                progression: data.progression,
                etapes: data.etapes,
                documents_manquants: data.documents_manquants,
                created_at: data.created_at,
                updated_at: data.updated_at
            }
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
