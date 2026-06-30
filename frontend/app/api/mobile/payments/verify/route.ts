import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Anti-fraude : on vérifie auprès de Kkiapay que la transaction est bien SUCCESS
// avant de passer un paiement de pending → success. Sans ça, un client peut
// modifier le client mobile pour marquer un paiement comme réussi sans payer.
async function verifyKkiapayTransaction(
    transactionId: string
): Promise<{ ok: boolean; status: string; amount?: number }> {
    const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['kkiapay_private_key', 'kkiapay_secret_key', 'kkiapay_sandbox'])
    const privateKey = settings?.find(s => s.key === 'kkiapay_private_key')?.value
    const secretKey = settings?.find(s => s.key === 'kkiapay_secret_key')?.value
    const sandbox = settings?.find(s => s.key === 'kkiapay_sandbox')?.value === 'true'
    const apiUrl = sandbox
        ? 'https://api-sandbox.kkiapay.me/api/v1/transactions/status'
        : 'https://api.kkiapay.me/api/v1/transactions/status'

    if (!privateKey || !secretKey) return { ok: false, status: 'config_missing' }

    try {
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-private-key': String(privateKey),
                'x-secret-key': String(secretKey),
            },
            body: JSON.stringify({ transactionId }),
        })
        if (!res.ok) return { ok: false, status: `kkiapay_http_${res.status}` }
        const data = await res.json()
        return { ok: data?.status === 'SUCCESS', status: data?.status || 'unknown', amount: data?.amount }
    } catch (e) {
        return { ok: false, status: e instanceof Error ? e.message : 'verify_failed' }
    }
}

// POST /api/mobile/payments/verify
//   Body succès :  { client_id, local_tx_id, kk_transaction_id }
//   Body échec  :  { client_id, local_tx_id, status: 'failed' }
//
// La row paiements doit déjà exister (créée en pending par PaymentsScreen avant
// l'ouverture du widget Kkiapay). Cette route confirme — ou marque comme échouée —
// le paiement après le retour du widget natif.
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const clientId = String(body.client_id || '')
        const localTxId = String(body.local_tx_id || '')
        const kkTransactionId = body.kk_transaction_id ? String(body.kk_transaction_id) : null
        const clientStatus = body.status as 'failed' | undefined

        if (!clientId || !localTxId) {
            return NextResponse.json(
                { error: 'client_id et local_tx_id requis' },
                { status: 400 }
            )
        }

        // Anti-fraude : la row doit appartenir au client (pas juste exister)
        const { data: payment, error: fetchErr } = await supabase
            .from('paiements')
            .select('id, status, amount, currency')
            .eq('transaction_id', localTxId)
            .eq('client_id', clientId)
            .single()

        if (fetchErr || !payment) {
            return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 })
        }

        // Idempotence : déjà finalisé → ne rien refaire
        if (payment.status === 'success' || payment.status === 'failed') {
            return NextResponse.json({ ok: true, idempotent: true, status: payment.status })
        }

        // Branche échec : pas besoin de vérifier Kkiapay (le widget a renvoyé failed)
        if (clientStatus === 'failed') {
            await supabase
                .from('paiements')
                .update({ status: 'failed' })
                .eq('id', payment.id)
            return NextResponse.json({ ok: true, status: 'failed' })
        }

        // Branche succès : vérification serveur obligatoire
        if (!kkTransactionId) {
            return NextResponse.json(
                { error: 'kk_transaction_id requis pour confirmer le succès' },
                { status: 400 }
            )
        }

        const verify = await verifyKkiapayTransaction(kkTransactionId)
        if (!verify.ok) {
            console.warn(`[mobile/payments/verify] Échec vérif: ${verify.status}`)
            return NextResponse.json(
                { error: `Paiement non confirmé (${verify.status})` },
                { status: 402 }
            )
        }

        // Sécurité : montant Kkiapay doit correspondre au montant DB (tolérance 1 unité)
        if (verify.amount !== undefined && Math.abs(verify.amount - payment.amount) > 1) {
            console.warn(
                `[mobile/payments/verify] Montant divergent: kkiapay=${verify.amount} db=${payment.amount}`
            )
            return NextResponse.json({ error: 'Montant divergent' }, { status: 402 })
        }

        const { error: updErr } = await supabase
            .from('paiements')
            .update({ status: 'success', transaction_id: kkTransactionId })
            .eq('id', payment.id)

        if (updErr) {
            return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
        }

        return NextResponse.json({ ok: true, status: 'success' })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
