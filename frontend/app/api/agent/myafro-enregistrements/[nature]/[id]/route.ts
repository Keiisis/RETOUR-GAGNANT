// ══════════════════════════════════════════════════════════════
//  Enregistrement MyAfroOrigins d'UN dossier.
//
//  GET    → enregistrement complet (mot de passe compris, pour l'équipe) +
//           pré-remplissage tiré du dossier source s'il n'existe pas encore.
//  PUT    { saisie, passerEnTraitement? } → crée / met à jour ; statut tracé.
//  DELETE → admin seulement ; la fiche part en corbeille (jamais effacée).
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { civiliteDepuisGenre, estNature, validerSaisie, type SaisieEnregistrement } from '@/lib/myafro-enregistrement'
import { auteur, db, enregistrer, lireDossierSource, lireEnregistrement, mettreEnCorbeille, sansSecret } from '@/lib/myafro-enregistrement-serveur'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Ctx = { params: Promise<{ nature: string; id: string }> }

async function cible(ctx: Ctx) {
    const { nature, id } = await ctx.params
    if (!estNature(nature) || !UUID.test(id)) return null
    return { nature, id }
}

export async function GET(request: NextRequest, ctx: Ctx) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!
    const c = await cible(ctx)
    if (!c) return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
    const sb = db()
    const [e, source] = await Promise.all([lireEnregistrement(c.nature, c.id, sb), lireDossierSource(sb, c.nature, c.id)])
    if (!e && !source) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
    return NextResponse.json({
        enregistrement: e,
        // Pré-remplissage seulement : l'équipe corrige avec ce que le client a réellement utilisé sur MyAfroOrigins.
        suggestion: source ? { nom: source.nom, prenom: source.prenom, emailSuivi: source.email, numeroDossier: source.myafroReference || '', civilite: civiliteDepuisGenre(source.genre), referenceRgb: source.reference } : null,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PUT(request: NextRequest, ctx: Ctx) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!
    const c = await cible(ctx)
    if (!c) return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
    const body = await request.json().catch(() => null) as { saisie?: Partial<SaisieEnregistrement>; passerEnTraitement?: boolean } | null
    const v = validerSaisie(body?.saisie || {})
    if (!v.ok) return NextResponse.json({ error: 'Saisie incomplète', erreurs: v.erreurs }, { status: 400 })
    const sb = db()
    const source = await lireDossierSource(sb, c.nature, c.id)
    if (c.nature !== 'libre' && !source) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
    if (c.nature === 'libre' && !(await lireEnregistrement('libre', c.id, sb))) return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 })
    try {
        const e = await enregistrer(c.nature, c.id, source, v.valeur, await auteur(sb, auth.userId), sb)
        // Transmis sur la plateforme = le dossier est en cours de traitement chez nous (seulement depuis « soumis »).
        if (body?.passerEnTraitement && c.nature === 'nationalite' && source?.statut === 'soumis') {
            await sb.from('nationality_applications').update({ status: 'en_traitement', updated_at: new Date().toISOString() }).eq('id', c.id).eq('status', 'soumis')
        }
        return NextResponse.json({ enregistrement: sansSecret(e) })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Enregistrement impossible' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!
    const c = await cible(ctx)
    if (!c) return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
    if (!(await lireEnregistrement(c.nature, c.id))) return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 })
    try {
        await mettreEnCorbeille(c.nature, c.id)
        return NextResponse.json({ ok: true })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Retrait impossible' }, { status: 500 })
    }
}
