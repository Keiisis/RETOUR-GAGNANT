'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
    Settings2, Save, Loader2, Plus, Trash2,
    DollarSign, FileText, Globe2, CheckCircle2,
    ArrowLeft, CreditCard, Info
} from 'lucide-react'
import Link from 'next/link'

interface RequiredDoc {
    label: string
    multi: boolean
    hint?: string
}

interface FormSettings {
    amount: number
    currency: string
    payment_description: string
    required_documents: RequiredDoc[]
}

const CURRENCIES = [
    { code: 'XOF', label: 'Franc CFA (XOF)' },
    { code: 'USD', label: 'Dollar US (USD)' },
    { code: 'EUR', label: 'Euro (EUR)' },
    { code: 'GBP', label: 'Livre Sterling (GBP)' },
    { code: 'CAD', label: 'Dollar Canadien (CAD)' },
    { code: 'BRL', label: 'Réal Brésilien (BRL)' },
]

const IC = 'w-full bg-white/[0.04] border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 placeholder:text-gray-600 transition-all'
const LC = 'text-xs font-bold text-gray-400 mb-1.5 block'

export default function NationaliteSettingsPage() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [sectionId, setSectionId] = useState<string | null>(null)

    const [amount, setAmount] = useState(250)
    const [currency, setCurrency] = useState('USD')
    const [paymentDescription, setPaymentDescription] = useState('')
    const [requiredDocs, setRequiredDocs] = useState<RequiredDoc[]>([])

    // New document fields
    const [newDocLabel, setNewDocLabel] = useState('')
    const [newDocMulti, setNewDocMulti] = useState(false)
    const [newDocHint, setNewDocHint] = useState('')

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from('page_sections')
                .select('*')
                .eq('page', 'nationalite')
                .eq('section_key', 'form_settings')
                .single()

            if (data) {
                setSectionId(data.id)
                const c = data.content as FormSettings
                setAmount(c.amount || 250)
                setCurrency(c.currency || 'USD')
                setPaymentDescription(c.payment_description || '')
                setRequiredDocs(c.required_documents || [])
            }
            setLoading(false)
        }
        load()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        setSaved(false)

        const content: FormSettings = {
            amount,
            currency,
            payment_description: paymentDescription,
            required_documents: requiredDocs,
        }

        if (sectionId) {
            await supabase
                .from('page_sections')
                .update({
                    content,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', sectionId)
        } else {
            const { data } = await supabase
                .from('page_sections')
                .insert({
                    page: 'nationalite',
                    section_key: 'form_settings',
                    title: 'Paramètres du formulaire de nationalité',
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

    const addDocument = () => {
        if (!newDocLabel.trim()) return
        setRequiredDocs(prev => [...prev, {
            label: newDocLabel.trim(),
            multi: newDocMulti,
            hint: newDocHint.trim() || undefined,
        }])
        setNewDocLabel('')
        setNewDocMulti(false)
        setNewDocHint('')
    }

    const removeDocument = (index: number) => {
        setRequiredDocs(prev => prev.filter((_, i) => i !== index))
    }

    const updateDocLabel = (index: number, label: string) => {
        setRequiredDocs(prev => prev.map((d, i) => i === index ? { ...d, label } : d))
    }

    const toggleDocMulti = (index: number) => {
        setRequiredDocs(prev => prev.map((d, i) => i === index ? { ...d, multi: !d.multi } : d))
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
                            <Settings2 size={22} className="text-emerald-400" />
                            Paramètres du Formulaire
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">
                            Configurez le montant, la devise et les documents requis pour le formulaire de nationalité.
                        </p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                        {saving ? 'Enregistrement...' : saved ? 'Enregistré !' : 'Enregistrer'}
                    </button>
                </div>

                {saved && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-emerald-400" />
                        <p className="text-sm text-emerald-400 font-bold"><T>Paramètres enregistrés avec succès. Les changements sont immédiatement appliqués.</T></p>
                    </div>
                )}

                {/* ═══ SECTION 1: Tarification ═══ */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center">
                            <DollarSign size={20} className="text-[#FCD116]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white"><T>Tarification</T></h2>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold"><T>Montant et devise des frais de dossier</T></p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={LC}>
                                Montant des frais de dossier <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(Number(e.target.value))}
                                    min={0}
                                    step={1}
                                    className={IC}
                                    placeholder="250"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">{currency}</span>
                            </div>
                            <p className="text-[10px] text-gray-600 mt-1.5 flex items-center gap-1">
                                <Info size={10} /> Ce montant sera affiché et facturé au demandeur.
                            </p>
                        </div>

                        <div>
                            <label className={LC}>
                                Devise <span className="text-red-400">*</span>
                            </label>
                            <select
                                title={t("Devise")}
                                value={currency}
                                onChange={e => setCurrency(e.target.value)}
                                className={IC}
                            >
                                {CURRENCIES.map(c => (
                                    <option key={c.code} value={c.code}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={LC}><T>Description du paiement</T></label>
                        <input
                            type="text"
                            value={paymentDescription}
                            onChange={e => setPaymentDescription(e.target.value)}
                            className={IC}
                            placeholder={t("Frais de traitement de dossier de reconnaissance de nationalité béninoise")}
                        />
                        <p className="text-[10px] text-gray-600 mt-1.5 flex items-center gap-1">
                            <Info size={10} /> Affiché lors du paiement (passerelle).
                        </p>
                    </div>

                    {/* Quick preview */}
                    <div className="bg-gradient-to-r from-emerald-900/20 to-yellow-900/10 border border-emerald-500/10 rounded-2xl p-5 text-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1"><T>Aperçu du montant affiché</T></p>
                        <p className="text-3xl font-black text-[#FCD116]">
                            {amount.toLocaleString('fr-FR')} {currency}
                        </p>
                    </div>
                </div>

                {/* ═══ SECTION 2: Documents requis ═══ */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <FileText size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white"><T>Documents requis</T></h2>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                                Pièces jointes demandées au candidat ({requiredDocs.length})
                            </p>
                        </div>
                    </div>

                    {/* List of existing documents */}
                    <div className="space-y-2">
                        {requiredDocs.map((doc, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-4 group hover:border-emerald-500/20 transition-all"
                            >
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs font-black shrink-0">
                                    {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <input
                                        type="text"
                                        value={doc.label}
                                        onChange={e => updateDocLabel(i, e.target.value)}
                                        className="bg-transparent text-white text-sm font-bold w-full focus:outline-none border-b border-transparent focus:border-emerald-500/30 pb-0.5"
                                    />
                                    {doc.hint && (
                                        <p className="text-[10px] text-gray-600 mt-0.5">{doc.hint}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => toggleDocMulti(i)}
                                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all shrink-0 ${doc.multi
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        : 'bg-white/5 text-gray-500 border border-white/10'
                                        }`}
                                >
                                    {doc.multi ? 'Multi-fichier ✓' : 'Un seul'}
                                </button>
                                <button
                                    title={t("Supprimer ce document")}
                                    onClick={() => removeDocument(i)}
                                    className="p-2 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add new document */}
                    <div className="bg-white/[0.01] border border-dashed border-white/10 rounded-xl p-5 space-y-3">
                        <p className="text-xs font-bold text-gray-400 flex items-center gap-2">
                            <Plus size={14} className="text-emerald-400" /> Ajouter un document requis
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className={LC}><T>Nom du document</T></label>
                                <input
                                    type="text"
                                    value={newDocLabel}
                                    onChange={e => setNewDocLabel(e.target.value)}
                                    className={IC}
                                    placeholder={t("Ex: Acte de naissance")}
                                    onKeyDown={e => e.key === 'Enter' && addDocument()}
                                />
                            </div>
                            <div>
                                <label className={LC}><T>Indice / aide (optionnel)</T></label>
                                <input
                                    type="text"
                                    value={newDocHint}
                                    onChange={e => setNewDocHint(e.target.value)}
                                    className={IC}
                                    placeholder={t("Ex: Vous pouvez charger plusieurs fichiers")}
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    title={t("Autoriser multi-fichier")}
                                    type="checkbox"
                                    checked={newDocMulti}
                                    onChange={e => setNewDocMulti(e.target.checked)}
                                    className="w-4 h-4 accent-emerald-500"
                                />
                                <span className="text-xs text-gray-400"><T>Autoriser plusieurs fichiers</T></span>
                            </label>
                            <button
                                onClick={addDocument}
                                disabled={!newDocLabel.trim()}
                                className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 disabled:opacity-30 transition-all"
                            >
                                <Plus size={14} /> Ajouter
                            </button>
                        </div>
                    </div>
                </div>

                {/* ═══ INFO ═══ */}
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-5 flex items-start gap-4">
                    <Globe2 size={20} className="text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-gray-400 space-y-1">
                        <p className="font-bold text-blue-400"><T>Comment ça fonctionne ?</T></p>
                        <p><T>Le montant et la devise sont affichés au demandeur dans le formulaire de nationalité. Le paiement est ensuite effectué via les passerelles activées (Kkiapay, FedaPay, Zeyow).</T></p>
                        <p><T>Les documents listés ci-dessus sont obligatoires : le demandeur ne pourra pas passer à l&apos;étape suivante sans les avoir tous fournis.</T></p>
                        <p className="flex items-center gap-2 mt-2">
                            <CreditCard size={12} className="text-amber-400" />
                            <Link href="/admin/settings/payment" className="text-amber-400 hover:underline font-bold">
                                Configurer les passerelles de paiement →
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Bottom save button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm px-8 py-3 rounded-xl transition-all flex items-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
                    </button>
                </div>
            </div>
        </div>
    )
}
