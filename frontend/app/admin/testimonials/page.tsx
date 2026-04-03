'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
    Plus, Trash2, Edit2, User, Star, Quote,
    CheckCircle, Search, Loader2, MessageSquareQuote,
    MapPin, X, Save, Eye, EyeOff, RefreshCw,
    ThumbsUp, ThumbsDown, AlertTriangle, Briefcase,
    Link2
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Testimonial {
    id: string
    created_at: string
    name: string
    text: string
    photo?: string | null
    location?: string | null
    rating?: number | null
    service?: string | null
    approved: boolean
}

interface Toast { id: number; type: 'success' | 'error'; msg: string }

// ─── Toast Component ─────────────────────────────────────────────────────────

function Toasts({ toasts }: { toasts: Toast[] }) {
    return (
        <div className="fixed top-5 right-5 z-[999] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
                {toasts.map(t => (
                    <motion.div key={t.id}
                        initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
                        className={cn('px-4 py-3 rounded-2xl text-sm font-bold shadow-2xl',
                            t.type === 'success' ? 'bg-[#008751] text-white' : 'bg-red-500 text-white')}
                    >
                        {t.msg}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}

// ─── Star Rating Input ────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [hover, setHover] = useState(0)
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button"
                    title={`${n} étoile${n > 1 ? 's' : ''}`}
                    onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
                    onClick={() => onChange(n)}
                    className="p-0.5 transition-transform hover:scale-110"
                >
                    <Star size={18}
                        className={(hover || value) >= n ? 'fill-[#FCD116] text-[#FCD116]' : 'text-gray-700'}
                    />
                </button>
            ))}
        </div>
    )
}

// ─── Edit / Create Modal ──────────────────────────────────────────────────────

interface ModalProps {
    item: Partial<Testimonial> | null
    onClose: () => void
    onSave: (data: Partial<Testimonial>) => Promise<void>
    saving: boolean
}

function TestimonialModal({ item, onClose, onSave, saving }: ModalProps) {
    const isNew = !item?.id
    const [form, setForm] = useState({
        name: item?.name || '',
        text: item?.text || '',
        photo: item?.photo || '',
        location: item?.location || '',
        rating: item?.rating ?? 5,
        service: item?.service || '',
        approved: item?.approved ?? false,
    })

    const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))
    const valid = form.name.trim().length >= 2 && form.text.trim().length >= 10

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    return (
        <AnimatePresence>
            <motion.div
                key="backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                key="modal"
                initial={{ opacity: 0, scale: 0.94, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 20 }}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
            >
                <div
                    className="relative w-full max-w-lg bg-[#0d1220] border border-white/10 rounded-[28px] shadow-2xl pointer-events-auto overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#3b82f6]/20 flex items-center justify-center">
                                <MessageSquareQuote size={15} className="text-[#3b82f6]" />
                            </div>
                            <h3 className="text-white font-black text-[15px]">
                                {isNew ? 'Nouveau témoignage' : 'Modifier le témoignage'}
                            </h3>
                        </div>
                        <button type="button" onClick={onClose} title="Fermer"
                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                            <X size={15} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                        {/* Name + Location */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nom *</label>
                                <input value={form.name} onChange={e => set('name', e.target.value)}
                                    placeholder="Jean-Baptiste K." maxLength={80}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3b82f6]/50 transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <MapPin size={10} /> Localisation
                                </label>
                                <input value={form.location} onChange={e => set('location', e.target.value)}
                                    placeholder="Paris, France" maxLength={80}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3b82f6]/50 transition-all"
                                />
                            </div>
                        </div>

                        {/* Text */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Témoignage *</label>
                            <textarea value={form.text} onChange={e => set('text', e.target.value)}
                                rows={4} maxLength={1000}
                                placeholder="Décrivez votre expérience avec Retour Gagnant..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3b82f6]/50 transition-all resize-none"
                            />
                            <p className="text-[10px] text-gray-600 text-right">{form.text.length}/1000</p>
                        </div>

                        {/* Service + Rating */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Briefcase size={10} /> Service
                                </label>
                                <input value={form.service} onChange={e => set('service', e.target.value)}
                                    placeholder="Nationalité Béninoise" maxLength={80}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3b82f6]/50 transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Note</label>
                                <StarRating value={form.rating} onChange={v => set('rating', v)} />
                            </div>
                        </div>

                        {/* Photo URL */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Link2 size={10} /> URL Photo (optionnel)
                            </label>
                            <div className="flex gap-2 items-center">
                                <input value={form.photo} onChange={e => set('photo', e.target.value)}
                                    placeholder="https://..." type="url"
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3b82f6]/50 transition-all"
                                />
                                {form.photo && (
                                    <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                                        <Image src={form.photo} alt="preview" fill className="object-cover" unoptimized />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Approved toggle */}
                        <div className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                            <div>
                                <p className="text-white font-bold text-sm">Publier immédiatement</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    {form.approved ? 'Visible sur le site public' : 'En attente de modération'}
                                </p>
                            </div>
                            <button type="button" onClick={() => set('approved', !form.approved)}
                                title={form.approved ? 'Dépublier' : 'Publier'}
                                className={cn(
                                    'relative w-12 h-6 rounded-full transition-all duration-300',
                                    form.approved ? 'bg-[#008751]' : 'bg-white/10'
                                )}>
                                <div className={cn(
                                    'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300',
                                    form.approved ? 'left-6' : 'left-0.5'
                                )} />
                            </button>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-white/[0.06] flex gap-3">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all text-sm font-bold">
                            Annuler
                        </button>
                        <button type="button" onClick={() => onSave(form)} disabled={saving || !valid}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#3b82f6] text-white font-bold text-sm hover:bg-blue-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#3b82f6]/20">
                            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                            {isNew ? 'Créer' : 'Enregistrer'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}

// ─── Confirm Delete Dialog ────────────────────────────────────────────────────

function ConfirmDelete({ name, onConfirm, onCancel, loading }: { name: string; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
    return (
        <AnimatePresence>
            <motion.div
                key="del-backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={onCancel}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-[#0d1220] border border-red-500/20 rounded-[22px] p-6 max-w-sm w-full shadow-2xl"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={22} className="text-red-500" />
                    </div>
                    <h3 className="text-white font-black text-center text-base mb-1.5">Supprimer ce témoignage ?</h3>
                    <p className="text-gray-500 text-center text-[13px] mb-6">
                        Le témoignage de <span className="text-white font-bold">{name}</span> sera définitivement supprimé.
                    </p>
                    <div className="flex gap-3">
                        <button type="button" onClick={onCancel}
                            className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-all text-sm font-bold">
                            Annuler
                        </button>
                        <button type="button" onClick={onConfirm} disabled={loading}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all disabled:opacity-40">
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            Supprimer
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminTestimonialsPage() {
    const [items, setItems] = useState<Testimonial[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all')
    const [toasts, setToasts] = useState<Toast[]>([])
    const [editItem, setEditItem] = useState<Partial<Testimonial> | null>(null)
    const [saving, setSaving] = useState(false)
    const [toDeleteId, setToDeleteId] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [toggling, setToggling] = useState<string | null>(null)

    const toDeleteItem = items.find(i => i.id === toDeleteId)

    const toast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        const id = Date.now()
        setToasts(p => [...p, { id, type, msg }])
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
    }, [])

    const fetchAll = useCallback(async () => {
        setLoading(true)
        try {
            const url = statusFilter !== 'all' ? `/api/admin/testimonials?status=${statusFilter}` : '/api/admin/testimonials'
            const res = await fetch(url)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setItems(data.testimonials || [])
        } catch (e) {
            toast(e instanceof Error ? e.message : 'Erreur de chargement', 'error')
        } finally {
            setLoading(false)
        }
    }, [statusFilter, toast])

    useEffect(() => { fetchAll() }, [fetchAll])

    // Save (create or update)
    const handleSave = async (form: Partial<Testimonial>) => {
        setSaving(true)
        try {
            const isNew = !editItem?.id
            const url = isNew ? '/api/admin/testimonials' : `/api/admin/testimonials/${editItem!.id}`
            const method = isNew ? 'POST' : 'PATCH'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            if (isNew) {
                setItems(p => [data.testimonial, ...p])
                toast('Témoignage créé avec succès')
            } else {
                setItems(p => p.map(i => i.id === editItem!.id ? { ...i, ...data.testimonial } : i))
                toast('Témoignage mis à jour')
            }
            setEditItem(null)
        } catch (e) {
            toast(e instanceof Error ? e.message : 'Erreur lors de l\'enregistrement', 'error')
        } finally {
            setSaving(false)
        }
    }

    // Toggle approved
    const handleToggle = async (item: Testimonial) => {
        setToggling(item.id)
        const prev = item.approved
        // Optimistic
        setItems(p => p.map(i => i.id === item.id ? { ...i, approved: !prev } : i))
        try {
            const res = await fetch(`/api/admin/testimonials/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approved: !prev }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setItems(p => p.map(i => i.id === item.id ? { ...i, ...data.testimonial } : i))
            toast(!prev ? '✓ Témoignage approuvé et publié' : 'Témoignage dépublié')
        } catch (e) {
            // Rollback
            setItems(p => p.map(i => i.id === item.id ? { ...i, approved: prev } : i))
            toast(e instanceof Error ? e.message : 'Erreur', 'error')
        } finally {
            setToggling(null)
        }
    }

    // Delete
    const handleDelete = async () => {
        if (!toDeleteId) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/testimonials/${toDeleteId}`, { method: 'DELETE' })
            if (!res.ok) throw new Error((await res.json()).error)
            setItems(p => p.filter(i => i.id !== toDeleteId))
            toast('Témoignage supprimé')
        } catch (e) {
            toast(e instanceof Error ? e.message : 'Erreur de suppression', 'error')
        } finally {
            setDeleting(false)
            setToDeleteId(null)
        }
    }

    const filtered = items.filter(item => {
        const q = searchTerm.toLowerCase()
        return !q || item.name.toLowerCase().includes(q) || item.text.toLowerCase().includes(q) || (item.location || '').toLowerCase().includes(q)
    })

    const countApproved = items.filter(i => i.approved).length
    const countPending = items.filter(i => !i.approved).length

    return (
        <div className="space-y-8">
            <Toasts toasts={toasts} />

            {/* Edit / Create Modal */}
            {editItem !== null && (
                <TestimonialModal
                    item={editItem}
                    onClose={() => setEditItem(null)}
                    onSave={handleSave}
                    saving={saving}
                />
            )}

            {/* Delete Confirm */}
            {toDeleteId && toDeleteItem && (
                <ConfirmDelete
                    name={toDeleteItem.name}
                    onConfirm={handleDelete}
                    onCancel={() => setToDeleteId(null)}
                    loading={deleting}
                />
            )}

            {/* ── HEADER ── */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#3b82f6]">
                        <Quote size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Preuve Sociale & Impact</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white font-heading tracking-tighter">
                        LES <span className="text-[#3b82f6]">VOIX</span> DE LA DIASPORA
                    </h1>
                    <p className="text-gray-500 text-sm">Gérez les témoignages et la réputation de Retour Gagnant.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                    {/* Search */}
                    <div className="relative flex-1 sm:w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                        <input
                            type="search"
                            placeholder="Rechercher..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-[#0a0f18] border-2 border-white/5 rounded-2xl py-3 pl-11 pr-4 text-white focus:outline-none focus:border-[#3b82f6]/40 transition-all text-sm"
                        />
                    </div>
                    {/* Refresh */}
                    <button type="button" onClick={fetchAll} title="Actualiser"
                        className="p-3 rounded-2xl bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {/* New */}
                    <button type="button" onClick={() => setEditItem({})}
                        className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-black font-black text-sm tracking-wider hover:bg-[#FCD116] transition-all shadow-lg active:scale-95">
                        <Plus size={18} /> AJOUTER
                    </button>
                </div>
            </div>

            {/* ── STATS + FILTERS ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Filter pills */}
                <div className="flex bg-[#0a0f18] p-1.5 rounded-2xl border border-white/5 gap-1">
                    {(['all', 'approved', 'pending'] as const).map(s => (
                        <button key={s} type="button" onClick={() => setStatusFilter(s)}
                            className={cn(
                                'px-4 sm:px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                                statusFilter === s ? 'bg-[#3b82f6] text-white shadow-lg' : 'text-gray-500 hover:text-white'
                            )}>
                            {s === 'all' ? `Tous (${items.length})` : s === 'approved' ? `Approuvés (${countApproved})` : `En attente (${countPending})`}
                        </button>
                    ))}
                </div>

                {/* Stats pills */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]" />
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{countApproved} Live</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_#f97316] animate-pulse" />
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{countPending} À modérer</span>
                    </div>
                </div>
            </div>

            {/* ── GRID ── */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32">
                    <Loader2 className="animate-spin text-[#3b82f6] opacity-60 mb-4" size={40} />
                    <p className="text-gray-600 font-bold uppercase tracking-[0.3em] text-[10px]">Chargement...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                        {filtered.map((item, idx) => (
                            <motion.div key={item.id} layout
                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.35, delay: (idx % 9) * 0.04 }}
                            >
                                <div className={cn(
                                    'relative bg-[#0a0f18] border rounded-[2rem] p-6 sm:p-7 overflow-hidden group transition-all duration-500 h-full flex flex-col',
                                    item.approved
                                        ? 'border-white/5 hover:border-[#3b82f6]/30'
                                        : 'border-orange-500/25 hover:border-orange-500/40'
                                )}>
                                    {/* Ambient glow */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#3b82f6]/[0.04] rounded-full blur-[60px] pointer-events-none group-hover:scale-150 transition-transform duration-700" />

                                    {/* Status ribbon */}
                                    {!item.approved && (
                                        <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/25">
                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                            <span className="text-[9px] font-black text-orange-400 uppercase tracking-wider">En attente</span>
                                        </div>
                                    )}
                                    {item.approved && (
                                        <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                            <span className="text-[9px] font-black text-green-400 uppercase tracking-wider">Live</span>
                                        </div>
                                    )}

                                    <div className="relative z-10 flex-1 flex flex-col gap-4">
                                        {/* Avatar + info */}
                                        <div className="flex items-center gap-3.5 pr-20">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#008751] to-[#FCD116] p-[1.5px] shadow-lg flex-shrink-0">
                                                <div className="w-full h-full bg-[#0a0f18] rounded-[14px] flex items-center justify-center overflow-hidden">
                                                    {item.photo
                                                        ? <Image src={item.photo} alt={item.name} fill className="object-cover" unoptimized />
                                                        : <User size={20} className="text-gray-600" />
                                                    }
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-white font-bold text-[15px] leading-tight truncate">{item.name}</h4>
                                                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                                    {item.location && <MapPin size={9} className="text-[#3b82f6] flex-shrink-0" />}
                                                    <span className="truncate">{item.location || 'Diaspora'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Stars */}
                                        <div className="flex gap-0.5">
                                            {[1, 2, 3, 4, 5].map(n => (
                                                <Star key={n} size={11}
                                                    className={(item.rating || 5) >= n ? 'fill-[#FCD116] text-[#FCD116]' : 'text-gray-700'} />
                                            ))}
                                        </div>

                                        {/* Quote */}
                                        <div className="relative">
                                            <Quote size={32} className="absolute -top-1 -left-2 text-white/[0.04] pointer-events-none" />
                                            <p className="text-gray-400 text-[13px] leading-relaxed line-clamp-4 italic">
                                                &ldquo;{item.text}&rdquo;
                                            </p>
                                        </div>

                                        {/* Service badge */}
                                        {item.service && (
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] border border-white/[0.05] rounded-full w-fit">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#FCD116]" />
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{item.service}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions footer */}
                                    <div className="mt-5 pt-4 border-t border-white/[0.05] flex items-center justify-between gap-2">
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => setEditItem(item)}
                                                title="Modifier" className="p-2.5 bg-white/5 text-gray-400 rounded-xl hover:bg-white/10 hover:text-white transition-all">
                                                <Edit2 size={14} />
                                            </button>
                                            <button type="button" onClick={() => setToDeleteId(item.id)}
                                                title="Supprimer" className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleToggle(item)}
                                            disabled={toggling === item.id}
                                            className={cn(
                                                'flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all disabled:opacity-50',
                                                item.approved
                                                    ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                                                    : 'bg-orange-500 text-white hover:bg-green-500 shadow-lg shadow-orange-500/20'
                                            )}
                                        >
                                            {toggling === item.id
                                                ? <Loader2 size={12} className="animate-spin" />
                                                : item.approved
                                                    ? <><Eye size={12} /> Live</>
                                                    : <><ThumbsUp size={12} /> Approuver</>
                                            }
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {filtered.length === 0 && !loading && (
                        <div className="col-span-full py-24 text-center bg-white/[0.02] rounded-3xl border-2 border-dashed border-white/5">
                            <MessageSquareQuote size={40} className="mx-auto text-gray-800 mb-3" />
                            <p className="text-gray-600 font-bold uppercase tracking-widest text-[10px]">
                                Aucun témoignage trouvé
                            </p>
                            {searchTerm && (
                                <button type="button" onClick={() => setSearchTerm('')}
                                    className="mt-3 text-[#3b82f6] text-xs hover:underline">
                                    Réinitialiser la recherche
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
