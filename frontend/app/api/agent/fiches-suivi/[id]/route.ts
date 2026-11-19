// ══════════════════════════════════════════════════════════════
// Une fiche de suivi client RGB
//
//  GET    → la fiche
//  PATCH  → mise à jour (agents et admins) ; numéro, client et source figés
//  Pas de DELETE : une fiche ne se supprime pas (décision de l'agence, 18/11/2026).
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { nettoyerSaisie } from '@/lib/fiche-suivi'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!
    const { id } = await params
    if (!UUID.test(id)) return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })

    const { data, error } = await db().from('fiches_suivi_client').select('*').eq('id', id).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 })
    return NextResponse.json({ fiche: data }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!
    const { id } = await params
    if (!UUID.test(id)) return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })

    const saisie = nettoyerSaisie(await request.json().catch(() => null))
    if (!saisie.ok) return NextResponse.json({ error: saisie.erreur }, { status: 400 })

    const { data, error } = await db().from('fiches_suivi_client').update(saisie.valeurs).eq('id', id).select('*').maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 })
    return NextResponse.json({ fiche: data })
}
