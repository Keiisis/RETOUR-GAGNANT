// ══════════════════════════════════════════════════════════════
//  Frais de constitution de dossier LOGEMENT.
//
//  C'est la rémunération de Retour Gagnant sur ce service : RGB ne vend pas
//  le bien (les prix des logements sont ceux du partenaire SIMAU, affichés à
//  titre d'information). Le client paie la constitution de son dossier, que
//  nous montons puis transmettons à SIMAU.
//
//  Stocké dans page_sections (page='logement', section_key='form_settings'),
//  même convention que le formulaire de nationalité : aucun prix codé en dur,
//  le site ET l'application mobile lisent cette valeur.
//
//  GET   : public (le site et l'app doivent afficher le montant).
//  PATCH : réservé aux gestionnaires Logement (admins + agent habilité),
//          via la même garde que le contenu marketing.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireLogementManager } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
)

const PAGE = 'logement'
const SECTION = 'form_settings'
/** Repli si la configuration n'existe pas encore en base. */
const FALLBACK = { amount: 250, currency: 'EUR' }

export async function GET() {
    const { data, error } = await supabase
        .from('page_sections')
        .select('content')
        .eq('page', PAGE)
        .eq('section_key', SECTION)
        .maybeSingle()

    if (error) return NextResponse.json(FALLBACK)

    const content = (data?.content || {}) as Record<string, unknown>
    const amount = Number(content.dossier_amount)
    return NextResponse.json({
        amount: isFinite(amount) && amount > 0 ? amount : FALLBACK.amount,
        currency: String(content.dossier_currency || FALLBACK.currency),
    })
}

export async function PATCH(request: NextRequest) {
    const garde = await requireLogementManager(request)
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({}))
    const amount = Number(body.amount)
    if (!isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 })
    }
    const currency = String(body.currency || 'EUR').toUpperCase()
    if (!['EUR', 'XOF', 'USD', 'GBP'].includes(currency)) {
        return NextResponse.json({ error: 'Devise non prise en charge.' }, { status: 400 })
    }

    const { data: existing } = await supabase
        .from('page_sections')
        .select('id, content')
        .eq('page', PAGE)
        .eq('section_key', SECTION)
        .maybeSingle()

    // Fusion : on ne veut pas écraser d'autres clés éventuelles de ce bloc.
    const content = {
        ...((existing?.content || {}) as Record<string, unknown>),
        dossier_amount: Math.round(amount * 100) / 100,
        dossier_currency: currency,
    }

    if (existing?.id) {
        const { error } = await supabase
            .from('page_sections')
            .update({ content, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
        const { error } = await supabase.from('page_sections').insert({
            page: PAGE,
            section_key: SECTION,
            title: 'Paramètres du dossier logement',
            content,
            sort_order: 1,
            is_active: true,
        })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, amount: content.dossier_amount, currency })
}
