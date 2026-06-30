'use client'

import { useTranslation, T } from '@/lib/translation';
import { motion, AnimatePresence } from 'framer-motion'
import {
    Plus, Trash2, Search, ShoppingBag,
    Loader2, Edit3, Eye, EyeOff, Star, RefreshCw, AlertTriangle, PackageX
} from 'lucide-react'
import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface ProductItem {
    id: string
    title?: string
    description?: string
    category?: string
    price?: number
    sale_price?: number
    stock?: number
    is_active?: boolean
    is_featured?: boolean
    images?: string[]
    created_at?: string
}

export default function AdminBoutiquePage() {
    const { t } = useTranslation();
    const router = useRouter()
    const [items, setItems] = useState<ProductItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'low' | 'out'>('all')
    const [stockDraft, setStockDraft] = useState<Record<string, string>>({})

    const fetchProducts = useCallback(async () => {
        setIsLoading(true)
        const { data } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false })
        setItems(data || [])
        setIsLoading(false)
    }, [])

    useEffect(() => { fetchProducts() }, [fetchProducts])

    const updateProduct = async (id: string, values: Partial<ProductItem>) => {
        setUpdatingId(id)
        await supabase.from('products').update(values).eq('id', id)
        setItems(prev => prev.map(p => p.id === id ? { ...p, ...values } : p))
        setUpdatingId(null)
    }

    const deleteProduct = async (id: string) => {
        if (!confirm('Supprimer ce produit ?')) return
        await supabase.from('products').delete().eq('id', id)
        setItems(prev => prev.filter(p => p.id !== id))
    }

    const commitStock = async (id: string, raw: string) => {
        const n = Math.max(0, Math.floor(Number(raw)))
        if (!Number.isFinite(n)) return
        const current = items.find(p => p.id === id)
        if (current && (current.stock ?? 0) === n) {
            setStockDraft(prev => { const c = { ...prev }; delete c[id]; return c })
            return
        }
        await updateProduct(id, { stock: n })
        setStockDraft(prev => { const c = { ...prev }; delete c[id]; return c })
    }

    const lowStockCount = items.filter(i => i.is_active && (i.stock ?? 0) > 0 && (i.stock ?? 0) <= 5).length
    const outOfStockCount = items.filter(i => i.is_active && (i.stock ?? 0) === 0).length

    const filtered = items.filter((item) => {
        const matchSearch = (item.title?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        const stock = item.stock ?? 0
        const matchFilter = filter === 'all' ||
            (filter === 'active' && item.is_active) ||
            (filter === 'inactive' && !item.is_active) ||
            (filter === 'low' && item.is_active && stock > 0 && stock <= 5) ||
            (filter === 'out' && item.is_active && stock === 0)
        return matchSearch && matchFilter
    })

    const formatPrice = (price: number) => new Intl.NumberFormat('fr-FR').format(price || 0)

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* HEADER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#FCD116]">
                        <ShoppingBag size={18} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em]"><T>Commerce en Ligne</T></span>
                    </div>
                    <h1 className="text-5xl font-black text-white font-heading tracking-tighter">
                        BOUTIQUE <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#008751]"><T>ADMIN</T></span>
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                    <div className="relative flex-1 min-w-[250px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder={t("Rechercher un produit...")}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-[#0a0f18] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-[#FCD116]/30 transition-all text-sm font-medium"
                        />
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/5 rounded-2xl flex-wrap">
                        {(['all', 'active', 'inactive', 'low', 'out'] as const).map(f => {
                            const count = f === 'low' ? lowStockCount : f === 'out' ? outOfStockCount : null
                            return (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFilter(f)}
                                    className={cn(
                                        'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5',
                                        filter === f
                                            ? f === 'out' ? 'bg-[#E8112D] text-white shadow-lg'
                                            : f === 'low' ? 'bg-orange-500 text-white shadow-lg'
                                            : 'bg-[#FCD116] text-black shadow-lg'
                                            : 'text-gray-500 hover:text-white'
                                    )}
                                >
                                    {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : f === 'inactive' ? 'Inactifs' : f === 'low' ? 'Stock Faible' : 'Rupture'}
                                    {count !== null && count > 0 && (
                                        <span className={cn(
                                            'px-1.5 rounded-full text-[9px]',
                                            filter === f ? 'bg-black/20' : f === 'out' ? 'bg-[#E8112D]/20 text-[#E8112D]' : 'bg-orange-500/20 text-orange-400'
                                        )}>{count}</span>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    <Button
                        type="button"
                        onClick={() => router.push('/admin/boutique/create')}
                        className="bg-[#008751] h-14 px-8 rounded-2xl text-white font-black tracking-widest gap-2 shadow-xl hover:shadow-green-500/10 transform active:scale-95 transition-all"
                    >
                        <Plus size={20} /> AJOUTER
                    </Button>
                </div>
            </div>

            {/* ALERTES STOCK */}
            {(outOfStockCount > 0 || lowStockCount > 0) && !isLoading && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                    {outOfStockCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setFilter('out')}
                            className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#E8112D]/10 to-red-900/5 border border-[#E8112D]/30 hover:border-[#E8112D]/60 transition-all text-left"
                        >
                            <div className="w-12 h-12 rounded-xl bg-[#E8112D]/20 flex items-center justify-center">
                                <PackageX className="text-[#E8112D]" size={22} />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#E8112D]">En Rupture</p>
                                <p className="text-2xl font-black text-white">{outOfStockCount} produit{outOfStockCount > 1 ? 's' : ''}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">Réapprovisionnez immédiatement</p>
                            </div>
                        </button>
                    )}
                    {lowStockCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setFilter('low')}
                            className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-orange-500/10 to-amber-900/5 border border-orange-500/30 hover:border-orange-500/60 transition-all text-left"
                        >
                            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                <AlertTriangle className="text-orange-400" size={22} />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">Stock Faible</p>
                                <p className="text-2xl font-black text-white">{lowStockCount} produit{lowStockCount > 1 ? 's' : ''}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">≤ 5 unités restantes</p>
                            </div>
                        </button>
                    )}
                </motion.div>
            )}

            {/* TABLE */}
            <Card className="bg-[#0a0f18] border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-[#FCD116]" size={48} />
                    </div>
                ) : filtered.length > 0 ? (
                    <div className="divide-y divide-white/5">
                        {/* Table header */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-4 bg-white/[0.02] text-[9px] font-black text-gray-500 uppercase tracking-widest">
                            <div className="col-span-1"><T>Image</T></div>
                            <div className="col-span-3"><T>Produit</T></div>
                            <div className="col-span-2"><T>Categorie</T></div>
                            <div className="col-span-1"><T>Prix</T></div>
                            <div className="col-span-1"><T>Stock</T></div>
                            <div className="col-span-1"><T>Statut</T></div>
                            <div className="col-span-3 text-right"><T>Actions</T></div>
                        </div>

                        <AnimatePresence mode="popLayout">
                            {filtered.map((item) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="grid grid-cols-1 md:grid-cols-12 gap-4 px-8 py-6 hover:bg-white/[0.02] transition-colors group items-center"
                                >
                                    {/* Image */}
                                    <div className="col-span-1">
                                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 border border-white/5">
                                            {item.images && item.images[0] ? (
                                                <Image
                                                    src={item.images[0]}
                                                    alt={item.title || ''}
                                                    width={56}
                                                    height={56}
                                                    className="object-cover w-full h-full"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ShoppingBag size={18} className="text-gray-700" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <div className="col-span-3">
                                        <p className="text-sm font-bold text-white truncate">{item.title}</p>
                                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{item.description}</p>
                                    </div>

                                    {/* Category */}
                                    <div className="col-span-2">
                                        <span className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                            {item.category || 'General'}
                                        </span>
                                    </div>

                                    {/* Price */}
                                    <div className="col-span-1">
                                        <p className="text-sm font-black text-white">{formatPrice(item.price || 0)}</p>
                                        {item.sale_price && (
                                            <p className="text-[10px] text-[#E8112D] font-bold">{formatPrice(item.sale_price)}</p>
                                        )}
                                    </div>

                                    {/* Stock */}
                                    <div className="col-span-1">
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                title="Diminuer le stock"
                                                disabled={(item.stock || 0) <= 0 || updatingId === item.id}
                                                onClick={() => updateProduct(item.id, { stock: Math.max(0, (item.stock || 0) - 1) })}
                                                className="w-5 h-5 rounded-md bg-white/5 text-gray-400 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-xs font-black flex items-center justify-center"
                                            >−</button>
                                            {updatingId === item.id ? (
                                                <span className="min-w-[40px] text-center"><RefreshCw size={12} className="animate-spin inline text-[#FCD116]" /></span>
                                            ) : (
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={stockDraft[item.id] ?? String(item.stock ?? 0)}
                                                    onChange={e => setStockDraft(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                    onBlur={e => commitStock(item.id, e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                                        if (e.key === 'Escape') setStockDraft(prev => { const c = { ...prev }; delete c[item.id]; return c })
                                                    }}
                                                    onClick={e => e.currentTarget.select()}
                                                    title="Cliquer pour modifier — Entrée pour valider"
                                                    className={cn(
                                                        'w-10 bg-white/5 border border-white/10 rounded-md text-sm font-black text-center py-0.5 focus:outline-none focus:border-[#FCD116] focus:bg-[#FCD116]/5 transition-all',
                                                        (item.stock || 0) > 10 ? 'text-[#008751]' : (item.stock || 0) > 0 ? 'text-[#FCD116]' : 'text-[#E8112D]'
                                                    )}
                                                />
                                            )}
                                            <button
                                                type="button"
                                                title="Augmenter le stock"
                                                disabled={updatingId === item.id}
                                                onClick={() => updateProduct(item.id, { stock: (item.stock || 0) + 1 })}
                                                className="w-5 h-5 rounded-md bg-white/5 text-gray-400 hover:bg-green-500/20 hover:text-green-400 disabled:opacity-20 transition-all text-xs font-black flex items-center justify-center"
                                            >+</button>
                                        </div>
                                        <div className="flex items-center gap-1 mt-1">
                                            <button
                                                type="button"
                                                title="+10 unités"
                                                disabled={updatingId === item.id}
                                                onClick={() => updateProduct(item.id, { stock: (item.stock || 0) + 10 })}
                                                className="px-1.5 py-0.5 rounded bg-[#008751]/10 text-[#008751] text-[8px] font-black hover:bg-[#008751]/20 transition-all"
                                            >+10</button>
                                            <button
                                                type="button"
                                                title="+100 unités"
                                                disabled={updatingId === item.id}
                                                onClick={() => updateProduct(item.id, { stock: (item.stock || 0) + 100 })}
                                                className="px-1.5 py-0.5 rounded bg-[#008751]/10 text-[#008751] text-[8px] font-black hover:bg-[#008751]/20 transition-all"
                                            >+100</button>
                                        </div>
                                        {(item.stock || 0) === 0 && (
                                            <span className="text-[8px] font-black text-[#E8112D] uppercase tracking-wide">Rupture</span>
                                        )}
                                        {(item.stock || 0) > 0 && (item.stock || 0) <= 5 && (
                                            <span className="text-[8px] font-black text-orange-400 uppercase tracking-wide">Faible</span>
                                        )}
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-1">
                                        <button
                                            title={item.is_active ? "Désactiver" : "Activer"}
                                            onClick={() => updateProduct(item.id, { is_active: !item.is_active })}
                                            className={cn(
                                                'flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all',
                                                item.is_active
                                                    ? 'bg-[#008751]/10 text-[#008751] border-[#008751]/20'
                                                    : 'bg-white/5 text-gray-500 border-white/5'
                                            )}
                                        >
                                            {item.is_active ? <Eye size={10} /> : <EyeOff size={10} />}
                                            {item.is_active ? 'Actif' : 'Inactif'}
                                        </button>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-3 flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => updateProduct(item.id, { is_featured: !item.is_featured })}
                                            className={cn(
                                                'p-2.5 rounded-xl border transition-all',
                                                item.is_featured
                                                    ? 'bg-[#FCD116]/10 text-[#FCD116] border-[#FCD116]/20'
                                                    : 'bg-white/5 text-gray-500 border-white/5 hover:text-[#FCD116]'
                                            )}
                                            title={t("Mettre en vedette")}
                                        >
                                            <Star size={14} />
                                        </button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => router.push(`/admin/boutique/edit/${item.id}`)}
                                            className="h-10 px-4 rounded-xl border-white/10 text-gray-400 hover:bg-white hover:text-black text-[10px] font-black uppercase tracking-widest"
                                        >
                                            <Edit3 size={12} className="mr-1.5" /> Modifier
                                        </Button>
                                        <button
                                            title={t("Supprimer le produit")}
                                            onClick={() => deleteProduct(item.id)}
                                            className="p-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <ShoppingBag size={48} className="text-gray-700" />
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
                            Aucun produit. Cliquez sur &ldquo;Ajouter&rdquo; pour commencer.
                        </p>
                    </div>
                )}
            </Card>
        </div>
    )
}
