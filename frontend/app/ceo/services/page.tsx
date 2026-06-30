'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wrench, RefreshCw, Loader2, Plus, X, Save, Trash2, Eye, ToggleLeft, ToggleRight } from 'lucide-react'

const GOLD = '#D4AF37'; const YELLOW = '#FCD116'; const GREEN = '#008751'
const GREEN_L = '#00A86B'; const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'
const PANEL = '#0D2615'

interface Service {
    id: string; name?: string; title?: string; description?: string; short_description?: string
    price?: number; currency?: string; category?: string; is_active?: boolean
    image_url?: string; created_at: string
}

function fmt(n: number) {
    return `${n.toLocaleString('fr-FR')} FCFA`
}

export default function CeoServices() {
    const [services, setServices] = useState<Service[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<Service | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editData, setEditData] = useState<Partial<Service>>({})
    const [newService, setNewService] = useState({ name: '', description: '', price: '', category: '', is_active: true })
    const [creating, setCreating] = useState(false)
    const [refresh, setRefresh] = useState(0)

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/admin/services', { cache: 'no-store' })
        const data = res.ok ? await res.json() : {}
        setServices(data.services || data.data || [])
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const openService = (s: Service) => { setSelected(s); setEditData(s) }

    const save = async () => {
        if (!selected) return
        setSaving(true)
        await fetch(`/api/admin/services/${selected.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editData),
        })
        setSaving(false)
        setServices(prev => prev.map(s => s.id === selected.id ? { ...s, ...editData } : s))
        setSelected(null)
    }

    const toggleActive = async (s: Service) => {
        const newVal = !s.is_active
        await fetch(`/api/admin/services/${s.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: newVal }),
        })
        setServices(prev => prev.map(x => x.id === s.id ? { ...x, is_active: newVal } : x))
    }

    const deleteService = async (id: string) => {
        if (!confirm('Supprimer ce service ?')) return
        await fetch(`/api/admin/services/${id}`, { method: 'DELETE' })
        setServices(prev => prev.filter(s => s.id !== id))
        setSelected(null)
    }

    const create = async () => {
        if (!newService.name) return
        setCreating(true)
        const res = await fetch('/api/admin/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newService, price: Number(newService.price) || 0, currency: 'XOF' }),
        })
        if (res.ok) {
            setShowCreate(false)
            setNewService({ name: '', description: '', price: '', category: '', is_active: true })
            setRefresh(r => r + 1)
        }
        setCreating(false)
    }

    const active = services.filter(s => s.is_active)
    const inactive = services.filter(s => !s.is_active)

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}25` }}>
                            <Wrench size={18} style={{ color: GREEN_L }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Services</h1>
                    </div>
                    <p className="text-sm opacity-50">Catalogue des services RGB</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90"
                        style={{ background: GOLD, color: BG }}>
                        <Plus size={14} /> Nouveau
                    </button>
                    <button onClick={() => setRefresh(r => r + 1)}
                        className="px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80"
                        style={{ background: `${GREEN}25`, color: GREEN_L }}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total', value: services.length, color: GOLD },
                    { label: 'Actifs', value: active.length, color: GREEN_L },
                    { label: 'Inactifs', value: inactive.length, color: '#94a3b8' },
                ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className="rounded-2xl p-4" style={{ background: PANEL, border: `1px solid ${s.color}20` }}>
                        <div className="text-xs opacity-40 uppercase tracking-wider mb-1">{s.label}</div>
                        <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                    </motion.div>
                ))}
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40" /></div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {services.map((s, i) => (
                        <motion.div key={s.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.05 }}
                            className="rounded-2xl p-5 group" style={{ background: PANEL, border: `1px solid ${s.is_active ? `${GREEN}30` : `${GOLD}12`}` }}>
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-sm truncate">{s.name || s.title || '—'}</h3>
                                    {s.category && <p className="text-xs opacity-40 mt-0.5">{s.category}</p>}
                                </div>
                                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                                    style={{ background: s.is_active ? `${GREEN_L}20` : `${GOLD}12`, color: s.is_active ? GREEN_L : GOLD }}>
                                    {s.is_active ? 'Actif' : 'Inactif'}
                                </span>
                            </div>
                            {s.description && (
                                <p className="text-xs opacity-50 mb-3 line-clamp-2">{s.description}</p>
                            )}
                            {s.price !== undefined && (
                                <p className="text-sm font-black mb-4" style={{ color: GOLD }}>{fmt(s.price)}</p>
                            )}
                            <div className="flex gap-2">
                                <button onClick={() => openService(s)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold hover:opacity-80"
                                    style={{ background: `${GOLD}15`, color: GOLD }}>
                                    <Eye size={12} /> Modifier
                                </button>
                                <button onClick={() => toggleActive(s)}
                                    className="p-2 rounded-xl hover:opacity-80"
                                    style={{ background: s.is_active ? `${RED}15` : `${GREEN}20`, color: s.is_active ? RED : GREEN_L }}>
                                    {s.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            <AnimatePresence>
                {selected && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
                        onClick={() => setSelected(null)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-lg rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>Modifier le service</h3>
                                <button onClick={() => setSelected(null)} className="opacity-40 hover:opacity-70 p-1"><X size={18} /></button>
                            </div>
                            <div className="space-y-3 mb-5">
                                {[
                                    { key: 'name', label: 'Nom', type: 'text' },
                                    { key: 'category', label: 'Catégorie', type: 'text' },
                                    { key: 'price', label: 'Prix (FCFA)', type: 'number' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                        <input type={f.type}
                                            value={String((editData as Record<string, unknown>)[f.key] || '')}
                                            onChange={e => setEditData(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                                            style={{ background: '#0B1F0D', border: `1px solid ${GOLD}25`, color: TEXT }} />
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Description</label>
                                    <textarea value={editData.description || ''} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
                                        rows={3} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                                        style={{ background: '#0B1F0D', border: `1px solid ${GOLD}25`, color: TEXT }} />
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#0B1F0D', border: `1px solid ${GOLD}20` }}>
                                    <span className="text-sm font-semibold">Service actif</span>
                                    <button onClick={() => setEditData(p => ({ ...p, is_active: !p.is_active }))}
                                        className="w-12 h-6 rounded-full transition-all relative"
                                        style={{ background: editData.is_active ? GREEN : '#374151' }}>
                                        <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                                            style={{ left: editData.is_active ? '26px' : '4px' }} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => deleteService(selected.id)}
                                    className="p-2.5 rounded-xl hover:opacity-80" style={{ background: `${RED}20`, color: RED }}>
                                    <Trash2 size={16} />
                                </button>
                                <button onClick={save} disabled={saving}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm hover:opacity-90"
                                    style={{ background: GREEN, color: '#fff' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    Enregistrer
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Create Modal */}
            <AnimatePresence>
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
                        onClick={() => setShowCreate(false)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>Nouveau service</h3>
                                <button onClick={() => setShowCreate(false)} className="opacity-40 hover:opacity-70 p-1"><X size={18} /></button>
                            </div>
                            <div className="space-y-3 mb-5">
                                {[
                                    { key: 'name', label: 'Nom *', type: 'text' },
                                    { key: 'category', label: 'Catégorie', type: 'text' },
                                    { key: 'price', label: 'Prix (FCFA)', type: 'number' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                        <input type={f.type}
                                            value={newService[f.key as keyof typeof newService] as string}
                                            onChange={e => setNewService(p => ({ ...p, [f.key]: e.target.value }))}
                                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                                            style={{ background: '#0B1F0D', border: `1px solid ${GOLD}25`, color: TEXT }} />
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Description</label>
                                    <textarea value={newService.description}
                                        onChange={e => setNewService(p => ({ ...p, description: e.target.value }))}
                                        rows={2} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                                        style={{ background: '#0B1F0D', border: `1px solid ${GOLD}25`, color: TEXT }} />
                                </div>
                            </div>
                            <button onClick={create} disabled={creating || !newService.name}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-40"
                                style={{ background: GOLD, color: BG }}>
                                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                Créer
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
