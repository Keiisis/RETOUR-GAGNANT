import { executerCron } from '@/lib/cron-journal'
import { synchroniserDossiers } from '@/lib/sync-dossiers'

// POST /api/cron/sync-dossiers — traitement dans lib/sync-dossiers.ts
export async function POST(request: Request) {
    return executerCron('sync-dossiers', request, synchroniserDossiers)
}

// Également accessible en GET pour les appels Vercel Cron
export async function GET(request: Request) {
    return POST(request)
}
