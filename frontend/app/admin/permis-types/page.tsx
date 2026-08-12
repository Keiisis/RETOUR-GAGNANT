'use client'

// ══════════════════════════════════════════════════════════════
//  ADMIN : CATÉGORIES DE PERMIS DE CONDUIRE (prix + durée)
//  Le prix du permis dépend de la CATÉGORIE. On règle ici, par catégorie,
//  le PRIX (EUR) et la DURÉE. Aucune donnée codée en dur : tout vient de la
//  table permis_types (seed = catégories officielles ANATT).
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IdentificationCard, Plus, X, Trash as Trash2, Pencil, FloppyDisk as Save, CircleNotch as Loader2, Eye, EyeSlash as EyeOff, ArrowClockwise as RefreshCw, Clock, CurrencyEur } from '@phosphor-icons/react'

const ACCENT = '#008751'

interface PType {
    id: string
    category: string
    label: string
    description: string | null
    age_min: number | null
    price_eur: number | null
    duration: string | null
    is_active: boolean
    order_index: number
}
type Draft = Omit<PType, 'id'>
const EMPTY: Draft = { category: '', label: '', description: '', age_min: null, price_eur: null, duration: '', is_active: true, order_index: 0 }

const IN = 'w-full bg-transparent border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#008751] transition-colors'
const inStyle = { borderColor: 'var(--panel-border, rgba(0,0,0,0.12))', color: 'var(--panel-text, #1a2332)' }
const LABEL = 'flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest mb-1.5'
const labelStyle = { color: 'var(--panel-text-muted, #6B7280)' }

export default function PermisTypesAdmin() {
    const [types, setTypes] = useState<PType[]>([])
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState('')
    const [editing, setEditing] = useState<PType | 'new' | null>(null)
    const [draft, setDraft] = useState<Draft>(EMPTY)
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true); setErr('')
        try {
            const res = await fetch('/api/admin/permis-types', { credentials: 'same-origin' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Chargement impossible.')
            setTypes(data.types || [])
        } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur.') } finally { setLoading(false) }
    }, [])
    useEffect(() => { load() }, [load])

    const openNew = () => { setDraft({ ...EMPTY, order_index: types.length + 1 }); setEditing('new') }
    const openEdit = (ty: PType) => {
        setDraft({ category: ty.category, label: ty.label, description: ty.description || '', age_min: ty.age_min, price_eur: ty.price_eur, duration: ty.duration || '', is_active: ty.is_active, order_index: ty.order_index })
        setEditing(ty)
    }
    const close = () => { setEditing(null); setDraft(EMPTY) }

    const save = async () => {
        if (!draft.category.trim() || !draft.label.trim()) { setErr('La catégorie et l’intitulé sont obligatoires.'); return }
        setSaving(true); setErr('')
        try {
            const isNew = editing === 'new'
            const body = { ...draft, ...(isNew ? {} : { id: (editing as PType).id }) }
            const res = await fetch('/api/admin/permis-types', {
                method: isNew ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || 'Enregistrement impossible.')
            close(); await load()
        } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur.') } finally { setSaving(false) }
    }

    const remove = async (ty: PType) => {
        if (!confirm(`Supprimer la catégorie « ${ty.label} » ?`)) return
        try {
            const res = await fetch(`/api/admin/permis-types?id=${ty.id}`, { method: 'DELETE', credentials: 'same-origin' })
            if (!res.ok) throw new Error((await res.json()).error || 'Suppression impossible.')
            await load()
        } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur.') }
    }
    const toggleActive = async (ty: PType) => {
        await fetch('/api/admin/permis-types', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ id: ty.id, is_active: !ty.is_active }) })
        await load()
    }

    const missingPrice = types.filter(ty => ty.is_active && !(ty.price_eur && ty.price_eur > 0)).length

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${ACCENT}18` }}>
                        <IdentificationCard size={22} style={{ color: ACCENT }} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black" style={{ color: 'var(--panel-text, #1a2332)' }}>Catégories de permis</h1>
                        <p className="text-xs" style={{ color: 'var(--panel-text-muted, #6B7280)' }}>Réglez le prix et la durée de chaque catégorie. C’est ce prix que paie le client.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} title="Rafraîchir" className="p-2.5 rounded-xl border transition-all hover:border-[#008751]" style={{ borderColor: 'var(--panel-border, rgba(0,0,0,0.12))', color: 'var(--panel-text-muted, #6B7280)' }}><RefreshCw size={16} /></button>
                    <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90" style={{ background: ACCENT }}><Plus size={16} /> Ajouter une catégorie</button>
                </div>
            </div>

            {err && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{err}</div>}
            {!loading && missingPrice > 0 && (
                <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    {missingPrice} catégorie(s) active(s) sans prix : renseignez-les pour qu’elles soient réservables.
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin" style={{ color: ACCENT }} /></div>
            ) : (
                <div className="space-y-2">
                    {types.map(ty => (
                        <div key={ty.id} className="rounded-2xl border p-4 flex items-center gap-4" style={{ borderColor: 'var(--panel-border, rgba(0,0,0,0.1))', background: 'var(--panel-surface, #fff)' }}>
                            <span className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black shrink-0" style={{ background: `${ACCENT}12`, color: ACCENT }}>{ty.category}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-black truncate" style={{ color: 'var(--panel-text, #1a2332)' }}>{ty.label}</p>
                                    {!ty.is_active && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Masquée</span>}
                                </div>
                                {ty.description && <p className="text-xs truncate" style={{ color: 'var(--panel-text-muted, #6B7280)' }}>{ty.description}</p>}
                                <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--panel-text-muted, #6B7280)' }}>
                                    <span className="font-black" style={{ color: ty.price_eur ? ACCENT : '#d97706' }}>{ty.price_eur ? `${ty.price_eur} €` : 'Prix à définir'}</span>
                                    {ty.duration && <span className="flex items-center gap-1"><Clock size={11} /> {ty.duration}</span>}
                                    {ty.age_min && <span>{ty.age_min}+ ans</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => openEdit(ty)} className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all hover:border-[#008751]" style={{ borderColor: 'var(--panel-border, rgba(0,0,0,0.12))', color: 'var(--panel-text, #1a2332)' }}><Pencil size={12} /> Éditer</button>
                                <button onClick={() => toggleActive(ty)} title={ty.is_active ? 'Masquer' : 'Afficher'} className="p-1.5 rounded-lg border transition-all hover:border-[#008751]" style={{ borderColor: 'var(--panel-border, rgba(0,0,0,0.12))', color: 'var(--panel-text-muted, #6B7280)' }}>{ty.is_active ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                                <button onClick={() => remove(ty)} title="Supprimer" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-all"><Trash2 size={13} /></button>
                            </div>
                        </div>
                    ))}
                    {types.length === 0 && (
                        <div className="text-center py-16 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--panel-border, rgba(0,0,0,0.1))' }}>
                            <IdentificationCard size={30} className="mx-auto mb-3 opacity-40" style={{ color: ACCENT }} />
                            <p className="text-sm mb-1" style={{ color: 'var(--panel-text-muted, #6B7280)' }}>Aucune catégorie.</p>
                            <p className="text-xs" style={{ color: 'var(--panel-text-muted, #9CA3AF)' }}>Exécutez la migration 20260813_permis_types.sql pour charger les catégories officielles.</p>
                        </div>
                    )}
                </div>
            )}

            <AnimatePresence>
                {editing && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={close}>
                        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} onClick={e => e.stopPropagation()}
                            className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6" style={{ background: 'var(--panel-surface, #fff)' }}>
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-lg font-black" style={{ color: 'var(--panel-text, #1a2332)' }}>{editing === 'new' ? 'Nouvelle catégorie' : 'Éditer la catégorie'}</h2>
                                <button onClick={close} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} style={{ color: 'var(--panel-text-muted, #6B7280)' }} /></button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                                <div>
                                    <label className={LABEL} style={labelStyle}>Code *</label>
                                    <input value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} placeholder="Ex : B" className={IN} style={inStyle} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className={LABEL} style={labelStyle}>Intitulé *</label>
                                    <input value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} placeholder="Ex : Voiture (B)" className={IN} style={inStyle} />
                                </div>
                            </div>
                            <div className="mb-3">
                                <label className={LABEL} style={labelStyle}>Description</label>
                                <textarea value={draft.description || ''} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} rows={2} placeholder="Ce que la catégorie autorise à conduire" className={IN} style={inStyle} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                                <div>
                                    <label className={LABEL} style={labelStyle}><CurrencyEur size={11} /> Prix (EUR)</label>
                                    <input type="number" min="0" step="1" value={draft.price_eur ?? ''} onChange={e => setDraft(d => ({ ...d, price_eur: e.target.value === '' ? null : Number(e.target.value) }))} placeholder="Ex : 250" className={IN} style={inStyle} />
                                </div>
                                <div>
                                    <label className={LABEL} style={labelStyle}><Clock size={11} /> Durée</label>
                                    <input value={draft.duration || ''} onChange={e => setDraft(d => ({ ...d, duration: e.target.value }))} placeholder="Ex : 1 mois" className={IN} style={inStyle} />
                                </div>
                                <div>
                                    <label className={LABEL} style={labelStyle}>Âge min.</label>
                                    <input type="number" min="0" value={draft.age_min ?? ''} onChange={e => setDraft(d => ({ ...d, age_min: e.target.value === '' ? null : Number(e.target.value) }))} placeholder="Ex : 18" className={IN} style={inStyle} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                                <div>
                                    <label className={LABEL} style={labelStyle}>Ordre d’affichage</label>
                                    <input type="number" value={draft.order_index} onChange={e => setDraft(d => ({ ...d, order_index: Number(e.target.value) || 0 }))} className={IN} style={inStyle} />
                                </div>
                                <label className="flex items-end gap-2 pb-2.5 cursor-pointer select-none">
                                    <input type="checkbox" checked={draft.is_active} onChange={e => setDraft(d => ({ ...d, is_active: e.target.checked }))} className="w-5 h-5 accent-[#008751]" />
                                    <span className="text-sm font-bold" style={{ color: 'var(--panel-text, #1a2332)' }}>Visible pour les clients</span>
                                </label>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-black transition-all hover:opacity-90 disabled:opacity-60" style={{ background: ACCENT }}>
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer
                                </button>
                                <button onClick={close} className="px-5 py-3 rounded-xl border text-sm font-bold" style={{ borderColor: 'var(--panel-border, rgba(0,0,0,0.12))', color: 'var(--panel-text-muted, #6B7280)' }}>Annuler</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
