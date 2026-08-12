'use client'

// ══════════════════════════════════════════════════════════════
// Permis de Conduire Béninois : réservation avec paiement réel.
// Le client choisit une CATÉGORIE de permis (le PRIX en dépend, fixé serveur
// depuis permis_types) puis, facultativement, une auto-école partenaire.
// Prix fixé côté serveur (/api/services/permis-checkout). Pipeline order →
// widget (order_id) → verify → webhook (filet) → facture + reçu. Charte verte.
// ══════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IdentificationCard, Car, MapPin, Clock, Check, CircleNotch as Loader2, CreditCard, CheckCircle as CheckCircle2, WarningCircle as AlertCircle } from '@phosphor-icons/react'
import { useTranslation, T } from '@/lib/translation'
import { convertCurrency } from '@/lib/currency'
import { ensureKkiapaySDK, ensureFedaPaySDK } from '@/lib/ensurePaymentSDK'

const ACCENT = '#008751'

interface PermisType {
    id: string
    category: string
    label: string
    description: string | null
    age_min: number | null
    price_eur: number | null
    duration: string | null
}
interface School {
    id: string
    nom: string
    ville: string | null
    photo_url: string | null
}

const fmtXOF = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/ /g, '.')} FCFA`

export default function PermisBooking() {
    const { t } = useTranslation()
    const [types, setTypes] = useState<PermisType[]>([])
    const [typeId, setTypeId] = useState('')
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
        fetch('/api/permis-types').then(r => r.json()).then(d => setTypes(d.types || [])).catch(() => { })
        fetch('/api/driving-schools').then(r => r.json()).then(d => setSchools(d.schools || [])).catch(() => { })
    }, [])

    const selected = types.find(x => x.id === typeId) || null
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
            transaction: { amount: serverAmountRef.current || amountXOF, description: `Permis de Conduire Béninois${selected ? ` : ${selected.label}` : ''}`, currency: { iso: 'XOF' } },
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
        if (!typeId) { setError(t('Veuillez choisir une catégorie de permis.')); return }
        if (!form.name.trim() || !form.phone.trim()) { setError(t('Veuillez renseigner votre nom et votre téléphone.')); return }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError(t('Veuillez renseigner un email valide.')); return }
        setSubmitting(true)
        try {
            const res = await fetch('/api/services/permis-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    permis_type_id: typeId,
                    school_id: schoolId || undefined,
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

    const IC = 'w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 text-sm focus:outline-none focus:border-[#008751]/60 focus:ring-2 focus:ring-[#008751]/10 placeholder:text-slate-400 transition-all'

    if (step === 'success') return (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-emerald-100 shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 size={30} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2"><T>Inscription confirmée</T></h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                <T>Votre paiement est confirmé et votre reçu vous a été envoyé par email. Notre équipe vous contacte sous 24 h pour lancer votre dossier de permis et planifier votre formation.</T>
            </p>
        </motion.div>
    )

    if (types.length === 0) return (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <IdentificationCard size={22} className="text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-amber-800"><T>Les catégories de permis seront bientôt disponibles. Contactez-nous pour lancer votre permis dès maintenant.</T></p>
        </div>
    )

    return (
        <div className="space-y-6">
            {/* ── Choix de la catégorie (le prix en dépend) ── */}
            <div>
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-3"><T>1. Votre catégorie de permis</T></p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {types.map(ty => {
                        const active = typeId === ty.id
                        const pEur = typeof ty.price_eur === 'number' && ty.price_eur > 0 ? ty.price_eur : null
                        return (
                            <button key={ty.id} type="button" onClick={() => setTypeId(ty.id)} title={ty.label}
                                className={`text-left rounded-2xl border-2 p-5 transition-all ${active
                                    ? 'border-[#008751] bg-[#008751]/[0.04] shadow-[0_10px_35px_rgba(0,135,81,0.12)]'
                                    : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="inline-flex items-center gap-2 font-black text-slate-900">
                                        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-black" style={{ background: active ? ACCENT : '#eef2f0', color: active ? '#fff' : '#475569' }}>{ty.category}</span>
                                        {ty.label.replace(/\s*\([^)]*\)\s*$/, '')}
                                    </span>
                                    {active && <Check size={16} className="text-[#008751]" />}
                                </div>
                                {ty.description && <p className="text-[12.5px] text-slate-500 leading-snug">{ty.description}</p>}
                                <div className="flex items-center gap-3 mt-2.5">
                                    <span className="text-lg font-black" style={{ color: ACCENT }}>
                                        {pEur ? <>{pEur} € <span className="text-[11px] font-bold text-slate-400">≈ {fmtXOF(convertCurrency(pEur, 'EUR', 'XOF'))}</span></> : <span className="text-sm text-slate-400 font-bold"><T>Tarif à confirmer</T></span>}
                                    </span>
                                    {ty.duration && <span className="text-[11px] text-slate-500 flex items-center gap-1"><Clock size={12} className="text-[#008751]" /> {ty.duration}</span>}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ── Choix de l'auto-école (facultatif) ── */}
            {schools.length > 0 && (
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-1"><T>2. Votre auto-école</T></p>
                    <p className="text-xs text-slate-500 mb-3"><T>Facultatif. Sans choix, nous vous orientons vers l'auto-école partenaire la plus proche.</T></p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button type="button" onClick={() => setSchoolId('')}
                            className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${schoolId === '' ? 'border-[#008751] bg-[#008751]/5' : 'border-slate-200 hover:border-slate-300'}`}>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><Car size={16} className="text-slate-400" /></div>
                            <div className="min-w-0">
                                <p className="text-[13px] font-bold text-slate-900"><T>Laisser RGB choisir</T></p>
                                <p className="text-[11px] text-slate-400"><T>La plus proche de vous</T></p>
                            </div>
                        </button>
                        {schools.map(s => {
                            const on = schoolId === s.id
                            return (
                                <button key={s.id} type="button" onClick={() => setSchoolId(s.id)}
                                    className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${on ? 'border-[#008751] bg-[#008751]/5' : 'border-slate-200 hover:border-slate-300'}`}>
                                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#008751]/10 flex items-center justify-center shrink-0">
                                        {s.photo_url
                                            // eslint-disable-next-line @next/next/no-img-element
                                            ? <img src={s.photo_url} alt={s.nom} className="w-full h-full object-cover" />
                                            : <Car size={16} className="text-[#008751]" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-bold text-slate-900 truncate">{s.nom}</p>
                                        {s.ville && <p className="text-[11px] text-slate-400 truncate flex items-center gap-1"><MapPin size={10} /> {s.ville}</p>}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Coordonnées + paiement ── */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#008751]/10 flex items-center justify-center">
                        <IdentificationCard size={18} className="text-[#008751]" />
                    </div>
                    <div>
                        <p className="font-black text-slate-900 text-sm"><T>Lancer mon permis</T></p>
                        <p className="text-xs text-slate-400">
                            {selected ? selected.label.replace(/\s*\([^)]*\)\s*$/, '') : t('Choisissez une catégorie ci-dessus')}
                            {priceReady ? <> · {priceEUR} € <span className="text-slate-300">(≈ {fmtXOF(amountXOF)})</span></> : null}
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
                        className="w-full py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:text-[#008751] hover:border-[#008751]/40 transition-all">
                        <T>La fenêtre s'est fermée ? Relancer le paiement</T>
                    </button>
                )}

                {submitting ? (
                    <div className="flex flex-col items-center py-4">
                        <Loader2 size={26} className="animate-spin text-[#008751]" />
                        <p className="text-xs text-slate-500 mt-2"><T>Finalisez le paiement dans la fenêtre sécurisée…</T></p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {providers.length === 0 ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                                <CreditCard size={20} className="text-slate-400 mx-auto mb-1" />
                                <p className="text-xs text-amber-800"><T>Aucune passerelle de paiement active. Contactez-nous pour finaliser votre inscription.</T></p>
                            </div>
                        ) : providers.map(p => (
                            <button key={p.id} type="button" onClick={() => startPayment(p.id)} disabled={!typeId || !priceReady}
                                title={p.id === 'kkiapay' ? 'Kkiapay' : 'FedaPay'}
                                className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all text-left ${typeId && priceReady
                                    ? 'bg-[#008751] border-[#008751] text-white hover:bg-[#007043] shadow-[0_10px_30px_rgba(0,135,81,0.25)]'
                                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'}`}>
                                <span className="flex items-center gap-3 text-sm font-black">
                                    <CreditCard size={18} /> {t('Payer')}{priceReady ? ` ${priceEUR} €` : ''} · {p.id === 'kkiapay' ? 'Kkiapay' : 'FedaPay'}
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

                <p className="text-[10px] text-slate-400 text-center">
                    <T>Paiement 100 % sécurisé. Encaissement en FCFA au taux fixe BCEAO. Reçu envoyé par email dès confirmation.</T>
                </p>
            </div>
        </div>
    )
}
