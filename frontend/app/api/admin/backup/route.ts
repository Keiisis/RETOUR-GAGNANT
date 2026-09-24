import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { getAdminClient, collecter, toSummary, clientKey, matchesKey, empreinte } from '@/lib/backup/aggregate'
import { lireManifeste } from '@/lib/backup/archive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ═══════════════════════════════════════════════════════════
   GET /api/admin/backup            → liste résumée de tous les clients
   GET /api/admin/backup?client=KEY → détail complet d'un client
   (KEY = "id:<uuid>" ou "email:<email>")
═══════════════════════════════════════════════════════════ */
export async function GET(req: NextRequest) {
    const auth = await verifyApiAuth(req, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const sb = getAdminClient()
        const collecte = await collecter(sb)
        const all = collecte.clients

        const key = req.nextUrl.searchParams.get('client')
        if (key) {
            const rec = all.find(r => matchesKey(r, key))
            if (!rec) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
            return NextResponse.json({
                client: {
                    key: clientKey(rec),
                    id: rec.id,
                    email: rec.email,
                    nom: rec.nom,
                    prenom: rec.prenom,
                    phone: rec.phone,
                    ville: rec.ville,
                    pays: rec.pays,
                    created_at: rec.created_at,
                    hasAccount: rec.hasAccount,
                    profile: rec.profile,
                    data: rec.data,
                    discussions: rec.discussions,
                },
                summary: toSummary(rec),
            })
        }

        /* « archive à jour » : le dossier préparé par la collecte automatique
           correspond encore exactement aux données. Sinon il sera reconstruit
           à l'export — c'est normal pour un client modifié dans la journée. */
        const manifeste = await lireManifeste(sb)
        const archives = new Map((manifeste?.clients || []).map(e => [e.key, e]))
        const clients = all.map(rec => {
            const a = archives.get(clientKey(rec))
            return {
                key: clientKey(rec),
                ...toSummary(rec),
                archive: a ? { a_jour: a.empreinte === empreinte(rec), construit_le: a.construit_le } : null,
            }
        })
        const totals = clients.reduce(
            (acc, c) => {
                acc.clients += 1
                acc.comptes += c.hasAccount ? 1 : 0
                acc.dossiers += c.counts.dossiers
                acc.nationalite += c.counts.nationalite
                acc.commandes += c.counts.commandes
                acc.factures += c.counts.factures
                acc.paiements += c.counts.paiements
                return acc
            },
            { clients: 0, comptes: 0, dossiers: 0, nationalite: 0, commandes: 0, factures: 0, paiements: 0 }
        )

        return NextResponse.json({
            clients, totals, generated_at: new Date().toISOString(),
            collecte: {
                duree_ms: collecte.duree_ms,
                tables_en_erreur: collecte.rapport.filter(r => r.erreur).map(r => ({ table: r.table, erreur: r.erreur })),
                non_couvertes: collecte.nonCouvertes,
                non_rattachees: Object.values(collecte.nonRattachees).reduce((n, r) => n + r.length, 0),
            },
        })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur inconnue'
        return NextResponse.json({ error: `Échec de la sauvegarde : ${msg}` }, { status: 500 })
    }
}
