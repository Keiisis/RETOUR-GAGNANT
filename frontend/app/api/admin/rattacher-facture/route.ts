// ══════════════════════════════════════════════════════════════
//  RATTACHER un dossier saisi à la main à une FACTURE RÉELLEMENT ÉMISE.
//
//  Un récap MyAfroOrigins pris au téléphone, un dossier de nationalité ouvert
//  par un agent ou par code d'invitation : dans les trois cas, le montant et le
//  statut de règlement étaient DÉCLARÉS. Cocher « payé » suffisait à faire
//  entrer la somme dans les recettes, sans qu'aucune pièce n'existe. Une
//  comptabilité ne peut pas reposer sur une case cochée.
//
//  GET  → les factures rattachables, pour que l'agent choisisse LA bonne ;
//         avec `nature=nationalite&refs=…`, les justificatifs déjà posés.
//  POST → le rattachement, tracé : qui, quand, sur quelle pièce.
//  DELETE → le détachement, si l'on s'est trompé de facture.
//
//  DEUX MÉCANISMES, UNE MÊME RÈGLE.
//  · récap / dossier_tracking : colonne `facture_id` sur le dossier
//    (migration 20260904).
//  · dossier de NATIONALITÉ : la facture porte `source_ref =
//    'nationality:RG-NAT-…'`. C'est la clé que la facturation automatique du
//    formulaire pose déjà, et l'index UNIQUE qui la protège interdit en base
//    qu'un même dossier soit justifié par deux factures. Aucune migration.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { logAudit } from '@/lib/audit-compta'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/** Les natures qui portent le lien sur le DOSSIER (colonne `facture_id`). */
const TABLES = {
    recap: 'myafro_recap_requests',
    dossier: 'dossier_tracking',
} as const
type NatureTable = keyof typeof TABLES
type Nature = NatureTable | 'nationalite'

const NATURES: readonly Nature[] = ['recap', 'dossier', 'nationalite']

/** Moyens pour lesquels AUCUNE facture n'a été émise automatiquement. */
const MOYENS_A_JUSTIFIER = ['invitation', 'manuel']

const cleNationalite = (ref: string) => `nationality:${ref}`

const COLONNES_FACTURE = 'id, numero, type, client_nom, client_prenom, client_email, total, currency, status, source_ref, created_at'

/** Adresse de l'acteur, pour que la trace dise QUI et pas seulement un identifiant. */
async function emailActeur(userId?: string): Promise<string | null> {
    if (!userId) return null
    try {
        const { data } = await supabase.auth.admin.getUserById(userId)
        return data?.user?.email || null
    } catch { return null }
}

/** Ajoute une ligne datée aux notes internes du dossier, sans écraser l'existant. */
async function tracerDansDossier(id: string, ligne: string) {
    const { data } = await supabase.from('nationality_applications').select('admin_notes').eq('id', id).maybeSingle()
    const avant = String(data?.admin_notes || '').trim()
    const horodatage = new Date().toISOString().slice(0, 16).replace('T', ' ')
    await supabase.from('nationality_applications')
        .update({ admin_notes: `${avant ? `${avant}\n` : ''}[${horodatage}] ${ligne}` })
        .eq('id', id)
}

/**
 * Une facture déjà rattachée ailleurs par `facture_id` (récap, dossier de
 * suivi) ne peut pas justifier un second dossier. Les colonnes n'existent
 * qu'après la migration 20260904 : leur absence vaut « aucun rattachement ».
 */
async function factureDejaPriseParFactureId(factureId: string, saufId?: string): Promise<string | null> {
    for (const [n, table] of Object.entries(TABLES)) {
        let q = supabase.from(table).select('id').eq('facture_id', factureId).limit(1)
        if (saufId) q = q.neq('id', saufId)
        const { data, error } = await q
        if (error) continue
        if (data && data.length) return n === 'recap' ? 'un récap MyAfroOrigins' : 'un autre dossier'
    }
    return null
}

/**
 * GET — les factures parmi lesquelles choisir.
 *
 * Classées par PERTINENCE et non par date : celles dont l'adresse correspond
 * au client remontent d'abord, parce que c'est presque toujours la bonne. Le
 * reste suit, pour les cas où la facture a été établie à un autre nom (un
 * proche qui règle pour un parent, une entreprise pour son salarié).
 *
 * `nature=nationalite&refs=A,B` renvoie à la place les justificatifs posés,
 * pour que la liste des dossiers affiche d'un coup d'œil qui est prouvé.
 */
export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const url = new URL(request.url)

    const refs = (url.searchParams.get('refs') || '')
        .split(',').map(r => r.trim()).filter(r => /^[A-Z0-9-]{4,40}$/i.test(r)).slice(0, 300)
    if (url.searchParams.get('nature') === 'nationalite' && url.searchParams.has('refs')) {
        if (!refs.length) return NextResponse.json({ liens: {} })
        const { data, error } = await supabase
            .from('documents_financiers')
            .select('id, numero, total, currency, status, source_ref, paid_at')
            .eq('type', 'facture')
            .in('source_ref', refs.map(cleNationalite))
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        const liens: Record<string, unknown> = {}
        for (const f of data || []) liens[String(f.source_ref).slice('nationality:'.length)] = f
        return NextResponse.json({ liens })
    }

    const email = (url.searchParams.get('email') || '').trim().toLowerCase()
    // Les caractères qui structurent un filtre PostgREST sont retirés : une
    // recherche ne doit pas pouvoir réécrire la requête.
    const recherche = (url.searchParams.get('q') || '').trim().replace(/[,()%*\\]/g, ' ').slice(0, 60)

    let req = supabase
        .from('documents_financiers')
        .select(COLONNES_FACTURE)
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

    if (!NATURES.includes(nature)) return NextResponse.json({ error: 'Nature de dossier inconnue.' }, { status: 400 })
    if (!id || !factureId) return NextResponse.json({ error: 'Dossier ou facture manquant.' }, { status: 400 })

    /* La facture doit EXISTER et être une facture — pas un devis. Rattacher un
       devis laisserait croire à un encaissement qui n'a pas eu lieu, ce que
       cette route existe précisément pour empêcher. */
    const { data: facture } = await supabase
        .from('documents_financiers')
        .select('id, numero, type, total, currency, status, source_ref')
        .eq('id', factureId)
        .maybeSingle()

    if (!facture) return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 })
    if (facture.type !== 'facture') {
        return NextResponse.json(
            { error: 'Seule une facture peut prouver un encaissement — un devis n’en est pas un.' },
            { status: 400 },
        )
    }

    if (nature === 'nationalite') return rattacherNationalite(garde, id, facture)

    /* Une facture qui justifie déjà un dossier de nationalité ne peut pas en
       justifier un second : ce serait compter deux fois le même encaissement. */
    if (String(facture.source_ref || '').startsWith('nationality:')) {
        return NextResponse.json(
            { error: `Cette facture justifie déjà le dossier ${String(facture.source_ref).slice(12)}.` },
            { status: 409 },
        )
    }
    const prise = await factureDejaPriseParFactureId(factureId, id)
    if (prise) {
        return NextResponse.json({ error: `Cette facture est déjà rattachée à ${prise}.` }, { status: 409 })
    }

    const patch: Record<string, unknown> = {
        facture_id: factureId,
        paiement_confirme_le: new Date().toISOString(),
        paiement_confirme_par: garde.userId,
    }
    // Le statut de règlement n'existe que sur les récaps.
    if (nature === 'recap') patch.paiement_statut = 'paye'

    const { error } = await supabase.from(TABLES[nature as NatureTable]).update(patch).eq('id', id)
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

type Garde = Awaited<ReturnType<typeof requireStaff>>

/**
 * Justifie un dossier de nationalité par une facture.
 *
 * Le lien est posé SUR LA FACTURE (`source_ref`), et la mise à jour est
 * conditionnelle (`source_ref IS NULL`) : deux agents qui cliquent en même
 * temps sur la même facture ne peuvent pas la faire servir deux fois.
 */
async function rattacherNationalite(
    garde: Garde,
    id: string,
    facture: { id: string; numero: string; total: number; currency: string | null; source_ref: string | null },
) {
    const { data: dossier } = await supabase
        .from('nationality_applications')
        .select('id, application_ref, payment_method, amount, currency')
        .eq('id', id)
        .maybeSingle()
    if (!dossier?.application_ref) return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 })

    const cle = cleNationalite(dossier.application_ref)

    // Déjà fait : l'opération est idempotente, pas une erreur.
    if (facture.source_ref === cle) return NextResponse.json({ success: true, facture, deja: true })

    if (facture.source_ref) {
        const cible = String(facture.source_ref)
        return NextResponse.json(
            {
                error: cible.startsWith('nationality:')
                    ? `Cette facture justifie déjà le dossier ${cible.slice(12)}.`
                    : 'Cette facture est déjà liée à une autre opération (commande, devis ou lien de paiement).',
            },
            { status: 409 },
        )
    }

    const prise = await factureDejaPriseParFactureId(facture.id)
    if (prise) {
        return NextResponse.json({ error: `Cette facture est déjà rattachée à ${prise}.` }, { status: 409 })
    }

    const { data: existante } = await supabase
        .from('documents_financiers').select('numero').eq('source_ref', cle).maybeSingle()
    if (existante) {
        return NextResponse.json(
            { error: `Ce dossier est déjà justifié par la facture ${existante.numero}. Détachez-la d’abord.` },
            { status: 409 },
        )
    }

    const { data: pose, error } = await supabase
        .from('documents_financiers')
        .update({ source_ref: cle })
        .eq('id', facture.id)
        .is('source_ref', null)
        .select('id')
    if (error) {
        const doublon = error.code === '23505'
        return NextResponse.json(
            { error: doublon ? 'Ce dossier vient d’être justifié par une autre facture.' : error.message },
            { status: doublon ? 409 : 500 },
        )
    }
    if (!pose?.length) {
        return NextResponse.json({ error: 'Cette facture vient d’être liée ailleurs. Rechargez la liste.' }, { status: 409 })
    }

    const email = await emailActeur(garde.userId)
    await logAudit(supabase, {
        table: 'documents_financiers',
        recordId: facture.id,
        action: 'update',
        acteur: { userId: garde.userId, email, role: garde.role },
        avant: { source_ref: null },
        apres: { source_ref: cle },
        motif: `Justification du paiement du dossier ${dossier.application_ref} (${dossier.payment_method || 'sans moyen'})`,
    })
    await tracerDansDossier(
        id,
        `Paiement justifié par la facture ${facture.numero} (${facture.total} ${facture.currency || 'XOF'})${email ? ` — ${email}` : ''}`,
    )

    return NextResponse.json({ success: true, facture: { ...facture, source_ref: cle } })
}

/** DELETE — détache. Le dossier redevient « non prouvé », donc hors recettes. */
export async function DELETE(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const url = new URL(request.url)
    const nature = String(url.searchParams.get('nature') || '') as Nature
    const id = String(url.searchParams.get('id') || '')
    if (!NATURES.includes(nature) || !id) {
        return NextResponse.json({ error: 'Dossier manquant.' }, { status: 400 })
    }

    if (nature === 'nationalite') {
        const { data: dossier } = await supabase
            .from('nationality_applications')
            .select('id, application_ref, payment_method')
            .eq('id', id)
            .maybeSingle()
        if (!dossier?.application_ref) return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 })

        /* Seul un justificatif posé À LA MAIN se détache. La facture émise
           automatiquement après un paiement en ligne porte la même clé : la
           lui retirer casserait l'idempotence de la facturation, et un rejeu
           du paiement créerait une seconde facture. */
        if (!MOYENS_A_JUSTIFIER.includes(String(dossier.payment_method || ''))) {
            return NextResponse.json(
                { error: 'Cette facture a été émise automatiquement au paiement : elle ne se détache pas.' },
                { status: 400 },
            )
        }

        const cle = cleNationalite(dossier.application_ref)
        const { data: retire, error } = await supabase
            .from('documents_financiers')
            .update({ source_ref: null })
            .eq('source_ref', cle)
            .select('id, numero')
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const email = await emailActeur(garde.userId)
        for (const f of retire || []) {
            await logAudit(supabase, {
                table: 'documents_financiers',
                recordId: f.id,
                action: 'update',
                acteur: { userId: garde.userId, email, role: garde.role },
                avant: { source_ref: cle },
                apres: { source_ref: null },
                motif: `Détachement du justificatif du dossier ${dossier.application_ref}`,
            })
            await tracerDansDossier(id, `Facture ${f.numero} détachée : paiement de nouveau à justifier${email ? ` — ${email}` : ''}`)
        }
        return NextResponse.json({ success: true, detache: true })
    }

    const patch: Record<string, unknown> = {
        facture_id: null,
        paiement_confirme_le: null,
        paiement_confirme_par: null,
    }
    if (nature === 'recap') patch.paiement_statut = 'en_attente'

    const { error } = await supabase.from(TABLES[nature as NatureTable]).update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, detache: true })
}
