'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/compress-image'
import Script from 'next/script'
import {
    ArrowLeft, ArrowRight, CheckCircle2,
    FileText, Send, ChevronLeft, Loader2, AlertCircle,
    CreditCard, Heart, Home, Shield, ChevronRight, X, User, Mail, Phone, MapPin, Globe2, Calendar
} from 'lucide-react'
import Link from 'next/link'
import { Price, useCurrency } from '@/components/ui/Price'
import { CurrencyCode, convertCurrency } from '@/lib/currency'
import { ttcFromHt, fromHt } from '@/lib/tax'
import { useTranslation, T } from '@/lib/translation'
import PaymentPrivacyNotice from '@/components/shared/PaymentPrivacyNotice'

type PaymentProvider = 'kkiapay' | 'fedapay' | 'zeyow'

interface NationaliteForm {
    knows_about_law: boolean
    is_afro_descendant: boolean | null
    afro_descendant_description: string
    ancestor1_nom: string; ancestor1_prenom: string; ancestor1_date_naissance: string; ancestor1_lien_parente: string; ancestor1_vivant: boolean | null; ancestor1_nationalite: string; ancestor1_pays_residence: string; ancestor1_autres_infos: string
    ancestor2_nom: string; ancestor2_prenom: string; ancestor2_date_naissance: string; ancestor2_lien_parente: string; ancestor2_vivant: boolean | null; ancestor2_nationalite: string; ancestor2_pays_residence: string; ancestor2_autres_infos: string
    nom: string; prenom: string; genre: string; date_naissance: string; pays_naissance: string; ville_naissance: string; nationalite: string; pays_residence: string; adresse_residence: string; telephone: string; email: string; profession: string
    demande_depuis_benin: boolean
    situation_matrimoniale: string; nombre_enfants: number; motivation_lettre: string; consentement_rgpd: boolean
    type_document_identite: string; autorite_delivrance: string; numero_document: string; pays_delivrance: string; date_expiration_document: string; lieu_delivrance: string
    pere_nom: string; pere_prenom: string; pere_date_naissance: string
    mere_nom: string; mere_prenom: string; mere_date_naissance: string
}

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        openKkiapayWidget: (config: any) => void
        addKkiapayListener: (event: string, callback: (data: Record<string, unknown>) => void) => void
        FedaPay: { init: (selector: string, config: Record<string, unknown>) => void }
    }
}



const AnimatedBackground = ({ bgImageUrl }: { bgImageUrl: string }) => (
    <div className="fixed inset-0 w-full h-full z-0 overflow-hidden pointer-events-none bg-white">
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
        <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/75 to-white/85" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-white/40" />
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
    const { t } = useTranslation()

    const STEPS = [
        { num: 1, label: t('Afro-descendance') },
        { num: 2, label: t('Infos personnelles') },
        { num: 3, label: t('Document & Parents') },
        { num: 4, label: t('Pièces jointes') },
        { num: 5, label: t('Récapitulatif') },
        { num: 6, label: t('Paiement & Soumission') },
    ]

    const COUNTRIES = ['Bénin', 'France', 'États-Unis', 'Brésil', 'Haïti', 'Canada', 'Royaume-Uni', 'Jamaïque', 'Trinidad et Tobago', 'Colombie', 'Cuba', 'Guadeloupe', 'Martinique', 'Guyane française', 'Suriname', 'Barbade', 'Bahamas', 'République Dominicaine', 'Porto Rico', 'Antigua-et-Barbuda', 'Allemagne', 'Belgique', 'Suisse', 'Pays-Bas', 'Italie', 'Espagne', 'Portugal', 'Ghana', 'Togo', 'Nigeria', 'Sénégal', 'Côte d\'Ivoire', 'Cameroun', 'Congo', 'Gabon', 'Mali', 'Burkina Faso', 'Guinée', 'Niger', 'Tchad', 'Autre']
    const PROFESSIONS = ['Salarié(e)', 'Entrepreneur/Commerçant', 'Profession libérale', 'Étudiant(e)', 'Fonctionnaire', 'Retraité(e)', 'Artisan', 'Agriculteur', 'Artiste', 'Ingénieur', 'Médecin', 'Avocat', 'Enseignant', 'Sans emploi', 'Autre']
    const GENRES = ['Masculin', 'Féminin', 'Non-binaire', 'Préfère ne pas préciser']
    const LIENS = [t('Père'), t('Mère'), t('Grand-père paternel'), t('Grand-mère paternelle'), t('Grand-père maternel'), t('Grand-mère maternelle'), t('Arrière-grand-père'), t('Arrière-grand-mère'), t('Autre')]

    const [step, setStep] = useState(0)
    const [submitting, setSubmitting] = useState(false)
    const [showWelcome, setShowWelcome] = useState(false)
    const [appRef, setAppRef] = useState('')
    const [errors, setErrors] = useState<string[]>([])
    const [lawAccepted, setLawAccepted] = useState(false)
    const [preInscriptionDone, setPreInscriptionDone] = useState(false)
    const [preInscriptionSubmitting, setPreInscriptionSubmitting] = useState(false)
    const [preInscriptionError, setPreInscriptionError] = useState('')
    const [preInscription, setPreInscription] = useState({ prenom: '', nom: '', email: '', telephone: '', pays_residence: '' })
    const [paymentSettings, setPaymentSettings] = useState<Record<string, string>>({})
    const [paymentDone, setPaymentDone] = useState(false)
    const [paymentProvider, setPaymentProvider] = useState<PaymentProvider | null>(null)
    const [paymentTxId, setPaymentTxId] = useState('')
    const [paymentProcessing, setPaymentProcessing] = useState(false)
    const [paymentError, setPaymentError] = useState('')
    // Garde : les listeners Kkiapay ne doivent être enregistrés qu'UNE fois
    // (sinon empilement de callbacks à chaque clic — piège connu du SDK k.js)
    const kkiapayBound = useRef(false)
    // Garde : la soumission auto post-paiement ne doit se déclencher qu'UNE fois.
    // (Incident nationalité : des clients ont payé mais la fiche n'était créée
    //  qu'au clic manuel « Confirmer » — perdue si l'étape n'était pas franchie.)
    const autoSubmitRef = useRef(false)
    // Mode « reprise » : le client complète un dossier DÉJÀ PAYÉ via un lien signé
    // (relance depuis le panel). Aucun paiement redemandé, on met à jour la fiche.
    const [resumeMode, setResumeMode] = useState(false)
    const resumeTokenRef = useRef('')
    // Mode MyAfroOrigins : reprise d'un dossier bloqué, tarif réduit 50 €,
    // dépôt libre de documents nommés. Le jeton (dans l'URL) autorise le tarif.
    const [myafroMode, setMyafroMode] = useState(false)
    const myafroTokenRef = useRef('')
    const [customDocs, setCustomDocs] = useState<{ name: string; file: File }[]>([])

    // ── Types ──────────────────────────────────────────────────────────────────
    interface DocSlot {
        key: string          // identifiant technique unique
        label: string        // libellé affiché
        multi: boolean       // plusieurs fichiers autorisés
        hint?: string        // indice optionnel
        required: boolean    // obligatoire (true) ou facultatif (false)
        ancestral?: boolean  // déclenche l'upsell Recherche Ancestrale si manquant
        conditional?: string // affiché seulement si condition (ex: 'has_children')
    }

    const [rawDocs, setRawDocs] = useState<{ key: string, label: string, name: string, file: File }[]>([])
    const [uploadProgress, setUploadProgress] = useState(0)
    const [docWarnings, setDocWarnings] = useState<string[]>([])

    // ── DEMANDE DE NATIONALITÉ — pièces obligatoires à communiquer (valables
    //    < 3 mois). Liste officielle, STRICTEMENT distincte de la liste de la
    //    RECHERCHE ancestrale (voir page /nationalite/complement-ancestral).
    //    Chargées depuis l'admin (page_sections) sinon valeurs par défaut.
    const DEFAULT_DOC_SLOTS: DocSlot[] = [
        { key: 'identite',           label: "Pièce d'identité en cours de validité",                                   multi: false, required: true },
        { key: 'naissance_demandeur', label: "Votre extrait de naissance",                                             multi: false, required: true },
        { key: 'afro_descendance',   label: "Preuve d'afro-descendance",                                               multi: true,  required: true,  hint: "ADN, acte notarié, archives historiques, arbre généalogique…" },
        { key: 'profession',         label: "Preuve de profession",                                                    multi: false, required: true },
        { key: 'domicile',           label: "Justificatif de domicile",                                                multi: false, required: true },
        { key: 'casier',             label: "Casier judiciaire (extrait récent)",                                      multi: false, required: true },
        { key: 'naissance_pere',     label: "Extrait de naissance du père",                                            multi: false, required: true },
        { key: 'naissance_mere',     label: "Extrait de naissance de la mère",                                         multi: false, required: true },
        { key: 'livret_parents',     label: "Copie du livret de famille de vos parents",                               multi: false, required: true },
        { key: 'agp_paternel',       label: "Extrait de naissance — arrière-grand-père (côté paternel)",               multi: false, required: false, ancestral: true },
        { key: 'agm_paternelle',     label: "Extrait de naissance — arrière-grand-mère (côté paternel)",               multi: false, required: false, ancestral: true },
        { key: 'agp_maternel',       label: "Extrait de naissance — arrière-grand-père (côté maternel)",               multi: false, required: false, ancestral: true },
        { key: 'agm_maternelle',     label: "Extrait de naissance — arrière-grand-mère (côté maternel)",               multi: false, required: false, ancestral: true },
        { key: 'livret_mineur',      label: "Copie de votre livret de famille (si enfant mineur)",                     multi: false, required: false, conditional: 'has_children' },
        { key: 'actes_ascendants',   label: "Autres actes des grands-parents et arrière-grands-parents",              multi: true,  required: false, hint: "Acte de mariage, notarial, militaire ou de décès — tout document disponible" },
        { key: 'photo',              label: "Photo d'identité récente (moins de 6 mois)",                              multi: false, required: false },
    ]
    const [docSlots, setDocSlots] = useState<DocSlot[]>(DEFAULT_DOC_SLOTS)
    const [bgImageUrl, setBgImageUrl] = useState<string>('/images/bg-default-afro.jpg')
    const [formAmount, setFormAmount] = useState(250)
    const [formCurrency, setFormCurrency] = useState<CurrencyCode>('USD')
    const { format } = useCurrency()

    const [form, setForm] = useState({
        knows_about_law: false, is_afro_descendant: true, afro_descendant_description: '',
        ancestor1_nom: '', ancestor1_prenom: '', ancestor1_date_naissance: '', ancestor1_lien_parente: '',
        ancestor1_vivant: true, ancestor1_nationalite: '', ancestor1_pays_residence: '', ancestor1_autres_infos: '',
        ancestor2_nom: '', ancestor2_prenom: '', ancestor2_date_naissance: '', ancestor2_lien_parente: '',
        ancestor2_vivant: true, ancestor2_nationalite: '', ancestor2_pays_residence: '', ancestor2_autres_infos: '',
        nom: '', prenom: '', genre: '', date_naissance: '', pays_naissance: '', ville_naissance: '',
        nationalite: '', pays_residence: '', adresse_residence: '', telephone: '', email: '', profession: '',
        demande_depuis_benin: false,
        situation_matrimoniale: '', nombre_enfants: 0, motivation_lettre: '', consentement_rgpd: false,
        type_document_identite: '', numero_document: '', date_expiration_document: '',
        pays_delivrance: '', lieu_delivrance: '', autorite_delivrance: '',
        pere_nom: '', pere_prenom: '', pere_date_naissance: '',
        mere_nom: '', mere_prenom: '', mere_date_naissance: '',
        myafro_date: '',
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
        // Restaurer la pré-inscription si l'utilisateur revient sur la page
        try {
            const saved = localStorage.getItem('rgb_nat_pre_inscription')
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed?.email) {
                    setPreInscription({
                        prenom: parsed.prenom || '',
                        nom: parsed.nom || '',
                        email: parsed.email || '',
                        telephone: parsed.telephone || '',
                        pays_residence: parsed.pays_residence || '',
                    })
                    setForm(p => ({
                        ...p,
                        prenom: parsed.prenom || p.prenom,
                        nom: parsed.nom || p.nom,
                        email: parsed.email || p.email,
                        telephone: parsed.telephone || p.telephone,
                        pays_residence: parsed.pays_residence || p.pays_residence,
                    }))
                    // On NE saute PAS l'étape : le client voit ses informations
                    // pré-remplies (modifiables) et confirme avant de continuer —
                    // évite de rester bloqué sur d'anciennes données (ex. un test).
                }
            }
        } catch { /* ignore */ }

        fetch('/api/settings/payment').then(r => r.json()).then(d => setPaymentSettings(d)).catch(() => { })
        supabase.from('nationality_page_content').select('content_fr').eq('section_key', 'form_bg_image').single()
            .then(({ data }) => { if (data?.content_fr) setBgImageUrl(data.content_fr) })
        // Fetch dynamic amount and documents from admin settings
        supabase.from('page_sections').select('content').eq('page', 'nationalite').eq('section_key', 'form_settings').single()
            .then(({ data }) => {
                if (data?.content) {
                    const c = data.content as Record<string, unknown>
                    // En mode MyAfroOrigins, le tarif (50 €) est imposé — ne pas l'écraser.
                    const isMyafroUrl = new URLSearchParams(window.location.search).has('myafro')
                    if (c.amount && !isMyafroUrl) setFormAmount(Number(c.amount))
                    if (c.currency && !isMyafroUrl) setFormCurrency(c.currency as CurrencyCode)
                    if (c.doc_slots && Array.isArray(c.doc_slots)) {
                        setDocSlots(c.doc_slots as DocSlot[])
                    }
                }
            })
    }, [])

    // ── Mode MyAfroOrigins (?myafro=<token>) : tarif de reprise 50 € ──────────
    useEffect(() => {
        const token = new URLSearchParams(window.location.search).get('myafro')
        if (!token) return
        myafroTokenRef.current = token
        setMyafroMode(true)
        setPreInscriptionDone(true)
        setFormAmount(50)
        setFormCurrency('EUR')

        // Détection de paiement manuel déjà associé
        try {
            const [bodyHex] = token.split('.')
            if (bodyHex) {
                let decodedStr = ''
                for (let i = 0; i < bodyHex.length; i += 2) {
                    decodedStr += String.fromCharCode(parseInt(bodyHex.substring(i, i + 2), 16))
                }
                const payload = JSON.parse(decodedStr)
                if (payload && payload.paid) {
                    setPaymentDone(true)
                    setPaymentProvider('facture' as any)
                    setPaymentTxId(payload.invoice_id ? `facture_${payload.invoice_id}` : 'manuel')
                }
            }
        } catch (e) {
            console.error('[MYAFRO] Erreur décodage jeton:', e)
        }
    }, [])

    // ── Mode « reprise » : lien de complément (dossier déjà payé) ──────────────
    // Si l'URL porte ?resume=<token>, on charge la fiche existante, on pré-remplit,
    // on saute la pré-inscription + le paiement, et la soumission mettra à jour la
    // fiche au lieu d'en créer une nouvelle.
    useEffect(() => {
        const token = new URLSearchParams(window.location.search).get('resume')
        if (!token) return
        ;(async () => {
            try {
                const res = await fetch(`/api/nationality/resume?token=${encodeURIComponent(token)}`)
                const data = await res.json()
                if (res.ok && data?.ok && data.prefill) {
                    resumeTokenRef.current = token
                    setResumeMode(true)
                    setForm(prev => ({ ...prev, ...data.prefill }))
                    setPreInscriptionDone(true)
                    setLawAccepted(true)
                    setPaymentDone(true)
                    if (data.application_ref) setAppRef(data.application_ref)
                    setStep(1)
                }
            } catch { /* lien invalide → formulaire normal */ }
        })()
    }, [])

    const submitPreInscription = async () => {
        setPreInscriptionError('')
        const { prenom, nom, email, telephone, pays_residence } = preInscription
        if (!prenom.trim() || !nom.trim()) { setPreInscriptionError(t('Nom et prénom requis')); return }
        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setPreInscriptionError(t('Email invalide')); return }
        if (!pays_residence) { setPreInscriptionError(t('Pays de résidence requis')); return }

        setPreInscriptionSubmitting(true)

        // Pré-remplissage immédiat du formulaire principal (avant même la réponse API)
        setForm(p => ({ ...p, prenom, nom, email, telephone, pays_residence }))

        try {
            localStorage.setItem('rgb_nat_pre_inscription', JSON.stringify(preInscription))
        } catch { /* quota ignoré */ }

        // API non bloquante : on continue la démarche même si la requête échoue
        fetch('/api/nationality/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...preInscription, lang: 'fr' }),
        }).catch(err => console.log('[NAT-LEAD] fire-and-forget:', err))

        // Laisser percevoir un micro-délai pour l'animation, sans attendre la réponse
        setTimeout(() => {
            setPreInscriptionSubmitting(false)
            setPreInscriptionDone(true)
        }, 400)
    }

    const u = useCallback((key: keyof NationaliteForm, val: unknown) => setForm(p => ({ ...p, [key]: val })), [])
    const IC = "w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-gray-900 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 placeholder:text-gray-400 transition-all"
    const LC = "text-xs font-bold text-gray-500 mb-1.5 block"
    const RQ = "text-red-400 ml-0.5"

    // Payment providers from existing settings
    const providers = [
        { id: 'kkiapay' as PaymentProvider, name: 'Kkiapay', subtitle: t('Mobile Money / Carte'), color: 'bg-[#4A90D9]/20 border-[#4A90D9]/40 text-[#4A90D9]', isReady: paymentSettings.kkiapay_enabled === 'true' && !!paymentSettings.kkiapay_public_key },
        { id: 'fedapay' as PaymentProvider, name: 'FedaPay', subtitle: t('Mobile Money / Carte'), color: 'bg-[#2ECC71]/20 border-[#2ECC71]/40 text-[#2ECC71]', isReady: paymentSettings.fedapay_enabled === 'true' && !!paymentSettings.fedapay_public_key },
        { id: 'zeyow' as PaymentProvider, name: 'Zeyow', subtitle: t('Carte Virtuelle'), color: 'bg-[#FF6B35]/20 border-[#FF6B35]/40 text-[#FF6B35]', isReady: paymentSettings.zeyow_enabled === 'true' && !!paymentSettings.zeyow_redirect_url },
    ].filter(p => p.isReady)

    // Enregistre les listeners Kkiapay une seule fois (idempotent)
    const bindKkiapayListeners = () => {
        if (kkiapayBound.current) return
        if (typeof window.addKkiapayListener !== 'function') return
        kkiapayBound.current = true
        window.addKkiapayListener('success', (response) => {
            setPaymentTxId(String(response.transactionId || '')); setPaymentDone(true); setPaymentProcessing(false)
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
        const isSandbox = paymentSettings.kkiapay_sandbox === 'true'
        const kkiapayKey = isSandbox
            ? (paymentSettings.kkiapay_sandbox_public_key || paymentSettings.kkiapay_public_key)
            : paymentSettings.kkiapay_public_key
        // Kkiapay exige un montant ENTIER positif en FCFA (XOF, sans décimales).
        // TVA EN SUS : le tarif est HORS TAXE, on charge le TTC (HT × 1,18).
        const rawXOF = formCurrency === 'XOF' ? formAmount : convertCurrency(formAmount, formCurrency, 'XOF')
        const amountXOF = ttcFromHt(Math.round(Number(rawXOF)), 'XOF')

        // Garde-fous : éviter le « Paramètres manquants ou invalides » du widget
        if (!kkiapayKey) {
            setPaymentError(t('Clé de paiement Kkiapay manquante. Contactez-nous pour finaliser votre paiement.'))
            return
        }
        if (!Number.isFinite(amountXOF) || amountXOF <= 0) {
            setPaymentError(t('Montant de paiement invalide. Veuillez rafraîchir la page et réessayer.'))
            return
        }

        setPaymentProcessing(true); setPaymentError(''); setPaymentProvider('kkiapay')
        try {
            // Listeners enregistrés AVANT l'ouverture, une seule fois (pas d'empilement)
            bindKkiapayListeners()
            // Configuration minimale et conforme : pas de `paymentmethod` (tableau
            // rejeté par le widget → « paramètres invalides ») ni de `callback`
            // (forcerait une redirection qui contourne le listener de succès).
            // Le widget propose nativement Mobile Money ET carte bancaire.
            window.openKkiapayWidget({
                amount: amountXOF,
                position: 'center',
                key: kkiapayKey,
                sandbox: isSandbox,
                phone: form.telephone || undefined,
                email: form.email || undefined,
                name: `${form.prenom || ''} ${form.nom || ''}`.trim() || undefined,
                data: JSON.stringify({ context: 'nationality', email: form.email }),
            })
        } catch { setPaymentError(t('Impossible d\'ouvrir Kkiapay')); setPaymentProcessing(false) }
    }

    const handleFedapay = () => {
        setPaymentProcessing(true); setPaymentError(''); setPaymentProvider('fedapay')
        // Convertir en FCFA + TVA en sus (on charge le TTC).
        const amountXOF = ttcFromHt(formCurrency === 'XOF' ? formAmount : convertCurrency(formAmount, formCurrency, 'XOF'), 'XOF')
        try {
            window.FedaPay.init('#fedapay-nat-btn', {
                public_key: paymentSettings.fedapay_public_key,
                environment: paymentSettings.fedapay_sandbox === 'true' ? 'sandbox' : 'live',
                transaction: { amount: amountXOF, description: `Reconnaissance Nationalité — ${form.prenom} ${form.nom}` },
                customer: { email: form.email || undefined, phone_number: { number: form.telephone } },
                onComplete: (resp: Record<string, unknown>) => {
                    const tx = resp.transaction as Record<string, unknown> | undefined
                    if (resp.reason === 'APPROVED' || (tx && tx.status === 'approved')) {
                        setPaymentTxId(String(tx?.id || resp.id || '')); setPaymentDone(true)
                    } else { setPaymentError(t('Paiement FedaPay non approuvé.')) }
                    setPaymentProcessing(false)
                },
            })
        } catch { setPaymentError(t('Impossible d\'initialiser FedaPay')); setPaymentProcessing(false) }
    }

    const handleZeyow = () => {
        setPaymentProvider('zeyow')
        const redirectUrl = paymentSettings.zeyow_redirect_url
        if (!redirectUrl) { setPaymentError(t('Zeyow non configuré.')); return }
        // Convertir en FCFA + TVA en sus (on charge le TTC).
        const amountXOF = ttcFromHt(formCurrency === 'XOF' ? formAmount : convertCurrency(formAmount, formCurrency, 'XOF'), 'XOF')
        window.location.href = `${redirectUrl}?amount=${amountXOF}&phone=${form.telephone}&email=${form.email}&context=nationality`
    }

    const payHandlers: Record<PaymentProvider, () => void> = { kkiapay: handleKkiapay, fedapay: handleFedapay, zeyow: handleZeyow }

    const validate = (): string[] => {
        const e: string[] = []
        if (step === 1) {
            if (!form.afro_descendant_description) e.push(t('Décrivez votre afro-descendance'))
            if (!form.ancestor1_nom) e.push(t('Nom de l\'ancêtre 1 requis'))
            if (!form.ancestor1_lien_parente) e.push(t('Lien de parenté requis'))
        }
        if (step === 2) {
            if (!form.nom) e.push(t('Nom requis'))
            if (!form.prenom) e.push(t('Prénom requis'))
            if (!form.email) e.push(t('Email requis'))
            if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.push(t('Email invalide'))
            if (!form.genre) e.push(t('Genre requis'))
            if (!form.date_naissance) e.push(t('Date de naissance requise'))
            if (!form.pays_residence) e.push(t('Pays de résidence requis'))
        }
        if (step === 3 && !form.type_document_identite) e.push(t('Type de document requis'))
        if (step === 4) {
            // Validation SOFT : on ne bloque que les 6 obligatoires, les autres sont des avertissements
            const uploadedKeys = rawDocs.map(d => d.key)
            const hasChildren = form.nombre_enfants > 0
            const strictRequired = docSlots.filter(s => s.required)
            strictRequired.forEach(slot => {
                if (!uploadedKeys.includes(slot.key)) {
                    e.push(`${t('Document manquant :')} ${t(slot.label)}`)
                }
            })
            // Documents conditionnels obligatoires quand la condition s'applique
            // (ex. livret de famille obligatoire si enfant mineur)
            docSlots.filter(s => s.conditional === 'has_children').forEach(slot => {
                if (hasChildren && !uploadedKeys.includes(slot.key)) {
                    e.push(`${t('Document manquant :')} ${t(slot.label)}`)
                }
            })
            // Avertissements non bloquants pour les facultatifs
            const warnings: string[] = []
            const optionalSlots = docSlots.filter(s => !s.required && !s.conditional)
            optionalSlots.forEach(slot => {
                if (!uploadedKeys.includes(slot.key)) {
                    warnings.push(slot.label)
                }
            })
            setDocWarnings(warnings)
        }
        // Step 5 = Récapitulatif (pas de validation, juste relecture)
        return e
    }

    const next = () => { const e = validate(); if (e.length > 0) { setErrors(e); return }; setErrors([]); setStep(s => Math.min(s + 1, 6)) }
    const prev = () => { setErrors([]); setStep(s => Math.max(s - 1, 1)) }

    const submit = async () => {
        if (!paymentDone) {
            setErrors([t('Veuillez effectuer le paiement avant de soumettre.')])
            return
        }
        setSubmitting(true)
        setErrors([])
        setUploadProgress(10)

        const finalUploadedUrls: string[] = []
        let uploadFailCount = 0

        // Documents complémentaires nommés (mode MyAfroOrigins) fusionnés dans la
        // file d'upload avec une clé unique et le nom saisi par le client.
        const baseDocs = [
            ...rawDocs,
            ...customDocs.map((d, k) => ({ key: `custom_${k}`, label: d.name || `Document ${k + 1}`, name: d.name, file: d.file })),
        ]

        // Compression native des IMAGES avant envoi (photos de documents prises
        // au téléphone : 5-15 Mo → < 1 Mo). PDF/scans laissés intacts. Le nom
        // affiché reste l'original ; seul le fichier téléversé est allégé.
        const allDocs = await Promise.all(
            baseDocs.map(async d => ({ ...d, file: await compressImage(d.file) })),
        )

        let lastUploadError = ''

        // Chemins d'upload SIGNÉS côté serveur (service role → bypass RLS). Avant,
        // l'upload navigateur utilisait la clé anon et dépendait des policies RLS
        // du bucket : dès qu'elles refusaient l'INSERT anon, TOUS les fichiers
        // échouaient (« upload échoué »). La signature serveur supprime cette
        // dépendance. Le transfert du fichier reste direct navigateur → Storage.
        let signed: { key: string; path: string; token: string }[] = []
        try {
            const r = await fetch('/api/nationality/upload-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    files: allDocs.map(d => ({ key: d.key, ext: d.file.name.split('.').pop() || 'bin' })),
                }),
            })
            const j = await r.json().catch(() => ({}))
            if (r.ok && Array.isArray(j.uploads)) signed = j.uploads
            else lastUploadError = j?.error || `Préparation du dépôt refusée (HTTP ${r.status})`
        } catch (e) {
            lastUploadError = e instanceof Error ? e.message : 'Réseau indisponible'
        }

        // Upload (1 réessai). Voie signée si disponible, sinon repli anon direct.
        for (let i = 0; i < allDocs.length; i++) {
            const doc = allDocs[i]
            const sig = signed[i]
            let uploaded = false
            for (let attempt = 0; attempt < 2 && !uploaded; attempt++) {
                try {
                    if (sig) {
                        const { data, error } = await supabase.storage.from('nationality_documents')
                            .uploadToSignedUrl(sig.path, sig.token, doc.file)
                        if (data && !error) {
                            finalUploadedUrls.push(`${doc.key}:${doc.label}: ${sig.path}`)
                            uploaded = true
                        } else if (error) {
                            lastUploadError = error.message
                            console.error(`[UPLOAD] Echec signé tentative ${attempt + 1} "${t(doc.label)}":`, error.message)
                        }
                    } else {
                        // Repli si /upload-url a échoué : upload anon direct.
                        const ext = doc.file.name.split('.').pop()
                        const filename = `nat-${Date.now()}/${doc.key}_${i}.${ext}`
                        const { data, error } = await supabase.storage.from('nationality_documents')
                            .upload(filename, doc.file, { cacheControl: '3600', upsert: attempt > 0 })
                        if (data && !error) {
                            finalUploadedUrls.push(`${doc.key}:${doc.label}: ${filename}`)
                            uploaded = true
                        } else if (error) {
                            lastUploadError = error.message
                            console.error(`[UPLOAD] Echec anon tentative ${attempt + 1} "${t(doc.label)}":`, error.message)
                        }
                    }
                } catch (err) {
                    lastUploadError = err instanceof Error ? err.message : String(err)
                    console.error(`[UPLOAD] Erreur tentative ${attempt + 1} "${t(doc.label)}":`, err)
                }
            }
            if (!uploaded) {
                finalUploadedUrls.push(`${t(doc.label)}: ${doc.name} (upload échoué)`)
                uploadFailCount++
            }
            setUploadProgress(10 + Math.floor((i + 1) / allDocs.length * 50))
        }

        if (uploadFailCount > 0) {
            console.warn(`[UPLOAD] ${uploadFailCount}/${allDocs.length} fichier(s) non envoyés. Dernier motif : ${lastUploadError || 'inconnu'}`)
        }

        setUploadProgress(70)

        // Clean empty date strings to null for PostgreSQL
        const cleanedForm: Record<string, unknown> = { ...form }
        const dateFields = ['date_naissance', 'ancestor1_date_naissance', 'ancestor2_date_naissance', 'pere_date_naissance', 'mere_date_naissance', 'date_expiration_document']
        dateFields.forEach(key => { if (!cleanedForm[key]) cleanedForm[key] = null })

        // Submit via secure API route (Service Role Key, bypasses RLS).
        // En mode reprise (dossier déjà payé) → on MET À JOUR la fiche existante
        // via /api/nationality/complete (jeton signé, aucun paiement redemandé).
        try {
            const res = resumeMode
                ? await fetch('/api/nationality/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: resumeTokenRef.current,
                        ...cleanedForm,
                        documents: finalUploadedUrls,
                        documents_uploaded: finalUploadedUrls,
                    })
                })
                : await fetch('/api/nationality', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...cleanedForm,
                        documents: finalUploadedUrls,
                        documents_uploaded: finalUploadedUrls,
                        payment_method: paymentProvider || 'none',
                        payment_ref: paymentTxId,
                        payment_status: paymentDone ? 'payé' : 'non_payé',
                        amount: formAmount,
                        currency: formCurrency,
                        last_step_completed: 6,
                        // Mode MyAfroOrigins : le serveur vérifie le jeton et impose le tarif 50 €
                        myafro_token: myafroMode ? myafroTokenRef.current : undefined,
                    })
                })

            setUploadProgress(90)
            const result = await res.json()

            if (res.ok && result.success) {
                setAppRef(result.reference)
                setUploadProgress(100)
                // Déclencher l'analyse des documents manquants en arrière-plan
                const uploadedKeys = rawDocs.map(d => d.key)
                fetch('/api/nationality/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ref: result.reference,
                        email: form.email,
                        prenom: form.prenom,
                        nom: form.nom,
                        uploaded_keys: uploadedKeys,
                        all_slots: docSlots.map(s => ({ key: s.key, label: s.label, required: s.required, ancestral: s.ancestral || false })),
                    }),
                }).catch(err => console.error('[ANALYZE] Erreur déclenchement analyze:', err))
                setShowWelcome(true)
            } else {
                setErrors([result.error || t('Erreur lors de la soumission. Veuillez réessayer.')])
            }
        } catch {
            // Échec réseau APRÈS paiement : ne pas perdre le dossier en silence.
            // On réarme la soumission auto pour permettre un nouvel essai (bouton + effet).
            autoSubmitRef.current = false
            setErrors([t('Le paiement a bien été reçu, mais l\'enregistrement a échoué. Ne fermez pas cette page : réessayez avec le bouton « Confirmer et Soumettre ». En cas de problème persistant, contactez-nous en gardant votre référence de paiement.')])
        }
        setSubmitting(false)
    }

    // ── Filet de sécurité : dès que le paiement est confirmé, on enregistre le
    //    dossier automatiquement (upload + création de la fiche), sans dépendre
    //    d'un clic manuel. C'est la faille qui avait fait perdre des clients ayant
    //    pourtant payé. Le bouton « Confirmer » reste disponible comme relance.
    useEffect(() => {
        // En mode reprise, paymentDone est vrai dès le chargement : NE PAS
        // auto-soumettre (le client doit d'abord re-déposer ses documents).
        if (paymentDone && !resumeMode && !autoSubmitRef.current && !submitting && !showWelcome) {
            autoSubmitRef.current = true
            submit()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paymentDone])

    // ═══ WELCOME HOME ANIMATION ═══
    if (showWelcome) return (
        <div className="min-h-screen bg-white flex items-center justify-center px-4 overflow-hidden relative">
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
                    <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="text-4xl md:text-5xl font-black text-gray-900 leading-tight mb-4">
                        Bienvenue<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]"><T>Chez Vous</T></span>
                    </motion.h1>
                    <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }} className="text-gray-500 text-sm mb-2"><T>Votre demande a été enregistrée avec succès</T></motion.p>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1, type: 'spring' }} className="inline-block bg-white/5 backdrop-blur-xl border border-[#FCD116]/20 rounded-2xl px-6 py-3 mb-6">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold"><T>Référence</T></p>
                        <p className="text-xl font-mono font-black text-[#FCD116]">{appRef}</p>
                    </motion.div>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} className="text-xs text-gray-500 mb-4"><T>Conservez votre référence</T> <span className="text-[#FCD116] font-bold">{appRef}</span> <T>pour suivre votre dossier</T></motion.p>
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.5 }} className="space-y-3">
                        <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
                            <T>Nous avons conçu une gamme de services pour simplifier chaque étape de votre retour, de l&apos;administratif à l&apos;investissement.</T>
                        </p>            <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400"><Heart size={10} className="text-[#E8112D]" /> <T>Retour Gagnant Bénin</T></div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link href="/suivi-dossier" className="bg-gradient-to-r from-[#008751] to-[#00b06a] hover:shadow-[0_8px_30px_rgba(0,135,81,0.4)] text-white font-black text-sm px-6 py-3 rounded-xl transition-all uppercase tracking-widest text-[11px]"> <T>Suivre mon dossier</T></Link>
                        <Link href="/nationalite" className="bg-white/10 hover:bg-white/15 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all"><T>Retour à la page</T></Link>
                        <Link href="/" className="text-xs text-gray-500 hover:text-gray-900 transition-colors"><T>Accueil</T></Link>
                    </motion.div>
                </motion.div>
            </motion.div>
        </div>
    )

    // ═══ PRE-INSCRIPTION GATE ═══ (capture lead avant accès au formulaire)
    if (!preInscriptionDone) return (
        <div className="min-h-screen relative flex items-center justify-center px-4 py-8">
            <AnimatedBackground bgImageUrl={bgImageUrl} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}
                className="relative z-10 bg-white/95 backdrop-blur-2xl border border-slate-200/50 shadow-2xl rounded-3xl p-6 md:p-10 max-w-xl w-full">
                <div className="absolute top-0 inset-x-0 h-1.5 rounded-t-3xl overflow-hidden">
                    <div className="h-full" style={{ background: 'linear-gradient(90deg,#008751 33%,#FCD116 33%,#FCD116 66%,#E8112D 66%)' }} />
                </div>

                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-50/5 border border-emerald-100 mb-4">
                        <Globe2 size={24} className="text-emerald-600" />
                    </div>
                    <span className="inline-block text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] mb-2"><T>Loi N° 2024-31</T></span>
                    <h2 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight mb-2">
                        <T>Démarrez votre demande</T>
                    </h2>
                    <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                        <T>Quelques informations pour préparer votre dossier et vous permettre de reprendre la démarche à tout moment.</T>
                    </p>
                </div>

                {preInscriptionError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-xs text-red-700">
                        <AlertCircle size={14} /> {preInscriptionError}
                    </div>
                )}

                <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={LC}><T>Prénom</T><span className={RQ}>*</span></label>
                            <div className="relative">
                                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input title={t('Prénom')} value={preInscription.prenom}
                                    onChange={e => setPreInscription(p => ({ ...p, prenom: e.target.value }))}
                                    className={IC + ' pl-9'} placeholder={t('Votre prénom')} />
                            </div>
                        </div>
                        <div>
                            <label className={LC}><T>Nom</T><span className={RQ}>*</span></label>
                            <div className="relative">
                                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input title={t('Nom')} value={preInscription.nom}
                                    onChange={e => setPreInscription(p => ({ ...p, nom: e.target.value }))}
                                    className={IC + ' pl-9'} placeholder={t('Votre nom')} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className={LC}><T>Email</T><span className={RQ}>*</span></label>
                        <div className="relative">
                            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input title={t('Email')} type="email" value={preInscription.email}
                                onChange={e => setPreInscription(p => ({ ...p, email: e.target.value }))}
                                className={IC + ' pl-9'} placeholder={t('email@exemple.com')} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={LC}><T>Téléphone / WhatsApp</T></label>
                            <div className="relative">
                                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input title={t('Téléphone')} value={preInscription.telephone}
                                    onChange={e => setPreInscription(p => ({ ...p, telephone: e.target.value }))}
                                    className={IC + ' pl-9'} placeholder="+229 XX XX XX XX" />
                            </div>
                        </div>
                        <div>
                            <label className={LC}><T>Pays de résidence</T><span className={RQ}>*</span></label>
                            <div className="relative">
                                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10" />
                                <select title={t('Pays de résidence')} value={preInscription.pays_residence}
                                    onChange={e => setPreInscription(p => ({ ...p, pays_residence: e.target.value }))}
                                    className={IC + ' pl-9'}>
                                    <option value="">{t('Sélectionner')}</option>
                                    {COUNTRIES.map(c => <option key={c} value={c}>{t(c)}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-5 flex items-start gap-2">
                    <Shield size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                        <T>Vos informations sont protégées. Vous recevrez un email pour créer votre espace personnel — cela n'interrompt pas votre démarche en cours.</T>
                    </p>
                </div>

                <div className="flex gap-3">
                    <Link href="/nationalite" className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 font-bold text-sm py-3 rounded-xl text-center hover:bg-slate-100 transition-all backdrop-blur-md"><T>Annuler</T></Link>
                    <button onClick={submitPreInscription} disabled={preInscriptionSubmitting}
                        className="flex-[2] bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm py-3 rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                        {preInscriptionSubmitting ? (
                            <><Loader2 size={16} className="animate-spin" /> <T>Enregistrement…</T></>
                        ) : (
                            <><T>Continuer ma démarche</T> <ArrowRight size={16} /></>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    )

    // ═══ LAW POPUP ═══
    if (step === 0) return (
        <div className="min-h-screen relative flex items-center justify-center px-4">
            <AnimatedBackground bgImageUrl={bgImageUrl} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 bg-white/95 backdrop-blur-2xl border border-slate-200/50 shadow-2xl rounded-3xl p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto">
                <h2 className="text-xl font-black text-gray-900 text-center mb-2"><T>Savez-vous ce qu&apos;est la reconnaissance de la nationalité aux afro-descendants en République du Bénin ?</T></h2>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-4 text-center"><T>Lisez et cochez la mention &quot;J&apos;ai lu et compris&quot; pour poursuivre</T></div>
                <div className="text-sm text-slate-700 leading-relaxed space-y-3 mb-6">
                    <p><T>La reconnaissance de la nationalité béninoise aux afrodescendants est un acte de mémoire, de justice et une porte ouverte vers le retour aux racines des descendants des Africains déportés lors de la traite négrière transatlantique, comme membres légitimes de la Nation béninoise.</T></p>
                    <p><T>La loi 2024-31 du 02 Septembre 2024 portant reconnaissance de la nationalité béninoise aux afro-descendants organise en ce sens un mode d&apos;acquisition de la nationalité béninoise par toute personne qui d&apos;après sa généalogie, a un ascendant africain subsaharien déporté hors du continent africain dans le cadre de la traite des noirs et du commerce triangulaire.</T></p>
                    <p className="font-bold text-gray-900"><T>La loi s&apos;adresse à l&apos;afro-descendant :</T></p>
                    <ul className="list-disc pl-5 space-y-1"><li>âgé d&apos;au moins 18 ans,</li><li><T>résidant hors du continent africain,</T></li><li><T>et pouvant établir sa filiation avec un ascendant africain subsaharien victime de la traite négrière.</T></li></ul>
                    <p><span className="font-bold text-gray-900"><T>La preuve de l&apos;afro-descendance peut être apportée par :</T></span> <T>des actes d&apos;état civil, des certificats officiels, des tests d&apos;ADN génétiques, des actes notariés, des arbres généalogiques, des extraits d&apos;archives historiques, et tout autre document probant.</T></p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer mb-6 bg-slate-50 border border-slate-200/60 hover:bg-slate-100 transition-colors rounded-xl p-4">
                    <input type="checkbox" checked={lawAccepted} onChange={e => setLawAccepted(e.target.checked)} className="w-5 h-5 accent-emerald-500" />
                    <span className="text-sm font-bold text-emerald-600"><T>J&apos;ai lu et compris</T></span>
                </label>
                <div className="flex gap-3">
                    <Link href="/nationalite" className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 font-bold text-sm py-3 rounded-xl text-center hover:bg-slate-100 transition-all backdrop-blur-md"><T>Retour</T></Link>
                    <button onClick={() => { if (lawAccepted) { u('knows_about_law', true); setStep(1) } }} disabled={!lawAccepted} className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black text-sm py-3 rounded-xl disabled:opacity-30 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"><T>Continuer</T> <ArrowRight size={16} /></button>
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
                    <Link href="/nationalite" className="inline-flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 mb-3 transition-colors bg-white/80 px-3 py-1.5 rounded-full backdrop-blur-md border border-slate-200 shadow-sm"><ChevronLeft size={14} /> <T>Retour à l&apos;accueil</T></Link>
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 drop-shadow-sm"><T>Reconnaissance de Nationalité</T></h1>
                    <p className="text-sm text-slate-600 mt-2 font-semibold"><T>Veuillez remplir le formulaire ci-dessous</T></p>
                </div>

                {/* Progress */}
                <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
                    {STEPS.map((s, i) => (
                        <div key={s.num} className="flex items-center">
                            <div className={`flex items-center gap-1.5 shrink-0 ${step >= s.num ? 'text-emerald-600' : 'text-slate-400'}`}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${step > s.num ? 'bg-emerald-500 text-white' : step === s.num ? 'bg-emerald-500/10 border border-emerald-500 text-emerald-600' : 'bg-slate-50 border border-slate-200 text-slate-400'}`}>{step > s.num ? <CheckCircle2 size={12} /> : s.num}</div>
                                <span className="text-[9px] font-bold uppercase tracking-wider hidden lg:block whitespace-nowrap">{t(s.label)}</span>
                            </div>
                            {i < 5 && <div className={`w-6 lg:w-12 h-px mx-1.5 ${step > s.num ? 'bg-emerald-500/30' : 'bg-slate-200'}`} />}
                        </div>
                    ))}
                </div>

                {errors.length > 0 && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">{errors.map((e, i) => <p key={i} className="text-xs text-red-700 flex items-center gap-2"><AlertCircle size={12} /> {e}</p>)}</div>}

                <AnimatePresence mode="wait">
                    <motion.div key={step} initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.05, y: -10 }} transition={{ duration: 0.3, ease: "easeOut" }} className="bg-white/95 backdrop-blur-2xl border border-slate-200/50 shadow-2xl rounded-3xl p-6 md:p-8 relative overflow-hidden">
                        {/* Shimmer effect inside card */}
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/5 pointer-events-none" />

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
                                <h2 className="text-lg font-black text-slate-900"><T>Votre identification Afro-descendante</T></h2>
                                <div><label className={LC}><T>Êtes-vous afro-descendant(e) ?</T><span className={RQ}>*</span></label><div className="flex gap-3 mt-1">{[true, false].map(v => <button key={String(v)} onClick={() => u('is_afro_descendant', v)} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${form.is_afro_descendant === v ? 'bg-emerald-50 border border-emerald-500/50 text-[#008751]' : 'bg-slate-50 border border-gray-200 text-gray-500 hover:bg-slate-100/50'}`}>{v ? t('Oui') : t('Non')}</button>)}</div></div>
                                <div><label className={LC}><T>Comment êtes-vous afro-descendant(e) ?</T><span className={RQ}>*</span></label><textarea rows={4} value={form.afro_descendant_description} onChange={e => u('afro_descendant_description', e.target.value)} placeholder={t("Décrivez en quelques mots votre ascendance...")} className={IC + ' resize-none'} /></div>
                                <div className="border-t border-gray-200 pt-5"><h3 className="text-sm font-black text-slate-900 mb-4"><T>Informations sur votre Ascendance</T></h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{[1, 2].map(n => {
                                        const f = form as Record<string, any>
                                        return (
                                            <div key={n} className="space-y-3">
                                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">{n === 1 ? t('1ère') : t('2ème')} {t('Personne')}</span>
                                                <div><label className={LC}><T>Nom</T>{n === 1 && <span className={RQ}>*</span>}</label><input title={`Nom Ancêtre ${n}`} value={f[`ancestor${n}_nom`] || ''} onChange={e => u(`ancestor${n}_nom` as keyof NationaliteForm, e.target.value)} className={IC} placeholder={t('Nom')} /></div>
                                                <div><label className={LC}><T>Prénom(s)</T></label><input title={`Prénom Ancêtre ${n}`} value={f[`ancestor${n}_prenom`] || ''} onChange={e => u(`ancestor${n}_prenom` as keyof NationaliteForm, e.target.value)} className={IC} placeholder={t('Prénom(s)')} /></div>
                                                <div><label className={LC}><T>Date de naissance</T></label><input title={`Date de naissance Ancêtre ${n}`} type="date" value={f[`ancestor${n}_date_naissance`] || ''} onChange={e => u(`ancestor${n}_date_naissance` as keyof NationaliteForm, e.target.value)} className={IC} /></div>
                                                <div><label className={LC}><T>Lien de parenté</T>{n === 1 && <span className={RQ}>*</span>}</label><select title={`Lien de parenté Ancêtre ${n}`} value={f[`ancestor${n}_lien_parente`] || ''} onChange={e => u(`ancestor${n}_lien_parente` as keyof NationaliteForm, e.target.value)} className={IC}><option value="">{t("Choisir")}</option>{LIENS.map(item => Object.assign(item, { translated: true })).map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                                                <div><label className={LC}><T>Vivant(e) ?</T></label><div className="flex gap-2">{[true, false].map(v => <button title={v ? t('Oui') : t('Non')} key={String(v)} onClick={() => u(`ancestor${n}_vivant` as keyof NationaliteForm, v)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${f[`ancestor${n}_vivant`] === v ? 'bg-emerald-50 border border-emerald-500/50 text-[#008751]' : 'bg-slate-50 border border-gray-200 text-gray-500 hover:bg-slate-100/50'}`}>{v ? t('Oui') : t('Non')}</button>)}</div></div>
                                                <div><label className={LC}><T>Nationalité</T></label><select title={`Nationalité Ancêtre ${n}`} value={f[`ancestor${n}_nationalite`] || ''} onChange={e => u(`ancestor${n}_nationalite` as keyof NationaliteForm, e.target.value)} className={IC}><option value="">{t("Pays")}</option>{COUNTRIES.map(item => Object.assign(item, { translated: true })).map(c => <option key={c} value={c}>{t(c)}</option>)}</select></div>
                                                <div><label className={LC}><T>Pays de résidence</T></label><select title={`Pays de résidence Ancêtre ${n}`} value={f[`ancestor${n}_pays_residence`] || ''} onChange={e => u(`ancestor${n}_pays_residence` as keyof NationaliteForm, e.target.value)} className={IC}><option value="">{t("Pays")}</option>{COUNTRIES.map(item => Object.assign(item, { translated: true })).map(c => <option key={c} value={c}>{t(c)}</option>)}</select></div>
                                                <div><label className={LC}><T>Autres informations</T></label><textarea title={`Autres informations Ancêtre ${n}`} rows={2} value={f[`ancestor${n}_autres_infos`] || ''} onChange={e => u(`ancestor${n}_autres_infos` as keyof NationaliteForm, e.target.value)} className={IC + ' resize-none'} placeholder={t('Informations complémentaires...')} /></div>
                                            </div>
                                        )
                                    })}</div>
                                </div>
                            </div>}

                            {step === 2 && <div className="space-y-5">
                                <h2 className="text-lg font-black text-slate-900"><T>Informations Personnelles</T></h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className={LC}><T>Nom</T><span className={RQ}>*</span></label><input title={t("Votre Nom")} value={form.nom} onChange={e => u('nom', e.target.value)} className={IC} placeholder={t('Nom de famille')} /></div>
                                    <div><label className={LC}><T>Prénom(s)</T><span className={RQ}>*</span></label><input title={t("Votre Prénom")} value={form.prenom} onChange={e => u('prenom', e.target.value)} className={IC} placeholder={t('Prénom(s)')} /></div>
                                    <div><label className={LC}><T>Genre</T><span className={RQ}>*</span></label><select title={t("Genre")} value={form.genre} onChange={e => u('genre', e.target.value)} className={IC}><option value="">{t("Choisir")}</option>{GENRES.map(item => Object.assign(item, { translated: true })).map(g => <option key={g} value={g}>{t(g)}</option>)}</select></div>
                                    <div><label className={LC}><T>Date de naissance</T><span className={RQ}>*</span></label><input title={t("Date de naissance")} type="date" value={form.date_naissance} onChange={e => u('date_naissance', e.target.value)} className={IC} /></div>
                                    <div><label className={LC}><T>Pays de naissance</T></label><select title={t("Pays de naissance")} value={form.pays_naissance} onChange={e => u('pays_naissance', e.target.value)} className={IC}><option value="">{t("Pays")}</option>{COUNTRIES.map(item => Object.assign(item, { translated: true })).map(c => <option key={c} value={c}>{t(c)}</option>)}</select></div>
                                    <div><label className={LC}><T>Ville de naissance</T></label><input title={t("Ville de naissance")} value={form.ville_naissance} onChange={e => u('ville_naissance', e.target.value)} className={IC} placeholder={t('Ville')} /></div>
                                    <div><label className={LC}><T>Nationalité</T><span className={RQ}>*</span></label><select title={t("Nationalité")} value={form.nationalite} onChange={e => u('nationalite', e.target.value)} className={IC}><option value="">{t("Pays")}</option>{COUNTRIES.map(item => Object.assign(item, { translated: true })).map(c => <option key={c} value={c}>{t(c)}</option>)}</select></div>
                                    <div><label className={LC}><T>Pays de résidence</T><span className={RQ}>*</span></label><select title={t("Pays de résidence")} value={form.pays_residence} onChange={e => u('pays_residence', e.target.value)} className={IC}><option value="">{t("Pays")}</option>{COUNTRIES.map(item => Object.assign(item, { translated: true })).map(c => <option key={c} value={c}>{t(c)}</option>)}</select></div>
                                    <div className="md:col-span-2"><label className={LC}><T>Adresse complète</T></label><input title={t("Adresse")} value={form.adresse_residence} onChange={e => u('adresse_residence', e.target.value)} className={IC} placeholder={t('Adresse')} /></div>
                                    <div><label className={LC}><T>Téléphone</T></label><input title={t("Téléphone")} value={form.telephone} onChange={e => u('telephone', e.target.value)} className={IC} placeholder={t("+229 XX XX XX XX")} /></div>
                                    <div><label className={LC}><T>Email</T><span className={RQ}>*</span></label><input title={t("Email")} type="email" value={form.email} onChange={e => u('email', e.target.value)} className={IC} placeholder={t("email@exemple.com")} /></div>
                                    <div><label className={LC}><T>Profession</T></label><select title={t("Profession")} value={form.profession} onChange={e => u('profession', e.target.value)} className={IC}><option value="">{t("Choisir")}</option>{PROFESSIONS.map(item => Object.assign(item, { translated: true })).map(p => <option key={t(p)} value={t(p)}>{t(p)}</option>)}</select></div>
                                </div>

                                <div className="border-t border-gray-200 pt-5 space-y-4">
                                    <h3 className="text-sm font-black text-slate-900"><T>Situation familiale</T></h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><label className={LC}><T>Situation matrimoniale</T></label><select title={t("Situation matrimoniale")} value={form.situation_matrimoniale} onChange={e => u('situation_matrimoniale', e.target.value)} className={IC}><option value="">{t("Choisir")}</option><option value="celibataire">{t("Célibataire")}</option><option value="marie">{t("Marié(e)")}</option><option value="divorce">{t("Divorcé(e)")}</option><option value="veuf">{t("Veuf/Veuve")}</option><option value="union_libre">{t("Union libre")}</option></select></div>
                                        <div><label className={LC}><T>Nombre d&apos;enfants</T></label><input title={t("Nombre d'enfants")} type="number" min={0} value={form.nombre_enfants} onChange={e => u('nombre_enfants', Number(e.target.value))} className={IC} placeholder="0" /></div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
                                    <button title={t("Demande depuis le Bénin ?")} onClick={() => u('demande_depuis_benin', !form.demande_depuis_benin)} className={`w-12 h-6 rounded-full transition-all relative ${form.demande_depuis_benin ? 'bg-emerald-500' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${form.demande_depuis_benin ? 'left-6' : 'left-0.5'}`} /></button>
                                    <span className="text-sm text-slate-600"><T>Demande depuis le Bénin ?</T></span>
                                </div>
                            </div>}

                            {step === 3 && <div className="space-y-5">
                                <h2 className="text-lg font-black text-slate-900"><T>Document d&apos;identité &amp; Parents</T></h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className={LC}><T>Type de document</T><span className={RQ}>*</span></label><select title={t("Type de document d&apos;identité")} value={form.type_document_identite} onChange={e => u('type_document_identite', e.target.value)} className={IC}><option value="">{t("Choisir")}</option><option value="passeport">{t("Passeport")}</option><option value="cni">{t("CNI")}</option><option value="carte_electeur">Carte d&apos;électeur</option><option value="autre">{t("Autre")}</option></select></div>
                                    <div><label className={LC}><T>Autorité de délivrance</T></label><input title={t("Autorité de délivrance")} value={form.autorite_delivrance} onChange={e => u('autorite_delivrance', e.target.value)} className={IC} /></div>
                                    <div><label className={LC}><T>Numéro du document</T></label><input title={t("Numéro du document")} value={form.numero_document} onChange={e => u('numero_document', e.target.value)} className={IC} /></div>
                                    <div><label className={LC}><T>Pays de délivrance</T></label><select title={t("Pays de délivrance")} value={form.pays_delivrance} onChange={e => u('pays_delivrance', e.target.value)} className={IC}><option value="">{t("Pays")}</option>{COUNTRIES.map(item => Object.assign(item, { translated: true })).map(c => <option key={c} value={c}>{t(c)}</option>)}</select></div>
                                    <div><label className={LC}><T>Date d&apos;expiration</T></label><input title={t("Date d&apos;expiration")} type="date" value={form.date_expiration_document} onChange={e => u('date_expiration_document', e.target.value)} className={IC} /></div>
                                    <div><label className={LC}><T>Lieu de délivrance</T></label><input title={t("Lieu de délivrance")} value={form.lieu_delivrance} onChange={e => u('lieu_delivrance', e.target.value)} className={IC} /></div>
                                </div>

                                {/* Upload du document d'identité */}
                                <div className="border-t border-gray-200 pt-5">
                                    <h3 className="text-sm font-black text-slate-900 mb-3"><T>Scan / Photo du document</T></h3>
                                    <p className="text-[11px] text-gray-500 mb-3">{t('Joignez une photo ou un scan lisible de votre')} {form.type_document_identite === 'passeport' ? t('passeport') : form.type_document_identite === 'cni' ? t('carte d\'identité') : t('document')}.</p>
                                    <label className="cursor-pointer block bg-gray-50 border border-dashed border-emerald-500/30 rounded-xl p-5 text-center hover:border-emerald-500/60 transition-all">
                                        <FileText size={24} className="mx-auto text-emerald-600/50 mb-2" />
                                        <p className="text-xs font-bold text-emerald-600"><T>Cliquer ou glisser-déposer</T></p>
                                        <p className="text-[10px] text-gray-400 mt-1"><T>PNG, JPG, PDF — Max 5 Mo</T></p>
                                        {rawDocs.find(d => d.key === 'identite_scan') && <p className="text-[10px] text-emerald-600 mt-2 font-bold"><T>Fichier sélectionné :</T> {rawDocs.find(d => d.key === 'identite_scan')?.name}</p>}
                                        <input title={t("Scan du document d'identité")} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => { const f = e.target.files; if (f && f[0]) { setRawDocs(p => [...p.filter(d => d.key !== 'identite_scan'), { key: 'identite_scan', label: "Document d'identité (scan)", name: f[0].name, file: f[0] }]) } }} />
                                    </label>
                                </div>

                                <div className="border-t border-gray-200 pt-5"><h3 className="text-sm font-black text-slate-900 mb-4"><T>Informations sur vos parents</T></h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{[t('Père'), 'Mère'].map(p => {
                                        const k = p === 'Père' ? 'pere' : 'mere';
                                        const f = form as Record<string, any>
                                        return (
                                            <div key={t(p)} className="space-y-3">
                                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">{t(p)}</span>
                                                <div><label className={LC}><T>Nom</T></label><input title={`Nom du ${t(p)}`} value={f[`${k}_nom`] || ''} onChange={e => u(`${k}_nom` as keyof NationaliteForm, e.target.value)} className={IC} placeholder={t('Nom')} /></div>
                                                <div><label className={LC}><T>Prénom(s)</T></label><input title={`Prénom du ${t(p)}`} value={f[`${k}_prenom`] || ''} onChange={e => u(`${k}_prenom` as keyof NationaliteForm, e.target.value)} className={IC} placeholder={t('Prénom(s)')} /></div>
                                                <div><label className={LC}><T>Date de naissance</T></label><input title={`Date de naissance du ${t(p)}`} type="date" value={f[`${k}_date_naissance`] || ''} onChange={e => u(`${k}_date_naissance` as keyof NationaliteForm, e.target.value)} className={IC} /></div>
                                            </div>
                                        )
                                    })}</div></div>

                                {/* Motivation et RGPD */}
                                <div className="border-t border-gray-200 pt-5 space-y-4">
                                    <h3 className="text-sm font-black text-slate-900"><T>Lettre de motivation</T></h3>
                                    <p className="text-[11px] text-gray-500"><T>Expliquez pourquoi cette démarche est importante pour vous. Ce texte sera joint a votre dossier.</T></p>
                                    <textarea title={t("Votre motivation")} rows={5} value={form.motivation_lettre} onChange={e => u('motivation_lettre', e.target.value)} placeholder={t('Rédigez ici votre motivation pour obtenir la nationalité béninoise...')} className={IC + ' resize-none'} />
                                </div>

                                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
                                    <button title={t("Consentement RGPD")} onClick={() => u('consentement_rgpd', !form.consentement_rgpd)} className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${form.consentement_rgpd ? 'bg-emerald-500' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${form.consentement_rgpd ? 'left-6' : 'left-0.5'}`} /></button>
                                    <span className="text-[11px] text-gray-500"><T>J&apos;accepte que mes données personnelles soient traitées dans le cadre de cette demande de nationalité, conformément à la politique de confidentialité de Retour Gagnant Benin.</T></span>
                                </div>
                            </div>}

                            {step === 4 && (() => {
                                const uploadedKeys = rawDocs.map(d => d.key)
                                const hasChildren = form.nombre_enfants > 0
                                const visibleSlots = docSlots.filter(s =>
                                    s.conditional !== 'has_children' || hasChildren
                                )
                                const obligatoires = visibleSlots.filter(s => s.required)
                                const facultatifs = visibleSlots.filter(s => !s.required)

                                const renderSlot = (doc: DocSlot) => {
                                    const uploaded = uploadedKeys.includes(doc.key)
                                    const isAncestral = doc.ancestral
                                    return (
                                        <div key={doc.key} className={`bg-gray-50 border rounded-xl p-4 flex items-center justify-between transition-all ${uploaded ? 'border-emerald-500/40 bg-emerald-500/5' : isAncestral ? 'border-amber-500/30 hover:border-amber-500/50 bg-amber-50/20' : 'border-gray-200 hover:border-emerald-500/20'}`}>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${uploaded ? 'bg-emerald-500/10' : isAncestral ? 'bg-amber-100' : 'bg-slate-100'}`}>
                                                    {uploaded ? <CheckCircle2 size={16} className="text-emerald-600" /> : <FileText size={16} className={isAncestral ? 'text-amber-700' : 'text-gray-500'} />}
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-sm text-slate-800 font-medium block truncate">
                                                        {t(doc.label)}
                                                        {doc.required && <span className="text-red-500 ml-1">*</span>}
                                                        {!doc.required && isAncestral && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">Ancestral</span>}
                                                        {!doc.required && !isAncestral && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Optionnel</span>}
                                                    </span>
                                                    {doc.hint && <p className="text-[10px] text-gray-500 mt-0.5">{doc.hint}</p>}
                                                </div>
                                            </div>
                                            <label className="cursor-pointer shrink-0 ml-3">
                                                <div className="text-right">
                                                    <p className="text-[10px] text-gray-400">{uploaded ? t('Modifier') : t('Choisir')}</p>
                                                    <p className="text-xs font-bold text-[#008751]">{doc.multi ? t('FICHIER(S)') : t('UN FICHIER')}</p>
                                                </div>
                                                <input title={t(doc.label)} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" multiple={doc.multi}
                                                    onChange={e => {
                                                        const f = e.target.files
                                                        if (f) {
                                                            const newDocs = Array.from(f).map(fi => ({ key: doc.key, label: doc.label, name: fi.name, file: fi }))
                                                            setRawDocs(p => [...p.filter(x => doc.multi || x.key !== doc.key), ...newDocs])
                                                        }
                                                    }} />
                                            </label>
                                        </div>
                                    )
                                }

                                return (
                                    <div className="space-y-5">
                                        <div>
                                            <h2 className="text-lg font-black text-slate-900"><T>Pièces à joindre</T></h2>
                                            <p className="text-xs text-gray-500 mt-1"><T>Formats : PNG, JPG, JPEG, PDF. Taille max : 5 Mo par fichier.</T></p>
                                        </div>

                                        {/* Avertissement docs ancestraux manquants */}
                                        {docWarnings.filter(w => docSlots.find(s => s.label === w && s.ancestral)).length > 0 && (
                                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                                <p className="text-xs font-bold text-amber-800 mb-1">Documents ancestraux manquants</p>
                                                <p className="text-[11px] text-amber-900 leading-relaxed">
                                                    Vous n'avez pas fourni certains actes d'état civil de vos ascendants. Vous pouvez soumettre votre dossier et les compléter dans un délai de 7 semaines — ou laisser notre service <strong>Recherche Ancestrale</strong> les retrouver pour vous (250 €).
                                                </p>
                                            </div>
                                        )}

                                        {/* Slots obligatoires */}
                                        <div className="space-y-3">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Documents obligatoires</p>
                                            {obligatoires.map(renderSlot)}
                                        </div>

                                        {/* Slots facultatifs */}
                                        <div className="space-y-3">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Documents complémentaires <span className="text-gray-400 font-normal normal-case tracking-normal">(facultatifs — peuvent être transmis dans les 7 semaines suivant la soumission)</span></p>
                                            {facultatifs.map(renderSlot)}
                                        </div>

                                        {/* Documents libres nommés — mode MyAfroOrigins */}
                                        {myafroMode && (
                                            <div className="space-y-3 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-4">
                                                <div>
                                                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Tous vos documents MyAfroOrigins</p>
                                                    <p className="text-[11px] text-gray-500 mt-1">Ajoutez ici <strong>autant de documents que vous le souhaitez</strong> et nommez chacun d&apos;eux (ex. « Acte de naissance grand-père », « Résultat ADN »…).</p>
                                                </div>
                                                {customDocs.map((d, i) => (
                                                    <div key={i} className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-2.5">
                                                        <input
                                                            value={d.name}
                                                            onChange={e => setCustomDocs(prev => prev.map((x, k) => k === i ? { ...x, name: e.target.value } : x))}
                                                            placeholder="Nom du document"
                                                            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-emerald-500/50"
                                                        />
                                                        <span className="text-[10px] text-gray-400 max-w-[110px] truncate">{d.file.name}</span>
                                                        <button type="button" onClick={() => setCustomDocs(prev => prev.filter((_, k) => k !== i))} title="Retirer" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><X size={15} /></button>
                                                    </div>
                                                ))}
                                                <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border border-emerald-300 bg-white py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 transition-colors">
                                                    <FileText size={16} /> Ajouter un document
                                                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={e => { const f = e.target.files; if (f && f[0]) { const file = f[0]; setCustomDocs(prev => [...prev, { name: file.name.replace(/\.[^.]+$/, ''), file }]); e.target.value = '' } }} />
                                                </label>
                                            </div>
                                        )}

                                        {myafroMode && (
                                            <div className="space-y-3 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/20 p-5 mt-4">
                                                <div className="flex items-center gap-2 text-emerald-800">
                                                    <Calendar size={18} className="shrink-0" />
                                                    <p className="text-sm font-black uppercase tracking-wider">Date d&apos;émission sur MyAfroOrigins</p>
                                                </div>
                                                <p className="text-[11px] text-gray-500">
                                                    Indiquez depuis combien de temps exactement ou la date exacte à laquelle votre dossier a été fait sur la plateforme MyAfroOrigins (pour permettre des alertes de suivi).
                                                </p>
                                                <input
                                                    type="text"
                                                    value={form.myafro_date || ''}
                                                    onChange={e => setForm(prev => ({ ...prev, myafro_date: e.target.value }))}
                                                    placeholder="Ex: 15/04/2024, ou Depuis 6 mois, ou 1 an..."
                                                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-emerald-500/50"
                                                />
                                            </div>
                                        )}

                                        {/* Fichiers ajoutés */}
                                        {rawDocs.length > 0 && (
                                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-3">
                                                <p className="text-xs font-bold text-[#008751] uppercase tracking-wider">{t("Fichiers ajoutés")} ({rawDocs.length})</p>
                                                {rawDocs.map((d, i) => {
                                                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(d.name)
                                                    return (
                                                        <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2">
                                                            {isImage ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img src={URL.createObjectURL(d.file)} alt={d.label} className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
                                                            ) : (
                                                                <div className="w-14 h-14 flex items-center justify-center bg-slate-100 rounded-lg border border-gray-200"><FileText size={20} className="text-gray-500" /></div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs text-slate-800 font-bold truncate">{t(d.label)}</p>
                                                                <p className="text-[10px] text-gray-500 truncate">{d.name} — {(d.file.size / 1024).toFixed(0)} Ko</p>
                                                            </div>
                                                            <button type="button" title={t("Supprimer")} onClick={() => setRawDocs(p => p.filter((_, idx) => idx !== i))} className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-50/10 rounded-lg transition-all"><X size={14} /></button>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}

                            {step === 6 && <div className="space-y-5">
                                <h2 className="text-lg font-black text-slate-900">{resumeMode ? <T>Finalisation de votre dossier</T> : <T>Paiement des frais de traitement</T>}</h2>
                                {!resumeMode && (
                                    <div className="bg-gradient-to-r from-emerald-50 to-amber-50/50 border border-emerald-100 rounded-2xl p-6 text-center shadow-sm">
                                        <p className="text-3xl font-black text-[#008751]"><Price amount={fromHt(formAmount, formCurrency).ttc} currency={formCurrency} showOriginal /></p>
                                        <p className="text-xs text-gray-500 mt-1"><T>Frais de traitement de dossier</T> · <T>TVA 18% incluse</T></p>
                                    </div>
                                )}

                                {resumeMode ? (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center shadow-sm">
                                        <CheckCircle2 size={32} className="text-emerald-600 mx-auto mb-2" />
                                        <p className="text-sm font-bold text-emerald-700"><T>Vos frais de traitement sont déjà réglés.</T></p>
                                        <p className="text-xs text-gray-500 mt-1"><T>Il ne vous reste plus qu&apos;à confirmer l&apos;envoi de vos pièces justificatives.</T></p>
                                    </div>
                                ) : paymentDone ? (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center shadow-sm">
                                        <CheckCircle2 size={32} className="text-emerald-600 mx-auto mb-2" />
                                        <p className="text-sm font-bold text-emerald-700"><T>Paiement effectué via</T> {paymentProvider}</p>
                                        {paymentTxId && <p className="text-[10px] text-gray-500 mt-1 font-mono">TX: {paymentTxId}</p>}
                                    </div>
                                ) : paymentProcessing ? (
                                    <div className="flex flex-col items-center py-8">
                                        <Loader2 size={32} className="animate-spin text-[#008751]" />
                                        <p className="text-sm text-gray-500 mt-3"><T>Traitement en cours...</T></p>
                                        <p className="text-xs text-gray-400 mt-2 text-center max-w-xs"><T>Finalisez le paiement dans la fenêtre sécurisée. Avec une carte bancaire hors zone UEMOA (Canada, Europe…), privilégiez le Mobile Money.</T></p>
                                        <button
                                            type="button"
                                            onClick={() => { setPaymentProcessing(false); setPaymentError(t('Paiement annulé. Vous pouvez réessayer ou choisir un autre moyen de paiement.')) }}
                                            className="mt-4 text-xs font-bold text-gray-500 underline hover:text-[#008751]"
                                        >
                                            <T>La fenêtre s&apos;est fermée ou reste bloquée ? Cliquez ici pour réessayer</T>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-xs text-gray-500 font-bold"><T>Sélectionnez votre moyen de paiement :</T></p>
                                        {providers.length === 0 ? (
                                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center"><CreditCard size={24} className="text-gray-400 mx-auto mb-2" /><p className="text-xs text-amber-800"><T>Aucune passerelle de paiement active. Contactez l&apos;administrateur.</T></p></div>
                                        ) : providers.map(p => (
                                            <button key={p.id} title={`Payer avec ${p.name}`} onClick={payHandlers[p.id]} className={`w-full flex items-center gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/50 transition-all group text-left`}>
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border ${p.color}`}><CreditCard size={22} /></div>
                                                <div className="flex-1"><p className="text-sm font-bold text-gray-900 group-hover:text-[#008751] transition-colors">{p.name}</p><p className="text-[10px] text-gray-500 uppercase tracking-widest">{p.subtitle}</p></div>
                                                <ChevronRight size={18} className="text-gray-400 group-hover:text-gray-900 transition-colors" />
                                            </button>
                                        ))}
                                        {paymentError && <p className="text-xs text-red-700 flex items-center gap-2"><AlertCircle size={12} /> {paymentError}</p>}
                                        <PaymentPrivacyNotice />
                                        <div className="flex items-center gap-2 text-gray-400 justify-center mt-2"><Shield size={14} /><span className="text-[10px] font-bold uppercase tracking-widest"><T>Transaction 100% sécurisée</T></span></div>
                                    </div>
                                )}
                            </div>}

                            {step === 5 && <div className="space-y-5">
                                <h2 className="text-lg font-black text-slate-900"><T>Récapitulatif de votre demande</T></h2>
                                <p className="text-xs text-gray-500"><T>Vérifiez attentivement vos informations avant de procéder au paiement.</T></p>
                                {[
                                    { title: t('Identité'), items: [[t('Nom complet'), `${form.prenom} ${form.nom}`], [t('Genre'), form.genre], [t('Né(e) le'), form.date_naissance], [t('Nationalité'), form.nationalite], [t('Résidence'), `${form.adresse_residence ? form.adresse_residence + ', ' : ''}${form.pays_residence}`], [t('Email'), form.email], [t('Téléphone'), form.telephone], [t('Profession'), form.profession]] },
                                    { title: t('Afro-descendance'), items: [[t('Description'), form.afro_descendant_description], [t('Ancêtre 1'), `${form.ancestor1_prenom} ${form.ancestor1_nom} — ${form.ancestor1_lien_parente}`], ...(form.ancestor2_nom ? [[t('Ancêtre 2'), `${form.ancestor2_prenom} ${form.ancestor2_nom} — ${form.ancestor2_lien_parente}`]] : []), ...(myafroMode ? [[t('Date MyAfroOrigins'), form.myafro_date]] : [])] },
                                    { title: t("Document d'identité"), items: [[t('Type'), form.type_document_identite], [t('Numéro'), form.numero_document], [t('Pays délivrance'), form.pays_delivrance], [t('Expiration'), form.date_expiration_document]] },
                                    { title: t('Parents'), items: [[t('Père'), `${form.pere_prenom} ${form.pere_nom}`], [t('Mère'), `${form.mere_prenom} ${form.mere_nom}`]] },
                                ].map((sec, si) => (
                                    <div key={si} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                        <h3 className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.2em] mb-2">{sec.title}</h3>
                                        {sec.items.filter(([, v]) => v).map(([k, v], i) => <div key={i} className="flex justify-between py-1 border-b border-gray-200/50 last:border-0"><span className="text-xs text-gray-500">{k}</span><span className="text-xs text-slate-800 font-bold text-right max-w-[60%]">{v}</span></div>)}
                                    </div>
                                ))}
                                {/* Pièces jointes avec aperçu */}
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                    <h3 className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.2em] mb-3">{t("Pièces jointes")} ({rawDocs.length})</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {rawDocs.map((d, i) => {
                                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(d.name)
                                            return (
                                                <div key={i} className="bg-gray-50 rounded-lg p-2 text-center">
                                                    {isImage ? (<>
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        < img src={URL.createObjectURL(d.file)} alt={d.label} className="w-full h-20 object-cover rounded-lg mb-1.5" />
                                                    </>) : (
                                                        <div className="w-full h-20 flex items-center justify-center bg-slate-100 rounded-lg mb-1.5"><FileText size={24} className="text-gray-500" /></div>
                                                    )}
                                                    <p className="text-[10px] text-slate-800 font-bold truncate">{t(d.label)}</p>
                                                    <p className="text-[8px] text-gray-500 truncate">{d.name}</p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                                {/* Montant à régler */}
                                <div className="bg-gradient-to-r from-emerald-50 to-amber-50/50 border border-emerald-100 rounded-2xl p-5 text-center">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1"><T>Montant à régler à l&apos;étape suivante</T> · <T>TVA 18% incluse</T></p>
                                    <p className="text-2xl font-black text-[#008751]"><Price amount={fromHt(formAmount, formCurrency).ttc} currency={formCurrency} showOriginal /></p>
                                </div>
                            </div>}
                        </div>
                    </motion.div>
                </AnimatePresence>

                <div className="flex items-center justify-between mt-6">
                    {step > 1 ? <button onClick={prev} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors font-bold"><ArrowLeft size={16} /> <T>Précédent</T></button> : <div />}
                    {step < 6 ? (
                        <button onClick={next} className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.2)]"><T>Suivant</T> <ArrowRight size={16} /></button>
                    ) : (
                        <button onClick={submit} disabled={submitting || !paymentDone} className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black text-sm px-8 py-3 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                            {submitting ? <><Loader2 size={16} className="animate-spin" /> <T>Envoi...</T></> : !paymentDone ? <><CreditCard size={16} /> Payez d&apos;abord</> : resumeMode ? <><Send size={16} /> <T>Envoyer mes documents</T></> : <><Send size={16} /> <T>Confirmer et Soumettre</T></>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
