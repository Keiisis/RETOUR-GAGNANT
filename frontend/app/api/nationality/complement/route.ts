// GET /api/nationality/complement?ref= — données minimales de la page
// /nationalite/complement-ancestral (prénom + pièces ancestrales manquantes).
// Remplace la lecture en clé publique de nationality_applications (audit
// 25/09/2026). La référence étant devinable, le NOM de famille n'est plus
// renvoyé et le débit par IP est plafonné.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServeur } from '@/lib/supabase-serveur'
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'

export async function GET(req: NextRequest) {
    const trop = guardPublic(req, 'nationality/complement', { ...PUBLIC_FORM_LIMIT, limit: 20 })
    if (trop) return trop

    const ref = String(req.nextUrl.searchParams.get('ref') || '').trim().toUpperCase()
    if (!/^[A-Z0-9-]{6,40}$/.test(ref)) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    const { data } = await supabaseServeur.from('nationality_applications')
        .select('prenom, missing_docs').eq('application_ref', ref).maybeSingle()
    if (!data) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    const docs = (Array.isArray(data.missing_docs) ? data.missing_docs : [])
        .filter((d: { ancestral?: boolean }) => d?.ancestral)
    return NextResponse.json({ prenom: data.prenom || '', missing_docs: docs })
}
