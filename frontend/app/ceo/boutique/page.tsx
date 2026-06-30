'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, RefreshCw, Loader2, Plus, X, Save, Trash2, Eye, Search } from 'lucide-react'

const GOLD = '#D4AF37'; const GREEN = '#008751'
const GREEN_L = '#00A86B'; const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'
const PANEL = '#0D2615'

interface Product {
    id: string; title: string; description?: string; price: number; currency?: string
    category?: string; is_active?: boolean; stock?: number; image_url?: string; created_at: string
}

function fmt(n: number) { return `${n.toLocaleString('fr-FR')} FCFA` }

export default function CeoBoutique() {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Product | null>(null)
    const [editData, setEditData] = useState<Partial<Product>>({})
    const [saving, setSaving] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [newProd, setNewProd] = useState({ title: '', description: '', price: '', category: '', stock: '' })
    const [creating, setCreating] = useState(false)
    const [refresh, setRefresh] = useState(0)

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/ceo/boutique', { cache: 'no-store' })
        const data = res.ok ? await res.json() : { products: [] }
        setProducts(data.products || [])
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const save = async () => {
        if (!selected) return
        setSaving(true)
        await fetch('/api/ceo/boutique', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: selected.id, ...editData }),
        })
        setSaving(false)
        setProducts(prev => prev.map(p => p.id === selected.id ? { ...p, ...editData } : p))
        setSelected(null)
    }

    const deleteProd = async (id: string) => {
        if (!confirm('Supprimer ce produit ?')) return
        await fetch(`/api/ceo/boutique?id=${id}`, { method: 'DELETE' })
        setProducts(prev => prev.filter(p => p.id !== id))
        setSelected(null)
    }

    const create = async () => {
        if (!newProd.title) return
        setCreating(true)
        const res = await fetch('/api/ceo/boutique', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newProd, price: Number(newProd.price) || 0, stock: Number(newProd.stock) || 0, currency: 'XOF', is_active: true }),
        })
        if (res.ok) { setShowCreate(false); setNewProd({ title: '', description: '', price: '', category: '', stock: '' }); setRefresh(r => r + 1) }
        setCreating(false)
    }

    const filtered = products.filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()))
    const totalRevPotential = products.reduce((a, p) => a + (p.price * (p.stock || 1)), 0)

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}25` }}>
                            <Package size={18} style={{ color: GREEN_L }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Boutique</h1>
                    </div>
                    <p className="text-sm opacity-50">{products.length} produits — Potentiel {fmt(totalRevPotential)}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90" style={{ background: GOLD, color: BG }}><Plus size={14} /> Nouveau</button>
                    <button onClick={() => setRefresh(r => r + 1)} className="px-4 py-2 rounded-xl hover:opacity-80" style={{ background: `${GREEN}25`, color: GREEN_L }}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
                </div>
            </motion.div>

            <div className="relative mb-6">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un produit..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: PANEL, border: `1px solid ${GOLD}20`, color: TEXT }} />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40" /></div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map((p, i) => (
                        <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.04 }}
                            className="rounded-2xl overflow-hidden group" style={{ background: PANEL, border: `1px solid ${p.is_active ? `${GREEN}25` : `${GOLD}10`}` }}>
                            {p.image_url && <img src={p.image_url} alt={p.title} className="w-full h-32 object-cover" />}
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <h3 className="font-bold text-sm line-clamp-2 flex-1">{p.title}</h3>
                                    <span className="ml-2 text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                                        style={{ background: p.is_active ? `${GREEN_L}20` : `${GOLD}12`, color: p.is_active ? GREEN_L : GOLD }}>
                                        {p.is_active ? '●' : '○'}
                                    </span>
                                </div>
                                {p.category && <p className="text-xs opacity-40 mb-2">{p.category}</p>}
                                <div className="flex items-center justify-between">
                                    <span className="font-black text-sm" style={{ color: GOLD }}>{fmt(p.price)}</span>
                                    {p.stock !== undefined && <span className="text-xs opacity-40">Stock: {p.stock}</span>}
                                </div>
                                <button onClick={() => { setSelected(p); setEditData(p) }}
                                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold hover:opacity-80"
                                    style={{ background: `${GOLD}15`, color: GOLD }}>
                                    <Eye size={12} /> Modifier
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            <AnimatePresence>
                {selected && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => setSelected(null)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>Modifier produit</h3>
                                <button onClick={() => setSelected(null)} className="opacity-40 hover:opacity-70 p-1"><X size={18} /></button>
                            </div>
                            <div className="space-y-3 mb-5">
                                {[{ key: 'title', label: 'Titre', type: 'text' }, { key: 'price', label: 'Prix (FCFA)', type: 'number' }, { key: 'stock', label: 'Stock', type: 'number' }, { key: 'category', label: 'Catégorie', type: 'text' }].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                        <input type={f.type} value={String((editData as Record<string, unknown>)[f.key] || '')}
                                            onChange={e => setEditData(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                                            style={{ background: '#0B1F0D', border: `1px solid ${GOLD}25`, color: TEXT }} />
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Description</label>
                                    <textarea value={editData.description || ''} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
                                        rows={2} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                                        style={{ background: '#0B1F0D', border: `1px solid ${GOLD}25`, color: TEXT }} />
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#0B1F0D', border: `1px solid ${GOLD}20` }}>
                                    <span className="text-sm">Produit actif</span>
                                    <button onClick={() => setEditData(p => ({ ...p, is_active: !p.is_active }))}
                                        className="w-12 h-6 rounded-full transition-all relative" style={{ background: editData.is_active ? GREEN : '#374151' }}>
                                        <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all" style={{ left: editData.is_active ? '26px' : '4px' }} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => deleteProd(selected.id)} className="p-2.5 rounded-xl hover:opacity-80" style={{ background: `${RED}20`, color: RED }}><Trash2 size={16} /></button>
                                <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm hover:opacity-90" style={{ background: GREEN, color: '#fff' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Create Modal */}
            <AnimatePresence>
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => setShowCreate(false)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>Nouveau produit</h3>
                                <button onClick={() => setShowCreate(false)} className="opacity-40 hover:opacity-70 p-1"><X size={18} /></button>
                            </div>
                            <div className="space-y-3 mb-5">
                                {[{ key: 'title', label: 'Titre *', type: 'text' }, { key: 'price', label: 'Prix (FCFA)', type: 'number' }, { key: 'stock', label: 'Stock', type: 'number' }, { key: 'category', label: 'Catégorie', type: 'text' }].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                        <input type={f.type} value={newProd[f.key as keyof typeof newProd]}
                                            onChange={e => setNewProd(p => ({ ...p, [f.key]: e.target.value }))}
                                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                                            style={{ background: '#0B1F0D', border: `1px solid ${GOLD}25`, color: TEXT }} />
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Description</label>
                                    <textarea value={newProd.description} onChange={e => setNewProd(p => ({ ...p, description: e.target.value }))} rows={2}
                                        className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                                        style={{ background: '#0B1F0D', border: `1px solid ${GOLD}25`, color: TEXT }} />
                                </div>
                            </div>
                            <button onClick={create} disabled={creating || !newProd.title}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-40"
                                style={{ background: GOLD, color: BG }}>
                                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer le produit
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
