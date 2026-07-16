import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

// Champs éditables d'une demande de nationalité depuis le panel admin.
const EDITABLE = [
    'nom', 'prenom', 'genre', 'date_naissance', 'pays_naissance', 'ville_naissance',
    'nationalite', 'pays_residence', 'adresse_residence', 'telephone', 'email', 'profession',
    'type_document_identite', 'numero_document', 'date_expiration_document',
    'pays_delivrance', 'lieu_delivrance', 'autorite_delivrance',
    'pere_nom', 'pere_prenom', 'pere_date_naissance', 'mere_nom', 'mere_prenom', 'mere_date_naissance',
    'afro_descendant_description',
    'ancestor1_nom', 'ancestor1_prenom', 'ancestor1_lien_parente', 'ancestor1_nationalite', 'ancestor1_pays_residence',
    'ancestor2_nom', 'ancestor2_prenom', 'ancestor2_lien_parente', 'ancestor2_nationalite',
    'status', 'agent_notes', 'admin_notes', 'amount', 'currency', 'payment_status',
]

// PATCH /api/admin/nationalite/[id] — édition d'une demande (whitelist stricte).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}
    for (const key of EDITABLE) {
        if (key in body) updates[key] = body[key]
    }
    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }
    // Décision datée si statut final
    if (updates.status === 'approuve' || updates.status === 'rejete') {
        updates.decision_date = new Date().toISOString()
    }

    const { data, error } = await supabase
        .from('nationality_applications')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, application: data })
}

// DELETE /api/admin/nationalite/[id] — suppression d'une demande + de ses
// fichiers dans le bucket nationality_documents.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    // Récupère les chemins storage pour nettoyer le bucket
    const { data: app } = await supabase
        .from('nationality_applications')
        .select('documents_uploaded')
        .eq('id', id)
        .maybeSingle()

    const paths: string[] = []
    for (const line of (app?.documents_uploaded || []) as string[]) {
        const idx = line.indexOf(': ')
        if (idx === -1) continue
        const p = line.slice(idx + 2).trim()
        if (p.startsWith('nat-')) paths.push(p)
    }
    if (paths.length) {
        await supabase.storage.from('nationality_documents').remove(paths).catch(() => {})
    }

    const { error } = await supabase.from('nationality_applications').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, filesRemoved: paths.length })
}
