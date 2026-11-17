// ══════════════════════════════════════════════════════════════
// Fiches de suivi client RGB (agents et admins)
//
//  GET  ?q=&page=  → liste, recherche sur numéro, nom, e-mail, téléphone
//  POST            → nouvelle fiche saisie à la main (numéro attribué par la base)
//
// Les fiches des inscrits sont créées par la base elle-même
// (supabase_fiches_suivi_client.sql), pas par cette route.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { aujourdhuiCotonou, nettoyerSaisie } from '@/lib/fiche-suivi'

export const dynamic = 'force-dynamic'

const PAR_PAGE = 50
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const url = new URL(request.url)
    // Les caractères de syntaxe PostgREST (virgule, parenthèses, %, *) sont retirés de la recherche.
    const q = (url.searchParams.get('q') || '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 80)
    const page = Math.max(0, Number.parseInt(url.searchParams.get('page') || '0', 10) || 0)

    let requete = db().from('fiches_suivi_client').select('*', { count: 'exact' })
    if (q) requete = requete.or(['numero', 'nom_complet', 'email', 'telephone'].map(c => `${c}.ilike.%${q}%`).join(','))
    const { data, count, error } = await requete
        .order('created_at', { ascending: false })
        .range(page * PAR_PAGE, page * PAR_PAGE + PAR_PAGE - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(
        { fiches: data ?? [], total: count ?? 0, parPage: PAR_PAGE },
        { headers: { 'Cache-Control': 'private, no-store' } },
    )
}

export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const corps = await request.json().catch(() => null)
    const saisie = nettoyerSaisie({ date_fiche: aujourdhuiCotonou(), statut_dossier: 'nouveau', ...(corps ?? {}) })
    if (!saisie.ok) return NextResponse.json({ error: saisie.erreur }, { status: 400 })

    const { data, error } = await db()
        .from('fiches_suivi_client')
        .insert({ ...saisie.valeurs, source: 'manuel', cree_par: auth.userId ?? null })
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ fiche: data }, { status: 201 })
}
