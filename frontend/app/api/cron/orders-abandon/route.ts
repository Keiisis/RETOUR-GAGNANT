// ⚠️ FRÉQUENCE : UNE FOIS PAR JOUR — ET CE N'EST PAS UN CHOIX.
//
//  Ce balayage était programmé toutes les heures (« 15 * * * * »). Le plan
//  Hobby de Vercel REFUSE tout cron plus fréquent qu'une fois par jour, et il
//  le refuse AU DÉPLOIEMENT : à partir du 19/08 13:46, TOUS les déploiements
//  ont échoué — pendant plus d'une journée, sans que le rapport d'échec ne
//  pointe vers autre chose qu'une ligne de `vercel.json`.
//
//  Conséquence assumée : une commande abandonnée reste « en attente » jusqu'au
//  passage suivant, au lieu de 90 minutes. La route reste correcte — elle
//  revérifie `payment_status = 'pending'` avant d'écrire — elle est seulement
//  moins prompte.
//
//  À REMETTRE À L'HEURE le jour du passage en plan Pro : « 15 * * * * ».
// ══════════════════════════════════════════════════════════════
//  CRON : commandes abandonnées en caisse.
//
//  Le navigateur signale désormais l'abandon du widget Kkiapay et annule la
//  commande. Mais il ne peut rien signaler s'il meurt : batterie vide, réseau
//  coupé, onglet fermé d'un coup, application tuée par le système. Ces
//  commandes-là restaient `pending` pour toujours — elles polluaient le suivi
//  et faisaient croire à des ventes en cours qui n'existaient pas.
//
//  Ce balayage clôt ce qui n'a manifestement pas abouti. Il ne touche JAMAIS
//  une commande encaissée : seul `pending` est concerné, et seulement passé un
//  délai qui dépasse largement la durée d'un paiement mobile money.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { executerCron } from '@/lib/cron-journal'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/** Un paiement Mobile Money aboutit en moins de 5 minutes. 90 min = large. */
const DELAI_MINUTES = 90

async function balayer(): Promise<Response> {
    const limite = new Date(Date.now() - DELAI_MINUTES * 60_000).toISOString()

    const { data: candidates, error } = await supabase
        .from('orders')
        .select('id, created_at, amount, currency, customer_email, payment_method')
        .eq('payment_status', 'pending')
        .lt('created_at', limite)
        .limit(200)

    if (error) throw new Error(error.message)
    if (!candidates?.length) {
        return NextResponse.json({ closes: 0, message: 'Aucune commande en attente à clore.' })
    }

    const ids = candidates.map(c => c.id)

    // Sécurité : on ne clôt QUE ce qui est encore `pending` au moment de
    // l'écriture. Entre la lecture et l'écriture, un webhook a pu confirmer un
    // paiement — cette condition l'empêche d'être écrasé.
    const { error: majErr, count } = await supabase
        .from('orders')
        .update({
            // 'abandoned' — la valeur qu'écrit déjà /api/checkout/cancel.
            // Employer 'cancelled' aurait créé un second vocabulaire pour la
            // même réalité, et fait mentir tous les filtres existants.
            payment_status: 'abandoned',
            updated_at: new Date().toISOString(),
        }, { count: 'exact' })
        .in('id', ids)
        .eq('payment_status', 'pending')

    if (majErr) throw new Error(majErr.message)

    return NextResponse.json({
        closes: count ?? 0,
        message: `${count ?? 0} commande(s) abandonnée(s) close(s) après ${DELAI_MINUTES} min.`,
    })
}

export async function GET(request: NextRequest) {
    return executerCron('orders-abandon', request, balayer)
}
