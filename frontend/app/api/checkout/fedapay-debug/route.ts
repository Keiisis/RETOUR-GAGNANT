/**
 * Endpoint de diagnostic FedaPay — USAGE INTERNE UNIQUEMENT
 * GET /api/checkout/fedapay-debug?transaction_id=XXX
 * Retourne la réponse brute de l'API FedaPay pour diagnostiquer les problèmes de vérification.
 */
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const transaction_id = searchParams.get('transaction_id')

        // Lire les settings FedaPay
        const { data: settingsData, error: settingsError } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['fedapay_secret_key', 'fedapay_sandbox', 'fedapay_public_key', 'fedapay_enabled'])

        const sm: Record<string, string> = {}
        for (const s of settingsData || []) sm[s.key] = s.value

        const isSandbox = sm.fedapay_sandbox === 'true'
        const secretKey = sm.fedapay_secret_key
        const apiBase = isSandbox
            ? 'https://sandbox-api.fedapay.com'
            : 'https://api.fedapay.com'

        const diagnosis: Record<string, unknown> = {
            settings_fetched: !settingsError,
            fedapay_enabled: sm.fedapay_enabled,
            fedapay_sandbox: isSandbox,
            fedapay_public_key_present: !!sm.fedapay_public_key,
            fedapay_public_key_prefix: sm.fedapay_public_key?.slice(0, 12) || 'ABSENT',
            fedapay_secret_key_present: !!secretKey,
            fedapay_secret_key_prefix: secretKey?.slice(0, 12) || 'ABSENT',
            api_base: apiBase,
        }

        // Test de connectivité de base (endpoint /v1/currencies)
        if (secretKey) {
            try {
                const pingRes = await fetch(`${apiBase}/v1/currencies`, {
                    headers: {
                        Authorization: `Bearer ${secretKey}`,
                        'Content-Type': 'application/json',
                    },
                })
                diagnosis.api_connectivity_status = pingRes.status
                diagnosis.api_connectivity_ok = pingRes.ok
                if (!pingRes.ok) {
                    const errorBody = await pingRes.text()
                    diagnosis.api_connectivity_error = errorBody.slice(0, 300)
                }
            } catch (e) {
                diagnosis.api_connectivity_exception = String(e)
            }

            // Si un transaction_id est fourni, tester la vérification
            if (transaction_id) {
                try {
                    const txRes = await fetch(`${apiBase}/v1/transactions/${transaction_id}`, {
                        headers: {
                            Authorization: `Bearer ${secretKey}`,
                            'Content-Type': 'application/json',
                        },
                    })
                    diagnosis.transaction_http_status = txRes.status
                    diagnosis.transaction_http_ok = txRes.ok
                    const txData = await txRes.json()
                    diagnosis.transaction_raw_response = txData
                    diagnosis.transaction_status_v1 = txData?.v1?.transaction?.status
                    diagnosis.transaction_status_direct = txData?.transaction?.status
                    diagnosis.transaction_status_root = txData?.status
                    diagnosis.resolved_status =
                        txData?.v1?.transaction?.status ||
                        txData?.transaction?.status ||
                        txData?.status ||
                        'NOT_FOUND'
                    const resolvedStatus = diagnosis.resolved_status as string
                    diagnosis.would_verify = ['approved', 'transferred'].includes(resolvedStatus)
                } catch (e) {
                    diagnosis.transaction_exception = String(e)
                }
            }
        } else {
            diagnosis.error = 'fedapay_secret_key manquante dans Supabase settings'
        }

        return NextResponse.json(diagnosis, { status: 200 })
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 })
    }
}
