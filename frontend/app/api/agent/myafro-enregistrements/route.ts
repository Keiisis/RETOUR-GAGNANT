// ══════════════════════════════════════════════════════════════
//  Enregistrements MyAfroOrigins : liste et fiche libre.
//
//  GET  ?nature=nationalite|recap|libre → résumés SANS mot de passe
//       (marqueur « Transmis sur MyAfroOrigins », filtres des listes).
//  POST { saisie } → fiche libre (client sans dossier dans nos fichiers).
//  Sous /api/agent : agents ET admins (middleware + verifyApiAuth).
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { estNature, validerSaisie, type SaisieEnregistrement } from '@/lib/myafro-enregistrement'
import { auteur, db, enregistrer, listerEnregistrements, sansSecret } from '@/lib/myafro-enregistrement-serveur'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!
    const nature = request.nextUrl.searchParams.get('nature')
    if (!estNature(nature)) return NextResponse.json({ error: 'nature invalide' }, { status: 400 })
    try {
        return NextResponse.json({ enregistrements: await listerEnregistrements(nature) }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Lecture impossible' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!
    const body = await request.json().catch(() => null) as { saisie?: Partial<SaisieEnregistrement> } | null
    const v = validerSaisie(body?.saisie || {})
    if (!v.ok) return NextResponse.json({ error: 'Saisie incomplète', erreurs: v.erreurs }, { status: 400 })
    try {
        const sb = db()
        const e = await enregistrer('libre', crypto.randomUUID(), null, v.valeur, await auteur(sb, auth.userId), sb)
        return NextResponse.json({ enregistrement: sansSecret(e) }, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Enregistrement impossible' }, { status: 500 })
    }
}
