'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import {
    CheckCircle2, ChevronRight, Archive, Database, Users,
    CreditCard, Loader2, AlertCircle, Shield, ArrowLeft, X, FileText
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { T, useTranslation } from '@/lib/translation'
import PaymentPrivacyNotice from '@/components/shared/PaymentPrivacyNotice'

type PaymentProvider = 'kkiapay' | 'fedapay' | 'zeyow'

interface MissingDoc {
    key: string
    label: string
    required: boolean
    ancestral: boolean
}

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        openKkiapayWidget: (config: any) => void
        addKkiapayListener: (event: string, callback: (data: Record<string, unknown>) => void) => void
        FedaPay: { init: (selector: string, config: Record<string, unknown>) => void }
    }
}

const RESEARCH_PRICE = 250 // en EUR — converti en XOF pour les passerelles africaines
const EUR_TO_XOF = 655.957 // taux fixe FCFA

function ComplementAncestralContent() {
    const { t } = useTranslation()
    const searchParams = useSearchParams()
    const ref = searchParams.get('ref') || ''

    const [missingDocs, setMissingDocs] = useState<MissingDoc[]>([])
    const [applicantName, setApplicantName] = useState('')
    const [loading, setLoading] = useState(true)
    const [paymentSettings, setPaymentSettings] = useState<Record<string, string>>({})
    const [paymentDone, setPaymentDone] = useState(false)
    const [paymentProvider, setPaymentProvider] = useState<PaymentProvider | null>(null)
    const [paymentTxId, setPaymentTxId] = useState('')
    const [paymentProcessing, setPaymentProcessing] = useState(false)
    const [paymentError, setPaymentError] = useState('')
    const kkiapayBound = useRef(false)
    // Garde : enregistrement auto dès paiement confirmé (une seule fois).
    // Sans ça, la commande n'était créée qu'au clic manuel post-paiement —
    // perdue si l'onglet fermait (même faille que le formulaire nationalité).
    const autoSubmitRef = useRef(false)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        fetch('/api/settings/payment').then(r => r.json()).then(setPaymentSettings).catch(() => { })

        if (!ref) { setLoading(false); return }

        supabase
            .from('nationality_applications')
            .select('prenom, nom, missing_docs, needs_recherche_ancestrale')
            .eq('application_ref', ref)
            .single()
            .then(({ data, error: err }) => {
                if (err || !data) { setError('Dossier introuvable'); setLoading(false); return }
                setApplicantName(`${data.prenom} ${data.nom}`)
                const docs: MissingDoc[] = (data.missing_docs || []).filter((d: MissingDoc) => d.ancestral)
                setMissingDocs(docs)
                setLoading(false)
            })
    }, [ref])

    const providers = [
        { id: 'kkiapay' as PaymentProvider, name: 'Kkiapay', subtitle: t('Mobile Money / Carte'), color: 'bg-[#4A90D9]/20 border-[#4A90D9]/40 text-[#4A90D9]', isReady: paymentSettings.kkiapay_enabled === 'true' && !!paymentSettings.kkiapay_public_key },
        { id: 'fedapay' as PaymentProvider, name: 'FedaPay', subtitle: t('Mobile Money / Carte'), color: 'bg-[#2ECC71]/20 border-[#2ECC71]/40 text-[#2ECC71]', isReady: paymentSettings.fedapay_enabled === 'true' && !!paymentSettings.fedapay_public_key },
        { id: 'zeyow' as PaymentProvider, name: 'Zeyow', subtitle: t('Carte Virtuelle'), color: 'bg-[#FF6B35]/20 border-[#FF6B35]/40 text-[#FF6B35]', isReady: paymentSettings.zeyow_enabled === 'true' && !!paymentSettings.zeyow_redirect_url },
    ].filter(p => p.isReady)

    const amountXOF = Math.round(RESEARCH_PRICE * EUR_TO_XOF)

    const bindKkiapayListeners = () => {
        if (kkiapayBound.current) return
        if (typeof window.addKkiapayListener !== 'function') return
        kkiapayBound.current = true
        window.addKkiapayListener('success', (response) => {
            setPaymentTxId(String(response.transactionId || ''))
            setPaymentDone(true); setPaymentProcessing(false)
        })
        window.addKkiapayListener('failed', () => {
            setPaymentError(t('Le paiement a échoué ou a été refusé. Si vous utilisez une carte bancaire hors zone UEMOA (Canada, Europe…), essayez le Mobile Money ou un autre moyen de paiement.'))
            setPaymentProcessing(false)
        })
    }

    const handleKkiapay = () => {
        if (typeof window.openKkiapayWidget !== 'function') {
            setPaymentError(t('Le module de paiement n\'est pas encore chargé. Patientez quelques secondes puis réessayez.'))
            return
        }
        setPaymentProcessing(true); setPaymentError(''); setPaymentProvider('kkiapay')
        try {
            bindKkiapayListeners()
            window.openKkiapayWidget({
                amount: amountXOF, position: 'center',
                key: paymentSettings.kkiapay_sandbox === 'true'
                    ? (paymentSettings.kkiapay_sandbox_public_key || paymentSettings.kkiapay_public_key)
                    : paymentSettings.kkiapay_public_key,
                sandbox: paymentSettings.kkiapay_sandbox === 'true',
                data: JSON.stringify({ context: 'recherche-ancestrale', ref }),
            })
        } catch { setPaymentError(t('Impossible d\'ouvrir Kkiapay')); setPaymentProcessing(false) }
    }

    const handleFedapay = () => {
        setPaymentProcessing(true); setPaymentError(''); setPaymentProvider('fedapay')
        try {
            window.FedaPay.init('#fedapay-ancestral-btn', {
                public_key: paymentSettings.fedapay_public_key,
                environment: paymentSettings.fedapay_sandbox === 'true' ? 'sandbox' : 'live',
                transaction: { amount: amountXOF, description: `Recherche Ancestrale — Dossier ${ref}` },
                onComplete: (resp: Record<string, unknown>) => {
                    const tx = resp.transaction as Record<string, unknown> | undefined
                    if (resp.reason === 'APPROVED' || (tx && tx.status === 'approved')) {
                        setPaymentTxId(String(tx?.id || resp.id || '')); setPaymentDone(true)
                    } else { setPaymentError(t('Paiement non approuvé.')) }
                    setPaymentProcessing(false)
                },
            })
        } catch { setPaymentError(t('Impossible d\'initialiser FedaPay')); setPaymentProcessing(false) }
    }

    const handleZeyow = () => {
        setPaymentProvider('zeyow')
        const redirectUrl = paymentSettings.zeyow_redirect_url
        if (!redirectUrl) { setPaymentError(t('Zeyow non configuré.')); return }
        window.location.href = `${redirectUrl}?amount=${amountXOF}&context=recherche-ancestrale&ref=${ref}`
    }

    const payHandlers: Record<PaymentProvider, () => void> = { kkiapay: handleKkiapay, fedapay: handleFedapay, zeyow: handleZeyow }

    const handleSubmit = async () => {
        if (!paymentDone) { setError(t('Veuillez effectuer le paiement')); return }
        setSubmitting(true); setError('')
        try {
            const res = await fetch('/api/nationality/recherche-ancestrale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ref,
                    payment_provider: paymentProvider,
                    payment_tx_id: paymentTxId,
                    amount: RESEARCH_PRICE,
                    amount_xof: amountXOF,
                }),
            })
            if (res.ok) {
                setSubmitted(true)
            } else {
                const d = await res.json()
                setError(d.error || 'Erreur lors de la confirmation')
            }
        } catch {
            // Échec APRÈS paiement : réarmer pour permettre un nouvel essai
            autoSubmitRef.current = false
            setError(t('Le paiement a bien été reçu, mais l\'enregistrement a échoué. Réessayez avec le bouton de confirmation — votre paiement est conservé.'))
        }
        setSubmitting(false)
    }

    // Filet de sécurité : enregistrement automatique dès que le paiement est
    // confirmé, sans dépendre d'un clic manuel (le webhook Kkiapay couvre en
    // plus le cas où le navigateur meurt avant même cet effet).
    useEffect(() => {
        if (paymentDone && !autoSubmitRef.current && !submitting && !submitted) {
            autoSubmitRef.current = true
            handleSubmit()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paymentDone])

    if (loading) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <Loader2 className="animate-spin text-[#008751]" size={36} />
        </div>
    )

    if (submitted) return (
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center max-w-md">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#008751]/30 to-[#FCD116]/20 border-2 border-[#008751]/40 flex items-center justify-center">
                    <CheckCircle2 size={36} className="text-[#008751]" />
                </div>
                <h1 className="text-3xl font-black text-gray-900 mb-3">Demande confirmée</h1>
                <p className="text-gray-500 text-sm mb-6">
                    Votre paiement a été reçu. Notre équipe va débuter la recherche de vos documents ancestraux dans les plus brefs délais. Vous recevrez une confirmation par email.
                </p>
                <p className="text-xs text-gray-400 mb-6 font-mono">Dossier : {ref}</p>
                <Link href="/suivi-dossier" className="bg-[#008751] hover:bg-[#00a36b] text-white font-black text-sm px-6 py-3 rounded-xl transition-all">
                    Suivre mon dossier
                </Link>
            </motion.div>
        </div>
    )

    return (
        <div className="min-h-screen bg-gray-50">
            {/* SDKs */}
            <div id="fedapay-ancestral-btn" className="hidden" />

            {/* Hero */}
            <section className="relative py-16 bg-gradient-to-br from-[#0f141e] via-[#1a2a3a] to-[#0f141e] text-white overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 right-20 w-64 h-64 rounded-full blur-[100px] bg-[#FCD116]" />
                    <div className="absolute bottom-10 left-20 w-48 h-48 rounded-full blur-[80px] bg-[#008751]" />
                </div>
                <div className="container mx-auto px-4 relative z-10">
                    <div className="flex items-center gap-2 text-sm text-white/50 mb-8 flex-wrap">
                        <Link href="/" className="hover:text-gray-900/80 transition-colors"><T>Accueil</T></Link>
                        <ChevronRight size={14} />
                        <Link href="/nationalite" className="hover:text-gray-900/80 transition-colors"><T>Nationalité</T></Link>
                        <ChevronRight size={14} />
                        <span className="text-[#FCD116]"><T>Recherche Ancestrale</T></span>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-4xl flex flex-col md:flex-row items-center gap-8"
                    >
                        <div className="shrink-0 drop-shadow-[0_0_30px_rgba(252,209,22,0.3)]">
                            <motion.div
                                className="w-28 h-28 md:w-36 md:h-36 relative"
                                animate={{ y: [0, -12, 0] }}
                                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <Image
                                    src="/assets/icones/Recherche Ancestrale.png"
                                    alt="Recherche Ancestrale"
                                    fill
                                    className="object-contain"
                                    sizes="144px"
                                />
                            </motion.div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[#FCD116]/70">Complément de dossier</span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold font-heading mb-3">
                                Déléguer ma{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#008751]">
                                    Recherche Ancestrale
                                </span>
                            </h1>
                            <p className="text-white/70 leading-relaxed max-w-xl">
                                Notre équipe mobilise archives officielles, bases de données spécialisées et associations expertes pour retrouver les actes manquants à votre dossier.
                            </p>
                        </div>
                    </motion.div>
                </div>
            </section>

            <div className="container mx-auto px-4 max-w-4xl py-12 space-y-8">

                {/* Référence dossier */}
                {ref && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center justify-between"
                    >
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Dossier rattaché</p>
                            <p className="text-lg font-black text-[#1a2332] font-mono">{ref}</p>
                            {applicantName && <p className="text-sm text-gray-500">{applicantName}</p>}
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-[#008751]/10 border border-[#008751]/20 flex items-center justify-center">
                            <CheckCircle2 size={18} className="text-[#008751]" />
                        </div>
                    </motion.div>
                )}

                {/* Docs ancestraux manquants */}
                {missingDocs.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-amber-50 border border-amber-200 rounded-2xl p-6"
                    >
                        <p className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-4">Documents ancestraux manquants dans votre dossier</p>
                        <div className="space-y-2">
                            {missingDocs.map((doc, i) => (
                                <div key={i} className="flex items-center gap-3 bg-white/60 rounded-xl p-3">
                                    <X size={14} className="text-amber-500 shrink-0" />
                                    <span className="text-sm text-amber-800">{doc.label}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-amber-600 mt-4 leading-relaxed">
                            Ces documents peuvent être difficiles à obtenir — surtout pour des ancêtres victimes de la traite transatlantique. Notre service prend en charge intégralement cette recherche.
                        </p>
                    </motion.div>
                )}

                {/* Pièces à fournir pour la RECHERCHE (liste distincte de la
                    demande de nationalité — ne pas confondre les deux) */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm"
                >
                    <div className="flex items-center gap-2 mb-1">
                        <FileText size={16} className="text-[#008751]" />
                        <p className="text-xs font-bold uppercase tracking-widest text-[#008751]">Pièces à fournir pour la recherche</p>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">Documents nécessaires au démarrage de la recherche généalogique (distincts de ceux de la demande de nationalité).</p>
                    <div className="space-y-2">
                        {[
                            "Extrait de naissance de vos deux parents (père et mère)",
                            "Extrait de naissance ou de décès de vos grands-parents (côté père et côté mère)",
                            "Tout autre document (acte de mariage, notarial, militaire, de décès) de vos grands-parents et arrière-grands-parents",
                        ].map((piece, i) => (
                            <div key={i} className="flex items-start gap-3 bg-[#008751]/5 border border-[#008751]/15 rounded-xl p-3">
                                <span className="w-5 h-5 rounded-full bg-[#008751] text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                <span className="text-sm text-[#1a2332]">{piece}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Méthodes */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                    {[
                        { icon: Archive, title: 'Archives officielles', desc: 'Registres paroissiaux, état civil, actes notariaux et archives coloniales françaises, américaines et caribéennes.', color: '#FCD116' },
                        { icon: Database, title: 'Bases de données', desc: 'Slave Voyages, FamilySearch, Ancestry et bases africaines spécialisées dans la généalogie diasporique.', color: '#008751' },
                        { icon: Users, title: 'Associations expertes', desc: 'Partenariats avec des associations spécialisées dans la généalogie afro-descendante.', color: '#E8112D' },
                    ].map((m, i) => (
                        <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: m.color + '18', border: `1px solid ${m.color}35` }}>
                                <m.icon size={18} style={{ color: m.color }} />
                            </div>
                            <h3 className="font-bold text-[#1a2332] mb-1 text-sm">{m.title}</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">{m.desc}</p>
                        </div>
                    ))}
                </motion.div>

                {/* Paiement */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
                >
                    <div className="h-1 w-full bg-gradient-to-r from-[#FCD116] to-[#008751]" />
                    <div className="p-6 space-y-6">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#008751] mb-1">Investissement</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-[#1a2332]">{RESEARCH_PRICE} €</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Recherche complète — archives, bases de données & associations spécialisées</p>
                        </div>

                        {paymentDone ? (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                                <CheckCircle2 size={28} className="text-emerald-500 mx-auto mb-2" />
                                <p className="text-sm font-bold text-emerald-700">Paiement effectué via {paymentProvider}</p>
                                {paymentTxId && <p className="text-[10px] text-gray-500 mt-1 font-mono">TX: {paymentTxId}</p>}
                            </div>
                        ) : paymentProcessing ? (
                            <div className="flex flex-col items-center py-6">
                                <Loader2 size={28} className="animate-spin text-[#FCD116]" />
                                <p className="text-sm text-gray-500 mt-3">Traitement en cours...</p>
                                <p className="text-xs text-gray-400 mt-2 text-center max-w-xs">{t('Finalisez le paiement dans la fenêtre sécurisée. Avec une carte bancaire hors zone UEMOA (Canada, Europe…), privilégiez le Mobile Money.')}</p>
                                <button
                                    type="button"
                                    onClick={() => { setPaymentProcessing(false); setPaymentError(t('Paiement annulé. Vous pouvez réessayer ou choisir un autre moyen de paiement.')) }}
                                    className="mt-4 text-xs font-bold text-gray-500 underline hover:text-[#008751]"
                                >
                                    {t('La fenêtre s\'est fermée ou reste bloquée ? Cliquez ici pour réessayer')}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-xs text-gray-500 font-bold">Sélectionnez votre moyen de paiement :</p>
                                {providers.length === 0 ? (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                                        <CreditCard size={20} className="text-gray-500 mx-auto mb-2" />
                                        <p className="text-xs text-amber-600">Aucune passerelle active. Contactez-nous directement.</p>
                                    </div>
                                ) : providers.map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={payHandlers[p.id]}
                                        className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-all group text-left"
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${p.color}`}><CreditCard size={18} /></div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-[#1a2332]">{p.name}</p>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">{p.subtitle}</p>
                                        </div>
                                        <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                                    </button>
                                ))}
                                {paymentError && (
                                    <p className="text-xs text-red-500 flex items-center gap-2">
                                        <AlertCircle size={12} /> {paymentError}
                                    </p>
                                )}
                                <PaymentPrivacyNotice />
                            </div>
                        )}

                        {error && (
                            <p className="text-xs text-red-500 flex items-center gap-2">
                                <AlertCircle size={12} /> {error}
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting || !paymentDone}
                            className="w-full bg-[#008751] hover:bg-[#00a36b] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#008751]/20"
                        >
                            {submitting ? <><Loader2 size={16} className="animate-spin" /> Confirmation...</> : !paymentDone ? 'Payez d\'abord' : 'Confirmer ma Recherche Ancestrale'}
                        </button>

                        <div className="flex items-center justify-center gap-2 text-gray-500">
                            <Shield size={12} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Transaction 100% sécurisée</span>
                        </div>
                    </div>
                </motion.div>

                {/* Retour */}
                <div className="text-center">
                    <Link href="/nationalite" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-400 transition-colors">
                        <ArrowLeft size={14} /> Retour à la page Nationalité
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default function ComplementAncestralPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="animate-spin text-[#008751]" size={36} />
            </div>
        }>
            <ComplementAncestralContent />
        </Suspense>
    )
}
