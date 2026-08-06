'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, MapPin, CurrencyDollar as DollarSign, Users, Crown, FloppyDisk as Save, ArrowLeft, TextT as Type, TextAlignLeft as AlignLeft, Globe, Tag } from '@phosphor-icons/react';
import EventImageUpload from '@/components/events/EventImageUpload'

const CATEGORIES = [
    { value: 'conference', label: 'Conférence' },
    { value: 'gala', label: 'Gala' },
    { value: 'workshop', label: 'Atelier' },
    { value: 'networking', label: 'Networking' },
    { value: 'cultural', label: 'Culturel' },
    { value: 'other', label: 'Autre' },
]

export default function CreateEventPage() {
    const { t } = useTranslation();
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [form, setForm] = useState({
        title: '', description: '', short_description: '',
        location: '', location_map_url: '',
        start_date: '', end_date: '',
        price_standard: 0, price_vip: 0, currency: 'XOF',
        max_capacity: 0, max_vip_seats: 0,
        status: 'draft', cover_image_url: '',
        category: 'conference', is_featured: false,
    })

    const set = (key: string, val: string | number | boolean) => setForm(f => ({ ...f, [key]: val }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.title || !form.start_date) { setError('Titre et date de début requis'); return }
        setSaving(true); setError('')
        try {
            const res = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            router.push('/admin/evenements')
        } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
        setSaving(false)
    }

    const Field = ({ label, icon: Icon, children }: { label: string; icon: typeof Calendar; children: React.ReactNode }) => (
        <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Icon size={11} />{label}</label>
            {children}
        </div>
    )

    const inputClass = 'w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#008751]/50 transition-all'
    const selectClass = `${inputClass} cursor-pointer appearance-none`

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => router.push('/admin/evenements')} className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-gray-500 hover:text-white cursor-pointer">
                    <ArrowLeft size={16} />
                </button>
                <h1 className="text-xl font-black"><T>Créer un événement</T></h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="rounded-2xl border border-white/[0.06] p-6 space-y-5"
                    style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}>
                    <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest"><T>Informations générales</T></h2>

                    <Field label="Titre de l'événement *" icon={Type}>
                        <input type="text" value={form.title} onChange={e => set('title', e.target.value)} className={inputClass} placeholder={t("Ex: Gala de la Diaspora 2026")} />
                    </Field>

                    <Field label="Description courte" icon={AlignLeft}>
                        <input type="text" value={form.short_description} onChange={e => set('short_description', e.target.value)} className={inputClass} placeholder={t("Résumé en une ligne")} />
                    </Field>

                    <Field label="Description complète" icon={AlignLeft}>
                        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={5} className={inputClass} placeholder={t("Description détaillée de l'événement...")} />
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
                            <input type="text" value={form.location} onChange={e => set('location', e.target.value)} className={inputClass} placeholder={t("Ex: Cotonou, Bénin")} />
                        </Field>
                        <Field label="Lien Google Maps" icon={Globe}>
                            <input type="url" value={form.location_map_url} onChange={e => set('location_map_url', e.target.value)} className={inputClass} placeholder="https://maps.google.com/..." />
                        </Field>
                    </div>
                </div>

                <div className="rounded-2xl border border-white/[0.06] p-6 space-y-5"
                    style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}>
                    <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest"><T>Tarification & Capacité</T></h2>

                    <div className="grid grid-cols-3 gap-4">
                        <Field label="Prix Standard" icon={DollarSign}>
                            <input type="number" value={form.price_standard} onChange={e => set('price_standard', +e.target.value)} className={inputClass} min={0} />
                        </Field>
                        <Field label="Prix VIP" icon={Crown}>
                            <input type="number" value={form.price_vip} onChange={e => set('price_vip', +e.target.value)} className={inputClass} min={0} />
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
                            <input type="number" value={form.max_capacity} onChange={e => set('max_capacity', +e.target.value)} className={inputClass} min={0} />
                        </Field>
                        <Field label="Places VIP max" icon={Crown}>
                            <input type="number" value={form.max_vip_seats} onChange={e => set('max_vip_seats', +e.target.value)} className={inputClass} min={0} />
                        </Field>
                    </div>
                </div>

                <div className="rounded-2xl border border-white/[0.06] p-6 space-y-5"
                    style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}>
                    <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest"><T>Image & Options</T></h2>

                    <EventImageUpload
                        label="Image de couverture"
                        value={form.cover_image_url}
                        onChange={url => set('cover_image_url', url)}
                        uploadType="cover"
                        showUrlInput
                        aspectRatio="video"
                    />

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} className="w-4 h-4 rounded accent-[#FCD116]" />
                        <span className="text-xs font-bold text-gray-400"><T>Mettre cet événement à la une</T></span>
                    </label>
                </div>

                {error && <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-xl">{error}</p>}

                <button type="submit" disabled={saving}
                    className="w-full py-4 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:scale-[1.01] cursor-pointer"
                    style={{ background: 'linear-gradient(135deg, #008751, #006b40)', boxShadow: '0 8px 24px rgba(0,135,81,0.3)' }}>
                    <Save size={16} />
                    {saving ? 'Enregistrement...' : 'Créer l\'événement'}
                </button>
            </form>
        </div>
    )
}
