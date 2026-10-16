import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { NATIONALITE_DECISIONS, NATIONALITE_STATUTS_EDITABLES, type NationaliteStatut } from '@/lib/constants/statuts'
import { synchroniserSuiviNationalite } from '@/lib/suivi-nationalite'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

// POST /api/agent/nationalite/statut : sélecteur de statut des panels Admin
// et Agent. Les deux écrivaient le statut depuis le navigateur, sans toucher
// au suivi client : il restait figé sur « Réception du dossier ». Le statut
// et le suivi changent désormais ensemble, ici.
export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({})) as { id?: unknown; status?: unknown }
    const id = String(body.id || '')
    const status = String(body.status || '') as NationaliteStatut
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    if (!NATIONALITE_STATUTS_EDITABLES.includes(status)) {
        return NextResponse.json({ error: `Statut inconnu. Attendu : ${NATIONALITE_STATUTS_EDITABLES.join(', ')}.` }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('nationality_applications')
        .update({ status, decision_date: NATIONALITE_DECISIONS.includes(status) ? new Date().toISOString() : null })
        .eq('id', id)
        .select('id, application_ref, status')
        .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    await synchroniserSuiviNationalite(supabase, data.application_ref, status)
    return NextResponse.json({ success: true, application: data })
}
