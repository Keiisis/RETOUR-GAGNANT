import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { getAdminClient } from '@/lib/backup/aggregate'
import { exporter } from '@/lib/backup/archive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/* ═══════════════════════════════════════════════════════════
   EXPORT SAUVEGARDE

   GET /api/admin/backup/export            → archive de TOUS les clients
   GET /api/admin/backup/export?client=KEY → archive d'un seul client

   Répond par des LIENS de téléchargement (valables 1 h), pas par le
   fichier : une réponse de fonction Vercel est plafonnée à ~4,5 Mo, et
   l'archive complète en pèse des dizaines. Au-delà de 38 Mo, l'archive est
   livrée en plusieurs parties autonomes.

   Données toujours relues en direct ; détail dans lib/backup/archive.ts.
═══════════════════════════════════════════════════════════ */
export async function GET(req: NextRequest) {
    const auth = await verifyApiAuth(req, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const cle = req.nextUrl.searchParams.get('client') || undefined
        const res = await exporter(getAdminClient(), { cle })
        if (!res) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
        return NextResponse.json({
            liens: res.liens,
            clients: res.clients,
            repris: res.repris,
            reconstruits: res.reconstruits,
            non_inclus: res.nonInclus,
            deja_pret: res.deja_pret,
        }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur inconnue'
        return NextResponse.json({ error: `Échec de l'export : ${msg}` }, { status: 500 })
    }
}
