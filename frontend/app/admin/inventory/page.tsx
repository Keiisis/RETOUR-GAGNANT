'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Package as PackageSearch, Plus, MagnifyingGlass as Search, Funnel as Filter, Warning as AlertTriangle, ArrowUpRight, Pencil as Edit2, Cube as Box, CurrencyEur as Euro, ShoppingBag, CheckCircle, X } from '@phosphor-icons/react';
import { formatCurrencySync } from '@/lib/currency'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface InventoryItem {
    id: string
    source: 'inventory'
    sku: string | null
    type: 'physical' | 'service' | 'digital'
    title: string
    category: string | null
    base_price: number
    cost_price: number
    tax_rate: number
    track_inventory: boolean
    current_stock: number
    low_stock_threshold: number
    is_published: boolean
}

interface BoutiqueItem {
    id: string
    source: 'boutique'
    sku: string | null
    type: 'physical'
    title: string
    category: string | null
    base_price: number
    cost_price: number
    tax_rate: number
    track_inventory: true
    current_stock: number
    low_stock_threshold: number
    is_published: boolean
    images: string[]
    sale_price: number | null
}

type UnifiedItem = InventoryItem | BoutiqueItem

// ─── Composant ─────────────────────────────────────────────────────────────────

export default function InventoryPage() {
    const [items, setItems] = useState<UnifiedItem[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [typeFilter, setTypeFilter] = useState<string>('all')

    // Stock edit inline
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editStock, setEditStock] = useState<string>('')
    const [savingStock, setSavingStock] = useState(false)

    useEffect(() => {
        fetchAll()
    }, [])

    const fetchAll = async () => {
        setLoading(true)
        try {
            // 1. Charger inventory_items (ERP)
            const { data: invData } = await supabase
                .from('inventory_items')
                .select('*')
                .order('created_at', { ascending: false })

            // 2. Charger produits boutique
            const { data: prodData } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false })

            // IDs déjà dans inventory_items (pour éviter les doublons si synchro)
            const invIds = new Set((invData || []).map((i: Record<string, unknown>) => String(i.id)))

            const invItems: InventoryItem[] = (invData || []).map((item: Record<string, unknown>) => ({
                id: String(item.id),
                source: 'inventory' as const,
                sku: (item.sku as string) || null,
                type: (item.type as 'physical' | 'service' | 'digital') || 'physical',
                title: String(item.title || ''),
                category: (item.category as string) || null,
                base_price: Number(item.base_price) || 0,
                cost_price: Number(item.cost_price) || 0,
                tax_rate: Number(item.tax_rate) || 0,
                track_inventory: Boolean(item.track_inventory),
                current_stock: Number(item.current_stock) || 0,
                low_stock_threshold: Number(item.low_stock_threshold) || 3,
                is_published: Boolean(item.is_published),
            }))

            // Produits boutique qui ne sont pas déjà dans inventory_items
            const boutiqueItems: BoutiqueItem[] = (prodData || [])
                .filter((p: Record<string, unknown>) => !invIds.has(String(p.id)))
                .map((item: Record<string, unknown>) => ({
                    id: String(item.id),
                    source: 'boutique' as const,
                    sku: null,
                    type: 'physical' as const,
                    title: String(item.title || ''),
                    category: (item.category as string) || null,
                    base_price: Number(item.price) || 0,
                    cost_price: 0,
                    tax_rate: 0,
                    track_inventory: true as const,
                    current_stock: Number(item.stock) || 0,
                    low_stock_threshold: 3,
                    is_published: Boolean(item.is_active),
                    images: Array.isArray(item.images) ? item.images as string[] : [],
                    sale_price: item.sale_price ? Number(item.sale_price) : null,
                }))

            setItems([...invItems, ...boutiqueItems])
        } catch (e) {
            console.error('fetchAll inventory error:', e)
        }
        setLoading(false)
    }

    // ─── Mise à jour du stock pour un produit boutique ────────────────────────
    const saveStock = async (id: string) => {
        const newStock = parseInt(editStock)
        if (isNaN(newStock) || newStock < 0) return
        setSavingStock(true)
        const { error } = await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', id)
        if (!error) {
            setItems(prev => prev.map(it =>
                it.id === id ? { ...it, current_stock: newStock } : it
            ))
        }
        setSavingStock(false)
        setEditingId(null)
    }

    // ─── Filtres ──────────────────────────────────────────────────────────────
    const filteredItems = items.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
        if (typeFilter === 'boutique') return matchesSearch && item.source === 'boutique'
        if (typeFilter === 'inventory') return matchesSearch && item.source === 'inventory'
        if (typeFilter !== 'all') return matchesSearch && item.type === typeFilter
        return matchesSearch
    })

    // ─── KPIs ─────────────────────────────────────────────────────────────────
    // Boutique items n'ont pas de cost_price → on utilise base_price (prix de vente)
    const totalStockValue = items.reduce((sum, item) => {
        if (!item.track_inventory) return sum
        const unitPrice = item.cost_price > 0 ? item.cost_price : item.base_price
        return sum + (item.current_stock * unitPrice)
    }, 0)
    const lowStockCount = items.filter(i =>
        i.track_inventory && i.current_stock <= i.low_stock_threshold).length
    const boutiqueCount = items.filter(i => i.source === 'boutique').length

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-[var(--panel-text-heading)] flex items-center gap-3">
                        <Box className="text-emerald-400" /> Gestion des Stocks & Catalogue
                    </h1>
                    <p className="text-[var(--panel-text-muted)] text-sm mt-1">
                        Catalogue unifié : Boutique + ERP (Devis/Factures). Les articles boutique apparaissent automatiquement ici.
                    </p>
                </div>
                <button type="button" className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg flex items-center gap-2">
                    <Plus size={16} /> Ajouter un Article ERP
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[var(--panel-surface)] border border-[var(--panel-border)] rounded-2xl p-5 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                            <PackageSearch size={18} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-[var(--panel-text-muted)] uppercase tracking-widest">Articles Total</p>
                            <h3 className="text-2xl font-black text-[var(--panel-text-heading)]">{items.length}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--panel-surface)] border border-[var(--panel-border)] rounded-2xl p-5 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-28 h-28 bg-[#FCD116]/10 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-[#FCD116]/10 flex items-center justify-center border border-[#FCD116]/20">
                            <ShoppingBag size={18} className="text-[#FCD116]" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-[var(--panel-text-muted)] uppercase tracking-widest">Produits Boutique</p>
                            <h3 className="text-2xl font-black text-[var(--panel-text-heading)]">{boutiqueCount}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--panel-surface)] border border-[var(--panel-border)] rounded-2xl p-5 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-28 h-28 bg-red-500/10 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                            <AlertTriangle size={18} className="text-red-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-[var(--panel-text-muted)] uppercase tracking-widest">Stock Faible</p>
                            <h3 className="text-2xl font-black text-red-400">{lowStockCount}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--panel-surface)] border border-[var(--panel-border)] rounded-2xl p-5 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <Euro size={18} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-[var(--panel-text-muted)] uppercase tracking-widest">Valeur Stock</p>
                            <h3 className="text-lg font-black text-blue-400">{formatCurrencySync(totalStockValue, 'XOF')}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Liste */}
            <div className="bg-[var(--panel-surface)] border border-[var(--panel-border)] rounded-2xl shadow-xl overflow-hidden">
                {/* Outils */}
                <div className="p-4 border-b border-[var(--panel-border)] flex flex-col sm:flex-row gap-4 items-center justify-between bg-black/20">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-text-muted)]" size={16} />
                        <input
                            type="text"
                            placeholder="Chercher par nom ou SKU..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[var(--panel-surface-alt)] border border-[var(--panel-border)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--panel-text-heading)] focus:outline-none focus:border-emerald-500/50"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Filter className="text-[var(--panel-text-muted)]" size={16} />
                        <select
                            title="Filtrer"
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="bg-[var(--panel-surface-alt)] border border-[var(--panel-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--panel-text-heading)] focus:outline-none focus:border-emerald-500/50 appearance-none font-bold w-full sm:w-auto"
                        >
                            <option value="all">Tous les articles</option>
                            <option value="boutique"> Boutique uniquement</option>
                            <option value="inventory"> ERP uniquement</option>
                            <option value="physical">Produits Physiques</option>
                            <option value="service">Services</option>
                            <option value="digital">Biens Numériques</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/40 border-b border-[var(--panel-border)] text-[10px] uppercase tracking-widest text-[var(--panel-text-muted)] font-bold">
                                <th className="p-4 whitespace-nowrap">Article & Source</th>
                                <th className="p-4">Type</th>
                                <th className="p-4">Stock</th>
                                <th className="p-4">Prix de Vente</th>
                                <th className="p-4">Statut</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-[var(--panel-text-muted)]">Chargement du catalogue unifié...</td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-[var(--panel-text-muted)]">Aucun article trouvé.</td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => (
                                    <tr key={`${item.source}-${item.id}`} className="border-b border-[var(--panel-border)] hover:bg-[var(--panel-surface-alt)] transition-colors group">
                                        {/* Article & Source */}
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <div className="font-bold text-[var(--panel-text-heading)] text-sm">{item.title}</div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {item.source === 'boutique' ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FCD116]/10 text-[#FCD116] border border-[#FCD116]/20">
                                                                <ShoppingBag size={9} /> Boutique
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                <Box size={9} /> ERP
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] text-[var(--panel-text-muted)] font-mono">
                                                            {item.sku || (item.source === 'boutique' ? item.category || '-' : 'Sans SKU')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Type */}
                                        <td className="p-4">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider
                                                ${item.type === 'physical' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                  item.type === 'service' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                                  'bg-gray-500/10 text-[var(--panel-text-muted)] border border-gray-500/20'}`}>
                                                {item.type === 'physical' ? 'Physique' : item.type === 'service' ? 'Service' : 'Digital'}
                                            </span>
                                        </td>

                                        {/* Stock : éditable pour les produits boutique */}
                                        <td className="p-4">
                                            {item.track_inventory ? (
                                                editingId === item.id && item.source === 'boutique' ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            title="Modifier le stock"
                                                            aria-label="Modifier le stock"
                                                            value={editStock}
                                                            onChange={e => setEditStock(e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') saveStock(item.id); if (e.key === 'Escape') setEditingId(null) }}
                                                            className="w-16 bg-[var(--panel-surface-alt)] border border-emerald-500/40 rounded-md px-2 py-1 text-[var(--panel-text-heading)] text-sm font-mono focus:outline-none"
                                                            autoFocus
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => saveStock(item.id)}
                                                            disabled={savingStock}
                                                            className="w-6 h-6 rounded bg-emerald-500/20 hover:bg-emerald-500/40 flex items-center justify-center text-emerald-400"
                                                            title="Valider"
                                                        >
                                                            <CheckCircle size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingId(null)}
                                                            className="w-6 h-6 rounded bg-[var(--panel-surface-alt)] hover:bg-[var(--panel-surface-alt)] flex items-center justify-center text-[var(--panel-text-muted)]"
                                                            title="Annuler"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-mono font-bold text-sm ${item.current_stock <= item.low_stock_threshold ? 'text-red-400' : 'text-emerald-400'}`}>
                                                            {item.current_stock}
                                                        </span>
                                                        {item.current_stock <= item.low_stock_threshold && (
                                                            <AlertTriangle size={13} className="text-red-400 animate-pulse" />
                                                        )}
                                                        {item.source === 'boutique' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => { setEditingId(item.id); setEditStock(String(item.current_stock)) }}
                                                                className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded bg-[var(--panel-surface-alt)] hover:bg-[var(--panel-surface-alt)] flex items-center justify-center text-[var(--panel-text-muted)] hover:text-[var(--panel-text-heading)] transition-all"
                                                                title="Modifier le stock"
                                                            >
                                                                <Edit2 size={10} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )
                                            ) : (
                                                <span className="text-[var(--panel-text-muted)] text-xs italic">Non suivi</span>
                                            )}
                                        </td>

                                        {/* Prix */}
                                        <td className="p-4">
                                            <div className="font-mono text-sm font-bold text-[var(--panel-text-heading)]">
                                                {formatCurrencySync(item.base_price, 'XOF')}
                                            </div>
                                            {item.source === 'boutique' && (item as BoutiqueItem).sale_price ? (
                                                <div className="text-[10px] text-[#FCD116] mt-0.5">
                                                    Promo: {formatCurrencySync((item as BoutiqueItem).sale_price!, 'XOF')}
                                                </div>
                                            ) : (item.cost_price > 0 && item.base_price > 0) ? (
                                                <div className="text-[10px] text-[var(--panel-text-muted)] mt-0.5">
                                                    Marge: {Math.round(((item.base_price - item.cost_price) / item.cost_price) * 100)}%
                                                </div>
                                            ) : null}
                                        </td>

                                        {/* Statut */}
                                        <td className="p-4">
                                            <span className={`inline-flex w-2.5 h-2.5 rounded-full ${item.is_published ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-gray-600'}`} />
                                        </td>

                                        {/* Actions */}
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {item.source === 'boutique' ? (
                                                    <a
                                                        href={`/admin/boutique/edit/${item.id}`}
                                                        className="w-8 h-8 rounded-lg bg-[#FCD116]/10 hover:bg-[#FCD116]/20 flex items-center justify-center text-[#FCD116] transition-colors"
                                                        title="Modifier dans Boutique"
                                                    >
                                                        <ShoppingBag size={14} />
                                                    </a>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        title="Modifier"
                                                        className="w-8 h-8 rounded-lg bg-[var(--panel-surface-alt)] hover:bg-[var(--panel-surface-alt)] flex items-center justify-center text-[var(--panel-text-muted)] hover:text-[var(--panel-text-heading)] transition-colors"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                )}
                                                {item.track_inventory && item.source === 'inventory' && (
                                                    <button
                                                        type="button"
                                                        title="Ajuster Stock (+/-)"
                                                        className="w-8 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center text-emerald-400 transition-colors"
                                                    >
                                                        <ArrowUpRight size={14} />
                                                    </button>
                                                )}
                                                {item.track_inventory && item.source === 'boutique' && editingId !== item.id && (
                                                    <button
                                                        type="button"
                                                        title="Modifier le stock"
                                                        onClick={() => { setEditingId(item.id); setEditStock(String(item.current_stock)) }}
                                                        className="w-8 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center text-emerald-400 transition-colors"
                                                    >
                                                        <ArrowUpRight size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
