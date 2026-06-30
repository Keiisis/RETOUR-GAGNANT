'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getProposalsList } from '@/app/actions/ai-proposals'
import { deleteProposal } from '@/app/actions/ai-proposals'
import {
    Plus, FileText, Globe, ArrowRight, Loader2, Play, Wand2, X,
    Search, Check, Star, MapPin, Hotel, UtensilsCrossed, Car, Compass,
    Trash2, Copy, Sparkles
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatCurrencySync, type CurrencyCode } from '@/lib/currency'

interface Proposal {
    id: string
    secret_key: string
    client_name: string
    destination: string
    status: string
    total_amount: number
    created_at: string
    currency?: string
}

interface ScrapedItem {
    id: string
    category: string
    title: string
    address: string
    rating: number
    reviews: number
    image_url: string | null
    url?: string | null
    selected: boolean
}

interface ScrapedImage {
    id: string
    title: string
    url: string
    thumbnail: string
}

type ModalStep = 'form' | 'scraping' | 'selecting' | 'generating'

const CATEGORY_META: Record<string, { label: string, icon: React.ReactNode, color: string, bg: string }> = {
    hotel: { label: 'Hébergements', icon: <Hotel className="w-5 h-5" />, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
    restaurant: { label: 'Restaurants', icon: <UtensilsCrossed className="w-5 h-5" />, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
    activity: { label: 'Activités & Visites', icon: <Compass className="w-5 h-5" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    transport: { label: 'Transport', icon: <Car className="w-5 h-5" />, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
}

export default function AgentPresentationsPage() {
    const [proposals, setProposals] = useState<Proposal[]>([])
    const [loading, setLoading] = useState(true)
    const [newModalOpen, setNewModalOpen] = useState(false)
    const [modalStep, setModalStep] = useState<ModalStep>('form')
    const router = useRouter()

    // Form state
    const [formData, setFormData] = useState({
        client_name: '', client_email: '', client_phone: '',
        destination: '', start_date: '', end_date: '',
        budget: '', activities: '', notes: '', currency: 'XOF'
    })
    const [, setIsGenerating] = useState(false)

    // Scraping results
    const [scrapedCategories, setScrapedCategories] = useState<Record<string, ScrapedItem[]>>({})
    const [, setScrapedImages] = useState<ScrapedImage[]>([])
    const [activeCategory, setActiveCategory] = useState('hotel')

    useEffect(() => { fetchProposals() }, [])

    const fetchProposals = async () => {
        setLoading(true)
        const res = await getProposalsList()
        if (res.success && res.data) setProposals(res.data)
        setLoading(false)
    }

    const handleScrape = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.client_name || !formData.destination) return
        setModalStep('scraping')

        try {
            const res = await fetch('/api/ai/scrape-destinations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destination: formData.destination, activities: formData.activities })
            })
            const json = await res.json()

            if (json.success) {
                setScrapedCategories(json.categories || {})
                setScrapedImages(json.images || [])
                setActiveCategory('hotel')
                setModalStep('selecting')
            } else {
                alert(json.error || 'Erreur lors du scraping.')
                setModalStep('form')
            }
        } catch {
            alert('Erreur serveur.')
            setModalStep('form')
        }
    }

    const toggleItem = (category: string, itemId: string) => {
        setScrapedCategories(prev => ({
            ...prev,
            [category]: prev[category].map(item =>
                item.id === itemId ? { ...item, selected: !item.selected } : item
            )
        }))
    }

    const getSelectedItems = () => {
        const all: ScrapedItem[] = []
        Object.values(scrapedCategories).forEach(items => {
            items.filter(i => i.selected).forEach(i => all.push(i))
        })
        return all
    }

    const handleGenerate = async () => {
        const selectedItems = getSelectedItems()
        if (selectedItems.length === 0) {
            alert('Sélectionnez au moins un élément.')
            return
        }

        setModalStep('generating')
        setIsGenerating(true)

        try {
            const res = await fetch('/api/ai/generate-proposal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    selected_items: selectedItems
                })
            })
            const json = await res.json()
            if (json.success && json.proposalId) {
                setNewModalOpen(false)
                setModalStep('form')
                router.push(`/agent/presentations/${json.proposalId}`)
            } else {
                alert(json.error || 'Erreur lors de la génération.')
                setModalStep('selecting')
            }
        } catch {
            alert('Erreur serveur.')
            setModalStep('selecting')
        } finally {
            setIsGenerating(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer définitivement cette proposition ?')) return
        const res = await deleteProposal(id)
        if (res.success) {
            setProposals(prev => prev.filter(p => p.id !== id))
        } else {
            alert('Erreur: ' + (res.error || ''))
        }
    }

    const copyLink = (secretKey: string) => {
        navigator.clipboard.writeText(`${window.location.origin}/p/${secretKey}`)
    }

    const totalSelected = getSelectedItems().length

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Header avec branding Bénin */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#008751] via-[#FCD116] to-[#E8112D] flex items-center justify-center shadow-lg shadow-[#FCD116]/20">
                        <span className="text-xl font-black text-white drop-shadow-lg">RG</span>
                    </div>
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-black text-white flex items-center gap-2">
                            Smart Slides <span className="text-[#FCD116]">VIP</span>
                            <Sparkles className="w-6 h-6 text-[#FCD116]" />
                        </h1>
                        <p className="text-slate-400 text-sm">
                            <span className="text-[#008751] font-bold">RETOUR</span>{' '}
                            <span className="text-[#FCD116] font-bold">GAGNANT</span>{' '}
                            <span className="text-[#E8112D] font-bold">BÉNIN</span>
                            {' '}— Propositions IA de conciergerie premium
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => { setNewModalOpen(true); setModalStep('form') }}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] text-slate-900 rounded-xl font-black transition-all shadow-xl hover:shadow-[#FCD116]/30 hover:scale-105 active:scale-95"
                >
                    <Plus className="w-5 h-5" /> Nouvelle Proposition
                </button>
            </div>

            {/* Proposals Grid */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-[#FCD116] animate-spin" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {proposals.map((prop) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={prop.id}
                            className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden hover:border-[#FCD116]/30 transition-all group relative"
                        >
                            {/* Benin gradient top bar */}
                            <div className="h-1 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />

                            <div className="p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="p-2.5 bg-[#FCD116]/10 rounded-xl text-[#FCD116]">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${prop.status === 'paid' ? 'bg-[#008751]/20 text-[#008751]' : prop.status === 'ready' ? 'bg-[#FCD116]/20 text-[#FCD116]' : 'bg-slate-800 text-slate-400'}`}>
                                        {prop.status === 'paid' ? '✅ Payé' : prop.status === 'ready' ? '📨 Prêt' : '⏳ Brouillon'}
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-white mb-1 truncate">{prop.client_name}</h3>
                                <p className="text-[#FCD116] font-medium text-sm flex items-center gap-1.5 mb-4">
                                    <Globe className="w-3.5 h-3.5" /> {prop.destination}
                                </p>

                                <div className="space-y-1.5 text-xs text-slate-400 mb-5">
                                    <div className="flex justify-between">
                                        <span>Créé le</span>
                                        <span className="text-slate-300">{prop.created_at && !isNaN(new Date(prop.created_at).getTime()) ? new Date(prop.created_at).toLocaleDateString('fr-FR') : '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Montant</span>
                                        <span className="text-white font-bold text-sm">{formatCurrencySync(prop.total_amount || 0, (prop.currency as CurrencyCode) || 'XOF')}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => router.push(`/agent/presentations/${prop.id}`)}
                                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-xl font-medium transition-colors flex justify-center items-center gap-1.5 text-sm"
                                    >
                                        Modifier <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                    <a
                                        href={`/p/${prop.secret_key}`} target="_blank" rel="noreferrer"
                                        className="p-2.5 bg-[#FCD116] hover:bg-[#FCD116]/80 text-slate-900 rounded-xl transition-colors"
                                        title="Aperçu Slide"
                                    >
                                        <Play className="w-4 h-4 fill-current" />
                                    </a>
                                    <button
                                        onClick={() => copyLink(prop.secret_key)}
                                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-colors"
                                        title="Copier le lien"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(prop.id)}
                                        className="p-2.5 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl transition-colors"
                                        title="Supprimer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                    {proposals.length === 0 && (
                        <div className="col-span-full py-20 text-center text-slate-500">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#FCD116]/5 border border-[#FCD116]/10 flex items-center justify-center">
                                <FileText className="w-8 h-8 opacity-30" />
                            </div>
                            <p className="font-medium">Aucune proposition pour le moment.</p>
                            <p className="text-xs mt-1">Cliquez sur &quot;Nouvelle Proposition&quot; pour commencer.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════ MODAL ═══════ */}
            <AnimatePresence>
                {newModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-950 rounded-3xl w-full max-w-4xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
                        >
                            {/* Modal Header with Benin gradient */}
                            <div className="bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] p-[1px]">
                                <div className="bg-slate-950 p-5 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-[#FCD116]/10 rounded-xl flex items-center justify-center">
                                            <Wand2 className="w-5 h-5 text-[#FCD116]" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-black text-white">
                                                {modalStep === 'form' ? 'Nouveau Devis IA' :
                                                 modalStep === 'scraping' ? 'Recherche en cours...' :
                                                 modalStep === 'selecting' ? 'Sélectionnez vos éléments' :
                                                 'Génération du Slide...'}
                                            </h2>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {['form', 'scraping', 'selecting', 'generating'].map((s, i) => (
                                                    <div key={s} className="flex items-center gap-1">
                                                        <div className={`w-2 h-2 rounded-full ${['form', 'scraping', 'selecting', 'generating'].indexOf(modalStep) >= i ? 'bg-[#FCD116]' : 'bg-slate-700'}`} />
                                                        {i < 3 && <div className={`w-4 h-[2px] ${['form', 'scraping', 'selecting', 'generating'].indexOf(modalStep) > i ? 'bg-[#FCD116]' : 'bg-slate-700'}`} />}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => { setNewModalOpen(false); setModalStep('form') }} className="text-slate-400 hover:text-white" title="Fermer">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {/* ─── STEP FORM ─── */}
                                {modalStep === 'form' && (
                                    <form onSubmit={handleScrape} className="space-y-5 max-w-2xl mx-auto">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nom du Client *</label>
                                                <input required type="text" value={formData.client_name} onChange={e => setFormData({ ...formData, client_name: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FCD116] transition-colors" placeholder="Ex: Jean Dupont" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email</label>
                                                <input type="email" value={formData.client_email} onChange={e => setFormData({ ...formData, client_email: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FCD116] transition-colors" placeholder="jean@email.com" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Téléphone</label>
                                                <input type="tel" value={formData.client_phone} onChange={e => setFormData({ ...formData, client_phone: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FCD116] transition-colors" placeholder="+229 XX XX XX" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Destination *</label>
                                                <div className="relative">
                                                    <Globe className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                                                    <input required type="text" value={formData.destination} onChange={e => setFormData({ ...formData, destination: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-[#FCD116] transition-colors" placeholder="Ouidah, Ganvié..." />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Date début</label>
                                                <input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FCD116] transition-colors" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Date fin</label>
                                                <input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FCD116] transition-colors" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Budget indicatif</label>
                                                <input type="text" value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FCD116] transition-colors" placeholder="VIP, Confortable, Économique..." />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Devise</label>
                                                <select title="Devise de facturation" value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FCD116] transition-colors">
                                                    <option value="XOF">FCFA (XOF)</option>
                                                    <option value="EUR">Euro (EUR)</option>
                                                    <option value="USD">Dollar (USD)</option>
                                                    <option value="GBP">Livre Sterling (GBP)</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Activités / Préférences</label>
                                            <textarea rows={2} value={formData.activities} onChange={e => setFormData({ ...formData, activities: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FCD116] transition-colors" placeholder="Histoire, plage, gastronomie..." />
                                        </div>
                                        <button type="submit" className="w-full bg-gradient-to-r from-[#008751] to-[#FCD116] hover:opacity-90 text-slate-900 py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 shadow-lg">
                                            <Search className="w-5 h-5" /> Rechercher sur Google Maps
                                        </button>
                                    </form>
                                )}

                                {/* ─── STEP SCRAPING ─── */}
                                {modalStep === 'scraping' && (
                                    <div className="flex flex-col items-center justify-center py-16 gap-6">
                                        <div className="relative">
                                            <div className="w-20 h-20 rounded-full border-4 border-[#FCD116]/20 border-t-[#FCD116] animate-spin" />
                                            <Search className="absolute inset-0 m-auto w-8 h-8 text-[#FCD116]" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-white font-bold text-lg">Scraping Google Maps...</p>
                                            <p className="text-slate-400 text-sm mt-1">Recherche d&apos;hôtels, restaurants, activités pour <span className="text-[#FCD116] font-semibold">{formData.destination}</span></p>
                                        </div>
                                    </div>
                                )}

                                {/* ─── STEP SELECTING ─── */}
                                {modalStep === 'selecting' && (
                                    <div>
                                        {/* Category tabs */}
                                        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                                            {Object.entries(CATEGORY_META).map(([key, meta]) => {
                                                const count = (scrapedCategories[key + 's'] || scrapedCategories[key] || []).filter(i => i.selected).length
                                                const catKey = scrapedCategories[key + 's'] ? key + 's' : key
                                                const total = (scrapedCategories[catKey] || []).length
                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={() => setActiveCategory(key)}
                                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap border transition-all ${activeCategory === key ? `${meta.bg} ${meta.color} border-current` : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'}`}
                                                    >
                                                        {meta.icon} {meta.label}
                                                        {total > 0 && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${count > 0 ? 'bg-[#FCD116] text-slate-900' : 'bg-slate-800 text-slate-500'}`}>
                                                                {count}/{total}
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        {/* Items grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 max-h-[45vh] overflow-y-auto pr-1">
                                            {(() => {
                                                const catKey = scrapedCategories[activeCategory + 's'] ? activeCategory + 's' : activeCategory
                                                const items = scrapedCategories[catKey] || []
                                                if (items.length === 0) return <p className="col-span-2 text-center text-slate-500 py-8">Aucun résultat trouvé pour cette catégorie.</p>
                                                return items.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => toggleItem(catKey, item.id)}
                                                        className={`text-left p-4 rounded-xl border transition-all flex gap-3 ${item.selected ? 'bg-[#FCD116]/10 border-[#FCD116]/50 ring-2 ring-[#FCD116]/20' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                                                    >
                                                        {item.image_url ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={item.image_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                                                        ) : (
                                                            <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 text-2xl">
                                                                {CATEGORY_META[activeCategory]?.icon}
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-white font-bold text-sm truncate">{item.title}</p>
                                                            {item.address && <p className="text-slate-400 text-xs truncate flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{item.address}</p>}
                                                            {item.rating > 0 && (
                                                                <p className="text-[#FCD116] text-xs font-bold mt-1 flex items-center gap-1">
                                                                    <Star className="w-3 h-3 fill-current" /> {item.rating} <span className="text-slate-500 font-normal">({item.reviews})</span>
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center ${item.selected ? 'bg-[#FCD116] text-slate-900' : 'bg-slate-800 border border-slate-700'}`}>
                                                            {item.selected && <Check className="w-4 h-4" />}
                                                        </div>
                                                    </button>
                                                ))
                                            })()}
                                        </div>

                                        {/* Generate button */}
                                        <div className="border-t border-slate-800 pt-4 flex justify-between items-center">
                                            <span className="text-slate-400 text-sm">
                                                <strong className="text-[#FCD116]">{totalSelected}</strong> éléments sélectionnés
                                            </span>
                                            <button
                                                onClick={handleGenerate}
                                                disabled={totalSelected === 0}
                                                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] text-slate-900 rounded-xl font-black transition-all shadow-lg disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                                            >
                                                <Wand2 className="w-5 h-5" /> Générer le Slide IA
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* ─── STEP GENERATING ─── */}
                                {modalStep === 'generating' && (
                                    <div className="flex flex-col items-center justify-center py-16 gap-6">
                                        <div className="relative">
                                            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] animate-spin opacity-30 blur-xl absolute inset-0" />
                                            <Loader2 className="w-16 h-16 text-[#FCD116] animate-spin relative z-10" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-white font-bold text-lg">L&apos;IA construit votre proposition...</p>
                                            <p className="text-slate-400 text-sm mt-1">Création des slides avec les {totalSelected} éléments sélectionnés</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
