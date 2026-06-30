'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Image as ImageIcon, RefreshCw, Loader2, Plus, X, Save, Trash2, Upload } from 'lucide-react'
import FileUpload from '@/components/ui/FileUpload'

const GOLD = '#D4AF37'; const GREEN = '#008751'; const GREEN_L = '#00A86B'
const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'; const PANEL = '#0D2615'

interface GalleryItem {
    id: string; title?: string; description?: string; image_url: string
    category?: string; is_published?: boolean; created_at: string
}

const EMPTY = { title: '', description: '', image_url: '', category: '' }

export default function CeoGalerie() {
    const [items, setItems] = useState<GalleryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<GalleryItem | null>(null)
    const [editData, setEditData] = useState<Partial<GalleryItem>>({})
    const [showCreate, setShowCreate] = useState(false)
    const [newItem, setNewItem] = useState(EMPTY)
    const [saving, setSaving] = useState(false)
    const [creating, setCreating] = useState(false)
    const [refresh, setRefresh] = useState(0)
    const [search, setSearch] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/ceo/galerie', { cache: 'no-store' })
        const data = res.ok ? await res.json() : {}
        setItems(data.images || [])
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const open = (item: GalleryItem) => { setSelected(item); setEditData(item) }

    const save = async () => {
        if (!selected) return
        setSaving(true)
        await fetch('/api/ceo/galerie', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, ...editData }) })
        setSaving(false)
        setItems(prev => prev.map(x => x.id === selected.id ? { ...x, ...editData } as GalleryItem : x))
        setSelected(null)
    }

    const del = async (id: string) => {
        if (!confirm('Supprimer cette image ?')) return
        await fetch(`/api/ceo/galerie?id=${id}`, { method: 'DELETE' })
        setItems(prev => prev.filter(x => x.id !== id)); setSelected(null)
    }

    const create = async () => {
        if (!newItem.image_url) return
        setCreating(true)
        const res = await fetch('/api/ceo/galerie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newItem) })
        if (res.ok) { setShowCreate(false); setNewItem(EMPTY); setRefresh(r => r + 1) }
        setCreating(false)
    }

    const filtered = items.filter(x => !search || (x.title || '').toLowerCase().includes(search.toLowerCase()) || (x.category || '').toLowerCase().includes(search.toLowerCase()))
    const inp = 'w-full px-4 py-2.5 rounded-xl text-sm outline-none'
    const inpStyle = { background: BG, border: `1px solid ${GOLD}25`, color: TEXT }

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}25` }}>
                            <ImageIcon size={18} style={{ color: GOLD }}/>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Galerie</h1>
                    </div>
                    <p className="text-sm opacity-50">{items.length} photo{items.length > 1 ? 's' : ''} en ligne</p>
                </div>
                <div className="flex gap-2 items-center">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrer..." className="px-4 py-2 rounded-xl text-sm outline-none w-40" style={inpStyle}/>
                    <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90" style={{ background: GOLD, color: BG }}>
                        <Upload size={14}/> Ajouter
                    </button>
                    <button onClick={() => setRefresh(r => r + 1)} className="px-3 py-2 rounded-xl hover:opacity-80" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
                    </button>
                </div>
            </motion.div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40"/></div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {filtered.map((item, i) => (
                        <motion.div key={item.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i, 15) * 0.04 }}
                            className="group relative rounded-2xl overflow-hidden cursor-pointer aspect-square"
                            style={{ background: PANEL }}
                            onClick={() => open(item)}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.image_url} alt={item.title || ''} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                {item.title && <p className="text-white text-xs font-bold truncate">{item.title}</p>}
                                {item.category && <p className="text-white/60 text-[10px] truncate">{item.category}</p>}
                            </div>
                            <button type="button" onClick={e => { e.stopPropagation(); del(item.id) }}
                                title="Supprimer"
                                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: RED }}>
                                <Trash2 size={12} className="text-white"/>
                            </button>
                        </motion.div>
                    ))}
                    {filtered.length === 0 && <p className="col-span-5 text-center opacity-30 py-12">Aucune image</p>}
                </div>
            )}

            {/* Edit Modal */}
            <AnimatePresence>
                {selected && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setSelected(null)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-black" style={{ color: GOLD }}>Modifier</h3>
                                <button type="button" onClick={() => setSelected(null)} className="opacity-40 hover:opacity-70 p-1"><X size={18}/></button>
                            </div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={selected.image_url} alt="" className="w-full h-40 object-cover rounded-xl mb-4"/>
                            <div className="space-y-3 mb-4">
                                {[{ key: 'title', label: 'Titre' }, { key: 'category', label: 'Catégorie' }].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                        <input type="text" value={String((editData as Record<string, unknown>)[f.key] || '')}
                                            onChange={e => setEditData(p => ({ ...p, [f.key]: e.target.value }))}
                                            className={inp} style={inpStyle}/>
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Description</label>
                                    <textarea value={editData.description || ''} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
                                        rows={2} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={inpStyle}/>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => del(selected.id)} className="p-2.5 rounded-xl hover:opacity-80" style={{ background: `${RED}20`, color: RED }}><Trash2 size={16}/></button>
                                <button type="button" onClick={save} disabled={saving}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm hover:opacity-90"
                                    style={{ background: GREEN, color: '#fff' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Enregistrer
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Create Modal */}
            <AnimatePresence>
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setShowCreate(false)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>Ajouter une photo</h3>
                                <button type="button" onClick={() => setShowCreate(false)} className="opacity-40 hover:opacity-70 p-1"><X size={18}/></button>
                            </div>
                            <div className="space-y-4 mb-5">
                                <FileUpload type="gallery" label="Photo *" value={newItem.image_url} onChange={url => setNewItem(p => ({ ...p, image_url: url }))} hint="JPG, PNG, WebP — max 5MB"/>
                                {[{ key: 'title', label: 'Titre' }, { key: 'category', label: 'Catégorie' }].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                        <input type="text" value={newItem[f.key as keyof typeof newItem]}
                                            onChange={e => setNewItem(p => ({ ...p, [f.key]: e.target.value }))}
                                            className={inp} style={inpStyle}/>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={create} disabled={creating || !newItem.image_url}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-40"
                                style={{ background: GOLD, color: BG }}>
                                {creating ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} Ajouter à la galerie
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
