'use client'

// ══════════════════════════════════════════════════════════════
//  ADMIN : AUTO-ÉCOLES PARTENAIRES (Permis de Conduire Béninois)
//  Ajouter / éditer / supprimer les auto-écoles que les clients choisissent.
//  Prix (EUR) + durée + prestations incluses 100 % pilotés ici. Aucune donnée
//  codée en dur : tout vient de la table driving_schools.
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Car, Plus, X, MapPin, Trash as Trash2, Pencil, FloppyDisk as Save, CircleNotch as Loader2, Eye, EyeSlash as EyeOff, ArrowClockwise as RefreshCw, Clock, CurrencyEur, Phone, Envelope as Mail, CloudArrowUp as UploadCloud, Check } from '@phosphor-icons/react'

const ACCENT = '#008751'

interface School {
    id: string
    nom: string
    ville: string | null
    description: string | null
    photo_url: string | null
    price_eur: number | null
    duration: string | null
    features: string[]
    telephone: string | null
    email: string | null
    is_active: boolean
    order_index: number
}

type Draft = Omit<School, 'id'>

const EMPTY: Draft = {
    nom: '', ville: '', description: '', photo_url: '', price_eur: null, duration: '',
    features: [], telephone: '', email: '', is_active: true, order_index: 0,
}

const IN = 'w-full bg-transparent border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#008751] transition-colors'
const inStyle = { borderColor: 'var(--panel-border, rgba(0,0,0,0.12))', color: 'var(--panel-text, #1a2332)' }
const LABEL = 'flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest mb-1.5'
const labelStyle = { color: 'var(--panel-text-muted, #6B7280)' }

export default function AutoEcolesAdmin() {
    const [schools, setSchools] = useState<School[]>([])
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState('')
    const [editing, setEditing] = useState<School | 'new' | null>(null)
    const [draft, setDraft] = useState<Draft>(EMPTY)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)

    const load = useCallback(async () => {
        setLoading(true); setErr('')
        try {
            const res = await fetch('/api/admin/driving-schools', { credentials: 'same-origin' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Chargement impossible.')
            setSchools((data.schools || []).map((s: School) => ({ ...s, features: Array.isArray(s.features) ? s.features : [] })))
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Erreur.')
        } finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    const openNew = () => { setDraft({ ...EMPTY, order_index: schools.length }); setEditing('new') }
    const openEdit = (s: School) => {
        setDraft({ nom: s.nom, ville: s.ville || '', description: s.description || '', photo_url: s.photo_url || '', price_eur: s.price_eur, duration: s.duration || '', features: s.features || [], telephone: s.telephone || '', email: s.email || '', is_active: s.is_active, order_index: s.order_index })
        setEditing(s)
    }
    const close = () => { setEditing(null); setDraft(EMPTY) }

    const uploadPhoto = async (file: File) => {
        setUploading(true)
        try {
            const fd = new FormData(); fd.append('file', file)
            const res = await fetch('/api/admin/driving-schools/upload', { method: 'POST', body: fd, credentials: 'same-origin' })
            const data = await res.json()
            if (res.ok && data.urls?.[0]) setDraft(d => ({ ...d, photo_url: data.urls[0] }))
            else setErr(data.error || 'Envoi de la photo impossible.')
        } catch { setErr('Envoi de la photo impossible.') } finally { setUploading(false) }
    }

    const save = async () => {
        if (!draft.nom.trim()) { setErr("Le nom de l'auto-école est obligatoire."); return }
        setSaving(true); setErr('')
        try {
            const isNew = editing === 'new'
            const body = { ...draft, ...(isNew ? {} : { id: (editing as School).id }) }
            const res = await fetch('/api/admin/driving-schools', {
                method: isNew ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || 'Enregistrement impossible.')
            close(); await load()
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Erreur.')
        } finally { setSaving(false) }
    }

    const remove = async (s: School) => {
        if (!confirm(`Supprimer définitivement « ${s.nom} » ?`)) return
        try {
            const res = await fetch(`/api/admin/driving-schools?id=${s.id}`, { method: 'DELETE', credentials: 'same-origin' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Suppression impossible.')
            await load()
        } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur.') }
    }

    const toggleActive = async (s: School) => {
        await fetch('/api/admin/driving-schools', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
            body: JSON.stringify({ id: s.id, is_active: !s.is_active }),
        })
        await load()
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
            {/* En-tête */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${ACCENT}18` }}>
                        <Car size={22} style={{ color: ACCENT }} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black" style={{ color: 'var(--panel-text, #1a2332)' }}>Auto-écoles partenaires</h1>
                        <p className="text-xs" style={{ color: 'var(--panel-text-muted, #6B7280)' }}>Permis de Conduire Béninois : les clients choisissent parmi ces écoles.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} title="Rafraîchir" className="p-2.5 rounded-xl border transition-all hover:border-[#008751]" style={{ borderColor: 'var(--panel-border, rgba(0,0,0,0.12))', color: 'var(--panel-text-muted, #6B7280)' }}>
                        <RefreshCw size={16} />
                    </button>
                    <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90" style={{ background: ACCENT }}>
                        <Plus size={16} /> Ajouter une auto-école
                    </button>
                </div>
            </div>

            {err && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{err}</div>}

            {/* Liste */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin" style={{ color: ACCENT }} /></div>
            ) : schools.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--panel-border, rgba(0,0,0,0.1))' }}>
                    <Car size={30} className="mx-auto mb-3 opacity-40" style={{ color: ACCENT }} />
                    <p className="text-sm mb-4" style={{ color: 'var(--panel-text-muted, #6B7280)' }}>Aucune auto-école pour le moment.</p>
                    <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold" style={{ background: ACCENT }}>
                        <Plus size={16} /> Ajouter la première
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {schools.map(s => (
                        <div key={s.id} className="rounded-2xl border p-4 flex gap-4" style={{ borderColor: 'var(--panel-border, rgba(0,0,0,0.1))', background: 'var(--panel-surface, #fff)' }}>
                            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: `${ACCENT}12` }}>
                                {s.photo_url
                                    // eslint-disable-next-line @next/next/no-img-element
                                    ? <img src={s.photo_url} alt={s.nom} className="w-full h-full object-cover" />
                                    : <Car size={22} style={{ color: ACCENT }} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-black truncate" style={{ color: 'var(--panel-text, #1a2332)' }}>{s.nom}</p>
                                        {s.ville && <p className="text-xs flex items-center gap-1" style={{ color: 'var(--panel-text-muted, #6B7280)' }}><MapPin size={11} /> {s.ville}</p>}
                                    </div>
                                    {!s.is_active && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 shrink-0">Masquée</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: 'var(--panel-text-muted, #6B7280)' }}>
                                    <span className="font-black" style={{ color: ACCENT }}>{s.price_eur ? `${s.price_eur} €` : 'Prix à définir'}</span>
                                    {s.duration && <span className="flex items-center gap-1"><Clock size={11} /> {s.duration}</span>}
                                </div>
                                <div className="flex items-center gap-1.5 mt-3">
                                    <button onClick={() => openEdit(s)} className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all hover:border-[#008751]" style={{ borderColor: 'var(--panel-border, rgba(0,0,0,0.12))', color: 'var(--panel-text, #1a2332)' }}><Pencil size={12} /> Éditer</button>
                                    <button onClick={() => toggleActive(s)} title={s.is_active ? 'Masquer' : 'Afficher'} className="p-1.5 rounded-lg border transition-all hover:border-[#008751]" style={{ borderColor: 'var(--panel-border, rgba(0,0,0,0.12))', color: 'var(--panel-text-muted, #6B7280)' }}>{s.is_active ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                                    <button onClick={() => remove(s)} title="Supprimer" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-all"><Trash2 size={13} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal éditeur */}
            <AnimatePresence>
                {editing && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={close}>
                        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6"
                            style={{ background: 'var(--panel-surface, #fff)' }}>
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-lg font-black" style={{ color: 'var(--panel-text, #1a2332)' }}>{editing === 'new' ? 'Nouvelle auto-école' : "Éditer l'auto-école"}</h2>
                                <button onClick={close} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} style={{ color: 'var(--panel-text-muted, #6B7280)' }} /></button>
                            </div>

                            {/* Photo */}
                            <div className="mb-4">
                                <label className={LABEL} style={labelStyle}>Photo / logo</label>
                                <div className="flex items-center gap-3">
                                    <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center border" style={{ background: `${ACCENT}10`, borderColor: 'var(--panel-border, rgba(0,0,0,0.1))' }}>
                                        {draft.photo_url
                                            // eslint-disable-next-line @next/next/no-img-element
                                            ? <img src={draft.photo_url} alt="" className="w-full h-full object-cover" />
                                            : <Car size={24} style={{ color: ACCENT }} />}
                                    </div>
                                    <label className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all hover:border-[#008751]" style={{ borderColor: 'var(--panel-border, rgba(0,0,0,0.12))', color: 'var(--panel-text, #1a2332)' }}>
                                        {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                                        {uploading ? 'Envoi…' : 'Choisir une image'}
                                        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }} />
                                    </label>
                                    {draft.photo_url && <button onClick={() => setDraft(d => ({ ...d, photo_url: '' }))} className="text-xs text-red-500 hover:underline">Retirer</button>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className={LABEL} style={labelStyle}>Nom de l'auto-école *</label>
                                    <input value={draft.nom} onChange={e => setDraft(d => ({ ...d, nom: e.target.value }))} placeholder="Ex : Auto-École Étoile" className={IN} style={inStyle} />
                                </div>
                                <div>
                                    <label className={LABEL} style={labelStyle}><MapPin size={11} /> Ville</label>
                                    <input value={draft.ville || ''} onChange={e => setDraft(d => ({ ...d, ville: e.target.value }))} placeholder="Ex : Cotonou" className={IN} style={inStyle} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className={LABEL} style={labelStyle}><CurrencyEur size={11} /> Prix (EUR) *</label>
                                    <input type="number" min="0" step="1" value={draft.price_eur ?? ''} onChange={e => setDraft(d => ({ ...d, price_eur: e.target.value === '' ? null : Number(e.target.value) }))} placeholder="Ex : 250" className={IN} style={inStyle} />
                                    <p className="text-[10px] mt-1" style={{ color: 'var(--panel-text-muted, #9CA3AF)' }}>Encaissé en FCFA au taux BCEAO.</p>
                                </div>
                                <div>
                                    <label className={LABEL} style={labelStyle}><Clock size={11} /> Durée</label>
                                    <input value={draft.duration || ''} onChange={e => setDraft(d => ({ ...d, duration: e.target.value }))} placeholder="Ex : 3 semaines, 1 mois…" className={IN} style={inStyle} />
                                </div>
                            </div>

                            <div className="mb-3">
                                <label className={LABEL} style={labelStyle}>Description</label>
                                <textarea value={draft.description || ''} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} rows={3} placeholder="Présentation courte de l'auto-école, ses points forts…" className={IN} style={inStyle} />
                            </div>

                            {/* Prestations incluses */}
                            <div className="mb-3">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className={LABEL} style={labelStyle}><Check size={11} /> Ce qui est inclus</label>
                                    <button type="button" onClick={() => setDraft(d => ({ ...d, features: [...d.features, ''] }))} className="text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all hover:border-[#008751]" style={{ borderColor: 'var(--panel-border, rgba(0,0,0,0.12))', color: ACCENT }}>+ Ajouter</button>
                                </div>
                                <div className="space-y-2">
                                    {draft.features.length === 0 && <p className="text-[11px] italic px-1" style={{ color: 'var(--panel-text-muted, #9CA3AF)' }}>Ex : « Cours de code », « 20 h de conduite », « Présentation à l'examen »…</p>}
                                    {draft.features.map((f, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <input value={f} onChange={e => setDraft(d => { const nf = [...d.features]; nf[i] = e.target.value; return { ...d, features: nf } })} placeholder="Prestation incluse" className={IN} style={inStyle} />
                                            <button type="button" onClick={() => setDraft(d => ({ ...d, features: d.features.filter((_, k) => k !== i) }))} className="p-2 rounded-lg text-gray-400 hover:text-red-500 shrink-0"><Trash2 size={13} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className={LABEL} style={labelStyle}><Phone size={11} /> Téléphone (interne)</label>
                                    <input value={draft.telephone || ''} onChange={e => setDraft(d => ({ ...d, telephone: e.target.value }))} placeholder="Non affiché aux clients" className={IN} style={inStyle} />
                                </div>
                                <div>
                                    <label className={LABEL} style={labelStyle}><Mail size={11} /> Email (interne)</label>
                                    <input value={draft.email || ''} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} placeholder="Non affiché aux clients" className={IN} style={inStyle} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                                <div>
                                    <label className={LABEL} style={labelStyle}>Ordre d'affichage</label>
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
                                <button onClick={close} className="px-5 py-3 rounded-xl border text-sm font-bold transition-all" style={{ borderColor: 'var(--panel-border, rgba(0,0,0,0.12))', color: 'var(--panel-text-muted, #6B7280)' }}>Annuler</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
