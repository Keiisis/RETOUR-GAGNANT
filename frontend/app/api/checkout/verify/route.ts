import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp, rateLimitHeaders, VERIFY_LIMIT } from '@/lib/rate-limit'
import { sendInvoiceEmail } from '@/lib/send-invoice-email'
import { markClientConverted } from '@/lib/classement/track'
import { nextDocumentNumber } from '@/lib/document-numbering'
import { classifyProposalPayment } from '@/lib/proposal-classify'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// XOF et autres devises zero-decimal pour Stripe
const ZERO_DECIMAL = new Set([
    'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
    'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

export async function POST(request: Request) {
    try {
        // ═══ RATE LIMITING ════════════════════════════════════════════
        // Limite souple : le frontend peut légitimement appeler verify
        // plusieurs fois (polling en attente du webhook Zeyow, retry après
        // échec réseau). Limite à 20/min pour bloquer le flood automatisé.
        const clientIp = getClientIp(request)
        const rl = rateLimit(`verify:${clientIp}`, VERIFY_LIMIT)
        if (!rl.allowed) {
            return NextResponse.json(
                { success: false, error: 'Trop de tentatives. Veuillez patienter avant de réessayer.' },
                { status: 429, headers: rateLimitHeaders(rl) }
            )
        }

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { success: false, error: 'Configuration serveur manquante (SUPABASE_SERVICE_ROLE_KEY)' },
                { status: 503 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const body = await request.json()
        const { order_id, transaction_id } = body
        // NOTE: `payment_method` du client est IGNORÉ — on utilise toujours celui en DB

        if (!order_id || !transaction_id) {
            return NextResponse.json(
                { success: false, error: 'Missing order_id or transaction_id' },
                { status: 400 }
            )
        }

        // ─── Récupérer la commande ───────────────────────────────────────────
        const { data: existingOrder, error: fetchError } = await supabase
            .from('orders')
            .select('payment_status, transaction_id, amount, payment_method, product_id, quantity, currency, cart_items, customer_email')
            .eq('id', order_id)
            .single()

        if (fetchError || !existingOrder) {
            console.error('Order fetch error:', fetchError?.message, '| order_id:', order_id)
            return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
        }

        // ─── Idempotence ─────────────────────────────────────────────────────
        if (
            existingOrder.payment_status === 'completed' &&
            existingOrder.transaction_id === transaction_id
        ) {
            return NextResponse.json({ success: true, message: 'Already verified' })
        }

        // La méthode de paiement vient UNIQUEMENT de la DB — jamais du client
        const method = existingOrder.payment_method

        // ─── Vérifier que transaction_id n'a pas déjà été utilisé pour une AUTRE commande ──
        // Empêche la réutilisation d'une transaction valide pour payer plusieurs commandes
        const { data: existingTx } = await supabase
            .from('orders')
            .select('id')
            .eq('transaction_id', transaction_id)
            .eq('payment_status', 'completed')
            .neq('id', order_id)
            .maybeSingle()

        if (existingTx) {
            console.error(
                `[Verify] Transaction ID réutilisée: ${transaction_id} déjà utilisée sur la commande ${existingTx.id}`
            )
            return NextResponse.json(
                { success: false, error: 'Transaction déjà utilisée pour une autre commande' },
                { status: 400 }
            )
        }

        // ─── Charger les settings paiement ──────────────────────────────────
        const { data: settingsData } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', [
                'kkiapay_sandbox', 'kkiapay_private_key', 'kkiapay_sandbox_private_key',
                'fedapay_secret_key', 'fedapay_sandbox',
                'stripe_secret_key',
                'paypal_client_id', 'paypal_client_secret', 'paypal_sandbox',
            ])

        const sm: Record<string, string> = {}
        for (const s of settingsData || []) sm[s.key] = s.value

        let isVerified = false

        // ─── KKIAPAY ─────────────────────────────────────────────────────────
        if (method === 'kkiapay') {
            try {
                const isSandbox = sm.kkiapay_sandbox === 'true'
                const privateKey = isSandbox
                    ? (sm.kkiapay_sandbox_private_key || sm.kkiapay_private_key || '')
                    : (sm.kkiapay_private_key || '')

                // Fail-closed : sans clé privée, impossible de vérifier auprès de Kkiapay
                if (!privateKey) {
                    return NextResponse.json(
                        { success: false, error: 'Kkiapay non configuré (clé privée manquante dans les settings admin)' },
                        { status: 503 }
                    )
                }

                const kkiapayBase = isSandbox
                    ? 'https://api-sandbox.kkiapay.me'
                    : 'https://api.kkiapay.me'

                // Charger aussi public_key et secret_key (le SDK officiel envoie les 3 headers)
                const { data: kkSettings } = await supabase
                    .from('settings')
                    .select('key, value')
                    .in('key', ['kkiapay_public_key', 'kkiapay_secret_key', 'kkiapay_sandbox_public_key'])

                const kkSm: Record<string, string> = {}
                for (const s of kkSettings || []) kkSm[s.key] = s.value
                const kkPublicKey = isSandbox
                    ? (kkSm.kkiapay_sandbox_public_key || kkSm.kkiapay_public_key)
                    : kkSm.kkiapay_public_key

                const verifyRes = await fetch(`${kkiapayBase}/api/v1/transactions/status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': kkPublicKey || '',
                        'x-private-key': privateKey,
                        'x-secret-key': kkSm.kkiapay_secret_key || '',
                    },
                    body: JSON.stringify({ transactionId: transaction_id }),
                })
                const verifyData = await verifyRes.json()
                console.log('Kkiapay verify response (HTTP', verifyRes.status, '):', JSON.stringify(verifyData).slice(0, 300))

                if (verifyData.status !== 'SUCCESS') {
                    console.warn('Kkiapay status non-SUCCESS:', verifyData.status)
                    return NextResponse.json(
                        { success: false, error: `Kkiapay: ${verifyData.message || verifyData.status || 'vérification échouée'}` },
                        { status: 400 }
                    )
                }

                // Vérification du montant Kkiapay
                if (verifyData.amount !== undefined && verifyData.amount < existingOrder.amount) {
                    console.error('[Verify/Kkiapay] Montant insuffisant:', {
                        paid: verifyData.amount,
                        expected: existingOrder.amount,
                    })
                    return NextResponse.json(
                        { success: false, error: 'Montant Kkiapay insuffisant' },
                        { status: 400 }
                    )
                }

                isVerified = true
            } catch (e) {
                console.error('Kkiapay verification error', e)
                return NextResponse.json(
                    { success: false, error: 'Erreur de connexion à Kkiapay' },
                    { status: 502 }
                )
            }
        }

        // ─── FEDAPAY ─────────────────────────────────────────────────────────
        else if (method === 'fedapay') {
            try {
                const secretKey = sm.fedapay_secret_key
                const isSandbox = sm.fedapay_sandbox === 'true'
                const apiBase = isSandbox
                    ? 'https://sandbox-api.fedapay.com'
                    : 'https://api.fedapay.com'

                // Toujours passer par l'API FedaPay — ne JAMAIS utiliser le transaction_id
                // stocké en DB comme raccourci d'acceptation.
                // RAISON : le webhook stocke transaction_id même pour les paiements ÉCHOUÉS
                // (payment_status = 'failed'). Si on accepte le raccourci, un attaquant qui
                // paie 100 XOF pour une commande de 50 000 XOF (webhook marque 'failed' + stocke tx_id)
                // peut appeler verify avec ce tx_id et obtenir { success: true } sans payer réellement.
                if (secretKey) {
                    try {
                        const verifyRes = await fetch(`${apiBase}/v1/transactions/${transaction_id}`, {
                            headers: {
                                Authorization: `Bearer ${secretKey}`,
                                'Content-Type': 'application/json',
                            },
                        })
                        if (verifyRes.ok) {
                            const verifyData = await verifyRes.json()
                            const txObject = verifyData?.['v1/transaction'] || verifyData?.v1?.transaction || verifyData?.transaction || verifyData
                            const verifiedStatus =
                                txObject?.status
                                || verifyData?.status
                            console.log('FedaPay API verify — statut:', verifiedStatus, '| id:', transaction_id)
                            if (verifiedStatus === 'approved' || verifiedStatus === 'transferred') {
                                // ─── Vérification du montant FedaPay ─────────────────────────
                                // FedaPay stocke les montants en XOF directement (pas de centimes).
                                // Le franc CFA (XOF) n'a pas de sous-unité — 10 000 XOF = 10 000.
                                // CRITIQUE : ne jamais sauter cette vérification — un attaquant
                                // pourrait payer 100 XOF et valider une commande à 50 000 XOF.
                                const txAmount = txObject?.amount
                                if (txAmount !== undefined && txAmount !== null) {
                                    const verifiedAmountXof = txAmount  // XOF direct, pas de /100
                                    if (verifiedAmountXof < existingOrder.amount * 0.99) {
                                        console.error('[Verify/FedaPay] Montant insuffisant:', {
                                            paid: verifiedAmountXof,
                                            expected: existingOrder.amount,
                                        })
                                        return NextResponse.json(
                                            { success: false, error: 'Montant FedaPay insuffisant' },
                                            { status: 400 }
                                        )
                                    }
                                }
                                isVerified = true
                            } else {
                                return NextResponse.json(
                                    { success: false, error: `FedaPay statut: ${verifiedStatus || 'inconnu'}` },
                                    { status: 400 }
                                )
                            }
                        } else {
                            const errBody = await verifyRes.text()
                            console.warn(`FedaPay API ${verifyRes.status}: ${errBody.slice(0, 100)}`)
                            return NextResponse.json(
                                { success: false, error: 'FedaPay: impossible de vérifier — réessayez ou contactez le support' },
                                { status: 400 }
                            )
                        }
                    } catch (e) {
                        console.error('FedaPay API fallback error', e)
                        return NextResponse.json(
                            { success: false, error: 'Erreur de connexion à FedaPay' },
                            { status: 502 }
                        )
                    }
                } else {
                    // Fail-closed : sans clé secrète, impossible de vérifier auprès de FedaPay
                    console.error('[Verify/FedaPay] Clé secrète manquante — vérification impossible')
                    return NextResponse.json(
                        { success: false, error: 'Configuration FedaPay incomplète (clé secrète manquante dans les settings admin)' },
                        { status: 503 }
                    )
                }
            } catch (e) {
                console.error('Fedapay verification error', e)
                return NextResponse.json(
                    { success: false, error: 'Erreur vérification FedaPay' },
                    { status: 500 }
                )
            }
        }

        // ─── STRIPE ──────────────────────────────────────────────────────────
        else if (method === 'stripe') {
            try {
                const secretKey = sm.stripe_secret_key
                if (!secretKey) {
                    return NextResponse.json({ success: false, error: 'Stripe non configuré' }, { status: 503 })
                }

                const stripe = new Stripe(secretKey)
                const pi = await stripe.paymentIntents.retrieve(transaction_id)

                if (pi.status !== 'succeeded') {
                    return NextResponse.json(
                        { success: false, error: `Stripe PaymentIntent non abouti: ${pi.status}` },
                        { status: 400 }
                    )
                }

                // Vérification du montant Stripe
                const currency = (existingOrder.currency || 'XOF').toUpperCase()
                const expectedStripeAmount = ZERO_DECIMAL.has(currency)
                    ? Math.round(existingOrder.amount)
                    : Math.round(existingOrder.amount * 100)

                if (pi.amount < expectedStripeAmount) {
                    console.error('[Verify/Stripe] Montant insuffisant:', {
                        paid: pi.amount,
                        expected: expectedStripeAmount,
                        currency,
                    })
                    return NextResponse.json(
                        { success: false, error: 'Montant Stripe insuffisant' },
                        { status: 400 }
                    )
                }

                // Vérifier que ce PaymentIntent appartient bien à cette commande.
                // metadata.order_id est OBLIGATOIRE — toujours défini par checkout/stripe/route.ts.
                // Un PaymentIntent sans metadata.order_id = créé hors de notre système → rejet.
                if (!pi.metadata?.order_id || pi.metadata.order_id !== order_id) {
                    console.error('[Verify/Stripe] order_id metadata manquant ou incorrect:', {
                        pi_order_id: pi.metadata?.order_id,
                        requested_order_id: order_id,
                    })
                    return NextResponse.json(
                        { success: false, error: 'Transaction Stripe non associée à cette commande' },
                        { status: 400 }
                    )
                }

                isVerified = true
            } catch (e) {
                console.error('Stripe verification error', e)
                return NextResponse.json(
                    { success: false, error: 'Erreur de connexion à Stripe' },
                    { status: 502 }
                )
            }
        }

        // ─── PAYPAL ──────────────────────────────────────────────────────────
        else if (method === 'paypal') {
            if (
                existingOrder.payment_status === 'completed' &&
                existingOrder.transaction_id === transaction_id
            ) {
                isVerified = true
            } else {
                try {
                    if (sm.paypal_client_id && sm.paypal_client_secret) {
                        const base = sm.paypal_sandbox === 'true'
                            ? 'https://api-m.sandbox.paypal.com'
                            : 'https://api-m.paypal.com'

                        const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                Authorization: `Basic ${Buffer.from(`${sm.paypal_client_id}:${sm.paypal_client_secret}`).toString('base64')}`,
                            },
                            body: 'grant_type=client_credentials',
                        })
                        const tokenData = await tokenRes.json()

                        if (tokenData.access_token) {
                            const captureRes = await fetch(
                                `${base}/v2/payments/captures/${transaction_id}`,
                                {
                                    headers: { Authorization: `Bearer ${tokenData.access_token}` },
                                }
                            )
                            const captureData = await captureRes.json()

                            if (captureData.status !== 'COMPLETED') {
                                return NextResponse.json(
                                    { success: false, error: `PayPal capture non complétée: ${captureData.status}` },
                                    { status: 400 }
                                )
                            }

                            // Vérifier via custom_id que la capture appartient bien à cette commande.
                            // custom_id est OBLIGATOIRE — toujours défini par paypal/create/route.ts.
                            // Un custom_id absent ou non concordant = capture externe → rejet immédiat.
                            const captureCustomId =
                                captureData.custom_id ||
                                captureData.invoice_id
                            if (!captureCustomId || captureCustomId !== order_id) {
                                console.error('[Verify/PayPal] custom_id manquant ou incorrect:', {
                                    capture_order: captureCustomId,
                                    requested: order_id,
                                })
                                return NextResponse.json(
                                    { success: false, error: 'Capture PayPal non associée à cette commande' },
                                    { status: 400 }
                                )
                            }

                            // Vérification du montant PayPal (XOF uniquement — pas de conversion temps réel)
                            const capturedCurrency = (captureData.amount?.currency_code || '').toUpperCase()
                            const capturedAmountValue = parseFloat(captureData.amount?.value || '0')
                            if (capturedCurrency === 'XOF' && capturedAmountValue < existingOrder.amount * 0.99) {
                                console.error('[Verify/PayPal] Montant insuffisant:', {
                                    paid: capturedAmountValue,
                                    expected: existingOrder.amount,
                                    currency: capturedCurrency,
                                })
                                return NextResponse.json(
                                    { success: false, error: 'Montant PayPal insuffisant' },
                                    { status: 400 }
                                )
                            }

                            isVerified = true
                        }
                    }
                } catch (e) {
                    console.error('PayPal verification error', e)
                    return NextResponse.json(
                        { success: false, error: 'Erreur de connexion à PayPal' },
                        { status: 502 }
                    )
                }
            }
        }

        // ─── ZEYOW ───────────────────────────────────────────────────────────
        // Zeyow utilise un flow de redirection. La confirmation se fait via
        // /api/checkout/zeyow/confirm (appelé par le browser après redirect).
        else if (method === 'zeyow') {
            if (existingOrder.payment_status === 'completed') {
                isVerified = true
            } else {
                return NextResponse.json(
                    { success: false, error: 'Zeyow: paiement non encore confirmé. Utilisez la page de retour Zeyow.' },
                    { status: 400 }
                )
            }
        }

        if (!isVerified) {
            return NextResponse.json(
                { success: false, error: 'Payment verification failed' },
                { status: 400 }
            )
        }

        // ─── Mise à jour atomique — uniquement si encore pending ────────────
        // La clause .eq('payment_status', 'pending') garantit qu'une commande
        // déjà complétée ou échouée ne peut pas être modifiée.
        const { error: updateError, data: updatedRows } = await supabase
            .from('orders')
            .update({ payment_status: 'completed', transaction_id })
            .eq('id', order_id)
            .eq('payment_status', 'pending') // Garde atomique : jamais modifier une commande déjà traitée
            .select('id')

        if (updateError) {
            console.error('Order update error:', updateError.message)
            return NextResponse.json(
                { success: false, error: 'Database update failed' },
                { status: 500 }
            )
        }

        // Aucune ligne modifiée = commande n'était pas pending (idempotence silencieuse)
        if (!updatedRows || updatedRows.length === 0) {
            return NextResponse.json({ success: true, message: 'Already verified' })
        }

        // ── Classement Client : passage automatique en « converti » ──
        if (existingOrder.customer_email) {
            markClientConverted({ email: existingOrder.customer_email, serviceLabel: 'Commande boutique', source: 'paiement' })
                .catch(() => {})
        }

        // ── Envoi email facture (best-effort, fire-and-forget) ──
        // Le trigger SQL crée déjà la ligne `invoices` quand payment_status passe
        // à 'completed'. On déclenche l'envoi sans bloquer la réponse.
        if (existingOrder.customer_email) {
            const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'
            sendInvoiceEmail({
                orderId: order_id,
                toEmail: existingOrder.customer_email,
                baseUrl,
            }).catch(e => console.error('[checkout/verify] sendInvoiceEmail failed:', e))
        }

        // ─── Décrémenter le stock (Système Unifié + Héritage) ─────────────────
        const cartToProcess = Array.isArray(existingOrder.cart_items) && existingOrder.cart_items.length > 0
            ? existingOrder.cart_items
            : [{ id: existingOrder.product_id, quantity: existingOrder.quantity || 1 }];

        for (const item of cartToProcess) {
            const targetId = item.id || existingOrder.product_id;
            const targetQty = item.quantity || existingOrder.quantity || 1;

            if (!targetId) continue;

            // 1. Décrémentation Legacy (Ancienne table products, "silencieux" si échoue)
            try {
                await supabase.rpc('decrement_stock', {
                    p_id: targetId,
                    qty: targetQty,
                });
            } catch (e) {
                // Ignorer les erreurs (peut-être pas un produit legacy)
            }

            // 2. Décrémentation Nouveau Système (inventory_items + traceability)
            const { data: invItem } = await supabase
                .from('inventory_items')
                .select('id, track_inventory, current_stock')
                .eq('id', targetId)
                .maybeSingle();

            if (invItem && invItem.track_inventory) {
                const finalStock = Math.max(0, (invItem.current_stock || 0) - targetQty);
                
                // Mettre à jour la quantité
                await supabase
                    .from('inventory_items')
                    .update({ current_stock: finalStock })
                    .eq('id', invItem.id);
                
                // Écrire le mouvement immuable (audit)
                await supabase.from('inventory_movements').insert({
                    item_id: invItem.id,
                    type: 'sale',
                    quantity_change: -targetQty,
                    stock_after: finalStock,
                    reference_id: order_id,
                    notes: `Vente E-Commerce (Ref: ${order_id.slice(0, 8).toUpperCase()}, Pmt: ${method})`
                });
            }
        }

        // ─── Auto-génération Facture ERP ─────────────────────────────────────
        // Après paiement vérifié, on crée automatiquement un document financier
        // de type "facture" avec statut "paye" dans la table documents_financiers.
        // Cela relie la boutique/événements au système de facturation ERP.
        try {
            // Garde d'idempotence : vérifier si une facture existe déjà pour cette commande
            const orderRef = order_id.slice(0, 8).toUpperCase()
            const { data: existingInvoice } = await supabase
                .from('documents_financiers')
                .select('id')
                .ilike('notes', `%${orderRef}%`)
                .maybeSingle()

            if (existingInvoice) {
                console.log(`[ERP] Facture déjà existante pour commande ${orderRef} — skip`)
            } else {
                // Récupérer les détails complets de la commande pour la facture
                const { data: fullOrder } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('id', order_id)
                    .single()

                // Commande issue d'une proposition / lien de paiement : classification
                // UNIQUE et idempotente (facture / boutique / paiement selon la catégorie)
                // — surtout PAS de facture « Boutique en ligne » ici (source de doublons).
                if (fullOrder && fullOrder.shipping_zone === 'proposal') {
                    await classifyProposalPayment(supabase, String(fullOrder.shipping_address || ''), fullOrder)
                } else if (fullOrder) {
                    // Déterminer la source (boutique ou événement)
                    const { data: eventReg } = await supabase
                        .from('event_registrations')
                        .select('id, events(title)')
                        .eq('order_id', order_id)
                        .maybeSingle()

                    const isEvent = !!eventReg
                    const sourceLabel = isEvent ? 'Événement' : 'Boutique en ligne'

                    // Construire les items de la facture depuis le panier
                    type CartItemRaw = {
                        title?: string
                        name?: string
                        price?: number
                        sale_price?: number
                        quantity?: number
                    }
                    const cartItems: CartItemRaw[] =
                        Array.isArray(fullOrder.cart_items) && fullOrder.cart_items.length > 0
                            ? fullOrder.cart_items
                            : [{
                                title: fullOrder.product_title || sourceLabel,
                                price: fullOrder.amount / (fullOrder.quantity || 1),
                                quantity: fullOrder.quantity || 1,
                            }]

                    const invoiceItems = cartItems.map((item: CartItemRaw) => ({
                        description: item.title || item.name || 'Article',
                        quantity: item.quantity || 1,
                        unit_price: (item.sale_price && item.sale_price < (item.price || 0))
                            ? item.sale_price
                            : (item.price || 0),
                        tva: 0,
                    }))

                    const sousTotal = invoiceItems.reduce(
                        (sum: number, it: { quantity: number; unit_price: number }) =>
                            sum + it.quantity * it.unit_price, 0
                    )

                    // Frais de livraison en ligne séparée si > 0
                    const shippingFee = fullOrder.shipping_fee || 0
                    if (shippingFee > 0) {
                        invoiceItems.push({
                            description: `Frais de livraison${fullOrder.shipping_zone ? ` (${fullOrder.shipping_zone})` : ''}`,
                            quantity: 1,
                            unit_price: shippingFee,
                            tva: 0,
                        })
                    }

                    // Numéro de facture séquentiel officiel (compteur atomique)
                    const invoiceNumero = await nextDocumentNumber(supabase, 'facture')

                    // Récupérer le taux de change actuel pour le verrouillage
                    const orderCurrency = (fullOrder.currency || 'XOF').toUpperCase()
                    let invoiceExchangeRate = 1
                    if (orderCurrency !== 'XOF') {
                        const { data: curData } = await supabase
                            .from('currencies')
                            .select('exchange_rate_to_base')
                            .eq('code', orderCurrency)
                            .single()
                        if (curData) invoiceExchangeRate = Number(curData.exchange_rate_to_base)
                    }

                    // Insérer la facture ERP
                    await supabase.from('documents_financiers').insert({
                        type: 'facture',
                        numero: invoiceNumero,
                        client_nom: fullOrder.customer_name || 'Client',
                        client_prenom: '',
                        client_email: fullOrder.customer_email || '',
                        client_phone: fullOrder.customer_phone || '',
                        client_adresse: fullOrder.shipping_address || '',
                        currency: orderCurrency,
                        exchange_rate_applied: invoiceExchangeRate,
                        items: invoiceItems,
                        sous_total: sousTotal + shippingFee,
                        total_tva: 0,
                        remise: 0,
                        total: fullOrder.amount,
                        status: 'paye',
                        notes: `Facture auto-générée — ${sourceLabel}\nCommande: ${orderRef}\nMéthode: ${method}\nTransaction: ${transaction_id}`,
                        conditions: 'Document généré automatiquement après paiement vérifié.',
                        validite: 'Acquittée',
                    })

                    console.log(`[ERP] Facture auto-générée: ${invoiceNumero} pour commande ${orderRef}`)
                }
            }
        } catch (erpErr) {
            // Non-bloquant : on ne veut pas faire échouer le verify si la facture échoue
            console.error('[ERP] Erreur auto-génération facture:', erpErr)
        }

        // ─── Notification email ──────────────────────────────────────────────
        try {
            const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
            const notifUrl = `${origin}/api/notifications/order`
            console.log('[Verify] Envoi notification →', notifUrl, '| order_id:', order_id)
            const notifRes = await fetch(notifUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id, type: 'payment_success' }),
            })
            const notifBody = await notifRes.text()
            console.log('[Verify] Notification response:', notifRes.status, notifBody)
        } catch (notifErr) {
            console.error('[Verify] Notification email ERREUR:', notifErr)
        }

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json(
            { success: false, error: 'Server error' },
            { status: 500 }
        )
    }
}
