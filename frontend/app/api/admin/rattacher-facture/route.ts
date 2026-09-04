// ══════════════════════════════════════════════════════════════
//  RATTACHER un dossier saisi à la main à une FACTURE RÉELLEMENT ÉMISE.
//
//  Un récap MyAfroOrigins pris au téléphone, un dossier de nationalité ouvert
//  par un agent ou par code d'invitation : dans les trois cas, le montant et le
//  statut de règlement étaient DÉCLARÉS. Cocher « payé » suffisait à faire
//  entrer la somme dans les recettes, sans qu'aucune pièce n'existe. Une
//  comptabilité ne peut pas reposer sur une case cochée.
//
//  GET  → les factures rattachables, pour que l'agent choisisse LA bonne.
//  POST → le rattachement, tracé : qui, quand, sur quelle pièce.
//  DELETE → le détachement, si l'on s'est trompé de facture.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/** Les deux natures de dossier concernées, et leur table. */
const TABLES = {
    recap: 'myafro_recap_requests',
    dossier: 'dossier_tracking',
} as const
type Nature = keyof typeof TABLES

/**
 * GET — les factures parmi lesquelles choisir.
 *
 * Classées par PERTINENCE et non par date : celles dont l'adresse correspond
 * au client remontent d'abord, parce que c'est presque toujours la bonne. Le
 * reste suit, pour les cas où la facture a été établie à un autre nom (un
 * proche qui règle pour un parent, une entreprise pour son salarié).
 */
export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const url = new URL(request.url)
    const email = (url.searchParams.get('email') || '').trim().toLowerCase()
    const recherche = (url.searchParams.get('q') || '').trim()

    let req = supabase
        .from('documents_financiers')
        .select('id, numero, type, client_nom, client_prenom, client_email, total, currency, statut, created_at')
        .eq('type', 'facture')
        .order('created_at', { ascending: false })
        .limit(120)

    if (recherche) {
        req = req.or(
            `numero.ilike.%${recherche}%,client_nom.ilike.%${recherche}%,`
            + `client_prenom.ilike.%${recherche}%,client_email.ilike.%${recherche}%`,
        )
    }

    const { data, error } = await req
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const liste = data || []
    const correspond = (f: { client_email?: string | null }) =>
        !!email && String(f.client_email || '').toLowerCase() === email

    // Tri stable : les factures à la même adresse d'abord, l'ordre d'origine ensuite.
    const factures = [...liste].sort((a, b) => Number(correspond(b)) - Number(correspond(a)))
        .map(f => ({ ...f, suggeree: correspond(f) }))

    return NextResponse.json({ factures })
}

/** POST — rattache, et ce n'est qu'ALORS que le dossier est réputé payé. */
export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({}))
    const nature = String(body.nature || '') as Nature
    const id = String(body.id || '')
    const factureId = String(body.facture_id || '')

    if (!TABLES[nature]) return NextResponse.json({ error: 'Nature de dossier inconnue.' }, { status: 400 })
    if (!id || !factureId) return NextResponse.json({ error: 'Dossier ou facture manquant.' }, { status: 400 })

    /* La facture doit EXISTER et être une facture — pas un devis. Rattacher un
       devis laisserait croire à un encaissement qui n'a pas eu lieu, ce que
       cette route existe précisément pour empêcher. */
    const { data: facture } = await supabase
        .from('documents_financiers')
        .select('id, numero, type, total, currency, statut')
        .eq('id', factureId)
        .maybeSingle()

    if (!facture) return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 })
    if (facture.type !== 'facture') {
        return NextResponse.json(
            { error: 'Seule une facture peut prouver un encaissement — un devis n’en est pas un.' },
            { status: 400 },
        )
    }

    /* Une même facture ne peut pas justifier deux dossiers : ce serait compter
       deux fois le même encaissement. On vérifie dans LES DEUX tables. */
    for (const [n, table] of Object.entries(TABLES)) {
        const { data: deja } = await supabase
            .from(table).select('id').eq('facture_id', factureId).neq('id', id).limit(1)
        if (deja && deja.length) {
            return NextResponse.json(
                { error: `Cette facture est déjà rattachée à un autre ${n === 'recap' ? 'récap' : 'dossier'}.` },
                { status: 409 },
            )
        }
    }

    const patch: Record<string, unknown> = {
        facture_id: factureId,
        paiement_confirme_le: new Date().toISOString(),
        paiement_confirme_par: garde.userId,
    }
    // Le statut de règlement n'existe que sur les récaps.
    if (nature === 'recap') patch.paiement_statut = 'paye'

    const { error } = await supabase.from(TABLES[nature]).update(patch).eq('id', id)
    if (error) {
        const manque = /column .* does not exist|schema cache/i.test(error.message)
        return NextResponse.json(
            {
                error: manque
                    ? 'Colonnes de rattachement absentes : exécutez la migration 20260904_rattachement_facture.sql.'
                    : error.message,
                migration_requise: manque,
            },
            { status: 500 },
        )
    }

    return NextResponse.json({ success: true, facture })
}

/** DELETE — détache. Le dossier redevient « non prouvé », donc hors recettes. */
export async function DELETE(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const url = new URL(request.url)
    const nature = String(url.searchParams.get('nature') || '') as Nature
    const id = String(url.searchParams.get('id') || '')
    if (!TABLES[nature] || !id) {
        return NextResponse.json({ error: 'Dossier manquant.' }, { status: 400 })
    }

    const patch: Record<string, unknown> = {
        facture_id: null,
        paiement_confirme_le: null,
        paiement_confirme_par: null,
    }
    if (nature === 'recap') patch.paiement_statut = 'en_attente'

    const { error } = await supabase.from(TABLES[nature]).update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, detache: true })
}
