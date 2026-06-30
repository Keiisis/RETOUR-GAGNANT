import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, getTreeIdForDocument, requireReadTree, requireWriteTree } from '@/lib/genealogy/api-auth'

// GET /api/genealogie/documents/[id]/persons
//   Liste les personnes liées à un document.
//
// POST /api/genealogie/documents/[id]/persons
//   Body : { person_id: string, role?: 'subject'|'parent'|'spouse'|'witness'|'child'|'sibling'|'other' }
//   Ajoute un lien document ↔ personne.
//
// DELETE /api/genealogie/documents/[id]/persons?person_id=X
//   Retire un lien.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const treeId = await getTreeIdForDocument(id)
        if (!treeId) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

        const auth = await requireReadTree(request, treeId)
        if (auth instanceof NextResponse) return auth

        const supabase = getServiceClient()

        // Liens explicites (document_persons)
        const { data: links } = await supabase
            .from('document_persons')
            .select('id, document_id, person_id, role, created_at')
            .eq('document_id', id)

        // Récupérer les noms des personnes liées
        const personIds = (links || []).map(l => l.person_id)
        const { data: persons } = personIds.length > 0
            ? await supabase
                .from('persons')
                .select('id, first_name, last_name, relation_role')
                .in('id', personIds)
            : { data: [] }

        const personMap = new Map((persons || []).map(p => [p.id, p]))
        const enriched = (links || []).map(l => ({
            ...l,
            person: personMap.get(l.person_id) || null,
        }))

        return NextResponse.json({ links: enriched })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const treeId = await getTreeIdForDocument(id)
        if (!treeId) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

        const auth = await requireWriteTree(request, treeId)
        if (auth instanceof NextResponse) return auth

        const body = await request.json()
        const personId = String(body.person_id || '')
        const role = ['subject','parent','spouse','witness','child','sibling','other'].includes(body.role)
            ? body.role
            : 'subject'

        if (!personId) return NextResponse.json({ error: 'person_id requis' }, { status: 400 })

        const supabase = getServiceClient()

        // Vérifier que la personne est dans le bon tree
        const { data: person } = await supabase
            .from('persons').select('tree_id').eq('id', personId).single()
        if (!person || person.tree_id !== treeId) {
            return NextResponse.json({ error: 'Personne non valide pour ce document' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('document_persons')
            .insert({ document_id: id, person_id: personId, role })
            .select()
            .single()

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ error: 'Lien déjà existant' }, { status: 409 })
            }
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ link: data })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const personId = searchParams.get('person_id')
        if (!personId) return NextResponse.json({ error: 'person_id requis' }, { status: 400 })

        const treeId = await getTreeIdForDocument(id)
        if (!treeId) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

        const auth = await requireWriteTree(request, treeId)
        if (auth instanceof NextResponse) return auth

        const supabase = getServiceClient()
        const { error } = await supabase
            .from('document_persons')
            .delete()
            .eq('document_id', id)
            .eq('person_id', personId)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ ok: true })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
