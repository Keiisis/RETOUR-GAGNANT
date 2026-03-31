/**
 * POST /api/checkout/fedapay
 * Crée une transaction FedaPay côté serveur et retourne l'ID + token.
 * Le widget FedaPay utilise ensuite cet ID pour afficher le formulaire de paiement.
 * Cette approche garantit que l'ID de transaction est connu avant le paiement
 * et que la vérification côté serveur fonctionnera correctement.
 */
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { order_id, amount, description, customer_email, customer_phone } = body

        if (!order_id || !amount) {
            return NextResponse.json(
                { error: 'order_id et amount sont requis' },
                { status: 400 }
            )
        }

        // FedaPay et KKiapay traitent uniquement en XOF
        const fedaCurrency = 'XOF'

        // Lire les settings FedaPay
        const { data: settingsData, error: settingsError } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['fedapay_secret_key', 'fedapay_sandbox'])

        if (settingsError) {
            return NextResponse.json({ error: 'Erreur lecture settings' }, { status: 503 })
        }

        const sm: Record<string, string> = {}
        for (const s of settingsData || []) sm[s.key] = s.value

        const secretKey = sm.fedapay_secret_key
        const isSandbox = sm.fedapay_sandbox === 'true'
        const apiBase = isSandbox
            ? 'https://sandbox-api.fedapay.com'
            : 'https://api.fedapay.com'

        if (!secretKey) {
            return NextResponse.json(
                { error: 'FedaPay non configuré (clé secrète manquante)' },
                { status: 503 }
            )
        }

        // Construire le payload de la transaction
        // FedaPay API : structure PLATE (pas de wrapper "transaction")
        // callback_url omis — vérification faite via DB (transaction_id stocké dans la commande)
        const payload: Record<string, unknown> = {
            amount: Math.round(Number(amount)),
            description: description || `Commande ${order_id}`,
            currency: { iso: fedaCurrency },
        }

        // Ajouter les informations client si disponibles
        if (customer_email || customer_phone) {
            const customerPayload: Record<string, unknown> = {}
            if (customer_email) customerPayload.email = customer_email
            if (customer_phone) {
                customerPayload.phone_number = { number: customer_phone }
            }
            payload.customer = customerPayload
        }

        const res = await fetch(`${apiBase}/v1/transactions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        if (!res.ok) {
            const errBody = await res.text()
            console.error(`FedaPay create transaction HTTP ${res.status}:`, errBody.slice(0, 300))
            return NextResponse.json(
                { error: `FedaPay API erreur ${res.status}: ${errBody.slice(0, 150)}` },
                { status: 502 }
            )
        }

        const data = await res.json()
        const rawJson = JSON.stringify(data)
        console.log('FedaPay create response (HTTP', res.status, '):', rawJson.slice(0, 500))

        // FedaPay retourne { "v1/transaction": {...} } — la clé contient un slash littéral
        const transaction = data?.['v1/transaction'] || data?.v1?.transaction || data?.transaction || (data?.id ? data : null)

        if (!transaction?.id) {
            return NextResponse.json(
                { error: `FedaPay: ID introuvable dans la réponse — ${rawJson.slice(0, 200)}` },
                { status: 502 }
            )
        }

        // Stocker l'ID de transaction FedaPay dans la commande pour vérification sécurisée
        // (l'API GET /v1/transactions/{id} retourne 404 dans certains comptes sandbox)
        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('SUPABASE_SERVICE_ROLE_KEY manquante — impossible de stocker transaction_id')
            return NextResponse.json(
                { error: 'Configuration serveur manquante (SUPABASE_SERVICE_ROLE_KEY)' },
                { status: 503 }
            )
        }

        const supabaseService = createClient(supabaseUrl, supabaseServiceKey)
        const { error: updateError } = await supabaseService
            .from('orders')
            .update({ transaction_id: String(transaction.id) })
            .eq('id', order_id)
            .eq('payment_status', 'pending')

        if (updateError) {
            console.error('FedaPay: échec mise à jour transaction_id en DB:', updateError.message)
            return NextResponse.json(
                { error: `Erreur DB lors du stockage transaction_id: ${updateError.message}` },
                { status: 500 }
            )
        }

        console.log(`FedaPay: transaction_id ${transaction.id} stocké pour commande ${order_id}`)

        return NextResponse.json({
            fedapay_transaction_id: transaction.id,
            token: transaction.token || null,
            status: transaction.status,
        })
    } catch (e) {
        console.error('FedaPay create transaction exception:', e)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
