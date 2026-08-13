import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { getAdminClient, loadAllClients, toSummary, clientKey, matchesKey } from '@/lib/backup/aggregate'

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
        const all = await loadAllClients(sb)

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

        const clients = all.map(rec => ({ key: clientKey(rec), ...toSummary(rec) }))
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

        return NextResponse.json({ clients, totals, generated_at: new Date().toISOString() })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur inconnue'
        return NextResponse.json({ error: `Échec de la sauvegarde : ${msg}` }, { status: 500 })
    }
}
