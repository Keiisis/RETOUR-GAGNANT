'use client'

/**
 * Service « Récap de dossier MyAfroOrigins ».
 *
 * Le cas est précis : la demande a été déposée sur MyAfroOrigins, et depuis,
 * rien. Pas de refus, pas d'explication — le silence. Jusqu'ici, la reprise
 * partait toujours du cabinet (un agent envoyait un lien). Cette page renverse
 * le sens : le client raconte, règle 50 €, et reçoit une fiche d'analyse.
 *
 * Le tarif vient de `page_sections` et le serveur le revérifie à
 * l'encaissement — leçon du 2026-08-19, où un tarif d'attente affiché dans le
 * navigateur avait donné « 0,39 € » à l'écran.
 *
 * Données personnelles : consentement explicite, jamais pré-coché, et
 * information complète affichée avant la case (loi n° 2017-20 portant Code du
 * numérique en République du Bénin — autorité : APDP).
 */
import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
    ArrowRight, ShieldCheck, Clock, FileSearch, CheckCircle2, AlertTriangle,
    ListOrdered, HandHeart, Lock, Mail, Phone, User, Globe2, ChevronDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/lib/translation'
import { Price } from '@/components/ui/Price'
import { CurrencyCode, convertCurrency } from '@/lib/currency'
import { ttcFromHt } from '@/lib/tax'

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        openKkiapayWidget: (config: any) => void
        addKkiapayListener: (event: string, callback: (data: Record<string, unknown>) => void) => void
        FedaPay: { init: (selector: string, config: Record<string, unknown>) => void }
    }
}

/** Ce que la fiche contient — annoncé avant l'achat, tenu après. */
const LIVRABLE = [
    { Icone: FileSearch, titre: 'Votre situation, reformulée', desc: 'Ce que nous avons compris de votre dossier, écrit noir sur blanc. Vous corrigez si nous nous trompons.' },
    { Icone: AlertTriangle, titre: 'Ce qui bloque, par ordre de gravité', desc: 'Ce qui relève de la plateforme, ce qui relève de vos pièces, ce qui relève de l’état civil béninois.' },
    { Icone: ListOrdered, titre: 'Les pièces à réunir', desc: 'La liste exacte, dans l’ordre où les obtenir — pas une liste théorique de tout ce qui existe.' },
    { Icone: HandHeart, titre: 'La marche à suivre', desc: 'Étape par étape, une action à la fois. Et ce que le cabinet prend en charge pour vous.' },
]

const RECONNAISSANCE = [
    'Vous avez déposé votre demande il y a plusieurs mois et vous n’avez aucune nouvelle.',
    'Vous ne savez pas si votre dossier est incomplet, en attente, ou perdu.',
    'On vous a réclamé des pièces sans vous dire lesquelles manquent réellement.',
    'Vous ne savez plus à qui écrire ni quoi demander.',
]

const FAQ = [
    {
        q: 'Est-ce que vous garantissez l’obtention de la nationalité ?',
        r: 'Non, et personne ne peut le faire honnêtement. Ce service vous dit précisément où en est votre dossier, ce qui le bloque et comment le débloquer. La décision appartient aux autorités béninoises.',
    },
    {
        q: 'Faut-il envoyer mes pièces d’identité maintenant ?',
        r: 'Non. À cette étape, nous ne demandons que votre identité de contact et le récit de votre situation. Les pièces ne sont demandées qu’ensuite, si l’analyse montre qu’elles sont nécessaires.',
    },
    {
        q: 'Sous combien de temps ai-je la fiche ?',
        r: 'Sous 48 heures ouvrées. Vous recevez d’abord un email de confirmation avec votre référence, puis la fiche relue par un analyste.',
    },
    {
        q: 'Et si mon dossier n’a jamais existé chez MyAfroOrigins ?',
        r: 'Dites-le simplement dans votre description. L’analyse portera alors sur la constitution d’un dossier neuf, et nous vous indiquerons par quoi commencer.',
    },
    {
        q: 'Que devenez-vous mes données ?',
        r: 'Elles servent uniquement à traiter votre demande, sont conservées trois ans, et vous pouvez à tout moment demander à les consulter, les corriger ou les faire effacer.',
    },
]

type Provider = 'kkiapay' | 'fedapay'

export default function RecapMyafroOriginsPage() {
    const { t } = useTranslation()

    // Tarif officiel : `null` tant que la base n'a pas répondu. Aucun montant
    // d'attente n'est affiché ni facturé.
    const [tarif, setTarif] = useState<number | null>(null)
    const [devise, setDevise] = useState<CurrencyCode>('EUR')
    const [delai, setDelai] = useState('48 heures ouvrées')
    const [reglages, setReglages] = useState<Record<string, string>>({})

    const [form, setForm] = useState({
        prenom: '', nom: '', email: '', telephone: '', pays_residence: '',
        myafro_reference: '', depuis_quand: '', situation: '', attentes: '',
    })
    const [consentement, setConsentement] = useState(false)
    const [faqOuverte, setFaqOuverte] = useState<number | null>(null)

    const [paiementFait, setPaiementFait] = useState(false)
    const [txId, setTxId] = useState('')
    const [provider, setProvider] = useState<Provider>('kkiapay')
    const [enCours, setEnCours] = useState(false)
    const [erreur, setErreur] = useState('')
    const [envoi, setEnvoi] = useState(false)
    const [reference, setReference] = useState('')
    const listenersPoses = useRef(false)

    useEffect(() => {
        fetch('/api/settings/payment').then(r => r.json()).then(setReglages).catch(() => { })
        supabase.from('page_sections').select('content')
            .eq('page', 'recap-myafroorigins').eq('section_key', 'form_settings').single()
            .then(({ data }) => {
                const c = (data?.content || {}) as Record<string, unknown>
                setTarif(Number(c.amount) > 0 ? Number(c.amount) : 50)
                if (c.currency) setDevise(String(c.currency) as CurrencyCode)
                if (c.delai) setDelai(String(c.delai))
            })
    }, [])

    const champsRemplis = !!(form.prenom.trim() && form.nom.trim() && form.email.trim()
        && form.telephone.trim() && form.situation.trim().length >= 40)
    const pretAPayer = champsRemplis && consentement && tarif !== null

    const montantXof = tarif === null
        ? 0
        : ttcFromHt(devise === 'XOF' ? tarif : convertCurrency(tarif, devise, 'XOF'), 'XOF')

    const poserListeners = () => {
        if (listenersPoses.current || typeof window.addKkiapayListener !== 'function') return
        listenersPoses.current = true
        window.addKkiapayListener('success', (r) => {
            setTxId(String(r.transactionId || r.transaction_id || ''))
            setPaiementFait(true); setEnCours(false)
        })
        window.addKkiapayListener('failed', () => {
            setErreur(t('Le paiement n’a pas abouti. Si votre carte est hors zone UEMOA, essayez le Mobile Money.'))
            setEnCours(false)
        })
    }

    const payerKkiapay = () => {
        setErreur('')
        // Le tarif n'est pas encore lu en base : on refuse plutôt que d'encaisser
        // une valeur d'attente.
        if (tarif === null) { setErreur(t('Tarif en cours de chargement. Réessayez dans un instant.')); return }
        if (typeof window.openKkiapayWidget !== 'function') {
            setErreur(t('Le module de paiement n’est pas encore chargé. Patientez une seconde.')); return
        }
        const sandbox = reglages.kkiapay_sandbox === 'true'
        const cle = sandbox ? (reglages.kkiapay_sandbox_public_key || reglages.kkiapay_public_key) : reglages.kkiapay_public_key
        if (!cle) { setErreur(t('Paiement momentanément indisponible. Contactez-nous.')); return }

        setProvider('kkiapay'); setEnCours(true)
        try {
            poserListeners()
            window.openKkiapayWidget({
                amount: montantXof,
                position: 'center',
                key: cle,
                sandbox,
                email: form.email || undefined,
                phone: form.telephone || undefined,
                name: `${form.prenom} ${form.nom}`.trim() || undefined,
                data: JSON.stringify({ context: 'recap-myafroorigins', email: form.email }),
            })
        } catch { setErreur(t('Impossible d’ouvrir le module de paiement.')); setEnCours(false) }
    }

    const payerFedapay = () => {
        setErreur('')
        if (tarif === null) { setErreur(t('Tarif en cours de chargement. Réessayez dans un instant.')); return }
        if (!reglages.fedapay_public_key) { setErreur(t('FedaPay indisponible.')); return }
        setProvider('fedapay'); setEnCours(true)
        try {
            window.FedaPay.init('#fedapay-recap-btn', {
                public_key: reglages.fedapay_public_key,
                environment: reglages.fedapay_sandbox === 'true' ? 'sandbox' : 'live',
                transaction: { amount: montantXof, description: `Récap de dossier MyAfroOrigins — ${form.prenom} ${form.nom}` },
                customer: { email: form.email || undefined, phone_number: { number: form.telephone } },
                onComplete: (resp: Record<string, unknown>) => {
                    const tx = resp.transaction as Record<string, unknown> | undefined
                    if (resp.reason === 'APPROVED' || (tx && tx.status === 'approved')) {
                        setTxId(String(tx?.id || resp.id || '')); setPaiementFait(true)
                    } else { setErreur(t('Paiement FedaPay non approuvé.')) }
                    setEnCours(false)
                },
            })
        } catch { setErreur(t('Impossible d’initialiser FedaPay.')); setEnCours(false) }
    }

    /* Le dépôt part APRÈS le paiement : le serveur revérifie la transaction et
       le montant avant d'enregistrer la moindre donnée. */
    useEffect(() => {
        if (!paiementFait || !txId || envoi || reference) return
        const envoyer = async () => {
            setEnvoi(true); setErreur('')
            try {
                const res = await fetch('/api/services/recap-myafroorigins', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...form,
                        consentement,
                        payment_provider: provider,
                        payment_ref: txId,
                    }),
                })
                const json = await res.json().catch(() => ({}))
                if (!res.ok || !json.success) throw new Error(json.error || t('Enregistrement impossible.'))
                setReference(String(json.reference))
            } catch (e) {
                setErreur(e instanceof Error ? e.message : t('Enregistrement impossible.'))
            } finally { setEnvoi(false) }
        }
        envoyer()
    }, [paiementFait, txId]) // eslint-disable-line react-hooks/exhaustive-deps

    /* ══ Confirmation ══ */
    if (reference) {
        return (
            <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center px-4 py-20">
                <motion.div
                    initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                    className="max-w-lg w-full bg-white border border-[#e7e1d8] rounded-3xl shadow-[0_8px_40px_rgba(28,25,23,0.06)] p-8 text-center"
                >
                    <div className="w-16 h-16 rounded-full bg-[#008751]/10 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={30} className="text-[#008751]" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#008751] mb-3">{t('Demande enregistrée')}</p>
                    <h1 className="font-display text-3xl font-bold text-[#1c1917] mb-3">{t('Votre dossier est entre nos mains')}</h1>
                    <p className="text-[#57534e] leading-relaxed mb-6">
                        {t('Un analyste reprend votre situation. Vous recevez votre fiche sous {d}.', { d: delai })}
                    </p>
                    <div className="bg-[#fdfbf7] border border-[#e7e1d8] rounded-2xl px-5 py-4 mb-6">
                        <p className="text-[10px] uppercase tracking-widest text-[#a8a29e] font-bold">{t('Votre référence')}</p>
                        <p className="font-mono text-lg font-bold text-[#1c1917] mt-1">{reference}</p>
                    </div>
                    <Link href="/" className="inline-flex items-center gap-2 bg-[#008751] hover:bg-[#007445] text-white font-bold text-sm px-7 py-3.5 rounded-2xl transition-all">
                        {t('Retour à l’accueil')} <ArrowRight size={16} />
                    </Link>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#fdfbf7]">
            <Script src="https://cdn.kkiapay.me/k.js" strategy="lazyOnload" />
            <Script src="https://cdn.fedapay.com/checkout.js?v=1.1.7" strategy="lazyOnload" />

            {/* ═══ HERO ═══ */}
            <section className="relative min-h-[86vh] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,135,81,0.10),transparent_65%)]" />
                <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#008751]/12 to-transparent" />
                <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-[#FCD116]/20 to-transparent" />

                <motion.div
                    initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10 text-center px-4 max-w-4xl mx-auto py-24"
                >
                    <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-xl border border-[#008751]/15 shadow-[0_2px_16px_rgba(0,135,81,0.08)] rounded-full px-5 py-2 mb-8">
                        <FileSearch size={14} className="text-[#008751]" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#008751]">{t('Reprise de dossier')}</span>
                    </div>

                    <h1 className="font-display text-4xl sm:text-5xl md:text-[4.75rem] font-bold text-[#1c1917] leading-[1.04] tracking-tight mb-5 text-balance">
                        {t('Votre dossier MyAfroOrigins')}
                        <br />
                        <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-[#008751] via-[#C79A0A] to-[#E8112D]">
                            {t('n’avance plus ?')}
                        </span>
                    </h1>

                    <p className="text-base md:text-lg text-[#57534e] max-w-2xl mx-auto mb-10 leading-relaxed text-pretty">
                        {t('Vous avez déposé votre demande, et depuis, le silence. Nous reprenons votre situation, nous l’analysons, et nous vous remettons une fiche claire : ce qui bloque, ce qui manque, et par quoi commencer.')}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                        <a href="#demande" className="group bg-[#008751] hover:bg-[#007445] text-white font-bold text-sm px-8 py-4 rounded-2xl transition-all duration-300 shadow-[0_8px_28px_rgba(0,135,81,0.28)] hover:shadow-[0_12px_36px_rgba(0,135,81,0.36)] hover:-translate-y-0.5 flex items-center gap-3">
                            {t('Demander mon récap')} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </a>
                        <div className="flex items-center gap-3 bg-white/90 backdrop-blur-sm border border-[#e7e1d8] shadow-[0_4px_20px_rgba(28,25,23,0.06)] rounded-2xl px-6 py-4">
                            <span className="font-display text-3xl font-bold text-[#008751] tabular-nums">
                                {tarif === null ? <span className="text-[#a8a29e]">…</span> : <Price amount={tarif} currency={devise} />}
                            </span>
                            <div className="text-left">
                                <p className="text-[10px] text-[#78716c] font-bold uppercase tracking-wider">{t('Fiche d’analyse')}</p>
                                <p className="text-[10px] text-[#a8a29e] flex items-center gap-1"><Clock size={10} /> {delai}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-6 flex-wrap">
                        {['Analyse par un humain', 'Aucune pièce à fournir maintenant', 'Données protégées'].map((txt, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] text-[#57534e] font-bold uppercase tracking-wider">
                                <CheckCircle2 size={12} className="text-[#008751]" /> {t(txt)}
                            </div>
                        ))}
                    </div>
                </motion.div>
            </section>

            {/* ═══ RECONNAISSANCE ═══ */}
            <section className="py-16 md:py-24 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#008751]">{t('Vous vous reconnaissez ?')}</span>
                        <h2 className="font-display text-3xl md:text-5xl font-bold text-[#1c1917] mt-3">{t('Le silence n’est pas une réponse')}</h2>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {RECONNAISSANCE.map((txt, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                                transition={{ delay: i * 0.08, duration: 0.5 }}
                                className="flex items-start gap-4 bg-white border border-[#e7e1d8] rounded-2xl p-6"
                            >
                                <span className="font-display text-2xl font-bold text-[#008751]/25 leading-none">{String(i + 1).padStart(2, '0')}</span>
                                <p className="text-[#57534e] leading-relaxed">{t(txt)}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ LE LIVRABLE ═══ */}
            <section className="py-16 md:py-24 px-4 bg-white border-y border-[#e7e1d8]">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#008751]">{t('Ce que vous recevez')}</span>
                        <h2 className="font-display text-3xl md:text-5xl font-bold text-[#1c1917] mt-3">{t('Une fiche, pas une promesse')}</h2>
                        <p className="text-[#57534e] max-w-2xl mx-auto mt-4 leading-relaxed">
                            {t('Un document écrit, à conserver et à montrer. Quatre parties, aucune formule creuse.')}
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">
                        {LIVRABLE.map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                                transition={{ delay: i * 0.08, duration: 0.5 }}
                                className="bg-[#fdfbf7] border border-[#e7e1d8] rounded-2xl p-7"
                            >
                                <div className="w-11 h-11 rounded-xl bg-[#008751]/10 flex items-center justify-center mb-4">
                                    <item.Icone size={20} className="text-[#008751]" />
                                </div>
                                <h3 className="font-display text-xl font-bold text-[#1c1917] mb-2">{t(item.titre)}</h3>
                                <p className="text-sm text-[#57534e] leading-relaxed">{t(item.desc)}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ FORMULAIRE ═══ */}
            <section id="demande" className="py-16 md:py-24 px-4 scroll-mt-20">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-12">
                        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#008751]">{t('Votre demande')}</span>
                        <h2 className="font-display text-3xl md:text-5xl font-bold text-[#1c1917] mt-3">{t('Racontez-nous')}</h2>
                        <p className="text-[#57534e] max-w-xl mx-auto mt-4 leading-relaxed">
                            {t('Plus votre récit est précis, plus l’analyse est utile. Prenez le temps : c’est la matière de votre fiche.')}
                        </p>
                    </div>

                    <div className="bg-white border border-[#e7e1d8] rounded-3xl shadow-[0_8px_40px_rgba(28,25,23,0.05)] p-6 md:p-10 space-y-6">
                        <div className="grid sm:grid-cols-2 gap-4">
                            {[
                                { k: 'prenom' as const, l: 'Prénom', Icone: User, req: true, type: 'text' },
                                { k: 'nom' as const, l: 'Nom', Icone: User, req: true, type: 'text' },
                                { k: 'email' as const, l: 'Email', Icone: Mail, req: true, type: 'email' },
                                { k: 'telephone' as const, l: 'Téléphone / WhatsApp', Icone: Phone, req: true, type: 'tel' },
                            ].map(ch => (
                                <div key={ch.k}>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#78716c] mb-2">
                                        {t(ch.l)} {ch.req && <span className="text-[#E8112D]">*</span>}
                                    </label>
                                    <div className="flex items-center gap-3 bg-[#fdfbf7] border border-[#e7e1d8] rounded-xl px-4 py-3 focus-within:border-[#008751] transition-colors">
                                        <ch.Icone size={16} className="text-[#008751] shrink-0" />
                                        <input
                                            type={ch.type}
                                            value={form[ch.k]}
                                            onChange={e => setForm(f => ({ ...f, [ch.k]: e.target.value }))}
                                            disabled={paiementFait}
                                            className="w-full bg-transparent text-sm font-semibold text-[#1c1917] outline-none disabled:opacity-60"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid sm:grid-cols-3 gap-4">
                            {[
                                { k: 'pays_residence' as const, l: 'Pays de résidence', ph: 'France, Martinique…' },
                                { k: 'myafro_reference' as const, l: 'Réf. MyAfroOrigins', ph: 'si vous l’avez' },
                                { k: 'depuis_quand' as const, l: 'Sans nouvelle depuis', ph: '8 mois…' },
                            ].map(ch => (
                                <div key={ch.k}>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#78716c] mb-2">{t(ch.l)}</label>
                                    <input
                                        value={form[ch.k]}
                                        onChange={e => setForm(f => ({ ...f, [ch.k]: e.target.value }))}
                                        placeholder={t(ch.ph)}
                                        disabled={paiementFait}
                                        className="w-full bg-[#fdfbf7] border border-[#e7e1d8] rounded-xl px-4 py-3 text-sm font-semibold text-[#1c1917] outline-none focus:border-[#008751] transition-colors placeholder:font-normal placeholder:text-[#a8a29e] disabled:opacity-60"
                                    />
                                </div>
                            ))}
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#78716c] mb-2">
                                {t('Votre situation')} <span className="text-[#E8112D]">*</span>
                            </label>
                            <textarea
                                value={form.situation}
                                onChange={e => setForm(f => ({ ...f, situation: e.target.value }))}
                                rows={7}
                                maxLength={4000}
                                disabled={paiementFait}
                                placeholder={t('Quand avez-vous déposé votre demande ? Qu’avez-vous fourni ? Qu’est-ce qu’on vous a répondu, s’il y a eu une réponse ? Qu’est-ce qui vous semble bloquer ?')}
                                className="w-full bg-[#fdfbf7] border border-[#e7e1d8] rounded-xl px-4 py-3 text-sm text-[#1c1917] leading-relaxed outline-none focus:border-[#008751] transition-colors placeholder:text-[#a8a29e] disabled:opacity-60"
                            />
                            <div className="flex justify-between mt-2">
                                <p className={`text-[11px] ${form.situation.trim().length >= 40 ? 'text-[#008751]' : 'text-[#a8a29e]'}`}>
                                    {form.situation.trim().length < 40
                                        ? t('Encore {n} caractères pour une analyse exploitable.', { n: 40 - form.situation.trim().length })
                                        : t('Merci, c’est suffisamment précis.')}
                                </p>
                                <p className="text-[11px] text-[#a8a29e]">{form.situation.length}/4000</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#78716c] mb-2">{t('Ce que vous attendez de nous')}</label>
                            <textarea
                                value={form.attentes}
                                onChange={e => setForm(f => ({ ...f, attentes: e.target.value }))}
                                rows={3}
                                maxLength={2000}
                                disabled={paiementFait}
                                className="w-full bg-[#fdfbf7] border border-[#e7e1d8] rounded-xl px-4 py-3 text-sm text-[#1c1917] outline-none focus:border-[#008751] transition-colors disabled:opacity-60"
                            />
                        </div>

                        {/* ── Information et consentement ── */}
                        <div className="bg-[#fdfbf7] border border-[#e7e1d8] rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <Lock size={15} className="text-[#008751]" />
                                <p className="text-[11px] font-bold uppercase tracking-widest text-[#1c1917]">{t('Protection de vos données')}</p>
                            </div>
                            <ul className="space-y-1.5 text-[12px] text-[#57534e] leading-relaxed mb-4">
                                <li>· {t('Responsable du traitement : Cabinet Retour Gagnant Bénin.')}</li>
                                <li>· {t('Finalité : analyser votre dossier et vous remettre votre fiche. Rien d’autre.')}</li>
                                <li>· {t('Destinataires : nos analystes uniquement. Aucune revente, aucun partage commercial.')}</li>
                                <li>· {t('Conservation : 3 ans, puis effacement.')}</li>
                                <li>· {t('Vos droits : accès, rectification, effacement, opposition — par simple email.')}</li>
                                <li>· {t('Traitement conforme à la loi n° 2017-20 portant Code du numérique en République du Bénin (APDP).')}</li>
                            </ul>
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={consentement}
                                    onChange={e => setConsentement(e.target.checked)}
                                    disabled={paiementFait}
                                    className="mt-0.5 w-4 h-4 accent-[#008751] shrink-0"
                                />
                                <span className="text-[12.5px] text-[#1c1917] leading-relaxed">
                                    {t('Je consens au traitement des informations ci-dessus pour l’analyse de mon dossier.')}
                                    <span className="text-[#E8112D]"> *</span>
                                </span>
                            </label>
                        </div>

                        {!!erreur && (
                            <div className="bg-[#E8112D]/8 border border-[#E8112D]/25 rounded-xl px-4 py-3">
                                <p className="text-sm text-[#E8112D] font-semibold">{erreur}</p>
                            </div>
                        )}

                        {/* ── Règlement ── */}
                        <div className="border-t border-[#e7e1d8] pt-6">
                            <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#78716c]">{t('Montant à régler')}</p>
                                    <p className="font-display text-3xl font-bold text-[#008751] mt-1">
                                        {tarif === null ? '…' : <Price amount={tarif} currency={devise} />}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-[#78716c]">
                                    <ShieldCheck size={14} className="text-[#008751]" />
                                    {t('Règlement vérifié auprès de la passerelle')}
                                </div>
                            </div>

                            {envoi ? (
                                <div className="flex items-center justify-center gap-3 py-4 text-[#008751] font-bold text-sm">
                                    <span className="w-4 h-4 border-2 border-[#008751]/30 border-t-[#008751] rounded-full animate-spin" />
                                    {t('Enregistrement de votre demande…')}
                                </div>
                            ) : (
                                <div className="grid sm:grid-cols-2 gap-3">
                                    <button
                                        onClick={payerKkiapay}
                                        disabled={!pretAPayer || enCours || paiementFait}
                                        className="bg-[#008751] hover:bg-[#007445] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm px-6 py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                                    >
                                        {enCours && provider === 'kkiapay'
                                            ? t('Ouverture du paiement…')
                                            : t('Payer par Mobile Money / Carte')}
                                    </button>
                                    <button
                                        id="fedapay-recap-btn"
                                        onClick={payerFedapay}
                                        disabled={!pretAPayer || enCours || paiementFait || reglages.fedapay_enabled !== 'true'}
                                        className="bg-white border border-[#e7e1d8] hover:border-[#008751]/40 disabled:opacity-40 disabled:cursor-not-allowed text-[#1c1917] font-bold text-sm px-6 py-4 rounded-2xl transition-all"
                                    >
                                        {t('Payer par FedaPay')}
                                    </button>
                                </div>
                            )}

                            {!pretAPayer && !envoi && (
                                <p className="text-[11px] text-[#a8a29e] text-center mt-3">
                                    {tarif === null
                                        ? t('Chargement du tarif…')
                                        : !champsRemplis
                                            ? t('Complétez les champs obligatoires pour continuer.')
                                            : t('Votre consentement est nécessaire pour poursuivre.')}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ FAQ ═══ */}
            <section className="py-16 md:py-24 px-4 bg-white border-t border-[#e7e1d8]">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-12">
                        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#008751]">{t('Questions')}</span>
                        <h2 className="font-display text-3xl md:text-5xl font-bold text-[#1c1917] mt-3">{t('Ce qu’on nous demande')}</h2>
                    </div>
                    <div className="space-y-3">
                        {FAQ.map((item, i) => (
                            <div key={i} className="bg-[#fdfbf7] border border-[#e7e1d8] rounded-2xl overflow-hidden">
                                <button
                                    onClick={() => setFaqOuverte(faqOuverte === i ? null : i)}
                                    className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                                >
                                    <span className="font-bold text-[#1c1917] text-sm">{t(item.q)}</span>
                                    <ChevronDown size={18} className={`text-[#008751] shrink-0 transition-transform ${faqOuverte === i ? 'rotate-180' : ''}`} />
                                </button>
                                {faqOuverte === i && (
                                    <motion.p
                                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                        className="px-6 pb-5 text-sm text-[#57534e] leading-relaxed"
                                    >
                                        {t(item.r)}
                                    </motion.p>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-12 flex items-center justify-center gap-3 text-[11px] text-[#a8a29e]">
                        <Globe2 size={13} className="text-[#008751]" />
                        {t('Cabinet Retour Gagnant Bénin · Accompagnement des afro-descendants')}
                    </div>
                </div>
            </section>
        </div>
    )
}
