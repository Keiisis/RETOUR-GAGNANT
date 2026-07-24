import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp, rateLimitHeaders, CHECKOUT_LIMIT } from '@/lib/rate-limit'
import { scanRequestBody } from '@/lib/waf'
import { ttcFromHt } from '@/lib/tax'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
    try {
        // ═══ RATE LIMITING ════════════════════════════════════════════
        // Appliqué avant toute opération coûteuse (DB, parsing body).
        // Protège contre : flood de création de commandes, épuisement du
        // stock par réservations massives, abus du système de coupons.
        const clientIp = getClientIp(request)
        const rl = rateLimit(`checkout:${clientIp}`, CHECKOUT_LIMIT)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Trop de tentatives. Veuillez patienter avant de réessayer.' },
                { status: 429, headers: rateLimitHeaders(rl) }
            )
        }

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { error: 'Configuration serveur manquante (SUPABASE_SERVICE_ROLE_KEY non définie sur Vercel)' },
                { status: 503 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // ── WAF #2 : analyse structurelle du body (proto pollution / RCE / SSRF / DoS) ──
        const { body: scanned, rejection } = await scanRequestBody(request)
        if (rejection) return rejection
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body = (scanned ?? {}) as any

        const {
            product_id,
            product_title,
            quantity,
            amount,
            currency,
            customer_name,
            customer_email,
            customer_phone,
            payment_method,
            cart_items,
            coupon_id,
            shipping_country,
            shipping_address,
            shipping_zone,
            shipping_fee,
            is_proposal,
            selected_item_ids,
        } = body

        // ═══ VALIDATION STRICTE DES ENTRÉES ══════════════════════
        if (!customer_name || !customer_phone || !payment_method || !amount) {
            return NextResponse.json(
                { error: 'Champs obligatoires manquants' },
                { status: 400 }
            )
        }

        // Montant: nombre positif, non nul, non flottant absurde
        const parsedAmount = typeof amount === 'number' ? amount : parseFloat(String(amount))
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
        }

        // Méthode de paiement: liste blanche stricte
        const ALLOWED_METHODS = ['kkiapay', 'fedapay', 'stripe', 'paypal', 'zeyow']
        if (!ALLOWED_METHODS.includes(payment_method)) {
            return NextResponse.json({ error: 'Méthode de paiement non autorisée' }, { status: 400 })
        }

        // Vérifier que la méthode est activée dans les settings admin
        const { data: methodSetting } = await supabase
            .from('settings')
            .select('value')
            .eq('key', `${payment_method}_enabled`)
            .maybeSingle()
        if (!methodSetting || methodSetting.value !== 'true') {
            return NextResponse.json(
                { error: `La méthode de paiement "${payment_method}" n'est pas disponible actuellement` },
                { status: 400 }
            )
        }

        // Quantité produit unique: entier strictement positif
        if (quantity !== undefined) {
            const parsedQty = parseInt(String(quantity), 10)
            if (isNaN(parsedQty) || parsedQty < 1 || parsedQty > 10000 || parsedQty !== parseFloat(String(quantity))) {
                return NextResponse.json({ error: 'Quantité invalide (entier entre 1 et 10 000)' }, { status: 400 })
            }
        }

        // Limite et validation du panier (anti-DoS + anti-injection de quantité)
        if (Array.isArray(cart_items)) {
            if (cart_items.length > 50) {
                return NextResponse.json({ error: 'Trop d\'articles dans le panier (max 50)' }, { status: 400 })
            }
            let totalCartQty = 0
            for (const item of cart_items) {
                const itemQty = parseInt(String(item.quantity), 10)
                if (isNaN(itemQty) || itemQty < 1 || itemQty > 10000 || itemQty !== parseFloat(String(item.quantity))) {
                    return NextResponse.json(
                        { error: `Quantité invalide pour un article du panier` },
                        { status: 400 }
                    )
                }
                item.quantity = itemQty // Normaliser en entier
                totalCartQty += itemQty
            }
            // Anti-DoS : quantité totale toutes lignes confondues
            if (totalCartQty > 1000) {
                return NextResponse.json(
                    { error: 'Quantité totale du panier trop élevée (max 1000 unités)' },
                    { status: 400 }
                )
            }
        }

        // ═══ VALIDATION DU MONTANT CÔTÉ SERVEUR ═══════════════════
        // JAMAIS faire confiance au montant envoyé par le client.
        // On recalcule le montant attendu depuis les prix en base de données.
        let expectedSubtotal = 0
        // validatedAmount : montant réel à stocker en DB.
        // Initialisé au montant client, écrasé par le calcul serveur dès qu'on a des produits.
        let validatedAmount = parsedAmount
        // validatedShippingFee : clamped server-side ici (scope global) pour être utilisable
        // dans l'INSERT même si aucun produit n'est présent dans la commande.
        const validatedShippingFee = Math.max(0, Math.min(Number(shipping_fee) || 0, 100000))

        // ── CAS SPÉCIAL : paiement d'une proposition IA ─────────────────────
        // Les propositions voyages sont signalées par le flag is_proposal.
        // Elles ne sont pas dans la table products → validation différente.
        const isProposalPayment = is_proposal === true

        // Déclaré ici pour être accessible dans le rollback de la création d'ordre
        const reservedItems: { product_id: string, quantity: number }[] = []

        // Sélection à la carte d'une proposition : détail des prestations choisies,
        // recalculé serveur et stocké dans cart_items pour la traçabilité compta
        let proposalSelection: { proposal_item_id: string; title: string; price: number }[] | null = null

        if (isProposalPayment) {
            // Valider l'UUID de la proposition contre ai_client_proposals
            const proposalUuid = product_id
            const { data: proposal, error: propErr } = await supabase
                .from('ai_client_proposals')
                .select('id, total_amount, currency')
                .eq('id', proposalUuid)
                .maybeSingle()

            if (propErr || !proposal) {
                return NextResponse.json(
                    { error: 'Proposition introuvable ou expirée' },
                    { status: 400 }
                )
            }

            // ── SÉLECTION À LA CARTE : le client a choisi certaines prestations.
            // Le total est TOUJOURS recalculé serveur depuis ai_proposal_items —
            // le montant envoyé par le client ne sert qu'au contrôle de cohérence.
            if (Array.isArray(selected_item_ids) && selected_item_ids.length > 0) {
                if (selected_item_ids.length > 100 || selected_item_ids.some((x: unknown) => typeof x !== 'string')) {
                    return NextResponse.json({ error: 'Sélection invalide' }, { status: 400 })
                }
                const { data: selItems } = await supabase
                    .from('ai_proposal_items')
                    .select('id, type, title, selling_price')
                    .eq('proposal_id', proposalUuid)
                    .in('id', selected_item_ids)

                const billable = (selItems || []).filter(
                    it => it.type !== 'hero' && it.type !== 'pricing' && Number(it.selling_price) > 0
                )
                if (billable.length !== selected_item_ids.length) {
                    return NextResponse.json(
                        { error: 'Sélection invalide — certaines prestations sont introuvables. Actualisez la page.' },
                        { status: 400 }
                    )
                }
                // TVA EN SUS : les selling_price sont HORS TAXE. Le client
                // paie le TTC (HT × 1,18). On valide le montant reçu contre le
                // TTC calculé serveur, et on stocke le TTC.
                const expectedHT = billable.reduce((s, it) => s + Number(it.selling_price), 0)
                const expectedTTC = ttcFromHt(expectedHT, proposal.currency)
                if (expectedTTC <= 0 || Math.abs(parsedAmount - expectedTTC) > 1) {
                    console.error(
                        `[Checkout/Proposal] Sélection — montant invalide — reçu: ${parsedAmount}, attendu TTC: ${expectedTTC}`
                    )
                    return NextResponse.json(
                        { error: 'Montant invalide pour cette sélection. Veuillez actualiser la page.' },
                        { status: 400 }
                    )
                }
                validatedAmount = expectedTTC
                proposalSelection = billable.map(it => ({
                    proposal_item_id: it.id, title: it.title, price: Number(it.selling_price),
                }))
            } else {
                // ── Proposition complète (comportement historique) ──
                // TVA EN SUS : total_amount est HORS TAXE ; le client paie le
                // TTC (× 1,18). Validation stricte contre le TTC serveur.
                const expectedTTC = ttcFromHt(Number(proposal.total_amount), proposal.currency)
                if (Math.abs(parsedAmount - expectedTTC) > 1) {
                    console.error(
                        `[Checkout/Proposal] Montant invalide — reçu: ${parsedAmount}, attendu TTC: ${expectedTTC}`
                    )
                    return NextResponse.json(
                        { error: 'Montant invalide pour cette proposition. Veuillez actualiser la page.' },
                        { status: 400 }
                    )
                }

                // Montant TTC calculé serveur, jamais celui du client
                validatedAmount = expectedTTC
            }

            // Les coupons boutique ne s'appliquent pas aux propositions voyage
            if (coupon_id) {
                return NextResponse.json(
                    { error: 'Les codes promo boutique ne sont pas applicables aux propositions voyage' },
                    { status: 400 }
                )
            }

            // Pas de stock à réserver pour une proposition (service, pas produit physique)
        } else {
            // ── CAS NORMAL : produit boutique ────────────────────────────────
            const itemsForPriceCheck = cart_items && cart_items.length > 0
                ? cart_items
                : (product_id ? [{ product_id, quantity: quantity || 1 }] : [])

            // Anti-épuisement de coupon : interdire l'usage d'un coupon sans produit.
            // Sans produits, le montant n'est pas recalculé côté serveur — un attaquant
            // pourrait créer des dizaines de commandes bidon pour épuiser les utilisations d'un coupon.
            if (coupon_id && itemsForPriceCheck.length === 0) {
                return NextResponse.json(
                    { error: 'Un coupon ne peut pas être appliqué sans article' },
                    { status: 400 }
                )
            }

            if (itemsForPriceCheck.length > 0) {
                for (const item of itemsForPriceCheck) {
                    if (!item.product_id) continue

                    const { data: prod } = await supabase
                        .from('products')
                        .select('price, sale_price, is_active')
                        .eq('id', item.product_id)
                        .single()

                    if (!prod || !prod.is_active) {
                        return NextResponse.json(
                            { error: `Produit introuvable ou inactif: ${item.product_id}` },
                            { status: 400 }
                        )
                    }

                    const unitPrice = (prod.sale_price && prod.sale_price < prod.price)
                        ? prod.sale_price
                        : prod.price

                    expectedSubtotal += unitPrice * (item.quantity || 1)
                }

                // Recalculer le coupon côté serveur si fourni
                let serverCouponDiscount = 0
                if (coupon_id) {
                    const { data: coupon } = await supabase
                        .from('coupons')
                        .select('discount_type, discount_value, is_active, expires_at, max_uses, current_uses')
                        .eq('id', coupon_id)
                        .single()

                    if (
                        coupon &&
                        coupon.is_active &&
                        (!coupon.expires_at || new Date(coupon.expires_at) >= new Date()) &&
                        coupon.current_uses < coupon.max_uses
                    ) {
                        if (coupon.discount_type === 'percentage') {
                            serverCouponDiscount = Math.round(expectedSubtotal * coupon.discount_value / 100)
                        } else {
                            serverCouponDiscount = Math.max(0, coupon.discount_value)
                        }
                    }
                }

                const expectedTotal = Math.max(0, expectedSubtotal - serverCouponDiscount + validatedShippingFee)

                // Tolérance de 1 XOF pour les arrondis
                if (Math.abs(parsedAmount - expectedTotal) > 1) {
                    console.error(
                        `[Checkout] Montant invalide — reçu: ${parsedAmount} XOF, attendu: ${expectedTotal} XOF` +
                        ` (sous-total: ${expectedSubtotal}, coupon: ${serverCouponDiscount}, livraison: ${validatedShippingFee})`
                    )
                    return NextResponse.json(
                        { error: 'Montant invalide. Veuillez actualiser la page et réessayer.' },
                        { status: 400 }
                    )
                }

                // Stocker le montant calculé serveur (pas celui du client)
                validatedAmount = expectedTotal
            }

            // ═══ STOCK RESERVATION (Désactivé à la création) ═══════════════════════════
            // On ne réserve plus le stock à l'étape du checkout car cela crée des ruptures
            // de stock fantômes si le client abandonne la page de paiement Kkiapay/Fedapay.
            // Le stock sera décrémenté uniquement par le Webhook lors du succès du paiement.
            const itemsToReserve = cart_items && cart_items.length > 0
                ? cart_items
                : [{ product_id, quantity: quantity || 1 }]

            // Vérification simple du stock sans le décrémenter
            for (const item of itemsToReserve) {
                if (!item.product_id) continue;
                const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
                if (prod && prod.stock < (item.quantity || 1)) {
                     return NextResponse.json({ error: `Stock insuffisant pour l'un des articles` }, { status: 409 })
                }
            }
        }

        // ═══ ORDER CREATION ═══════════════════════════════════════
        const { data, error } = await supabase
            .from('orders')
            .insert({
                product_id: isProposalPayment ? null : (product_id || null),
                product_title: product_title || '',
                quantity: quantity || 1,
                amount: validatedAmount, // Toujours le montant validé serveur, jamais celui du client
                currency: currency || 'XOF',
                customer_name,
                customer_email: customer_email || null,
                customer_phone,
                payment_method,
                payment_status: 'pending',
                cart_items: proposalSelection ?? (cart_items || []),
                coupon_id: coupon_id || null,
                shipping_country: shipping_country || null,
                // Pour une proposition/lien de paiement : on marque la commande
                // (shipping_zone='proposal') et on garde le lien vers la proposition
                // (shipping_address = son id) — product_id a une FK vers products,
                // inutilisable ici. Permet la classification unique en aval.
                shipping_address: isProposalPayment ? String(product_id || '') : (shipping_address || null),
                shipping_zone: isProposalPayment ? 'proposal' : (shipping_zone || null),
                shipping_fee: validatedShippingFee, // Valeur clampée serveur, jamais celle du client
            })
            .select('id')
            .single()

        if (error) {
            console.error('Order creation error:', error)
            return NextResponse.json(
                { error: `Erreur DB: ${error.message}` },
                { status: 500 }
            )
        }

        // Incrémenter l'usage du coupon de façon atomique via RPC
        // Puis re-vérifier immédiatement que la limite n'est pas dépassée (anti-race condition).
        // Si deux requêtes simultanées ont toutes deux passé le check en mémoire, l'une d'elles
        // sera détectée ici et l'ordre sera annulé.
        if (coupon_id) {
            const { error: incrErr } = await supabase.rpc('increment_coupon_use', { c_id: coupon_id })

            if (incrErr) {
                // L'incrément a échoué (fonction SQL manquante ou erreur DB) — annuler la commande
                console.error('[Checkout] increment_coupon_use failed:', incrErr.message)
                await supabase.from('orders').delete().eq('id', data.id)
                return NextResponse.json(
                    { error: 'Erreur lors de l\'application du code promo. Veuillez réessayer.' },
                    { status: 500 }
                )
            }

            // Re-vérification post-incrément pour détecter le race condition
            const { data: couponCheck } = await supabase
                .from('coupons')
                .select('current_uses, max_uses')
                .eq('id', coupon_id)
                .single()

            if (couponCheck && couponCheck.current_uses > couponCheck.max_uses) {
                // Tenter d'annuler l'incrément (best-effort, erreur ignorée)
                const { error: decrErr } = await supabase.rpc('decrement_coupon_use', { c_id: coupon_id })
                if (decrErr) console.error('[Checkout] decrement_coupon_use failed:', decrErr.message)
                // Annuler la commande et libérer le stock
                await supabase.from('orders').delete().eq('id', data.id)
                return NextResponse.json(
                    { error: 'Ce code promo a atteint sa limite d\'utilisation. Veuillez réessayer sans coupon.' },
                    { status: 409 }
                )
            }
        }

        // Auto-create Nexus Tracker entry for order tracking
        // (Modifié : On ne crée plus le dossier_tracking ici. Il sera créé uniquement quand le paiement sera complété, via un trigger ou le webhook, pour éviter d'encombrer le dashboard avec des commandes non payées).
        /*
        const orderRef = `RG-CMD-${data.id.substring(0, 8).toUpperCase()}`
        const orderSteps = [
            { id: 1, label: 'Commande reçue', status: 'completed', date: new Date().toISOString().split('T')[0], note: 'Commande en ligne' },
            { id: 2, label: 'Confirmation de paiement', status: payment_method === 'kkiapay' || payment_method === 'fedapay' ? 'pending' : 'pending', date: null, note: '' },
            { id: 3, label: 'Préparation de la commande', status: 'pending', date: null, note: '' },
            { id: 4, label: 'Expédition / Livraison', status: 'pending', date: null, note: '' },
            { id: 5, label: 'Livré / Terminé', status: 'pending', date: null, note: '' },
        ]

        supabase.from('dossier_tracking').insert({
            num_dossier: orderRef,
            client_nom: customer_name,
            client_prenom: '',
            client_email: (customer_email || '').toLowerCase(),
            client_whatsapp: customer_phone || '',
            client_phone: customer_phone || '',
            service_type: 'Commande Boutique',
            service: 'boutique',
            statut: 'reception',
            etapes: orderSteps,
            progression: Math.round((1 / orderSteps.length) * 100),
            notes_internes: `Commande automatique.\nProduit: ${product_title || 'Panier'}\nMontant: ${validatedAmount} ${currency || 'XOF'}\nMéthode: ${payment_method}`,
        }).then(({ error: trackErr }) => {
            if (trackErr) console.error('[TRACKER] Boutique track error:', trackErr.message)
        })
        */

        return NextResponse.json({ order_id: data.id })
    } catch {
        return NextResponse.json(
            { error: 'Erreur serveur' },
            { status: 500 }
        )
    }
}
