'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getProposalBySecret } from '@/app/actions/ai-proposals'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CreditCard, Phone, User, Envelope as Mail, CheckCircle as CheckCircle2, WarningCircle as AlertCircle, CircleNotch as Loader2, Shield, Lock } from '@phosphor-icons/react';
import Link from 'next/link'
import { Price } from '@/components/ui/Price'
import { CurrencyCode, getCurrencyForLang, formatPriceWithMargin, convertCurrency, refreshRates } from '@/lib/currency'
import { fromHt } from '@/lib/tax'
import { useTranslation } from '@/lib/translation'
import CurrencySelector from '@/components/boutique/CurrencySelector'

// Types SDK tiers — les déclarations globales Window sont dans PaymentModal.tsx
// On réutilise les mêmes interfaces locales pour Stripe

interface StripeInstance {
    elements: (options?: Record<string, unknown>) => StripeElements
    confirmCardPayment: (clientSecret: string, data: Record<string, unknown>) => Promise<{
        error?: { message: string }
        paymentIntent?: { id: string; status: string }
    }>
}

interface StripeElements {
    create: (type: string, options?: Record<string, unknown>) => StripeElement
}

interface StripeElement {
    mount: (selector: string) => void
    unmount: () => void
    destroy: () => void
    on: (event: string, handler: () => void) => void
}

interface ProposalItem {
    id: string
    type: string
    title: string
    selling_price: number
}

interface Proposal {
    id: string
    secret_key: string
    client_name: string
    client_email: string | null
    destination: string
    total_amount: number
    currency?: string
    notes?: string | null
}

type PaymentProvider = 'kkiapay' | 'fedapay' | 'zeyow' | 'stripe' | 'paypal'
type Step = 'info' | 'payment' | 'stripe-form' | 'paypal-form' | 'processing' | 'success' | 'error'

export default function ProposalPaymentPage({ params }: { params: Promise<{ secret: string }> }) {
    const { secret } = React.use(params)
    const [loading, setLoading] = useState(true)
    const [proposal, setProposal] = useState<Proposal | null>(null)
    const [items, setItems] = useState<ProposalItem[]>([])

    // Sélection à la carte : le client coche les prestations qu'il veut payer.
    // Par défaut tout est sélectionné ; le total payé = somme exacte de la sélection.
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    const [step, setStep] = useState<Step>('info')
    const [provider, setProvider] = useState<PaymentProvider | null>(null)
    const [customerName, setCustomerName] = useState('')
    const [customerEmail, setCustomerEmail] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [orderId, setOrderId] = useState<string | null>(null)
    const [settings, setSettings] = useState<Record<string, string>>({})

    // Stripe
    const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null)
    const [stripeReady, setStripeReady] = useState(false)
    const [stripeSubmitting, setStripeSubmitting] = useState(false)
    const stripeInstanceRef = useRef<StripeInstance | null>(null)
    const cardElementRef = useRef<StripeElement | null>(null)
    const cardMountedRef = useRef(false)

    // Devise d'affichage — FedaPay convertit, KKiapay toujours XOF
    const { lang } = useTranslation()
    const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(() => getCurrencyForLang(lang))
    useEffect(() => { setSelectedCurrency(getCurrencyForLang(lang)) }, [lang])

    // PayPal
    const paypalRenderedRef = useRef(false)
    const paypalOrderIdRef = useRef<string | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            const result = await getProposalBySecret(secret)
            if (result.success && result.proposal) {
                setProposal(result.proposal)
                setItems(result.items || [])
                setSelectedIds(new Set(
                    (result.items || [])
                        .filter((i: ProposalItem) => i.type !== 'hero' && i.type !== 'pricing' && i.selling_price > 0)
                        .map((i: ProposalItem) => i.id)
                ))
                setCustomerName(result.proposal.client_name || '')
                setCustomerEmail(result.proposal.client_email || '')
            }
            setLoading(false)
        }
        fetchData()

        // Charger les taux de change (table currencies) pour conversion EUR/USD → XOF
        refreshRates()

        // Charger les settings de paiement
        fetch('/api/settings/payment')
            .then(r => r.json())
            .then(d => setSettings(d))
            .catch(() => setSettings({}))
    }, [secret])

    // ─── Stripe Elements ──────────────────────────
    useEffect(() => {
        if (step !== 'stripe-form') {
            if (cardElementRef.current && cardMountedRef.current) {
                try { cardElementRef.current.unmount() } catch { /* ignore */ }
                cardMountedRef.current = false
            }
            return
        }
        if (cardMountedRef.current) return
        const publicKey = settings.stripe_public_key
        if (!publicKey) return

        const initStripe = () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const win = window as any
            if (!win.Stripe) return

            if (!stripeInstanceRef.current) {
                stripeInstanceRef.current = win.Stripe(publicKey)
            }

            const elements = stripeInstanceRef.current!.elements({
                appearance: {
                    theme: 'stripe',
                    variables: {
                        colorPrimary: '#D97706',
                        colorBackground: '#ffffff',
                        colorText: '#0f172a',
                        borderRadius: '12px',
                    },
                },
            })

            const card = elements.create('card', {
                style: { base: { color: '#0f172a', fontSize: '15px', '::placeholder': { color: '#94a3b8' } } },
                hidePostalCode: true,
            })

            setTimeout(() => {
                const el = document.getElementById('stripe-card-element')
                if (el) {
                    card.mount('#stripe-card-element')
                    cardElementRef.current = card
                    cardMountedRef.current = true
                    setStripeReady(true)
                }
            }, 100)
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any
        if (win.Stripe) {
            initStripe()
        } else {
            // Charger Stripe.js dynamiquement
            const existing = document.querySelector('script[src*="js.stripe.com"]')
            if (existing) {
                const check = setInterval(() => { if (win.Stripe) { clearInterval(check); initStripe() } }, 200)
                setTimeout(() => clearInterval(check), 10000)
            } else {
                const s = document.createElement('script')
                s.src = 'https://js.stripe.com/v3/'
                s.onload = () => {
                    const check = setInterval(() => { if (win.Stripe) { clearInterval(check); initStripe() } }, 200)
                    setTimeout(() => clearInterval(check), 10000)
                }
                document.head.appendChild(s)
            }
        }
    }, [step, settings.stripe_public_key])

    // ─── PayPal ──────────────────────────
    useEffect(() => {
        if (step !== 'paypal-form') { paypalRenderedRef.current = false; return }
        if (paypalRenderedRef.current) return
        const clientId = settings.paypal_client_id
        if (!clientId) return

        const currency = (settings.paypal_currency || 'XOF').toUpperCase()

        const initPayPal = () => {
            if (!window.paypal || paypalRenderedRef.current) return
            paypalRenderedRef.current = true

            window.paypal.Buttons({
                style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 48 },
                createOrder: async (): Promise<string> => {
                    const oid = await createOrder('paypal')
                    if (!oid) throw new Error('Erreur')
                    paypalOrderIdRef.current = oid
                    const res = await fetch('/api/checkout/paypal/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ order_id: oid }),
                    })
                    const data = await res.json()
                    if (!data.paypal_order_id) throw new Error(data.error || 'PayPal error')
                    return data.paypal_order_id
                },
                onApprove: async (data: { orderID: string }) => {
                    setStep('processing')
                    const oid = paypalOrderIdRef.current
                    if (!oid) { setErrorMessage('Référence perdue'); setStep('error'); return }
                    const res = await fetch('/api/checkout/paypal/capture', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paypal_order_id: data.orderID, order_id: oid }),
                    })
                    const result = await res.json()
                    if (result.success) {
                        setOrderId(oid)
                        await markProposalAsPaid()
                        setStep('success')
                    } else {
                        cancelOrder(oid)
                        setErrorMessage(result.error || 'Capture PayPal échouée')
                        setStep('error')
                    }
                },
                onError: () => {
                    if (paypalOrderIdRef.current) cancelOrder(paypalOrderIdRef.current)
                    setErrorMessage('Erreur PayPal')
                    setStep('error')
                },
                onCancel: () => { setStep('payment') },
            }).render('#paypal-button-container').catch(() => {
                setErrorMessage('Impossible d\'initialiser PayPal')
                setStep('error')
            })
        }

        if (window.paypal) {
            setTimeout(initPayPal, 50)
        } else {
            const script = document.createElement('script')
            script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}&locale=fr_FR&intent=capture`
            script.onload = initPayPal
            document.head.appendChild(script)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, settings.paypal_client_id])

    // Lien de paiement générique (Admin/Agent) vs proposition voyage :
    // adapte les libellés sans toucher au flux de paiement
    const isPaymentLink = String(proposal?.notes || '').startsWith('LIEN-PAIEMENT')
    const payLabel = proposal ? (isPaymentLink ? proposal.destination : `Voyage ${proposal.destination}`) : ''

    // ─── Total exact de la sélection (recalculé aussi côté serveur) ──
    const billableAll = items.filter(i => i.type !== 'hero' && i.type !== 'pricing' && i.selling_price > 0)
    const hasItemSelection = billableAll.length > 0
    const payableTotal = hasItemSelection
        ? billableAll.filter(i => selectedIds.has(i.id)).reduce((s, i) => s + i.selling_price, 0)
        : (proposal?.total_amount || 0)

    // Devise du devis (celle saisie par l'agent). Les montants (selling_price /
    // total_amount) sont exprimés DANS cette devise.
    const proposalCurrency = ((proposal?.currency || 'XOF').toUpperCase()) as CurrencyCode

    // TVA EN SUS : payableTotal est le prix HORS TAXE. La TVA s'ajoute dessus —
    // le client paie le TTC. fromHt garantit HT + TVA = TTC.
    const { tva: payableTVA, ttc: payableTTC } = fromHt(payableTotal, proposalCurrency)

    // Conversion en XOF (FCFA) pour les passerelles qui n'encaissent QU'EN XOF
    // (Kkiapay, FedaPay, Zeyow). On convertit le TTC — c'est ce qui est chargé.
    const toXof = (m: number) => proposalCurrency === 'XOF'
        ? Math.round(m) : convertCurrency(m, proposalCurrency, 'XOF')
    const payableXof = toXof(payableTTC)   // TTC en XOF (montant réellement chargé)
    const htXof = toXof(payableTotal)      // pour le détail affiché
    const tvaXof = toXof(payableTVA)

    const toggleItem = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    // ─── Helpers ──────────────────────────
    const markProposalAsPaid = async () => {
        if (!proposal) return
        try {
            await fetch('/api/ai/proposal-paid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proposal_id: proposal.id, client_email: customerEmail, client_name: customerName }),
            })
        } catch { /* fire and forget */ }
    }

    const createOrder = useCallback(async (paymentMethod: PaymentProvider): Promise<string | null> => {
        if (!proposal) return null
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: proposal.id,
                    product_title: `${payLabel} - ${proposal.client_name}`,
                    is_proposal: true,
                    quantity: 1,
                    amount: payableTTC,
                    selected_item_ids: hasItemSelection ? Array.from(selectedIds) : undefined,
                    currency: proposal.currency || 'XOF',
                    customer_name: customerName,
                    customer_email: customerEmail,
                    customer_phone: customerPhone,
                    payment_method: paymentMethod,
                    shipping_zone: 'digital',
                    shipping_fee: 0,
                }),
            })
            const data = await res.json()
            if (data.order_id) {
                setOrderId(data.order_id)
                return data.order_id
            }
            throw new Error(data.error || 'Erreur création commande')
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : 'Erreur')
            setStep('error')
            return null
        }
    }, [proposal, customerName, customerEmail, customerPhone])

    const cancelOrder = useCallback(async (oid: string) => {
        try {
            await fetch('/api/checkout/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: oid }) })
        } catch { /* fire-and-forget */ }
    }, [])

    const verifyPayment = async (oid: string, transactionId: string) => {
        try {
            const res = await fetch('/api/checkout/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: oid, transaction_id: transactionId, payment_method: provider }),
            })
            const data = await res.json()
            if (data.success) {
                await markProposalAsPaid()
                setStep('success')
            } else {
                await cancelOrder(oid)
                setErrorMessage(data.error || 'Vérification échouée')
                setStep('error')
            }
        } catch {
            await cancelOrder(oid)
            setErrorMessage('Erreur de vérification')
            setStep('error')
        }
    }

    // ─── Helpers: load SDKs dynamically ──────────────────────
    const ensureKkiapaySDK = (): Promise<void> => new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any
        if (win.openKkiapayWidget) { resolve(); return }
        const existing = document.querySelector('script[src*="kkiapay"]')
        if (existing) {
            const check = setInterval(() => {
                if (win.openKkiapayWidget) { clearInterval(check); resolve() }
            }, 200)
            setTimeout(() => { clearInterval(check); reject(new Error('Kkiapay SDK timeout')) }, 10000)
            return
        }
        const s = document.createElement('script')
        s.src = 'https://cdn.kkiapay.me/k.js'
        s.onload = () => {
            const check = setInterval(() => {
                if (win.openKkiapayWidget) { clearInterval(check); resolve() }
            }, 200)
            setTimeout(() => { clearInterval(check); reject(new Error('Kkiapay SDK timeout')) }, 10000)
        }
        s.onerror = () => reject(new Error('SDK Kkiapay indisponible'))
        document.head.appendChild(s)
    })

    // ─── Handlers par provider ──────────────────────
    const handleKkiapay = async () => {
        setProvider('kkiapay')
        setStep('processing')
        const oid = await createOrder('kkiapay')
        if (!oid || !proposal) return
        const sandbox = settings.kkiapay_sandbox === 'true'
        const publicKey = sandbox
            ? (settings.kkiapay_sandbox_public_key || settings.kkiapay_public_key)
            : settings.kkiapay_public_key
        if (!publicKey) { cancelOrder(oid); setErrorMessage('Kkiapay non configuré'); setStep('error'); return }
        try {
            await ensureKkiapaySDK()
            // Pas de `paymentmethod` (tableau rejeté → « paramètres invalides »)
            // ni de `callback` (redirection qui contourne le listener de succès).
            // Kkiapay encaisse UNIQUEMENT en XOF -> on injecte le montant converti
            window.openKkiapayWidget({ amount: payableXof, position: 'center', key: publicKey, sandbox, phone: customerPhone || undefined, email: customerEmail || undefined, name: customerName || undefined, data: JSON.stringify({ order_id: oid }) })
            window.addKkiapayListener('success', async (response) => { await verifyPayment(oid, response.transactionId as string) })
            window.addKkiapayListener('failed', () => { cancelOrder(oid); setErrorMessage('Paiement échoué'); setStep('error') })
        } catch (err) { cancelOrder(oid); setErrorMessage(err instanceof Error ? err.message : 'Erreur Kkiapay'); setStep('error') }
    }

    const handleFedapay = async () => {
        setProvider('fedapay')
        setStep('processing')
        const oid = await createOrder('fedapay')
        if (!oid || !proposal) return
        const publicKey = settings.fedapay_public_key
        const sandbox = settings.fedapay_sandbox === 'true'
        if (!publicKey) { cancelOrder(oid); setErrorMessage('FedaPay non configuré'); setStep('error'); return }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any
        const ensureFedaPay = (): Promise<void> => new Promise((resolve, reject) => {
            if (win.FedaPay) { resolve(); return }
            const existing = document.querySelector('script[src*="fedapay"]')
            if (existing) {
                const t = setInterval(() => { if (win.FedaPay) { clearInterval(t); resolve() } }, 200)
                setTimeout(() => { clearInterval(t); reject(new Error('FedaPay timeout')) }, 8000)
                return
            }
            const s = document.createElement('script')
            s.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7'
            s.onload = () => { const t = setInterval(() => { if (win.FedaPay) { clearInterval(t); resolve() } }, 200); setTimeout(() => { clearInterval(t); reject(new Error('FedaPay timeout')) }, 8000) }
            s.onerror = () => reject(new Error('SDK FedaPay indisponible'))
            document.head.appendChild(s)
        })

        try { await ensureFedaPay() } catch (err) { cancelOrder(oid); setErrorMessage(err instanceof Error ? err.message : 'Erreur FedaPay'); setStep('error'); return }

        // FedaPay et KKiapay traitent uniquement en XOF — le montant du devis
        // (potentiellement en EUR/USD) est converti dynamiquement en XOF
        const fedaAmountXOF = payableXof

        let fedapayTxId: number | null = null
        try {
            const createRes = await fetch('/api/checkout/fedapay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: oid, amount: fedaAmountXOF, description: payLabel, customer_email: customerEmail || undefined, customer_phone: customerPhone }) })
            const createData = await createRes.json()
            if (!createRes.ok || !createData.fedapay_transaction_id) { cancelOrder(oid); setErrorMessage(createData.error || 'FedaPay erreur'); setStep('error'); return }
            fedapayTxId = createData.fedapay_transaction_id
        } catch { cancelOrder(oid); setErrorMessage('Erreur FedaPay'); setStep('error'); return }

        try {
            win.FedaPay.init('#fedapay-button', {
                public_key: publicKey,
                environment: sandbox ? 'sandbox' : 'live',
                transaction: {
                    id: fedapayTxId,
                    amount: fedaAmountXOF,
                    description: `${payLabel} — ${proposal.client_name}`,
                    currency: { iso: 'XOF' },
                },
                onComplete: async (resp: Record<string, unknown>) => {
                    const tx = resp.transaction as Record<string, unknown> | undefined
                    if (resp.reason === 'APPROVED' || (tx && (tx.status === 'approved' || tx.status === 'transferred'))) {
                        await verifyPayment(oid, String(fedapayTxId))
                    } else if (resp.reason === 'CLOSE' || resp.reason === 'CANCEL') {
                        // Utilisateur a fermé le widget sans payer
                        await cancelOrder(oid)
                        setStep('payment')
                    } else {
                        await cancelOrder(oid)
                        setErrorMessage('Paiement non approuvé')
                        setStep('error')
                    }
                },
            })
            setTimeout(() => { document.getElementById('fedapay-button')?.click() }, 100)
        } catch (err) { cancelOrder(oid); setErrorMessage(`Erreur FedaPay: ${err instanceof Error ? err.message : ''}`); setStep('error') }
    }

    const handleZeyow = async () => {
        setProvider('zeyow')
        setStep('processing')
        const oid = await createOrder('zeyow')
        if (!oid || !proposal) return
        const redirectUrl = settings.zeyow_redirect_url
        if (!redirectUrl) { setErrorMessage('Zeyow non configuré'); setStep('error'); return }
        const returnUrl = `${window.location.origin}/boutique/payment/return`
        const cancelUrl = `${window.location.origin}/p/${secret}`
        // Zeyow encaisse en XOF -> montant converti
        window.location.href = `${redirectUrl}?amount=${payableXof}&currency=XOF&order_id=${oid}&phone=${encodeURIComponent(customerPhone)}&description=${encodeURIComponent(payLabel)}&return_url=${encodeURIComponent(returnUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`
    }

    const handleStripe = async () => {
        setProvider('stripe')
        setStep('processing')
        const oid = await createOrder('stripe')
        if (!oid) return
        const publicKey = settings.stripe_public_key
        if (!publicKey) { cancelOrder(oid); setErrorMessage('Stripe non configuré'); setStep('error'); return }
        try {
            const res = await fetch('/api/checkout/stripe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: oid }) })
            const data = await res.json()
            if (!data.client_secret) { cancelOrder(oid); setErrorMessage(data.error || 'Erreur Stripe'); setStep('error'); return }
            setStripeClientSecret(data.client_secret)
            setStep('stripe-form')
        } catch { cancelOrder(oid); setErrorMessage('Erreur Stripe'); setStep('error') }
    }

    const confirmStripePayment = async () => {
        if (!stripeInstanceRef.current || !cardElementRef.current || !stripeClientSecret || !orderId) return
        if (!stripeReady) { setErrorMessage('Stripe non prêt, veuillez patienter…'); return }

        // On utilise stripeSubmitting au lieu de setStep('processing') pour NE PAS
        // déclencher le useEffect qui unmount le card element pendant confirmCardPayment.
        setStripeSubmitting(true)
        setErrorMessage('')
        try {
            const result = await stripeInstanceRef.current.confirmCardPayment(stripeClientSecret, {
                payment_method: { card: cardElementRef.current as unknown as Record<string, unknown> }
            })
            if (result.error) {
                setErrorMessage(result.error.message || 'Paiement refusé')
                setStripeSubmitting(false)
            } else if (result.paymentIntent?.status === 'succeeded') {
                setStripeSubmitting(false)
                setStep('processing') // Maintenant on peut changer l'étape (card element non requis)
                await verifyPayment(orderId, result.paymentIntent.id)
            } else {
                setErrorMessage('Paiement incomplet. Veuillez réessayer.')
                setStripeSubmitting(false)
            }
        } catch (err) {
            setStripeSubmitting(false)
            if (orderId) await cancelOrder(orderId)
            setErrorMessage(err instanceof Error ? err.message : 'Erreur Stripe')
            setStep('error')
        }
    }

    const handlePayPal = () => {
        setProvider('paypal')
        paypalRenderedRef.current = false
        setStep('paypal-form')
    }

    // Providers disponibles
    const allProviders = [
        { id: 'kkiapay' as PaymentProvider, name: 'Kkiapay', subtitle: 'Mobile Money (MTN, Moov)', logo: '/assets/icones moyens de paiement/kkiapay.png', handler: handleKkiapay, isReady: settings.kkiapay_enabled === 'true' && !!settings.kkiapay_public_key },
        { id: 'fedapay' as PaymentProvider, name: 'FedaPay', subtitle: 'Mobile Money / Carte', logo: '/assets/icones moyens de paiement/fedapay.png', handler: handleFedapay, isReady: settings.fedapay_enabled === 'true' && !!settings.fedapay_public_key },
        { id: 'zeyow' as PaymentProvider, name: 'Zeyow', subtitle: 'Carte Virtuelle', logo: '/assets/icones moyens de paiement/zeyow.jpg', handler: handleZeyow, isReady: settings.zeyow_enabled === 'true' && !!settings.zeyow_redirect_url },
        { id: 'stripe' as PaymentProvider, name: 'Stripe', subtitle: 'Carte bancaire internationale', logo: '/assets/icones moyens de paiement/Stripe.png', handler: handleStripe, isReady: settings.stripe_enabled === 'true' && !!settings.stripe_public_key },
        { id: 'paypal' as PaymentProvider, name: 'PayPal', subtitle: 'Compte PayPal', logo: '/assets/icones moyens de paiement/paypal.png', handler: handlePayPal, isReady: settings.paypal_enabled === 'true' && !!settings.paypal_client_id },
    ]
    const providers = allProviders.filter(p => p.isReady)

    // ─── LOADING ──────────────────────────
    if (loading) {
        return <div className="min-h-screen bg-[#EEF2F6] flex items-center justify-center"><Loader2 className="w-10 h-10 text-amber-500 animate-spin" /></div>
    }
    if (!proposal) {
        return <div className="min-h-screen bg-[#EEF2F6] flex items-center justify-center text-slate-900"><p>Proposition introuvable</p></div>
    }

    const billableItems = items.filter(i => i.type !== 'hero' && i.type !== 'pricing' && i.selling_price > 0)

    // ─── RENDER ──────────────────────────
    return (
        <div className="min-h-screen bg-[#EEF2F6] text-slate-900">
            {/* Header */}
            <div className="border-b border-slate-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href={`/p/${secret}`} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" /> Retour
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center font-black text-slate-900 text-sm">RG</div>
                        <span className="text-xs font-bold text-amber-500 tracking-wider hidden sm:inline">RETOUR GAGNANT</span>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-6 py-8">
                <AnimatePresence mode="wait">
                    {/* ─── STEP: INFO ──────────────────────── */}
                    {step === 'info' && (
                        <motion.div key="info" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <div className="text-center mb-8">
                                <h1 className="text-2xl md:text-3xl font-black mb-2">{isPaymentLink ? 'Finalisez votre paiement' : 'Finalisez votre réservation'}</h1>
                                <p className="text-slate-500 text-sm">{isPaymentLink ? 'Prestation :' : 'Voyage vers'} <span className="text-amber-600 font-semibold">{proposal.destination}</span></p>
                            </div>

                            {/* Recap — sélection à la carte */}
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-8">
                                {hasItemSelection && (
                                    <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                                        Composez votre formule : cochez les prestations que vous souhaitez régler.
                                        Le total est recalculé automatiquement.
                                    </p>
                                )}
                                <div className="space-y-1.5 mb-4">
                                    {billableItems.map(i => {
                                        const checked = selectedIds.has(i.id)
                                        return (
                                            <label key={i.id}
                                                className={`flex items-center justify-between gap-3 text-sm rounded-xl px-3 py-2.5 cursor-pointer transition-all border ${checked ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/[0.02] border-slate-200 opacity-60 hover:opacity-90'}`}>
                                                <span className="flex items-center gap-3 min-w-0">
                                                    <input type="checkbox" checked={checked} onChange={() => toggleItem(i.id)}
                                                        className="w-4 h-4 accent-amber-500 shrink-0" />
                                                    <span className={checked ? 'text-slate-900' : 'text-slate-500 line-through'}>{i.title}</span>
                                                </span>
                                                <span className={`font-bold shrink-0 ${checked ? 'text-slate-900' : 'text-slate-500'}`}>
                                                    <Price amount={i.selling_price} currency={proposalCurrency} forceDisplayCurrency={proposalCurrency} />
                                                </span>
                                            </label>
                                        )
                                    })}
                                </div>
                                <div className="border-t border-slate-200 pt-3">
                                    {/* Détail HT + TVA (la TVA s'ajoute au prix) */}
                                    <div className="space-y-1 mb-2 text-xs text-slate-500">
                                        <div className="flex justify-between">
                                            <span>Sous-total HT</span>
                                            <span><Price amount={htXof} currency="XOF" forceDisplayCurrency="XOF" /> XOF</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>TVA 18 %</span>
                                            <span><Price amount={tvaXof} currency="XOF" forceDisplayCurrency="XOF" /> XOF</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-amber-500 font-bold text-sm">
                                            Total TTC{hasItemSelection ? ` (${billableItems.filter(i => selectedIds.has(i.id)).length}/${billableItems.length} prestations)` : ''}
                                        </span>
                                        <CurrencySelector
                                            value={selectedCurrency}
                                            onChange={setSelectedCurrency}
                                            baseAmountXOF={payableXof}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-2xl font-black text-slate-900">
                                            {selectedCurrency === 'XOF'
                                                ? <Price amount={payableXof} currency="XOF" forceDisplayCurrency="XOF" />
                                                : formatPriceWithMargin(payableXof, selectedCurrency)
                                            }
                                        </span>
                                        {selectedCurrency !== 'XOF' && (
                                            <span className="text-[10px] text-gray-500">
                                                <Price amount={payableXof} currency="XOF" forceDisplayCurrency="XOF" /> XOF
                                            </span>
                                        )}
                                    </div>
                                    {hasItemSelection && payableTotal <= 0 && (
                                        <p className="text-xs text-red-400 font-semibold mt-2 flex items-center gap-1.5">
                                            <AlertCircle className="w-3.5 h-3.5" /> Sélectionnez au moins une prestation pour continuer.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Form */}
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Votre nom complet *</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                                        <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Jean Dupont" className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-slate-900 focus:border-amber-500 focus:outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                                        <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="jean@email.com" className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-slate-900 focus:border-amber-500 focus:outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Téléphone *</label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                                        <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+229 XX XX XX XX" className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-slate-900 focus:border-amber-500 focus:outline-none" />
                                    </div>
                                </div>
                            </div>

                            {errorMessage && (
                                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm mb-4 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorMessage}
                                </div>
                            )}

                            <button 
                                onClick={() => {
                                    if (!customerName.trim()) { setErrorMessage('Veuillez saisir votre nom'); return }
                                    if (!customerPhone.trim()) { setErrorMessage('Veuillez saisir votre téléphone'); return }
                                    if (payableTotal <= 0) { setErrorMessage('Sélectionnez au moins une prestation'); return }
                                    setErrorMessage('')
                                    setStep('payment')
                                }}
                                disabled={payableTotal <= 0}
                                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 py-4 rounded-2xl font-black text-base transition-all shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2"
                            >
                                Continuer vers le paiement <CreditCard className="w-5 h-5" />
                            </button>

                            <p className="text-center text-slate-500 text-xs mt-4 flex items-center justify-center gap-1">
                                <Lock className="w-3 h-3" /> Vos données sont protégées et chiffrées
                            </p>
                        </motion.div>
                    )}

                    {/* ─── STEP: PAYMENT METHOD ──────────────────────── */}
                    {step === 'payment' && (
                        <motion.div key="payment" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-black mb-2">Choisissez votre moyen de paiement</h2>
                                <div className="flex items-center justify-center gap-3 mt-2">
                                    <p className="text-slate-500 text-sm">Montant : <span className="text-amber-600 font-bold">
                                        {selectedCurrency === 'XOF'
                                            ? <Price amount={payableXof} currency="XOF" forceDisplayCurrency="XOF" />
                                            : formatPriceWithMargin(payableXof, selectedCurrency)
                                        }
                                    </span></p>
                                    <CurrencySelector
                                        value={selectedCurrency}
                                        onChange={setSelectedCurrency}
                                        baseAmountXOF={payableXof}
                                    />
                                </div>
                                {selectedCurrency !== 'XOF' && (
                                    <p className="text-[10px] text-slate-500 mt-1">FedaPay encaisse en {selectedCurrency} · KKiapay encaisse en XOF</p>
                                )}
                            </div>

                            <div className="space-y-3 mb-6">
                                {providers.map(p => (
                                    <button key={p.id} onClick={p.handler} className="w-full bg-white hover:bg-slate-100 border border-slate-200 hover:border-amber-500/30 rounded-2xl p-4 flex items-center gap-4 transition-all group">
                                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={p.logo} alt={p.name} className="w-8 h-8 object-contain" />
                                        </div>
                                        <div className="text-left flex-1">
                                            <p className="text-slate-900 font-bold text-sm">{p.name}</p>
                                            <p className="text-slate-500 text-xs">{p.subtitle}</p>
                                        </div>
                                        <CreditCard className="w-5 h-5 text-slate-500 group-hover:text-amber-500 transition-colors" />
                                    </button>
                                ))}
                                {providers.length === 0 && (
                                    <div className="text-center py-10 text-slate-500">
                                        <p>Aucun moyen de paiement configuré.</p>
                                        <p className="text-xs mt-1">Contactez votre agent Retour Gagnant.</p>
                                    </div>
                                )}
                            </div>

                            <button onClick={() => setStep('info')} className="w-full text-slate-500 hover:text-slate-900 py-3 text-sm transition-colors">
                                ← Retour aux informations
                            </button>
                        </motion.div>
                    )}

                    {/* ─── STEP: STRIPE FORM ──────────────────────── */}
                    {step === 'stripe-form' && (
                        <motion.div key="stripe" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-black mb-2">Carte bancaire</h2>
                                <p className="text-slate-500 text-sm">Paiement sécurisé par Stripe</p>
                            </div>

                            {/* stripeSubmitting masque le formulaire visuellement SANS changer l'étape,
                                ce qui évite que le useEffect unmount le card element pendant confirmCardPayment. */}
                            <div className={stripeSubmitting ? 'hidden' : ''}>
                                <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
                                    <div id="stripe-card-element" className="min-h-[50px]" />
                                </div>
                                {errorMessage && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm mb-4">{errorMessage}</div>}
                                <button type="button" onClick={confirmStripePayment} disabled={!stripeReady || stripeSubmitting} className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2">
                                    <Lock className="w-4 h-4" /> Payer <Price amount={payableTotal} currency={proposalCurrency} forceDisplayCurrency={proposalCurrency} />
                                </button>
                                <button type="button" onClick={() => setStep('payment')} className="w-full text-slate-500 hover:text-slate-900 py-3 text-sm mt-2">← Autre moyen de paiement</button>
                            </div>

                            {stripeSubmitting && (
                                <div className="flex flex-col items-center justify-center py-10 gap-4">
                                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                                    <p className="text-slate-900 font-bold text-sm">Traitement en cours, ne fermez pas...</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ─── STEP: PAYPAL FORM ──────────────────────── */}
                    {step === 'paypal-form' && (
                        <motion.div key="paypal" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-black mb-2">PayPal</h2>
                            </div>
                            <div id="paypal-button-container" className="min-h-[100px] mb-6" />
                            <button onClick={() => setStep('payment')} className="w-full text-slate-500 hover:text-slate-900 py-3 text-sm">← Autre moyen de paiement</button>
                        </motion.div>
                    )}

                    {/* ─── STEP: PROCESSING ──────────────────────── */}
                    {step === 'processing' && (
                        <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 gap-6">
                            <Loader2 className="w-14 h-14 text-amber-500 animate-spin" />
                            <div className="text-center">
                                <p className="text-slate-900 font-bold text-lg">Traitement en cours...</p>
                                <p className="text-slate-500 text-sm mt-1">Ne fermez pas cette page</p>
                            </div>
                        </motion.div>
                    )}

                    {/* ─── STEP: SUCCESS ──────────────────────── */}
                    {step === 'success' && (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-16 gap-8">
                            <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
                                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                            </div>
                            <div className="text-center space-y-3">
                                <h1 className="text-3xl font-black">{isPaymentLink ? 'Paiement confirmé !' : 'Réservation confirmée !'}</h1>
                                <p className="text-slate-500 max-w-md">
                                    {isPaymentLink ? <>Votre règlement pour <span className="text-amber-600 font-semibold">{proposal.destination}</span> a bien été enregistré.</> : <>Votre voyage vers <span className="text-amber-600 font-semibold">{proposal.destination}</span> est en cours de préparation.</>}
                                    Vous recevrez un email de confirmation sous peu.
                                </p>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 w-full max-w-sm text-center">
                                <p className="text-xs text-slate-500 mb-1">Montant payé</p>
                                <p className="text-2xl font-black text-amber-600">
                                    <Price amount={payableTotal} currency={proposalCurrency} forceDisplayCurrency={proposalCurrency} />
                                </p>
                            </div>
                            <Link href="/" className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-8 py-3 rounded-xl font-black transition-all">
                                Retour à l&apos;accueil
                            </Link>
                        </motion.div>
                    )}

                    {/* ─── STEP: ERROR ──────────────────────── */}
                    {step === 'error' && (
                        <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 gap-8">
                            <div className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
                                <AlertCircle className="w-12 h-12 text-red-500" />
                            </div>
                            <div className="text-center space-y-3">
                                <h1 className="text-3xl font-black">Paiement échoué</h1>
                                <p className="text-slate-500 max-w-md">{errorMessage || 'Une erreur est survenue.'}</p>
                            </div>
                            <button onClick={() => { setErrorMessage(''); setStep('payment') }} className="bg-slate-100 hover:bg-white/20 text-slate-900 px-8 py-3 rounded-xl font-bold transition-all">
                                Réessayer
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 py-4 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                <Shield className="w-3 h-3" /> Paiement sécurisé — Retour Gagnant © {new Date().getFullYear()}
            </div>

            {/* FedaPay requires a button in the DOM to bind onto. It must not be hidden with display:none */}
            <div className="absolute w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden" aria-hidden="true">
                <button id="fedapay-button" type="button" />
            </div>
        </div>
    )
}
