// ══════════════════════════════════════════════════════════════
// Impression d'une fiche de suivi client RGB (A4, en-tête de la grille tarifaire)
//
//  GET /api/agent/fiches-suivi/<id>/print    → la fiche remplie
//  GET /api/agent/fiches-suivi/vierge/print  → le modèle vierge à remplir à la main
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { FICHE_VIERGE, ficheSuiviHtml } from '@/lib/fiche-suivi-impression'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!
    const { id } = await params

    let fiche = FICHE_VIERGE
    if (id !== 'vierge') {
        if (!UUID.test(id)) return new NextResponse('Paramètres invalides', { status: 400 })
        const { data, error } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
            .from('fiches_suivi_client').select('*').eq('id', id).maybeSingle()
        if (error) return new NextResponse(error.message, { status: 500 })
        if (!data) return new NextResponse('Fiche introuvable', { status: 404 })
        fiche = data
    }

    return new NextResponse(ficheSuiviHtml(fiche, { logoUrl: '/images/logo-transparent.png', genereLe: new Date() }), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
    })
}
