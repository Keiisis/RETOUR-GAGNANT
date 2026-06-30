"use client"

// Force dynamic rendering — useSearchParams() requires it even with Suspense (Next.js 15)
export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function MobilePaymentContent() {
    const searchParams = useSearchParams()
    const amount = searchParams.get('amount')
    const serviceName = searchParams.get('service')
    const clientId = searchParams.get('clientId')
    const callbackUrl = searchParams.get('callbackUrl')
    const isSandbox = process.env.NEXT_PUBLIC_KKIAPAY_SANDBOX === 'true'
    const publicKey = isSandbox ? process.env.NEXT_PUBLIC_KKIAPAY_SANDBOX_PUBLIC_KEY : process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY

    // Dérive l'état initial directement — évite setState synchrone dans l'effet
    const isInvalid = !amount || !publicKey
    const [status, setStatus] = useState(
        isInvalid ? 'Paramètres de paiement invalides.' : 'Chargement du module de paiement...'
    )

    useEffect(() => {
        if (isInvalid) return

        const script = document.createElement('script')
        script.src = 'https://cdn.kkiapay.me/k.js'
        script.onload = () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const w = window as any
            if (w.openKkiapayWidget) {
                w.openKkiapayWidget({
                    amount: parseInt(amount, 10),
                    position: "center",
                    theme: "#0E9F6E",
                    sandbox: isSandbox,
                    key: publicKey,
                    name: "Retour Gagnant",
                    reason: `Service : ${serviceName}`,
                })

                w.addKkiapayListener('success', function (response: { transactionId: string }) {
                    setStatus("Paiement réussi ! Redirection vers l'application...")
                    if (callbackUrl) {
                        window.location.href = `${callbackUrl}?status=success&transactionId=${response.transactionId}`
                    } else {
                        window.location.href = `retourgagnant://payment-success?transactionId=${response.transactionId}`
                    }
                })

                w.addKkiapayListener('failed', function () {
                    setStatus("Le paiement a échoué.")
                    if (callbackUrl) {
                        window.location.href = `${callbackUrl}?status=failed`
                    } else {
                        window.location.href = `retourgagnant://payment-failed`
                    }
                })

                w.addKkiapayListener('close', function () {
                    if (callbackUrl) {
                        window.location.href = `${callbackUrl}?status=canceled`
                    } else {
                        window.location.href = `retourgagnant://payment-canceled`
                    }
                })
            }
        }
        document.body.appendChild(script)

        return () => { document.body.removeChild(script) }
    }, [amount, serviceName, clientId, callbackUrl, publicKey, isSandbox, isInvalid])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
            <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} />
            <p style={{ color: 'white', fontFamily: 'sans-serif' }}>{status}</p>
        </div>
    )
}

export default function MobilePaymentPage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
                <Loader2 className="animate-spin text-emerald-500" size={48} />
            </div>
        }>
            <MobilePaymentContent />
        </Suspense>
    )
}
