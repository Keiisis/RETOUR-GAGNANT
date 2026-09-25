'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Package as PackageSearch, Plus, MagnifyingGlass as Search, Funnel as Filter, Warning as AlertTriangle, ArrowUpRight, Pencil as Edit2, Cube as Box, CurrencyEur as Euro, ShoppingBag, CheckCircle, X, CircleNotch as Loader2 } from '@phosphor-icons/react';
import { formatCurrencySync } from '@/lib/currency'

async function authHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

/** Lit la réponse JSON d'une route et lève une Error lisible si !res.ok. */
async function lireReponse<T>(res: Response): Promise<T> {
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((json as { error?: string }).error || `Erreur ${res.status}`)
    return json as T
}

interface ArticleForm {
    title: string
    type: 'physical' | 'service' | 'digital'
    sku: string
    category: string
    description: string
    base_price: string
    cost_price: string
    tax_rate: string
    track_inventory: boolean
    current_stock: string
    low_stock_threshold: string
    is_published: boolean
}

const FORM_VIDE: ArticleForm = {
    title: '', type: 'physical', sku: '', category: '', description: '',
    base_price: '', cost_price: '', tax_rate: '18', track_inventory: true,
    current_stock: '0', low_stock_threshold: '5', is_published: true,
}

const MOTIFS: { value: 'in_purchase' | 'in_return' | 'adj_loss' | 'adj_manual'; label: string; sens: 1 | -1 | 0 }[] = [
    { value: 'in_purchase', label: 'Entrée : achat / réapprovisionnement', sens: 1 },
    { value: 'in_return', label: 'Entrée : retour client', sens: 1 },
    { value: 'adj_loss', label: 'Sortie : perte / casse', sens: -1 },
    { value: 'adj_manual', label: 'Correction d\'inventaire (stock réel)', sens: 0 },
]

const champCls = 'w-full bg-[var(--panel-surface-alt)] border border-[var(--panel-border-strong)] rounded-xl px-3 py-2 text-sm text-[var(--panel-text-heading)] placeholder:text-[var(--panel-text-faint)] focus:outline-none focus:border-emerald-500/60'
const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-[var(--panel-text-muted)] mb-1'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface InventoryItem {
    id: string
    source: 'inventory'
    sku: string | null
    type: 'physical' | 'service' | 'digital'
    title: string
    category: string | null
    description: string | null
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

    // Retour utilisateur (succès réel uniquement après res.ok)
    const [pageError, setPageError] = useState('')
    const [flash, setFlash] = useState('')

    // Modal article ERP (création / modification)
    const [articleOpen, setArticleOpen] = useState(false)
    const [articleId, setArticleId] = useState<string | null>(null)
    const [form, setForm] = useState<ArticleForm>(FORM_VIDE)
    const [savingArticle, setSavingArticle] = useState(false)
    const [articleError, setArticleError] = useState('')

    // Modal ajustement de stock ERP
    const [stockItem, setStockItem] = useState<InventoryItem | null>(null)
    const [motif, setMotif] = useState<typeof MOTIFS[number]['value']>('in_purchase')
    const [quantite, setQuantite] = useState('')
    const [stockNotes, setStockNotes] = useState('')
    const [adjusting, setAdjusting] = useState(false)
    const [stockError, setStockError] = useState('')

    useEffect(() => {
        fetchAll()
    }, [])

    const fetchAll = async () => {
        setLoading(true)
        try {
            // 1. Charger inventory_items (ERP)
            const { data: invData, error: invErr } = await supabase
                .from('inventory_items')
                .select('*')
                .order('created_at', { ascending: false })

            // 2. Charger produits boutique
            const { data: prodData, error: prodErr } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false })
            if (invErr || prodErr) setPageError('Chargement partiel du catalogue : ' + (invErr?.message || prodErr?.message))

            // IDs déjà dans inventory_items (pour éviter les doublons si synchro)
            const invIds = new Set((invData || []).map((i: Record<string, unknown>) => String(i.id)))

            const invItems: InventoryItem[] = (invData || []).map((item: Record<string, unknown>) => ({
                id: String(item.id),
                source: 'inventory' as const,
                sku: (item.sku as string) || null,
                type: (item.type as 'physical' | 'service' | 'digital') || 'physical',
                title: String(item.title || ''),
                category: (item.category as string) || null,
                description: (item.description as string) || null,
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
    // Passe par la route serveur : l'écriture directe avec la clé anonyme
    // échouait en silence (règles d'accès) et la valeur affichée mentait.
    const saveStock = async (id: string) => {
        const newStock = Number(editStock)
        if (!Number.isInteger(newStock) || newStock < 0) { setPageError('Stock invalide : nombre entier positif attendu.'); return }
        setSavingStock(true); setPageError(''); setFlash('')
        try {
            const res = await fetch('/api/admin/inventory/stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                body: JSON.stringify({ source: 'boutique', id, value: newStock }),
            })
            const json = await lireReponse<{ current_stock: number }>(res)
            setItems(prev => prev.map(it => it.id === id ? { ...it, current_stock: json.current_stock } : it))
            setEditingId(null)
            setFlash('Stock boutique mis à jour.')
        } catch (e) {
            setPageError(e instanceof Error ? e.message : 'Mise à jour du stock impossible.')
        } finally {
            setSavingStock(false)
        }
    }

    // ─── Article ERP : création / modification ─────────────────────────────
    const ouvrirCreation = () => {
        setArticleId(null); setForm(FORM_VIDE); setArticleError(''); setArticleOpen(true)
    }

    const ouvrirEdition = (it: InventoryItem) => {
        setArticleId(it.id)
        setForm({
            title: it.title, type: it.type, sku: it.sku || '', category: it.category || '',
            description: it.description || '', base_price: String(it.base_price), cost_price: String(it.cost_price),
            tax_rate: String(it.tax_rate), track_inventory: it.track_inventory, current_stock: String(it.current_stock),
            low_stock_threshold: String(it.low_stock_threshold), is_published: it.is_published,
        })
        setArticleError(''); setArticleOpen(true)
    }

    const enregistrerArticle = async () => {
        if (!form.title.trim()) { setArticleError('Le titre est requis.'); return }
        const nums = { base_price: form.base_price || '0', cost_price: form.cost_price || '0', tax_rate: form.tax_rate || '0', low_stock_threshold: form.low_stock_threshold || '0' }
        if (Object.values(nums).some(v => !Number.isFinite(Number(v)) || Number(v) < 0)) { setArticleError('Les montants et seuils doivent être des nombres positifs.'); return }
        setSavingArticle(true); setArticleError('')
        const suivi = form.type === 'physical' && form.track_inventory
        const payload: Record<string, unknown> = {
            title: form.title.trim(), type: form.type, sku: form.sku.trim() || null,
            category: form.category.trim() || null, description: form.description.trim() || null,
            base_price: Number(nums.base_price), cost_price: Number(nums.cost_price), tax_rate: Number(nums.tax_rate),
            track_inventory: suivi, low_stock_threshold: Math.floor(Number(nums.low_stock_threshold)), is_published: form.is_published,
        }
        if (articleId) payload.id = articleId
        else payload.current_stock = suivi ? Math.max(0, Math.floor(Number(form.current_stock) || 0)) : 0
        try {
            const res = await fetch('/api/admin/inventory', {
                method: articleId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                body: JSON.stringify(payload),
            })
            await lireReponse<{ item: unknown }>(res)
            setArticleOpen(false)
            setFlash(articleId ? 'Article mis à jour.' : 'Article ERP créé.')
            await fetchAll()
        } catch (e) {
            setArticleError(e instanceof Error ? e.message : 'Enregistrement impossible.')
        } finally {
            setSavingArticle(false)
        }
    }

    // ─── Article ERP : ajustement de stock tracé ───────────────────────────
    const ouvrirStock = (it: InventoryItem) => {
        setStockItem(it); setMotif('in_purchase'); setQuantite(''); setStockNotes(''); setStockError('')
    }

    const ajusterStock = async () => {
        if (!stockItem) return
        const q = Number(quantite)
        const m = MOTIFS.find(x => x.value === motif)!
        if (!Number.isInteger(q) || q < 0 || (m.sens !== 0 && q === 0)) {
            setStockError(m.sens === 0 ? 'Indiquez le stock réel compté (entier ≥ 0).' : 'Indiquez une quantité entière supérieure à 0.')
            return
        }
        setAdjusting(true); setStockError('')
        try {
            const res = await fetch('/api/admin/inventory/stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                body: JSON.stringify(m.sens === 0
                    ? { source: 'inventory', id: stockItem.id, mode: 'set', value: q, notes: stockNotes }
                    : { source: 'inventory', id: stockItem.id, mode: 'delta', value: q * m.sens, movement_type: motif, notes: stockNotes }),
            })
            const json = await lireReponse<{ current_stock: number; warning?: string }>(res)
            setItems(prev => prev.map(it => it.id === stockItem.id ? { ...it, current_stock: json.current_stock } : it))
            setStockItem(null)
            setFlash(json.warning || `Stock de « ${stockItem.title} » : ${json.current_stock}.`)
        } catch (e) {
            setStockError(e instanceof Error ? e.message : 'Ajustement impossible.')
        } finally {
            setAdjusting(false)
        }
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
                <button type="button" onClick={ouvrirCreation} className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg flex items-center gap-2">
                    <Plus size={16} /> Ajouter un Article ERP
                </button>
            </div>

            {pageError && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 text-sm">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" /> <span className="flex-1">{pageError}</span>
                    <button type="button" onClick={() => setPageError('')} title="Fermer" className="shrink-0"><X size={14} /></button>
                </div>
            )}
            {flash && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-sm">
                    <CheckCircle size={16} className="shrink-0 mt-0.5" /> <span className="flex-1">{flash}</span>
                    <button type="button" onClick={() => setFlash('')} title="Fermer" className="shrink-0"><X size={14} /></button>
                </div>
            )}

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
                                                            className="w-6 h-6 rounded bg-[var(--panel-surface-alt)] hover:bg-[var(--panel-surface-active)] flex items-center justify-center text-[var(--panel-text-muted)]"
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
                                                                className="lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 w-5 h-5 rounded bg-[var(--panel-surface-alt)] hover:bg-[var(--panel-surface-active)] flex items-center justify-center text-[var(--panel-text-muted)] hover:text-[var(--panel-text-heading)] transition-all"
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
                                            <div className="flex items-center justify-end gap-2 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
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
                                                        onClick={() => ouvrirEdition(item as InventoryItem)}
                                                        className="w-8 h-8 rounded-lg bg-[var(--panel-surface-alt)] hover:bg-[var(--panel-surface-active)] flex items-center justify-center text-[var(--panel-text-muted)] hover:text-[var(--panel-text-heading)] transition-colors"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                )}
                                                {item.track_inventory && item.source === 'inventory' && (
                                                    <button
                                                        type="button"
                                                        title="Ajuster Stock (+/-)"
                                                        onClick={() => ouvrirStock(item as InventoryItem)}
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

            {/* ── Modal : création / modification d'un article ERP ── */}
            {articleOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !savingArticle && setArticleOpen(false)}>
                    <div role="dialog" aria-modal="true" aria-label={articleId ? 'Modifier l\'article' : 'Nouvel article ERP'}
                        onClick={e => e.stopPropagation()}
                        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--panel-border-strong)] bg-[var(--panel-surface)] text-[var(--panel-text)] shadow-2xl">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--panel-border)]">
                            <h2 className="font-black text-[var(--panel-text-heading)] flex items-center gap-2">
                                <Box size={18} className="text-emerald-500" /> {articleId ? 'Modifier l\'article' : 'Nouvel article ERP'}
                            </h2>
                            <button type="button" onClick={() => setArticleOpen(false)} disabled={savingArticle} title="Fermer" className="text-[var(--panel-text-muted)] hover:text-[var(--panel-text-heading)]"><X size={18} /></button>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className={labelCls} htmlFor="inv-title">Titre *</label>
                                <input id="inv-title" className={champCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex. T-shirt RGB, Accompagnement dossier…" />
                            </div>
                            <div>
                                <label className={labelCls} htmlFor="inv-type">Type</label>
                                <select id="inv-type" className={champCls} value={form.type}
                                    onChange={e => { const type = e.target.value as ArticleForm['type']; setForm(f => ({ ...f, type, track_inventory: type === 'physical' ? f.track_inventory : false })) }}>
                                    <option value="physical">Produit physique</option>
                                    <option value="service">Service</option>
                                    <option value="digital">Bien numérique</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls} htmlFor="inv-sku">SKU</label>
                                <input id="inv-sku" className={champCls} value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="RGB-TSHIRT-001" />
                            </div>
                            <div>
                                <label className={labelCls} htmlFor="inv-cat">Catégorie</label>
                                <input id="inv-cat" className={champCls} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                            </div>
                            <div>
                                <label className={labelCls} htmlFor="inv-tva">TVA (%)</label>
                                <input id="inv-tva" type="number" min="0" max="100" step="0.01" className={champCls} value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} />
                            </div>
                            <div>
                                <label className={labelCls} htmlFor="inv-pv">Prix de vente HT (XOF)</label>
                                <input id="inv-pv" type="number" min="0" step="1" className={champCls} value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} />
                            </div>
                            <div>
                                <label className={labelCls} htmlFor="inv-pr">Prix de revient (XOF)</label>
                                <input id="inv-pr" type="number" min="0" step="1" className={champCls} value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} />
                            </div>
                            <div className="sm:col-span-2">
                                <label className={labelCls} htmlFor="inv-desc">Description</label>
                                <textarea id="inv-desc" rows={3} className={`${champCls} resize-y`} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                            </div>
                            {form.type === 'physical' && (
                                <label className="sm:col-span-2 flex items-center gap-2 text-sm text-[var(--panel-text)] cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={form.track_inventory} onChange={e => setForm(f => ({ ...f, track_inventory: e.target.checked }))} />
                                    Suivre le stock de cet article
                                </label>
                            )}
                            {form.type === 'physical' && form.track_inventory && (
                                <>
                                    {!articleId && (
                                        <div>
                                            <label className={labelCls} htmlFor="inv-stock">Stock initial</label>
                                            <input id="inv-stock" type="number" min="0" step="1" className={champCls} value={form.current_stock} onChange={e => setForm(f => ({ ...f, current_stock: e.target.value }))} />
                                        </div>
                                    )}
                                    <div>
                                        <label className={labelCls} htmlFor="inv-seuil">Seuil d&apos;alerte</label>
                                        <input id="inv-seuil" type="number" min="0" step="1" className={champCls} value={form.low_stock_threshold} onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))} />
                                    </div>
                                    {articleId && (
                                        <p className="text-xs text-[var(--panel-text-muted)] self-end">Le stock se modifie via « Ajuster Stock » (mouvement tracé).</p>
                                    )}
                                </>
                            )}
                            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-[var(--panel-text)] cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} />
                                Publié (proposé dans les devis et factures)
                            </label>
                        </div>
                        {articleError && (
                            <p className="mx-5 mb-3 text-sm text-red-500 flex items-center gap-2"><AlertTriangle size={14} /> {articleError}</p>
                        )}
                        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--panel-border)]">
                            <button type="button" onClick={() => setArticleOpen(false)} disabled={savingArticle}
                                className="px-4 py-2 rounded-xl border border-[var(--panel-border-strong)] bg-[var(--panel-surface-alt)] text-[var(--panel-text)] text-sm font-semibold">Annuler</button>
                            <button type="button" onClick={enregistrerArticle} disabled={savingArticle}
                                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold flex items-center gap-2 disabled:opacity-60">
                                {savingArticle ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} {articleId ? 'Enregistrer' : 'Créer l\'article'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal : ajustement de stock ERP (mouvement tracé) ── */}
            {stockItem && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !adjusting && setStockItem(null)}>
                    <div role="dialog" aria-modal="true" aria-label="Ajuster le stock" onClick={e => e.stopPropagation()}
                        className="w-full max-w-md rounded-2xl border border-[var(--panel-border-strong)] bg-[var(--panel-surface)] text-[var(--panel-text)] shadow-2xl">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--panel-border)]">
                            <div>
                                <h2 className="font-black text-[var(--panel-text-heading)]">Ajuster le stock</h2>
                                <p className="text-xs text-[var(--panel-text-muted)]">{stockItem.title} · stock actuel : <strong className="text-[var(--panel-text-heading)]">{stockItem.current_stock}</strong></p>
                            </div>
                            <button type="button" onClick={() => setStockItem(null)} disabled={adjusting} title="Fermer" className="text-[var(--panel-text-muted)] hover:text-[var(--panel-text-heading)]"><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className={labelCls} htmlFor="stk-motif">Motif</label>
                                <select id="stk-motif" className={champCls} value={motif} onChange={e => setMotif(e.target.value as typeof motif)}>
                                    {MOTIFS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls} htmlFor="stk-qte">
                                    {MOTIFS.find(m => m.value === motif)!.sens === 0 ? 'Stock réel compté' : 'Quantité'}
                                </label>
                                <input id="stk-qte" type="number" min="0" step="1" className={champCls} value={quantite} onChange={e => setQuantite(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') ajusterStock() }} autoFocus />
                                {quantite !== '' && Number.isInteger(Number(quantite)) && (() => {
                                    const m = MOTIFS.find(x => x.value === motif)!
                                    const apres = m.sens === 0 ? Number(quantite) : stockItem.current_stock + m.sens * Number(quantite)
                                    return <p className={`text-xs mt-1 ${apres < 0 ? 'text-red-500' : 'text-[var(--panel-text-muted)]'}`}>Stock après : {apres}</p>
                                })()}
                            </div>
                            <div>
                                <label className={labelCls} htmlFor="stk-notes">Note (facultatif)</label>
                                <input id="stk-notes" className={champCls} value={stockNotes} onChange={e => setStockNotes(e.target.value)} placeholder="Ex. Livraison fournisseur du 25/09" />
                            </div>
                            {stockError && <p className="text-sm text-red-500 flex items-center gap-2"><AlertTriangle size={14} /> {stockError}</p>}
                        </div>
                        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--panel-border)]">
                            <button type="button" onClick={() => setStockItem(null)} disabled={adjusting}
                                className="px-4 py-2 rounded-xl border border-[var(--panel-border-strong)] bg-[var(--panel-surface-alt)] text-[var(--panel-text)] text-sm font-semibold">Annuler</button>
                            <button type="button" onClick={ajusterStock} disabled={adjusting}
                                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold flex items-center gap-2 disabled:opacity-60">
                                {adjusting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Valider
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
