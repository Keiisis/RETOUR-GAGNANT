'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tag, RefreshCw, Loader2, Plus, X, Save, Trash2, Copy, ToggleLeft, ToggleRight, CheckCircle2 } from 'lucide-react'

const GOLD = '#D4AF37'; const GREEN = '#008751'; const GREEN_L = '#00A86B'
const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'; const PANEL = '#0D2615'

interface Coupon {
    id: string; code: string; discount_type: 'percent' | 'fixed'
    discount_value: number; min_order?: number; max_uses?: number
    uses_count?: number; is_active?: boolean; expires_at?: string; created_at: string
}

function randomCode() { return Math.random().toString(36).slice(2, 8).toUpperCase() }
const EMPTY = { code: randomCode(), discount_type: 'percent' as 'percent' | 'fixed', discount_value: 10, min_order: 0, max_uses: 0, is_active: true, expires_at: '' }

export default function CeoCoupons() {
    const [items, setItems] = useState<Coupon[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<Coupon | null>(null)
    const [editData, setEditData] = useState<Partial<Coupon>>({})
    const [showCreate, setShowCreate] = useState(false)
    const [newItem, setNewItem] = useState(EMPTY)
    const [saving, setSaving] = useState(false)
    const [creating, setCreating] = useState(false)
    const [refresh, setRefresh] = useState(0)
    const [copied, setCopied] = useState<string | null>(null)

    const load = useCallback(async () => {
        if (!loading) setLoading(true)
        const res = await fetch('/api/ceo/coupons', { cache: 'no-store' })
        const data = res.ok ? await res.json() : {}
        setItems(data.coupons || [])
        setLoading(false)
    }, [loading])

    useEffect(() => { load() }, [load, refresh])

    const open = (item: Coupon) => { setSelected(item); setEditData(item) }

    const save = async () => {
        if (!selected) return
        setSaving(true)
        await fetch('/api/ceo/coupons', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, ...editData }) })
        setSaving(false)
        setItems(prev => prev.map(x => x.id === selected.id ? { ...x, ...editData } as Coupon : x))
        setSelected(null)
    }

    const del = async (id: string) => {
        if (!confirm('Supprimer ce coupon ?')) return
        await fetch(`/api/ceo/coupons?id=${id}`, { method: 'DELETE' })
        setItems(prev => prev.filter(x => x.id !== id)); setSelected(null)
    }

    const toggle = async (item: Coupon) => {
        const val = !item.is_active
        await fetch('/api/ceo/coupons', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, is_active: val }) })
        setItems(prev => prev.map(x => x.id === item.id ? { ...x, is_active: val } : x))
    }

    const create = async () => {
        if (!newItem.code.trim()) return
        setCreating(true)
        const res = await fetch('/api/ceo/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newItem) })
        if (res.ok) { setShowCreate(false); setNewItem({ ...EMPTY, code: randomCode() }); setRefresh(r => r + 1) }
        setCreating(false)
    }

    const copy = (code: string) => {
        navigator.clipboard.writeText(code)
        setCopied(code)
        setTimeout(() => setCopied(null), 1500)
    }

    const active = items.filter(x => x.is_active).length
    const inp = 'w-full px-4 py-2.5 rounded-xl text-sm outline-none'
    const inpStyle = { background: BG, border: `1px solid ${GOLD}25`, color: TEXT }

    const isExpired = (expires?: string) => expires && new Date(expires) < new Date()

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}25` }}>
                            <Tag size={18} style={{ color: GOLD }}/>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Coupons & Réductions</h1>
                    </div>
                    <p className="text-sm opacity-50">Codes promo & offres spéciales</p>
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
                    { label: 'Total coupons', value: items.length, color: GOLD },
                    { label: 'Actifs', value: active, color: GREEN_L },
                    { label: 'Utilisations', value: items.reduce((s, x) => s + (x.uses_count || 0), 0), color: GOLD },
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
                    {items.map((item, i) => {
                        const expired = isExpired(item.expires_at)
                        const border = expired ? `${RED}20` : item.is_active ? `${GREEN}30` : `${GOLD}15`
                        return (
                            <motion.div key={item.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.05 }}
                                className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: PANEL, border: `1px solid ${border}` }}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => copy(item.code)}
                                            title="Copier le code"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-sm transition-all"
                                            style={{ background: `${GOLD}20`, color: GOLD }}>
                                            {copied === item.code ? <CheckCircle2 size={13}/> : <Copy size={13}/>}
                                            {item.code}
                                        </button>
                                    </div>
                                    <span className="text-lg font-black" style={{ color: GOLD }}>
                                        {item.discount_value}{item.discount_type === 'percent' ? '%' : ' FCFA'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2 text-[11px]">
                                    {item.min_order ? <span className="opacity-40">Min: {item.min_order.toLocaleString()} FCFA</span> : null}
                                    {item.max_uses ? <span className="opacity-40">Max: {item.max_uses} utilisations</span> : null}
                                    <span className="opacity-40">{item.uses_count || 0} utilisé{(item.uses_count || 0) > 1 ? 's' : ''}</span>
                                    {item.expires_at && (
                                        <span style={{ color: expired ? RED : 'inherit', opacity: expired ? 1 : 0.4 }}>
                                            {expired ? 'Expiré' : `Expire ${isNaN(new Date(item.expires_at).getTime()) ? '—' : new Date(item.expires_at).toLocaleDateString('fr-FR')}`}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2 pt-2 border-t border-white/5">
                                    <button type="button" onClick={() => open(item)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold hover:opacity-80" style={{ background: `${GOLD}15`, color: GOLD }}>
                                        Modifier
                                    </button>
                                    <button type="button" onClick={() => toggle(item)} className="p-2 rounded-xl hover:opacity-80" style={{ background: item.is_active ? `${RED}15` : `${GREEN}20`, color: item.is_active ? RED : GREEN_L }} aria-label={item.is_active ? 'Désactiver le coupon' : 'Activer le coupon'}>
                                        {item.is_active ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                                    </button>
                                </div>
                            </motion.div>
                        )
                    })}
                    {items.length === 0 && <p className="col-span-3 text-center opacity-30 py-12">Aucun coupon</p>}
                </div>
            )}

            <AnimatePresence>
                {selected && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setSelected(null)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>Modifier le coupon</h3>
                                <button type="button" onClick={() => setSelected(null)} className="opacity-40 hover:opacity-70 p-1" aria-label="Fermer"><X size={18}/></button>
                            </div>
                            <div className="space-y-3 mb-5">
                                 <div>
                                     <label htmlFor="edit-code" className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Code</label>
                                     <input id="edit-code" type="text" value={editData.code || ''} onChange={e => setEditData(p => ({ ...p, code: e.target.value.toUpperCase() }))} className={inp} style={inpStyle}/>
                                 </div>
                                 <div className="grid grid-cols-2 gap-3">
                                     <div>
                                         <label htmlFor="edit-type" className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Type</label>
                                         <select id="edit-type" value={editData.discount_type || 'percent'} onChange={e => setEditData(p => ({ ...p, discount_type: e.target.value as 'percent' | 'fixed' }))}
                                             className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inpStyle}>
                                             <option value="percent">Pourcentage (%)</option>
                                             <option value="fixed">Fixe (FCFA)</option>
                                         </select>
                                     </div>
                                     <div>
                                         <label htmlFor="edit-value" className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Valeur</label>
                                         <input id="edit-value" type="number" value={editData.discount_value || 0} onChange={e => setEditData(p => ({ ...p, discount_value: Number(e.target.value) }))} className={inp} style={inpStyle}/>
                                     </div>
                                 </div>
                                 {[{ key: 'min_order', label: 'Commande min (FCFA)', type: 'number' }, { key: 'max_uses', label: 'Utilisations max', type: 'number' }].map(f => (
                                     <div key={f.key}>
                                         <label htmlFor={`edit-${f.key}`} className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                         <input id={`edit-${f.key}`} type={f.type} value={String((editData as Record<string, unknown>)[f.key] || 0)}
                                             onChange={e => setEditData(p => ({ ...p, [f.key]: Number(e.target.value) }))} className={inp} style={inpStyle}/>
                                     </div>
                                 ))}
                                 <div>
                                     <label htmlFor="edit-expires" className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Date d&apos;expiration</label>
                                     <input id="edit-expires" type="date" value={editData.expires_at ? editData.expires_at.slice(0, 10) : ''} onChange={e => setEditData(p => ({ ...p, expires_at: e.target.value }))} className={inp} style={inpStyle}/>
                                 </div>
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => del(selected.id)} className="p-2.5 rounded-xl hover:opacity-80" style={{ background: `${RED}20`, color: RED }} aria-label="Supprimer le coupon"><Trash2 size={16}/></button>
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
                                <h3 className="font-black" style={{ color: GOLD }}>Nouveau coupon</h3>
                                <button type="button" onClick={() => setShowCreate(false)} className="opacity-40 hover:opacity-70 p-1" aria-label="Fermer"><X size={18}/></button>
                            </div>
                            <div className="space-y-3 mb-5">
                                 <div className="flex gap-2">
                                     <div className="flex-1">
                                         <label htmlFor="new-code" className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Code *</label>
                                         <input id="new-code" type="text" value={newItem.code} onChange={e => setNewItem(p => ({ ...p, code: e.target.value.toUpperCase() }))} className={inp} style={inpStyle}/>
                                     </div>
                                     <button type="button" onClick={() => setNewItem(p => ({ ...p, code: randomCode() }))} className="mt-6 px-3 py-2.5 rounded-xl text-xs opacity-40 hover:opacity-70" style={{ background: `${GOLD}15`, color: GOLD }} aria-label="Générer un nouveau code">
                                         ⟳
                                     </button>
                                 </div>
                                 <div className="grid grid-cols-2 gap-3">
                                     <div>
                                         <label htmlFor="new-type" className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Type</label>
                                         <select id="new-type" value={newItem.discount_type} onChange={e => setNewItem(p => ({ ...p, discount_type: e.target.value as 'percent' | 'fixed' }))}
                                             className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inpStyle}>
                                             <option value="percent">% Pourcentage</option>
                                             <option value="fixed">FCFA Fixe</option>
                                         </select>
                                     </div>
                                     <div>
                                         <label htmlFor="new-value" className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Valeur *</label>
                                         <input id="new-value" type="number" value={newItem.discount_value} onChange={e => setNewItem(p => ({ ...p, discount_value: Number(e.target.value) }))} className={inp} style={inpStyle}/>
                                     </div>
                                 </div>
                                 <div className="grid grid-cols-2 gap-3">
                                     <div>
                                         <label htmlFor="new-min" className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Commande min</label>
                                         <input id="new-min" type="number" value={newItem.min_order} onChange={e => setNewItem(p => ({ ...p, min_order: Number(e.target.value) }))} className={inp} style={inpStyle}/>
                                     </div>
                                     <div>
                                         <label htmlFor="new-max" className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Max utilisations</label>
                                         <input id="new-max" type="number" value={newItem.max_uses} onChange={e => setNewItem(p => ({ ...p, max_uses: Number(e.target.value) }))} className={inp} style={inpStyle}/>
                                     </div>
                                 </div>
                                 <div>
                                     <label htmlFor="new-expires" className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Expiration</label>
                                     <input id="new-expires" type="date" value={newItem.expires_at} onChange={e => setNewItem(p => ({ ...p, expires_at: e.target.value }))} className={inp} style={inpStyle}/>
                                 </div>
                             </div>
                            <button type="button" onClick={create} disabled={creating || !newItem.code}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-40"
                                style={{ background: GOLD, color: BG }}>
                                {creating ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} Créer le coupon
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
