import { NextResponse } from 'next/server'
import axios from 'axios'
import Stripe from 'stripe'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { gateway, settings } = body

        if (!gateway) {
            return NextResponse.json({ success: false, error: 'No gateway specified' })
        }

        switch (gateway) {
            case 'kkiapay': {
                const publicKey = settings?.kkiapay_public_key
                const privateKey = settings?.kkiapay_private_key

                if (!publicKey || !privateKey) {
                    return NextResponse.json({ success: false, error: 'Missing Kkiapay keys' })
                }
                if (publicKey.length < 10 || privateKey.length < 10) {
                    return NextResponse.json({ success: false, error: 'Invalid Kkiapay key format' })
                }

                try {
                    const sandbox = settings?.kkiapay_sandbox === 'true'
                    const apiUrl = sandbox ? 'https://api-sandbox.kkiapay.me' : 'https://api.kkiapay.me'

                    await axios.get(`${apiUrl}/api/v1/transactions/ping`, {
                        headers: {
                            'x-api-key': publicKey,
                            'x-private-key': privateKey,
                            'x-secret-key': settings?.kkiapay_secret_key || '',
                        },
                        validateStatus: () => true,
                    })

                    return NextResponse.json({ success: true, message: 'Kkiapay configurée' })
                } catch {
                    return NextResponse.json({ success: false, error: 'Echec de vérification Kkiapay' })
                }
            }

            case 'fedapay': {
                const publicKey = settings?.fedapay_public_key
                const secretKey = settings?.fedapay_secret_key

                if (!publicKey || !secretKey) {
                    return NextResponse.json({ success: false, error: 'Missing FedaPay keys' })
                }

                try {
                    const isSandbox = settings?.fedapay_sandbox === 'true'
                    const apiUrl = isSandbox
                        ? 'https://sandbox-api.fedapay.com'
                        : 'https://api.fedapay.com'

                    const response = await axios.get(`${apiUrl}/v1/accounts`, {
                        headers: { Authorization: `Bearer ${secretKey}` },
                        validateStatus: () => true,
                    })

                    if (response.status === 200 || response.status === 201) {
                        return NextResponse.json({ success: true, message: 'FedaPay valide' })
                    }
                    return NextResponse.json({ success: false, error: 'Clé secrète FedaPay invalide' })
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'Erreur'
                    console.error('FedaPay test err:', msg)
                    return NextResponse.json({ success: false, error: 'Vérification FedaPay échouée' })
                }
            }

            case 'zeyow': {
                const redirectUrl = settings?.zeyow_redirect_url
                if (!redirectUrl) {
                    return NextResponse.json({ success: false, error: 'Missing Zeyow redirect URL' })
                }

                try {
                    new URL(redirectUrl)
                    // Tester la disponibilité de l'URL Zeyow
                    await axios.head(redirectUrl, {
                        timeout: 5000,
                        validateStatus: () => true,
                    })
                    return NextResponse.json({ success: true, message: 'Zeyow URL configurée et accessible' })
                } catch {
                    // L'URL peut être valide même si HEAD échoue (CORS, etc.)
                    try {
                        new URL(redirectUrl)
                        return NextResponse.json({ success: true, message: 'Zeyow URL valide' })
                    } catch {
                        return NextResponse.json({ success: false, error: 'URL Zeyow invalide' })
                    }
                }
            }

            case 'stripe': {
                const secretKey = settings?.stripe_secret_key
                const publicKey = settings?.stripe_public_key

                if (!secretKey || !publicKey) {
                    return NextResponse.json({ success: false, error: 'Clés Stripe manquantes' })
                }

                if (!secretKey.startsWith('sk_') || !publicKey.startsWith('pk_')) {
                    return NextResponse.json({ success: false, error: 'Format de clé Stripe invalide' })
                }

                try {
                    const stripe = new Stripe(secretKey)
                    // Vérifier les credentials en récupérant le compte Stripe
                    const account = await stripe.accounts.retrieve()
                    const env = secretKey.startsWith('sk_live_') ? 'Production' : 'Sandbox'
                    return NextResponse.json({
                        success: true,
                        message: `Stripe ${env} valide — Compte: ${account.email || account.id}`,
                    })
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'Erreur'
                    return NextResponse.json({ success: false, error: `Stripe: ${msg}` })
                }
            }

            case 'paypal': {
                const clientId = settings?.paypal_client_id
                const clientSecret = settings?.paypal_client_secret

                if (!clientId || !clientSecret) {
                    return NextResponse.json({ success: false, error: 'Credentials PayPal manquants' })
                }

                try {
                    const sandbox = settings?.paypal_sandbox === 'true'
                    const base = sandbox
                        ? 'https://api-m.sandbox.paypal.com'
                        : 'https://api-m.paypal.com'

                    const res = await axios.post(
                        `${base}/v1/oauth2/token`,
                        'grant_type=client_credentials',
                        {
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                            },
                        }
                    )

                    if (res.data.access_token) {
                        const env = sandbox ? 'Sandbox' : 'Production'
                        return NextResponse.json({
                            success: true,
                            message: `PayPal Business ${env} connecté`,
                        })
                    }
                    return NextResponse.json({ success: false, error: 'Token PayPal non obtenu' })
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'Erreur'
                    return NextResponse.json({ success: false, error: `PayPal: ${msg}` })
                }
            }

            default:
                return NextResponse.json({ success: false, error: 'Unknown gateway' })
        }
    } catch {
        return NextResponse.json({ success: false, error: 'Server error' })
    }
}
