// ══════════════════════════════════════════════════════════════
//  CRON : collecte et classement des dossiers clients, chaque nuit.
//
//  01h00 UTC — volontairement AVANT `data-lifecycle` (02h00), qui efface
//  les pièces traitées de plus de 90 jours : elles sont archivées avant
//  d'être effacées de la base.
//
//  Détail du traitement : lib/backup/archive.ts.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { executerCron } from '@/lib/cron-journal'
import { getAdminClient } from '@/lib/backup/aggregate'
import { executerCollecte } from '@/lib/backup/archive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function lancer() {
    const { manifeste, reconstruits, inchanges } = await executerCollecte(getAdminClient(), {
        origine: 'nuit',
        budgetMs: 230_000,
    })
    const tablesEnErreur = manifeste.rapport.filter(r => r.erreur).map(r => r.table)
    const ok = !manifeste.erreurs.length && !tablesEnErreur.length
    return NextResponse.json({
        ok,
        clients: manifeste.clients.length,
        reconstruits,
        inchanges,
        en_attente: manifeste.en_attente.length,
        tables_en_erreur: tablesEnErreur,
        tables_non_couvertes: manifeste.non_couvertes.map(t => t.table),
        erreurs: manifeste.erreurs,
        duree_ms: manifeste.duree_ms,
    }, { status: ok ? 200 : 207 })
}

export async function GET(request: NextRequest) {
    return executerCron('sauvegarde-clients', request, lancer)
}
