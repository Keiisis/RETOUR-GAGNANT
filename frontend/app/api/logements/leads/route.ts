// ══════════════════════════════════════════════════════════════
//  Prospects logement : liste + changement de statut.
//
//  `logement_leads` était alimentée par /api/logements/lead et par la seule
//  notification email vers SIMAU : AUCUNE page ne l'affichait, donc les
//  prospects n'existaient nulle part dans les panels. Cette route comble ce
//  manque.
//
//  Accès réservé aux gestionnaires Logement (admins + agent nommément habilité,
//  cf. lib/logement-access) : la même garde que le catalogue et le contenu.
//  La table n'a aucune policy publique — seul le service_role la lit.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireLogementManager } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
)

const STATUTS = ['nouveau', 'transmis', 'traite'] as const

export async function GET(request: NextRequest) {
    const garde = await requireLogementManager(request)
    if (!garde.ok) return garde.response!

    const { searchParams } = new URL(request.url)
    const statut = searchParams.get('statut')

    let q = supabase
        .from('logement_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300)

    if (statut && STATUTS.includes(statut as typeof STATUTS[number])) {
        q = q.eq('statut', statut)
    }

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message, leads: [] }, { status: 500 })
    return NextResponse.json({ leads: data || [] })
}

export async function PATCH(request: NextRequest) {
    const garde = await requireLogementManager(request)
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '').trim()
    const statut = String(body.statut || '').trim()

    if (!id) return NextResponse.json({ error: 'Identifiant manquant.' }, { status: 400 })
    if (!STATUTS.includes(statut as typeof STATUTS[number])) {
        return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 })
    }

    const patch: Record<string, unknown> = { statut }
    // Cohérence : marquer « transmis » implique que le dossier est parti chez SIMAU.
    if (statut === 'transmis') patch.transmis_simau = true

    const { error } = await supabase.from('logement_leads').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
