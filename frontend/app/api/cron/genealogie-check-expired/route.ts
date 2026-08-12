import { NextRequest, NextResponse } from 'next/server'
import { executerCron } from '@/lib/cron-journal'
import { requireCron } from '@/lib/api-guard'
import { POST as checkExpiredHandler } from '@/app/api/genealogie/check-expired/route'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

/**
 * GET /api/cron/genealogie-check-expired
 *
 * Cron Vercel : déclenche le scan des documents généalogiques bientôt expirés
 * et crée les notifications associées dans la table `notifications`.
 *
 * Wrapper léger vers POST /api/genealogie/check-expired : évite la duplication
 * de logique. Le secret CRON est transmis pour autoriser la route cible.
 *
 * Vercel cron envoie GET ; on accepte aussi POST pour test manuel.
 */
async function runCheckExpired() {
    // APPEL DIRECT, pas de requête HTTP vers notre propre domaine.
    //
    // La version précédente faisait un fetch sur ${SITE_URL}/api/genealogie/
    // check-expired. Cette requête ressort de la fonction Vercel et rentre par
    // le bord : elle traverse donc le WAF, qui la bloquait (403 « Requête
    // bloquée par le pare-feu applicatif »). Le cron répondait 403 sans que
    // personne ne le voie : aucune notification d'expiration n'est partie.
    //
    // Importer le handler supprime le réseau, le WAF et la latence d'un
    // aller-retour. Le secret reste transmis : la route cible sert aussi aux
    // appels du personnel et vérifie sa propre autorisation.
    const requete = new NextRequest(`${SITE_URL}/api/genealogie/check-expired`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.CRON_SECRET || ''}`,
        },
        body: JSON.stringify({}),
    })

    const res = await checkExpiredHandler(requete)
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
