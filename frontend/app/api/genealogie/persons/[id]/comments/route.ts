import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, getTreeIdForPerson, requireReadTree, getAuthUserId } from '@/lib/genealogy/api-auth'
import { scanRequestBody } from '@/lib/waf'

// GET /api/genealogie/persons/[id]/comments
//   Liste les commentaires sur une fiche personne (chronologique inverse).
//
// POST /api/genealogie/persons/[id]/comments
//   Body : { body: string }
//   Crée un commentaire. L'auteur est auth.uid() (RLS).
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const treeId = await getTreeIdForPerson(id)
        if (!treeId) return NextResponse.json({ error: 'Personne introuvable' }, { status: 404 })

        const auth = await requireReadTree(request, treeId)
        if (auth instanceof NextResponse) return auth

        const supabase = getServiceClient()
        const { data, error } = await supabase
            .from('person_comments')
            .select('id, person_id, author_id, author_email, body, resolved_at, resolved_by, created_at, updated_at')
            .eq('person_id', id)
            .order('created_at', { ascending: false })
            .limit(200)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ comments: data || [] })
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
        const treeId = await getTreeIdForPerson(id)
        if (!treeId) return NextResponse.json({ error: 'Personne introuvable' }, { status: 404 })

        const userId = await getAuthUserId(request)
        if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const supabase = getServiceClient()
        // Tout user en lecture peut commenter (cohérent avec RLS comments_insert)
        const { data: canRead } = await supabase.rpc('can_read_tree', { p_tree_id: treeId })
        if (!canRead) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

        // ── WAF #2 : analyse structurelle du body (proto pollution / RCE / SSRF / DoS) ──
        // scanRequestBody renvoie le body parsé → on le réutilise (pas de double req.json())
        const { body, rejection } = await scanRequestBody(request)
        if (rejection) return rejection

        const text = String((body as { body?: unknown })?.body || '').trim()
        if (!text) return NextResponse.json({ error: 'Texte requis' }, { status: 400 })
        if (text.length > 4000) return NextResponse.json({ error: 'Texte trop long (max 4000)' }, { status: 400 })

        const { data: created, error } = await supabase
            .from('person_comments')
            .insert({
                tree_id: treeId,
                person_id: id,
                body: text,
                author_id: userId,
                // author_email est snapshoté par le trigger fn_set_comment_author
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ comment: created })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
