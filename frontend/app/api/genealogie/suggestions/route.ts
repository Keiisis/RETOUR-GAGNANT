import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, requireReadTree } from '@/lib/genealogy/api-auth'

// GET /api/genealogie/suggestions?tree_id=X
//
// Renvoie les "trous" de l'arbre : informations manquantes pour solidifier
// le dossier RGB. S'appuie sur la fonction SQL fn_genealogy_suggestions().
//
// Réponse :
//   { suggestions: [{ person_id, person_name, relation_role, missing_what, severity }] }
//   - severity 'high' : self sans parents → bloque le dossier nationalité
//   - severity 'medium' : GP sans GGP → impact remontée généalogique
//   - severity 'low' : date/lieu manquant → confort
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const treeId = searchParams.get('tree_id')
        if (!treeId) return NextResponse.json({ error: 'tree_id requis' }, { status: 400 })

        const auth = await requireReadTree(request, treeId)
        if (auth instanceof NextResponse) return auth

        const supabase = getServiceClient()
        const { data, error } = await supabase.rpc('fn_genealogy_suggestions', { p_tree_id: treeId })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Bonus : compter aussi les documents manquants par catégorie
        const { data: persons } = await supabase
            .from('persons')
            .select('id, is_self, relation_role')
            .eq('tree_id', treeId)
        const { data: docs } = await supabase
            .from('genealogy_documents')
            .select('person_id, doc_type')
            .eq('tree_id', treeId)

        const REQUIRED_DOCS = ['acte_naissance', 'passeport']
        const docMissing: typeof data = []
        for (const p of persons || []) {
            if (!p.is_self && !['father', 'mother'].includes(p.relation_role)) continue
            for (const docType of REQUIRED_DOCS) {
                const has = (docs || []).some(d => d.person_id === p.id && d.doc_type === docType)
                if (!has) {
                    docMissing.push({
                        person_id: p.id,
                        person_name: '',
                        relation_role: p.relation_role,
                        missing_what: `doc:${docType}`,
                        severity: p.is_self ? 'high' : 'medium',
                    })
                }
            }
        }

        return NextResponse.json({
            suggestions: [...(data || []), ...docMissing],
            counts: {
                total: (data || []).length + docMissing.length,
                high: [...(data || []), ...docMissing].filter((s: { severity: string }) => s.severity === 'high').length,
                medium: [...(data || []), ...docMissing].filter((s: { severity: string }) => s.severity === 'medium').length,
                low: [...(data || []), ...docMissing].filter((s: { severity: string }) => s.severity === 'low').length,
            },
        })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
