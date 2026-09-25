// ══════════════════════════════════════════════════════════════
//  « Synchroniser » depuis le panel (admin et agents).
//
//  Le bouton appelait directement le cron, protégé par le secret des tâches
//  planifiées que le navigateur n'a pas : réponse 401, et l'écran affichait
//  « undefined dossier(s) synchronisé(s) sur undefined ». Même traitement,
//  derrière une garde d'équipe.
// ══════════════════════════════════════════════════════════════
import { NextRequest } from 'next/server'
import { requireStaff } from '@/lib/api-guard'
import { synchroniserDossiers } from '@/lib/sync-dossiers'

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!
    return synchroniserDossiers()
}
