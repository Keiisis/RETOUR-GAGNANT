'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getProposalById, updateProposalAndItems } from '@/app/actions/ai-proposals'
import SlideGalleryEditor, { type SlideImage } from '@/components/proposals/SlideGalleryEditor'
import { motion, Reorder } from 'framer-motion'
import {
    ArrowLeft, Save, Loader2, Eye, Trash2, Plus, Copy, Check,
    ExternalLink, Upload, Image as ImageIcon, Sparkles, GripVertical, FileDown
} from 'lucide-react'
import { Price } from '@/components/ui/Price'

interface ProposalItem {
    id: string
    proposal_id: string
    type: string
    title: string
    subtitle?: string
    description: string | null
    location: string | null
    highlights?: string[]
    image_url: string | null
    original_price: number
    selling_price: number
    order_index: number
    images?: SlideImage[]
    metadata?: Record<string, unknown> | null
}

interface Proposal {
    id: string
    secret_key: string
    client_name: string
    client_email: string | null
    destination: string
    status: string
    total_amount: number
    currency?: string
}

const TYPE_OPTIONS = [
    { value: 'hero', label: '✨ Accueil (Hero)', color: '#FCD116' },
    { value: 'hotel', label: '🏨 Hébergement', color: '#38BDF8' },
    { value: 'restaurant', label: '🍽️ Restaurant', color: '#FB923C' },
    { value: 'activity', label: '🎯 Activité / Visite', color: '#34D399' },
    { value: 'transport', label: '🚗 Transport', color: '#A78BFA' },
    { value: 'pricing', label: '💰 Récapitulatif', color: '#FCD116' },
]

export default function AdminPresentationEditor({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params)
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [downloading, setDownloading] = useState(false)
    const [proposal, setProposal] = useState<Proposal | null>(null)
    const [items, setItems] = useState<ProposalItem[]>([])
    const [currency, setCurrency] = useState('XOF')
    const [copied, setCopied] = useState(false)
    const [expandedSlide, setExpandedSlide] = useState<string | null>(null)
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

    const fetchData = useCallback(async () => {
        setLoading(true)
        const result = await getProposalById(id)
        if (!result.success || !result.proposal) {
            alert('Proposition introuvable.')
            router.push('/admin/proposals')
            return
        }
        setProposal(result.proposal)
        setItems((result.items || []).map((it: Record<string, unknown>) => ({
            ...it,
            // Galerie stockée dans metadata.images (jsonb) — remontée en champ éditable
            images: ((it.metadata as Record<string, unknown> | null)?.images as SlideImage[]) || [],
        })) as unknown as ProposalItem[])
        setCurrency(result.proposal.currency || 'XOF')
        setLoading(false)
    }, [id, router])

    useEffect(() => { fetchData() }, [fetchData])

    const updateItem = (itemId: string, field: keyof ProposalItem, value: string | number | string[]) => {
        setItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, [field]: value } : item
        ))
    }

    const removeItem = (itemId: string) => {
        if (!confirm('Supprimer cette slide ?')) return
        setItems(prev => prev.filter(item => item.id !== itemId))
    }

    const addItem = () => {
        const newItem: ProposalItem = {
            id: 'temp-' + Date.now(),
            proposal_id: proposal!.id,
            type: 'activity',
            title: 'Nouvelle Slide',
            subtitle: '',
            description: '',
            location: proposal!.destination,
            highlights: [],
            image_url: '',
            original_price: 0,
            selling_price: 0,
            order_index: items.length
        }
        setItems(prev => [...prev, newItem])
        setExpandedSlide(newItem.id)
    }

    const handleImageUpload = async (itemId: string, file: File) => {
        const formData = new FormData()
        formData.append('file', file)

        try {
            const res = await fetch('/api/upload/proposal', { method: 'POST', body: formData })
            const data = await res.json()
            if (data.url) {
                updateItem(itemId, 'image_url', data.url)
            } else {
                alert(data.error || 'Erreur upload')
            }
        } catch {
            alert('Erreur lors du téléchargement.')
        }
    }

    const calculateTotal = () => {
        return items.reduce((acc, item) => acc + (Number(item.selling_price) || 0), 0)
    }

    const copyLink = () => {
        if (!proposal) return
        navigator.clipboard.writeText(`${window.location.origin}/p/${proposal.secret_key}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const saveChanges = async () => {
        if (!proposal) return
        setSaving(true)
        try {
            const itemsForDb = items.map(({ images, metadata, ...rest }) => ({
                ...rest,
                metadata: { ...((metadata as Record<string, unknown>) || {}), images: images || [] },
            }))
            const result = await updateProposalAndItems(
                proposal.id,
                calculateTotal(),
                itemsForDb as unknown as Record<string, unknown>[],
                currency
            )
            if (result.success) {
                await fetchData()
            } else {
                alert('Erreur: ' + (result.error || ''))
            }
        } catch {
            alert('Erreur lors de la sauvegarde.')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-[#FCD116]" />
                <p className="text-slate-400 text-sm">Chargement de la proposition...</p>
            </div>
        )
    }

    if (!proposal) return null

    const publicUrl = `/p/${proposal.secret_key}`

    return (
        <div className="p-6 lg:p-8 max-w-5xl mx-auto pb-32">
            {/* Header Bénin */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-8">
                <button title="Retour" onClick={() => router.push('/admin/proposals')} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 self-start">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#008751] via-[#FCD116] to-[#E8112D] flex items-center justify-center shadow-lg shadow-[#FCD116]/20">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl lg:text-2xl font-black text-white">Éditeur de Proposition</h1>
                        <p className="text-slate-400 text-sm">
                            Client : <span className="text-[#FCD116] font-semibold">{proposal.client_name}</span> — {proposal.destination}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <a href={publicUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition text-sm">
                        <Eye className="w-4 h-4" /> Aperçu
                    </a>
                    <button
                        type="button"
                        disabled={downloading}
                        onClick={async () => {
                            if (!proposal) return
                            setDownloading(true)
                            try {
                                const res = await fetch(`/api/proposals/${proposal.id}/devis`)
                                if (!res.ok) throw new Error('Erreur génération PDF')
                                const blob = await res.blob()
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `DEVIS-${proposal.client_name.replace(/\s+/g, '-')}.pdf`
                                a.click()
                                URL.revokeObjectURL(url)
                            } catch { alert('Erreur lors de la génération du devis PDF') }
                            finally { setDownloading(false) }
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition text-sm disabled:opacity-50"
                    >
                        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                        Devis PDF
                    </button>
                    <button type="button" onClick={saveChanges} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#008751] to-[#FCD116] hover:opacity-90 text-slate-900 rounded-xl font-black transition shadow-lg text-sm">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Sauvegarder
                    </button>
                </div>
            </div>

            {/* Stats bar */}
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-5 mb-8">
                <div className="h-1 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] rounded-full mb-5" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Facturé</p>
                        <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#E8112D]">
                            <Price amount={calculateTotal()} currency="XOF" forceDisplayCurrency={currency as any} />
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Devise</p>
                        <select
                            title="Devise"
                            value={currency}
                            onChange={e => setCurrency(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:border-[#FCD116] focus:outline-none"
                        >
                            <option value="XOF">FCFA (XOF)</option>
                            <option value="EUR">Euro (EUR)</option>
                            <option value="USD">Dollar (USD)</option>
                            <option value="GBP">Livre (GBP)</option>
                        </select>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Statut</p>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${proposal.status === 'paid' ? 'bg-[#008751]/20 text-[#008751]' : proposal.status === 'ready' ? 'bg-[#FCD116]/20 text-[#FCD116]' : 'bg-slate-800 text-slate-300'}`}>
                            {proposal.status === 'paid' ? '✅ Payé' : proposal.status === 'ready' ? '📨 Prêt' : '⏳ Brouillon'}
                        </span>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Lien Secret</p>
                        <div className="flex items-center gap-2">
                            <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-[#008751] font-mono text-xs flex-1 truncate select-all">{publicUrl}</div>
                            <button title="Copier" onClick={copyLink} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition">
                                {copied ? <Check className="w-4 h-4 text-[#008751]" /> : <Copy className="w-4 h-4 text-slate-400" />}
                            </button>
                            <a title="Ouvrir" href={publicUrl} target="_blank" rel="noreferrer" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition">
                                <ExternalLink className="w-4 h-4 text-slate-400" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Slides Editor — Reorderable */}
            <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-4">
                {items.map((item, index) => {
                    const typeOpt = TYPE_OPTIONS.find(t => t.value === item.type)
                    const isExpanded = expandedSlide === item.id

                    return (
                        <Reorder.Item key={item.id} value={item}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all"
                            >
                                {/* Slide Header — always visible */}
                                <div
                                    className="p-4 flex items-center gap-3 cursor-pointer select-none"
                                    onClick={() => setExpandedSlide(isExpanded ? null : item.id)}
                                >
                                    <GripVertical className="w-4 h-4 text-slate-600 cursor-grab flex-shrink-0" />
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black" style={{ background: `${typeOpt?.color}20`, color: typeOpt?.color }}>
                                        {index + 1}
                                    </div>

                                    {item.image_url && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={item.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                                    )}

                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-bold text-sm truncate">{item.title}</p>
                                        <p className="text-slate-500 text-xs">{typeOpt?.label}</p>
                                    </div>

                                    {item.selling_price > 0 && (
                                        <span className="text-[#FCD116] font-bold text-sm">
                                            <Price amount={item.selling_price} currency="XOF" forceDisplayCurrency={currency as any} />
                                        </span>
                                    )}

                                    <button title="Supprimer" onClick={(e) => { e.stopPropagation(); removeItem(item.id) }} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Slide Body — expandable */}
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        className="border-t border-slate-800 p-5"
                                    >
                                        <div className="grid grid-cols-12 gap-5">
                                            {/* Left column */}
                                            <div className="col-span-12 md:col-span-7 space-y-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Type</label>
                                                        <select title="Type" value={item.type} onChange={e => updateItem(item.id, 'type', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:border-[#FCD116] focus:outline-none text-sm">
                                                            {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Lieu</label>
                                                        <input type="text" title="Lieu" value={item.location || ''} onChange={e => updateItem(item.id, 'location', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:border-[#FCD116] focus:outline-none text-sm" />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Titre</label>
                                                    <input type="text" title="Titre" value={item.title} onChange={e => updateItem(item.id, 'title', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-bold focus:border-[#FCD116] focus:outline-none" />
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Sous-titre</label>
                                                    <input type="text" title="Sous-titre" value={item.subtitle || ''} onChange={e => updateItem(item.id, 'subtitle', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-300 focus:border-[#FCD116] focus:outline-none text-sm" placeholder="Phrase d'accroche courte..." />
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Description</label>
                                                    <textarea rows={3} title="Description" value={item.description || ''} onChange={e => updateItem(item.id, 'description', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 focus:border-[#FCD116] focus:outline-none leading-relaxed text-sm" placeholder="Décrivez ce lieu avec passion..." />
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Points forts (séparés par des virgules)</label>
                                                    <input type="text" title="Highlights" value={(item.highlights || []).join(', ')} onChange={e => updateItem(item.id, 'highlights', e.target.value.split(',').map(s => s.trim()).filter(Boolean) as unknown as string)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-300 focus:border-[#FCD116] focus:outline-none text-sm" placeholder="WiFi, Piscine, Vue mer..." />
                                                </div>
                                            </div>

                                            {/* Right column — Image + Price */}
                                            <div className="col-span-12 md:col-span-5 space-y-4">
                                                {/* Image upload zone */}
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Image</label>
                                                    <div className="relative">
                                                        {item.image_url ? (
                                                            <div className="relative group rounded-xl overflow-hidden border border-slate-800">
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img src={item.image_url} alt={item.title} className="w-full h-32 object-cover" />
                                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                                                    <button title="Changer" onClick={() => fileInputRefs.current[item.id]?.click()} className="p-2 bg-white/20 rounded-lg hover:bg-white/30 text-white"><Upload className="w-4 h-4" /></button>
                                                                    <button title="Supprimer" onClick={() => updateItem(item.id, 'image_url', '')} className="p-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 text-red-400"><Trash2 className="w-4 h-4" /></button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => fileInputRefs.current[item.id]?.click()}
                                                                className="w-full h-32 border-2 border-dashed border-slate-800 hover:border-[#FCD116]/50 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-[#FCD116] transition group"
                                                            >
                                                                <div className="p-2 bg-slate-900 group-hover:bg-[#FCD116]/10 rounded-lg transition">
                                                                    <ImageIcon className="w-5 h-5" />
                                                                </div>
                                                                <span className="text-xs font-medium">Importer une image</span>
                                                            </button>
                                                        )}
                                                        <input
                                                            ref={(el) => { fileInputRefs.current[item.id] = el }}
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0]
                                                                if (file) handleImageUpload(item.id, file)
                                                            }}
                                                        />
                                                    </div>
                                                    {/* URL fallback */}
                                                    <input type="text" title="URL image" value={item.image_url || ''} onChange={e => updateItem(item.id, 'image_url', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-500 text-xs focus:border-[#FCD116] focus:outline-none mt-2" placeholder="Ou coller une URL..." />
                                                    <SlideGalleryEditor
                                                        images={item.images || []}
                                                        onChange={imgs => setItems(prev => prev.map(x => x.id === item.id ? { ...x, images: imgs } : x))}
                                                    />
                                                </div>

                                                {/* Prices */}
                                                {item.type !== 'hero' && item.type !== 'pricing' && (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Prix Indicatif</label>
                                                            <div className="bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-500 font-mono text-sm">
                                                                {item.original_price.toLocaleString()}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-[#FCD116]/70 uppercase tracking-widest mb-1 block">Prix Client *</label>
                                                            <input type="number" title="Prix Client" value={item.selling_price} onChange={e => updateItem(item.id, 'selling_price', parseFloat(e.target.value) || 0)} className="w-full bg-[#FCD116]/10 border border-[#FCD116]/30 rounded-xl px-3 py-2.5 text-[#FCD116] font-bold focus:border-[#FCD116] focus:outline-none text-sm" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        </Reorder.Item>
                    )
                })}
            </Reorder.Group>

            {/* Add slide button */}
            <button
                onClick={addItem}
                className="w-full mt-5 py-5 border-2 border-dashed border-slate-800 hover:border-[#FCD116]/50 rounded-2xl text-slate-400 hover:text-[#FCD116] font-medium flex flex-col items-center justify-center gap-2 transition group"
            >
                <div className="p-3 bg-slate-900 group-hover:bg-[#FCD116]/10 rounded-full transition">
                    <Plus className="w-5 h-5" />
                </div>
                Ajouter une Slide
            </button>

            {/* Fixed bottom bar */}
            <div className="fixed bottom-0 left-0 lg:left-[260px] right-0 p-4 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 z-40">
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total</p>
                        <p className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#E8112D]">
                            <Price amount={calculateTotal()} currency="XOF" forceDisplayCurrency={currency as any} />
                        </p>
                    </div>
                    <button onClick={saveChanges} disabled={saving} className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] text-slate-900 rounded-xl font-black transition shadow-lg hover:scale-105 active:scale-95">
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Sauvegarder et Valider
                    </button>
                </div>
            </div>
        </div>
    )
}
