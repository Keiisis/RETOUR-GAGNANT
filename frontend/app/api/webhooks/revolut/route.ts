// ══════════════════════════════════════════════════════════════
//  WEBHOOK REVOLUT PAY.
//
//  Revolut prévient ici quand une commande aboutit. C'est le filet qui rattrape
//  le client parti avant le retour du navigateur : sans lui, un paiement réussi
//  resterait « en attente » jusqu'à ce que quelqu'un s'en aperçoive.
//
//  LA SIGNATURE EST VÉRIFIÉE AVANT TOUTE LECTURE DU CONTENU. Une adresse de
//  webhook est publique : sans cette vérification, n'importe qui pourrait
//  déclarer une commande payée en envoyant un POST. C'est la même règle que
//  pour Stripe et PayPal.
//
//  Le corps est lu en TEXTE BRUT et signé tel quel : le re-sérialiser
//  invaliderait la signature (un espace, un ordre de clés, et l'empreinte
//  change entièrement).
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifierSignatureRevolut, lireCommandeRevolut, ETATS_PAYES } from '@/lib/revolut'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: NextRequest) {
    const corpsBrut = await request.text()

    const { data: reglages } = await supabase
        .from('settings').select('key, value')
        .in('key', ['revolut_webhook_secret', 'revolut_secret_key', 'revolut_sandbox', 'revolut_currency'])
    const r: Record<string, string> = {}
    for (const x of reglages || []) r[x.key] = x.value || ''

    const verdict = verifierSignatureRevolut(
        corpsBrut,
        request.headers.get('revolut-signature'),
        request.headers.get('revolut-request-timestamp'),
        r.revolut_webhook_secret || '',
    )
    if (!verdict.ok) {
        console.error('[Webhook Revolut] signature refusée :', verdict.motif)
        return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
    }

    let evenement: { event?: string; order_id?: string; merchant_order_ext_ref?: string }
    try { evenement = JSON.parse(corpsBrut) } catch {
        return NextResponse.json({ error: 'Charge illisible' }, { status: 400 })
    }

    const type = String(evenement.event || '')
    const commandeRevolut = String(evenement.order_id || '')
    if (!commandeRevolut) return NextResponse.json({ recu: true, ignore: 'sans order_id' })

    // On ne traite que l'aboutissement. Les autres événements sont accusés
    // réception sans effet : répondre autre chose que 2xx ferait rejouer
    // Revolut indéfiniment pour rien.
    if (type !== 'ORDER_COMPLETED' && type !== 'ORDER_AUTHORISED') {
        return NextResponse.json({ recu: true, ignore: type })
    }

    /* ON NE CROIT PAS LA CHARGE SUR PAROLE, même signée : on relit la commande
       chez Revolut. La signature prouve l'émetteur, pas l'état réel — et c'est
       l'état réel qui décide d'encaisser. */
    if (!r.revolut_secret_key) {
        console.error('[Webhook Revolut] clé secrète absente : impossible de confirmer')
        return NextResponse.json({ recu: true, differe: true })
    }

    const res = await lireCommandeRevolut(
        {
            secretKey: r.revolut_secret_key,
            sandbox: r.revolut_sandbox === 'true',
            devise: (r.revolut_currency || 'EUR').toUpperCase(),
        },
        commandeRevolut,
    )
    if (!res.ok || !res.data || !ETATS_PAYES.has(String(res.data.state))) {
        console.warn('[Webhook Revolut] commande non aboutie chez Revolut :', res.data?.state || res.erreur)
        return NextResponse.json({ recu: true, non_aboutie: true })
    }

    const orderId = res.data.merchant_order_data?.reference
    if (!orderId) {
        console.error('[Webhook Revolut] commande sans référence marchande :', commandeRevolut)
        return NextResponse.json({ recu: true, sans_reference: true })
    }

    /* Mise à jour ATOMIQUE, et seulement depuis « pending » : le webhook et le
       retour navigateur arrivent souvent tous les deux. Sans cette clause, le
       second écraserait le premier — et un remboursement passé entre-temps
       serait réécrit en « payé ». */
    const { data: majs, error } = await supabase
        .from('orders')
        .update({ payment_status: 'completed', transaction_id: commandeRevolut })
        .eq('id', orderId)
        .eq('payment_status', 'pending')
        .select('id')

    if (error) {
        console.error('[Webhook Revolut] mise à jour impossible :', error.message)
        return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
    }

    return NextResponse.json({ recu: true, mis_a_jour: (majs || []).length })
}