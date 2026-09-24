import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { lireLigneDocument } from '@/lib/nationality-docs'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

// POST /api/admin/nationalite/preview  { id }
// Retourne des URLs signées (1h) vers les documents déposés par le client,
// pour prévisualisation directe dans le panel admin (bucket privé).
export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { data: app, error } = await supabase
        .from('nationality_applications')
        .select('documents_uploaded')
        .eq('id', id)
        .maybeSingle()
    if (error || !app) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    const docs: Array<{ label: string; url: string | null; path: string; type: string }> = []
    for (const line of (app.documents_uploaded || []) as string[]) {
        const lu = lireLigneDocument(line)
        if (!lu?.ok) continue // ligne d'échec d'upload
        const { label, path } = lu
        const ext = (path.split('.').pop() || '').toLowerCase()
        const type = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? 'image'
            : ext === 'pdf' ? 'pdf' : 'file'
        const { data: signed } = await supabase.storage
            .from('nationality_documents')
            .createSignedUrl(path, 3600)
        docs.push({ label: label || path.split('/').pop() || 'Document', url: signed?.signedUrl || null, path, type })
    }

    return NextResponse.json({ documents: docs })
}
