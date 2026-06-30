'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boxes, RefreshCw, Loader2, Plus, X, Save, Trash2, Eye, AlertTriangle, TrendingDown } from 'lucide-react'

const GOLD = '#D4AF37'; const GREEN = '#008751'; const GREEN_L = '#00A86B'
const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'; const PANEL = '#0D2615'

interface InventoryItem {
    id: string; name: string; sku?: string; category?: string
    quantity: number; unit_price?: number; alert_threshold?: number
    supplier?: string; notes?: string; created_at: string
}

function fmt(n: number) { return `${n.toLocaleString('fr-FR')} FCFA` }
const EMPTY = { name: '', sku: '', category: '', quantity: 0, unit_price: 0, alert_threshold: 5, supplier: '', notes: '' }

export default function CeoInventaire() {
    const [items, setItems] = useState<InventoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<InventoryItem | null>(null)
    const [editData, setEditData] = useState<Partial<InventoryItem>>({})
    const [showCreate, setShowCreate] = useState(false)
    const [newItem, setNewItem] = useState(EMPTY)
    const [saving, setSaving] = useState(false)
    const [creating, setCreating] = useState(false)
    const [refresh, setRefresh] = useState(0)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all')

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/ceo/inventaire', { cache: 'no-store' })
        const data = res.ok ? await res.json() : {}
        setItems(data.items || [])
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const open = (item: InventoryItem) => { setSelected(item); setEditData(item) }

    const save = async () => {
        if (!selected) return
        setSaving(true)
        await fetch('/api/ceo/inventaire', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, ...editData }) })
        setSaving(false)
        setItems(prev => prev.map(x => x.id === selected.id ? { ...x, ...editData } as InventoryItem : x))
        setSelected(null)
    }

    const del = async (id: string) => {
        if (!confirm('Supprimer cet article ?')) return
        await fetch(`/api/ceo/inventaire?id=${id}`, { method: 'DELETE' })
        setItems(prev => prev.filter(x => x.id !== id)); setSelected(null)
    }

    const create = async () => {
        if (!newItem.name.trim()) return
        setCreating(true)
        const res = await fetch('/api/ceo/inventaire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newItem) })
        if (res.ok) { setShowCreate(false); setNewItem(EMPTY); setRefresh(r => r + 1) }
        setCreating(false)
    }

    const lowStock = items.filter(x => x.quantity <= (x.alert_threshold || 5))
    const totalValue = items.reduce((s, x) => s + (x.quantity * (x.unit_price || 0)), 0)

    const filtered = items
        .filter(x => filter === 'all' || (filter === 'low' ? x.quantity <= (x.alert_threshold || 5) : x.quantity === 0))
        .filter(x => !search || x.name.toLowerCase().includes(search.toLowerCase()) || (x.sku || '').toLowerCase().includes(search.toLowerCase()))

    const inp = 'w-full px-4 py-2.5 rounded-xl text-sm outline-none'
    const inpStyle = { background: BG, border: `1px solid ${GOLD}25`, color: TEXT }

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}25` }}>
                            <Boxes size={18} style={{ color: GOLD }}/>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Inventaire</h1>
                    </div>
                    <p className="text-sm opacity-50">Gestion des stocks & articles</p>
                </div>
                <div className="flex gap-2 items-center">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="px-4 py-2 rounded-xl text-sm outline-none w-44" style={inpStyle}/>
                    <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90" style={{ background: GOLD, color: BG }}>
                        <Plus size={14}/> Ajouter
                    </button>
                    <button onClick={() => setRefresh(r => r + 1)} className="px-3 py-2 rounded-xl hover:opacity-80" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
                    </button>
                </div>
            </motion.div>

            <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Références', value: items.length, color: GOLD },
                    { label: 'Stock faible', value: lowStock.length, color: lowStock.length > 0 ? RED : GREEN_L },
                    { label: 'Rupture', value: items.filter(x => x.quantity === 0).length, color: RED },
                    { label: 'Valeur totale', value: `${(totalValue / 1000).toFixed(0)}k FCFA`, color: GREEN_L },
                ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className="rounded-2xl p-4" style={{ background: PANEL, border: `1px solid ${s.color}20` }}>
                        <div className="text-xs opacity-40 uppercase tracking-wider mb-1">{s.label}</div>
                        <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                    </motion.div>
                ))}
            </div>

            <div className="flex gap-2 mb-4">
                {[['all', 'Tous'], ['low', 'Stock faible'], ['out', 'Rupture']].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setFilter(k)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                        style={{ background: filter === k ? GOLD : `${GOLD}12`, color: filter === k ? BG : GOLD }}>
                        {l}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40"/></div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((item, i) => {
                        const isLow = item.quantity <= (item.alert_threshold || 5)
                        const isOut = item.quantity === 0
                        return (
                            <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.04 }}
                                className="rounded-2xl p-4 flex items-center gap-4" style={{ background: PANEL, border: `1px solid ${isOut ? `${RED}30` : isLow ? `${GOLD}30` : `${GREEN}20`}` }}>
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: isOut ? `${RED}20` : isLow ? `${GOLD}15` : `${GREEN}20` }}>
                                    {isOut ? <TrendingDown size={16} style={{ color: RED }}/> : isLow ? <AlertTriangle size={16} style={{ color: GOLD }}/> : <Boxes size={16} style={{ color: GREEN_L }}/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-sm truncate">{item.name}</p>
                                        {item.sku && <span className="text-[10px] opacity-30 font-mono">{item.sku}</span>}
                                        {item.category && <span className="text-[10px] opacity-40">{item.category}</span>}
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="text-xs font-black" style={{ color: isOut ? RED : isLow ? GOLD : GREEN_L }}>
                                            {item.quantity} unité{item.quantity > 1 ? 's' : ''}
                                        </span>
                                        {item.unit_price ? <span className="text-xs opacity-40">{fmt(item.unit_price)}/u</span> : null}
                                    </div>
                                </div>
                                <button type="button" onClick={() => open(item)} className="p-2 rounded-xl hover:opacity-80" style={{ background: `${GOLD}15`, color: GOLD }}>
                                    <Eye size={14}/>
                                </button>
                            </motion.div>
                        )
                    })}
                    {filtered.length === 0 && <p className="text-center opacity-30 py-12">Aucun article</p>}
                </div>
            )}

            <AnimatePresence>
                {selected && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setSelected(null)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>Modifier le stock</h3>
                                <button type="button" onClick={() => setSelected(null)} className="opacity-40 hover:opacity-70 p-1"><X size={18}/></button>
                            </div>
                            <div className="space-y-3 mb-5">
                                {[
                                    { key: 'name', label: 'Nom *', type: 'text' }, { key: 'sku', label: 'SKU/Référence', type: 'text' },
                                    { key: 'category', label: 'Catégorie', type: 'text' }, { key: 'supplier', label: 'Fournisseur', type: 'text' },
                                    { key: 'quantity', label: 'Quantité', type: 'number' }, { key: 'unit_price', label: 'Prix unitaire (FCFA)', type: 'number' },
                                    { key: 'alert_threshold', label: 'Seuil alerte stock', type: 'number' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                        <input type={f.type}
                                            value={String((editData as Record<string, unknown>)[f.key] || '')}
                                            onChange={e => setEditData(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                                            className={inp} style={inpStyle}/>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => del(selected.id)} className="p-2.5 rounded-xl hover:opacity-80" style={{ background: `${RED}20`, color: RED }}><Trash2 size={16}/></button>
                                <button type="button" onClick={save} disabled={saving}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm hover:opacity-90"
                                    style={{ background: GREEN, color: '#fff' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Mettre à jour
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setShowCreate(false)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>Nouvel article</h3>
                                <button type="button" onClick={() => setShowCreate(false)} className="opacity-40 hover:opacity-70 p-1"><X size={18}/></button>
                            </div>
                            <div className="space-y-3 mb-5">
                                {[
                                    { key: 'name', label: 'Nom *', type: 'text' }, { key: 'sku', label: 'SKU/Référence', type: 'text' },
                                    { key: 'category', label: 'Catégorie', type: 'text' }, { key: 'quantity', label: 'Quantité initiale', type: 'number' },
                                    { key: 'unit_price', label: 'Prix unitaire (FCFA)', type: 'number' }, { key: 'alert_threshold', label: 'Seuil alerte', type: 'number' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                        <input type={f.type}
                                            value={String(newItem[f.key as keyof typeof newItem])}
                                            onChange={e => setNewItem(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                                            className={inp} style={inpStyle}/>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={create} disabled={creating || !newItem.name.trim()}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-40"
                                style={{ background: GOLD, color: BG }}>
                                {creating ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} Créer
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
