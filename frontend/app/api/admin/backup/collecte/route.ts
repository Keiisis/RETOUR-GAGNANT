import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { getAdminClient } from '@/lib/backup/aggregate'
import { executerCollecte, lireManifeste, listerHistorique, BUCKET_SAUVEGARDES } from '@/lib/backup/archive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/* ═══════════════════════════════════════════════════════════
   État de la collecte automatique (onglet Sauvegarde).

   GET                        → dernière collecte, rapport, historique
   GET ?historique=AAAA-MM-JJ → lien de téléchargement de l'instantané du jour
   POST                       → « Actualiser maintenant » : même traitement
                                que la nuit, déclenché à la main
═══════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
    const auth = await verifyApiAuth(req, 'admin')
    if (!auth.authenticated) return auth.error!

    const sb = getAdminClient()
    const jour = req.nextUrl.searchParams.get('historique')
    if (jour) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
        const { data, error } = await sb.storage.from(BUCKET_SAUVEGARDES)
            .createSignedUrl(`historique/${jour}.json.gz`, 300, { download: `sauvegarde-brute-${jour}.json.gz` })
        if (error || !data) return NextResponse.json({ error: 'Instantané introuvable' }, { status: 404 })
        return NextResponse.json({ url: data.signedUrl })
    }

    const manifeste = await lireManifeste(sb)
    if (!manifeste) return NextResponse.json({ manifeste: null, historique: [] })
    return NextResponse.json({
        manifeste: {
            derniere_collecte: manifeste.derniere_collecte,
            duree_ms: manifeste.duree_ms,
            origine: manifeste.origine,
            clients: manifeste.clients.length,
            en_attente: manifeste.en_attente.length,
            rapport: manifeste.rapport,
            non_couvertes: manifeste.non_couvertes,
            non_rattachees: manifeste.non_rattachees,
            erreurs: manifeste.erreurs,
            fichiers_manquants: manifeste.clients.reduce((n, c) => n + c.fichiers_manquants.length, 0),
            complet: manifeste.complet
                ? { construit_le: manifeste.complet.construit_le, parties: manifeste.complet.parties.length, taille: manifeste.complet.parties.reduce((n, p) => n + p.taille, 0) }
                : null,
            empreintes: Object.fromEntries(manifeste.clients.map(c => [c.key, c.construit_le])),
        },
        historique: await listerHistorique(sb).catch(() => []),
    })
}

export async function POST(req: NextRequest) {
    const auth = await verifyApiAuth(req, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const { manifeste, reconstruits, inchanges } = await executerCollecte(getAdminClient(), {
            origine: 'manuel',
            budgetMs: 230_000,
        })
        return NextResponse.json({
            success: true,
            reconstruits,
            inchanges,
            en_attente: manifeste.en_attente.length,
            erreurs: manifeste.erreurs,
            derniere_collecte: manifeste.derniere_collecte,
        })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Collecte impossible' }, { status: 500 })
    }
}
