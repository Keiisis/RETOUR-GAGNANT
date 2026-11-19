'use client'

/**
 * Dépôt d'une demande de « Récap de dossier MyAfroOrigins ».
 *
 * Le client raconte sa situation et envoie sa demande. Le récap est gratuit
 * depuis novembre 2026 (agence agréée) : aucune étape de règlement.
 *
 * Données personnelles : consentement explicite, jamais pré-coché, précédé de
 * l'information complète (loi n° 2017-20 portant Code du numérique en
 * République du Bénin — autorité : APDP).
 *
 * MODE REPRISE (`reprise`) : le client arrive par un lien envoyé par
 * l'équipe. Son dossier existe déjà chez MyAfroOrigins — on le VÉRIFIE, on
 * ne le refait pas. Mêmes champs que la page publique, plus la possibilité
 * de joindre toutes les pièces du dossier de nationalité, aucune n'étant
 * obligatoire. Un lien émis avant la gratuité avec une facture réglée garde
 * sa mention « déjà réglé » : le serveur l'a établi en lisant la facture.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Lock, Mail, Phone, User, Paperclip, X, FileText, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { chargerDocSlots, DOC_SLOTS_DEFAUT, type DocSlot } from '@/lib/nationality-docs'
import { useTranslation } from '@/lib/translation'

/** Ce que le serveur a établi en lisant le lien de reprise. */
export interface RepriseInfo {
    token: string
    prepaye: boolean
    factureNumero?: string | null
    email?: string | null
    nom?: string | null
}

/** Une pièce choisie avant l'enregistrement, envoyée dès que la référence existe. */
interface PieceEnAttente { id: string; categorie: string; titre: string; file: File }

const TAILLE_MAX_PIECE = 10 * 1024 * 1024
const EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx']

export default function RecapMyafroForm({ reprise }: { reprise?: RepriseInfo } = {}) {
    const { t } = useTranslation()
    const prepaye = !!reprise?.prepaye

    const [delai, setDelai] = useState('48 heures ouvrées')

    const [form, setForm] = useState({
        prenom: '', nom: '', email: '', telephone: '', pays_residence: '',
        myafro_reference: '', depuis_quand: '', situation: '', attentes: '',
    })
    const [consentement, setConsentement] = useState(false)

    const [erreur, setErreur] = useState('')
    const [envoi, setEnvoi] = useState(false)
    const [reference, setReference] = useState('')

    // Pièces jointes : proposées APRÈS l'enregistrement, quand la référence
    // existe.
    const [pieces, setPieces] = useState<{ id: string; file_name: string }[]>([])
    const [depot, setDepot] = useState(false)
    const [erreurPiece, setErreurPiece] = useState('')

    /* Pièces du dossier de nationalité, choisies AVANT l'envoi mais gardées
       dans le navigateur : rien n'est stocké tant que la demande n'existe pas.
       Aucune n'est obligatoire — le client joint ce qu'il a. */
    const [slots, setSlots] = useState<DocSlot[]>(DOC_SLOTS_DEFAUT)
    const [aEnvoyer, setAEnvoyer] = useState<PieceEnAttente[]>([])
    const [autreTitre, setAutreTitre] = useState('')
    const [envoiPieces, setEnvoiPieces] = useState<{ fait: number; total: number; echecs: string[] } | null>(null)

    useEffect(() => { chargerDocSlots(supabase).then(setSlots).catch(() => undefined) }, [])

    // Pré-remplissage depuis l'invitation : seulement les champs vides.
    useEffect(() => {
        if (!reprise) return
        const [premier, ...reste] = String(reprise.nom || '').trim().split(/\s+/)
        setForm(f => ({
            ...f,
            email: f.email || String(reprise.email || ''),
            prenom: f.prenom || (reste.length ? premier : ''),
            nom: f.nom || (reste.length ? reste.join(' ') : (premier || '')),
        }))
    }, [reprise])

    const ajouterPieces = (categorie: string, titre: string, liste: FileList | null) => {
        setErreurPiece('')
        const refusees: string[] = []
        const acceptees: PieceEnAttente[] = []
        for (const file of Array.from(liste || [])) {
            const ext = (file.name.split('.').pop() || '').toLowerCase()
            if (!EXTENSIONS.includes(ext)) { refusees.push(`${file.name} (${t('format non accepté')})`); continue }
            if (file.size > TAILLE_MAX_PIECE) { refusees.push(`${file.name} (${t('plus de 10 Mo')})`); continue }
            acceptees.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, categorie, titre, file })
        }
        if (refusees.length) setErreurPiece(`${t('Non ajoutées')} : ${refusees.join(', ')}`)
        if (acceptees.length) setAEnvoyer(l => [...l, ...acceptees])
    }

    const deposerPiece = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fichier = e.target.files?.[0]
        e.target.value = ''
        if (!fichier || !reference) return
        setDepot(true); setErreurPiece('')
        try {
            const fd = new FormData()
            fd.append('file', fichier)
            fd.append('reference', reference)
            fd.append('email', form.email)
            fd.append('source', 'web')
            const res = await fetch('/api/services/recap-myafroorigins/documents', { method: 'POST', body: fd })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.success) throw new Error(json.error || t('Dépôt impossible.'))
            setPieces(p => [...p, { id: `${Date.now()}`, file_name: json.nom || fichier.name }])
        } catch (err) {
            setErreurPiece(err instanceof Error ? err.message : t('Dépôt impossible.'))
        } finally { setDepot(false) }
    }

    useEffect(() => {
        supabase.from('page_sections').select('content')
            .eq('page', 'recap-myafroorigins').eq('section_key', 'form_settings').single()
            .then(({ data }) => {
                const c = (data?.content || {}) as Record<string, unknown>
                if (c.delai) setDelai(String(c.delai))
            })
    }, [])

    const champsRemplis = !!(form.prenom.trim() && form.nom.trim() && form.email.trim()
        && form.telephone.trim() && form.situation.trim().length >= 40)
    const pretAEnvoyer = champsRemplis && consentement

    const enregistrer = async () => {
        if (envoi || reference) return
        setEnvoi(true); setErreur('')
        try {
            const res = await fetch('/api/services/recap-myafroorigins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    consentement,
                    ...(reprise ? { reprise_token: reprise.token } : {}),
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.success) throw new Error(json.error || t('Enregistrement impossible.'))
            setReference(String(json.reference))
        } catch (e) {
            setErreur(e instanceof Error ? e.message : t('Enregistrement impossible.'))
        } finally { setEnvoi(false) }
    }

    /* Dès que la demande existe, les pièces choisies partent une à une, sous
       leur intitulé. Une pièce qui échoue n'arrête pas les autres : elle est
       nommée, et le client peut la redéposer depuis l'écran final. */
    useEffect(() => {
        if (!reference || !aEnvoyer.length || envoiPieces) return
        const file = [...aEnvoyer]
        setEnvoiPieces({ fait: 0, total: file.length, echecs: [] })
        ;(async () => {
            const echecs: string[] = []
            for (let i = 0; i < file.length; i++) {
                const p = file[i]
                try {
                    const fd = new FormData()
                    fd.append('file', p.file)
                    fd.append('reference', reference)
                    fd.append('email', form.email)
                    fd.append('source', 'web')
                    fd.append('titre', p.titre)
                    fd.append('categorie', p.categorie)
                    const res = await fetch('/api/services/recap-myafroorigins/documents', { method: 'POST', body: fd })
                    const json = await res.json().catch(() => ({}))
                    if (!res.ok || !json.success) throw new Error(json.error || t('échec'))
                    setPieces(l => [...l, { id: p.id, file_name: `${p.titre} — ${json.nom || p.file.name}` }])
                } catch (e) {
                    echecs.push(`${p.titre} (${e instanceof Error ? e.message : t('échec')})`)
                }
                setEnvoiPieces({ fait: i + 1, total: file.length, echecs: [...echecs] })
            }
            setAEnvoyer([])
        })()
    }, [reference]) // eslint-disable-line react-hooks/exhaustive-deps

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
                        {t('Un analyste reprend votre situation. Vous recevez votre fiche sous {d}.', { d: t(delai) })}
                    </p>
                    <div className="bg-[#fdfbf7] border border-[#e7e1d8] rounded-2xl px-5 py-4 mb-6 inline-block">
                        <p className="text-[10px] uppercase tracking-widest text-[#a8a29e] font-bold">{t('Votre référence')}</p>
                        <p className="font-mono text-lg font-bold text-[#1c1917] mt-1">{reference}</p>
                    </div>
                    {/* Dépôt de pièces : facultatif, mais il accélère l'analyse. */}
                    <div className="text-left bg-[#fdfbf7] border border-[#e7e1d8] rounded-2xl p-5 mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Paperclip size={15} className="text-[#008751]" />
                            <p className="text-[11px] font-bold uppercase tracking-widest text-[#1c1917]">
                                {t('Ajouter des pièces (facultatif)')}
                            </p>
                        </div>
                        <p className="text-[12px] text-[#57534e] leading-relaxed mb-3">
                            {t('Capture de votre espace MyAfroOrigins, courrier reçu, acte déjà obtenu… Tout ce qui aide à comprendre votre dossier. PDF ou image, 10 Mo maximum.')}
                        </p>

                        {envoiPieces && envoiPieces.fait < envoiPieces.total && (
                            <p className="flex items-center gap-2 text-[12px] font-bold text-[#008751] mb-3">
                                <span className="w-3.5 h-3.5 border-2 border-[#008751]/30 border-t-[#008751] rounded-full animate-spin" />
                                {t('Envoi de vos pièces')} : {envoiPieces.fait}/{envoiPieces.total}
                            </p>
                        )}
                        {!!envoiPieces?.echecs.length && (
                            <p className="text-[12px] text-[#E8112D] mb-3">
                                {t('Ces pièces n’ont pas pu être envoyées, redéposez-les ci-dessous')} : {envoiPieces.echecs.join(', ')}
                            </p>
                        )}
                        {pieces.length > 0 && (
                            <ul className="space-y-1.5 mb-3">
                                {pieces.map(p => (
                                    <li key={p.id} className="flex items-center gap-2 text-[12px] text-[#1c1917]">
                                        <CheckCircle2 size={13} className="text-[#008751] shrink-0" />
                                        <span className="truncate">{p.file_name}</span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {!!erreurPiece && (
                            <p className="flex items-center gap-2 text-[12px] text-[#E8112D] mb-2">
                                <X size={13} /> {erreurPiece}
                            </p>
                        )}

                        <label className={`inline-flex items-center gap-2 bg-white border border-[#e7e1d8] hover:border-[#008751]/40 rounded-xl px-4 py-2.5 text-[12.5px] font-bold text-[#1c1917] cursor-pointer transition-all ${depot ? 'opacity-50 pointer-events-none' : ''}`}>
                            <Paperclip size={14} className="text-[#008751]" />
                            {depot ? t('Dépôt en cours…') : t('Choisir un fichier')}
                            <input type="file" onChange={deposerPiece} accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="hidden" />
                        </label>
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
                                    disabled={envoi}
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
                                disabled={envoi}
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
                        disabled={envoi}
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
                        disabled={envoi}
                        className="w-full bg-[#fdfbf7] border border-[#e7e1d8] rounded-xl px-4 py-3 text-sm text-[#1c1917] outline-none focus:border-[#008751] transition-colors disabled:opacity-60"
                    />
                </div>

                {/* ── Pièces du dossier (toutes facultatives) ── */}
                <div className="bg-[#fdfbf7] border border-[#e7e1d8] rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-1">
                        <Paperclip size={15} className="text-[#008751]" />
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#1c1917]">
                            {t('Vos pièces (facultatif)')}
                        </p>
                    </div>
                    <p className="text-[12px] text-[#57534e] leading-relaxed mb-4">
                        {t('Joignez ce que vous avez déjà : aucune pièce n’est obligatoire. Plus votre dossier est complet, plus la vérification est rapide. PDF, image ou Word, 10 Mo maximum par fichier.')}
                    </p>
                    <div className="space-y-2">
                        {slots.map(slot => {
                            const choisies = aEnvoyer.filter(p => p.categorie === slot.key)
                            return (
                                <div key={slot.key} className="bg-white border border-[#e7e1d8] rounded-xl px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[12.5px] font-semibold text-[#1c1917]">{t(slot.label)}</p>
                                            {slot.hint && <p className="text-[11px] text-[#a8a29e]">{t(slot.hint)}</p>}
                                        </div>
                                        <label className={`shrink-0 inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#008751] border border-[#008751]/30 hover:bg-[#008751]/5 rounded-lg px-3 py-1.5 cursor-pointer ${envoi ? 'opacity-50 pointer-events-none' : ''}`}>
                                            <Plus size={13} /> {choisies.length && !slot.multi ? t('Remplacer') : t('Ajouter')}
                                            <input
                                                type="file"
                                                multiple={!!slot.multi}
                                                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                                                className="hidden"
                                                onChange={e => {
                                                    if (!slot.multi) setAEnvoyer(l => l.filter(p => p.categorie !== slot.key))
                                                    ajouterPieces(slot.key, t(slot.label), e.target.files)
                                                    e.target.value = ''
                                                }}
                                            />
                                        </label>
                                    </div>
                                    {choisies.length > 0 && (
                                        <ul className="mt-2 space-y-1">
                                            {choisies.map(p => (
                                                <li key={p.id} className="flex items-center gap-2 text-[11.5px] text-[#57534e]">
                                                    <FileText size={12} className="text-[#008751] shrink-0" />
                                                    <span className="truncate flex-1">{p.file.name}</span>
                                                    <button type="button" onClick={() => setAEnvoyer(l => l.filter(x => x.id !== p.id))}
                                                        className="text-[#a8a29e] hover:text-[#E8112D]" aria-label={t('Retirer')}>
                                                        <X size={13} />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )
                        })}

                        {/* Pièce libre : ce que la liste ne prévoit pas (capture MyAfroOrigins, courrier reçu…). */}
                        <div className="bg-white border border-dashed border-[#e7e1d8] rounded-xl px-4 py-3">
                            <p className="text-[12.5px] font-semibold text-[#1c1917] mb-2">{t('Autre document')}</p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    value={autreTitre}
                                    onChange={e => setAutreTitre(e.target.value)}
                                    placeholder={t('Nom du document (ex. capture de mon espace MyAfroOrigins)')}
                                    className="flex-1 bg-[#fdfbf7] border border-[#e7e1d8] rounded-lg px-3 py-2 text-[12.5px] text-[#1c1917] outline-none focus:border-[#008751]"
                                />
                                <label className={`shrink-0 inline-flex items-center justify-center gap-1.5 text-[11.5px] font-bold text-[#008751] border border-[#008751]/30 hover:bg-[#008751]/5 rounded-lg px-3 py-2 cursor-pointer ${!autreTitre.trim() || envoi ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <Plus size={13} /> {t('Ajouter')}
                                    <input
                                        type="file"
                                        multiple
                                        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                                        className="hidden"
                                        onChange={e => { ajouterPieces('autre', autreTitre.trim(), e.target.files); setAutreTitre(''); e.target.value = '' }}
                                    />
                                </label>
                            </div>
                            {aEnvoyer.filter(p => p.categorie === 'autre').length > 0 && (
                                <ul className="mt-2 space-y-1">
                                    {aEnvoyer.filter(p => p.categorie === 'autre').map(p => (
                                        <li key={p.id} className="flex items-center gap-2 text-[11.5px] text-[#57534e]">
                                            <FileText size={12} className="text-[#008751] shrink-0" />
                                            <span className="truncate flex-1"><strong>{p.titre}</strong> · {p.file.name}</span>
                                            <button type="button" onClick={() => setAEnvoyer(l => l.filter(x => x.id !== p.id))}
                                                className="text-[#a8a29e] hover:text-[#E8112D]" aria-label={t('Retirer')}>
                                                <X size={13} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                    {!!erreurPiece && !reference && (
                        <p className="flex items-center gap-2 text-[12px] text-[#E8112D] mt-3"><X size={13} /> {erreurPiece}</p>
                    )}
                    {aEnvoyer.length > 0 && (
                        <p className="text-[11px] text-[#008751] font-bold mt-3">
                            {aEnvoyer.length} {aEnvoyer.length > 1 ? t('pièces seront envoyées avec votre demande.') : t('pièce sera envoyée avec votre demande.')}
                        </p>
                    )}
                </div>

                {/* ── Information et consentement ── */}
                <div className="bg-[#fdfbf7] border border-[#e7e1d8] rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Lock size={15} className="text-[#008751]" />
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#1c1917]">{t('Protection de vos données')}</p>
                    </div>
                    <ul className="space-y-1.5 text-[12px] text-[#57534e] leading-relaxed mb-4">
                        <li>· {t('Responsable du traitement : Agence Retour Gagnant Bénin.')}</li>
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
                            disabled={envoi}
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

                {/* ── Envoi : le récap est gratuit (agence agréée). Un lien de
                       reprise émis « déjà payé » avant la gratuité garde sa
                       mention : la facture existe, le client l'a réglée. ── */}
                <div className="border-t border-[#e7e1d8] pt-6">
                    <div className="bg-[#008751]/8 border border-[#008751]/25 rounded-2xl px-5 py-4 mb-5 flex items-start gap-3">
                        <CheckCircle2 size={20} className="text-[#008751] shrink-0 mt-0.5" />
                        {prepaye ? (
                            <div>
                                <p className="text-sm font-bold text-[#1c1917]">{t('Vos frais de reprise sont déjà réglés.')}</p>
                                <p className="text-[12px] text-[#57534e] mt-0.5">
                                    {t('Aucun paiement ne vous sera demandé.')}
                                    {reprise?.factureNumero ? ` ${t('Facture')} ${reprise.factureNumero}.` : ''}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-sm font-bold text-[#1c1917]">{t('Gratuit · agence agréée')}</p>
                                <p className="text-[12px] text-[#57534e] mt-0.5">
                                    {t('Retour Gagnant Bénin traite votre récap MyAfroOrigins sans aucun frais.')}
                                </p>
                            </div>
                        )}
                    </div>
                    {envoi ? (
                        <div className="flex items-center justify-center gap-3 py-4 text-[#008751] font-bold text-sm">
                            <span className="w-4 h-4 border-2 border-[#008751]/30 border-t-[#008751] rounded-full animate-spin" />
                            {t('Enregistrement de votre demande…')}
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => enregistrer()}
                            disabled={!pretAEnvoyer}
                            className="w-full font-bold text-sm px-6 py-4 rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-[#008751] hover:bg-[#007445] text-white"
                        >
                            {t('Envoyer mon récap')}
                        </button>
                    )}
                    {!pretAEnvoyer && !envoi && (
                        <p className="text-[11px] text-[#a8a29e] text-center mt-3">
                            {!champsRemplis
                                ? t('Complétez les champs obligatoires pour continuer.')
                                : t('Votre consentement est nécessaire pour poursuivre.')}
                        </p>
                    )}
                </div>
            </div>
        </section>
    )
}
