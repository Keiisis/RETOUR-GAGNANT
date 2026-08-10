'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle as CheckCircle2, WarningCircle as AlertCircle, CircleNotch as Loader2, ShoppingBag } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button'
import Link from 'next/link'

function ZeyowReturnContent() {
    const searchParams = useSearchParams()
    const router = useRouter()

    const orderId = searchParams.get('order_id')
    const status = searchParams.get('status')
    const transactionId = searchParams.get('transaction_id') || searchParams.get('txn_id')

    const [state, setState] = useState<'verifying' | 'success' | 'error'>('verifying')
    const [errorMsg, setErrorMsg] = useState('')
    const [ref, setRef] = useState('')

    useEffect(() => {
        if (!orderId) {
            setState('error')
            setErrorMsg('Référence de commande introuvable.')
            return
        }

        // Si Zeyow indique un échec explicite dans l'URL, ne pas interroger le serveur
        const isExplicitFailure =
            status === 'cancelled' ||
            status === 'cancel' ||
            status === 'failed' ||
            status === 'failure' ||
            status === '0'

        if (isExplicitFailure) {
            setState('error')
            setErrorMsg('Le paiement a été annulé ou refusé.')
            return
        }

        // Vérifier le statut de la commande côté serveur.
        // La route /api/checkout/zeyow/confirm NE COMPLÈTE JAMAIS la commande elle-même —
        // elle lit uniquement le statut défini par le webhook Zeyow (seul flux de confiance).
        // Si le webhook n'est pas encore arrivé (pending), on réessaie jusqu'à 15 fois (30s max).
        let attempts = 0
        const MAX_ATTEMPTS = 15
        const RETRY_DELAY = 2000 // 2s entre chaque tentative

        const checkStatus = () => {
            fetch('/api/checkout/zeyow/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId }),
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success === true) {
                        // Webhook Zeyow a confirmé le paiement
                        setRef(orderId.slice(0, 8).toUpperCase())
                        setState('success')
                    } else if (data.pending === true) {
                        // Webhook pas encore arrivé — réessayer
                        attempts++
                        if (attempts < MAX_ATTEMPTS) {
                            setTimeout(checkStatus, RETRY_DELAY)
                        } else {
                            // Timeout : 30s sans confirmation
                            setState('error')
                            setErrorMsg(
                                'La confirmation du paiement prend du temps. Vérifiez vos commandes dans votre compte ou contactez le support.'
                            )
                        }
                    } else {
                        setState('error')
                        setErrorMsg(data.error || 'Vérification échouée.')
                    }
                })
                .catch(() => {
                    setState('error')
                    setErrorMsg('Erreur de connexion. Contactez le support.')
                })
        }

        checkStatus()
    }, [orderId, status])

    if (state === 'verifying') {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-6">
                <Loader2 size={56} className="animate-spin text-[#FCD116]" />
                <div className="text-center">
                    <p className="text-white font-bold text-lg">Vérification du paiement...</p>
                    <p className="text-gray-500 text-sm mt-1">Ne fermez pas cette page</p>
                </div>
            </div>
        )
    }

    if (state === 'success') {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-24 space-y-8"
            >
                <div className="w-28 h-28 rounded-full bg-[#008751]/20 border-2 border-[#008751] flex items-center justify-center">
                    <CheckCircle2 size={56} className="text-[#008751]" />
                </div>
                <div className="text-center space-y-3">
                    <h1 className="text-4xl font-black text-white font-display">Paiement confirmé !</h1>
                    <p className="text-gray-400 text-base max-w-md">
                        Votre commande a été validée avec succès. Vous recevrez les détails par téléphone ou email.
                    </p>
                    {ref && (
                        <p className="text-xs text-gray-600 font-mono mt-2">
                            Référence : <span className="text-[#FCD116]">{ref}</span>
                        </p>
                    )}
                </div>
                <div className="flex gap-4">
                    <Link href="/boutique">
                        <Button className="h-14 px-8 rounded-2xl bg-[#FCD116] text-[#0f141e] font-black hover:bg-[#008751] hover:text-white transition-all">
                            <ShoppingBag size={18} className="mr-2" />
                            Continuer les achats
                        </Button>
                    </Link>
                    <Link href="/mon-compte">
                        <Button variant="outline" className="h-14 px-8 rounded-2xl border-white/10 text-white font-bold">
                            Mes commandes
                        </Button>
                    </Link>
                </div>
            </motion.div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 space-y-8"
        >
            <div className="w-28 h-28 rounded-full bg-[#E8112D]/20 border-2 border-[#E8112D] flex items-center justify-center">
                <AlertCircle size={56} className="text-[#E8112D]" />
            </div>
            <div className="text-center space-y-3">
                <h1 className="text-4xl font-black text-white font-display">Paiement échoué</h1>
                <p className="text-gray-400 text-base max-w-md">
                    {errorMsg || 'Une erreur est survenue lors du traitement de votre paiement.'}
                </p>
            </div>
            <div className="flex gap-4">
                <Link href="/boutique">
                    <Button className="h-14 px-8 rounded-2xl bg-white/10 text-white font-bold hover:bg-white/20 transition-all">
                        Retour à la boutique
                    </Button>
                </Link>
                <Link href="/contact">
                    <Button variant="outline" className="h-14 px-8 rounded-2xl border-white/10 text-white font-bold">
                        Contacter le support
                    </Button>
                </Link>
            </div>
        </motion.div>
    )
}

export default function ZeyowReturnPage() {
    return (
        <div className="min-h-screen bg-[#0f141e] flex flex-col">
            <div className="flex-1 container mx-auto px-4 max-w-2xl">
                <Suspense
                    fallback={
                        <div className="flex justify-center py-24">
                            <Loader2 size={48} className="animate-spin text-[#FCD116]" />
                        </div>
                    }
                >
                    <ZeyowReturnContent />
                </Suspense>
            </div>
        </div>
    )
}
