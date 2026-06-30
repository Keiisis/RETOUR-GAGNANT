'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, CreditCard, Loader2, CheckCircle2, AlertCircle,
    Receipt, Shield, Lock, Smartphone, Globe, ChevronRight
} from 'lucide-react'
import CurrencySelector from '@/components/boutique/CurrencySelector'
import { type CurrencyCode, getCurrencyForLang, formatPriceWithMargin, formatPrice } from '@/lib/currency'
import { useTranslation } from '@/lib/translation'

interface Doc {
    id: string
    numero: string
    client_nom: string
    client_prenom: string
    client_email: string
    total: number
    currency: string
    status: string
    type: string
}

interface Settings {
    kkiapay_enabled: string
    kkiapay_public_key: string
    kkiapay_sandbox: string
    fedapay_enabled: string
    fedapay_public_key: string
    fedapay_sandbox: string
    stripe_enabled: string
    stripe_public_key: string
    paypal_enabled: string
    paypal_client_id: string
    paypal_currency: string
    paypal_sandbox: string
}

// Les SDKs de paiement sont accédés via (window as any) pour éviter les
// conflits avec les déclarations globales existantes dans PaymentModal.tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = () => window as any

const fmtN = (n: number, currency: string) =>
    `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ${currency}`

export default function ClientPayerPage() {
    const { id } = useParams<{ id: string }>()
    const [doc, setDoc] = useState<Doc | null>(null)
    const [settings, setSettings] = useState<Settings | null>(null)
    const [loading, setLoading] = useState(true)
    const [step, setStep] = useState<'select' | 'processing' | 'success' | 'error'>('select')
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [userId, setUserId] = useState('')
    const [userEmail, setUserEmail] = useState('')
    const paypalRendered = useRef(false)
    const scriptsLoaded = useRef<Set<string>>(new Set())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kkiapayHandlerRef = useRef<((data: any) => void) | null>(null)
    const { lang } = useTranslation()
    const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(() => getCurrencyForLang(lang))
    useEffect(() => { setSelectedCurrency(getCurrencyForLang(lang)) }, [lang])

    const loadScript = useCallback((src: string): Promise<void> => {
        if (scriptsLoaded.current.has(src)) return Promise.resolve()
        return new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = src
            script.async = true
            script.onload = () => { scriptsLoaded.current.add(src); resolve() }
            script.onerror = reject
            document.head.appendChild(script)
        })
    }, [])

    const confirmPayment = useCallback(async (provider: string, transactionId?: string) => {
        setStep('processing')
        try {
            const res = await fetch('/api/client/payment/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doc_id: id, provider, transaction_id: transactionId, user_id: userId, email: userEmail }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Erreur de confirmation')
            setStep('success')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de la confirmation')
            setStep('error')
        }
    }, [id, userId, userEmail])

    // Initial load + handle redirects from Stripe/PayPal
    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) { window.location.href = '/client/login'; return }

            const uid = session.user.id
            const uemail = session.user.email || ''
            setUserId(uid)
            setUserEmail(uemail)

            const { data: docData } = await supabase
                .from('documents_financiers')
                .select('id, numero, client_nom, client_prenom, client_email, total, currency, status, type')
                .eq('id', id)
                .or(`client_id.eq.${uid},client_email.eq.${uemail}`)
                .single()

            if (!docData) { window.location.href = '/client/documents'; return }
            if (docData.type !== 'facture') { window.location.href = `/client/documents/${id}`; return }

            setDoc(docData as Doc)

            if (docData.status === 'paye') {
                setStep('success')
                setLoading(false)
                return
            }

            const res = await fetch('/api/settings/payment')
            if (res.ok) {
                const data = await res.json()
                setSettings(data)
            }

            setLoading(false)

            // Handle Stripe redirect return
            const params = new URLSearchParams(window.location.search)
            if (params.get('stripe_success') === '1') {
                const sessionId = params.get('session_id')
                if (sessionId) {
                    // Verify Stripe session server-side
                    const verRes = await fetch(`/api/client/payment/stripe?session_id=${sessionId}&doc_id=${id}&user_id=${uid}&email=${encodeURIComponent(uemail)}`)
                    const verData = await verRes.json()
                    if (verData.success) setStep('success')
                    else { setError(verData.error || 'Paiement non confirmé'); setStep('error') }
                }
                window.history.replaceState({}, '', window.location.pathname)
                return
            }

            // Handle PayPal redirect return
            if (params.get('paypal_success') === '1') {
                const paypalOrderId = params.get('token') || params.get('paypal_order_id')
                if (paypalOrderId) {
                    const capRes = await fetch('/api/client/payment/paypal/capture', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paypal_order_id: paypalOrderId, doc_id: id, user_id: uid, email: uemail }),
                    })
                    const capData = await capRes.json()
                    if (capData.success) setStep('success')
                    else { setError(capData.error || 'Capture PayPal échouée'); setStep('error') }
                }
                window.history.replaceState({}, '', window.location.pathname)
                return
            }

            if (params.get('stripe_cancelled') === '1' || params.get('paypal_cancelled') === '1') {
                setError('Paiement annulé.')
                window.history.replaceState({}, '', window.location.pathname)
            }
        }
        load()
    }, [id, loadScript])

    // Load SDKs after settings are loaded
    useEffect(() => {
        if (!settings) return
        if (settings.kkiapay_enabled === 'true' && settings.kkiapay_public_key) {
            loadScript('https://cdn.kkiapay.me/k.js').catch(console.error)
        }
        if (settings.fedapay_enabled === 'true' && settings.fedapay_public_key) {
            loadScript('https://cdn.fedapay.com/checkout.js?v=1.1.7').catch(console.error)
        }
        if (settings.stripe_enabled === 'true' && settings.stripe_public_key) {
            loadScript('https://js.stripe.com/v3/').catch(console.error)
        }
    }, [settings, loadScript])

    // Render PayPal buttons when selected
    useEffect(() => {
        if (selectedProvider !== 'paypal' || !settings?.paypal_client_id || !doc || paypalRendered.current) return

        const currency = (settings.paypal_currency || 'EUR').toUpperCase()
        const sdkUrl = `https://www.paypal.com/sdk/js?client-id=${settings.paypal_client_id}&currency=${currency}&locale=fr_FR&intent=capture`

        loadScript(sdkUrl).then(() => {
            if (paypalRendered.current) return
            paypalRendered.current = true
            win().paypal?.Buttons({
                style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay' },
                createOrder: async () => {
                    const res = await fetch('/api/client/payment/paypal/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ doc_id: id, user_id: userId, email: userEmail }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    return data.paypal_order_id
                },
                onApprove: async (data: { orderID: string }) => {
                    await confirmPayment('paypal', data.orderID)
                },
                onError: (err: unknown) => {
                    setError(err instanceof Error ? err.message : 'Erreur PayPal')
                    setStep('error')
                },
            }).render('#paypal-buttons')
        }).catch(console.error)
    }, [selectedProvider, settings, doc, id, userId, userEmail, loadScript, confirmPayment])

    const payWithKkiapay = () => {
        if (!settings?.kkiapay_public_key || !doc) return
        const w = win()

        // Remove previous listener if any
        if (kkiapayHandlerRef.current) {
            w.removeKkiapayListener?.('success', kkiapayHandlerRef.current)
        }

        const handler = (response: { transactionId: string }) => {
            confirmPayment('kkiapay', response.transactionId)
        }
        kkiapayHandlerRef.current = handler
        w.addKkiapayListener?.('success', handler)

        w.openKkiapayWidget?.({
            amount: Math.round(doc.total),
            position: 'center',
            callback: '',
            data: id,
            theme: '#3b82f6',
            key: settings.kkiapay_public_key,
            sandbox: settings.kkiapay_sandbox === 'true',
        })
    }

    const payWithFedaPay = () => {
        if (!settings?.fedapay_public_key || !doc) return
        const FP = win().FedaPay
        if (!FP) return
        // FedaPay et KKiapay traitent uniquement en XOF — le sélecteur de devise est informatif
        FP.init({
            public_key: settings.fedapay_public_key,
            transaction: {
                amount: Math.round(doc.total),
                description: `Facture ${doc.numero}`,
                currency: { iso: 'XOF' },
            },
            customer: {
                email: doc.client_email || userEmail,
                firstname: doc.client_prenom || '',
                lastname: doc.client_nom || '',
            },
            onComplete(object: { reason: string; transaction?: { id: number } }) {
                if (object.reason === FP.DIALOG_DISMISSED) return
                if (object.reason === FP.TRANSACTION_APPROVED) {
                    confirmPayment('fedapay', object.transaction?.id?.toString())
                } else {
                    setError('Paiement annulé ou échoué.')
                    setStep('error')
                }
            },
        }).open()
    }

    const payWithStripe = async () => {
        if (!doc) return
        setStep('processing')
        try {
            const res = await fetch('/api/client/payment/stripe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doc_id: id, user_id: userId, email: userEmail }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            // Redirect to Stripe Checkout
            window.location.href = data.url
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur Stripe')
            setStep('error')
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-7 h-7 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
    )

    if (!doc) return null

    const providers = [
        {
            id: 'kkiapay',
            label: 'Kkiapay',
            sublabel: 'Mobile Money, CB locale',
            icon: Smartphone,
            color: 'text-orange-400',
            bg: 'bg-orange-500/10 border-orange-500/20',
            hoverBg: 'hover:bg-orange-500/15',
            enabled: settings?.kkiapay_enabled === 'true' && !!settings?.kkiapay_public_key,
            action: payWithKkiapay,
            inline: false,
        },
        {
            id: 'fedapay',
            label: 'FedaPay',
            sublabel: 'Mobile Money, Virement',
            icon: Smartphone,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10 border-blue-500/20',
            hoverBg: 'hover:bg-blue-500/15',
            enabled: settings?.fedapay_enabled === 'true' && !!settings?.fedapay_public_key,
            action: payWithFedaPay,
            inline: false,
        },
        {
            id: 'stripe',
            label: 'Stripe',
            sublabel: 'Carte bancaire internationale',
            icon: CreditCard,
            color: 'text-violet-400',
            bg: 'bg-violet-500/10 border-violet-500/20',
            hoverBg: 'hover:bg-violet-500/15',
            enabled: settings?.stripe_enabled === 'true' && !!settings?.stripe_public_key,
            action: payWithStripe,
            inline: false,
        },
        {
            id: 'paypal',
            label: 'PayPal',
            sublabel: 'Compte PayPal, CB',
            icon: Globe,
            color: 'text-sky-400',
            bg: 'bg-sky-500/10 border-sky-500/20',
            hoverBg: 'hover:bg-sky-500/15',
            enabled: settings?.paypal_enabled === 'true' && !!settings?.paypal_client_id,
            action: () => { setSelectedProvider('paypal'); paypalRendered.current = false },
            inline: true,
        },
    ].filter(p => p.enabled)

    return (
        <div className="max-w-xl mx-auto space-y-5">
            {/* Back */}
            <Link href={`/client/documents/${id}`} className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm transition-colors">
                <ArrowLeft size={15} /> Retour au document
            </Link>

            {/* Invoice header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-[#0a1221] border border-white/[0.06] rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400">
                        <Receipt size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Facture</p>
                        <h1 className="text-xl font-black text-white">{doc.numero}</h1>
                    </div>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Montant à payer</span>
                        <CurrencySelector
                            value={selectedCurrency}
                            onChange={setSelectedCurrency}
                            baseAmountXOF={doc.total}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-2xl font-black text-white font-mono">
                            {selectedCurrency === 'XOF'
                                ? fmtN(doc.total, 'XOF')
                                : formatPriceWithMargin(doc.total, selectedCurrency)
                            }
                        </span>
                        {selectedCurrency !== 'XOF' && (
                            <span className="text-[10px] text-gray-500 bg-white/5 border border-white/10 px-2 py-1 rounded-full">
                                encaissé en {formatPrice(doc.total, 'XOF').replace(/\s/g, '\u00A0')} XOF
                            </span>
                        )}
                    </div>
                </div>
            </motion.div>

            <AnimatePresence mode="wait">
                {step === 'success' ? (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#0a1221] border border-emerald-500/20 rounded-2xl p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 size={32} className="text-emerald-400" />
                        </div>
                        <h2 className="text-xl font-black text-white mb-2">Paiement confirmé !</h2>
                        <p className="text-gray-400 text-sm mb-5">Votre paiement a été enregistré avec succès.</p>
                        <Link href="/client/documents"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold text-sm transition-all">
                            Mes documents <ChevronRight size={14} />
                        </Link>
                    </motion.div>

                ) : step === 'error' ? (
                    <motion.div key="error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#0a1221] border border-red-500/20 rounded-2xl p-8 text-center">
                        <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
                        <h2 className="text-xl font-black text-white mb-2">Paiement échoué</h2>
                        <p className="text-red-400/80 text-sm mb-5">{error}</p>
                        <button onClick={() => { setStep('select'); setError('') }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-white font-bold text-sm transition-all">
                            Réessayer
                        </button>
                    </motion.div>

                ) : step === 'processing' ? (
                    <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="bg-[#0a1221] border border-white/[0.06] rounded-2xl p-12 text-center">
                        <Loader2 className="animate-spin text-blue-400 mx-auto mb-3" size={32} />
                        <p className="text-white font-bold">Traitement en cours...</p>
                        <p className="text-gray-500 text-sm mt-1">Ne fermez pas cette page.</p>
                    </motion.div>

                ) : (
                    <motion.div key="select" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-[#0a1221] border border-white/[0.06] rounded-2xl overflow-hidden">
                        <div className="p-5 border-b border-white/[0.06]">
                            <div className="flex items-center gap-2">
                                <Shield size={15} className="text-blue-400" />
                                <h2 className="font-black text-white text-sm">Choisissez votre moyen de paiement</h2>
                            </div>
                        </div>

                        {providers.length === 0 ? (
                            <div className="p-8 text-center">
                                <Lock size={28} className="text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-400 font-bold text-sm">Aucun moyen de paiement configuré</p>
                                <p className="text-gray-600 text-xs mt-1">Contactez votre agent pour procéder au paiement.</p>
                            </div>
                        ) : (
                            <div className="p-4 space-y-3">
                                {providers.map(provider => {
                                    const Icon = provider.icon
                                    const isSelected = selectedProvider === provider.id
                                    return (
                                        <div key={provider.id}>
                                            <button
                                                disabled={provider.inline && isSelected}
                                                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                                                    isSelected
                                                        ? `${provider.bg} border-opacity-50`
                                                        : `bg-white/[0.02] border-white/[0.06] ${provider.hoverBg} hover:border-white/10`
                                                }`}
                                                onClick={provider.action}
                                            >
                                                <div className={`p-2.5 rounded-xl ${isSelected ? provider.bg : 'bg-white/5'}`}>
                                                    <Icon size={18} className={isSelected ? provider.color : 'text-gray-400'} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-gray-300'}`}>{provider.label}</p>
                                                    <p className="text-[11px] text-gray-500">{provider.sublabel}</p>
                                                </div>
                                                {!provider.inline && (
                                                    <div className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg ${provider.bg} ${provider.color}`}>
                                                        Payer <ChevronRight size={12} />
                                                    </div>
                                                )}
                                                {provider.inline && !isSelected && (
                                                    <ChevronRight size={15} className="text-gray-600" />
                                                )}
                                            </button>
                                            {/* PayPal inline buttons */}
                                            {provider.id === 'paypal' && isSelected && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                                    className="mt-2 px-2">
                                                    <div id="paypal-buttons" className="min-h-[50px]" />
                                                </motion.div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        <div className="px-5 pb-5 flex items-start gap-2">
                            <Lock size={11} className="text-gray-600 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-gray-600">
                                Vos nom, e-mail et téléphone servent uniquement à traiter ce paiement, établir le reçu et suivre votre dossier. Vos données bancaires sont gérées par le prestataire de paiement sécurisé et ne sont jamais stockées sur nos serveurs.{' '}
                                <a href="/confidentialite" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">Politique de confidentialité</a>.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
