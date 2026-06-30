'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, RefreshCw, Loader2, Plus, X, Save, Trash2, Eye, ToggleLeft, ToggleRight } from 'lucide-react'

const GOLD = '#D4AF37'; const GREEN = '#008751'; const GREEN_L = '#00A86B'
const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'; const PANEL = '#0D2615'

interface Testimonial {
    id: string; author_name: string; author_title?: string; author_company?: string
    content: string; rating: number; avatar_url?: string; is_published?: boolean; created_at: string
}

function Stars({ n, interactive = false, onChange }: { n: number; interactive?: boolean; onChange?: (v: number) => void }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
                <button key={i} type="button" disabled={!interactive} onClick={() => onChange?.(i)}
                    className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}>
                    <Star size={14} fill={i <= n ? GOLD : 'none'} style={{ color: i <= n ? GOLD : '#4b5563' }} />
                </button>
            ))}
        </div>
    )
}

const EMPTY = { author_name: '', author_title: '', author_company: '', content: '', rating: 5, avatar_url: '', is_published: true }

export default function CeoTemoignages() {
    const [items, setItems] = useState<Testimonial[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<Testimonial | null>(null)
    const [editData, setEditData] = useState<Partial<Testimonial>>({})
    const [showCreate, setShowCreate] = useState(false)
    const [newItem, setNewItem] = useState(EMPTY)
    const [saving, setSaving] = useState(false)
    const [creating, setCreating] = useState(false)
    const [refresh, setRefresh] = useState(0)

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/ceo/temoignages', { cache: 'no-store' })
        const data = res.ok ? await res.json() : {}
        setItems(data.testimonials || [])
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const open = (t: Testimonial) => { setSelected(t); setEditData(t) }

    const save = async () => {
        if (!selected) return
        setSaving(true)
        await fetch('/api/ceo/temoignages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, ...editData }) })
        setSaving(false)
        setItems(prev => prev.map(t => t.id === selected.id ? { ...t, ...editData } as Testimonial : t))
        setSelected(null)
    }

    const del = async (id: string) => {
        if (!confirm('Supprimer ce témoignage ?')) return
        await fetch(`/api/ceo/temoignages?id=${id}`, { method: 'DELETE' })
        setItems(prev => prev.filter(t => t.id !== id)); setSelected(null)
    }

    const toggle = async (t: Testimonial) => {
        const val = !t.is_published
        await fetch('/api/ceo/temoignages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, is_published: val }) })
        setItems(prev => prev.map(x => x.id === t.id ? { ...x, is_published: val } : x))
    }

    const create = async () => {
        if (!newItem.author_name.trim() || !newItem.content.trim()) return
        setCreating(true)
        const res = await fetch('/api/ceo/temoignages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newItem) })
        if (res.ok) { setShowCreate(false); setNewItem(EMPTY); setRefresh(r => r + 1) }
        setCreating(false)
    }

    const published = items.filter(t => t.is_published).length
    const avgRating = items.length ? (items.reduce((s, t) => s + (t.rating || 0), 0) / items.length).toFixed(1) : '—'
    const inp = 'w-full px-4 py-2.5 rounded-xl text-sm outline-none'
    const inpStyle = { background: BG, border: `1px solid ${GOLD}25`, color: TEXT }

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}25` }}>
                            <Star size={18} style={{ color: GOLD }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Témoignages</h1>
                    </div>
                    <p className="text-sm opacity-50">Avis clients & recommandations</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90" style={{ background: GOLD, color: BG }}>
                        <Plus size={14}/> Nouveau
                    </button>
                    <button onClick={() => setRefresh(r => r + 1)} className="px-3 py-2 rounded-xl hover:opacity-80" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
                    </button>
                </div>
            </motion.div>

            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total', value: items.length, color: GOLD },
                    { label: 'Publiés', value: published, color: GREEN_L },
                    { label: 'Note moyenne', value: avgRating, color: GOLD },
                ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className="rounded-2xl p-4" style={{ background: PANEL, border: `1px solid ${s.color}20` }}>
                        <div className="text-xs opacity-40 uppercase tracking-wider mb-1">{s.label}</div>
                        <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                    </motion.div>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40"/></div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((t, i) => (
                        <motion.div key={t.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.05 }}
                            className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: PANEL, border: `1px solid ${t.is_published ? `${GREEN}30` : `${GOLD}12`}` }}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="font-bold text-sm">{t.author_name}</p>
                                    {(t.author_title || t.author_company) && (
                                        <p className="text-[11px] opacity-40">{[t.author_title, t.author_company].filter(Boolean).join(' · ')}</p>
                                    )}
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: t.is_published ? `${GREEN_L}20` : `${GOLD}12`, color: t.is_published ? GREEN_L : GOLD }}>
                                    {t.is_published ? 'Publié' : 'Masqué'}
                                </span>
                            </div>
                            <Stars n={t.rating || 5}/>
                            <p className="text-[12px] opacity-60 flex-1 line-clamp-3">&ldquo;{t.content}&rdquo;</p>
                            <div className="flex gap-2 pt-2 border-t border-white/5">
                                <button type="button" onClick={() => open(t)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold hover:opacity-80" style={{ background: `${GOLD}15`, color: GOLD }}>
                                    <Eye size={12}/> Modifier
                                </button>
                                <button type="button" onClick={() => toggle(t)} className="p-2 rounded-xl hover:opacity-80" style={{ background: t.is_published ? `${RED}15` : `${GREEN}20`, color: t.is_published ? RED : GREEN_L }}>
                                    {t.is_published ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                                </button>
                            </div>
                        </motion.div>
                    ))}
                    {items.length === 0 && <p className="col-span-3 text-center opacity-30 py-12">Aucun témoignage</p>}
                </div>
            )}

            <AnimatePresence>
                {selected && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setSelected(null)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-lg rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>Modifier le témoignage</h3>
                                <button type="button" onClick={() => setSelected(null)} className="opacity-40 hover:opacity-70 p-1"><X size={18}/></button>
                            </div>
                            <div className="space-y-3 mb-5">
                                {[
                                    { key: 'author_name', label: 'Nom *' }, { key: 'author_title', label: 'Titre / Poste' },
                                    { key: 'author_company', label: 'Entreprise' }, { key: 'avatar_url', label: 'Avatar (URL)' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                        <input type="text" value={String((editData as Record<string, unknown>)[f.key] || '')}
                                            onChange={e => setEditData(p => ({ ...p, [f.key]: e.target.value }))}
                                            className={inp} style={inpStyle}/>
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Note</label>
                                    <Stars n={editData.rating || 5} interactive onChange={v => setEditData(p => ({ ...p, rating: v }))}/>
                                </div>
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Témoignage *</label>
                                    <textarea value={editData.content || ''} onChange={e => setEditData(p => ({ ...p, content: e.target.value }))}
                                        rows={4} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={inpStyle}/>
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: BG, border: `1px solid ${GOLD}20` }}>
                                    <span className="text-sm font-semibold">Publié</span>
                                    <button type="button" onClick={() => setEditData(p => ({ ...p, is_published: !p.is_published }))}
                                        className="w-12 h-6 rounded-full transition-all relative" style={{ background: editData.is_published ? GREEN : '#374151' }}>
                                        <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all" style={{ left: editData.is_published ? '26px' : '4px' }}/>
                                    </button>
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

            <AnimatePresence>
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setShowCreate(false)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>Nouveau témoignage</h3>
                                <button type="button" onClick={() => setShowCreate(false)} className="opacity-40 hover:opacity-70 p-1"><X size={18}/></button>
                            </div>
                            <div className="space-y-3 mb-5">
                                {[
                                    { key: 'author_name', label: 'Nom *' }, { key: 'author_title', label: 'Titre / Poste' }, { key: 'author_company', label: 'Entreprise' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                        <input type="text" value={newItem[f.key as keyof typeof newItem] as string}
                                            onChange={e => setNewItem(p => ({ ...p, [f.key]: e.target.value }))}
                                            className={inp} style={inpStyle}/>
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Note</label>
                                    <Stars n={newItem.rating} interactive onChange={v => setNewItem(p => ({ ...p, rating: v }))}/>
                                </div>
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Témoignage *</label>
                                    <textarea value={newItem.content} onChange={e => setNewItem(p => ({ ...p, content: e.target.value }))}
                                        rows={3} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={inpStyle}/>
                                </div>
                            </div>
                            <button type="button" onClick={create} disabled={creating || !newItem.author_name || !newItem.content}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-40"
                                style={{ background: GOLD, color: BG }}>
                                {creating ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} Ajouter
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
