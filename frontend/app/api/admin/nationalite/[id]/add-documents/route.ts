import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

// Le libellé ne doit pas contenir « : » : c'est le séparateur du format de ligne
// `<label>: <path>` lu par la prévisualisation/le ZIP.
const cleanLabel = (s: unknown) =>
    String(s ?? '').replace(/[\r\n]+/g, ' ').replace(/:/g, '-').trim().slice(0, 80) || 'Document'

// POST /api/admin/nationalite/[id]/add-documents  { docs: [{label, path}] }
// Ajoute des pièces (déjà déposées dans le bucket) au dossier. Staff only.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const docs = Array.isArray(body.docs) ? body.docs : []
    // Seuls les chemins réellement déposés (préfixe « nat- ») sont acceptés.
    const clean = docs
        .filter((d: unknown): d is { label: string; path: string } =>
            !!d && typeof (d as { path?: unknown }).path === 'string' && String((d as { path: string }).path).startsWith('nat-'))
        .map((d: { label: string; path: string }) => ({ label: cleanLabel(d.label), path: d.path }))

    if (clean.length === 0) {
        return NextResponse.json({ error: 'Aucun document valide à ajouter.' }, { status: 400 })
    }

    const { data: app, error: fe } = await supabase
        .from('nationality_applications')
        .select('documents_uploaded')
        .eq('id', id)
        .maybeSingle()
    if (fe || !app) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    const existing = Array.isArray(app.documents_uploaded) ? (app.documents_uploaded as string[]) : []
    const lines = clean.map((d: { label: string; path: string }) => `${d.label}: ${d.path}`)

    const { error } = await supabase
        .from('nationality_applications')
        .update({ documents_uploaded: [...existing, ...lines] })
        .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, added: lines.length })
}
