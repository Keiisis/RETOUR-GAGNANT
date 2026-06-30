import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, requireReadTree, requireWriteTree } from '@/lib/genealogy/api-auth'

// GET /api/genealogie/dedup?tree_id=X
//   Renvoie les paires de personnes potentiellement en doublon dans l'arbre.
//
// POST /api/genealogie/dedup
//   Body : { tree_id, keep_id, merge_id }
//   Fusionne deux personnes :
//     - les enfants du merge_id sont rattachés au keep_id
//     - les documents et facts liés au merge_id sont rattachés au keep_id
//     - les unions du merge_id sont rattachées au keep_id
//     - merge_id est supprimé
//
// Sécurité :
//   - Lecture : owner/collab/staff
//   - Fusion : owner/editor/staff
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const treeId = searchParams.get('tree_id')
        if (!treeId) return NextResponse.json({ error: 'tree_id requis' }, { status: 400 })

        const auth = await requireReadTree(request, treeId)
        if (auth instanceof NextResponse) return auth

        const supabase = getServiceClient()
        const { data, error } = await supabase.rpc('fn_genealogy_dedup', { p_tree_id: treeId })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Enrichir avec les noms complets pour affichage
        const pairIds = new Set<string>()
        for (const pair of data || []) {
            pairIds.add(pair.person_a_id)
            pairIds.add(pair.person_b_id)
        }

        const { data: persons } = await supabase
            .from('persons')
            .select('id, first_name, last_name, birth_date, birth_place, relation_role')
            .in('id', Array.from(pairIds))

        const personMap: Record<string, typeof persons extends (infer U)[] | null ? U : never> = {}
        for (const p of persons || []) personMap[p.id] = p

        const enriched = (data || []).map((pair: { person_a_id: string; person_b_id: string; name_match: string; birth_year_diff: number }) => ({
            ...pair,
            person_a: personMap[pair.person_a_id] || null,
            person_b: personMap[pair.person_b_id] || null,
        }))

        return NextResponse.json({ pairs: enriched, count: enriched.length })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const treeId = String(body.tree_id || '')
        const keepId = String(body.keep_id || '')
        const mergeId = String(body.merge_id || '')

        if (!treeId || !keepId || !mergeId) {
            return NextResponse.json({ error: 'tree_id, keep_id, merge_id requis' }, { status: 400 })
        }
        if (keepId === mergeId) {
            return NextResponse.json({ error: 'keep_id et merge_id doivent être différents' }, { status: 400 })
        }

        const auth = await requireWriteTree(request, treeId)
        if (auth instanceof NextResponse) return auth

        const supabase = getServiceClient()

        // Vérifier que les 2 persons existent et sont dans le bon tree
        const { data: persons } = await supabase
            .from('persons')
            .select('id, tree_id')
            .in('id', [keepId, mergeId])
        if (!persons || persons.length !== 2) {
            return NextResponse.json({ error: 'Une des personnes est introuvable' }, { status: 404 })
        }
        if (persons.some(p => p.tree_id !== treeId)) {
            return NextResponse.json({ error: 'Les personnes ne sont pas dans cet arbre' }, { status: 400 })
        }

        const summary = { children_reattached: 0, docs_moved: 0, facts_moved: 0, unions_moved: 0, comments_moved: 0 }

        // 1. Réattacher les enfants (father_id legacy)
        const { data: childrenFather } = await supabase
            .from('persons').update({ father_id: keepId }).eq('father_id', mergeId).select('id')
        summary.children_reattached += (childrenFather?.length || 0)

        const { data: childrenMother } = await supabase
            .from('persons').update({ mother_id: keepId }).eq('mother_id', mergeId).select('id')
        summary.children_reattached += (childrenMother?.length || 0)

        // 2. Réattacher parent_child (nouveau schéma)
        await supabase.from('parent_child').update({ parent_id: keepId }).eq('parent_id', mergeId)
        await supabase.from('parent_child').update({ child_id: keepId }).eq('child_id', mergeId)

        // 3. Documents legacy (single person)
        const { data: docsMoved } = await supabase
            .from('genealogy_documents').update({ person_id: keepId }).eq('person_id', mergeId).select('id')
        summary.docs_moved = docsMoved?.length || 0

        // 4. document_persons (m2m)
        await supabase.from('document_persons').update({ person_id: keepId }).eq('person_id', mergeId)

        // 5. person_facts
        const { data: factsMoved } = await supabase
            .from('person_facts').update({ person_id: keepId }).eq('person_id', mergeId).select('id')
        summary.facts_moved = factsMoved?.length || 0

        // 6. Unions
        await supabase.from('unions').update({ partner1_id: keepId }).eq('partner1_id', mergeId)
        await supabase.from('unions').update({ partner2_id: keepId }).eq('partner2_id', mergeId)

        // 7. Comments
        const { data: commentsMoved } = await supabase
            .from('person_comments').update({ person_id: keepId }).eq('person_id', mergeId).select('id')
        summary.comments_moved = commentsMoved?.length || 0

        // 8. Suppression finale du doublon
        const { error: delErr } = await supabase.from('persons').delete().eq('id', mergeId)
        if (delErr) {
            return NextResponse.json({ error: `Échec suppression doublon : ${delErr.message}`, partial: summary }, { status: 500 })
        }

        return NextResponse.json({ ok: true, kept: keepId, merged: mergeId, summary })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
