import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendNationalityResumeEmail } from '@/lib/nationality-resume-email'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
)

// POST /api/agent/nationalite/relance — bouton « Relancer (documents) » des
// panels Admin + Agent. Envoie au client le lien signé de complément de dossier
// (formulaire pré-rempli, sans repaiement). Protégé par le middleware /api/agent/*.
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const id = String(body.id || '')
        if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

        const { data: app, error } = await supabase
            .from('nationality_applications')
            .select('id, application_ref, nom, prenom, email')
            .eq('id', id)
            .maybeSingle()

        if (error || !app) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

        const res = await sendNationalityResumeEmail(app)
        if (!res.success) {
            return NextResponse.json({ error: res.error || 'Échec de l\'envoi de l\'email' }, { status: 500 })
        }

        return NextResponse.json({ success: true, sentTo: app.email })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur serveur'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
