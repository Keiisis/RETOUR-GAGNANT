import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyResumeToken } from '@/lib/nationality-token'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
)

// Champs du formulaire que l'on ré-injecte pour pré-remplir (whitelist stricte).
const PREFILL_FIELDS = [
    'nom', 'prenom', 'genre', 'date_naissance', 'pays_naissance', 'ville_naissance',
    'nationalite', 'pays_residence', 'adresse_residence', 'telephone', 'email', 'profession',
    'demande_depuis_benin', 'knows_about_law', 'is_afro_descendant', 'afro_descendant_description',
    'ancestor1_nom', 'ancestor1_prenom', 'ancestor1_date_naissance', 'ancestor1_lien_parente',
    'ancestor1_vivant', 'ancestor1_nationalite', 'ancestor1_pays_residence', 'ancestor1_autres_infos',
    'ancestor2_nom', 'ancestor2_prenom', 'ancestor2_date_naissance', 'ancestor2_lien_parente',
    'ancestor2_vivant', 'ancestor2_nationalite', 'ancestor2_pays_residence', 'ancestor2_autres_infos',
    'type_document_identite', 'numero_document', 'date_expiration_document', 'pays_delivrance',
    'lieu_delivrance', 'autorite_delivrance',
    'pere_nom', 'pere_prenom', 'pere_date_naissance', 'mere_nom', 'mere_prenom', 'mere_date_naissance',
    'situation_matrimoniale', 'nombre_enfants', 'motivation_lettre', 'consentement_rgpd',
]

export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token') || ''
    const verified = verifyResumeToken(token)
    if (!verified) {
        return NextResponse.json({ ok: false, error: 'Lien invalide ou expiré.' }, { status: 401 })
    }

    const { data: app, error } = await supabase
        .from('nationality_applications')
        .select('*')
        .eq('id', verified.id)
        .maybeSingle()

    if (error || !app) {
        return NextResponse.json({ ok: false, error: 'Dossier introuvable.' }, { status: 404 })
    }

    // Pré-remplissage : seulement des valeurs non nulles pour ne pas écraser les
    // valeurs par défaut du formulaire avec des null.
    const prefill: Record<string, unknown> = {}
    for (const key of PREFILL_FIELDS) {
        const v = (app as Record<string, unknown>)[key]
        if (v !== null && v !== undefined) prefill[key] = v
    }

    return NextResponse.json({
        ok: true,
        application_ref: app.application_ref,
        prefill,
        // Pièces déjà reçues : permet au mode « documents seuls » de n'afficher
        // au client que les slots encore manquants.
        documents_uploaded: Array.isArray(app.documents_uploaded) ? app.documents_uploaded : [],
    })
}
