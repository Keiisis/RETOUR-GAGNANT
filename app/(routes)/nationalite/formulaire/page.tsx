'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Script from 'next/script'
import {
    ArrowLeft, ArrowRight, CheckCircle2,
    FileText, Send, ChevronLeft, Loader2, AlertCircle,
    CreditCard, Heart, Home, Shield, ChevronRight, X
} from 'lucide-react'
import Link from 'next/link'
import { Price, useCurrency } from '@/components/ui/Price'
import { CurrencyCode } from '@/lib/currency'

type PaymentProvider = 'kkiapay' | 'fedapay' | 'zeyow'

interface NationaliteForm {
    knows_about_law: boolean
    is_afro_descendant: boolean | null
    afro_descendant_description: string
    ancestor1_nom: string; ancestor1_prenom: string; ancestor1_date_naissance: string; ancestor1_lien_parente: string; ancestor1_vivant: boolean | null; ancestor1_nationalite: string; ancestor1_pays_residence: string; ancestor1_autres_infos: string
    ancestor2_nom: string; ancestor2_prenom: string; ancestor2_date_naissance: string; ancestor2_lien_parente: string; ancestor2_vivant: boolean | null; ancestor2_nationalite: string; ancestor2_pays_residence: string; ancestor2_autres_infos: string
    nom: string; prenom: string; genre: string; date_naissance: string; pays_naissance: string; ville_naissance: string; nationalite: string; pays_residence: string; adresse_residence: string; telephone: string; email: string; profession: string
    demande_depuis_benin: boolean
    type_document_identite: string; autorite_delivrance: string; numero_document: string; pays_delivrance: string; date_expiration_document: string; lieu_delivrance: string
    pere_nom: string; pere_prenom: string; pere_date_naissance: string
    mere_nom: string; mere_prenom: string; mere_date_naissance: string
}

declare global {
    interface Window {
        openKkiapayWidget: (config: Record<string, unknown>) => void
        addKkiapayListener: (event: string, callback: (data: Record<string, unknown>) => void) => void
        FedaPay: { init: (selector: string, config: Record<string, unknown>) => void }
    }
}

const STEPS = [
    { num: 1, label: 'Afro-descendance' },
    { num: 2, label: 'Infos personnelles' },
    { num: 3, label: 'Document & Parents' },
    { num: 4, label: 'Pièces jointes' },
    { num: 5, label: 'Paiement' },
    { num: 6, label: 'Récapitulatif' },
]

const COUNTRIES = ['Bénin', 'France', 'États-Unis', 'Brésil', 'Haïti', 'Canada', 'Royaume-Uni', 'Jamaïque', 'Trinidad et Tobago', 'Colombie', 'Cuba', 'Guadeloupe', 'Martinique', 'Guyane française', 'Suriname', 'Barbade', 'Bahamas', 'République Dominicaine', 'Porto Rico', 'Antigua-et-Barbuda', 'Allemagne', 'Belgique', 'Suisse', 'Pays-Bas', 'Italie', 'Espagne', 'Portugal', 'Ghana', 'Togo', 'Nigeria', 'Sénégal', 'Côte d\'Ivoire', 'Cameroun', 'Congo', 'Gabon', 'Mali', 'Burkina Faso', 'Guinée', 'Niger', 'Tchad', 'Autre']
const PROFESSIONS = ['Salarié(e)', 'Entrepreneur/Commerçant', 'Profession libérale', 'Étudiant(e)', 'Fonctionnaire', 'Retraité(e)', 'Artisan', 'Agriculteur', 'Artiste', 'Ingénieur', 'Médecin', 'Avocat', 'Enseignant', 'Sans emploi', 'Autre']
const GENRES = ['Masculin', 'Féminin', 'Non-binaire', 'Préfère ne pas préciser']
const LIENS = ['Père', 'Mère', 'Grand-père paternel', 'Grand-mère paternelle', 'Grand-père maternel', 'Grand-mère maternelle', 'Arrière-grand-père', 'Arrière-grand-mère', 'Autre']

const AnimatedBackground = ({ bgImageUrl }: { bgImageUrl: string }) => (
    <div className="fixed inset-0 w-full h-full z-0 overflow-hidden pointer-events-none bg-[#0a0f14]">
        <motion.div
            className="absolute inset-0 bg-cover bg-[center_top_10%] bg-no-repeat"
            style={{ backgroundImage: `url('${bgImageUrl}')` }}
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
                scale: { duration: 30, ease: "linear", repeat: Infinity, repeatType: "reverse" },
                opacity: { duration: 1.5 }
            }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#020b14]/60 via-[#061c13]/40 to-[#1a0808]/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
        <motion.div
            className="absolute top-1/4 left-[5%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-[#008751]/10 rounded-full blur-[100px]"
            animate={{ x: [0, 60, 0], y: [0, -40, 0], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
            className="absolute bottom-1/4 right-[5%] w-[30vw] h-[30vw] max-w-[400px] max-h-[400px] bg-[#FCD116]/10 rounded-full blur-[100px]"
            animate={{ x: [0, -50, 0], y: [0, 50, 0], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
    </div>
)

export default function NationaliteFormPage() {
    const [step, setStep] = useState(0)
    const [submitting, setSubmitting] = useState(false)
    const [showWelcome, setShowWelcome] = useState(false)
    const [appRef, setAppRef] = useState('')
    const [errors, setErrors] = useState<string[]>([])
    const [lawAccepted, setLawAccepted] = useState(false)
    const [paymentSettings, setPaymentSettings] = useState<Record<string, string>>({})
    const [paymentDone, setPaymentDone] = useState(false)
    const [paymentProvider, setPaymentProvider] = useState<PaymentProvider | null>(null)
    const [paymentTxId, setPaymentTxId] = useState('')
    const [paymentProcessing, setPaymentProcessing] = useState(false)
    const [paymentError, setPaymentError] = useState('')

    const [rawDocs, setRawDocs] = useState<{ label: string, name: string, file: File }[]>([])
    const [uploadProgress, setUploadProgress] = useState(0)
    const [requiredDocs, setRequiredDocs] = useState<{ label: string, multi: boolean, hint?: string }[]>([
        { label: 'Pièce d\'identité en cours de validité', multi: false },
        { label: 'Justificatif de domicile', multi: false },
        { label: 'Preuve de profession', multi: false },
        { label: 'Preuve d\'afro descendance', multi: true, hint: 'Vous pouvez charger plusieurs documents ici !' },
        { label: 'Casier judiciaire ou Certificat d\'antécédents criminels', multi: false },
    ])
    const [bgImageUrl, setBgImageUrl] = useState<string>('/images/bg-default-afro.jpg')
    const [formAmount, setFormAmount] = useState(250)
    const [formCurrency, setFormCurrency] = useState<CurrencyCode>('USD')
    const { format: formatUserPrice } = useCurrency()

    const [form, setForm] = useState({
        knows_about_law: false, is_afro_descendant: true, afro_descendant_description: '',
        ancestor1_nom: '', ancestor1_prenom: '', ancestor1_date_naissance: '', ancestor1_lien_parente: '',
        ancestor1_vivant: true, ancestor1_nationalite: '', ancestor1_pays_residence: '', ancestor1_autres_infos: '',
        ancestor2_nom: '', ancestor2_prenom: '', ancestor2_date_naissance: '', ancestor2_lien_parente: '',
        ancestor2_vivant: true, ancestor2_nationalite: '', ancestor2_pays_residence: '', ancestor2_autres_infos: '',
        nom: '', prenom: '', genre: '', date_naissance: '', pays_naissance: '', ville_naissance: '',
        nationalite: '', pays_residence: '', adresse_residence: '', telephone: '', email: '', profession: '',
        demande_depuis_benin: false,
        type_document_identite: '', numero_document: '', date_expiration_document: '',
        pays_delivrance: '', lieu_delivrance: '', autorite_delivrance: '',
        pere_nom: '', pere_prenom: '', pere_date_naissance: '',
        mere_nom: '', mere_prenom: '', mere_date_naissance: '',
    })

    const [particles] = useState(() => Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        width: Math.random() * 8 + 2,
        height: Math.random() * 8 + 2,
        bg: ['#008751', '#FCD116', '#E8112D'][i % 3],
        left: Math.random() * 100,
        top: Math.random() * 100,
        duration: 3 + Math.random() * 4,
        delay: Math.random() * 3
    })))

    useEffect(() => {
        fetch('/api/settings/payment').then(r => r.json()).then(d => setPaymentSettings(d)).catch(() => { })
        supabase.from('nationality_page_content').select('content_fr').eq('section_key', 'form_bg_image').single()
            .then(({ data }) => { if (data?.content_fr) setBgImageUrl(data.content_fr) })
        // Fetch dynamic amount and documents from admin settings
        supabase.from('page_sections').select('content').eq('page', 'nationalite').eq('section_key', 'form_settings').single()
            .then(({ data }) => {
                if (data?.content) {
                    const c = data.content as Record<string, any>
                    if (c.amount) setFormAmount(Number(c.amount))
                    if (c.currency) setFormCurrency(c.currency as CurrencyCode)
                    if (c.required_documents && Array.isArray(c.required_documents)) {
                        setRequiredDocs(c.required_documents)
                    }
                }
            })
    }, [])

    const u = useCallback((key: keyof NationaliteForm, val: any) => setForm(p => ({ ...p, [key]: val })), [])
    const IC = "w-full bg-white/[0.04] border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 placeholder:text-gray-600 transition-all"
    const LC = "text-xs font-bold text-gray-400 mb-1.5 block"
    const RQ = "text-red-400 ml-0.5"

    // Payment providers from existing settings
    const providers = [
        { id: 'kkiapay' as PaymentProvider, name: 'Kkiapay', subtitle: 'Mobile Money / Carte', color: 'bg-[#4A90D9]/20 border-[#4A90D9]/40 text-[#4A90D9]', isReady: paymentSettings.kkiapay_enabled === 'true' && !!paymentSettings.kkiapay_public_key },
        { id: 'fedapay' as PaymentProvider, name: 'FedaPay', subtitle: 'Mobile Money / Carte', color: 'bg-[#2ECC71]/20 border-[#2ECC71]/40 text-[#2ECC71]', isReady: paymentSettings.fedapay_enabled === 'true' && !!paymentSettings.fedapay_public_key },
        { id: 'zeyow' as PaymentProvider, name: 'Zeyow', subtitle: 'Carte Virtuelle', color: 'bg-[#FF6B35]/20 border-[#FF6B35]/40 text-[#FF6B35]', isReady: paymentSettings.zeyow_enabled === 'true' && !!paymentSettings.zeyow_redirect_url },
    ].filter(p => p.isReady)

    const handleKkiapay = () => {
        if (!process.env.NEXT_PUBLIC_SITE_URL && window.location.hostname === 'localhost') {
            // Bypass logic for local dev without exact webhooks if needed (but user asked for no sim, so we keep real)
        }
        setPaymentProcessing(true); setPaymentError(''); setPaymentProvider('kkiapay')
        try {
            window.openKkiapayWidget({
                amount: formAmount, position: 'center', key: paymentSettings.kkiapay_public_key,
                sandbox: paymentSettings.kkiapay_sandbox === 'true', phone: form.telephone,
                data: { context: 'nationality', email: form.email },
            })
            window.addKkiapayListener('success', (response) => {
                setPaymentTxId(String(response.transactionId || '')); setPaymentDone(true); setPaymentProcessing(false)
            })
            window.addKkiapayListener('failed', () => {
                setPaymentError('Le paiement Kkiapay a échoué.'); setPaymentProcessing(false)
            })
            // handle widget close manually if needed
        } catch { setPaymentError('Impossible d\'ouvrir Kkiapay'); setPaymentProcessing(false) }
    }

    const handleFedapay = () => {
        setPaymentProcessing(true); setPaymentError(''); setPaymentProvider('fedapay')
        try {
            window.FedaPay.init('#fedapay-nat-btn', {
                public_key: paymentSettings.fedapay_public_key,
                environment: paymentSettings.fedapay_sandbox === 'true' ? 'sandbox' : 'live',
                transaction: { amount: formAmount, description: `Reconnaissance Nationalité — ${form.prenom} ${form.nom}` },
                customer: { email: form.email || undefined, phone_number: { number: form.telephone } },
                onComplete: (resp: Record<string, unknown>) => {
                    const tx = resp.transaction as Record<string, unknown> | undefined
                    if (resp.reason === 'APPROVED' || (tx && tx.status === 'approved')) {
                        setPaymentTxId(String(tx?.id || resp.id || '')); setPaymentDone(true)
                    } else { setPaymentError('Paiement FedaPay non approuvé.') }
                    setPaymentProcessing(false)
                },
            })
        } catch { setPaymentError('Impossible d\'initialiser FedaPay'); setPaymentProcessing(false) }
    }

    const handleZeyow = () => {
        setPaymentProvider('zeyow')
        const redirectUrl = paymentSettings.zeyow_redirect_url
        if (!redirectUrl) { setPaymentError('Zeyow non configuré.'); return }
        window.location.href = `${redirectUrl}?amount=${formAmount}&phone=${form.telephone}&email=${form.email}&context=nationality`
    }

    const payHandlers: Record<PaymentProvider, () => void> = { kkiapay: handleKkiapay, fedapay: handleFedapay, zeyow: handleZeyow }

    const validate = (): string[] => {
        const e: string[] = []
        if (step === 1) {
            if (!form.afro_descendant_description) e.push('Décrivez votre afro-descendance')
            if (!form.ancestor1_nom) e.push('Nom de l\'ancêtre 1 requis')
            if (!form.ancestor1_lien_parente) e.push('Lien de parenté requis')
        }
        if (step === 2) {
            if (!form.nom) e.push('Nom requis')
            if (!form.prenom) e.push('Prénom requis')
            if (!form.email) e.push('Email requis')
            if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.push('Email invalide')
            if (!form.genre) e.push('Genre requis')
            if (!form.date_naissance) e.push('Date de naissance requise')
            if (!form.pays_residence) e.push('Pays de résidence requis')
        }
        if (step === 3 && !form.type_document_identite) e.push('Type de document requis')
        if (step === 4) {
            const req = requiredDocs.map(d => d.label)
            const uploaded = rawDocs.map(d => d.label)
            req.forEach(l => { if (!uploaded.includes(l)) e.push(`Document manquant : ${l}`) })
        }
        if (step === 5 && !paymentDone) e.push('Veuillez effectuer le paiement avant de continuer')
        return e
    }

    const next = () => { const e = validate(); if (e.length > 0) { setErrors(e); return }; setErrors([]); setStep(s => Math.min(s + 1, 6)) }
    const prev = () => { setErrors([]); setStep(s => Math.max(s - 1, 1)) }

    const submit = async () => {
        setSubmitting(true)
        setUploadProgress(10)
        const ref = `RG-NAT-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`

        const finalUploadedUrls: string[] = []

        // Upload documents
        for (let i = 0; i < rawDocs.length; i++) {
            const doc = rawDocs[i]
            const ext = doc.file.name.split('.').pop()
            const filename = `${ref}/${doc.label.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${ext}`
            const { data, error } = await supabase.storage.from('nationality_documents').upload(filename, doc.file)
            if (data && !error) {
                finalUploadedUrls.push(`${doc.label}: ${filename}`)
            } else {
                finalUploadedUrls.push(`${doc.label}: [Erreur upload] ${doc.name}`)
            }
            setUploadProgress(10 + Math.floor((i + 1) / rawDocs.length * 40))
        }

        const { error } = await supabase.from('nationality_applications').insert({
            ...form, documents_uploaded: finalUploadedUrls, application_ref: ref, status: 'soumis', submitted_at: new Date().toISOString(),
            last_step_completed: 6, payment_method: paymentProvider || 'none',
            payment_ref: paymentTxId, payment_status: paymentDone ? 'en_attente' : 'non_paye',
            amount: formAmount, currency: formCurrency,
        })
        setUploadProgress(100)
        if (!error) {
            setAppRef(ref)
            try {
                await fetch('/api/email/send', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: form.email, subject: `Retour Gagnant Bénin — Demande ${ref} reçue`,
                        message: `Bonjour ${form.prenom} ${form.nom},\n\nVotre demande de reconnaissance de nationalité béninoise a été enregistrée sous la référence :\n\n${ref}\n\nNotre équipe va examiner votre dossier et vérifier votre paiement.\n\nBienvenue chez vous.\n\nL'équipe Retour Gagnant Bénin`,
                        clientName: `${form.prenom} ${form.nom}`, context: 'nationality_application', relatedId: ref
                    })
                })
            } catch { }
            setShowWelcome(true)
        }
        setSubmitting(false)
    }

    // ═══ WELCOME HOME ANIMATION ═══
    if (showWelcome) return (
        <div className="min-h-screen bg-[#0a0f14] flex items-center justify-center px-4 overflow-hidden relative">
            {particles.map((p) => (
                <motion.div key={p.id} className="absolute rounded-full"
                    style={{ width: p.width, height: p.height, background: p.bg, left: `${p.left}%`, top: `${p.top}%` }}
                    animate={{ y: [0, -200, 0], opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                    transition={{ duration: p.duration, repeat: Infinity, delay: p.delay }} />
            ))}
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', duration: 1 }} className="relative z-10 text-center max-w-lg">
                <motion.div className="absolute -inset-20 bg-gradient-to-r from-[#008751]/20 via-[#FCD116]/10 to-[#E8112D]/20 rounded-full blur-3xl" animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 3, repeat: Infinity }} />
                <motion.div initial={{ y: 30 }} animate={{ y: 0 }} transition={{ delay: 0.3 }} className="relative">
                    <motion.div className="w-24 h-24 mx-auto mb-6 relative" animate={{ rotateY: [0, 360] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#008751] via-[#FCD116] to-[#E8112D] opacity-30 blur-xl" />
                        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#008751]/30 to-[#FCD116]/30 border-2 border-[#FCD116]/30 flex items-center justify-center"><Home size={36} className="text-[#FCD116]" /></div>
                    </motion.div>
                    <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
                        Bienvenue<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]">Chez Vous</span>
                    </motion.h1>
                    <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }} className="text-gray-400 text-sm mb-2">Votre demande a été enregistrée avec succès</motion.p>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1, type: 'spring' }} className="inline-block bg-white/5 backdrop-blur-xl border border-[#FCD116]/20 rounded-2xl px-6 py-3 mb-6">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Référence</p>
                        <p className="text-xl font-mono font-black text-[#FCD116]">{appRef}</p>
                    </motion.div>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} className="text-xs text-gray-500 mb-8">Confirmation envoyée à <span className="text-emerald-400">{form.email}</span></motion.p>
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.5 }} className="space-y-3">
                        <p className="text-xs text-gray-600 italic max-w-sm mx-auto">&quot;La terre de vos ancêtres vous attend les bras ouverts. Ce n&apos;est pas un retour, c&apos;est une renaissance.&quot;</p>
                        <div className="flex items-center justify-center gap-1 text-[10px] text-gray-600"><Heart size={10} className="text-[#E8112D]" /> Retour Gagnant Bénin</div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link href="/nationalite" className="bg-white/10 hover:bg-white/15 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all">Retour à la page</Link>
                        <Link href="/" className="text-xs text-gray-500 hover:text-white transition-colors">Accueil</Link>
                    </motion.div>
                </motion.div>
            </motion.div>
        </div>
    )

    // ═══ LAW POPUP ═══

    // ═══ LAW POPUP ═══
    if (step === 0) return (
        <div className="min-h-screen relative flex items-center justify-center px-4">
            <AnimatedBackground bgImageUrl={bgImageUrl} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 bg-[#0b1411]/80 backdrop-blur-2xl border border-emerald-500/20 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-3xl p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto">
                <h2 className="text-xl font-black text-white text-center mb-2">Savez-vous ce qu&apos;est la reconnaissance de la nationalité aux afro-descendants en République du Bénin ?</h2>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-400 mb-4 text-center">Lisez et cochez la mention &quot;J&apos;ai lu et compris&quot; pour poursuivre</div>
                <div className="text-sm text-gray-300 leading-relaxed space-y-3 mb-6">
                    <p>La reconnaissance de la nationalité béninoise aux afrodescendants est un acte de mémoire, de justice et une porte ouverte vers le retour aux racines des descendants des Africains déportés lors de la traite négrière transatlantique, comme membres légitimes de la Nation béninoise.</p>
                    <p>La loi 2024-31 du 02 Septembre 2024 portant reconnaissance de la nationalité béninoise aux afro-descendants organise en ce sens un mode d&apos;acquisition de la nationalité béninoise par toute personne qui d&apos;après sa généalogie, a un ascendant africain subsaharien déporté hors du continent africain dans le cadre de la traite des noirs et du commerce triangulaire.</p>
                    <p className="font-bold text-white">La loi s&apos;adresse à l&apos;afro-descendant :</p>
                    <ul className="list-disc pl-5 space-y-1"><li>âgé d&apos;au moins 18 ans,</li><li>résidant hors du continent africain,</li><li>et pouvant établir sa filiation avec un ascendant africain subsaharien victime de la traite négrière.</li></ul>
                    <p><span className="font-bold text-white">La preuve de l&apos;afro-descendance peut être apportée par :</span> des actes d&apos;état civil, des certificats officiels, des tests d&apos;ADN génétiques, des actes notariés, des arbres généalogiques, des extraits d&apos;archives historiques, et tout autre document probant.</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer mb-6 bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-4">
                    <input type="checkbox" checked={lawAccepted} onChange={e => setLawAccepted(e.target.checked)} className="w-5 h-5 accent-emerald-500" />
                    <span className="text-sm font-bold text-emerald-400">J&apos;ai lu et compris</span>
                </label>
                <div className="flex gap-3">
                    <Link href="/nationalite" className="flex-1 bg-white/5 text-gray-300 hover:text-white font-bold text-sm py-3 rounded-xl text-center hover:bg-white/10 transition-all backdrop-blur-md">Retour</Link>
                    <button onClick={() => { if (lawAccepted) { u('knows_about_law', true); setStep(1) } }} disabled={!lawAccepted} className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black text-sm py-3 rounded-xl disabled:opacity-30 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">Continuer <ArrowRight size={16} /></button>
                </div>
            </motion.div>
        </div>
    )

    return (
        <div className="min-h-screen relative py-8 px-4 overflow-hidden">
            <AnimatedBackground bgImageUrl={bgImageUrl} />

            {/* Payment SDKs */}
            <Script src="https://cdn.kkiapay.me/k.js" strategy="lazyOnload" />
            <Script src="https://cdn.fedapay.com/checkout.js?v=1.1.7" strategy="lazyOnload" />
            <div id="fedapay-nat-btn" className="hidden" />

            <div className="relative z-10 max-w-3xl mx-auto">
                <div className="text-center mb-6">
                    <Link href="/nationalite" className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-white mb-3 transition-colors bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/5"><ChevronLeft size={14} /> Retour à l&apos;accueil</Link>
                    <h1 className="text-3xl md:text-4xl font-black text-white drop-shadow-lg">Reconnaissance de Nationalité</h1>
                    <p className="text-sm text-gray-300 mt-2 font-medium">Veuillez remplir le formulaire ci-dessous</p>
                </div>

                {/* Progress */}
                <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
                    {STEPS.map((s, i) => (
                        <div key={s.num} className="flex items-center">
                            <div className={`flex items-center gap-1.5 shrink-0 ${step >= s.num ? 'text-emerald-400' : 'text-gray-600'}`}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${step > s.num ? 'bg-emerald-500 text-white' : step === s.num ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400' : 'bg-white/5 border border-white/10'}`}>{step > s.num ? <CheckCircle2 size={12} /> : s.num}</div>
                                <span className="text-[9px] font-bold uppercase tracking-wider hidden lg:block whitespace-nowrap">{s.label}</span>
                            </div>
                            {i < 5 && <div className={`w-6 lg:w-12 h-px mx-1.5 ${step > s.num ? 'bg-emerald-500/50' : 'bg-white/10'}`} />}
                        </div>
                    ))}
                </div>

                {errors.length > 0 && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">{errors.map((e, i) => <p key={i} className="text-xs text-red-400 flex items-center gap-2"><AlertCircle size={12} /> {e}</p>)}</div>}

                <AnimatePresence mode="wait">
                    <motion.div key={step} initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.05, y: -10 }} transition={{ duration: 0.3, ease: "easeOut" }} className="bg-[#0b1411]/80 backdrop-blur-2xl border border-emerald-500/20 shadow-[0_0_50px_rgba(0,0,0,0.5)] shadow-emerald-900/20 rounded-3xl p-6 md:p-8 relative overflow-hidden">
                        {/* Shimmer effect inside card */}
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-amber-500/5 pointer-events-none" />

                        {submitting && (
                            <div className="absolute inset-x-0 top-0 h-1 bg-white/5 overflow-hidden z-50">
                                <motion.div
                                    className="h-full bg-emerald-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        )}

                        <div className="relative z-10">

                            {step === 1 && <div className="space-y-5">
                                <h2 className="text-lg font-black text-white">Votre identification Afro-descendante</h2>
                                <div><label className={LC}>Êtes-vous afro-descendant(e) ?<span className={RQ}>*</span></label><div className="flex gap-3 mt-1">{[true, false].map(v => <button key={String(v)} onClick={() => u('is_afro_descendant', v)} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${form.is_afro_descendant === v ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400' : 'bg-white/5 border border-white/10 text-gray-500'}`}>{v ? 'Oui' : 'Non'}</button>)}</div></div>
                                <div><label className={LC}>Comment êtes-vous afro-descendant(e) ?<span className={RQ}>*</span></label><textarea rows={4} value={form.afro_descendant_description} onChange={e => u('afro_descendant_description', e.target.value)} placeholder="Décrivez en quelques mots votre ascendance..." className={IC + ' resize-none'} /></div>
                                <div className="border-t border-white/5 pt-5"><h3 className="text-sm font-black text-white mb-4">Informations sur vos ancêtres</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{[1, 2].map(n => {
                                        const f = form as Record<string, any>
                                        return (
                                            <div key={n} className="space-y-3">
                                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">{n === 1 ? '1ère' : '2ème'} Personne</span>
                                                <div><label className={LC}>Nom{n === 1 && <span className={RQ}>*</span>}</label><input title={`Nom Ancêtre ${n}`} value={f[`ancestor${n}_nom`] || ''} onChange={e => u(`ancestor${n}_nom` as any, e.target.value)} className={IC} placeholder="Nom" /></div>
                                                <div><label className={LC}>Prénom(s)</label><input title={`Prénom Ancêtre ${n}`} value={f[`ancestor${n}_prenom`] || ''} onChange={e => u(`ancestor${n}_prenom` as any, e.target.value)} className={IC} placeholder="Prénom(s)" /></div>
                                                <div><label className={LC}>Date de naissance</label><input title={`Date de naissance Ancêtre ${n}`} type="date" value={f[`ancestor${n}_date_naissance`] || ''} onChange={e => u(`ancestor${n}_date_naissance` as any, e.target.value)} className={IC} /></div>
                                                <div><label className={LC}>Lien de parenté{n === 1 && <span className={RQ}>*</span>}</label><select title={`Lien de parenté Ancêtre ${n}`} value={f[`ancestor${n}_lien_parente`] || ''} onChange={e => u(`ancestor${n}_lien_parente` as any, e.target.value)} className={IC}><option value="">Choisir</option>{LIENS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                                                <div><label className={LC}>Vivant(e) ?</label><div className="flex gap-2">{[true, false].map(v => <button title={v ? 'Oui' : 'Non'} key={String(v)} onClick={() => u(`ancestor${n}_vivant` as any, v)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${f[`ancestor${n}_vivant`] === v ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400' : 'bg-white/5 border border-white/10 text-gray-500'}`}>{v ? 'Oui' : 'Non'}</button>)}</div></div>
                                                <div><label className={LC}>Nationalité</label><select title={`Nationalité Ancêtre ${n}`} value={f[`ancestor${n}_nationalite`] || ''} onChange={e => u(`ancestor${n}_nationalite` as any, e.target.value)} className={IC}><option value="">Pays</option>{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                                <div><label className={LC}>Pays de résidence</label><select title={`Pays de résidence Ancêtre ${n}`} value={f[`ancestor${n}_pays_residence`] || ''} onChange={e => u(`ancestor${n}_pays_residence` as any, e.target.value)} className={IC}><option value="">Pays</option>{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                                <div><label className={LC}>Autres informations</label><textarea title={`Autres informations Ancêtre ${n}`} rows={2} value={f[`ancestor${n}_autres_infos`] || ''} onChange={e => u(`ancestor${n}_autres_infos` as any, e.target.value)} className={IC + ' resize-none'} placeholder="Informations complémentaires..." /></div>
                                            </div>
                                        )
                                    })}</div>
                                </div>
                            </div>}

                            {step === 2 && <div className="space-y-5">
                                <h2 className="text-lg font-black text-white">Informations Personnelles</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className={LC}>Nom<span className={RQ}>*</span></label><input title="Votre Nom" value={form.nom} onChange={e => u('nom', e.target.value)} className={IC} placeholder="Nom de famille" /></div>
                                    <div><label className={LC}>Prénom(s)<span className={RQ}>*</span></label><input title="Votre Prénom" value={form.prenom} onChange={e => u('prenom', e.target.value)} className={IC} placeholder="Prénom(s)" /></div>
                                    <div><label className={LC}>Genre<span className={RQ}>*</span></label><select title="Genre" value={form.genre} onChange={e => u('genre', e.target.value)} className={IC}><option value="">Choisir</option>{GENRES.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                                    <div><label className={LC}>Date de naissance<span className={RQ}>*</span></label><input title="Date de naissance" type="date" value={form.date_naissance} onChange={e => u('date_naissance', e.target.value)} className={IC} /></div>
                                    <div><label className={LC}>Pays de naissance</label><select title="Pays de naissance" value={form.pays_naissance} onChange={e => u('pays_naissance', e.target.value)} className={IC}><option value="">Pays</option>{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                    <div><label className={LC}>Ville de naissance</label><input title="Ville de naissance" value={form.ville_naissance} onChange={e => u('ville_naissance', e.target.value)} className={IC} placeholder="Ville" /></div>
                                    <div><label className={LC}>Nationalité<span className={RQ}>*</span></label><select title="Nationalité" value={form.nationalite} onChange={e => u('nationalite', e.target.value)} className={IC}><option value="">Pays</option>{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                    <div><label className={LC}>Pays de résidence<span className={RQ}>*</span></label><select title="Pays de résidence" value={form.pays_residence} onChange={e => u('pays_residence', e.target.value)} className={IC}><option value="">Pays</option>{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                    <div className="md:col-span-2"><label className={LC}>Adresse complète</label><input title="Adresse" value={form.adresse_residence} onChange={e => u('adresse_residence', e.target.value)} className={IC} placeholder="Adresse" /></div>
                                    <div><label className={LC}>Téléphone</label><input title="Téléphone" value={form.telephone} onChange={e => u('telephone', e.target.value)} className={IC} placeholder="+229 XX XX XX XX" /></div>
                                    <div><label className={LC}>Email<span className={RQ}>*</span></label><input title="Email" type="email" value={form.email} onChange={e => u('email', e.target.value)} className={IC} placeholder="email@exemple.com" /></div>
                                    <div><label className={LC}>Profession</label><select title="Profession" value={form.profession} onChange={e => u('profession', e.target.value)} className={IC}><option value="">Choisir</option>{PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                                </div>
                                <div className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl p-4">
                                    <button title="Demande depuis le Bénin ?" onClick={() => u('demande_depuis_benin', !form.demande_depuis_benin)} className={`w-12 h-6 rounded-full transition-all relative ${form.demande_depuis_benin ? 'bg-emerald-500' : 'bg-white/10'}`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${form.demande_depuis_benin ? 'left-6' : 'left-0.5'}`} /></button>
                                    <span className="text-sm text-gray-400">Demande depuis le Bénin ?</span>
                                </div>
                            </div>}

                            {step === 3 && <div className="space-y-5">
                                <h2 className="text-lg font-black text-white">Document d&apos;identité &amp; Parents</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className={LC}>Type de document<span className={RQ}>*</span></label><select title="Type de document d&apos;identité" value={form.type_document_identite} onChange={e => u('type_document_identite', e.target.value)} className={IC}><option value="">Choisir</option><option value="passeport">Passeport</option><option value="cni">CNI</option><option value="carte_electeur">Carte d&apos;électeur</option><option value="autre">Autre</option></select></div>
                                    <div><label className={LC}>Autorité de délivrance</label><input title="Autorité de délivrance" value={form.autorite_delivrance} onChange={e => u('autorite_delivrance', e.target.value)} className={IC} /></div>
                                    <div><label className={LC}>Numéro du document</label><input title="Numéro du document" value={form.numero_document} onChange={e => u('numero_document', e.target.value)} className={IC} /></div>
                                    <div><label className={LC}>Pays de délivrance</label><select title="Pays de délivrance" value={form.pays_delivrance} onChange={e => u('pays_delivrance', e.target.value)} className={IC}><option value="">Pays</option>{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                    <div><label className={LC}>Date d&apos;expiration</label><input title="Date d&apos;expiration" type="date" value={form.date_expiration_document} onChange={e => u('date_expiration_document', e.target.value)} className={IC} /></div>
                                    <div><label className={LC}>Lieu de délivrance</label><input title="Lieu de délivrance" value={form.lieu_delivrance} onChange={e => u('lieu_delivrance', e.target.value)} className={IC} /></div>
                                </div>
                                <div className="border-t border-white/5 pt-5"><h3 className="text-sm font-black text-white mb-4">Informations sur vos parents</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{['Père', 'Mère'].map(p => {
                                        const k = p === 'Père' ? 'pere' : 'mere';
                                        const f = form as Record<string, any>
                                        return (
                                            <div key={p} className="space-y-3">
                                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">{p}</span>
                                                <div><label className={LC}>Nom</label><input title={`Nom du ${p}`} value={f[`${k}_nom`] || ''} onChange={e => u(`${k}_nom` as any, e.target.value)} className={IC} placeholder="Nom" /></div>
                                                <div><label className={LC}>Prénom(s)</label><input title={`Prénom du ${p}`} value={f[`${k}_prenom`] || ''} onChange={e => u(`${k}_prenom` as any, e.target.value)} className={IC} placeholder="Prénom(s)" /></div>
                                                <div><label className={LC}>Date de naissance</label><input title={`Date de naissance du ${p}`} type="date" value={f[`${k}_date_naissance`] || ''} onChange={e => u(`${k}_date_naissance` as any, e.target.value)} className={IC} /></div>
                                            </div>
                                        )
                                    })}</div></div>
                            </div>}

                            {step === 4 && <div className="space-y-4">
                                <h2 className="text-lg font-black text-white">Pièces à joindre</h2>
                                <p className="text-xs text-gray-500">Formats : PNG, JPG, JPEG, PDF. Taille max : 5 Mo.</p>
                                {requiredDocs.map((doc, i) => (
                                    <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-5 flex items-center justify-between hover:border-emerald-500/20 transition-all">
                                        <div className="flex items-center gap-4"><FileText size={18} className="text-emerald-400/60" /><div><span className="text-sm text-white">{doc.label}<span className="text-red-400 ml-1">*</span></span>{doc.hint && <p className="text-[10px] text-gray-600">{doc.hint}</p>}</div></div>
                                        <label className="cursor-pointer shrink-0"><div className="text-right"><p className="text-[10px] text-gray-600">Glisser déposer ou</p><p className="text-xs font-bold text-emerald-400">{doc.multi ? 'CHOISIR FICHIER(S)' : 'CHOISIR UN FICHIER'}</p></div>
                                            <input title={doc.label} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" multiple={doc.multi} onChange={e => { const f = e.target.files; if (f) { const newDocs = Array.from(f).map(fi => ({ label: doc.label, name: fi.name, file: fi })); setRawDocs(p => [...p, ...newDocs]) } }} />
                                        </label>
                                    </div>
                                ))}
                                {rawDocs.length > 0 && <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 space-y-1.5">{rawDocs.map((d, i) => <div key={i} className="text-xs text-emerald-400 flex items-center justify-between"><span className="flex items-center gap-2"><CheckCircle2 size={12} /> {d.label}: {d.name}</span><button title="Supprimer ce document" onClick={() => setRawDocs(p => p.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-400 p-1"><X size={12} /></button></div>)}</div>}
                            </div>}

                            {step === 5 && <div className="space-y-5">
                                <h2 className="text-lg font-black text-white">Paiement des frais de traitement</h2>
                                <div className="bg-gradient-to-r from-emerald-900/20 to-yellow-900/10 border border-emerald-500/10 rounded-2xl p-6 text-center">
                                    <p className="text-3xl font-black text-[#FCD116]"><Price amount={formAmount} currency={formCurrency} showOriginal /></p>
                                    <p className="text-xs text-gray-500 mt-1">Frais de traitement de dossier</p>
                                </div>

                                {paymentDone ? (
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 text-center">
                                        <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                                        <p className="text-sm font-bold text-emerald-400">Paiement effectué via {paymentProvider}</p>
                                        {paymentTxId && <p className="text-[10px] text-gray-500 mt-1 font-mono">TX: {paymentTxId}</p>}
                                    </div>
                                ) : paymentProcessing ? (
                                    <div className="flex flex-col items-center py-8"><Loader2 size={32} className="animate-spin text-[#FCD116]" /><p className="text-sm text-gray-400 mt-3">Traitement en cours...</p></div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-xs text-gray-400 font-bold">Sélectionnez votre moyen de paiement :</p>
                                        {providers.length === 0 ? (
                                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center"><CreditCard size={24} className="text-gray-600 mx-auto mb-2" /><p className="text-xs text-amber-400">Aucune passerelle de paiement active. Contactez l&apos;administrateur.</p></div>
                                        ) : providers.map(p => (
                                            <button key={p.id} title={`Payer avec ${p.name}`} onClick={payHandlers[p.id]} className={`w-full flex items-center gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all group text-left`}>
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border ${p.color}`}><CreditCard size={22} /></div>
                                                <div className="flex-1"><p className="text-sm font-bold text-white group-hover:text-[#FCD116] transition-colors">{p.name}</p><p className="text-[10px] text-gray-500 uppercase tracking-widest">{p.subtitle}</p></div>
                                                <ChevronRight size={18} className="text-gray-600 group-hover:text-white transition-colors" />
                                            </button>
                                        ))}
                                        {paymentError && <p className="text-xs text-red-400 flex items-center gap-2"><AlertCircle size={12} /> {paymentError}</p>}
                                        <div className="flex items-center gap-2 text-gray-600 justify-center mt-2"><Shield size={14} /><span className="text-[10px] font-bold uppercase tracking-widest">Transaction 100% sécurisée</span></div>
                                    </div>
                                )}
                            </div>}

                            {step === 6 && <div className="space-y-5">
                                <h2 className="text-lg font-black text-white">Récapitulatif de votre demande</h2>
                                {[
                                    { title: 'Identité', items: [['Nom complet', `${form.prenom} ${form.nom}`], ['Genre', form.genre], ['Né(e) le', form.date_naissance], ['Nationalité', form.nationalite], ['Résidence', form.pays_residence], ['Email', form.email], ['Profession', form.profession]] },
                                    { title: 'Afro-descendance', items: [['Description', form.afro_descendant_description], ['Ancêtre 1', `${form.ancestor1_prenom} ${form.ancestor1_nom} — ${form.ancestor1_lien_parente}`]] },
                                    { title: 'Document', items: [['Type', form.type_document_identite], ['Numéro', form.numero_document]] },
                                    { title: 'Parents', items: [['Père', `${form.pere_prenom} ${form.pere_nom}`], ['Mère', `${form.mere_prenom} ${form.mere_nom}`]] },
                                    { title: 'Paiement', items: [['Montant', formatUserPrice(formAmount, formCurrency)], ['Passerelle', paymentProvider || 'N/A'], ['Transaction', paymentTxId || 'N/A']] },
                                ].map((sec, si) => (
                                    <div key={si} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                        <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2">{sec.title}</h3>
                                        {sec.items.filter(([, v]) => v).map(([k, v], i) => <div key={i} className="flex justify-between py-1 border-b border-white/[0.03] last:border-0"><span className="text-xs text-gray-500">{k}</span><span className="text-xs text-white font-bold text-right max-w-[60%]">{v}</span></div>)}
                                    </div>
                                ))}
                            </div>}
                        </div>
                    </motion.div>
                </AnimatePresence>

                <div className="flex items-center justify-between mt-6">
                    {step > 1 ? <button onClick={prev} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors font-bold"><ArrowLeft size={16} /> Précédent</button> : <div />}
                    {step < 6 ? (
                        <button onClick={next} className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.2)]">Suivant <ArrowRight size={16} /></button>
                    ) : (
                        <button onClick={submit} disabled={submitting} className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black text-sm px-8 py-3 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                            {submitting ? <><Loader2 size={16} className="animate-spin" /> Envoi...</> : <><Send size={16} /> Confirmer et Soumettre</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
