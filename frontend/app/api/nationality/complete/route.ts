import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyResumeToken } from '@/lib/nationality-token'
import { scanRequestBody } from '@/lib/waf'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
)

// Colonnes modifiables lors de la complétion (identité + ascendants + pièces).
// Le paiement N'EST PAS touché (le dossier est déjà réglé).
const UPDATABLE = [
    'nom', 'prenom', 'genre', 'date_naissance', 'pays_naissance', 'ville_naissance',
    'nationalite', 'pays_residence', 'adresse_residence', 'telephone', 'profession',
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
const DATE_FIELDS = new Set([
    'date_naissance', 'ancestor1_date_naissance', 'ancestor2_date_naissance',
    'pere_date_naissance', 'mere_date_naissance', 'date_expiration_document',
])

export async function POST(request: NextRequest) {
    try {
        const { body: scanned, rejection } = await scanRequestBody(request)
        if (rejection) return rejection
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body = (scanned ?? {}) as any

        const verified = verifyResumeToken(body.token || '')
        if (!verified) {
            return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 401 })
        }

        const { data: app, error: fetchErr } = await supabase
            .from('nationality_applications')
            .select('id, application_ref, email')
            .eq('id', verified.id)
            .maybeSingle()

        if (fetchErr || !app) {
            return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 })
        }

        const update: Record<string, unknown> = {}
        for (const key of UPDATABLE) {
            if (body[key] === undefined) continue
            let v = body[key]
            if (DATE_FIELDS.has(key) && (v === '' || v === null)) v = null
            update[key] = v
        }

        const docs = Array.isArray(body.documents_uploaded)
            ? body.documents_uploaded
            : Array.isArray(body.documents) ? body.documents : []
        update.documents_uploaded = docs
        update.last_step_completed = 6
        update.status = 'soumis'

        const { error: updErr } = await supabase
            .from('nationality_applications')
            .update(update)
            .eq('id', app.id)

        if (updErr) {
            console.error('[nationality/complete] update error:', updErr.message)
            return NextResponse.json({ error: `Erreur DB: ${updErr.message}` }, { status: 500 })
        }

        // Notification staff : pièces complétées
        await supabase.from('messages').insert([{
            nom: `${body.prenom || ''} ${body.nom || ''}`.trim() || app.application_ref,
            email: app.email,
            telephone: body.telephone || null,
            sujet: `Dossier nationalité #${app.application_ref} — pièces complétées`,
            message: `Le client a complété son dossier de nationalité (référence ${app.application_ref}).\n\n${docs.length} pièce(s) justificative(s) transmise(s) via le lien de complément.`,
            type: 'nationality',
            lu: false,
        }])

        return NextResponse.json({ success: true, reference: app.application_ref })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        console.error('[nationality/complete] error:', msg)
        return NextResponse.json({ error: 'Une erreur est survenue. Veuillez réessayer.' }, { status: 500 })
    }
}
