'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Plus, PencilSimple as Edit, Trash as Trash2, Eye, EyeSlash as EyeOff, FloppyDisk as Save, X, TextT as Type, Globe, ArrowUp, ArrowDown, CircleNotch as Loader2, CheckCircle as CheckCircle2, WarningCircle as AlertCircle } from '@phosphor-icons/react';
import Image from 'next/image'
import EventImageUpload from '@/components/events/EventImageUpload'

interface Sponsor {
    id: string
    name: string
    logo_url: string | null
    website_url: string | null
    sort_order: number
    is_active: boolean
    created_at: string
}

interface SponsorForm {
    name: string
    logo_url: string
    website_url: string
    sort_order: number
    is_active: boolean
}

const EMPTY_FORM: SponsorForm = {
    name: '', logo_url: '', website_url: '', sort_order: 0, is_active: true,
}

const inputClass = 'w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#008751]/50 transition-all'

export default function AdminSponsorsPage() {
    const { t } = useTranslation();
    const [sponsors, setSponsors] = useState<Sponsor[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [showAddForm, setShowAddForm] = useState(false)
    const [form, setForm] = useState<SponsorForm>(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg })
        setTimeout(() => setToast(null), 3000)
    }

    const fetchSponsors = useCallback(() => {
        setLoading(true)
        fetch('/api/sponsors?admin=true')
            .then(r => r.json())
            .then(d => setSponsors(d.sponsors || []))
            .catch(() => showToast('error', 'Impossible de charger les sponsors'))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { fetchSponsors() }, [fetchSponsors])

    const set = (key: keyof SponsorForm, val: string | number | boolean) =>
        setForm(f => ({ ...f, [key]: val }))

    const openEdit = (s: Sponsor) => {
        setEditingId(s.id)
        setShowAddForm(false)
        setForm({
            name: s.name,
            logo_url: s.logo_url || '',
            website_url: s.website_url || '',
            sort_order: s.sort_order,
            is_active: s.is_active,
        })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setShowAddForm(false)
        setForm(EMPTY_FORM)
    }

    const handleSave = async () => {
        if (!form.name.trim()) { showToast('error', 'Nom requis'); return }
        setSaving(true)
        try {
            const isEdit = !!editingId
            const url = isEdit ? `/api/sponsors/${editingId}` : '/api/sponsors'
            const method = isEdit ? 'PUT' : 'POST'
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToast('success', isEdit ? 'Sponsor mis à jour' : 'Sponsor ajouté')
            cancelEdit()
            fetchSponsors()
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Erreur')
        }
        setSaving(false)
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Supprimer "${name}" ?`)) return
        try {
            const res = await fetch(`/api/sponsors/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Erreur suppression')
            showToast('success', 'Sponsor supprimé')
            fetchSponsors()
        } catch {
            showToast('error', 'Erreur lors de la suppression')
        }
    }

    const toggleActive = async (s: Sponsor) => {
        try {
            await fetch(`/api/sponsors/${s.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !s.is_active }),
            })
            fetchSponsors()
        } catch { /* */ }
    }

    const moveOrder = async (s: Sponsor, direction: 'up' | 'down') => {
        const newOrder = direction === 'up'
            ? Math.max(0, s.sort_order - 1)
            : s.sort_order + 1
        await fetch(`/api/sponsors/${s.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sort_order: newOrder }),
        })
        fetchSponsors()
    }

    const formPanel = (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-[#008751]/30 overflow-hidden"
            style={{ background: 'linear-gradient(145deg, rgba(0,135,81,0.05), rgba(255,255,255,0.02))' }}
        >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                <h2 className="text-sm font-black flex items-center gap-2">
                    <Star size={15} className="text-[#FCD116]" />
                    {editingId ? 'Modifier le sponsor' : 'Ajouter un sponsor'}
                </h2>
                <button onClick={cancelEdit}
                    className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white cursor-pointer">
                    <X size={14} />
                </button>
            </div>

            <div className="p-6 space-y-5">
                {/* Logo upload */}
                <EventImageUpload
                    label="Logo"
                    value={form.logo_url}
                    onChange={url => set('logo_url', url)}
                    uploadType="logo"
                    showUrlInput
                    aspectRatio="auto"
                />

                {/* Nom */}
                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Type size={11} /> Nom de la structure *
                    </label>
                    <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                        className={inputClass} placeholder={t("Ex: Gouvernement du Bénin")} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Site web */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Globe size={11} /> Site web
                        </label>
                        <input type="url" value={form.website_url} onChange={e => set('website_url', e.target.value)}
                            className={inputClass} placeholder="https://..." />
                    </div>

                    {/* Ordre */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <ArrowUp size={11} /> Ordre d&apos;affichage
                        </label>
                        <input type="number" value={form.sort_order} onChange={e => set('sort_order', +e.target.value)}
                            className={inputClass} min={0} />
                    </div>
                </div>

                {/* Actif */}
                <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
                        className="w-4 h-4 rounded accent-[#008751]" />
                    <span className="text-xs font-bold text-gray-400"><T>Afficher sur la page d&apos;accueil</T></span>
                </label>

                <button onClick={handleSave} disabled={saving}
                    className="w-full py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer hover:scale-[1.01] transition-all"
                    style={{ background: 'linear-gradient(135deg, #008751, #006b40)', boxShadow: '0 8px 24px rgba(0,135,81,0.3)' }}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saving ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Ajouter'}
                </button>
            </div>
        </motion.div>
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #FCD116, #e6bc00)' }}>
                            <Star size={18} className="text-[#1a2332]" />
                        </div>
                        Sponsors & Partenaires
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Section &quot;Ils nous font confiance&quot; — page d&apos;accueil
                    </p>
                </div>
                {!showAddForm && !editingId && (
                    <button onClick={() => { setShowAddForm(true); setForm(EMPTY_FORM) }}
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black text-[#1a2332] cursor-pointer hover:scale-[1.02] transition-all"
                        style={{ background: 'linear-gradient(135deg, #FCD116, #e6bc00)', boxShadow: '0 8px 24px rgba(252,209,22,0.4)' }}>
                        <Plus size={14} /> Ajouter un sponsor
                    </button>
                )}
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className={`flex items-center gap-2 p-3 rounded-xl text-sm font-bold ${toast.type === 'success'
                            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                            : 'text-red-400 bg-red-500/10 border border-red-500/20'
                        }`}
                    >
                        {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Form panel */}
            <AnimatePresence>
                {(showAddForm || editingId) && formPanel}
            </AnimatePresence>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total', value: sponsors.length, color: 'text-white' },
                    { label: 'Actifs', value: sponsors.filter(s => s.is_active).length, color: 'text-[#008751]' },
                    { label: 'Masqués', value: sponsors.filter(s => !s.is_active).length, color: 'text-gray-500' },
                ].map(s => (
                    <div key={s.label} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-center">
                        <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold mt-0.5">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Table */}
            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />
                    ))}
                </div>
            ) : sponsors.length === 0 ? (
                <div className="text-center py-16">
                    <Star size={40} className="mx-auto text-gray-700 mb-3" />
                    <p className="text-gray-500 font-bold text-sm"><T>Aucun sponsor</T></p>
                    <button onClick={() => setShowAddForm(true)}
                        className="mt-4 text-[#FCD116] text-xs font-bold hover:underline cursor-pointer">
                        + Ajouter le premier sponsor
                    </button>
                </div>
            ) : (
                <div className="rounded-2xl border border-white/[0.06] overflow-hidden"
                    style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/[0.06]">
                                <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider"><T>Logo</T></th>
                                <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider"><T>Nom</T></th>
                                <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider"><T>Site</T></th>
                                <th className="text-center px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider"><T>Ordre</T></th>
                                <th className="text-center px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider"><T>Statut</T></th>
                                <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider"><T>Actions</T></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sponsors.map((s) => (
                                <tr key={s.id} className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${editingId === s.id ? 'bg-[#008751]/5' : ''}`}>
                                    <td className="px-5 py-4">
                                        <div className="w-14 h-10 rounded-lg bg-white/5 border border-white/[0.08] flex items-center justify-center overflow-hidden">
                                            {s.logo_url ? (
                                                <div className="relative w-full h-full">
                                                    <Image src={s.logo_url} alt={s.name} fill className="object-contain p-1" unoptimized />
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-black text-gray-600">
                                                    {s.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className="font-bold text-white text-xs">{s.name}</span>
                                    </td>
                                    <td className="px-5 py-4">
                                        {s.website_url ? (
                                            <a href={s.website_url} target="_blank" rel="noopener noreferrer"
                                                className="text-[11px] text-[#008751] hover:underline truncate max-w-[160px] block">
                                                {s.website_url.replace(/^https?:\/\//, '')}
                                            </a>
                                        ) : (
                                            <span className="text-[11px] text-gray-600">—</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => moveOrder(s, 'up')}
                                                className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/10 cursor-pointer transition-all" title={t("Monter")}>
                                                <ArrowUp size={11} />
                                            </button>
                                            <span className="text-xs font-mono text-gray-500 w-6 text-center">{s.sort_order}</span>
                                            <button onClick={() => moveOrder(s, 'down')}
                                                className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/10 cursor-pointer transition-all" title={t("Descendre")}>
                                                <ArrowDown size={11} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <button onClick={() => toggleActive(s)}
                                            className={`flex items-center gap-1.5 mx-auto px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${s.is_active
                                                ? 'bg-[#008751]/15 text-[#008751] border border-[#008751]/30 hover:bg-[#008751]/25'
                                                : 'bg-gray-700/30 text-gray-500 border border-gray-700/30 hover:bg-gray-700/50'
                                            }`}
                                            title={s.is_active ? 'Masquer' : 'Afficher'}
                                        >
                                            {s.is_active ? <Eye size={10} /> : <EyeOff size={10} />}
                                            {s.is_active ? 'Actif' : 'Masqué'}
                                        </button>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => openEdit(s)}
                                                className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-gray-500 hover:text-[#FCD116] hover:bg-[#FCD116]/10 transition-colors cursor-pointer" title={t("Modifier")}>
                                                <Edit size={13} />
                                            </button>
                                            <button onClick={() => handleDelete(s.id, s.name)}
                                                className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer" title={t("Supprimer")}>
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="text-[10px] text-gray-600 text-center">
                Les sponsors actifs sont affichés en temps réel sur la page d&apos;accueil dans la section défilante.
            </p>
        </div>
    )
}
