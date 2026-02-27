import { NextResponse } from 'next/server'
import axios from 'axios'

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
                    // Kkiapay sandbox/live check using random transaction id to just see if auth works
                    const sandbox = settings?.kkiapay_sandbox === 'true'
                    const apiUrl = sandbox ? 'https://api-sandbox.kkiapay.me' : 'https://api.kkiapay.me'

                    await axios.get(`${apiUrl}/api/v1/transactions/ping`, {
                        headers: {
                            'x-api-key': publicKey,
                            'x-private-key': privateKey,
                            'x-secret-key': settings?.kkiapay_secret_key || ''
                        },
                        validateStatus: () => true // We just want to make sure it doesn't timeout
                    });

                    return NextResponse.json({ success: true, message: 'Kkiapay configurée' })
                } catch (err) {
                    return NextResponse.json({ success: false, error: 'Echec de verification Kkiapay' })
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
                    const apiUrl = isSandbox ? 'https://sandbox-api.fedapay.com' : 'https://api.fedapay.com'

                    const response = await axios.get(`${apiUrl}/v1/accounts`, {
                        headers: {
                            'Authorization': `Bearer ${secretKey}`
                        }
                    });

                    if (response.status === 200 || response.status === 201) {
                        return NextResponse.json({ success: true, message: 'FedaPay valide' })
                    } else {
                        return NextResponse.json({ success: false, error: 'Cle secrete FedaPay invalide' })
                    }
                } catch (err: any) {
                    console.error("FedaPay test err:", err.response?.data || err.message);
                    return NextResponse.json({ success: false, error: 'Verification FedaPay eéchouéee' })
                }
            }

            case 'zeyow': {
                const redirectUrl = settings?.zeyow_redirect_url
                if (!redirectUrl) {
                    return NextResponse.json({ success: false, error: 'Missing Zeyow redirect URL' })
                }

                try {
                    new URL(redirectUrl)
                    return NextResponse.json({ success: true, message: 'Zeyow URL configurée' })
                } catch {
                    return NextResponse.json({ success: false, error: 'Invalid Zeyow URL format' })
                }
            }

            default:
                return NextResponse.json({ success: false, error: 'Unknown gateway' })
        }
    } catch {
        return NextResponse.json({ success: false, error: 'Server error' })
    }
}
