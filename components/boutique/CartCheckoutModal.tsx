'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X, ShoppingBag, CreditCard, Phone, User, Mail,
    CheckCircle2, AlertCircle, Loader2, Shield, ChevronRight, Tag
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart } from '@/lib/store/cartStore'

declare global {
    interface Window {
        openKkiapayWidget: (config: Record<string, unknown>) => void
        addKkiapayListener: (event: string, callback: (data: Record<string, unknown>) => void) => void
        FedaPay: {
            init: (selector: string, config: Record<string, unknown>) => void
        }
    }
}

interface CartCheckoutModalProps {
    isOpen: boolean
    onClose: () => void
}

type PaymentProvider = 'kkiapay' | 'fedapay' | 'zeyow'
type Step = 'info' | 'payment' | 'processing' | 'success' | 'error'

const formatPrice = (price: number) => new Intl.NumberFormat('fr-FR').format(price)

export function CartCheckoutModal({ isOpen, onClose }: CartCheckoutModalProps) {
    const { items, totalAmount, clearCart } = useCart()
    const [step, setStep] = useState<Step>('info')
    const [provider, setProvider] = useState<PaymentProvider | null>(null)
    const [customerName, setCustomerName] = useState('')
    const [customerEmail, setCustomerEmail] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [orderId, setOrderId] = useState<string | null>(null)
    const [settings, setSettings] = useState<Record<string, string>>({})

    // Coupon state
    const [couponCode, setCouponCode] = useState('')
    const [couponLoading, setCouponLoading] = useState(false)
    const [couponError, setCouponError] = useState('')
    const [appliedCoupon, setAppliedCoupon] = useState<{
        id: string; code: string; discount_amount: number;
    } | null>(null)

    const currency = items[0]?.currency || 'XOF'
    const finalTotal = totalAmount - (appliedCoupon?.discount_amount || 0)

    useEffect(() => {
        if (!isOpen) return
        fetch('/api/settings/payment')
            .then(res => res.json())
            .then(data => setSettings(data))
            .catch(() => setSettings({}))
    }, [isOpen])

    useEffect(() => {
        if (!isOpen) {
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
        }
    }, [isOpen])

    const validateInfo = () => {
        if (!customerName.trim()) return 'Veuillez saisir votre nom'
        if (!customerPhone.trim()) return 'Veuillez saisir votre numero de telephone'
        return null
    }

    const handleSubmitInfo = () => {
        const error = validateInfo()
        if (error) { setErrorMessage(error); return }
        setErrorMessage('')
        setStep('payment')
    }

    const createOrder = async (paymentMethod: PaymentProvider) => {
        try {
            // Create multi-item order
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
                    product_id: items[0].id,
                    product_title: items.map(i => `${i.title} x${i.quantity}`).join(', '),
                    quantity: items.reduce((s, i) => s + i.quantity, 0),
                    currency,
                    customer_name: customerName,
                    customer_email: customerEmail,
                    customer_phone: customerPhone,
                    payment_method: paymentMethod,
                    cart_items: orderItems,
                    coupon_id: appliedCoupon?.id || null,
                    amount: finalTotal,
                }),
            })
            const data = await res.json()
            if (data.order_id) {
                setOrderId(data.order_id)
                return data.order_id
            }
            throw new Error('Failed to create order')
        } catch {
            setErrorMessage('Erreçur lors de la creation de la commande')
            setStep('error')
            return null
        }
    }

    const verifyPayment = async (oid: string, transactionId: string) => {
        try {
            const res = await fetch('/api/checkout/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: oid, transaction_id: transactionId, payment_method: provider }),
            })
            const data = await res.json()
            if (data.success) {
                setStep('success')
                clearCart()
            } else {
                setErrorMessage('La verification du paiement a eéchouée.')
                setStep('error')
            }
        } catch {
            setErrorMessage('Erreçur de verification')
            setStep('error')
        }
    }

    const handleKkiapay = async () => {
        setProvider('kkiapay')
        setStep('processing')
        const oid = await createOrder('kkiapay')
        if (!oid) return
        const publicKey = settings.kkiapay_public_key
        const sandbox = settings.kkiapay_sandbox === 'true'
        if (!publicKey) { setErrorMessage("Kkiapay non configurée."); setStep('error'); return }
        try {
            window.openKkiapayWidget({ amount: finalTotal, position: 'center', key: publicKey, sandbox, phone: customerPhone, data: { order_id: oid } })
            window.addKkiapayListener('success', async (r) => { await verifyPayment(oid, r.transactionId as string) })
            window.addKkiapayListener('failed', () => { setErrorMessage('Paiement eéchouée.'); setStep('error') })
        } catch { setErrorMessage("Impossible d'ouvrir Kkiapay"); setStep('error') }
    }

    const handleFedapay = async () => {
        setProvider('fedapay')
        setStep('processing')
        const oid = await createOrder('fedapay')
        if (!oid) return
        const publicKey = settings.fedapay_public_key
        const sandbox = settings.fedapay_sandbox === 'true'
        if (!publicKey) { setErrorMessage("FedaPay non configurée."); setStep('error'); return }
        try {
            window.FedaPay.init('#cart-fedapay-btn', {
                public_key: publicKey, environment: sandbox ? 'sandbox' : 'live',
                transaction: { amount: finalTotal, description: `Panier (${items.length} articles)` },
                customer: { email: customerEmail || undefined, phone_number: { number: customerPhone } },
                onComplete: async (resp: Record<string, unknown>) => {
                    const tx = resp.transaction as Record<string, unknown> | undefined
                    if (resp.reason === 'APPROVED' || (tx && tx.status === 'approved')) {
                        await verifyPayment(oid, String(tx?.id || resp.id || ''))
                    } else { setErrorMessage("Paiement non approuvée."); setStep('error') }
                },
            })
        } catch { setErrorMessage("Impossible d'initialiser FedaPay"); setStep('error') }
    }

    const handleZeyow = async () => {
        setProvider('zeyow')
        setStep('processing')
        const oid = await createOrder('zeyow')
        if (!oid) return
        const url = settings.zeyow_redirect_url
        if (!url) { setErrorMessage("Zeyow non configurée."); setStep('error'); return }
        window.location.href = `${url}?amount=${finalTotal}&order_id=${oid}&phone=${customerPhone}`
    }

    const validateCoupon = async () => {
        if (!couponCode.trim()) return
        setCouponLoading(true)
        setCouponError('')
        try {
            const res = await fetch('/api/coupons/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: couponCode, order_amount: totalAmount })
            })
            const data = await res.json()
            if (data.valid) {
                setAppliedCoupon(data)
                setCouponCode('')
            } else {
                setCouponError(data.error)
            }
        } catch {
            setCouponError('Erreçur de validation')
        } finally {
            setCouponLoading(false)
        }
    }

    const allProviders = [
        { id: 'kkiapay' as PaymentProvider, name: 'Kkiapay', subtitle: 'Mobile Money / Carte', classes: 'bg-[#4A90D9]/20 border-[#4A90D9]/40 text-[#4A90D9]', handler: handleKkiapay, isReady: settings.kkiapay_enabled === 'true' && !!settings.kkiapay_public_key },
        { id: 'fedapay' as PaymentProvider, name: 'FedaPay', subtitle: 'Mobile Money / Carte', classes: 'bg-[#2ECC71]/20 border-[#2ECC71]/40 text-[#2ECC71]', handler: handleFedapay, isReady: settings.fedapay_enabled === 'true' && !!settings.fedapay_public_key },
        { id: 'zeyow' as PaymentProvider, name: 'Zeyow', subtitle: 'Carte Virtuelle', classes: 'bg-[#FF6B35]/20 border-[#FF6B35]/40 text-[#FF6B35]', handler: handleZeyow, isReady: settings.zeyow_enabled === 'true' && !!settings.zeyow_redirect_url },
    ]
    const providers = allProviders.filter(p => p.isReady)

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#0a0f18] border border-white/10 rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center">
                                <ShoppingBag size={20} className="text-[#FCD116]" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white font-heading">Checkout Panier</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{items.length} article{items.length > 1 ? 's' : ''}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-gray-400 transition-colors" title="Fermer">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Summary */}
                    <div className="px-6 py-4 bg-white/[0.02] border-b border-white/5">
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {items.map(item => (
                                <div key={item.id} className="flex justify-between text-xs">
                                    <span className="text-gray-400 truncate flex-1">{item.title} x{item.quantity}</span>
                                    <span className="text-white font-bold ml-4">{formatPrice(((item.sale_price && item.sale_price < item.price) ? item.sale_price : item.price) * item.quantity)}</span>
                                </div>
                            ))}
                        </div>

                        {appliedCoupon && (
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5 text-xs text-[#008751]">
                                <span className="flex items-center gap-1 font-bold">
                                    <Tag size={12} /> Coupon ({appliedCoupon.code})
                                </span>
                                <span className="font-bold">-{formatPrice(appliedCoupon.discount_amount)} {currency}</span>
                            </div>
                        )}

                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Total</span>
                            <span className="text-xl font-black text-[#FCD116] font-heading">{formatPrice(finalTotal)} <span className="text-xs text-gray-500">{currency}</span></span>
                        </div>
                    </div>

                    {/* Steps */}
                    <div className="p-6 min-h-[240px]">
                        {step === 'info' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                                <div>
                                    <label htmlFor="cart-name" className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Nom complet *</label>
                                    <div className="relative">
                                        <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                                        <input id="cart-name" type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Votre nom complet" className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors" />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="cart-phone" className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Telephone *</label>
                                    <div className="relative">
                                        <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                                        <input id="cart-phone" type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+229 XX XX XX XX" className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors" />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="cart-email" className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Email (optionnel)</label>
                                    <div className="relative">
                                        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                                        <input id="cart-email" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="votre@email.com" className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors" />
                                    </div>
                                </div>

                                {!appliedCoupon && (
                                    <div className="pt-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Code promo</label>
                                        <div className="flex gap-2">
                                            <input type="text" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="Votre code..." className="flex-1 bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white text-sm font-mono focus:outline-none focus:border-[#FCD116]/30 transition-colors" />
                                            <Button onClick={validateCoupon} disabled={couponLoading || !couponCode} className="h-full px-6 bg-white/10 hover:bg-white/20 text-white rounded-xl">
                                                {couponLoading ? <Loader2 size={16} className="animate-spin" /> : 'Appliquer'}
                                            </Button>
                                        </div>
                                        {couponError && <p className="text-[10px] text-[#E8112D] font-bold mt-1.5 ml-1">{couponError}</p>}
                                    </div>
                                )}

                                {errorMessage && <p className="text-xs text-[#E8112D] font-bold flex items-center gap-2"><AlertCircle size={14} /> {errorMessage}</p>}
                                <Button onClick={handleSubmitInfo} className="w-full h-14 rounded-xl bg-[#FCD116] text-[#0f141e] font-black text-sm hover:bg-[#008751] hover:text-white transition-all">
                                    Choisir le mode de paiement <ChevronRight size={18} className="ml-2" />
                                </Button>
                            </motion.div>
                        )}

                        {step === 'payment' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">Selectionnez votre moyen de paiement</p>
                                {providers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 space-y-3">
                                        <CreditCard size={32} className="text-gray-600" />
                                        <p className="text-sm text-gray-400 text-center">Aucune passerelle active.</p>
                                    </div>
                                ) : providers.map(p => (
                                    <button key={p.id} onClick={p.handler} className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all group text-left" title={`Payer avec ${p.name}`}>
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border ${p.classes}`}>{p.name[0]}</div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-white group-hover:text-[#FCD116] transition-colors">{p.name}</p>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">{p.subtitle}</p>
                                        </div>
                                        <ChevronRight size={18} className="text-gray-600 group-hover:text-white transition-colors" />
                                    </button>
                                ))}
                                <div className="flex items-center gap-2 text-gray-600 justify-center mt-4"><Shield size={14} /><span className="text-[10px] font-bold uppercase tracking-widest">Transaction 100% securisee</span></div>
                                <button onClick={() => setStep('info')} className="text-xs text-gray-500 hover:text-white underline transition-colors block mx-auto">Retour</button>
                            </motion.div>
                        )}

                        {step === 'processing' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-10 space-y-6">
                                <Loader2 size={48} className="animate-spin text-[#FCD116]" />
                                <div className="text-center"><p className="text-white font-bold">Traitement en cours</p><p className="text-xs text-gray-500 mt-1">Veuillez patienter...</p></div>
                            </motion.div>
                        )}

                        {step === 'success' && (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-10 space-y-6">
                                <div className="w-20 h-20 rounded-full bg-[#008751]/20 border-2 border-[#008751] flex items-center justify-center"><CheckCircle2 size={40} className="text-[#008751]" /></div>
                                <div className="text-center">
                                    <h4 className="text-2xl font-black text-white font-heading">Paiement recu</h4>
                                    <p className="text-sm text-gray-400 mt-2 max-w-xs">Votre commande a ete confirméee.</p>
                                    {orderId && <p className="text-[10px] text-gray-600 font-mono mt-4">Ref: {orderId.slice(0, 8).toUpperCase()}</p>}
                                </div>
                                <Button onClick={onClose} className="h-12 px-8 rounded-xl bg-[#008751] text-white font-bold hover:bg-[#008751]/80 transition-all">Fermer</Button>
                            </motion.div>
                        )}

                        {step === 'error' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-10 space-y-6">
                                <div className="w-20 h-20 rounded-full bg-[#E8112D]/20 border-2 border-[#E8112D] flex items-center justify-center"><AlertCircle size={40} className="text-[#E8112D]" /></div>
                                <div className="text-center">
                                    <h4 className="text-2xl font-black text-white font-heading">Erreçur</h4>
                                    <p className="text-sm text-gray-400 mt-2 max-w-xs">{errorMessage || 'Une erreçur est survenue.'}</p>
                                </div>
                                <div className="flex gap-3">
                                    <Button onClick={() => setStep('payment')} variant="outline" className="h-12 px-6 rounded-xl border-white/10 text-white">Reessayer</Button>
                                    <Button onClick={onClose} className="h-12 px-6 rounded-xl bg-white/10 text-white">Fermer</Button>
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
