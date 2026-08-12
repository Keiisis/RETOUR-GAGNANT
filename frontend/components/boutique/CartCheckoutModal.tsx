'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect, useRef, useCallback } from 'react'
import { trackEvent } from '@/lib/analytics'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X, ShoppingBag, CreditCard, Phone, User, Envelope,
    CheckCircle, WarningCircle, CircleNotch, Shield, CaretRight, Tag, Lock, MapPin
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useCart } from '@/lib/store/cartStore'
import { Price } from '@/components/ui/Price'
import CurrencySelector from '@/components/boutique/CurrencySelector'
import PaymentPrivacyNotice from '@/components/shared/PaymentPrivacyNotice'
import { type CurrencyCode, getCurrencyForLang, convertWithMargin, convertCurrency, formatPrice, CONVERSION_MARGIN } from '@/lib/currency'
import { fromHt } from '@/lib/tax'
import { ensureKkiapaySDK } from '@/lib/ensurePaymentSDK'

// ─── Déclarations des SDK tiers ────────────────────────────────────────────────
declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        openKkiapayWidget: (config: any) => void
        addKkiapayListener: (
            event: string,
            callback: (data: Record<string, unknown>) => void
        ) => void
        removeKkiapayListener: (event: string) => void
        FedaPay: {
            init: (selector: string, config: Record<string, unknown>) => void
        }
        Stripe: (key: string, options?: Record<string, unknown>) => StripeInstanceCart
        paypal: {
            Buttons: (config: {
                createOrder: () => Promise<string>
                onApprove: (data: { orderID: string }) => Promise<void>
                onError?: (err: unknown) => void
                onCancel?: () => void
                style?: Record<string, unknown>
            }) => { render: (selector: string) => Promise<void> }
        }
    }
}

interface StripeInstanceCart {
    elements: (options?: Record<string, unknown>) => StripeElementsCart
    confirmCardPayment: (
        clientSecret: string,
        data: Record<string, unknown>
    ) => Promise<{
        error?: { message: string }
        paymentIntent?: { id: string; status: string }
    }>
}

interface StripeElementsCart {
    create: (type: string, options?: Record<string, unknown>) => StripeElementCart
}

interface StripeElementCart {
    mount: (selector: string) => void
    unmount: () => void
    destroy: () => void
    on: (event: string, handler: () => void) => void
}

interface CartCheckoutModalProps {
    isOpen: boolean
    onClose: () => void
}

type PaymentProvider = 'kkiapay' | 'fedapay' | 'zeyow' | 'stripe' | 'paypal'
type Step = 'info' | 'payment' | 'stripe-form' | 'paypal-form' | 'processing' | 'success' | 'error'

const COUNTRY_TO_ZONE: Record<string, string> = {
    'Bénin': 'benin',
    'Nigeria': 'afrique-ouest', 'Togo': 'afrique-ouest', 'Ghana': 'afrique-ouest',
    "Côte d'Ivoire": 'afrique-ouest', 'Sénégal': 'afrique-ouest', 'Mali': 'afrique-ouest',
    'Burkina Faso': 'afrique-ouest', 'Niger': 'afrique-ouest', 'Guinée': 'afrique-ouest',
    'Sierra Leone': 'afrique-ouest', 'Liberia': 'afrique-ouest', 'Gambie': 'afrique-ouest',
    'Cap-Vert': 'afrique-ouest', 'Guinée-Bissau': 'afrique-ouest', 'Mauritanie': 'afrique-ouest',
    'France': 'europe', 'Belgique': 'europe', 'Suisse': 'europe', 'Allemagne': 'europe',
    'Italie': 'europe', 'Espagne': 'europe', 'Portugal': 'europe', 'Pays-Bas': 'europe',
    'Royaume-Uni': 'europe', 'Suède': 'europe', 'Norvège': 'europe', 'Danemark': 'europe',
    'Finlande': 'europe', 'Autriche': 'europe', 'Pologne': 'europe', 'Irlande': 'europe',
    'Grèce': 'europe', 'Roumanie': 'europe', 'Hongrie': 'europe', 'Tchéquie': 'europe',
    'Slovaquie': 'europe', 'Croatie': 'europe', 'Bulgarie': 'europe', 'Slovénie': 'europe',
    'Luxembourg': 'europe', 'Malte': 'europe', 'Chypre': 'europe',
    'Turquie': 'europe', 'Russie': 'europe', 'Ukraine': 'europe',
}

const ZONE_FEES: Record<string, number> = {
    benin: 0,
    'afrique-ouest': 5000,
    europe: 15000,
    international: 25000,
    digital: 0,
}

const ZONE_LABELS: Record<string, string> = {
    benin: '🇧🇯 Bénin : Livraison gratuite',
    'afrique-ouest': " Afrique de l'Ouest : +5 000 FCFA",
    europe: '🇪🇺 Europe : +15 000 FCFA',
    international: ' International : +25 000 FCFA',
    digital: ' Service digital : Gratuit',
}

const ALL_COUNTRIES = [
    'Algérie', 'Angola', 'Bénin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroun',
    'Cap-Vert', 'Centrafrique', 'Comores', 'Congo', "Côte d'Ivoire", 'Djibouti',
    'Égypte', 'Érythrée', 'Éthiopie', 'Eswatini', 'Gabon', 'Gambie', 'Ghana',
    'Guinée', 'Guinée équatoriale', 'Guinée-Bissau', 'Kenya', 'Lesotho', 'Liberia',
    'Libye', 'Madagascar', 'Malawi', 'Mali', 'Maroc', 'Maurice', 'Mauritanie',
    'Mozambique', 'Namibie', 'Niger', 'Nigeria', 'Ouganda', 'RDC', 'Rwanda',
    'Sao Tomé-et-Príncipe', 'Sénégal', 'Seychelles', 'Sierra Leone', 'Somalie',
    'Soudan', 'Soudan du Sud', 'Tanzanie', 'Tchad', 'Togo', 'Tunisie', 'Zambie',
    'Zimbabwe', 'Afrique du Sud',
    'Allemagne', 'Andorre', 'Autriche', 'Belgique', 'Biélorussie', 'Bosnie',
    'Bulgarie', 'Chypre', 'Croatie', 'Danemark', 'Espagne', 'Estonie', 'Finlande',
    'France', 'Grèce', 'Hongrie', 'Irlande', 'Islande', 'Italie', 'Kosovo',
    'Lettonie', 'Liechtenstein', 'Lituanie', 'Luxembourg', 'Malte', 'Moldavie',
    'Monaco', 'Monténégro', 'Macédoine', 'Norvège', 'Pays-Bas', 'Pologne',
    'Portugal', 'Roumanie', 'Royaume-Uni', 'Russie', 'Saint-Marin', 'Serbie',
    'Slovaquie', 'Slovénie', 'Suède', 'Suisse', 'Tchéquie', 'Turquie', 'Ukraine', 'Vatican',
    'Antigua-et-Barbuda', 'Argentine', 'Bahamas', 'Barbade', 'Belize', 'Bolivie',
    'Brésil', 'Canada', 'Chili', 'Colombie', 'Costa Rica', 'Cuba', 'Dominique',
    'Équateur', 'États-Unis', 'Grenade', 'Guatemala', 'Guyana', 'Haïti',
    'Honduras', 'Jamaïque', 'Mexique', 'Nicaragua', 'Panama', 'Paraguay', 'Pérou',
    'République Dominicaine', 'Saint-Kitts-et-Nevis', 'Sainte-Lucie',
    'Saint-Vincent-et-les-Grenadines', 'Salvador', 'Suriname', 'Trinité-et-Tobago',
    'Uruguay', 'Venezuela',
    'Afghanistan', 'Arabie Saoudite', 'Arménie', 'Azerbaïdjan', 'Bahreïn',
    'Bangladesh', 'Bhoutan', 'Cambodge', 'Chine', 'Corée du Nord', 'Corée du Sud',
    'Émirats Arabes Unis', 'Géorgie', 'Inde', 'Indonésie', 'Irak', 'Iran',
    'Israël', 'Japon', 'Jordanie', 'Kazakhstan', 'Kirghizistan', 'Koweït', 'Laos',
    'Liban', 'Malaisie', 'Maldives', 'Mongolie', 'Myanmar', 'Népal', 'Oman',
    'Ouzbékistan', 'Pakistan', 'Palestine', 'Philippines', 'Qatar', 'Singapour',
    'Sri Lanka', 'Syrie', 'Tadjikistan', 'Taïwan', 'Thaïlande', 'Timor oriental',
    'Turkménistan', 'Vietnam', 'Yémen',
    'Australie', 'Fidji', 'Kiribati', 'Marshall', 'Micronésie', 'Nauru',
    'Nouvelle-Zélande', 'Palaos', 'Papouasie-Nouvelle-Guinée', 'Samoa', 'Salomon',
    'Tonga', 'Tuvalu', 'Vanuatu',
].sort()

export function CartCheckoutModal({ isOpen, onClose }: CartCheckoutModalProps) {
    const { t, lang } = useTranslation();
    const { items, totalAmount, clearCart } = useCart()
    const [step, setStep] = useState<Step>('info')
    // Conversion : achat panier confirmé (couvre tous les moyens de paiement).
    useEffect(() => { if (step === 'success') trackEvent('purchase', { type: 'panier' }) }, [step])
    const [provider, setProvider] = useState<PaymentProvider | null>(null)
    const [customerName, setCustomerName] = useState('')
    const [customerEmail, setCustomerEmail] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [orderId, setOrderId] = useState<string | null>(null)
    const [settings, setSettings] = useState<Record<string, string>>({})
    // Snapshot du panier avant clearCart() pour afficher les infos sur l'écran de succès
    const [snapshotCount, setSnapshotCount] = useState(0)
    const [snapshotTotal, setSnapshotTotal] = useState(0)

    // Coupon
    const [couponCode, setCouponCode] = useState('')
    const [couponLoading, setCouponLoading] = useState(false)
    const [couponError, setCouponError] = useState('')
    const [appliedCoupon, setAppliedCoupon] = useState<{
        id: string; code: string; discount_amount: number
    } | null>(null)

    // Stripe
    const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null)
    const [stripeReady, setStripeReady] = useState(false)
    const stripeInstanceRef = useRef<StripeInstanceCart | null>(null)
    const cardElementRef = useRef<StripeElementCart | null>(null)
    const cardMountedRef = useRef(false)

    // PayPal
    const paypalRenderedRef = useRef(false)
    const paypalOrderIdRef = useRef<string | null>(null)

    const currency = 'XOF' // Devise DB : toujours XOF pour les gateways africaines

    // Devise sélectionnée par le client (dérivée de la langue active)
    const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(() => getCurrencyForLang(lang))
    useEffect(() => { if (isOpen) setSelectedCurrency(getCurrencyForLang(lang)) }, [isOpen, lang])
    const selectedCurrencyRef = useRef<CurrencyCode>('XOF')
    selectedCurrencyRef.current = selectedCurrency

    // Shipping
    const [shippingCountry, setShippingCountry] = useState('')
    const [shippingZone, setShippingZone] = useState('digital')
    const [shippingAddress, setShippingAddress] = useState('')
    const shippingFee = ZONE_FEES[shippingZone] ?? 0

    // TVA EN SUS : les prix produits sont HORS TAXE. La TVA 18 % s'ajoute sur
    // les marchandises (après remise) ; la livraison reste hors TVA. Le client
    // paie donc TTC marchandises + livraison : identique au calcul serveur.
    const htMarchandises = Math.max(0, totalAmount - (appliedCoupon?.discount_amount || 0))
    const { tva: tvaMarchandises, ttc: ttcMarchandises } = fromHt(htMarchandises, 'XOF')
    const finalTotal = ttcMarchandises + shippingFee
    // Affichage honnête sans marge (la marge 6% est prélevée silencieusement par la passerelle)
    const displayAmount = convertCurrency(finalTotal, 'XOF', selectedCurrency)

    useEffect(() => {
        if (!isOpen) return
        fetch('/api/settings/payment')
            .then(r => r.json())
            .then(d => setSettings(d))
            .catch(() => setSettings({}))
    }, [isOpen])

    useEffect(() => {
        if (!isOpen) {
            // Libérer le stock si une commande est en attente (paiement non finalisé)
            if (orderId && step !== 'success') {
                fetch('/api/checkout/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: orderId }),
                }).catch(() => { })
            }
            setStep('info')
            setProvider(null)
            setCustomerName('')
            setCustomerEmail('')
            setCustomerPhone('')
            setErrorMessage('')
            setOrderId(null)
            setCouponCode('')
            setAppliedCoupon(null)
            setCouponError('')
            setStripeClientSecret(null)
            setStripeReady(false)
            setShippingCountry('')
            setShippingZone('digital')
            setShippingAddress('')
            cardMountedRef.current = false
            paypalRenderedRef.current = false
            paypalOrderIdRef.current = null
            if (cardElementRef.current) {
                try { cardElementRef.current.destroy() } catch { /* ignore */ }
                cardElementRef.current = null
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    // ─── Stripe Elements ───────────────────────────────────────────────────────
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

        type StripeLoaderCart = (key: string) => StripeInstanceCart
        const getStripe = () => (window as unknown as { Stripe?: StripeLoaderCart }).Stripe

        const mountCard = () => {
            const StripeJs = getStripe()
            if (!StripeJs) return
            if (cardMountedRef.current) return

            if (!stripeInstanceRef.current) {
                stripeInstanceRef.current = StripeJs(publicKey)
            }

            // CardElement (API classique) : pas d'appearance ni de clientSecret sur elements()
            const elements = stripeInstanceRef.current.elements()
            const card = elements.create('card', {
                style: {
                    base: {
                        color: '#ffffff',
                        fontSize: '15px',
                        fontFamily: 'system-ui, sans-serif',
                        '::placeholder': { color: '#4b5563' },
                        backgroundColor: 'transparent',
                    },
                    invalid: { color: '#E8112D' },
                },
                hidePostalCode: true,
            })

            setTimeout(() => {
                const el = document.getElementById('cart-stripe-card-element')
                if (el) {
                    card.mount('#cart-stripe-card-element')
                    cardElementRef.current = card
                    cardMountedRef.current = true
                    setStripeReady(true)
                }
            }, 100)
        }

        let interval: ReturnType<typeof setInterval> | null = null

        if (getStripe()) {
            setTimeout(mountCard, 100)
        } else {
            // Stripe.js chargé via afterInteractive : attente polling jusqu'à 8s
            let elapsed = 0
            interval = setInterval(() => {
                elapsed += 300
                if (getStripe()) {
                    clearInterval(interval!)
                    interval = null
                    setTimeout(mountCard, 100)
                } else if (elapsed >= 8000) {
                    clearInterval(interval!)
                    interval = null
                    setStripeReady(false)
                }
            }, 300)
        }

        return () => { if (interval) clearInterval(interval) }
    }, [step, settings.stripe_public_key])

    // ─── PayPal Buttons ────────────────────────────────────────────────────────
    useEffect(() => {
        if (step !== 'paypal-form') {
            paypalRenderedRef.current = false
            return
        }
        if (paypalRenderedRef.current) return

        const clientId = settings.paypal_client_id
        if (!clientId) return

        const curr = selectedCurrencyRef.current !== 'XOF'
            ? selectedCurrencyRef.current
            : (settings.paypal_currency || 'XOF').toUpperCase()
        const container = document.getElementById('cart-paypal-button-container')
        if (!container) return

        const initPayPalButtons = () => {
            if (!window.paypal || paypalRenderedRef.current) return
            paypalRenderedRef.current = true

            window.paypal
                .Buttons({
                    style: {
                        layout: 'vertical',
                        color: 'gold',
                        shape: 'rect',
                        label: 'pay',
                        height: 48,
                    },
                    createOrder: async (): Promise<string> => {
                        const oid = await createOrder('paypal')
                        if (!oid) throw new Error('Erreur création commande')
                        paypalOrderIdRef.current = oid

                        const ppCurrency = selectedCurrencyRef.current
                        const ppAmount = convertWithMargin(finalTotal, ppCurrency)
                        const res = await fetch('/api/checkout/paypal/create', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                order_id: oid,
                                display_currency: ppCurrency !== 'XOF' ? ppCurrency : undefined,
                                display_amount: ppCurrency !== 'XOF' ? ppAmount : undefined,
                            }),
                        })
                        const data = await res.json()
                        if (!data.paypal_order_id) throw new Error(data.error || 'Erreur PayPal')
                        return data.paypal_order_id
                    },
                    onApprove: async (data: { orderID: string }) => {
                        setStep('processing')
                        const oid = paypalOrderIdRef.current
                        if (!oid) { setErrorMessage('Référence commande perdue'); setStep('error'); return }

                        const res = await fetch('/api/checkout/paypal/capture', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                paypal_order_id: data.orderID,
                                order_id: oid,
                            }),
                        })
                        const result = await res.json()
                        if (result.success) {
                            setOrderId(oid)
                            setSnapshotCount(items.length)
                            setSnapshotTotal(finalTotal)
                            clearCart()
                            setStep('success')
                        } else {
                            cancelOrder(oid)
                            setErrorMessage(result.error || 'Capture PayPal échouée')
                            setStep('error')
                        }
                    },
                    onError: () => {
                        const pOid = paypalOrderIdRef.current
                        if (pOid) cancelOrder(pOid)
                        setErrorMessage('Une erreur PayPal est survenue.')
                        setStep('error')
                    },
                    onCancel: () => {
                        setStep('payment')
                    },
                })
                .render('#cart-paypal-button-container')
                .catch(() => {
                    setErrorMessage("Impossible d'initialiser PayPal")
                    setStep('error')
                })
        }

        if (window.paypal) {
            setTimeout(initPayPalButtons, 50)
        } else {
            const existingScript = document.getElementById('paypal-sdk-script')
            if (existingScript) {
                const existingCurrency = existingScript.getAttribute('data-currency')
                if (existingCurrency && existingCurrency !== curr) {
                    existingScript.remove()
                    paypalRenderedRef.current = false
                } else {
                    existingScript.addEventListener('load', initPayPalButtons)
                    return
                }
            }
            if (!document.getElementById('paypal-sdk-script')) {
                const script = document.createElement('script')
                script.id = 'paypal-sdk-script'
                script.setAttribute('data-currency', curr)
                script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${curr}&locale=fr_FR&intent=capture`
                script.onload = initPayPalButtons
                script.onerror = () => {
                    setErrorMessage('Impossible de charger PayPal')
                    setStep('error')
                }
                document.head.appendChild(script)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, settings.paypal_client_id, settings.paypal_currency])

    const validateInfo = () => {
        if (!customerName.trim()) return 'Veuillez saisir votre nom'
        if (!customerPhone.trim()) return 'Veuillez saisir votre numéro de téléphone'
        if (!shippingCountry) return 'Veuillez sélectionner votre pays de livraison'
        if (shippingZone !== 'digital' && !shippingAddress.trim()) return 'Veuillez saisir votre adresse de livraison'
        return null
    }

    const handleSubmitInfo = () => {
        const err = validateInfo()
        if (err) { setErrorMessage(err); return }
        setErrorMessage('')
        setStep('payment')
    }

    const createOrder = useCallback(async (paymentMethod: PaymentProvider): Promise<string | null> => {
        try {
            const orderItems = items.map(i => ({
                product_id: i.id,
                product_title: i.title,
                quantity: i.quantity,
                unit_price: (i.sale_price && i.sale_price < i.price) ? i.sale_price : i.price,
            }))

            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: items[0]?.id,
                    product_title: items.map(i => `${i.title} x${i.quantity}`).join(', '),
                    quantity: items.reduce((s, i) => s + i.quantity, 0),
                    currency,
                    customer_name: customerName,
                    customer_email: customerEmail,
                    customer_phone: customerPhone,
                    payment_method: paymentMethod,
                    cart_items: orderItems,
                    coupon_id: appliedCoupon?.id || null,
                    shipping_country: shippingCountry,
                    shipping_address: shippingZone !== 'digital' ? shippingAddress : null,
                    shipping_zone: shippingZone,
                    shipping_fee: shippingFee,
                    amount: finalTotal,
                }),
            })
            const data = await res.json()
            if (data.order_id) {
                setOrderId(data.order_id)
                return data.order_id
            }
            throw new Error(data.error || 'Erreur lors de la création de la commande')
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : 'Erreur lors de la création de la commande')
            setStep('error')
            return null
        }
    }, [items, currency, customerName, customerEmail, customerPhone, appliedCoupon, shippingCountry, shippingAddress, shippingZone, shippingFee, finalTotal])

    const cancelOrder = useCallback(async (oid: string) => {
        try {
            await fetch('/api/checkout/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: oid }),
            })
        } catch { /* fire and forget */ }
    }, [])

    const verifyPayment = async (oid: string, transactionId: string) => {
        try {
            const res = await fetch('/api/checkout/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: oid,
                    transaction_id: transactionId,
                    payment_method: provider,
                }),
            })
            const data = await res.json()
            if (data.success) {
                setSnapshotCount(items.length)
                setSnapshotTotal(finalTotal)
                clearCart()
                setStep('success')
            } else {
                await cancelOrder(oid)
                setErrorMessage(data.error || 'La vérification du paiement a échoué.')
                setStep('error')
            }
        } catch {
            await cancelOrder(oid)
            setErrorMessage('Erreur de vérification')
            setStep('error')
        }
    }

    // ─── Handlers ─────────────────────────────────────────────────────────────

    const handleKkiapay = async () => {
        setProvider('kkiapay')
        setStep('processing')
        const oid = await createOrder('kkiapay')
        if (!oid) return
        const sandbox = settings.kkiapay_sandbox === 'true'
        const publicKey = sandbox
            ? (settings.kkiapay_sandbox_public_key || settings.kkiapay_public_key)
            : settings.kkiapay_public_key
        if (!publicKey) { cancelOrder(oid); setErrorMessage('Kkiapay non configurée.'); setStep('error'); return }
        try {
            await ensureKkiapaySDK()
        } catch {
            cancelOrder(oid); setErrorMessage("SDK Kkiapay non chargé. Rechargez la page."); setStep('error'); return
        }
        const kkAmount = Math.max(1, Math.round(finalTotal * (1 + CONVERSION_MARGIN)))
        console.log('[Kkiapay] amount XOF:', kkAmount, 'finalTotal:', finalTotal, 'sandbox:', sandbox)

        // ── Intercepteur XHR pour capturer les erreurs 400 du SDK Kkiapay (axios/XHR) ──
        const origOpen = XMLHttpRequest.prototype.open
        const origSend = XMLHttpRequest.prototype.send
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(this as any).__kkUrl = String(url)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(this as any).__kkMethod = method
            return origOpen.apply(this, [method, url, ...rest] as Parameters<typeof origOpen>)
        }
        XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const url = (this as any).__kkUrl || ''
            if (url.includes('kkiapay.me')) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                console.log(`[Kkiapay XHR] → ${(this as any).__kkMethod} ${url}`)
                console.log(`[Kkiapay XHR] → Body envoyé:`, body)
                this.addEventListener('load', () => {
                    if (this.status >= 400) {
                        console.error(`[Kkiapay XHR] ← ${this.status} ${url}`)
                        console.error(`[Kkiapay XHR] ← Réponse:`, this.responseText)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ;(window as any).__kkiapayLastError = {
                            status: this.status, url, requestBody: body,
                            responseBody: this.responseText,
                            timestamp: new Date().toISOString(),
                        }
                    }
                })
            }
            return origSend.call(this, body)
        }
        setTimeout(() => {
            XMLHttpRequest.prototype.open = origOpen
            XMLHttpRequest.prototype.send = origSend
        }, 60000)

        // Séparer le nom complet en firstname/lastname (requis par Kkiapay pour les cartes)
        const nameParts = (customerName || '').trim().split(/\s+/)
        const firstName = nameParts[0] || 'Client'
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName

        try {
            // Nettoyer les anciens listeners avant d'en ajouter de nouveaux
            // (évite l'accumulation sur retry : vieux oid se déclenche sur nouveau paiement)
            if (typeof window.removeKkiapayListener === 'function') {
                try { window.removeKkiapayListener('success') } catch { /* ignore */ }
                try { window.removeKkiapayListener('failed') } catch { /* ignore */ }
                try { window.removeKkiapayListener('close' as Parameters<typeof window.removeKkiapayListener>[0]) } catch { /* ignore */ }
            }
            window.openKkiapayWidget({
                amount: kkAmount,
                position: 'center',
                key: publicKey,
                sandbox,
                phone: customerPhone || undefined,
                email: customerEmail || undefined,
                name: customerName || undefined,
                firstname: firstName,
                lastname: lastName,
                paymentmethod: ['momo', 'card'],
                data: JSON.stringify({ order_id: oid }),
                callback: `${window.location.origin}/boutique`,
            })
            window.addKkiapayListener('success', async (r) => {
                await verifyPayment(oid, r.transactionId as string)
            })
            window.addKkiapayListener('failed', () => {
                cancelOrder(oid); setErrorMessage('Paiement échoué ou annulé.'); setStep('error')
            })
            // 'close' : l'utilisateur a fermé le widget sans payer
            window.addKkiapayListener('close' as Parameters<typeof window.addKkiapayListener>[0], () => {
                cancelOrder(oid); setStep('payment')
            })
        } catch (err) {
            console.error('[Kkiapay] Erreur widget:', err)
            cancelOrder(oid); setErrorMessage(`Erreur Kkiapay: ${err instanceof Error ? err.message : String(err)}`); setStep('error')
        }
    }

    const handleFedapay = async () => {
        setProvider('fedapay')
        setStep('processing')
        const oid = await createOrder('fedapay')
        if (!oid) return
        const publicKey = settings.fedapay_public_key
        const sandbox = settings.fedapay_sandbox === 'true'
        if (!publicKey) { cancelOrder(oid); setErrorMessage('FedaPay non configurée.'); setStep('error'); return }

        // Charger le SDK FedaPay dynamiquement si nécessaire
        const ensureFedaPay = (): Promise<void> => new Promise((resolve, reject) => {
            if (window.FedaPay) { resolve(); return }
            const poll = (ms: number) => {
                let elapsed = 0
                const t = setInterval(() => {
                    if (window.FedaPay) { clearInterval(t); resolve() }
                    else if (elapsed >= ms) { clearInterval(t); reject(new Error("SDK FedaPay indisponible après chargement")) }
                    elapsed += 200
                }, 200)
            }
            const existing = document.querySelector('script[src*="fedapay.com/checkout.js"]')
            if (existing) { poll(8000); return }
            const s = document.createElement('script')
            s.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7'
            s.onload = () => poll(4000)
            s.onerror = () => reject(new Error("Impossible de charger le SDK FedaPay. Vérifiez votre connexion."))
            document.head.appendChild(s)
        })

        try {
            await ensureFedaPay()
        } catch (err) {
            cancelOrder(oid)
            setErrorMessage(err instanceof Error ? err.message : "SDK FedaPay non disponible")
            setStep('error')
            return
        }

        // Créer la transaction FedaPay côté serveur pour obtenir un ID fiable
        let fedapayTxId: number | null = null
        try {
            const createRes = await fetch('/api/checkout/fedapay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: oid,
                    amount: Math.round(finalTotal * (1 + CONVERSION_MARGIN)),
                    description: `Panier (${items.length} article${items.length > 1 ? 's' : ''})`,
                    customer_email: customerEmail || undefined,
                    customer_phone: customerPhone,
                }),
            })
            const createData = await createRes.json()
            if (!createRes.ok || !createData.fedapay_transaction_id) {
                cancelOrder(oid)
                setErrorMessage(createData.error || 'Impossible de créer la transaction FedaPay')
                setStep('error')
                return
            }
            fedapayTxId = createData.fedapay_transaction_id
        } catch {
            cancelOrder(oid)
            setErrorMessage('Erreur de connexion à FedaPay')
            setStep('error')
            return
        }

        try {
            window.FedaPay.init('#cart-fedapay-btn', {
                public_key: publicKey,
                environment: sandbox ? 'sandbox' : 'live',
                transaction: { id: fedapayTxId },
                onComplete: async (resp: Record<string, unknown>) => {
                    const tx = resp.transaction as Record<string, unknown> | undefined
                    if (resp.reason === 'APPROVED' || (tx && (tx.status === 'approved' || tx.status === 'transferred'))) {
                        // L'ID serveur est fiable : plus besoin d'extraire du callback
                        await verifyPayment(oid, String(fedapayTxId))
                    } else {
                        cancelOrder(oid); setErrorMessage('Paiement non approuvé.'); setStep('error')
                    }
                },
            })
            // Déclencher l'ouverture du modal FedaPay
            setTimeout(() => { document.getElementById('cart-fedapay-btn')?.click() }, 100)
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erreur inconnue'
            cancelOrder(oid)
            setErrorMessage(`Impossible d'initialiser FedaPay: ${msg}`)
            setStep('error')
        }
    }

    const handleZeyow = async () => {
        setProvider('zeyow')
        setStep('processing')
        const oid = await createOrder('zeyow')
        if (!oid) return
        const url = settings.zeyow_redirect_url
        if (!url) { setErrorMessage('Zeyow non configurée.'); setStep('error'); return }

        const returnUrl = `${window.location.origin}/boutique/payment/return`
        const cancelUrl = `${window.location.origin}/boutique`

        window.location.href =
            `${url}?amount=${Math.round(finalTotal * (1 + CONVERSION_MARGIN))}` +
            `&currency=${currency}` +
            `&order_id=${oid}` +
            `&phone=${encodeURIComponent(customerPhone)}` +
            `&description=${encodeURIComponent(`Panier (${items.length} articles)`)}` +
            `&return_url=${encodeURIComponent(returnUrl)}` +
            `&cancel_url=${encodeURIComponent(cancelUrl)}`
    }

    const handleStripe = async () => {
        setProvider('stripe')
        setStep('processing')
        const oid = await createOrder('stripe')
        if (!oid) return

        const publicKey = settings.stripe_public_key
        if (!publicKey) { cancelOrder(oid); setErrorMessage("Stripe n'est pas configuré."); setStep('error'); return }

        try {
            const stripeCurrency = selectedCurrencyRef.current
            const stripeDisplayAmount = convertWithMargin(finalTotal, stripeCurrency)
            const res = await fetch('/api/checkout/stripe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-display-currency': stripeCurrency,
                    'x-display-amount': String(stripeDisplayAmount),
                },
                body: JSON.stringify({ order_id: oid }),
            })
            const data = await res.json()
            if (!data.client_secret) {
                cancelOrder(oid)
                setErrorMessage(data.error || 'Erreur Stripe')
                setStep('error')
                return
            }
            setStripeClientSecret(data.client_secret)
            setStep('stripe-form')
        } catch {
            cancelOrder(oid)
            setErrorMessage('Impossible de contacter Stripe')
            setStep('error')
        }
    }

    const confirmStripePayment = async () => {
        if (!stripeInstanceRef.current || !cardElementRef.current || !stripeClientSecret || !orderId) return
        setStep('processing')
        try {
            const result = await stripeInstanceRef.current.confirmCardPayment(stripeClientSecret, {
                payment_method: {
                    card: cardElementRef.current as unknown as Record<string, unknown>,
                },
            })
            if (result.error) {
                setErrorMessage(result.error.message || 'Paiement refusé')
                setStep('stripe-form')
            } else if (result.paymentIntent?.status === 'succeeded') {
                await verifyPayment(orderId, result.paymentIntent.id)
            } else {
                setErrorMessage('Paiement incomplet. Veuillez réessayer ou contacter votre banque.')
                setStep('stripe-form')
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erreur de paiement Stripe'
            await cancelOrder(orderId)
            setErrorMessage(msg)
            setStep('error')
        }
    }

    const handlePayPal = async () => {
        setProvider('paypal')
        paypalRenderedRef.current = false
        setStep('paypal-form')
    }

    const validateCoupon = async () => {
        if (!couponCode.trim()) return
        setCouponLoading(true)
        setCouponError('')
        try {
            const res = await fetch('/api/coupons/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: couponCode, order_amount: totalAmount }),
            })
            const data = await res.json()
            if (data.valid) {
                setAppliedCoupon(data)
                setCouponCode('')
            } else {
                setCouponError(data.error)
            }
        } catch {
            setCouponError('Erreur de validation')
        } finally {
            setCouponLoading(false)
        }
    }

    const allProviders = [
        {
            id: 'kkiapay' as PaymentProvider,
            name: 'Kkiapay',
            subtitle: 'Mobile Money (MTN, Moov) / Carte',
            classes: 'bg-[#4A90D9]/10 border-[#4A90D9]/30',
            logo: '/assets/icones moyens de paiement/kkiapay.png',
            handler: handleKkiapay,
            isReady: settings.kkiapay_enabled === 'true' && !!settings.kkiapay_public_key,
        },
        {
            id: 'fedapay' as PaymentProvider,
            name: 'FedaPay',
            subtitle: 'Mobile Money / Carte bancaire',
            classes: 'bg-[#2ECC71]/10 border-[#2ECC71]/30',
            logo: '/assets/icones moyens de paiement/fedapay.png',
            handler: handleFedapay,
            isReady: settings.fedapay_enabled === 'true' && !!settings.fedapay_public_key,
        },
        {
            id: 'zeyow' as PaymentProvider,
            name: 'Zeyow',
            subtitle: 'Carte Virtuelle',
            classes: 'bg-[#FF6B35]/10 border-[#FF6B35]/30',
            logo: '/assets/icones moyens de paiement/zeyow.jpg',
            handler: handleZeyow,
            isReady: settings.zeyow_enabled === 'true' && !!settings.zeyow_redirect_url,
        },
        {
            id: 'stripe' as PaymentProvider,
            name: 'Stripe',
            subtitle: 'Carte bancaire internationale',
            classes: 'bg-[#635BFF]/10 border-[#635BFF]/30',
            logo: '/assets/icones moyens de paiement/Stripe.png',
            handler: handleStripe,
            isReady: settings.stripe_enabled === 'true' && !!settings.stripe_public_key,
        },
        {
            id: 'paypal' as PaymentProvider,
            name: 'PayPal',
            subtitle: 'Compte PayPal Business',
            classes: 'bg-[#009CDE]/10 border-[#009CDE]/30',
            logo: '/assets/icones moyens de paiement/paypal.png',
            handler: handlePayPal,
            isReady: settings.paypal_enabled === 'true' && !!settings.paypal_client_id,
        },
    ]
    const providers = allProviders.filter(p => p.isReady)

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            >
                <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative bg-[#0a0f18] border border-white/10 rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center">
                                <ShoppingBag size={20} className="text-[#FCD116]" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white font-heading"><T>Checkout Panier</T></h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                    {step === 'success' ? snapshotCount : items.length} article{(step === 'success' ? snapshotCount : items.length) > 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl hover:bg-white/5 text-gray-400 transition-colors"
                            title={t("Fermer")}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Résumé panier : masqué sur l'écran de succès (panier déjà vidé) */}
                    {step !== 'success' && <div className="px-6 py-4 bg-white/[0.02] border-b border-white/5">
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {items.map(item => (
                                <div key={item.id} className="flex justify-between text-xs">
                                    <span className="text-gray-400 truncate flex-1">{item.title} x{item.quantity}</span>
                                    <span className="text-white font-bold ml-4">
                                        <Price amount={((item.sale_price && item.sale_price < item.price) ? item.sale_price : item.price) * item.quantity} currency="XOF" noConvert />
                                    </span>
                                </div>
                            ))}
                        </div>
                        {appliedCoupon && (
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5 text-xs text-[#008751]">
                                <span className="flex items-center gap-1 font-bold">
                                    <Tag size={12} /> Coupon ({appliedCoupon.code})
                                </span>
                                <span className="font-bold">-<Price amount={appliedCoupon.discount_amount} currency="XOF" noConvert /></span>
                            </div>
                        )}
                        {/* TVA en sus : la TVA s'ajoute au prix des marchandises */}
                        <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                            <span className="font-bold"><T>Sous-total HT</T></span>
                            <span className="font-bold text-white"><Price amount={htMarchandises} currency="XOF" noConvert /></span>
                        </div>
                        <div className="flex justify-between items-center mt-1 text-xs text-gray-400">
                            <span className="font-bold">TVA 18 %</span>
                            <span className="font-bold text-white">+<Price amount={tvaMarchandises} currency="XOF" noConvert /></span>
                        </div>
                        {shippingFee > 0 && (
                            <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                                <span className="flex items-center gap-1 font-bold">
                                    <MapPin size={12} /> Livraison ({shippingCountry || shippingZone})
                                </span>
                                <span className="font-bold text-white">+<Price amount={shippingFee} currency="XOF" noConvert /></span>
                            </div>
                        )}
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold"><T>Total TTC</T></span>
                            <div className="flex flex-col items-end gap-1.5">
                                <span className="text-xl font-black text-[#FCD116] font-heading">
                                    {selectedCurrency === 'XOF'
                                        ? <Price amount={finalTotal} currency="XOF" noConvert />
                                        : <span>{formatPrice(displayAmount, selectedCurrency)}</span>
                                    }
                                </span>
                                {selectedCurrency !== 'XOF' && (
                                    <div className="text-right">
                                        <p className="text-[10px] text-gray-500">= <Price amount={finalTotal} currency="XOF" noConvert /></p>
                                        <p className="text-[9px] text-gray-600 mt-0.5">Débité en XOF par votre banque</p>
                                    </div>
                                )}
                                <CurrencySelector
                                    value={selectedCurrency}
                                    onChange={setSelectedCurrency}
                                    baseAmountXOF={finalTotal}
                                />
                            </div>
                        </div>
                    </div>}

                    {/* Steps */}
                    <div className="p-4 sm:p-6 min-h-[200px] sm:min-h-[240px]">

                        {/* STEP: Info */}
                        {step === 'info' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                                <div>
                                    <label htmlFor="cart-name" className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block"><T>Nom complet *</T></label>
                                    <div className="relative">
                                        <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                                        <input id="cart-name" type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={t("Votre nom complet")} className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors" />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="cart-phone" className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block"><T>Téléphone *</T></label>
                                    <div className="relative">
                                        <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                                        <input id="cart-phone" type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder={t("+229 XX XX XX XX")} className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors" />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="cart-email" className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                                        Email <span className="text-[#FCD116] normal-case font-normal tracking-normal"><T>-pour recevoir votre facture</T></span>
                                    </label>
                                    <div className="relative">
                                        <Envelope size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                                        <input id="cart-email" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder={t("votre@email.com")} className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors" />
                                    </div>
                                </div>

                                {/* Livraison : pays + adresse */}
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block flex items-center gap-1">
                                        <MapPin size={12} /> Pays de livraison *
                                    </label>
                                    <select
                                        title={t("Pays de livraison")}
                                        value={shippingCountry}
                                        onChange={e => {
                                            const country = e.target.value
                                            setShippingCountry(country)
                                            const zone = country === 'digital' ? 'digital' : (COUNTRY_TO_ZONE[country] || 'international')
                                            setShippingZone(zone)
                                        }}
                                        className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors"
                                    >
                                        <option value=""><T>Sélectionnez votre pays</T></option>
                                        <option value="digital"><T>Service digital (pas de livraison physique)</T></option>
                                        <optgroup label="──────────">
                                            {ALL_COUNTRIES.map(c => (
                                                <option key={c} value={c} className="bg-[#0a0f18]">{c}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                    {shippingCountry && (
                                        <p className={`text-[10px] mt-1 font-bold ${shippingFee === 0 ? 'text-[#008751]' : 'text-[#FCD116]'}`}>
                                            {ZONE_LABELS[shippingZone]}
                                        </p>
                                    )}
                                </div>
                                {shippingCountry && shippingZone !== 'digital' && (
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block"><T>Adresse de livraison *</T></label>
                                        <div className="relative">
                                            <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                                            <input
                                                type="text"
                                                value={shippingAddress}
                                                onChange={e => setShippingAddress(e.target.value)}
                                                placeholder={t("Quartier, rue, numéro...")}
                                                className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors"
                                            />
                                        </div>
                                    </div>
                                )}

                                {!appliedCoupon && (
                                    <div className="pt-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block"><T>Code promo</T></label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={couponCode}
                                                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                                placeholder={t("Votre code...")}
                                                className="flex-1 bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white text-sm font-mono focus:outline-none focus:border-[#FCD116]/30 transition-colors"
                                            />
                                            <Button
                                                type="button"
                                                onClick={validateCoupon}
                                                disabled={couponLoading || !couponCode}
                                                className="h-full px-6 bg-white/10 hover:bg-white/20 text-white rounded-xl"
                                            >
                                                {couponLoading ? <CircleNotch size={16} className="animate-spin" /> : 'Appliquer'}
                                            </Button>
                                        </div>
                                        {couponError && <p className="text-[10px] text-[#E8112D] font-bold mt-1.5 ml-1">{couponError}</p>}
                                    </div>
                                )}

                                {errorMessage && (
                                    <p className="text-xs text-[#E8112D] font-bold flex items-center gap-2">
                                        <WarningCircle size={14} /> {errorMessage}
                                    </p>
                                )}
                                <Button
                                    type="button"
                                    onClick={handleSubmitInfo}
                                    className="w-full h-14 rounded-xl bg-[#FCD116] text-[#0f141e] font-black text-sm hover:bg-[#008751] hover:text-white transition-all"
                                >
                                    Choisir le mode de paiement <CaretRight size={18} className="ml-2" />
                                </Button>
                            </motion.div>
                        )}

                        {/* STEP: Choix du provider */}
                        {step === 'payment' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-3">
                                    Sélectionnez votre moyen de paiement
                                </p>
                                {providers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 space-y-3">
                                        <CreditCard size={32} className="text-gray-600" />
                                        <p className="text-sm text-gray-400 text-center"><T>Aucune passerelle active.</T></p>
                                    </div>
                                ) : providers.map(p => (
                                    <motion.button
                                        key={p.id}
                                        type="button"
                                        onClick={p.handler}
                                        whileHover={{ scale: 1.02, y: -2 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/20 hover:bg-white/[0.05] transition-all group text-left"
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border overflow-hidden ${p.classes}`}>
                                            <img
                                                src={p.logo}
                                                alt={p.name}
                                                className="w-7 h-7 object-contain transition-transform duration-300 group-hover:scale-110"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-white group-hover:text-[#FCD116] transition-colors">{p.name}</p>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">{p.subtitle}</p>
                                        </div>
                                        <CaretRight size={18} className="text-gray-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                                    </motion.button>
                                ))}
                                <PaymentPrivacyNotice className="mt-3" />
                                <div className="flex items-center gap-2 text-gray-600 justify-center mt-3">
                                    <Shield size={13} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest"><T>Transaction 100% sécurisée</T></span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setStep('info')}
                                    className="text-xs text-gray-500 hover:text-white underline transition-colors block mx-auto"
                                >
                                    Retour
                                </button>
                            </motion.div>
                        )}

                        {/* STEP: Formulaire Stripe */}
                        {step === 'stripe-form' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-[#635BFF]/20 border border-[#635BFF]/30 flex items-center justify-center">
                                        <Lock size={14} className="text-[#635BFF]" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white"><T>Paiement par carte : Stripe</T></p>
                                        <p className="text-[10px] text-gray-500"><T>Sécurisé par Stripe · TLS 256-bit</T></p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                        Informations de carte
                                    </label>
                                    <div
                                        id="cart-stripe-card-element"
                                        className="w-full bg-[#0d1520] border border-white/10 rounded-xl p-4 min-h-[52px] focus-within:border-[#635BFF]/40 transition-colors"
                                    />
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                    <Shield size={12} className="text-[#008751]" />
                                    Vos données de carte ne transitent jamais par nos serveurs.
                                </div>
                                <Button
                                    type="button"
                                    onClick={confirmStripePayment}
                                    disabled={!stripeReady}
                                    className="w-full h-14 rounded-xl bg-[#635BFF] text-white font-black text-sm hover:bg-[#635BFF]/80 transition-all disabled:opacity-50"
                                >
                                    {stripeReady ? (
                                        <span className="flex items-center gap-1 justify-center"><T>Payer</T> {selectedCurrency === 'XOF' ? <Price amount={finalTotal} currency="XOF" noConvert /> : <span>{formatPrice(displayAmount, selectedCurrency)}</span>} <Lock size={14} className="ml-2" /></span>
                                    ) : (
                                        <><CircleNotch size={16} className="animate-spin mr-2" /> <T>Chargement...</T></>
                                    )}
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => setStep('payment')}
                                    className="text-xs text-gray-500 hover:text-white underline transition-colors block mx-auto"
                                >
                                    Changer de méthode
                                </button>
                            </motion.div>
                        )}

                        {/* STEP: Boutons PayPal */}
                        {step === 'paypal-form' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-[#009CDE]/10 border border-[#009CDE]/30 flex items-center justify-center overflow-hidden">
                                        <img src="/assets/icones moyens de paiement/paypal.png" alt={t("PayPal")} className="w-5 h-5 object-contain" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white"><T>Paiement via PayPal</T></p>
                                        <p className="text-[10px] text-gray-500"><T>Connectez-vous à votre compte PayPal</T></p>
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-2xl p-4">
                                    <div id="cart-paypal-button-container" className="min-h-[50px] flex items-center justify-center">
                                        <CircleNotch size={24} className="animate-spin text-[#009CDE]" />
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-600 text-center">
                                    Montant: <span className="text-white font-bold">{selectedCurrency === 'XOF' ? <Price amount={finalTotal} currency="XOF" noConvert /> : <span>{formatPrice(displayAmount, selectedCurrency)}</span>}</span>
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setStep('payment')}
                                    className="text-xs text-gray-500 hover:text-white underline transition-colors block mx-auto"
                                >
                                    Changer de méthode
                                </button>
                            </motion.div>
                        )}

                        {/* STEP: Processing */}
                        {step === 'processing' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-10 space-y-6">
                                <CircleNotch size={48} className="animate-spin text-[#FCD116]" />
                                <div className="text-center">
                                    <p className="text-white font-bold"><T>Traitement en cours</T></p>
                                    <p className="text-xs text-gray-500 mt-1"><T>Ne fermez pas cette fenêtre...</T></p>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP: Success */}
                        {step === 'success' && (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-10 space-y-6">
                                <div className="w-20 h-20 rounded-full bg-[#008751]/20 border-2 border-[#008751] flex items-center justify-center">
                                    <CheckCircle size={40} className="text-[#008751]" />
                                </div>
                                <div className="text-center">
                                    <h4 className="text-2xl font-black text-white font-heading"><T>Paiement reçu</T></h4>
                                    <p className="text-sm text-gray-400 mt-2 max-w-xs"><T>Votre commande a été confirmée.</T></p>
                                    {orderId && <p className="text-[10px] text-gray-600 font-mono mt-4">Réf: {orderId.slice(0, 8).toUpperCase()}</p>}
                                </div>
                                <Button
                                    type="button"
                                    onClick={onClose}
                                    className="h-12 px-8 rounded-xl bg-[#008751] text-white font-bold hover:bg-[#008751]/80 transition-all"
                                >
                                    Fermer
                                </Button>
                            </motion.div>
                        )}

                        {/* STEP: Error */}
                        {step === 'error' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-10 space-y-6">
                                <div className="w-20 h-20 rounded-full bg-[#E8112D]/20 border-2 border-[#E8112D] flex items-center justify-center">
                                    <WarningCircle size={40} className="text-[#E8112D]" />
                                </div>
                                <div className="text-center">
                                    <h4 className="text-2xl font-black text-white font-heading"><T>Erreur</T></h4>
                                    <p className="text-sm text-gray-400 mt-2 max-w-xs">{errorMessage || 'Une erreur est survenue.'}</p>
                                </div>
                                <div className="flex gap-3">
                                    <Button type="button" onClick={() => setStep('payment')} variant="outline" className="h-12 px-6 rounded-xl border-white/10 text-white"><T>Réessayer</T></Button>
                                    <Button type="button" onClick={onClose} className="h-12 px-6 rounded-xl bg-white/10 text-white"><T>Fermer</T></Button>
                                </div>
                            </motion.div>
                        )}
                    </div>

                    <div id="cart-fedapay-btn" className="hidden" />
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
