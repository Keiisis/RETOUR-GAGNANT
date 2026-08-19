'use client'

/**
 * Dépôt d'une demande de « Récap de dossier MyAfroOrigins ».
 *
 * Le client raconte sa situation, règle 50 €, et le serveur enregistre —
 * dans cet ordre. Le paiement est PROUVÉ côté serveur avant la moindre
 * écriture : transaction confrontée à la passerelle, puis montant comparé au
 * tarif lu en base (leçon du 2026-08-19, où un tarif d'attente affiché dans
 * le navigateur avait donné « 0,39 € » à l'écran).
 *
 * Données personnelles : consentement explicite, jamais pré-coché, précédé de
 * l'information complète (loi n° 2017-20 portant Code du numérique en
 * République du Bénin — autorité : APDP).
 */
import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, ShieldCheck, Lock, Mail, Phone, User } from 'lucide-react'
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

type Provider = 'kkiapay' | 'fedapay'

export default function RecapMyafroForm() {
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
        // Tarif pas encore lu en base : refuser plutôt qu'encaisser une valeur d'attente.
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
                    body: JSON.stringify({ ...form, consentement, payment_provider: provider, payment_ref: txId }),
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
            <section id="demande" className="max-w-3xl mx-auto px-5 md:px-8 py-12 scroll-mt-16">
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-[#e7e1d8] rounded-3xl shadow-[0_8px_40px_rgba(28,25,23,0.06)] p-8 text-center"
                >
                    <div className="w-16 h-16 rounded-full bg-[#008751]/10 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={30} className="text-[#008751]" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#008751] mb-3">{t('Demande enregistrée')}</p>
                    <h2 className="font-display text-3xl font-bold text-[#1c1917] mb-3">{t('Votre dossier est entre nos mains')}</h2>
                    <p className="text-[#57534e] leading-relaxed mb-6">
                        {t('Un analyste reprend votre situation. Vous recevez votre fiche sous {d}.', { d: delai })}
                    </p>
                    <div className="bg-[#fdfbf7] border border-[#e7e1d8] rounded-2xl px-5 py-4 mb-6 inline-block">
                        <p className="text-[10px] uppercase tracking-widest text-[#a8a29e] font-bold">{t('Votre référence')}</p>
                        <p className="font-mono text-lg font-bold text-[#1c1917] mt-1">{reference}</p>
                    </div>
                    <div>
                        <Link href="/" className="inline-flex items-center gap-2 bg-[#008751] hover:bg-[#007445] text-white font-bold text-sm px-7 py-3.5 rounded-2xl transition-all">
                            {t('Retour à l’accueil')} <ArrowRight size={16} />
                        </Link>
                    </div>
                </motion.div>
            </section>
        )
    }

    return (
        <section id="demande" className="max-w-3xl mx-auto px-5 md:px-8 py-12 scroll-mt-16">
            <Script src="https://cdn.kkiapay.me/k.js" strategy="lazyOnload" />
            <Script src="https://cdn.fedapay.com/checkout.js?v=1.1.7" strategy="lazyOnload" />

            <div className="mb-8">
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-2">{t('Votre demande')}</p>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-[#1c1917]">{t('Racontez-nous')}</h2>
                <p className="mt-2 text-slate-600">
                    {t('Plus votre récit est précis, plus l’analyse est utile. Prenez le temps : c’est la matière de votre fiche.')}
                </p>
            </div>

            <div className="bg-white border border-[#e7e1d8] rounded-3xl shadow-[0_8px_40px_rgba(28,25,23,0.05)] p-6 md:p-9 space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                    {[
                        { k: 'prenom' as const, l: 'Prénom', Icone: User, type: 'text' },
                        { k: 'nom' as const, l: 'Nom', Icone: User, type: 'text' },
                        { k: 'email' as const, l: 'Email', Icone: Mail, type: 'email' },
                        { k: 'telephone' as const, l: 'Téléphone / WhatsApp', Icone: Phone, type: 'tel' },
                    ].map(ch => (
                        <div key={ch.k}>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#78716c] mb-2">
                                {t(ch.l)} <span className="text-[#E8112D]">*</span>
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
                                className="bg-[#008751] hover:bg-[#007445] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm px-6 py-4 rounded-2xl transition-all"
                            >
                                {enCours && provider === 'kkiapay' ? t('Ouverture du paiement…') : t('Payer par Mobile Money / Carte')}
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
        </section>
    )
}
