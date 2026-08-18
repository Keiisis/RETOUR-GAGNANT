// ══════════════════════════════════════════════════════════════
//  Demandes de séjour (Tourisme & Culture) — côté panel.
//
//  Les parcours saisis depuis l'application (« Préparer mon séjour ») étaient
//  bien enregistrés, mais AUCUN écran ne les affichait : l'équipe ne savait donc
//  pas à qui envoyer un Smart Slide. Cette route les expose.
//
//  GET   → liste des demandes, avec le parcours souhaité
//  PATCH → avancement d'une demande (nouveau → en_preparation → propose → clos)
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const STATUTS = ['nouveau', 'en_preparation', 'propose', 'clos'] as const

export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const statut = new URL(request.url).searchParams.get('statut')

    let req = supabase
        .from('tourism_itineraries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

    if (statut && (STATUTS as readonly string[]).includes(statut)) req = req.eq('statut', statut)

    const { data, error } = await req
    if (error) {
        // La table n'existe pas tant que la migration n'a pas été exécutée :
        // on le dit clairement plutôt que d'afficher une liste vide trompeuse.
        return NextResponse.json(
            { error: error.message, demandes: [], migration_requise: /does not exist|schema cache/i.test(error.message) },
            { status: 500 },
        )
    }

    return NextResponse.json({ demandes: data || [] })
}

export async function PATCH(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '').trim()
    const statut = String(body.statut || '').trim()

    if (!id) return NextResponse.json({ error: 'Demande manquante.' }, { status: 400 })
    if (!(STATUTS as readonly string[]).includes(statut)) {
        return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 })
    }

    const patch: Record<string, unknown> = { statut, updated_at: new Date().toISOString() }
    if (typeof body.notes_agent === 'string') patch.notes_agent = body.notes_agent.slice(0, 4000)
    if (body.proposal_id) patch.proposal_id = String(body.proposal_id)

    const { error } = await supabase.from('tourism_itineraries').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
