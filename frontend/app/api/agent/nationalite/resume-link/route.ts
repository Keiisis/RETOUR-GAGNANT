// Retourne le lien de reprise signé d'un dossier (sans envoyer d'email) —
// pour le copier et l'envoyer par WhatsApp si l'email ne passe pas.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { signResumeToken } from '@/lib/nationality-token'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
)
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    try {
        const body = await request.json().catch(() => ({}))
        const id = String(body.id || '')
        if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
        const mode: 'docs' | 'full' = body.mode === 'full' ? 'full' : 'docs'

        const { data: app, error } = await supabase
            .from('nationality_applications')
            .select('id, application_ref')
            .eq('id', id)
            .maybeSingle()
        if (error || !app) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

        const token = signResumeToken(app.id, 30)
        const link = `${SITE}/nationalite/formulaire?resume=${encodeURIComponent(token)}${mode === 'docs' ? '&mode=docs' : ''}`
        return NextResponse.json({ success: true, link, ref: app.application_ref })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
