import { NextResponse } from 'next/server'
import axios from 'axios'
import Stripe from 'stripe'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { gateway, settings } = body

        if (!gateway) {
            return NextResponse.json({ success: false, error: 'Passerelle non spécifiée' })
        }

        switch (gateway) {

            // ─── KKIAPAY ──────────────────────────────────────────────────────────────
            case 'kkiapay': {
                const sandbox = settings?.kkiapay_sandbox === 'true'
                const publicKey = sandbox
                    ? (settings?.kkiapay_sandbox_public_key || settings?.kkiapay_public_key)
                    : settings?.kkiapay_public_key
                const privateKey = sandbox
                    ? (settings?.kkiapay_sandbox_private_key || settings?.kkiapay_private_key)
                    : settings?.kkiapay_private_key

                if (!publicKey || !privateKey) {
                    return NextResponse.json({ success: false, error: 'Clé publique et clé privée Kkiapay requises' })
                }
                if (publicKey.length < 10 || privateKey.length < 10) {
                    return NextResponse.json({ success: false, error: 'Format de clé Kkiapay invalide (trop courte)' })
                }

                try {
                    const apiUrl = sandbox ? 'https://api-sandbox.kkiapay.me' : 'https://api.kkiapay.me'
                    const env = sandbox ? 'Sandbox' : 'Production'

                    const response = await axios.post(
                        `${apiUrl}/api/v1/transactions/status`,
                        { transactionId: 'test-connectivity' },
                        {
                            headers: {
                                'x-api-key': publicKey,
                                'x-private-key': privateKey,
                                'x-secret-key': settings?.kkiapay_secret_key || '',
                            },
                            validateStatus: () => true,
                            timeout: 10000,
                        }
                    )

                    // 200 = transaction trouvée (improbable avec un ID bidon mais clés valides)
                    // 4003 / autre erreur métier = clés acceptées, transaction non trouvée → connectivité OK
                    if (response.status === 200) {
                        return NextResponse.json({ success: true, message: `Kkiapay ${env} connectée` })
                    }
                    if (response.status === 401 || response.status === 403) {
                        return NextResponse.json({ success: false, error: `Kkiapay: clés invalides ou non autorisées (${response.status})` })
                    }
                    if (response.status === 404) {
                        return NextResponse.json({ success: false, error: `Kkiapay: endpoint introuvable — vérifiez le mode Sandbox/Production` })
                    }
                    // Status 400 ou 500 avec un body = le serveur a reçu et traité la requête.
                    // Si les clés étaient invalides, on recevrait 401/403. Un 400 signifie que
                    // l'auth a réussi mais la transaction bidon est rejetée → connectivité OK.
                    if (response.status === 400 || response.status === 500) {
                        return NextResponse.json({ success: true, message: `Kkiapay ${env} connectée (clés validées)` })
                    }
                    return NextResponse.json({ success: false, error: `Kkiapay: réponse inattendue (status ${response.status})` })
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'Erreur réseau'
                    return NextResponse.json({ success: false, error: `Kkiapay inaccessible: ${msg}` })
                }
            }

            // ─── FEDAPAY ──────────────────────────────────────────────────────────────
            case 'fedapay': {
                // Seule la clé secrète est nécessaire pour tester l'API
                const secretKey = settings?.fedapay_secret_key

                if (!secretKey) {
                    return NextResponse.json({ success: false, error: 'Clé secrète FedaPay manquante' })
                }

                try {
                    const isSandbox = settings?.fedapay_sandbox === 'true'
                    const apiUrl = isSandbox
                        ? 'https://sandbox-api.fedapay.com'
                        : 'https://api.fedapay.com'
                    const env = isSandbox ? 'Sandbox' : 'Production'

                    // GET /v1/customers — endpoint stable pour valider l'auth
                    // (GET /v1/transactions déprécié → 400 ; POST /v1/transactions/search → 404 en sandbox)
                    const response = await axios.get(`${apiUrl}/v1/customers?per_page=1`, {
                        headers: {
                            Authorization: `Bearer ${secretKey}`,
                            'Content-Type': 'application/json',
                        },
                        validateStatus: () => true,
                        timeout: 10000,
                    })

                    if (response.status === 200) {
                        return NextResponse.json({ success: true, message: `FedaPay ${env} connectée` })
                    }
                    if (response.status === 403) {
                        // 403 = clé authentifiée mais permissions restreintes (compte neuf, plan limité)
                        return NextResponse.json({ success: true, message: `FedaPay ${env}: clé valide (accès restreint — compte vérifié)` })
                    }
                    if (response.status === 401) {
                        return NextResponse.json({ success: false, error: 'Clé secrète FedaPay invalide (401 Unauthorized)' })
                    }
                    // Inclure le corps de réponse pour faciliter le diagnostic
                    const body = response.data
                    const detail = body?.message || body?.error || (typeof body === 'string' ? body.slice(0, 150) : '')
                    return NextResponse.json({
                        success: false,
                        error: `FedaPay: statut HTTP ${response.status}${detail ? ` — ${detail}` : ''} (vérifiez mode Sandbox/Production)`,
                    })
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'Erreur réseau'
                    return NextResponse.json({ success: false, error: `FedaPay inaccessible: ${msg}` })
                }
            }

            // ─── ZEYOW ────────────────────────────────────────────────────────────────
            case 'zeyow': {
                const redirectUrl = settings?.zeyow_redirect_url
                if (!redirectUrl) {
                    return NextResponse.json({ success: false, error: 'URL de redirection Zeyow manquante' })
                }

                // Zeyow est basé sur la redirection (pas de clé API) — on valide l'URL
                let parsed: URL
                try {
                    parsed = new URL(redirectUrl)
                } catch {
                    return NextResponse.json({ success: false, error: 'URL Zeyow invalide (format incorrect)' })
                }

                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    return NextResponse.json({ success: false, error: 'URL Zeyow invalide (doit commencer par https://)' })
                }

                try {
                    const response = await axios.head(redirectUrl, {
                        timeout: 8000,
                        validateStatus: () => true,
                        maxRedirects: 5,
                    })

                    // Codes < 500 considérés comme "accessible" (2xx, 3xx, 4xx = le serveur répond)
                    if (response.status < 500) {
                        return NextResponse.json({ success: true, message: `Zeyow URL accessible (HTTP ${response.status})` })
                    }
                    return NextResponse.json({ success: false, error: `Zeyow: serveur en erreur (${response.status})` })
                } catch {
                    // HEAD peut être bloqué (CORS, firewall) — l'URL est syntaxiquement valide
                    return NextResponse.json({ success: true, message: 'Zeyow URL valide (format correct — serveur non testé)' })
                }
            }

            // ─── STRIPE ───────────────────────────────────────────────────────────────
            case 'stripe': {
                const secretKey = settings?.stripe_secret_key
                const publicKey = settings?.stripe_public_key

                if (!secretKey || !publicKey) {
                    return NextResponse.json({ success: false, error: 'Clé secrète et clé publique Stripe requises' })
                }
                if (!secretKey.startsWith('sk_') || !publicKey.startsWith('pk_')) {
                    return NextResponse.json({ success: false, error: 'Format invalide — sk_ pour la clé secrète, pk_ pour la clé publique' })
                }

                // Vérifier la cohérence entre la clé et le mode configuré
                const keyIsTest = secretKey.startsWith('sk_test_')
                const modeIsSandbox = settings?.stripe_sandbox === 'true'
                if (keyIsTest !== modeIsSandbox) {
                    const keyType = keyIsTest ? 'Test (Sandbox)' : 'Live (Production)'
                    const modeType = modeIsSandbox ? 'Sandbox' : 'Production'
                    return NextResponse.json({
                        success: false,
                        error: `Incohérence Stripe: la clé est ${keyType} mais le mode configuré est ${modeType}`,
                    })
                }

                try {
                    const stripe = new Stripe(secretKey)
                    // balance.retrieve() est universellement disponible pour tous les types de comptes Stripe
                    // (contrairement à accounts.retrieve() réservé aux comptes Connect)
                    const balance = await stripe.balance.retrieve()
                    const env = keyIsTest ? 'Sandbox (Test)' : 'Production (Live)'
                    const currency = balance.available[0]?.currency?.toUpperCase() || '?'
                    return NextResponse.json({
                        success: true,
                        message: `Stripe ${env} connectée — Devise principale: ${currency}`,
                    })
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'Erreur'
                    return NextResponse.json({ success: false, error: `Stripe: ${msg}` })
                }
            }

            // ─── PAYPAL ───────────────────────────────────────────────────────────────
            case 'paypal': {
                const clientId = settings?.paypal_client_id
                const clientSecret = settings?.paypal_client_secret

                if (!clientId || !clientSecret) {
                    return NextResponse.json({ success: false, error: 'Client ID et Client Secret PayPal requis' })
                }

                try {
                    const sandbox = settings?.paypal_sandbox === 'true'
                    const base = sandbox
                        ? 'https://api-m.sandbox.paypal.com'
                        : 'https://api-m.paypal.com'
                    const env = sandbox ? 'Sandbox' : 'Production'

                    const res = await axios.post(
                        `${base}/v1/oauth2/token`,
                        'grant_type=client_credentials',
                        {
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                            },
                            // validateStatus indispensable : sans ça axios lance une exception sur 401
                            validateStatus: () => true,
                            timeout: 10000,
                        }
                    )

                    if (res.status === 200 && res.data?.access_token) {
                        return NextResponse.json({ success: true, message: `PayPal Business ${env} connecté` })
                    }
                    if (res.status === 401) {
                        return NextResponse.json({ success: false, error: 'PayPal: Client ID ou Client Secret invalide (401)' })
                    }
                    if (res.status === 400) {
                        return NextResponse.json({ success: false, error: 'PayPal: requête invalide (400) — vérifiez les credentials' })
                    }
                    return NextResponse.json({ success: false, error: `PayPal: réponse inattendue (status ${res.status})` })
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'Erreur réseau'
                    return NextResponse.json({ success: false, error: `PayPal inaccessible: ${msg}` })
                }
            }

            default:
                return NextResponse.json({ success: false, error: 'Passerelle inconnue' })
        }
    } catch {
        return NextResponse.json({ success: false, error: 'Erreur serveur interne' })
    }
}
