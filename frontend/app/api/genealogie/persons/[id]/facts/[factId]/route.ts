import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, requireWriteTree } from '@/lib/genealogy/api-auth'

const VALID_CONFIDENCE = ['proven','probable','possible','unverified','disputed']

// PATCH /api/genealogie/persons/[id]/facts/[factId]
//   Body : champs à modifier (value, value_date, source_doc_id, source_text, confidence, notes)
//
// DELETE /api/genealogie/persons/[id]/facts/[factId]
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; factId: string }> }
) {
    try {
        const { factId } = await params
        const supabase = getServiceClient()

        const { data: existing } = await supabase
            .from('person_facts').select('tree_id').eq('id', factId).single()
        if (!existing) return NextResponse.json({ error: 'Fait introuvable' }, { status: 404 })

        const auth = await requireWriteTree(request, existing.tree_id)
        if (auth instanceof NextResponse) return auth

        const body = await request.json()
        const updates: Record<string, unknown> = {}
        if (typeof body.value === 'string') updates.value = body.value.trim()
        if (body.value_date !== undefined) updates.value_date = body.value_date
        if (body.source_doc_id !== undefined) updates.source_doc_id = body.source_doc_id
        if (body.source_text !== undefined) updates.source_text = body.source_text
        if (body.confidence && VALID_CONFIDENCE.includes(body.confidence)) updates.confidence = body.confidence
        if (body.notes !== undefined) updates.notes = body.notes

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'Aucune mise à jour' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('person_facts').update(updates).eq('id', factId).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ fact: data })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; factId: string }> }
) {
    try {
        const { factId } = await params
        const supabase = getServiceClient()

        const { data: existing } = await supabase
            .from('person_facts').select('tree_id').eq('id', factId).single()
        if (!existing) return NextResponse.json({ error: 'Fait introuvable' }, { status: 404 })

        const auth = await requireWriteTree(request, existing.tree_id)
        if (auth instanceof NextResponse) return auth

        const { error } = await supabase.from('person_facts').delete().eq('id', factId)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ ok: true })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
