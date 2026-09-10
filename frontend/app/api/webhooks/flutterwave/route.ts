// ══════════════════════════════════════════════════════════════
//  WEBHOOK FLUTTERWAVE.
//
//  Deux formes de vérification circulent selon l'ancienneté du compte :
//  l'en-tête historique `verif-hash` (égalité stricte avec le secret du
//  tableau de bord) et `flutterwave-signature` (HMAC-SHA256). On accepte les
//  deux — voir `lib/flutterwave.ts`.
//
//  Et surtout : Flutterwave RECOMMANDE LUI-MÊME de re-interroger l'API avant
//  de donner la moindre valeur. On le fait : la notification prouve
//  l'émetteur, jamais l'état réel de la transaction.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    verifierSignatureFlutterwave, verifierFlutterwaveParId,
    verifierFlutterwaveParRef, ETAT_PAYE_FLW,
} from '@/lib/flutterwave'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: NextRequest) {
    const corpsBrut = await request.text()

    const { data: reglages } = await supabase
        .from('settings').select('key, value')
        .in('key', ['flutterwave_secret_key', 'flutterwave_secret_hash'])
    const r: Record<string, string> = {}
    for (const x of reglages || []) r[x.key] = x.value || ''

    const verdict = verifierSignatureFlutterwave(
        corpsBrut,
        request.headers.get('verif-hash'),
        request.headers.get('flutterwave-signature'),
        r.flutterwave_secret_hash || '',
    )
    if (!verdict.ok) {
        console.error('[Webhook Flutterwave] signature refusée :', verdict.motif)
        return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
    }

    let ev: { event?: string; data?: { id?: number; tx_ref?: string; status?: string } }
    try { ev = JSON.parse(corpsBrut) } catch {
        return NextResponse.json({ error: 'Charge illisible' }, { status: 400 })
    }

    const txRef = String(ev.data?.tx_ref || '')
    const txId = ev.data?.id
    if (!txRef && !txId) return NextResponse.json({ recu: true, ignore: 'sans reference' })

    if (!r.flutterwave_secret_key) {
        console.error('[Webhook Flutterwave] clé secrète absente : impossible de confirmer')
        return NextResponse.json({ recu: true, differe: true })
    }
    const cfg = { secretKey: r.flutterwave_secret_key }

    const res = txId
        ? await verifierFlutterwaveParId(cfg, txId)
        : await verifierFlutterwaveParRef(cfg, txRef)

    if (!res.ok || !res.data || String(res.data.status).toLowerCase() !== ETAT_PAYE_FLW) {
        console.warn('[Webhook Flutterwave] transaction non aboutie :', res.data?.status || res.erreur)
        return NextResponse.json({ recu: true, non_aboutie: true })
    }

    // `tx_ref` porte NOTRE identifiant de commande, posé à la création.
    const orderId = String(res.data.tx_ref || txRef)
    if (!orderId) return NextResponse.json({ recu: true, sans_reference: true })

    const { data: majs, error } = await supabase
        .from('orders')
        .update({ payment_status: 'completed', transaction_id: String(res.data.id || txId || orderId) })
        .eq('id', orderId)
        .eq('payment_status', 'pending')
        .select('id')

    if (error) {
        console.error('[Webhook Flutterwave] mise à jour impossible :', error.message)
        return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
    }
    return NextResponse.json({ recu: true, mis_a_jour: (majs || []).length })
}
