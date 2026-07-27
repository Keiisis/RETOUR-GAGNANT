// ══════════════════════════════════════════════════════════════
//  RÉINITIALISATION DES PIÈCES D'UN DOSSIER NATIONALITÉ
//  Supprime les fichiers du bucket + vide documents_uploaded, SANS toucher
//  au dossier ni au paiement. Permet d'envoyer une nouvelle relance
//  « documents » propre (tous les slots réapparaissent au client).
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

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
        .select('documents_uploaded')
        .eq('id', id)
        .maybeSingle()
    if (fetchErr || !app) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    // Chemins storage réels (lignes succès : « …: nat-…/fichier.ext »).
    const paths: string[] = []
    for (const line of (app.documents_uploaded || []) as string[]) {
        const idx = line.indexOf(': ')
        if (idx === -1) continue
        const p = line.slice(idx + 2).trim()
        if (p.startsWith('nat-')) paths.push(p)
    }
    if (paths.length) {
        await supabase.storage.from('nationality_documents').remove(paths).catch(() => {})
    }

    const { error: updErr } = await supabase
        .from('nationality_applications')
        .update({ documents_uploaded: [] })
        .eq('id', id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    return NextResponse.json({ success: true, filesRemoved: paths.length })
}
