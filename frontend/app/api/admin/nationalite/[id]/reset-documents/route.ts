// ══════════════════════════════════════════════════════════════
//  RÉINITIALISATION DES PIÈCES D'UN DOSSIER NATIONALITÉ
//  Met les fichiers en CORBEILLE (récupérables, cf. lib/nationality-corbeille)
//  + vide documents_uploaded + trace dans agent_notes, SANS toucher
//  au dossier ni au paiement. Permet d'envoyer une nouvelle relance
//  « documents » propre (tous les slots réapparaissent au client).
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { lireLigneDocument } from '@/lib/nationality-docs'
import { mettreALaCorbeille, traceCorbeille } from '@/lib/nationality-corbeille'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { data: app, error: fetchErr } = await supabase
        .from('nationality_applications')
        .select('documents_uploaded, agent_notes')
        .eq('id', id)
        .maybeSingle()
    if (fetchErr || !app) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    // Chemins storage réels (lignes succès : « …: nat-…/fichier.ext »).
    const paths: string[] = []
    for (const line of (app.documents_uploaded || []) as string[]) {
        const lu = lireLigneDocument(line)
        if (lu?.ok) paths.push(lu.path)
    }
    // Base d'abord : en cas d'échec, les fichiers restent et le dossier aussi.
    // L'ordre inverse laissait des lignes pointant vers des fichiers effacés.
    const trace = traceCorbeille('Réinitialisation des pièces', garde.userId, paths.length)
    const { error: updErr } = await supabase
        .from('nationality_applications')
        .update({ documents_uploaded: [], agent_notes: [app.agent_notes, trace].filter(Boolean).join('\n') })
        .eq('id', id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    // Jamais de suppression définitive : les fichiers restent récupérables.
    const deplaces = paths.length ? await mettreALaCorbeille(supabase, paths) : 0

    return NextResponse.json({ success: true, filesRemoved: deplaces })
}
