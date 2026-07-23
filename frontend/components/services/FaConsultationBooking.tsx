'use client'

// ══════════════════════════════════════════════════════════════
// Consultation Fa & Racines — réservation avec paiement réel.
// Prix FIXÉS CÔTÉ SERVEUR (/api/services/fa-checkout), pilotés depuis les
// tarifs admin du service. Pipeline : order → widget (order_id) → verify →
// webhook (filet) → facture + reçu automatiques.
// La clause de mise en relation est bloquante et horodatée.
// ══════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Handshake, MapPin, Video, Check, ShieldAlert, Loader2,
    CreditCard, CheckCircle2, AlertCircle, FileSignature,
} from 'lucide-react'
import { useTranslation, T } from '@/lib/translation'
import { convertCurrency } from '@/lib/currency'
import { ensureKkiapaySDK, ensureFedaPaySDK } from '@/lib/ensurePaymentSDK'

type Mode = 'presentiel' | 'visio'

// AUCUN tarif codé en dur : les prix viennent uniquement des options
// tarifaires du service (admin). Ici, seul le contenu éditorial.
const MODES: Array<{
    id: Mode
    icon: typeof MapPin
    title: string
    tagline: string
    includes: string[]
}> = [
    {
        id: 'presentiel',
        icon: MapPin,
        title: 'En Présentiel',
        tagline: 'Vous venez au Bénin, nous organisons tout sur place.',
        includes: [
            'Accueil à votre arrivée',
            'Prise de rendez-vous avec le Prêtre Fa',
            'Aide et accompagnement sur place',
            "Réservation d'hôtel",
            'Change de monnaie sur place',
        ],
    },
    {
        id: 'visio',
        icon: Video,
        title: 'En Visio',
        tagline: 'La consultation se tient à distance, nous veillons à tout.',
        includes: [
            'Organisation complète de la séance à distance',
            'Liaison directe avec le Bokonon',
            'Assistance dédiée pendant la consultation',
            'Veille technique pour le bon déroulé de bout en bout',
        ],
    },
]

const fmtXOF = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/ /g, '.')} FCFA`

/** Extrait un montant EUR d'un libellé tarifaire (« 350 € », « 1 200 € »). */
const parseEur = (s: string): number | null => {
    const clean = String(s || '').replace(/[^\d,.]/g, '')
    const m = clean.match(/(\d+(?:[.,]\d+)?)/)
    if (!m) return null
    const n = Number(m[1].replace(',', '.'))
    return isFinite(n) && n > 0 ? n : null
}

/** Tarif d'un mode depuis les options tarifaires de l'admin (match sur libellé). */
const priceFromOptions = (
    options: Array<{ label: string; price: string }> | undefined,
    needle: string,
): number | null => {
    if (!Array.isArray(options)) return null
    const opt = options.find(o => (o.label || '').toLowerCase().includes(needle))
    return opt ? parseEur(opt.price) : null
}

export default function FaConsultationBooking({ options }: { options?: Array<{ label: string; price: string }> }) {
    const { t } = useTranslation()
    const [mode, setMode] = useState<Mode>('presentiel')
    const [clauseAccepted, setClauseAccepted] = useState(false)
    const [form, setForm] = useState({ name: '', email: '', phone: '' })
    const [settings, setSettings] = useState<Record<string, string>>({})
    const [step, setStep] = useState<'form' | 'paying' | 'success'>('form')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const orderIdRef = useRef('')
    const kkiapayBound = useRef(false)
    // Montant XOF calculé par le SERVEUR (taux réels) — c'est lui qui est
    // injecté dans Kkiapay/FedaPay, jamais un recalcul client divergent.
    const serverAmountRef = useRef(0)

    useEffect(() => {
        fetch('/api/settings/payment').then(r => r.json()).then(d => setSettings(d)).catch(() => { })
    }, [])

    // Tarifs pilotés EXCLUSIVEMENT depuis l'admin (pricing_options du service) —
    // même source que le calculateur et que le serveur. Aucun repli codé en dur :
    // sans tarif configuré, la réservation est bloquée (jamais de prix obsolète).
    const modes = MODES.map(m => ({
        ...m,
        priceEUR: priceFromOptions(options, m.id === 'presentiel' ? 'présentiel' : 'visio')
            ?? priceFromOptions(options, m.id === 'presentiel' ? 'presentiel' : 'visio'),
    }))
    const selected = modes.find(m => m.id === mode)!
    const priceReady = typeof selected.priceEUR === 'number' && selected.priceEUR > 0
    // Estimation d'affichage ; le montant RÉELLEMENT débité est celui renvoyé
    // par le serveur (serverAmountRef) — source unique, zéro divergence.
    const amountXOF = priceReady ? Math.round(convertCurrency(selected.priceEUR as number, 'EUR', 'XOF')) : 0

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
            transaction: { amount: serverAmountRef.current || amountXOF, description: `Consultation Fa & Racines (${selected.title})`, currency: { iso: 'XOF' } },
            customer: { email: form.email || undefined, lastname: form.name || 'Client' },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onComplete: (resp: any) => {
                const tx = resp?.transaction
                if (resp?.reason === 'checkout complete' || resp?.reason === 'APPROVED' || tx?.status === 'approved') {
                    verifyAndFinish(orderIdRef.current, String(tx?.id || resp?.id || ''), 'fedapay')
                } else { setError(t('Paiement non finalisé.')); setSubmitting(false) }
            },
        }).open()
    }, [settings, form, amountXOF, selected.title, verifyAndFinish, t])

    const startPayment = async (method: 'kkiapay' | 'fedapay') => {
        setError('')
        if (!form.name.trim() || !form.phone.trim()) { setError(t('Veuillez renseigner votre nom et votre téléphone.')); return }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError(t('Veuillez renseigner un email valide.')); return }
        if (!clauseAccepted) { setError(t('Veuillez lire et accepter la clause de mise en relation.')); return }
        setSubmitting(true)
        try {
            const res = await fetch('/api/services/fa-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode,
                    customer_name: form.name.trim(),
                    customer_email: form.email.trim(),
                    customer_phone: form.phone.trim(),
                    payment_method: method,
                    clause_accepted: true,
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
        { id: 'kkiapay' as const, label: 'Kkiapay (Mobile Money / Carte)', ready: settings.kkiapay_enabled === 'true' && !!settings.kkiapay_public_key },
        { id: 'fedapay' as const, label: 'FedaPay (Mobile Money / Carte)', ready: settings.fedapay_enabled === 'true' && !!settings.fedapay_public_key },
    ]).filter(p => p.ready)

    const IC = 'w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-gray-900 text-sm focus:outline-none focus:border-[#7C5CCA]/60 focus:ring-2 focus:ring-[#7C5CCA]/10 placeholder:text-gray-400 transition-all'

    if (step === 'success') return (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-emerald-100 shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 size={30} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-black text-[#1a2332] mb-2"><T>Consultation réservée</T></h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                <T>Votre paiement est confirmé et votre reçu vous a été envoyé par email. Notre équipe vous contacte sous 24 h pour convenir de la date avec le Bokonon et vous transmettre l'accord de mise en relation à signer.</T>
            </p>
        </motion.div>
    )

    return (
        <div className="space-y-6">
            {/* ── Choix de la formule ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modes.map(m => {
                    const active = mode === m.id
                    const Icon = m.icon
                    return (
                        <button key={m.id} type="button" onClick={() => setMode(m.id)}
                            title={m.title}
                            className={`text-left rounded-3xl border-2 p-6 transition-all ${active
                                ? 'border-[#7C5CCA] bg-[#7C5CCA]/[0.04] shadow-[0_10px_35px_rgba(124,92,202,0.12)]'
                                : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${active ? 'bg-[#7C5CCA] text-white' : 'bg-gray-100 text-gray-500'}`}>
                                    <Icon size={20} />
                                </div>
                                {active && <span className="text-[10px] font-black uppercase tracking-widest text-[#7C5CCA] bg-[#7C5CCA]/10 px-3 py-1 rounded-full"><T>Sélectionné</T></span>}
                            </div>
                            <p className="font-black text-[#1a2332]">{t(m.title)}</p>
                            <p className="text-2xl font-black text-[#7C5CCA] mt-1">
                                {m.priceEUR ? (
                                    <>{m.priceEUR} €
                                        <span className="text-xs font-bold text-gray-400 ml-2">≈ {fmtXOF(convertCurrency(m.priceEUR, 'EUR', 'XOF'))}</span>
                                    </>
                                ) : (
                                    <span className="text-base text-gray-400 font-bold"><T>Tarif à confirmer</T></span>
                                )}
                            </p>
                            <p className="text-xs text-gray-500 mt-2 mb-4">{t(m.tagline)}</p>
                            <ul className="space-y-1.5">
                                {m.includes.map(item => (
                                    <li key={item} className="flex items-start gap-2 text-[13px] text-gray-600">
                                        <Check size={14} className={`mt-0.5 shrink-0 ${active ? 'text-[#7C5CCA]' : 'text-gray-300'}`} />
                                        {t(item)}
                                    </li>
                                ))}
                            </ul>
                        </button>
                    )
                })}
            </div>

            {/* ── Clause de mise en relation ── */}
            <div className="rounded-3xl border border-amber-200/70 bg-amber-50/60 p-6">
                <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                        <ShieldAlert size={18} className="text-amber-700" />
                    </div>
                    <div>
                        <p className="font-black text-[#1a2332] text-sm"><T>Clause de mise en relation</T></p>
                        <p className="text-[11px] text-amber-700/80 font-bold uppercase tracking-wider"><T>À lire attentivement avant de réserver</T></p>
                    </div>
                </div>
                <div className="text-[13px] text-gray-700 leading-relaxed space-y-2">
                    <p>
                        <T>Retour Gagnant Bénin intervient exclusivement comme intermédiaire de mise en relation entre vous et le Bokonon (prêtre Fa). Le contenu, le déroulement et les suites de la consultation relèvent de la seule relation entre le client et le prêtre Fa : ils n'engagent en aucun cas la responsabilité de Retour Gagnant Bénin.</T>
                    </p>
                    <p className="flex items-start gap-2">
                        <FileSignature size={15} className="mt-0.5 shrink-0 text-amber-700" />
                        <T>Dès l'enclenchement de la procédure, un accord de mise en relation est signé entre les parties, formalisant ce cadre.</T>
                    </p>
                </div>
                <label className="flex items-start gap-3 mt-4 cursor-pointer select-none">
                    <input type="checkbox" checked={clauseAccepted} onChange={e => setClauseAccepted(e.target.checked)}
                        className="mt-0.5 w-5 h-5 accent-[#7C5CCA]" />
                    <span className="text-[13px] font-bold text-gray-800">
                        <T>J'ai lu et j'accepte la clause de mise en relation ci-dessus.</T>
                    </span>
                </label>
            </div>

            {/* ── Coordonnées + paiement ── */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#7C5CCA]/10 flex items-center justify-center">
                        <Handshake size={18} className="text-[#7C5CCA]" />
                    </div>
                    <div>
                        <p className="font-black text-[#1a2332] text-sm"><T>Réserver ma consultation</T></p>
                        <p className="text-xs text-gray-400">{t(selected.title)}{priceReady ? <> · {selected.priceEUR} € <span className="text-gray-300">(≈ {fmtXOF(amountXOF)})</span></> : null}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t('Nom complet')} className={IC} />
                    <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder={t('Email')} type="email" className={IC} />
                    <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder={t('Téléphone (WhatsApp)')} className={IC} />
                </div>

                {step === 'paying' && submitting === false && (
                    <button type="button" onClick={() => (settings.fedapay_enabled === 'true' ? launchFedapay(orderIdRef.current) : launchKkiapay(orderIdRef.current))}
                        className="w-full py-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-500 hover:text-[#7C5CCA] hover:border-[#7C5CCA]/40 transition-all">
                        <T>La fenêtre s'est fermée ? Relancer le paiement</T>
                    </button>
                )}

                {submitting ? (
                    <div className="flex flex-col items-center py-4">
                        <Loader2 size={26} className="animate-spin text-[#7C5CCA]" />
                        <p className="text-xs text-gray-500 mt-2"><T>Finalisez le paiement dans la fenêtre sécurisée…</T></p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {providers.length === 0 ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                                <CreditCard size={20} className="text-gray-400 mx-auto mb-1" />
                                <p className="text-xs text-amber-800"><T>Aucune passerelle de paiement active. Contactez-nous pour finaliser votre réservation.</T></p>
                            </div>
                        ) : providers.map(p => (
                            <button key={p.id} type="button" onClick={() => startPayment(p.id)} disabled={!clauseAccepted || !priceReady}
                                title={p.label}
                                className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all text-left ${clauseAccepted && priceReady
                                    ? 'bg-[#7C5CCA] border-[#7C5CCA] text-white hover:bg-[#6b4db8] shadow-[0_10px_30px_rgba(124,92,202,0.25)]'
                                    : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'}`}>
                                <span className="flex items-center gap-3 text-sm font-black">
                                    <CreditCard size={18} /> {t('Payer')}{priceReady ? ` ${selected.priceEUR} €` : ''} — {p.id === 'kkiapay' ? 'Kkiapay' : 'FedaPay'}
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
