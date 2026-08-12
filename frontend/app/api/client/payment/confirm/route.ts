import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import Stripe from 'stripe'
import { sendDocumentPaymentEmails } from '@/lib/document-payment'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// ══════════════════════════════════════════════════════════════
// POST /api/client/payment/confirm : confirme le paiement d'une FACTURE
//
// SÉCURITÉ (corrige un bypass de paiement) :
//   1. Identité dérivée de la SESSION (cookies), jamais du corps.
//   2. Vérification propriétaire : la facture doit appartenir au client connecté.
//   3. Vérification SERVEUR de la transaction auprès du prestataire (statut réussi
//      + montant) AVANT de marquer « payé ». Sans ça, on pouvait solder une
//      facture sans payer.
// ══════════════════════════════════════════════════════════════

// ── Identité vérifiée via la session Supabase (cookies) ──
async function getSessionUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
    try {
        const supa = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} },
        })
        const { data: { user } } = await supa.auth.getUser()
        if (!user) return null
        return { id: user.id, email: (user.email || '').toLowerCase() }
    } catch { return null }
}

async function getSettings(keys: string[]): Promise<Record<string, string>> {
    const { data } = await supabase.from('settings').select('key, value').in('key', keys)
    const m: Record<string, string> = {}
    for (const r of data || []) m[r.key] = r.value
    return m
}

interface VerifyResult { ok: boolean; reason: string; amount?: number; currency?: string }

// Tolérance de montant : uniquement en XOF (natif Kkiapay/FedaPay). Le statut
// réussi de la transaction reste le garde-fou principal anti-fraude.
function amountOk(provAmount: number | undefined, docTotal: number, docCurrency: string): boolean {
    if (provAmount === undefined) return true
    if (docCurrency && docCurrency.toUpperCase() !== 'XOF') return true // pas de comparaison inter-devise fiable
    return Math.abs(provAmount - docTotal) <= 1
}

async function verifyKkiapay(txId: string): Promise<VerifyResult> {
    const s = await getSettings(['kkiapay_private_key', 'kkiapay_sandbox_private_key', 'kkiapay_secret_key', 'kkiapay_sandbox'])
    const sandbox = s.kkiapay_sandbox === 'true'
    const privateKey = sandbox ? (s.kkiapay_sandbox_private_key || s.kkiapay_private_key) : s.kkiapay_private_key
    if (!privateKey || !s.kkiapay_secret_key) return { ok: false, reason: 'kkiapay_config_missing' }
    const base = sandbox ? 'https://api-sandbox.kkiapay.me' : 'https://api.kkiapay.me'
    const res = await fetch(`${base}/api/v1/transactions/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-private-key': privateKey, 'x-secret-key': s.kkiapay_secret_key },
        body: JSON.stringify({ transactionId: txId }),
    })
    if (!res.ok) return { ok: false, reason: `kkiapay_http_${res.status}` }
    const d = await res.json()
    return { ok: d?.status === 'SUCCESS', reason: d?.status || 'unknown', amount: d?.amount }
}

async function verifyFedapay(txId: string): Promise<VerifyResult> {
    const s = await getSettings(['fedapay_secret_key', 'fedapay_sandbox'])
    if (!s.fedapay_secret_key) return { ok: false, reason: 'fedapay_config_missing' }
    const base = s.fedapay_sandbox === 'true' ? 'https://sandbox-api.fedapay.com' : 'https://api.fedapay.com'
    const res = await fetch(`${base}/v1/transactions/${txId}`, { headers: { Authorization: `Bearer ${s.fedapay_secret_key}` } })
    if (!res.ok) return { ok: false, reason: `fedapay_http_${res.status}` }
    const d = await res.json()
    const status = d?.['v1/transaction']?.status || d?.transaction?.status || d?.status
    const amount = d?.['v1/transaction']?.amount ?? d?.transaction?.amount ?? d?.amount
    return { ok: status === 'approved' || status === 'transferred', reason: status || 'unknown', amount }
}

async function verifyStripe(txId: string): Promise<VerifyResult> {
    const s = await getSettings(['stripe_secret_key'])
    if (!s.stripe_secret_key) return { ok: false, reason: 'stripe_config_missing' }
    const stripe = new Stripe(s.stripe_secret_key)
    const pi = await stripe.paymentIntents.retrieve(txId)
    return { ok: pi.status === 'succeeded', reason: pi.status, amount: pi.amount, currency: pi.currency }
}

async function verifyPaypal(orderId: string): Promise<VerifyResult> {
    const s = await getSettings(['paypal_client_id', 'paypal_client_secret', 'paypal_sandbox'])
    if (!s.paypal_client_id || !s.paypal_client_secret) return { ok: false, reason: 'paypal_config_missing' }
    const base = s.paypal_sandbox === 'true' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
    const tok = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${s.paypal_client_id}:${s.paypal_client_secret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    })
    if (!tok.ok) return { ok: false, reason: `paypal_token_${tok.status}` }
    const tokenData = await tok.json()
    const res = await fetch(`${base}/v2/checkout/orders/${orderId}`, { headers: { Authorization: `Bearer ${tokenData.access_token}` } })
    if (!res.ok) return { ok: false, reason: `paypal_http_${res.status}` }
    const d = await res.json()
    return { ok: d?.status === 'COMPLETED' || d?.status === 'APPROVED', reason: d?.status || 'unknown' }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { doc_id, provider, transaction_id } = body

        if (!doc_id || !provider) {
            return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
        }

        // 1. Identité vérifiée (session) : jamais le corps
        const sessionUser = await getSessionUser(req)
        if (!sessionUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        // 2. Charger la facture
        const { data: doc } = await supabase
            .from('documents_financiers')
            .select('id, status, client_id, client_email, total, currency, type')
            .eq('id', doc_id)
            .single()
        if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

        // Propriété : la facture appartient au client CONNECTÉ
        const owns = doc.client_id === sessionUser.id ||
            (doc.client_email || '').toLowerCase() === sessionUser.email
        if (!owns) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

        if (doc.type !== 'facture') {
            return NextResponse.json({ error: 'Ce document n\'est pas une facture' }, { status: 400 })
        }
        if (doc.status === 'paye') {
            return NextResponse.json({ success: true, already_paid: true })
        }

        // 3. Vérification serveur de la transaction auprès du prestataire
        if (!transaction_id) {
            return NextResponse.json({ error: 'transaction_id requis' }, { status: 400 })
        }
        let verify: VerifyResult
        switch (provider) {
            case 'kkiapay': verify = await verifyKkiapay(transaction_id); break
            case 'fedapay': verify = await verifyFedapay(transaction_id); break
            case 'stripe':  verify = await verifyStripe(transaction_id); break
            case 'paypal':  verify = await verifyPaypal(transaction_id); break
            default:
                return NextResponse.json({ error: 'Prestataire non supporté' }, { status: 400 })
        }

        if (!verify.ok) {
            console.warn(`[client/payment/confirm] Vérif échouée provider=${provider} raison=${verify.reason}`)
            return NextResponse.json({ error: `Paiement non confirmé (${verify.reason})` }, { status: 402 })
        }
        if (!amountOk(verify.amount, Number(doc.total), doc.currency)) {
            console.warn(`[client/payment/confirm] Montant divergent doc=${doc.total} prov=${verify.amount}`)
            return NextResponse.json({ error: 'Montant divergent' }, { status: 402 })
        }

        // 4. Marquer payé (garde atomique : uniquement si encore impayé)
        const { data: updated, error: updateError } = await supabase
            .from('documents_financiers')
            .update({
                status: 'paye',
                payment_provider: provider,
                payment_transaction_id: transaction_id,
                paid_at: new Date().toISOString(),
            })
            .eq('id', doc_id)
            .neq('status', 'paye')
            .select('id')

        if (updateError) throw new Error(updateError.message)
        if (!updated || updated.length === 0) {
            return NextResponse.json({ success: true, already_paid: true })
        }

        // Garde atomique gagnée → alerte équipe + reçu client (fire-and-forget,
        // une seule fois : le webhook trouvera le document déjà payé).
        void sendDocumentPaymentEmails(doc_id, provider, transaction_id)

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Erreur API client/payment/confirm:', err)
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur interne' }, { status: 500 })
    }
}
