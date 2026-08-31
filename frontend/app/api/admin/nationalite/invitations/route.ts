import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { genererCode, normaliserCode } from '@/lib/nationality-invitation'

/* ═══════════════════════════════════════════════════════════════
   ADMINISTRATION DES CODES D'INVITATION

   GET    — liste les codes, du plus récent au plus ancien
   POST   — en génère un, avec sa portée et son échéance
   PATCH  — le révoque (jamais de suppression : un code offert doit rester
            explicable, même annulé)

   Un code vaut le prix d'une prestation. Sa création est donc réservée au
   personnel et porte le nom de son auteur : « qui a offert ce dossier ? »
   doit avoir une réponse.
   ═══════════════════════════════════════════════════════════════ */

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

const texte = (v: unknown, max = 200): string | null => {
    const s = String(v ?? '').replace(/[\r\n]+/g, ' ').trim()
    return s ? s.slice(0, max) : null
}

export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const { data, error } = await supabase
        .from('nationality_invitation_codes')
        .select('*')
        .order('cree_le', { ascending: false })
        .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ codes: data || [] })
}

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({})) as Record<string, unknown>

    const couvreDossier = body.couvre_dossier !== false
    const couvreAncestrale = body.couvre_ancestrale === true
    if (!couvreDossier && !couvreAncestrale) {
        return NextResponse.json(
            { error: 'Un code doit couvrir au moins une prestation.' },
            { status: 400 },
        )
    }

    /* Montants : ce que l'agence renonce à facturer. Repris de la
       configuration quand ils ne sont pas précisés, pour que le suivi de ce
       qui a été offert reste juste. */
    const { data: fsRow } = await supabase
        .from('page_sections').select('content')
        .eq('page', 'nationalite').eq('section_key', 'form_settings').maybeSingle()
    const fs = (fsRow?.content || {}) as Record<string, unknown>
    const nombre = (v: unknown, repli: unknown): number | null => {
        const n = Number(v ?? repli)
        return isFinite(n) && n > 0 ? n : null
    }

    /* Échéance : trente jours par défaut. Un code sans limite finit par
       traîner dans une boîte mail et resurgir un an plus tard. */
    const joursValidite = Number(body.jours_validite)
    const jours = isFinite(joursValidite) && joursValidite > 0 ? Math.min(joursValidite, 365) : 30

    /* Collision quasi impossible (32^12), mais la base a le dernier mot :
       on réessaie plutôt que de rendre une erreur incompréhensible. */
    let derniereErreur = ''
    for (let essai = 0; essai < 5; essai++) {
        const code = genererCode()
        const { data, error } = await supabase
            .from('nationality_invitation_codes')
            .insert([{
                code,
                couvre_dossier: couvreDossier,
                couvre_ancestrale: couvreAncestrale,
                montant_dossier: couvreDossier ? nombre(body.montant_dossier, fs.amount) : null,
                montant_ancestrale: couvreAncestrale ? nombre(body.montant_ancestrale, fs.recherche_ancestrale_amount) : null,
                devise: texte(body.devise, 8)?.toUpperCase() || String(fs.currency || 'EUR').toUpperCase(),
                email_cible: texte(body.email_cible, 160)?.toLowerCase() || null,
                note: texte(body.note, 500),
                expire_le: new Date(Date.now() + jours * 864e5).toISOString(),
                cree_par: garde.userId || null,
                cree_par_email: texte(body.cree_par_email, 160),
            }])
            .select('*')
            .single()

        if (!error && data) return NextResponse.json({ success: true, code: data })
        derniereErreur = error?.message || 'inconnue'
        if (!/duplicate|unique/i.test(derniereErreur)) break
    }

    return NextResponse.json(
        { error: `Génération impossible : ${derniereErreur}` },
        { status: 500 },
    )
}

export async function PATCH(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const code = normaliserCode(body.code)
    if (!code) return NextResponse.json({ error: 'Code absent ou mal formé.' }, { status: 400 })

    /* On ne révoque QUE ce qui est encore actif : révoquer un code déjà
       utilisé effacerait la trace de ce qu'il a servi à offrir. */
    const { data, error } = await supabase
        .from('nationality_invitation_codes')
        .update({ statut: 'revoque' })
        .eq('code', code)
        .eq('statut', 'actif')
        .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) {
        return NextResponse.json(
            { error: 'Ce code n’est plus actif : il a déjà été utilisé ou révoqué.' },
            { status: 409 },
        )
    }
    return NextResponse.json({ success: true, revoque: code })
}
