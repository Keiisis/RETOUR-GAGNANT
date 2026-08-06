'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Calendar, MapPin, CurrencyDollar as DollarSign, Users, Crown, FloppyDisk as Save, ArrowLeft, TextT as Type, TextAlignLeft as AlignLeft, Globe, Tag, Trash as Trash2, Plus, CircleNotch as Loader2 } from '@phosphor-icons/react';
import EventImageUpload from '@/components/events/EventImageUpload'

const CATEGORIES = [
    { value: 'conference', label: 'Conférence' },
    { value: 'gala', label: 'Gala' },
    { value: 'workshop', label: 'Atelier' },
    { value: 'networking', label: 'Networking' },
    { value: 'cultural', label: 'Culturel' },
    { value: 'other', label: 'Autre' },
]

interface EventForm {
    title: string
    description: string
    short_description: string
    location: string
    location_map_url: string
    start_date: string
    end_date: string
    price_standard: number
    price_vip: number
    currency: string
    max_capacity: number
    max_vip_seats: number
    status: string
    cover_image_url: string
    category: string
    is_featured: boolean
}

interface EventImage {
    id: string
    url: string
    alt_text: string
    sort_order: number
}

const inputClass = 'w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#008751]/50 transition-all'
const selectClass = `${inputClass} cursor-pointer appearance-none`

export default function EditEventPage() {
    const { t } = useTranslation();
    const router = useRouter()
    const params = useParams()
    const id = params?.id as string

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [newImageUrl, setNewImageUrl] = useState('')
    const [addingImage, setAddingImage] = useState(false)
    const [images, setImages] = useState<EventImage[]>([])
    const [form, setForm] = useState<EventForm>({
        title: '', description: '', short_description: '',
        location: '', location_map_url: '',
        start_date: '', end_date: '',
        price_standard: 0, price_vip: 0, currency: 'XOF',
        max_capacity: 0, max_vip_seats: 0,
        status: 'draft', cover_image_url: '',
        category: 'conference', is_featured: false,
    })

    useEffect(() => {
        if (!id) return
        fetch(`/api/events/${id}`)
            .then(r => r.json())
            .then(d => {
                if (d.event) {
                    const ev = d.event
                    setForm({
                        title: ev.title || '',
                        description: ev.description || '',
                        short_description: ev.short_description || '',
                        location: ev.location || '',
                        location_map_url: ev.location_map_url || '',
                        start_date: ev.start_date ? ev.start_date.slice(0, 16) : '',
                        end_date: ev.end_date ? ev.end_date.slice(0, 16) : '',
                        price_standard: ev.price_standard || 0,
                        price_vip: ev.price_vip || 0,
                        currency: ev.currency || 'XOF',
                        max_capacity: ev.max_capacity || 0,
                        max_vip_seats: ev.max_vip_seats || 0,
                        status: ev.status || 'draft',
                        cover_image_url: ev.cover_image_url || '',
                        category: ev.category || 'conference',
                        is_featured: ev.is_featured || false,
                    })
                    setImages(ev.event_images || [])
                }
            })
            .catch(() => setError('Impossible de charger l\'événement'))
            .finally(() => setLoading(false))
    }, [id])

    const set = (key: string, val: string | number | boolean) =>
        setForm(f => ({ ...f, [key]: val }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.title || !form.start_date) { setError('Titre et date de début requis'); return }
        setSaving(true); setError(''); setSuccess(false)
        try {
            const res = await fetch(`/api/events/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSuccess(true)
            setTimeout(() => setSuccess(false), 3000)
        } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
        setSaving(false)
    }

    const handleAddImage = async () => {
        if (!newImageUrl) return
        setAddingImage(true)
        try {
            const res = await fetch(`/api/events/${id}/images`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: newImageUrl, alt_text: '', sort_order: images.length }),
            })
            if (res.ok) {
                const d = await res.json()
                setImages(prev => [...prev, d.image])
                setNewImageUrl('')
            }
        } catch { /* */ }
        setAddingImage(false)
    }

    const handleDeleteImage = async (imgId: string) => {
        try {
            await fetch(`/api/events/${id}/images?image_id=${imgId}`, { method: 'DELETE' })
            setImages(prev => prev.filter(img => img.id !== imgId))
        } catch { /* */ }
    }

    const Field = ({ label, icon: Icon, children }: { label: string; icon: typeof Calendar; children: React.ReactNode }) => (
        <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Icon size={11} />{label}
            </label>
            {children}
        </div>
    )

    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-[#008751]" />
        </div>
    )

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => router.push('/admin/evenements')}
                    className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-gray-500 hover:text-white cursor-pointer transition-colors">
                    <ArrowLeft size={16} />
                </button>
                <div>
                    <h1 className="text-xl font-black"><T>Modifier l'événement</T></h1>
                    <p className="text-[11px] text-gray-500 mt-0.5 font-mono truncate max-w-xs">{form.title}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Informations générales */}
                <div className="rounded-2xl border border-white/[0.06] p-6 space-y-5"
                    style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}>
                    <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest"><T>Informations générales</T></h2>

                    <Field label="Titre *" icon={Type}>
                        <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
                            className={inputClass} placeholder={t("Ex: Gala de la Diaspora 2026")} />
                    </Field>

                    <Field label="Description courte" icon={AlignLeft}>
                        <input type="text" value={form.short_description} onChange={e => set('short_description', e.target.value)}
                            className={inputClass} placeholder={t("Résumé en une ligne")} />
                    </Field>

                    <Field label="Description complète" icon={AlignLeft}>
                        <textarea value={form.description} onChange={e => set('description', e.target.value)}
                            rows={6} className={inputClass} placeholder={t("Description détaillée...")} />
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Catégorie" icon={Tag}>
                            <select value={form.category} onChange={e => set('category', e.target.value)} className={selectClass}>
                                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </Field>
                        <Field label="Statut" icon={Calendar}>
                            <select value={form.status} onChange={e => set('status', e.target.value)} className={selectClass}>
                                <option value="draft"><T>Brouillon</T></option>
                                <option value="published"><T>Publié</T></option>
                                <option value="cancelled"><T>Annulé</T></option>
                                <option value="completed"><T>Terminé</T></option>
                            </select>
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Date de début *" icon={Calendar}>
                            <input type="datetime-local" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={inputClass} />
                        </Field>
                        <Field label="Date de fin" icon={Calendar}>
                            <input type="datetime-local" value={form.end_date} onChange={e => set('end_date', e.target.value)} className={inputClass} />
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Lieu" icon={MapPin}>
                            <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
                                className={inputClass} placeholder={t("Ex: Cotonou, Bénin")} />
                        </Field>
                        <Field label="Lien Google Maps" icon={Globe}>
                            <input type="url" value={form.location_map_url} onChange={e => set('location_map_url', e.target.value)}
                                className={inputClass} placeholder="https://maps.google.com/..." />
                        </Field>
                    </div>
                </div>

                {/* Tarification */}
                <div className="rounded-2xl border border-white/[0.06] p-6 space-y-5"
                    style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}>
                    <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest"><T>Tarification & Capacité</T></h2>

                    <div className="grid grid-cols-3 gap-4">
                        <Field label="Prix Standard" icon={DollarSign}>
                            <input type="number" value={form.price_standard} onChange={e => set('price_standard', +e.target.value)}
                                className={inputClass} min={0} />
                        </Field>
                        <Field label="Prix VIP" icon={Crown}>
                            <input type="number" value={form.price_vip} onChange={e => set('price_vip', +e.target.value)}
                                className={inputClass} min={0} />
                        </Field>
                        <Field label="Devise" icon={DollarSign}>
                            <select value={form.currency} onChange={e => set('currency', e.target.value)} className={selectClass}>
                                <option value="XOF"><T>XOF (FCFA)</T></option>
                                <option value="EUR"><T>EUR (€)</T></option>
                                <option value="USD"><T>USD ($)</T></option>
                            </select>
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Capacité max (0 = illimité)" icon={Users}>
                            <input type="number" value={form.max_capacity} onChange={e => set('max_capacity', +e.target.value)}
                                className={inputClass} min={0} />
                        </Field>
                        <Field label="Places VIP max" icon={Crown}>
                            <input type="number" value={form.max_vip_seats} onChange={e => set('max_vip_seats', +e.target.value)}
                                className={inputClass} min={0} />
                        </Field>
                    </div>
                </div>

                {/* Image de couverture */}
                <div className="rounded-2xl border border-white/[0.06] p-6 space-y-5"
                    style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}>
                    <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest"><T>Image de couverture & Options</T></h2>

                    <EventImageUpload
                        label="Image de couverture"
                        value={form.cover_image_url}
                        onChange={url => set('cover_image_url', url)}
                        uploadType="cover"
                        showUrlInput
                        aspectRatio="video"
                    />

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)}
                            className="w-4 h-4 rounded accent-[#FCD116]" />
                        <span className="text-xs font-bold text-gray-400"><T>Mettre cet événement à la une</T></span>
                    </label>
                </div>

                {/* Galerie d'images */}
                <div className="rounded-2xl border border-white/[0.06] p-6 space-y-5"
                    style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}>
                    <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest">Galerie photos ({images.length})</h2>

                    {images.length > 0 && (
                        <div className="grid grid-cols-3 gap-3">
                            {images.map(img => (
                                <div key={img.id} className="relative group rounded-xl overflow-hidden border border-white/[0.06] aspect-video">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={img.url} alt={img.alt_text || ''} className="w-full h-full object-cover" />
                                    <button onClick={() => handleDeleteImage(img.id)}
                                        className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="space-y-3">
                        <EventImageUpload
                            label="Ajouter une photo"
                            value={newImageUrl}
                            onChange={setNewImageUrl}
                            uploadType="gallery"
                            showUrlInput
                            aspectRatio="auto"
                        />
                        {newImageUrl && (
                            <button type="button" onClick={handleAddImage} disabled={addingImage}
                                className="w-full py-2.5 rounded-xl text-xs font-black text-white flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer transition-all"
                                style={{ background: 'linear-gradient(135deg, #008751, #006b40)' }}>
                                {addingImage ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                Ajouter à la galerie
                            </button>
                        )}
                    </div>
                </div>

                {error && <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</p>}
                {success && (
                    <p className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                        Événement mis à jour avec succès.
                    </p>
                )}

                <div className="flex gap-3">
                    <button type="button" onClick={() => router.push('/admin/evenements')}
                        className="flex-1 py-4 rounded-2xl border border-white/[0.08] text-xs font-bold text-gray-400 hover:text-white cursor-pointer transition-all">
                        Annuler
                    </button>
                    <button type="submit" disabled={saving}
                        className="flex-[2] py-4 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:scale-[1.01] cursor-pointer"
                        style={{ background: 'linear-gradient(135deg, #008751, #006b40)', boxShadow: '0 8px 24px rgba(0,135,81,0.3)' }}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </button>
                </div>
            </form>
        </div>
    )
}
