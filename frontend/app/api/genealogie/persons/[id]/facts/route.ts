import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, getTreeIdForPerson, requireReadTree, requireWriteTree } from '@/lib/genealogy/api-auth'
import { scanRequestBody } from '@/lib/waf'

const VALID_FACT_TYPES = [
    'birth_date','birth_place','death_date','death_place',
    'first_name','last_name','gender','occupation','residence',
    'baptism','marriage','immigration','emigration','education','military',
    'other'
]

const VALID_CONFIDENCE = ['proven','probable','possible','unverified','disputed']

// GET /api/genealogie/persons/[id]/facts
//   Liste les faits attestés sur une personne avec leurs sources.
//
// POST /api/genealogie/persons/[id]/facts
//   Body : { fact_type, value, value_date?, source_doc_id?, source_text?, confidence?, notes? }
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
            .from('person_facts')
            .select(`
                id, person_id, fact_type, value, value_date,
                source_doc_id, source_text, confidence, notes, created_at,
                source_doc:source_doc_id (id, doc_type, title, file_url)
            `)
            .eq('person_id', id)
            .order('confidence', { ascending: true })  // proven d'abord
            .order('created_at', { ascending: false })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ facts: data || [] })
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

        const auth = await requireWriteTree(request, treeId)
        if (auth instanceof NextResponse) return auth

        // ── WAF #2 : analyse structurelle du body (proto pollution / RCE / SSRF / DoS) ──
        const { body: scanned, rejection } = await scanRequestBody(request)
        if (rejection) return rejection
        const body = (scanned ?? {}) as Record<string, unknown>

        const factType = String(body.fact_type || '')
        const value = String(body.value || '').trim()
        const valueDate = body.value_date || null
        const sourceDocId = body.source_doc_id || null
        const sourceText = body.source_text || null
        const confidence = VALID_CONFIDENCE.includes(body.confidence as string) ? (body.confidence as string) : 'unverified'
        const notes = body.notes || null

        if (!factType || !VALID_FACT_TYPES.includes(factType)) {
            return NextResponse.json({ error: `fact_type invalide (${VALID_FACT_TYPES.join(', ')})` }, { status: 400 })
        }
        if (!value) {
            return NextResponse.json({ error: 'value requis' }, { status: 400 })
        }

        const supabase = getServiceClient()
        const { data, error } = await supabase
            .from('person_facts')
            .insert({
                tree_id: treeId,
                person_id: id,
                fact_type: factType,
                value,
                value_date: valueDate,
                source_doc_id: sourceDocId,
                source_text: sourceText,
                confidence,
                asserted_by: auth.userId,
                notes,
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ fact: data })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
