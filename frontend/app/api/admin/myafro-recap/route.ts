// ══════════════════════════════════════════════════════════════
//  Récaps de dossier MyAfroOrigins — côté panel.
//
//  GET    → la file des demandes reçues
//  PATCH  → avancement, notes, ou fiche d'analyse corrigée à la main
//  DELETE → droit à l'effacement (Code du numérique béninois) : la ligne part
//           réellement, elle n'est pas simplement masquée.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { livrerRecap, type RecapALivrer } from '@/lib/recap-livraison'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const STATUTS = ['nouveau', 'en_analyse', 'recap_livre', 'clos'] as const

export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const statut = new URL(request.url).searchParams.get('statut')

    let req = supabase
        .from('myafro_recap_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300)

    if (statut && (STATUTS as readonly string[]).includes(statut)) req = req.eq('statut', statut)

    const { data, error } = await req
    if (error) {
        // La table n'existe pas tant que la migration 20260820 n'est pas passée :
        // le dire, plutôt que d'afficher une file vide qui rassure à tort.
        return NextResponse.json(
            {
                error: error.message,
                demandes: [],
                migration_requise: /does not exist|schema cache/i.test(error.message),
            },
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
    if (!id) return NextResponse.json({ error: 'Demande manquante.' }, { status: 400 })

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof body.statut === 'string') {
        if (!(STATUTS as readonly string[]).includes(body.statut)) {
            return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 })
        }
        patch.statut = body.statut
    }
    if (typeof body.notes_agent === 'string') patch.notes_agent = body.notes_agent.slice(0, 6000)
    // La fiche générée reste modifiable : l'analyste a le dernier mot sur ce
    // qui est remis au client.
    if (typeof body.recap_ia === 'string') patch.recap_ia = body.recap_ia.slice(0, 20000)

    const { error } = await supabase.from('myafro_recap_requests').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    /* ── Livraison au client ──────────────────────────────────
       Passer au statut « récap livré » EST l'acte de livraison : la fiche
       PDF part par e-mail et se dépose dans l'espace documents du client.
       Rien de nouveau à cliquer côté panel — l'action qui portait déjà le
       sens porte désormais l'effet.

       Volontairement après la mise à jour et sans la conditionner : une
       panne d'envoi ne doit pas empêcher l'analyste d'avancer son dossier.
       Le résultat remonte quand même dans la réponse, pour que le panel
       puisse le dire. */
    let livraison: { envoye: boolean; motif?: string } | null = null
    if (patch.statut === 'recap_livre') {
        const { data: recap } = await supabase
            .from('myafro_recap_requests')
            .select('id, reference, nom, prenom, email, situation, recap_ia')
            .eq('id', id)
            .maybeSingle()

        if (recap) livraison = await livrerRecap(supabase, recap as RecapALivrer)
    }

    return NextResponse.json({ success: true, livraison })
}

export async function DELETE(request: NextRequest) {
    // L'effacement d'une donnée personnelle est un acte de direction, pas une
    // opération courante d'agent.
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Demande manquante.' }, { status: 400 })

    const { error } = await supabase.from('myafro_recap_requests').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, efface: true })
}
