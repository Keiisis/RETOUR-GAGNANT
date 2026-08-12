import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { executerCron } from '@/lib/cron-journal'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * POST /api/cron/sync-dossiers
 *
 * Synchronise automatiquement la progression des dossiers de suivi
 * (dossier_tracking) avec le statut réel des commandes (orders).
 *
 * Logique de progression boutique :
 *   pending   →  20% étape 1 (commande reçue : en attente paiement)
 *   completed →  40% étape 2 (paiement confirmé)
 *   shipped   →  60% étape 3 (commande expédiée)
 *   delivered →  80% étape 4 (livraison en cours)
 *   closed    → 100% étape 5 (terminé)
 *   cancelled →   0% statut annulé
 *
 * Appelé par Vercel Cron toutes les heures + manuellement depuis l'admin.
 */

const ETAPES_BOUTIQUE = [
    { label: 'Commande reçue',           desc: 'Votre commande a bien été enregistrée.' },
    { label: 'Paiement confirmé',        desc: 'Le paiement a été vérifié et validé.' },
    { label: 'Préparation & Expédition', desc: 'Votre commande est en cours de préparation.' },
    { label: 'Livraison en cours',       desc: 'Votre colis est en route.' },
    { label: 'Commande livrée',          desc: 'Votre commande a été livrée avec succès.' },
]

function buildEtapes(activeIndex: number) {
    const now = new Date().toISOString()
    return ETAPES_BOUTIQUE.map((e, i) => ({
        label: e.label,
        description: e.desc,
        date: i <= activeIndex ? now : null,
        done: i <= activeIndex,
    }))
}

function progressionFromStatus(status: string): { progression: number; etapeIndex: number; statut: string } {
    switch (status) {
        case 'completed':
            return { progression: 40, etapeIndex: 1, statut: 'en_cours' }
        case 'shipped':
            return { progression: 60, etapeIndex: 2, statut: 'en_cours' }
        case 'delivered':
            return { progression: 80, etapeIndex: 3, statut: 'en_cours' }
        case 'closed':
            return { progression: 100, etapeIndex: 4, statut: 'termine' }
        case 'cancelled':
            return { progression: 0, etapeIndex: -1, statut: 'annule' }
        default:
            return { progression: 20, etapeIndex: 0, statut: 'en_cours' }
    }
}

export async function POST(request: Request) {
    return executerCron('sync-dossiers', request, async () => {
    try {

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Configuration manquante' }, { status: 503 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Récupérer tous les dossiers boutique non terminés
        const { data: dossiers, error: dErr } = await supabase
            .from('dossier_tracking')
            .select('id, num_dossier, statut, progression')
            .like('num_dossier', 'RG-CMD-%')
            .not('statut', 'eq', 'termine')

        if (dErr) {
            console.error('[sync-dossiers] Erreur fetch dossiers:', dErr.message)
            return NextResponse.json({ error: dErr.message }, { status: 500 })
        }

        if (!dossiers || dossiers.length === 0) {
            return NextResponse.json({ synced: 0, message: 'Aucun dossier boutique à synchroniser' })
        }

        // 2. Extraire les FRAGMENTS d'identifiant de commande
        //
        // `num_dossier` vaut « RG-CMD-6EF058C6 » : les 8 premiers caractères
        // de l'UUID de la commande, en majuscules : PAS l'UUID entier.
        // L'ancien code les passait tels quels à `in('id', …)`, ce que
        // PostgreSQL rejette (« invalid input syntax for type uuid ») : la
        // requête échouait, la route renvoyait 500, et AUCUN dossier n'a
        // jamais été synchronisé.
        const fragments = dossiers
            .map(d => d.num_dossier?.match(/^RG-CMD-(.+)$/)?.[1])
            .filter(Boolean)
            .map(f => (f as string).toLowerCase())

        if (fragments.length === 0) {
            return NextResponse.json({ synced: 0 })
        }

        // 3. Récupérer les commandes correspondantes
        //
        // Un préfixe d'UUID ne peut pas être filtré côté base sans transtypage
        // (et un index sur uuid ne sert pas un LIKE). Le volume ici est celui
        // des commandes boutique : on les lit et on apparie par préfixe.
        const { data: orders, error: oErr } = await supabase
            .from('orders')
            .select('id, payment_status')
            .order('created_at', { ascending: false })
            .limit(5000)

        if (oErr) {
            console.error('[sync-dossiers] Erreur fetch orders:', oErr.message)
            return NextResponse.json({ error: oErr.message }, { status: 500 })
        }

        // Table de correspondance « 8 premiers caractères → statut »
        const parFragment = new Map<string, string>()
        for (const o of orders || []) {
            const cle = String(o.id).slice(0, 8).toLowerCase()
            // Collision de préfixe (2 sur 8 caractères hexadécimaux) :
            // improbable, mais on garde la commande la plus récente, déjà
            // en tête grâce au tri.
            if (!parFragment.has(cle)) parFragment.set(cle, o.payment_status)
        }

        // 4. Synchroniser
        let synced = 0
        const updates: Promise<unknown>[] = []

        for (const dossier of dossiers) {
            const fragment = dossier.num_dossier?.match(/^RG-CMD-(.+)$/)?.[1]
            if (!fragment) continue

            const paymentStatus = parFragment.get(fragment.toLowerCase())
            if (!paymentStatus) continue

            const { progression, etapeIndex, statut } = progressionFromStatus(paymentStatus)

            // Ne mettre à jour que si quelque chose a changé
            if (dossier.progression === progression && dossier.statut === statut) continue

            const etapes = etapeIndex >= 0 ? buildEtapes(etapeIndex) : buildEtapes(0)

            updates.push(
                (async () => {
                    await supabase
                        .from('dossier_tracking')
                        .update({ progression, statut, etapes })
                        .eq('id', dossier.id)
                    synced++
                })()
            )
        }

        await Promise.allSettled(updates)

        console.log(`[sync-dossiers] Synchronisé ${synced} dossier(s) sur ${dossiers.length}`)
        return NextResponse.json({ synced, total: dossiers.length })

    } catch (err) {
        console.error('[sync-dossiers] Erreur inattendue:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
    })
}

// Également accessible en GET pour les appels Vercel Cron
export async function GET(request: Request) {
    return POST(request)
}
