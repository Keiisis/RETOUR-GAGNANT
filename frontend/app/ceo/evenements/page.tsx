'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, RefreshCw, Loader2, Plus, X, Save, Trash2, Eye, MapPin, Users, ToggleLeft, ToggleRight, Clock } from 'lucide-react'

const GOLD = '#D4AF37'; const GREEN = '#008751'; const GREEN_L = '#00A86B'
const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'; const PANEL = '#0D2615'

interface Evenement {
    id: string; title: string; description?: string; event_date: string
    location?: string; image_url?: string; is_published?: boolean
    max_attendees?: number; attendees_count?: number; price?: number; created_at: string
}

function fmtDate(d: string) {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const EMPTY = { title: '', description: '', event_date: '', location: '', image_url: '', is_published: false, max_attendees: 0, price: 0 }

export default function CeoEvenements() {
    const [items, setItems] = useState<Evenement[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<Evenement | null>(null)
    const [editData, setEditData] = useState<Partial<Evenement>>({})
    const [showCreate, setShowCreate] = useState(false)
    const [newItem, setNewItem] = useState(EMPTY)
    const [saving, setSaving] = useState(false)
    const [creating, setCreating] = useState(false)
    const [refresh, setRefresh] = useState(0)

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/ceo/evenements', { cache: 'no-store' })
        const data = res.ok ? await res.json() : {}
        setItems(data.events || [])
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const open = (item: Evenement) => {
        setSelected(item)
        setEditData({ ...item, event_date: item.event_date ? item.event_date.slice(0, 16) : '' })
    }

    const save = async () => {
        if (!selected) return
        setSaving(true)
        await fetch('/api/ceo/evenements', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, ...editData }) })
        setSaving(false)
        setItems(prev => prev.map(x => x.id === selected.id ? { ...x, ...editData } as Evenement : x))
        setSelected(null)
    }

    const del = async (id: string) => {
        if (!confirm('Supprimer cet événement ?')) return
        await fetch(`/api/ceo/evenements?id=${id}`, { method: 'DELETE' })
        setItems(prev => prev.filter(x => x.id !== id)); setSelected(null)
    }

    const toggle = async (item: Evenement) => {
        const val = !item.is_published
        await fetch('/api/ceo/evenements', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, is_published: val }) })
        setItems(prev => prev.map(x => x.id === item.id ? { ...x, is_published: val } : x))
    }

    const create = async () => {
        if (!newItem.title.trim() || !newItem.event_date) return
        setCreating(true)
        const res = await fetch('/api/ceo/evenements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newItem) })
        if (res.ok) { setShowCreate(false); setNewItem(EMPTY); setRefresh(r => r + 1) }
        setCreating(false)
    }

    const upcoming = items.filter(x => new Date(x.event_date) >= new Date() && x.is_published).length
    const inp = 'w-full px-4 py-2.5 rounded-xl text-sm outline-none'
    const inpStyle = { background: BG, border: `1px solid ${GOLD}25`, color: TEXT }
    const isUpcoming = (d: string) => new Date(d) >= new Date()

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}25` }}>
                            <Calendar size={18} style={{ color: GOLD }}/>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Événements</h1>
                    </div>
                    <p className="text-sm opacity-50">Agenda & événements à venir</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90" style={{ background: GOLD, color: BG }}>
                        <Plus size={14}/> Créer
                    </button>
                    <button onClick={() => setRefresh(r => r + 1)} className="px-3 py-2 rounded-xl hover:opacity-80" style={{ background: `${GREEN}25`, color: GREEN_L }} aria-label="Actualiser">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
                    </button>
                </div>
            </motion.div>

            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total', value: items.length, color: GOLD },
                    { label: 'À venir', value: upcoming, color: GREEN_L },
                    { label: 'Publiés', value: items.filter(x => x.is_published).length, color: GOLD },
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
                <div className="space-y-3">
                    {items.map((item, i) => {
                        const coming = isUpcoming(item.event_date)
                        return (
                            <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }}
                                className="rounded-2xl p-5 flex items-center gap-4" style={{ background: PANEL, border: `1px solid ${coming ? `${GREEN}25` : `${GOLD}12`}` }}>
                                <div className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0" style={{ background: coming ? `${GREEN}20` : `${GOLD}12` }}>
                                    <span className="text-xs font-black" style={{ color: coming ? GREEN_L : GOLD }}>
                                        {!item.event_date || isNaN(new Date(item.event_date).getTime()) ? '—' : new Date(item.event_date).toLocaleDateString('fr-FR', { day: '2-digit' })}
                                    </span>
                                    <span className="text-[9px] opacity-60 uppercase">
                                        {!item.event_date || isNaN(new Date(item.event_date).getTime()) ? '—' : new Date(item.event_date).toLocaleDateString('fr-FR', { month: 'short' })}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <h3 className="font-bold text-sm truncate">{item.title}</h3>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                                            style={{ background: item.is_published ? `${GREEN_L}20` : `${GOLD}12`, color: item.is_published ? GREEN_L : GOLD }}>
                                            {item.is_published ? 'Publié' : 'Brouillon'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <span className="flex items-center gap-1 text-[11px] opacity-40"><Clock size={9}/>{fmtDate(item.event_date)}</span>
                                        {item.location && <span className="flex items-center gap-1 text-[11px] opacity-40"><MapPin size={9}/>{item.location}</span>}
                                        {item.max_attendees ? <span className="flex items-center gap-1 text-[11px] opacity-40"><Users size={9}/>{item.attendees_count || 0}/{item.max_attendees}</span> : null}
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                    <button type="button" onClick={() => open(item)} className="p-2 rounded-xl hover:opacity-80" style={{ background: `${GOLD}15`, color: GOLD }} aria-label="Voir les détails"><Eye size={14}/></button>
                                    <button type="button" onClick={() => toggle(item)} className="p-2 rounded-xl hover:opacity-80" style={{ background: item.is_published ? `${RED}15` : `${GREEN}20`, color: item.is_published ? RED : GREEN_L }} aria-label={item.is_published ? 'Dépublier' : 'Publier'}>
                                        {item.is_published ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                                    </button>
                                </div>
                            </motion.div>
                        )
                    })}
                    {items.length === 0 && <p className="text-center opacity-30 py-12">Aucun événement</p>}
                </div>
            )}

            {[{ show: !!selected, title: 'Modifier l\'événement', data: editData as Record<string, unknown>, setData: (d: Partial<Evenement>) => setEditData(d), onClose: () => setSelected(null), onSave: save, onDel: selected ? () => del(selected.id) : undefined, saving }].map((modal, idx) => (
                <AnimatePresence key={idx}>
                    {modal.show && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={modal.onClose}>
                            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                                onClick={e => e.stopPropagation()}
                                className="w-full max-w-lg rounded-3xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="font-black" style={{ color: GOLD }}>{modal.title}</h3>
                                    <button type="button" onClick={modal.onClose} className="opacity-40 hover:opacity-70 p-1" aria-label="Fermer"><X size={18}/></button>
                                </div>
                                <div className="space-y-3 mb-5">
                                    {[
                                        { key: 'title', label: 'Titre *', type: 'text' }, { key: 'location', label: 'Lieu', type: 'text' },
                                        { key: 'image_url', label: 'Image (URL)', type: 'text' }, { key: 'price', label: 'Prix (FCFA, 0=gratuit)', type: 'number' },
                                        { key: 'max_attendees', label: 'Participants max', type: 'number' },
                                        { key: 'event_date', label: 'Date & Heure *', type: 'datetime-local' },
                                    ].map(f => (
                                        <div key={f.key}>
                                            <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                            <input type={f.type} value={String(modal.data[f.key] || '')}
                                                onChange={e => modal.setData({ ...(editData), [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                                                className={inp} style={inpStyle}/>
                                        </div>
                                    ))}
                                    <div>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Description</label>
                                        <textarea value={String(modal.data.description || '')} onChange={e => modal.setData({ ...(editData), description: e.target.value })}
                                            rows={3} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={inpStyle}/>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: BG, border: `1px solid ${GOLD}20` }}>
                                        <span className="text-sm font-semibold">Publié</span>
                                        <button type="button" onClick={() => modal.setData({ ...(editData), is_published: !editData.is_published })}
                                            className="w-12 h-6 rounded-full transition-all relative" style={{ background: editData.is_published ? GREEN : '#374151' }}
                                            aria-label={editData.is_published ? 'Dépublier' : 'Publier'}
                                            role="switch" aria-checked={!!editData.is_published}>
                                            <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all" style={{ left: editData.is_published ? '26px' : '4px' }}/>
                                        </button>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    {modal.onDel && <button type="button" onClick={modal.onDel} className="p-2.5 rounded-xl hover:opacity-80" style={{ background: `${RED}20`, color: RED }} aria-label="Supprimer l'événement"><Trash2 size={16}/></button>}
                                    <button type="button" onClick={modal.onSave} disabled={modal.saving}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm hover:opacity-90"
                                        style={{ background: GREEN, color: '#fff' }}>
                                        {modal.saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Enregistrer
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            ))}

            <AnimatePresence>
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setShowCreate(false)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>Nouvel événement</h3>
                                <button type="button" onClick={() => setShowCreate(false)} className="opacity-40 hover:opacity-70 p-1" aria-label="Fermer"><X size={18}/></button>
                            </div>
                            <div className="space-y-3 mb-5">
                                {[
                                    { key: 'title', label: 'Titre *', type: 'text' }, { key: 'location', label: 'Lieu', type: 'text' },
                                    { key: 'event_date', label: 'Date & Heure *', type: 'datetime-local' },
                                    { key: 'price', label: 'Prix (0=gratuit)', type: 'number' },
                                    { key: 'max_attendees', label: 'Participants max', type: 'number' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                        <input type={f.type} value={String(newItem[f.key as keyof typeof newItem])}
                                            onChange={e => setNewItem(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                                            className={inp} style={inpStyle}/>
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Description</label>
                                    <textarea value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
                                        rows={2} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={inpStyle}/>
                                </div>
                            </div>
                            <button type="button" onClick={create} disabled={creating || !newItem.title || !newItem.event_date}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-40"
                                style={{ background: GOLD, color: BG }}>
                                {creating ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} Créer l&apos;événement
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
