import { NextRequest, NextResponse } from 'next/server'
import { executerCron } from '@/lib/cron-journal'
import { requireCron } from '@/lib/api-guard'

const CRON_SECRET = process.env.CRON_SECRET || ''
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

/**
 * GET /api/cron/genealogie-check-expired
 *
 * Cron Vercel : déclenche le scan des documents généalogiques bientôt expirés
 * et crée les notifications associées dans la table `notifications`.
 *
 * Wrapper léger vers POST /api/genealogie/check-expired — évite la duplication
 * de logique. Le secret CRON est transmis pour autoriser la route cible.
 *
 * Vercel cron envoie GET ; on accepte aussi POST pour test manuel.
 */
async function runCheckExpired() {
    const targetUrl = `${SITE_URL}/api/genealogie/check-expired`
    const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CRON_SECRET}`,
        },
        body: JSON.stringify({}),
    })

    const data = await res.json().catch(() => ({}))
    return NextResponse.json({
        triggered_at: new Date().toISOString(),
        status: res.status,
        ...data,
    }, { status: res.status })
}

export async function GET(request: NextRequest) {
    // Vérifier que c'est bien Vercel cron qui appelle (présence du secret)
    return executerCron('genealogie-check-expired', request, async () => {
        return runCheckExpired()
    })
}

export async function POST(request: NextRequest) {
    const refus = requireCron(request)
    if (refus) return refus
    return runCheckExpired()
}
