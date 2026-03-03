'use client'

import { useList, useNavigation, useDelete, useUpdate } from '@refinedev/core'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Plus, Trash2, Search, ShoppingBag,
    Loader2, Edit3, Eye, EyeOff, Star
} from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
    const { create, edit } = useNavigation()
    const queryResult = useList<ProductItem>({
        resource: 'products',
        pagination: { pageSize: 50 },
        sorters: [{ field: 'created_at', order: 'desc' }],
    })
    const { mutate: deleteItem } = useDelete()
    const { mutate: updateItem } = useUpdate()
    const [searchTerm, setSearchTerm] = useState('')
    const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

    const data = queryResult.query?.data;
    const isLoading = queryResult.query?.isLoading;
    const items: ProductItem[] = data?.data || []
    const filtered = items.filter((item) => {
        const matchSearch = (item.title?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        const matchFilter = filter === 'all' ||
            (filter === 'active' && item.is_active) ||
            (filter === 'inactive' && !item.is_active)
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
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Commerce en Ligne</span>
                    </div>
                    <h1 className="text-5xl font-black text-white font-heading tracking-tighter">
                        BOUTIQUE <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#008751]">ADMIN</span>
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                    <div className="relative flex-1 min-w-[250px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Rechercher un produit..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-[#0a0f18] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-[#FCD116]/30 transition-all text-sm font-medium"
                        />
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/5 rounded-2xl">
                        {(['all', 'active', 'inactive'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                                    filter === f ? 'bg-[#FCD116] text-black shadow-lg' : 'text-gray-500 hover:text-white'
                                )}
                            >
                                {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : 'Inactifs'}
                            </button>
                        ))}
                    </div>

                    <Button
                        onClick={() => create('products')}
                        className="bg-[#008751] h-14 px-8 rounded-2xl text-white font-black tracking-widest gap-2 shadow-xl hover:shadow-green-500/10 transform active:scale-95 transition-all"
                    >
                        <Plus size={20} /> AJOUTER
                    </Button>
                </div>
            </div>

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
                            <div className="col-span-1">Image</div>
                            <div className="col-span-3">Produit</div>
                            <div className="col-span-2">Categorie</div>
                            <div className="col-span-1">Prix</div>
                            <div className="col-span-1">Stock</div>
                            <div className="col-span-1">Statut</div>
                            <div className="col-span-3 text-right">Actions</div>
                        </div>

                        <AnimatePresence mode="popLayout">
                            {filtered.map((item, index: number) => (
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
                                        <span className={cn(
                                            'text-sm font-black',
                                            (item.stock || 0) > 10 ? 'text-[#008751]' : (item.stock || 0) > 0 ? 'text-[#FCD116]' : 'text-[#E8112D]'
                                        )}>
                                            {item.stock}
                                        </span>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-1">
                                        <button
                                            title={item.is_active ? "Désactiver" : "Activer"}
                                            onClick={() => updateItem({
                                                resource: 'products',
                                                id: item.id,
                                                values: { is_active: !item.is_active },
                                            })}
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
                                            onClick={() => updateItem({
                                                resource: 'products',
                                                id: item.id,
                                                values: { is_featured: !item.is_featured },
                                            })}
                                            className={cn(
                                                'p-2.5 rounded-xl border transition-all',
                                                item.is_featured
                                                    ? 'bg-[#FCD116]/10 text-[#FCD116] border-[#FCD116]/20'
                                                    : 'bg-white/5 text-gray-500 border-white/5 hover:text-[#FCD116]'
                                            )}
                                            title="Mettre en vedette"
                                        >
                                            <Star size={14} />
                                        </button>
                                        <Button
                                            variant="outline"
                                            onClick={() => edit('products', item.id)}
                                            className="h-10 px-4 rounded-xl border-white/10 text-gray-400 hover:bg-white hover:text-black text-[10px] font-black uppercase tracking-widest"
                                        >
                                            <Edit3 size={12} className="mr-1.5" /> Modifier
                                        </Button>
                                        <button
                                            title="Supprimer le produit"
                                            onClick={() => {
                                                if (confirm('Supprimer ce produit ?')) {
                                                    deleteItem({ resource: 'products', id: item.id })
                                                }
                                            }}
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
                            Aucun produit. Cliquez sur "Ajouter" pour commencer.
                        </p>
                    </div>
                )}
            </Card>
        </div>
    )
}
