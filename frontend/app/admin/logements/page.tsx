'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, Reorder } from 'framer-motion'
import {
    Home, Plus, Loader2, Save, Trash2, X, GripVertical, Eye, EyeOff,
    UploadCloud, Image as ImageIcon, MapPin, Check, Building2,
} from 'lucide-react'

interface Logement {
    id: string
    programme: string
    nom: string
    type: string
    ville: string
    site: string
    surface_m2: number
    chambres: number
    prix_comptant: number
    devise: string
    mensualite: number
    duree_annees: number
    formules: string[]
    description: string
    atouts: string[]
    images: string[]
    plan_url: string | null
    visite_url: string | null
    lat: number | null
    lng: number | null
    disponibilite: string
    ordre: number
    is_active: boolean
}

const PROGRAMMES = [{ v: '20000', l: 'Programme 20 000 logements' }, { v: 'residences', l: 'Résidences (Palétuviers…)' }]
const TYPES = ['F3', 'F4', 'Villa sociale', 'Villa', 'Appartement', 'Studio', 'Duplex']
const DISPOS = [{ v: 'disponible', l: 'Disponible' }, { v: 'bientot', l: 'Bientôt' }, { v: 'epuise', l: 'Épuisé' }]
const FORMULES = [{ v: 'location-accession', l: 'Location-accession' }, { v: 'comptant', l: 'Comptant / crédit' }]

const blank = (): Partial<Logement> => ({
    programme: '20000', nom: '', type: 'F4', ville: '', site: '', surface_m2: 0, chambres: 0,
    prix_comptant: 0, devise: 'XOF', mensualite: 0, duree_annees: 25,
    formules: ['location-accession', 'comptant'], description: '', atouts: [], images: [],
    plan_url: '', visite_url: '', lat: null, lng: null, disponibilite: 'disponible', is_active: true,
})

const fmt = (n: number, d = 'XOF') => `${Math.round(n).toLocaleString('fr-FR')} ${d === 'XOF' ? 'FCFA' : d}`

export default function AdminLogementsPage() {
    const [items, setItems] = useState<Logement[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<Partial<Logement> | null>(null)
    const [saving, setSaving] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/logements')
            const j = await res.json().catch(() => ({}))
            setItems(res.ok ? (j.logements || []) : [])
        } finally { setLoading(false) }
    }, [])
    useEffect(() => { load() }, [load])

    const persistOrder = async (ordered: Logement[]) => {
        setItems(ordered)
        await fetch('/api/admin/logements', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reorder: ordered.map((x, i) => ({ id: x.id, ordre: i })) }),
        }).catch(() => {})
    }

    const save = async () => {
        if (!editing) return
        if (!editing.nom?.trim() || !editing.ville?.trim()) { alert('Nom et ville requis.'); return }
        setSaving(true)
        try {
            const isNew = !editing.id
            const res = await fetch('/api/admin/logements', {
                method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editing),
            })
            const j = await res.json().catch(() => ({}))
            if (!res.ok || !j.success) throw new Error(j.error || 'Échec.')
            setEditing(null)
            await load()
        } catch (e) { alert(e instanceof Error ? e.message : 'Erreur.') } finally { setSaving(false) }
    }

    const remove = async (l: Logement) => {
        if (!confirm(`Supprimer « ${l.nom} » ?`)) return
        setBusyId(l.id)
        try {
            const res = await fetch(`/api/admin/logements?id=${l.id}`, { method: 'DELETE' })
            if (res.ok) setItems(prev => prev.filter(x => x.id !== l.id))
        } finally { setBusyId(null) }
    }

    const toggleActive = async (l: Logement) => {
        setBusyId(l.id)
        try {
            const res = await fetch('/api/admin/logements', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: l.id, is_active: !l.is_active }),
            })
            if (res.ok) setItems(prev => prev.map(x => x.id === l.id ? { ...x, is_active: !x.is_active } : x))
        } finally { setBusyId(null) }
    }

    const uploadImage = async (file: File) => {
        setUploading(true)
        try {
            const fd = new FormData(); fd.append('file', file)
            const res = await fetch('/api/upload/logement', { method: 'POST', body: fd })
            const j = await res.json().catch(() => ({}))
            if (!res.ok || !j.url) throw new Error(j.error || 'Upload impossible.')
            setEditing(e => e ? { ...e, images: [...(e.images || []), j.url] } : e)
        } catch (e) { alert(e instanceof Error ? e.message : 'Erreur.') } finally { setUploading(false) }
    }

    const set = (patch: Partial<Logement>) => setEditing(e => e ? { ...e, ...patch } : e)

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#E6F3ED] flex items-center justify-center text-[#008751]"><Home size={20} /></div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Catalogue Logements</h1>
                        <p className="text-sm text-slate-500">Programme national · Résidences — 100 % éditable</p>
                    </div>
                </div>
                <button onClick={() => setEditing(blank())} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#008751] hover:bg-[#00643C] text-white font-bold transition-colors shadow-[0_10px_24px_-10px_rgba(0,135,81,0.6)]"><Plus size={17} /> Nouveau logement</button>
            </div>

            {loading ? (
                <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-[#008751]" /></div>
            ) : items.length === 0 ? (
                <div className="text-center py-24 text-slate-400">
                    <Building2 size={40} className="mx-auto mb-3 opacity-40" />
                    <p className="font-semibold text-slate-500">Aucun logement. Ajoutez-en un pour démarrer le catalogue.</p>
                </div>
            ) : (
                <Reorder.Group axis="y" values={items} onReorder={persistOrder} className="space-y-3">
                    {items.map(l => (
                        <Reorder.Item key={l.id} value={l} className="list-none">
                            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-3 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.3)]">
                                <GripVertical className="w-4 h-4 text-slate-300 cursor-grab shrink-0" />
                                <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                    {l.images?.[0]
                                        // eslint-disable-next-line @next/next/no-img-element
                                        ? <img src={l.images[0]} alt="" className="w-full h-full object-cover" />
                                        : <ImageIcon size={20} className="text-slate-300" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-extrabold text-slate-900 truncate">{l.nom || '(sans nom)'}</p>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{l.type}</span>
                                        {!l.is_active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Masqué</span>}
                                    </div>
                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin size={12} /> {[l.ville, l.site].filter(Boolean).join(' · ') || '—'} · {l.surface_m2} m²</p>
                                    <p className="text-xs text-[#008751] font-bold mt-0.5">{fmt(l.prix_comptant, l.devise)}{l.mensualite ? ` · ${fmt(l.mensualite, l.devise)}/mois` : ''}</p>
                                </div>
                                <button onClick={() => toggleActive(l)} disabled={busyId === l.id} title={l.is_active ? 'Masquer' : 'Afficher'} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">{l.is_active ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                                <button onClick={() => setEditing(l)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold">Éditer</button>
                                <button onClick={() => remove(l)} disabled={busyId === l.id} title="Supprimer" className="p-2 rounded-lg text-[#E8112D] hover:bg-[#FDECEA]">{busyId === l.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}</button>
                            </div>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            )}

            {/* Éditeur */}
            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={() => !saving && setEditing(null)}>
                    <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="w-full max-w-3xl max-h-[93vh] overflow-hidden flex flex-col bg-white rounded-3xl border border-slate-200 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="h-1 flex"><span className="flex-[46] bg-[#008751]" /><span className="flex-[27] bg-[#FCD116]" /><span className="flex-[27] bg-[#E8112D]" /></div>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-lg font-black text-slate-900">{editing.id ? 'Modifier le logement' : 'Nouveau logement'}</h3>
                            <button onClick={() => !saving && setEditing(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={18} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Programme"><select value={editing.programme} onChange={e => set({ programme: e.target.value })} className={inp}>{PROGRAMMES.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}</select></Field>
                                <Field label="Type"><select value={editing.type} onChange={e => set({ type: e.target.value })} className={inp}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
                            </div>
                            <Field label="Nom du logement"><input value={editing.nom} onChange={e => set({ nom: e.target.value })} className={inp} placeholder="Ex : Appartement B — Ouèdo" /></Field>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Ville"><input value={editing.ville} onChange={e => set({ ville: e.target.value })} className={inp} placeholder="Ouèdo, Cotonou…" /></Field>
                                <Field label="Site / quartier"><input value={editing.site} onChange={e => set({ site: e.target.value })} className={inp} /></Field>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <Field label="Surface (m²)"><input type="number" value={editing.surface_m2} onChange={e => set({ surface_m2: parseFloat(e.target.value) || 0 })} className={inp} /></Field>
                                <Field label="Chambres"><input type="number" value={editing.chambres} onChange={e => set({ chambres: parseInt(e.target.value) || 0 })} className={inp} /></Field>
                                <Field label="Durée (ans)"><input type="number" value={editing.duree_annees} onChange={e => set({ duree_annees: parseInt(e.target.value) || 0 })} className={inp} /></Field>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <Field label="Prix comptant"><input type="number" value={editing.prix_comptant} onChange={e => set({ prix_comptant: parseFloat(e.target.value) || 0 })} className={inp} /></Field>
                                <Field label="Devise"><select value={editing.devise} onChange={e => set({ devise: e.target.value })} className={inp}><option>XOF</option><option>EUR</option><option>USD</option></select></Field>
                                <Field label="Mensualité (loc-accession)"><input type="number" value={editing.mensualite} onChange={e => set({ mensualite: parseFloat(e.target.value) || 0 })} className={inp} /></Field>
                            </div>
                            <Field label="Formules proposées">
                                <div className="flex gap-2 flex-wrap">
                                    {FORMULES.map(f => {
                                        const on = (editing.formules || []).includes(f.v)
                                        return <button key={f.v} type="button" onClick={() => set({ formules: on ? (editing.formules || []).filter(x => x !== f.v) : [...(editing.formules || []), f.v] })}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${on ? 'bg-[#008751] text-white border-[#008751]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>{on && <Check size={13} className="inline mr-1" />}{f.l}</button>
                                    })}
                                </div>
                            </Field>
                            <Field label="Description"><textarea rows={3} value={editing.description} onChange={e => set({ description: e.target.value })} className={inp + ' resize-none'} /></Field>
                            <Field label="Atouts (séparés par des virgules)"><input value={(editing.atouts || []).join(', ')} onChange={e => set({ atouts: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className={inp} placeholder="Piscine, Sécurité 24/7, Proche école…" /></Field>

                            {/* Images */}
                            <Field label={`Photos (${(editing.images || []).length})`}>
                                <div className="flex gap-2 flex-wrap">
                                    {(editing.images || []).map((url, i) => (
                                        <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                            <button onClick={() => set({ images: (editing.images || []).filter((_, k) => k !== i) })} className="absolute top-0.5 right-0.5 p-1 rounded-md bg-[#E8112D] text-white opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={11} /></button>
                                        </div>
                                    ))}
                                    <label className={`w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-[#008751] hover:text-[#008751] transition-colors ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                                        <span className="text-[9px] font-bold">Ajouter</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.currentTarget.value = '' }} />
                                    </label>
                                </div>
                            </Field>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="URL du plan (optionnel)"><input value={editing.plan_url || ''} onChange={e => set({ plan_url: e.target.value })} className={inp} placeholder="https://…" /></Field>
                                <Field label="Visite virtuelle / vidéo (URL)"><input value={editing.visite_url || ''} onChange={e => set({ visite_url: e.target.value })} className={inp} placeholder="https://…" /></Field>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <Field label="Latitude"><input type="number" step="any" value={editing.lat ?? ''} onChange={e => set({ lat: e.target.value === '' ? null : parseFloat(e.target.value) })} className={inp} /></Field>
                                <Field label="Longitude"><input type="number" step="any" value={editing.lng ?? ''} onChange={e => set({ lng: e.target.value === '' ? null : parseFloat(e.target.value) })} className={inp} /></Field>
                                <Field label="Disponibilité"><select value={editing.disponibilite} onChange={e => set({ disponibilite: e.target.value })} className={inp}>{DISPOS.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}</select></Field>
                            </div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                                <input type="checkbox" checked={!!editing.is_active} onChange={e => set({ is_active: e.target.checked })} className="w-4 h-4 accent-[#008751]" /> Visible sur le site public
                            </label>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setEditing(null)} disabled={saving} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50">Annuler</button>
                            <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl bg-[#008751] hover:bg-[#00643C] text-white text-sm font-black flex items-center gap-2 disabled:opacity-60">
                                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    )
}

const inp = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15'
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>{children}</div>
}
