'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Pencil, Trash2, Save, X, Loader2, Star } from 'lucide-react'

interface PartnerRow {
    id: string
    name: string
    description: string
    category: string
    location: string
    is_premium: boolean
    is_active: boolean
    logo: string
    cover_image: string
    website: string
    phone: string
    email: string
    sort_order: number
    products: { id: string; name: string; price: number }[]
}

const CATEGORIES = ['Immobilier', 'Agro-Business', 'Art & Culture', 'Services & Tech', 'Mode & Beauté', 'Autre']

export default function AdminPartenaires() {
    const [partners, setPartners] = useState<PartnerRow[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<string | null>(null)
    const [form, setForm] = useState<Partial<PartnerRow>>({})
    const [saving, setSaving] = useState(false)

    const fetchPartners = async () => {
        const { data } = await supabase.from('partners').select('*').order('sort_order')
        if (data) setPartners(data)
        setLoading(false)
    }

    useEffect(() => {
        const init = async () => { await fetchPartners() }
        init()
    }, [])

    const startEdit = (p: PartnerRow) => {
        setEditing(p.id)
        setForm({ ...p })
    }

    const startNew = () => {
        setEditing('new')
        setForm({ name: '', description: '', category: 'Immobilier', location: '', is_premium: false, is_active: true, logo: '', cover_image: '', website: '', phone: '', email: '', sort_order: 0, products: [] })
    }

    const handleSave = async () => {
        setSaving(true)
        const partnerData = { ...form }
        delete partnerData.id

        if (editing === 'new') {
            await supabase.from('partners').insert([partnerData])
        } else {
            await supabase.from('partners').update(partnerData).eq('id', editing)
        }
        setEditing(null)
        setForm({})
        await fetchPartners()
        setSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer ce partenaire ?')) return
        await supabase.from('partners').delete().eq('id', id)
        await fetchPartners()
    }

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Partenaires</h1>
                    <p className="text-gray-400 text-sm">{partners.length} partenaire(s) enregistré(s)</p>
                </div>
                <Button onClick={startNew} className="bg-[#008751] hover:bg-[#006e42]">
                    <Plus className="w-4 h-4 mr-2" /> Ajouter
                </Button>
            </div>

            {editing && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                    <h2 className="text-lg font-bold text-white">{editing === 'new' ? 'Nouveau partenaire' : 'Modifier'}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">Nom *</label>
                            <Input title="Nom du partenaire" placeholder="Nom" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-white/5 border-white/10 text-white" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">Catégorie</label>
                            <select title="Catégorie du partenaire" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full rounded-md bg-white/5 border border-white/10 text-white px-3 py-2 text-sm">
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">Localisation</label>
                            <Input title="Localisation" placeholder="Ville, Pays" value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} className="bg-white/5 border-white/10 text-white" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">Site web</label>
                            <Input title="Site web" placeholder="https://..." value={form.website || ''} onChange={e => setForm({ ...form, website: e.target.value })} className="bg-white/5 border-white/10 text-white" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">Téléphone</label>
                            <Input title="Téléphone" placeholder="+229..." value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-white/5 border-white/10 text-white" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">Email</label>
                            <Input title="Email" placeholder="contact@..." value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-white/5 border-white/10 text-white" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs text-gray-400 mb-1 block">Description</label>
                            <textarea title="Description" placeholder="Description du partenaire..." value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-md bg-white/5 border border-white/10 text-white px-3 py-2 text-sm" />
                        </div>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                <input type="checkbox" checked={form.is_premium || false} onChange={e => setForm({ ...form, is_premium: e.target.checked })} className="rounded" />
                                <Star className="w-4 h-4 text-[#FCD116]" /> Premium
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                                Actif
                            </label>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button onClick={handleSave} disabled={saving} className="bg-[#008751]">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Enregistrer
                        </Button>
                        <Button variant="outline" onClick={() => { setEditing(null); setForm({}) }} className="border-white/10 text-gray-300">
                            <X className="w-4 h-4 mr-2" /> Annuler
                        </Button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {partners.map(p => (
                    <div key={p.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:border-white/20 transition-colors">
                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                <h3 className="font-bold text-white">{p.name}</h3>
                                {p.is_premium && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FCD116]/20 text-[#FCD116] font-bold">PREMIUM</span>}
                                {!p.is_active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">INACTIF</span>}
                            </div>
                            <p className="text-sm text-gray-400 mt-1">{p.category} • {p.location}</p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{p.description}</p>
                        </div>
                        <div className="flex gap-2 ml-4">
                            <Button size="sm" variant="outline" onClick={() => startEdit(p)} className="border-white/10 text-gray-300 hover:text-white">
                                <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(p.id)} className="border-red-500/20 text-red-400 hover:bg-red-500/10">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
