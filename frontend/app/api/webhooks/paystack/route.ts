// ══════════════════════════════════════════════════════════════
//  WEBHOOK PAYSTACK.
//
//  Le filet qui rattrape le client parti avant le retour du navigateur : sans
//  lui, un paiement réussi resterait « en attente » jusqu'à ce que quelqu'un
//  s'en aperçoive.
//
//  LA SIGNATURE EST VÉRIFIÉE AVANT TOUTE LECTURE DU CONTENU. Une adresse de
//  webhook est publique : sans elle, n'importe qui déclarerait une commande
//  payée par un simple POST.
//
//  Particularité de Paystack : la clé de signature EST la clé secrète (pas un
//  secret distinct comme chez Stripe ou Revolut), et l'algorithme est
//  HMAC-SHA512 — pas SHA256.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifierSignaturePaystack, verifierPaystack, orderIdDepuisMetadata } from '@/lib/paystack'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: NextRequest) {
    const corpsBrut = await request.text()

    const { data: reglages } = await supabase
        .from('settings').select('key, value').in('key', ['paystack_secret_key'])
    const secret = (reglages || []).find(x => x.key === 'paystack_secret_key')?.value || ''

    const verdict = verifierSignaturePaystack(corpsBrut, request.headers.get('x-paystack-signature'), secret)
    if (!verdict.ok) {
        console.error('[Webhook Paystack] signature refusée :', verdict.motif)
        return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
    }

    let ev: { event?: string; data?: { reference?: string; status?: string } }
    try { ev = JSON.parse(corpsBrut) } catch {
        return NextResponse.json({ error: 'Charge illisible' }, { status: 400 })
    }

    // Seul l'aboutissement nous intéresse. Les autres événements sont accusés
    // en 200 : répondre autre chose ferait rejouer Paystack indéfiniment.
    if (ev.event !== 'charge.success') {
        return NextResponse.json({ recu: true, ignore: ev.event || 'inconnu' })
    }

    const reference = String(ev.data?.reference || '')
    if (!reference) return NextResponse.json({ recu: true, ignore: 'sans reference' })

    /* ON NE CROIT PAS LA CHARGE SUR PAROLE, même signée : on relit la
       transaction. La signature prouve l'émetteur, pas l'état réel — et c'est
       l'état réel qui décide d'encaisser. */
    const res = await verifierPaystack({ secretKey: secret }, reference)
    if (!res.ok || !res.data || res.data.status !== 'success') {
        console.warn('[Webhook Paystack] transaction non aboutie :', res.data?.status || res.erreur)
        return NextResponse.json({ recu: true, non_aboutie: true })
    }

    // La référence EST notre identifiant de commande ; les métadonnées le doublent.
    const orderId = orderIdDepuisMetadata(res.data.metadata) || res.data.reference
    if (!orderId) return NextResponse.json({ recu: true, sans_reference: true })

    /* Mise à jour ATOMIQUE, et seulement depuis « pending » : le webhook et le
       retour navigateur arrivent souvent tous les deux, et un remboursement
       passé entre-temps ne doit pas être réécrit en « payé ». */
    const { data: majs, error } = await supabase
        .from('orders')
        .update({ payment_status: 'completed', transaction_id: reference })
        .eq('id', orderId)
        .eq('payment_status', 'pending')
        .select('id')

    if (error) {
        console.error('[Webhook Paystack] mise à jour impossible :', error.message)
        return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
    }
    return NextResponse.json({ recu: true, mis_a_jour: (majs || []).length })
}
