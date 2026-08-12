'use client'

// ══════════════════════════════════════════════════════════════
// Permis de Conduire Béninois — réservation avec paiement réel.
// Le client CHOISIT une auto-école partenaire (prix + durée propres à chaque
// école). Prix FIXÉ CÔTÉ SERVEUR (/api/services/permis-checkout), lu depuis
// l'auto-école. Pipeline : order → widget (order_id) → verify → webhook (filet)
// → facture + reçu automatiques. Charte Bénin (vert #008751).
// ══════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Car, MapPin, Clock, Check, CircleNotch as Loader2, CreditCard, CheckCircle as CheckCircle2, WarningCircle as AlertCircle } from '@phosphor-icons/react'
import { useTranslation, T } from '@/lib/translation'
import { convertCurrency } from '@/lib/currency'
import { ensureKkiapaySDK, ensureFedaPaySDK } from '@/lib/ensurePaymentSDK'

const ACCENT = '#008751'

interface School {
    id: string
    nom: string
    ville: string | null
    description: string | null
    photo_url: string | null
    price_eur: number | null
    duration: string | null
    features: string[] | null
}

const fmtXOF = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/ /g, '.')} FCFA`

export default function PermisBooking() {
    const { t } = useTranslation()
    const [schools, setSchools] = useState<School[]>([])
    const [schoolId, setSchoolId] = useState('')
    const [form, setForm] = useState({ name: '', email: '', phone: '' })
    const [settings, setSettings] = useState<Record<string, string>>({})
    const [step, setStep] = useState<'form' | 'paying' | 'success'>('form')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const orderIdRef = useRef('')
    const kkiapayBound = useRef(false)
    const serverAmountRef = useRef(0)

    useEffect(() => {
        fetch('/api/settings/payment').then(r => r.json()).then(setSettings).catch(() => { })
    }, [])

    // Auto-écoles partenaires — le choix est OBLIGATOIRE (le prix en dépend).
    useEffect(() => {
        fetch('/api/driving-schools')
            .then(r => r.json())
            .then(d => setSchools(d.schools || []))
            .catch(() => { })
    }, [])

    const selected = schools.find(s => s.id === schoolId) || null
    const priceEUR = selected && typeof selected.price_eur === 'number' && selected.price_eur > 0 ? selected.price_eur : null
    const priceReady = priceEUR !== null
    const amountXOF = priceReady ? Math.round(convertCurrency(priceEUR as number, 'EUR', 'XOF')) : 0

    const verifyAndFinish = useCallback(async (oid: string, txId: string, method: string) => {
        try {
            const res = await fetch('/api/checkout/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: oid, transaction_id: txId, payment_method: method }),
            })
            const data = await res.json()
            if (data.success) setStep('success')
            else setError(data.error || t('Paiement reçu, confirmation en cours. Votre reçu arrivera par email.'))
        } catch {
            setError(t('Paiement reçu, confirmation en cours. Votre reçu arrivera par email.'))
        }
        setSubmitting(false)
    }, [t])

    const launchKkiapay = useCallback(async (oid: string) => {
        await ensureKkiapaySDK()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any
        const isSandbox = settings.kkiapay_sandbox === 'true'
        if (!kkiapayBound.current && typeof w.addKkiapayListener === 'function') {
            kkiapayBound.current = true
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            w.addKkiapayListener('success', (response: any) => {
                verifyAndFinish(orderIdRef.current, String(response?.transactionId || ''), 'kkiapay')
            })
            w.addKkiapayListener('failed', () => {
                setError(t('Le paiement a échoué ou a été refusé.'))
                setSubmitting(false)
            })
        }
        w.openKkiapayWidget({
            amount: serverAmountRef.current || amountXOF,
            position: 'center',
            key: isSandbox
                ? (settings.kkiapay_sandbox_public_key || settings.kkiapay_public_key)
                : settings.kkiapay_public_key,
            sandbox: isSandbox,
            email: form.email || undefined,
            phone: form.phone || undefined,
            name: form.name || undefined,
            data: JSON.stringify({ order_id: oid }),
        })
    }, [settings, form, amountXOF, verifyAndFinish, t])

    const launchFedapay = useCallback(async (oid: string) => {
        await ensureFedaPaySDK()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const FP = (window as any).FedaPay
        FP.init({
            public_key: settings.fedapay_public_key,
            environment: settings.fedapay_sandbox === 'true' ? 'sandbox' : 'live',
            transaction: { amount: serverAmountRef.current || amountXOF, description: `Permis de Conduire Béninois${selected ? ` — ${selected.nom}` : ''}`, currency: { iso: 'XOF' } },
            customer: { email: form.email || undefined, lastname: form.name || 'Client' },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onComplete: (resp: any) => {
                const tx = resp?.transaction
                if (resp?.reason === 'checkout complete' || resp?.reason === 'APPROVED' || tx?.status === 'approved') {
                    verifyAndFinish(orderIdRef.current, String(tx?.id || resp?.id || ''), 'fedapay')
                } else { setError(t('Paiement non finalisé.')); setSubmitting(false) }
            },
        }).open()
    }, [settings, form, amountXOF, selected, verifyAndFinish, t])

    const startPayment = async (method: 'kkiapay' | 'fedapay') => {
        setError('')
        if (!schoolId) { setError(t('Veuillez choisir une auto-école.')); return }
        if (!form.name.trim() || !form.phone.trim()) { setError(t('Veuillez renseigner votre nom et votre téléphone.')); return }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError(t('Veuillez renseigner un email valide.')); return }
        setSubmitting(true)
        try {
            const res = await fetch('/api/services/permis-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    school_id: schoolId,
                    customer_name: form.name.trim(),
                    customer_email: form.email.trim(),
                    customer_phone: form.phone.trim(),
                    payment_method: method,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || 'Erreur lors de la réservation.')
            orderIdRef.current = String(data.order_id)
            serverAmountRef.current = Number(data.amount_xof) || 0
            setStep('paying')
            if (method === 'fedapay') await launchFedapay(orderIdRef.current)
            else await launchKkiapay(orderIdRef.current)
        } catch (e) {
            setError(e instanceof Error ? e.message : t('Erreur réseau. Réessayez.'))
            setSubmitting(false)
        }
    }

    const providers = ([
        { id: 'kkiapay' as const, ready: settings.kkiapay_enabled === 'true' && !!settings.kkiapay_public_key },
        { id: 'fedapay' as const, ready: settings.fedapay_enabled === 'true' && !!settings.fedapay_public_key },
    ]).filter(p => p.ready)

    const IC = 'w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-gray-900 text-sm focus:outline-none focus:border-[#008751]/60 focus:ring-2 focus:ring-[#008751]/10 placeholder:text-gray-400 transition-all'

    if (step === 'success') return (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-emerald-100 shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 size={30} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-black text-[#1a2332] mb-2"><T>Inscription confirmée</T></h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                <T>Votre paiement est confirmé et votre reçu vous a été envoyé par email. Notre équipe vous contacte sous 24 h avec votre auto-école pour lancer votre dossier de permis et planifier vos cours.</T>
            </p>
        </motion.div>
    )

    if (schools.length === 0) return (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <Car size={22} className="text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-amber-800"><T>Nos auto-écoles partenaires seront bientôt disponibles. Contactez-nous pour lancer votre permis dès maintenant.</T></p>
        </div>
    )

    return (
        <div className="space-y-6">
            {/* ── Choix de l'auto-école ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {schools.map(s => {
                    const active = schoolId === s.id
                    const pEur = typeof s.price_eur === 'number' && s.price_eur > 0 ? s.price_eur : null
                    return (
                        <button key={s.id} type="button" onClick={() => setSchoolId(s.id)}
                            title={s.nom}
                            className={`text-left rounded-3xl border-2 p-6 transition-all ${active
                                ? 'border-[#008751] bg-[#008751]/[0.04] shadow-[0_10px_35px_rgba(0,135,81,0.12)]'
                                : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center shrink-0" style={{ background: active ? ACCENT : '#f3f4f6' }}>
                                    {s.photo_url
                                        // eslint-disable-next-line @next/next/no-img-element
                                        ? <img src={s.photo_url} alt={s.nom} className="w-full h-full object-cover" />
                                        : <Car size={20} className={active ? 'text-white' : 'text-gray-500'} />}
                                </div>
                                {active && <span className="text-[10px] font-black uppercase tracking-widest text-[#008751] bg-[#008751]/10 px-3 py-1 rounded-full"><T>Sélectionnée</T></span>}
                            </div>
                            <p className="font-black text-[#1a2332]">{s.nom}</p>
                            {s.ville && (
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><MapPin size={12} /> {s.ville}</p>
                            )}
                            <p className="text-2xl font-black mt-2" style={{ color: ACCENT }}>
                                {pEur ? (
                                    <>{pEur} €
                                        <span className="text-xs font-bold text-gray-400 ml-2">≈ {fmtXOF(convertCurrency(pEur, 'EUR', 'XOF'))}</span>
                                    </>
                                ) : (
                                    <span className="text-base text-gray-400 font-bold"><T>Tarif à confirmer</T></span>
                                )}
                            </p>
                            {s.duration && (
                                <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1.5">
                                    <Clock size={13} className="text-[#008751]" /> <T>Durée</T> : {s.duration}
                                </p>
                            )}
                            {s.description && <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">{s.description}</p>}
                            {Array.isArray(s.features) && s.features.length > 0 && (
                                <ul className="space-y-1.5 mt-3">
                                    {s.features.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-[13px] text-gray-600">
                                            <Check size={14} className={`mt-0.5 shrink-0 ${active ? 'text-[#008751]' : 'text-gray-300'}`} />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* ── Coordonnées + paiement ── */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#008751]/10 flex items-center justify-center">
                        <Car size={18} className="text-[#008751]" />
                    </div>
                    <div>
                        <p className="font-black text-[#1a2332] text-sm"><T>Lancer mon permis</T></p>
                        <p className="text-xs text-gray-400">
                            {selected ? selected.nom : t('Choisissez une auto-école ci-dessus')}
                            {priceReady ? <> · {priceEUR} € <span className="text-gray-300">(≈ {fmtXOF(amountXOF)})</span></> : null}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t('Nom complet')} className={IC} />
                    <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder={t('Email')} type="email" className={IC} />
                    <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder={t('Téléphone (WhatsApp)')} className={IC} />
                </div>

                {step === 'paying' && submitting === false && (
                    <button type="button" onClick={() => (settings.fedapay_enabled === 'true' ? launchFedapay(orderIdRef.current) : launchKkiapay(orderIdRef.current))}
                        className="w-full py-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-500 hover:text-[#008751] hover:border-[#008751]/40 transition-all">
                        <T>La fenêtre s'est fermée ? Relancer le paiement</T>
                    </button>
                )}

                {submitting ? (
                    <div className="flex flex-col items-center py-4">
                        <Loader2 size={26} className="animate-spin text-[#008751]" />
                        <p className="text-xs text-gray-500 mt-2"><T>Finalisez le paiement dans la fenêtre sécurisée…</T></p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {providers.length === 0 ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                                <CreditCard size={20} className="text-gray-400 mx-auto mb-1" />
                                <p className="text-xs text-amber-800"><T>Aucune passerelle de paiement active. Contactez-nous pour finaliser votre inscription.</T></p>
                            </div>
                        ) : providers.map(p => (
                            <button key={p.id} type="button" onClick={() => startPayment(p.id)} disabled={!schoolId || !priceReady}
                                title={p.id === 'kkiapay' ? 'Kkiapay' : 'FedaPay'}
                                className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all text-left ${schoolId && priceReady
                                    ? 'bg-[#008751] border-[#008751] text-white hover:bg-[#007043] shadow-[0_10px_30px_rgba(0,135,81,0.25)]'
                                    : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'}`}>
                                <span className="flex items-center gap-3 text-sm font-black">
                                    <CreditCard size={18} /> {t('Payer')}{priceReady ? ` ${priceEUR} €` : ''} — {p.id === 'kkiapay' ? 'Kkiapay' : 'FedaPay'}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{t('Mobile Money / Carte')}</span>
                            </button>
                        ))}
                    </div>
                )}

                <AnimatePresence>
                    {error && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="text-xs text-red-700 flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                            <AlertCircle size={13} className="shrink-0" /> {error}
                        </motion.p>
                    )}
                </AnimatePresence>

                <p className="text-[10px] text-gray-400 text-center">
                    <T>Paiement 100 % sécurisé. Encaissement en FCFA au taux fixe BCEAO. Reçu envoyé par email dès confirmation.</T>
                </p>
            </div>
        </div>
    )
}
