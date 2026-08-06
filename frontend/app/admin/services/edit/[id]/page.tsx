'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FloppyDisk as Save, CircleNotch as Loader2, Plus, Trash as Trash2, StackSimple as Layers, TextT as Type, TextAlignLeft as AlignLeft, Palette, Hash, CheckCircle as CheckCircle2, CurrencyDollar as DollarSign, Image as ImageIcon, DotsSixVertical as GripVertical, Sparkle as Sparkles } from '@phosphor-icons/react';
import { cn } from '@/lib/utils'

interface PricingOption {
    label: string
    price: string
}

const COLORS = ['#008751', '#FCD116', '#E8112D', '#3b82f6', '#8b5cf6', '#f97316']

const ICON_TYPES = [
    { value: 'passport', label: 'Passeport' },
    { value: 'tata', label: 'Immobilier' },
    { value: 'drum', label: 'Business' },
    { value: 'cowrie', label: 'Culture / Invest.' },
    { value: 'assin', label: 'Construction' },
    { value: 'shield', label: 'Défaut' },
]

export default function ServiceEditPage({ params }: { params: Promise<{ id: string }> }) {
    const { t } = useTranslation();
    const { id } = use(params)
    const router = useRouter()
    const [loadingService, setLoadingService] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [isOptimizing, setIsOptimizing] = useState(false)

    const [title, setTitle] = useState('')
    const [slug, setSlug] = useState('')
    const [subtitle, setSubtitle] = useState('')
    const [description, setDescription] = useState('')
    const [color, setColor] = useState('#008751')
    const [iconType, setIconType] = useState('shield')
    const [imageUrl, setImageUrl] = useState('')
    const [priceDisplay, setPriceDisplay] = useState('')
    const [orderIndex, setOrderIndex] = useState(0)
    const [isActive, setIsActive] = useState(true)
    const [features, setFeatures] = useState<string[]>([''])
    const [pricingOptions, setPricingOptions] = useState<PricingOption[]>([{ label: '', price: '' }])

    useEffect(() => {
        const fetchService = async () => {
            try {
                const res = await fetch(`/api/admin/services/${id}`)
                if (!res.ok) throw new Error('Service introuvable')
                const data = await res.json()
                const s = data.service
                setTitle(s.title || '')
                setSlug(s.slug || '')
                setSubtitle(s.subtitle || '')
                setDescription(s.description || '')
                setColor(s.color || '#008751')
                setIconType(s.icon_type || 'shield')
                setImageUrl(s.image_url || '')
                setPriceDisplay(s.price_display || '')
                setOrderIndex(s.order_index ?? 0)
                setIsActive(s.is_active !== false)
                setFeatures(s.features?.length ? s.features : [''])
                setPricingOptions(s.pricing_options?.length ? s.pricing_options : [{ label: '', price: '' }])
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Erreur chargement')
            } finally {
                setLoadingService(false)
            }
        }
        fetchService()
    }, [id])

    const addFeature = () => setFeatures(prev => [...prev, ''])
    const removeFeature = (i: number) => setFeatures(prev => prev.filter((_, idx) => idx !== i))
    const updateFeature = (i: number, v: string) => setFeatures(prev => prev.map((f, idx) => idx === i ? v : f))

    const addPricingOption = () => setPricingOptions(prev => [...prev, { label: '', price: '' }])
    const removePricingOption = (i: number) => setPricingOptions(prev => prev.filter((_, idx) => idx !== i))
    const updatePricingOption = (i: number, field: 'label' | 'price', v: string) =>
        setPricingOptions(prev => prev.map((o, idx) => idx === i ? { ...o, [field]: v } : o))

    const handleOptimize = async () => {
        if (!description) return
        setIsOptimizing(true)
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{
                        role: 'user',
                        content: `Tu es un expert marketing pour Retour Gagnant Bénin. Améliore cette description de service "${title}" pour qu'elle soit percutante, professionnelle et séduisante pour la diaspora béninoise. Garde le même sens mais améliore le style. Réponds uniquement avec la description améliorée, sans introduction.\n\nDescription actuelle:\n${description}`
                    }],
                    context: 'admin'
                }),
            })
            const data = await res.json()
            if (data.reply) setDescription(data.reply)
        } catch {
            // silently ignore
        } finally {
            setIsOptimizing(false)
        }
    }

    const handleSave = async () => {
        if (!title.trim() || !slug.trim()) {
            setError('Le titre et le slug sont obligatoires')
            return
        }
        setSaving(true)
        setError('')
        try {
            const res = await fetch(`/api/admin/services/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    slug: slug.trim(),
                    subtitle: subtitle.trim(),
                    description: description.trim(),
                    features: features.filter(f => f.trim()),
                    pricing_options: pricingOptions.filter(o => o.label.trim()),
                    color,
                    icon_type: iconType,
                    image_url: imageUrl.trim() || null,
                    price_display: priceDisplay.trim(),
                    order_index: orderIndex,
                    is_active: isActive,
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Erreur lors de la sauvegarde')
                return
            }
            setSuccess(true)
            setTimeout(() => router.push('/admin/services'), 2000)
        } catch {
            setError('Erreur réseau — veuillez réessayer')
        } finally {
            setSaving(false)
        }
    }

    if (loadingService) {
        return (
            <div className="flex justify-center py-32">
                <Loader2 className="animate-spin text-[#008751]" size={36} />
            </div>
        )
    }

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-6 animate-in fade-in duration-500">
                <div className="w-24 h-24 rounded-2xl bg-[#008751]/20 border-2 border-[#008751]/40 flex items-center justify-center">
                    <CheckCircle2 size={40} className="text-[#008751]" />
                </div>
                <h2 className="text-3xl font-black text-white font-heading tracking-tighter"><T>Service Sauvegardé !</T></h2>
                <p className="text-gray-400 text-sm"><T>Redirection vers la liste...</T></p>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-20 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => router.push('/admin/services')}
                        className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-colors"
                        title={t("Retour")}
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 text-[#FCD116]">
                            <Layers size={16} />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em]"><T>Modifier le Service</T></span>
                        </div>
                        <h1 className="text-3xl font-black text-white font-heading tracking-tighter truncate max-w-xs">{title || 'Édition'}</h1>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !title || !slug}
                    className="flex items-center gap-2 bg-[#FCD116] hover:bg-[#ffe566] text-black font-black text-xs tracking-widest px-6 py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    SAUVEGARDER
                </button>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Identité */}
                    <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-6 space-y-5">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Type size={12} /> Identité du Service
                        </p>

                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block"><T>Titre *</T></label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder={t("Ex: Passeport & Documents VIP")}
                                className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white text-lg font-bold focus:outline-none focus:border-[#FCD116]/40 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                Slug URL * <span className="text-gray-600 font-normal normal-case"><T>(correspond à /services/[slug])</T></span>
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-600 text-sm"><T>/services/</T></span>
                                <input
                                    type="text"
                                    value={slug}
                                    onChange={e => setSlug(e.target.value)}
                                    placeholder={t("passeport-documents")}
                                    className="flex-1 bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white font-mono text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block"><T>Sous-titre</T></label>
                            <input
                                type="text"
                                value={subtitle}
                                onChange={e => setSubtitle(e.target.value)}
                                placeholder={t("Tagline courte et percutante")}
                                className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-white/10 transition-colors"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <AlignLeft size={12} /> Description
                                </label>
                                <button
                                    type="button"
                                    onClick={handleOptimize}
                                    disabled={isOptimizing || !description}
                                    className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[#008751] hover:text-[#00c97a] disabled:opacity-40 transition-colors"
                                >
                                    {isOptimizing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                    Améliorer avec l&apos;IA
                                </button>
                            </div>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={6}
                                placeholder={t("Description complète et persuasive du service...")}
                                className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-gray-300 text-sm focus:outline-none focus:border-white/10 transition-colors resize-none leading-relaxed"
                            />
                        </div>
                    </div>

                    {/* Fonctionnalités */}
                    <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <CheckCircle2 size={12} /> Ce que nous proposons (features)
                            </p>
                            <button
                                type="button"
                                onClick={addFeature}
                                className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[#008751] hover:text-[#00c97a] transition-colors"
                            >
                                <Plus size={12} /> Ajouter
                            </button>
                        </div>
                        <div className="space-y-2">
                            {features.map((f, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <GripVertical size={14} className="text-gray-700 flex-shrink-0" />
                                    <input
                                        type="text"
                                        value={f}
                                        onChange={e => updateFeature(i, e.target.value)}
                                        placeholder={`Fonctionnalité ${i + 1}...`}
                                        className="flex-1 bg-white/5 border border-white/5 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-white/10 transition-colors"
                                    />
                                    {features.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeFeature(i)}
                                            className="p-2 rounded-lg text-gray-600 hover:text-red-400 transition-colors"
                                            title={t("Supprimer cette fonctionnalité")}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Calculateur de prix */}
                    <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <DollarSign size={12} /> Calculateur Intelligent (options tarifaires)
                            </p>
                            <button
                                type="button"
                                onClick={addPricingOption}
                                className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[#FCD116] hover:text-[#ffe566] transition-colors"
                            >
                                <Plus size={12} /> Ajouter une option
                            </button>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                Prix affiché (ex: À partir de 50.000 FCFA)
                            </label>
                            <input
                                type="text"
                                value={priceDisplay}
                                onChange={e => setPriceDisplay(e.target.value)}
                                placeholder={t("À partir de 50.000 FCFA")}
                                className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors"
                            />
                        </div>

                        <div className="space-y-2">
                            {pricingOptions.map((opt, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <GripVertical size={14} className="text-gray-700 flex-shrink-0" />
                                    <input
                                        type="text"
                                        value={opt.label}
                                        onChange={e => updatePricingOption(i, 'label', e.target.value)}
                                        placeholder={t("Nom du pack...")}
                                        className="flex-1 bg-white/5 border border-white/5 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-white/10 transition-colors"
                                    />
                                    <input
                                        type="text"
                                        value={opt.price}
                                        onChange={e => updatePricingOption(i, 'price', e.target.value)}
                                        placeholder={t("Prix (ex: 85.000 FCFA)")}
                                        className="w-40 bg-white/5 border border-white/5 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors"
                                    />
                                    {pricingOptions.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removePricingOption(i)}
                                            className="p-2 rounded-lg text-gray-600 hover:text-red-400 transition-colors"
                                            title={t("Supprimer cette option")}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Apparence */}
                    <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-6 space-y-5">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Palette size={12} /> Apparence
                        </p>

                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block"><T>Couleur</T></label>
                            <div className="flex items-center gap-2 flex-wrap">
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        className={cn(
                                            'w-8 h-8 rounded-lg transition-all border-2',
                                            color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'
                                        )}
                                        style={{ backgroundColor: c }}
                                        title={c}
                                    />
                                ))}
                                <input
                                    type="color"
                                    value={color}
                                    onChange={e => setColor(e.target.value)}
                                    className="w-8 h-8 bg-transparent border border-white/10 rounded-lg cursor-pointer"
                                    title={t("Couleur personnalisée")}
                                />
                            </div>
                            <div className="mt-2 h-1 rounded-full" style={{ background: color }} />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block"><T>Type d&apos;icône</T></label>
                            <select
                                value={iconType}
                                onChange={e => setIconType(e.target.value)}
                                title={t("Type d'icône")}
                                className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none"
                            >
                                {ICON_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                                <ImageIcon size={12} /> URL Image / Icône
                            </label>
                            <input
                                type="text"
                                value={imageUrl}
                                onChange={e => setImageUrl(e.target.value)}
                                placeholder={t("/assets/icones/icone_exemple.png")}
                                className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 px-4 text-white text-xs font-mono focus:outline-none focus:border-white/10 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Paramètres */}
                    <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-6 space-y-5">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Hash size={12} /> Paramètres
                        </p>

                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                Ordre d&apos;affichage
                            </label>
                            <input
                                type="number"
                                value={orderIndex}
                                onChange={e => setOrderIndex(Number(e.target.value))}
                                min={0}
                                title={t("Ordre d'affichage")}
                                placeholder="0"
                                className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-white/10 transition-colors"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-white"><T>Actif sur le site</T></p>
                                <p className="text-[10px] text-gray-600"><T>Visible par les visiteurs</T></p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsActive(!isActive)}
                                className={cn(
                                    'w-12 h-6 rounded-full transition-colors relative',
                                    isActive ? 'bg-[#008751]' : 'bg-white/10'
                                )}
                                title={isActive ? 'Désactiver' : 'Activer'}
                            >
                                <span className={cn(
                                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-all',
                                    isActive ? 'left-7' : 'left-1'
                                )} />
                            </button>
                        </div>
                    </div>

                    {/* Preview */}
                    <div
                        className="rounded-2xl p-5 border"
                        style={{ borderColor: color + '30', backgroundColor: color + '08' }}
                    >
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3"><T>Aperçu</T></p>
                        {imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageUrl} alt="" className="w-12 h-12 object-contain mb-3" />
                        )}
                        <div className="w-3 h-0.5 rounded-full mb-2" style={{ backgroundColor: color }} />
                        <p className="text-sm font-black text-white">{title || 'Titre du service'}</p>
                        <p className="text-[10px] text-gray-500 mt-1">{subtitle || 'Sous-titre...'}</p>
                        {priceDisplay && (
                            <p className="text-xs font-bold mt-2" style={{ color }}>{priceDisplay}</p>
                        )}
                        <p className="text-[10px] text-gray-600 mt-2">
                            {features.filter(f => f.trim()).length} feature(s) · {pricingOptions.filter(o => o.label.trim()).length} option(s)
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
