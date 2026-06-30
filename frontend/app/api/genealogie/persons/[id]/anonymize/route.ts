import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, getTreeIdForPerson, requireWriteTree } from '@/lib/genealogy/api-auth'

// POST /api/genealogie/persons/[id]/anonymize
//
// RGPD article 17 — Droit à l'oubli. Anonymise une personne vivante :
//   - first_name, last_name → '████'
//   - birth_place, death_place → null
//   - birth_date conservé en année uniquement (YYYY-01-01)
//   - notes → null
//   - avatar_url → null
//   - anonymized_at / anonymized_by remplis pour audit
//
// La ligne reste présente (cascade aurait cassé les relations). Pour suppression
// pure, l'owner doit appeler DELETE /persons/[id] séparément (cascade complète).
//
// Cas d'usage : un cousin demande à être retiré de l'arbre partagé.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const treeId = await getTreeIdForPerson(id)
        if (!treeId) {
            return NextResponse.json({ error: 'Personne introuvable' }, { status: 404 })
        }

        const auth = await requireWriteTree(request, treeId)
        if (auth instanceof NextResponse) return auth

        const supabase = getServiceClient()

        const { error: updErr } = await supabase
            .from('persons')
            .update({
                first_name: '████',
                last_name: '████',
                birth_place: null,
                death_place: null,
                notes: null,
                avatar_url: null,
                anonymized_at: new Date().toISOString(),
                anonymized_by: auth.userId,
            })
            .eq('id', id)

        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

        // Supprimer aussi les documents et faits explicites — ils contiennent
        // potentiellement des PII identifiants
        await supabase.from('person_facts').delete().eq('person_id', id)
        await supabase.from('document_persons').delete().eq('person_id', id)

        return NextResponse.json({ ok: true, anonymized_at: new Date().toISOString() })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
