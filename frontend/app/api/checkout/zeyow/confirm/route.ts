import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp, rateLimitHeaders, VERIFY_LIMIT } from '@/lib/rate-limit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Route de vérification du statut Zeyow après redirection navigateur.
 *
 * SÉCURITÉ — DESIGN INTENTIONNEL :
 * Cet endpoint ne COMPLÈTE JAMAIS une commande lui-même.
 * Il se contente de lire le statut DB, défini uniquement par le webhook Zeyow
 * (app/api/webhooks/zeyow/route.ts), qui est le seul flux de confiance
 * (authentifié par secret partagé + vérification de montant).
 *
 * Raison : le navigateur peut être contrôlé par un attaquant.
 * Un utilisateur qui crée une commande obtient l'order_id dans la réponse
 * de /api/checkout. Si cet endpoint acceptait de compléter l'ordre sur
 * simple présentation de l'order_id, il n'y aurait aucune preuve de paiement.
 *
 * Flux correct :
 * 1. Webhook Zeyow arrive → vérifie secret + montant → marque completed
 * 2. Navigateur redirigé → appelle cet endpoint → lit le statut DB
 * 3. Si completed : retourne success (le webhook a tout géré)
 * 4. Si pending : retourne { pending: true } → le frontend réessaie / poll
 */
export async function POST(request: Request) {
    try {
        // ═══ RATE LIMITING ════════════════════════════════════════════
        // Limit souple (même que verify) : le frontend poll cet endpoint
        // en attendant que le webhook Zeyow confirme le paiement.
        const clientIp = getClientIp(request)
        const rl = rateLimit(`zeyow-confirm:${clientIp}`, VERIFY_LIMIT)
        if (!rl.allowed) {
            return NextResponse.json(
                { success: false, error: 'Trop de tentatives. Veuillez patienter avant de réessayer.' },
                { status: 429, headers: rateLimitHeaders(rl) }
            )
        }

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { success: false, error: 'Configuration serveur manquante' },
                { status: 503 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const body = await request.json()
        const { order_id } = body

        if (!order_id) {
            return NextResponse.json(
                { success: false, error: 'order_id requis' },
                { status: 400 }
            )
        }

        // Récupérer le statut depuis la DB (seule source de vérité)
        const { data: order, error: fetchErr } = await supabase
            .from('orders')
            .select('id, payment_method, payment_status, transaction_id')
            .eq('id', order_id)
            .single()

        if (fetchErr || !order) {
            return NextResponse.json(
                { success: false, error: 'Commande introuvable' },
                { status: 404 }
            )
        }

        // Vérifier que c'est bien une commande Zeyow (non falsifiable — défini côté serveur)
        if (order.payment_method !== 'zeyow') {
            console.warn(`[Zeyow Confirm] Tentative sur commande ${order_id} (méthode: ${order.payment_method})`)
            return NextResponse.json(
                { success: false, error: 'Méthode de paiement incorrecte' },
                { status: 400 }
            )
        }

        // Le webhook Zeyow (seul flux de confiance) a déjà complété la commande
        if (order.payment_status === 'completed') {
            return NextResponse.json({
                success: true,
                message: 'Paiement Zeyow confirmé',
                transaction_id: order.transaction_id,
            })
        }

        // Paiement échoué ou remboursé
        if (order.payment_status === 'failed' || order.payment_status === 'refunded') {
            return NextResponse.json(
                { success: false, error: `Paiement ${order.payment_status}` },
                { status: 400 }
            )
        }

        // Statut toujours 'pending' : le webhook n'est pas encore arrivé.
        // Le frontend doit réessayer dans quelques secondes.
        return NextResponse.json(
            {
                success: false,
                pending: true,
                message: 'Paiement en cours de confirmation par Zeyow. Veuillez patienter...',
            },
            { status: 202 }
        )
    } catch {
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        )
    }
}
