'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
    Save, Loader2, CheckCircle2, ArrowLeft,
    Plus, Trash2, Layout, FileText, CreditCard, Info
} from 'lucide-react'
import Link from 'next/link'

interface PricingOption {
    label: string
    price: string
}

interface PageContent {
    hero_title: string
    hero_subtitle: string
    accompagnement_title: string
    accompagnement_text: string
    documents_title: string
    documents_note: string
    documents: string[]
    pricing_show_calculator: boolean
    pricing_options: PricingOption[]
    cta1_title: string
    cta1_description: string
    cta1_button_text: string
    cta2_title: string
    cta2_description: string
    cta2_button_text: string
    cta2_note: string
}

const DEFAULT_CONTENT: PageContent = {
    hero_title: "Nationalité Béninoise — Accompagnement VIP",
    hero_subtitle: "Procédure personnalisée et accompagnée de A à Z pour obtenir la nationalité béninoise.",
    accompagnement_title: "Notre accompagnement",
    accompagnement_text: "Nous guidons les membres de la diaspora afro-descendante dans l'ensemble des démarches administratives nécessaires à l'obtention de la nationalité béninoise. De la constitution du dossier à la remise des documents officiels, notre équipe assure un suivi personnalisé et transparent à chaque étape.",
    documents_title: "Pièces à fournir",
    documents_note: "* Cette liste peut varier selon votre situation individuelle. Nos conseillers vous transmettront la liste définitive lors de votre consultation.",
    documents: [
        "Acte de naissance apostillé (original + traduction assermentée si nécessaire)",
        "Justificatif de domicile de moins de 3 mois",
        "Copie du passeport en cours de validité",
        "Certificat de bonne conduite / extrait de casier judiciaire",
        "Preuve de lien avec le Bénin (généalogie, acte de naissance d'un parent béninois, etc.)",
        "4 photos d'identité récentes",
        "Formulaire de demande de naturalisation (fourni par nos soins)",
    ],
    pricing_show_calculator: false,
    pricing_options: [
        { label: "Accompagnement dossier standard", price: "150.000 FCFA" },
        { label: "Pack VIP — suivi prioritaire complet", price: "350.000 FCFA" },
        { label: "Consultation initiale", price: "Gratuit" },
    ],
    cta1_title: "Commencer ma demande",
    cta1_description: "Remplissez le formulaire de demande en ligne. Notre équipe vous recontactera sous 48h.",
    cta1_button_text: "Commencer ma demande",
    cta2_title: "Prendre un rendez-vous",
    cta2_description: "Échangez avec un conseiller pour évaluer votre situation et préparer votre dossier.",
    cta2_button_text: "Réserver un créneau",
    cta2_note: "Premier appel de 15 min gratuit",
}

const IC = 'w-full bg-white/[0.04] border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 placeholder:text-gray-600 transition-all'
const TA = 'w-full bg-white/[0.04] border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 placeholder:text-gray-600 transition-all resize-none'
const LC = 'text-xs font-bold text-gray-400 mb-1.5 block'

export default function NationaliteVipContentPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [sectionId, setSectionId] = useState<string | null>(null)
    const [content, setContent] = useState<PageContent>(DEFAULT_CONTENT)
    const [newDoc, setNewDoc] = useState('')
    const [newPricingLabel, setNewPricingLabel] = useState('')
    const [newPricingPrice, setNewPricingPrice] = useState('')

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from('page_sections')
                .select('*')
                .eq('page', 'nationalite-vip')
                .eq('section_key', 'page_content')
                .single()

            if (data) {
                setSectionId(data.id)
                setContent({ ...DEFAULT_CONTENT, ...(data.content as PageContent) })
            }
            setLoading(false)
        }
        load()
    }, [])

    const update = (field: keyof PageContent, value: unknown) => {
        setContent(prev => ({ ...prev, [field]: value }))
    }

    const handleSave = async () => {
        setSaving(true)
        setSaved(false)
        if (sectionId) {
            await supabase
                .from('page_sections')
                .update({ content, updated_at: new Date().toISOString() })
                .eq('id', sectionId)
        } else {
            const { data } = await supabase
                .from('page_sections')
                .insert({
                    page: 'nationalite-vip',
                    section_key: 'page_content',
                    title: 'Contenu page Nationalité VIP',
                    content,
                    sort_order: 1,
                    is_active: true,
                })
                .select()
                .single()
            if (data) setSectionId(data.id)
        }
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
    }

    const addDoc = () => {
        if (!newDoc.trim()) return
        update('documents', [...content.documents, newDoc.trim()])
        setNewDoc('')
    }

    const removeDoc = (i: number) => {
        update('documents', content.documents.filter((_, idx) => idx !== i))
    }

    const updateDoc = (i: number, val: string) => {
        update('documents', content.documents.map((d, idx) => idx === i ? val : d))
    }

    const addPricing = () => {
        if (!newPricingLabel.trim()) return
        update('pricing_options', [...content.pricing_options, { label: newPricingLabel.trim(), price: newPricingPrice.trim() }])
        setNewPricingLabel('')
        setNewPricingPrice('')
    }

    const removePricing = (i: number) => {
        update('pricing_options', content.pricing_options.filter((_, idx) => idx !== i))
    }

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-3xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <Link
                            href="/admin/nationalite"
                            className="text-xs text-gray-500 hover:text-white flex items-center gap-1.5 mb-2 transition-colors"
                        >
                            <ArrowLeft size={12} /> Retour aux demandes
                        </Link>
                        <h1 className="text-2xl font-black text-white flex items-center gap-3">
                            <Layout size={22} className="text-emerald-400" />
                            Contenu — Nationalité VIP
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">
                            Tous les textes visibles sur la page <span className="font-mono text-gray-400">/services/nationalite-vip</span>
                        </p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm px-6 py-3 rounded-xl flex items-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-50 transition-all"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                        {saving ? 'Enregistrement...' : saved ? 'Enregistré !' : 'Enregistrer'}
                    </button>
                </div>

                {saved && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-emerald-400" />
                        <p className="text-sm text-emerald-400 font-bold">Modifications enregistrées. Les changements sont immédiatement visibles.</p>
                    </div>
                )}

                {/* ═══ HERO ═══ */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center">
                            <Layout size={18} className="text-[#FCD116]" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white">Bannière Hero</h2>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Titre et sous-titre en haut de page</p>
                        </div>
                    </div>
                    <div>
                        <label className={LC}>Titre principal <span className="text-red-400">*</span></label>
                        <input
                            type="text"
                            value={content.hero_title}
                            onChange={e => update('hero_title', e.target.value)}
                            className={IC}
                        />
                    </div>
                    <div>
                        <label className={LC}>Sous-titre</label>
                        <textarea
                            rows={2}
                            value={content.hero_subtitle}
                            onChange={e => update('hero_subtitle', e.target.value)}
                            className={TA}
                        />
                    </div>
                </div>

                {/* ═══ ACCOMPAGNEMENT ═══ */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <FileText size={18} className="text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white">Section — Notre accompagnement</h2>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Bloc de texte principal</p>
                        </div>
                    </div>
                    <div>
                        <label className={LC}>Titre de section</label>
                        <input
                            type="text"
                            value={content.accompagnement_title}
                            onChange={e => update('accompagnement_title', e.target.value)}
                            className={IC}
                        />
                    </div>
                    <div>
                        <label className={LC}>Texte descriptif</label>
                        <textarea
                            rows={5}
                            value={content.accompagnement_text}
                            onChange={e => update('accompagnement_text', e.target.value)}
                            className={TA}
                        />
                    </div>
                </div>

                {/* ═══ DOCUMENTS ═══ */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <FileText size={18} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white">Pièces à fournir</h2>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{content.documents.length} document(s)</p>
                        </div>
                    </div>
                    <div>
                        <label className={LC}>Titre de la section</label>
                        <input
                            type="text"
                            value={content.documents_title}
                            onChange={e => update('documents_title', e.target.value)}
                            className={IC}
                        />
                    </div>
                    <div className="space-y-2">
                        {content.documents.map((doc, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 group hover:border-emerald-500/20 transition-all"
                            >
                                <span className="text-[10px] font-black text-emerald-400 w-5 shrink-0">{i + 1}</span>
                                <input
                                    type="text"
                                    value={doc}
                                    onChange={e => updateDoc(i, e.target.value)}
                                    className="flex-1 bg-transparent text-white text-sm focus:outline-none border-b border-transparent focus:border-emerald-500/30 pb-0.5"
                                />
                                <button
                                    onClick={() => removeDoc(i)}
                                    className="p-1.5 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newDoc}
                            onChange={e => setNewDoc(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addDoc()}
                            placeholder="Ajouter un document..."
                            className={`${IC} flex-1`}
                        />
                        <button
                            onClick={addDoc}
                            disabled={!newDoc.trim()}
                            className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 disabled:opacity-30 transition-all shrink-0"
                        >
                            <Plus size={14} /> Ajouter
                        </button>
                    </div>
                    <div>
                        <label className={LC}>Note sous la liste (italique)</label>
                        <textarea
                            rows={2}
                            value={content.documents_note}
                            onChange={e => update('documents_note', e.target.value)}
                            className={TA}
                        />
                    </div>
                </div>

                {/* ═══ TARIFS ═══ */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center">
                            <CreditCard size={18} className="text-[#FCD116]" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white">Options tarifaires (calculateur)</h2>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Affiché dans la sidebar si activé</p>
                        </div>
                    </div>

                    {/* Toggle calculateur */}
                    <label className="flex items-center gap-3 cursor-pointer">
                        <div
                            onClick={() => update('pricing_show_calculator', !content.pricing_show_calculator)}
                            className={`w-11 h-6 rounded-full transition-all cursor-pointer ${content.pricing_show_calculator ? 'bg-emerald-500' : 'bg-white/10'} relative`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${content.pricing_show_calculator ? 'translate-x-5' : ''}`} />
                        </div>
                        <span className="text-sm text-white font-bold">Afficher le calculateur de prix</span>
                    </label>

                    {/* Pricing options list */}
                    <div className="space-y-2">
                        {content.pricing_options.map((opt, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 group hover:border-[#FCD116]/20 transition-all"
                            >
                                <span className="text-[10px] font-black text-[#FCD116] w-5 shrink-0">{i + 1}</span>
                                <input
                                    type="text"
                                    value={opt.label}
                                    onChange={e => update('pricing_options', content.pricing_options.map((o, j) => j === i ? { ...o, label: e.target.value } : o))}
                                    placeholder="Label de l'option"
                                    className="flex-1 bg-transparent text-white text-sm focus:outline-none border-b border-transparent focus:border-[#FCD116]/30 pb-0.5"
                                />
                                <input
                                    type="text"
                                    value={opt.price}
                                    onChange={e => update('pricing_options', content.pricing_options.map((o, j) => j === i ? { ...o, price: e.target.value } : o))}
                                    placeholder="Prix"
                                    className="w-36 bg-transparent text-[#FCD116] text-sm font-bold focus:outline-none border-b border-transparent focus:border-[#FCD116]/30 text-right pb-0.5"
                                />
                                <button
                                    onClick={() => removePricing(i)}
                                    className="p-1.5 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add pricing option */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newPricingLabel}
                            onChange={e => setNewPricingLabel(e.target.value)}
                            placeholder="Label (ex: Pack Premium)"
                            className={`${IC} flex-1`}
                        />
                        <input
                            type="text"
                            value={newPricingPrice}
                            onChange={e => setNewPricingPrice(e.target.value)}
                            placeholder="Prix (ex: 200.000 FCFA)"
                            className={`${IC} w-48`}
                        />
                        <button
                            onClick={addPricing}
                            disabled={!newPricingLabel.trim()}
                            className="bg-[#FCD116]/20 text-[#FCD116] hover:bg-[#FCD116]/30 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 disabled:opacity-30 transition-all shrink-0"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                </div>

                {/* ═══ CTA 1 ═══ */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Layout size={18} className="text-emerald-400" />
                        </div>
                        <h2 className="text-base font-black text-white">Carte CTA 1 — Commencer ma demande</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={LC}>Titre</label>
                            <input
                                type="text"
                                value={content.cta1_title}
                                onChange={e => update('cta1_title', e.target.value)}
                                className={IC}
                            />
                        </div>
                        <div>
                            <label className={LC}>Texte du bouton</label>
                            <input
                                type="text"
                                value={content.cta1_button_text}
                                onChange={e => update('cta1_button_text', e.target.value)}
                                className={IC}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={LC}>Description</label>
                        <textarea
                            rows={2}
                            value={content.cta1_description}
                            onChange={e => update('cta1_description', e.target.value)}
                            className={TA}
                        />
                    </div>
                </div>

                {/* ═══ CTA 2 ═══ */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <Layout size={18} className="text-blue-400" />
                        </div>
                        <h2 className="text-base font-black text-white">Carte CTA 2 — Rendez-vous</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={LC}>Titre</label>
                            <input
                                type="text"
                                value={content.cta2_title}
                                onChange={e => update('cta2_title', e.target.value)}
                                className={IC}
                            />
                        </div>
                        <div>
                            <label className={LC}>Texte du bouton</label>
                            <input
                                type="text"
                                value={content.cta2_button_text}
                                onChange={e => update('cta2_button_text', e.target.value)}
                                className={IC}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={LC}>Description</label>
                        <textarea
                            rows={2}
                            value={content.cta2_description}
                            onChange={e => update('cta2_description', e.target.value)}
                            className={TA}
                        />
                    </div>
                    <div>
                        <label className={LC}>Note sous le bouton</label>
                        <input
                            type="text"
                            value={content.cta2_note}
                            onChange={e => update('cta2_note', e.target.value)}
                            className={IC}
                            placeholder="Ex: Premier appel de 15 min gratuit"
                        />
                    </div>
                </div>

                {/* Info */}
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-5 flex items-start gap-4">
                    <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-gray-400 space-y-1">
                        <p className="font-bold text-blue-400">URL de la page frontend</p>
                        <p>Les modifications s&apos;appliquent immédiatement sur : <span className="font-mono text-white">/services/nationalite-vip</span></p>
                    </div>
                </div>

                {/* Bottom save */}
                <div className="flex justify-end pb-8">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm px-8 py-3 rounded-xl flex items-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-50 transition-all"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Enregistrement...' : 'Enregistrer le contenu'}
                    </button>
                </div>

            </div>
        </div>
    )
}
