'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Calendar, Plus, Edit, Eye, Users, CheckCircle2, XCircle,
    Clock, Crown, Ticket, Search, ChevronDown, ExternalLink,
    Save, ArrowLeft, Type, AlignLeft, MapPin, DollarSign,
    Tag, Loader2, QrCode, ShieldCheck, AlertTriangle,
    X,
} from 'lucide-react'
import Link from 'next/link'
import EventImageUpload from '@/components/events/EventImageUpload'

interface EventData {
    id: string
    title: string
    slug: string
    status: string
    start_date: string
    location: string
    category: string
    price_standard: number
    price_vip: number
    currency: string
    max_capacity: number
    is_featured: boolean
    cover_image_url: string
}

interface RegistrationData {
    id: string
    full_name: string
    email: string
    phone: string
    ticket_type: string
    payment_status: string
    amount_paid: number
    currency: string
    created_at: string
    event_tickets: { id: string; ticket_code: string; is_used: boolean; used_at: string; ticket_type: string }[]
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    draft: { label: 'Brouillon', color: '#71717a', icon: Clock },
    published: { label: 'Publié', color: '#008751', icon: CheckCircle2 },
    cancelled: { label: 'Annulé', color: '#E8112D', icon: XCircle },
    completed: { label: 'Terminé', color: '#FCD116', icon: CheckCircle2 },
}

const CATEGORIES = [
    { value: 'conference', label: 'Conférence' },
    { value: 'gala', label: 'Gala' },
    { value: 'workshop', label: 'Atelier' },
    { value: 'networking', label: 'Networking' },
    { value: 'cultural', label: 'Culturel' },
    { value: 'other', label: 'Autre' },
]

const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const formatPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

const inputClass = 'w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#008751]/50 transition-all'
const selectClass = `${inputClass} cursor-pointer appearance-none`

// ─── CREATE/EDIT FORM ─────────────────────────────────────────────────────────
function EventForm({
    initial, onSave, onCancel,
}: {
    initial?: Partial<EventData>
    onSave: () => void
    onCancel: () => void
}) {
    const isEdit = !!initial?.id
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [form, setForm] = useState({
        title: initial?.title || '',
        short_description: '',
        description: '',
        location: initial?.location || '',
        location_map_url: '',
        start_date: initial?.start_date ? initial.start_date.slice(0, 16) : '',
        end_date: '',
        price_standard: initial?.price_standard || 0,
        price_vip: initial?.price_vip || 0,
        currency: initial?.currency || 'XOF',
        max_capacity: initial?.max_capacity || 0,
        max_vip_seats: 0,
        status: initial?.status || 'draft',
        cover_image_url: initial?.cover_image_url || '',
        category: initial?.category || 'conference',
        is_featured: initial?.is_featured || false,
    })

    useEffect(() => {
        if (isEdit && initial?.id) {
            fetch(`/api/events/${initial.id}`)
                .then(r => r.json())
                .then(d => {
                    if (d.event) {
                        const ev = d.event
                        setForm(f => ({
                            ...f,
                            short_description: ev.short_description || '',
                            description: ev.description || '',
                            location_map_url: ev.location_map_url || '',
                            end_date: ev.end_date ? ev.end_date.slice(0, 16) : '',
                            max_vip_seats: ev.max_vip_seats || 0,
                        }))
                    }
                })
        }
    }, [isEdit, initial?.id])

    const set = (key: string, val: string | number | boolean) =>
        setForm(f => ({ ...f, [key]: val }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.title || !form.start_date) { setError('Titre et date requis'); return }
        setSaving(true); setError('')
        try {
            const url = isEdit ? `/api/events/${initial?.id}` : '/api/events'
            const method = isEdit ? 'PUT' : 'POST'
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            onSave()
        } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
        setSaving(false)
    }

    const Field = ({ label, icon: Icon, children }: { label: string; icon: typeof Calendar; children: React.ReactNode }) => (
        <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Icon size={11} />{label}
            </label>
            {children}
        </div>
    )

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-[#008751]/30 overflow-hidden"
            style={{ background: 'linear-gradient(145deg, rgba(0,135,81,0.05), rgba(255,255,255,0.02))' }}
        >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                <h2 className="text-sm font-black flex items-center gap-2">
                    <Calendar size={16} className="text-[#008751]" />
                    {isEdit ? 'Modifier l\'événement' : 'Créer un événement'}
                </h2>
                <button onClick={onCancel} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white cursor-pointer">
                    <X size={16} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <Field label="Titre *" icon={Type}>
                    <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
                        className={inputClass} placeholder="Ex: Gala de la Diaspora 2026" />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Description courte" icon={AlignLeft}>
                        <input type="text" value={form.short_description} onChange={e => set('short_description', e.target.value)}
                            className={inputClass} placeholder="Résumé en une ligne" />
                    </Field>
                    <Field label="Lieu" icon={MapPin}>
                        <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
                            className={inputClass} placeholder="Ex: Cotonou, Bénin" />
                    </Field>
                </div>

                <Field label="Description complète" icon={AlignLeft}>
                    <textarea value={form.description} onChange={e => set('description', e.target.value)}
                        rows={4} className={inputClass} placeholder="Description détaillée de l'événement..." />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Date de début *" icon={Calendar}>
                        <input type="datetime-local" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Date de fin" icon={Calendar}>
                        <input type="datetime-local" value={form.end_date} onChange={e => set('end_date', e.target.value)} className={inputClass} />
                    </Field>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <Field label="Prix Standard" icon={DollarSign}>
                        <input type="number" value={form.price_standard} onChange={e => set('price_standard', +e.target.value)} className={inputClass} min={0} />
                    </Field>
                    <Field label="Prix VIP" icon={Crown}>
                        <input type="number" value={form.price_vip} onChange={e => set('price_vip', +e.target.value)} className={inputClass} min={0} />
                    </Field>
                    <Field label="Devise" icon={DollarSign}>
                        <select value={form.currency} onChange={e => set('currency', e.target.value)} className={selectClass}>
                            <option value="XOF">XOF</option>
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                        </select>
                    </Field>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <Field label="Catégorie" icon={Tag}>
                        <select value={form.category} onChange={e => set('category', e.target.value)} className={selectClass}>
                            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Statut" icon={Calendar}>
                        <select value={form.status} onChange={e => set('status', e.target.value)} className={selectClass}>
                            <option value="draft">Brouillon</option>
                            <option value="published">Publié</option>
                            <option value="cancelled">Annulé</option>
                            <option value="completed">Terminé</option>
                        </select>
                    </Field>
                    <Field label="Capacité max" icon={Users}>
                        <input type="number" value={form.max_capacity} onChange={e => set('max_capacity', +e.target.value)} className={inputClass} min={0} />
                    </Field>
                </div>

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
                    <span className="text-xs font-bold text-gray-400">Mettre à la une</span>
                </label>

                {error && <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-xl">{error}</p>}

                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={onCancel}
                        className="flex-1 py-3 rounded-2xl border border-white/[0.08] text-xs font-bold text-gray-400 hover:text-white cursor-pointer transition-all">
                        Annuler
                    </button>
                    <button type="submit" disabled={saving}
                        className="flex-[2] py-3 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer hover:scale-[1.01] transition-all"
                        style={{ background: 'linear-gradient(135deg, #008751, #006b40)', boxShadow: '0 8px 24px rgba(0,135,81,0.3)' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer l\'événement'}
                    </button>
                </div>
            </form>
        </motion.div>
    )
}

// ─── REGISTRATIONS PANEL ────────────────────────────────────────────────────
function RegistrationsPanel({ eventId, eventTitle, onClose }: { eventId: string; eventTitle: string; onClose: () => void }) {
    const [regs, setRegs] = useState<RegistrationData[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [manualCode, setManualCode] = useState('')
    const [scanResult, setScanResult] = useState<{ status: 'success' | 'error' | 'loading'; message: string } | null>(null)

    const fetchRegs = useCallback(() => {
        fetch(`/api/events/${eventId}/register?admin=true`)
            .then(r => r.json())
            .then(d => setRegs(d.registrations || []))
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [eventId])

    useEffect(() => { fetchRegs() }, [fetchRegs])

    const validateTicket = async (code: string) => {
        setScanResult({ status: 'loading', message: 'Validation...' })
        const res = await fetch(`/api/events/${eventId}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket_code: code, validated_by: 'Agent' }),
        })
        const data = await res.json()
        setScanResult({ status: data.valid ? 'success' : 'error', message: data.message || data.error })
        if (data.valid) fetchRegs()
    }

    const filtered = regs.filter(r => !search ||
        r.full_name.toLowerCase().includes(search.toLowerCase()) ||
        r.email.toLowerCase().includes(search.toLowerCase()) ||
        r.event_tickets?.[0]?.ticket_code?.includes(search.toUpperCase())
    )

    const totalRevenu = regs.reduce((s, r) => s + (r.amount_paid || 0), 0)

    return (
        <motion.div
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl border border-white/[0.08] overflow-hidden"
            style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}
        >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                <div>
                    <h2 className="text-sm font-black flex items-center gap-2"><Users size={16} className="text-[#008751]" /> Inscrits</h2>
                    <p className="text-[10px] text-gray-600 mt-0.5 truncate max-w-xs">{eventTitle}</p>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white cursor-pointer">
                    <X size={16} />
                </button>
            </div>

            <div className="p-5 space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                        <div className="text-xl font-black">{regs.length}</div>
                        <div className="text-[9px] text-gray-500 uppercase font-bold">Inscrits</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                        <div className="text-xl font-black text-[#FCD116]">{regs.filter(r => r.ticket_type === 'vip').length}</div>
                        <div className="text-[9px] text-[#FCD116] uppercase font-bold">VIP</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                        <div className="text-xl font-black text-[#008751]">{formatPrice(totalRevenu)}</div>
                        <div className="text-[9px] text-gray-500 uppercase font-bold">FCFA</div>
                    </div>
                </div>

                {/* Validation manuelle */}
                <div className="rounded-xl border border-[#FCD116]/20 bg-[#FCD116]/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-[#FCD116]" />
                        <span className="text-[11px] font-black text-[#FCD116] uppercase tracking-wider">Valider un ticket</span>
                    </div>
                    <div className="flex gap-2">
                        <input type="text" value={manualCode} onChange={e => setManualCode(e.target.value.toUpperCase())}
                            placeholder="RGB-XXXX-YYYYYYYY"
                            className="flex-1 px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-sm focus:border-[#FCD116] outline-none" />
                        <button onClick={() => validateTicket(manualCode)} disabled={!manualCode}
                            className="px-4 rounded-xl bg-[#FCD116] text-black text-xs font-black disabled:opacity-50 cursor-pointer">
                            Valider
                        </button>
                    </div>
                    {scanResult && (
                        <div className={`flex items-center gap-2 text-xs font-bold p-2.5 rounded-lg ${
                            scanResult.status === 'success' ? 'text-emerald-400 bg-emerald-500/10' :
                            scanResult.status === 'loading' ? 'text-gray-400 bg-white/5' :
                            'text-red-400 bg-red-500/10'
                        }`}>
                            {scanResult.status === 'success' ? <CheckCircle2 size={13} /> :
                             scanResult.status === 'loading' ? <Loader2 size={13} className="animate-spin" /> :
                             <AlertTriangle size={13} />}
                            {scanResult.message}
                        </div>
                    )}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Nom, email, code ticket..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#008751]/50" />
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#008751]" /></div>
                ) : filtered.length === 0 ? (
                    <p className="text-center text-gray-500 text-sm py-8">Aucun inscrit</p>
                ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {filtered.map(r => {
                            const ticket = r.event_tickets?.[0]
                            return (
                                <div key={r.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-white truncate">{r.full_name}</span>
                                            {r.ticket_type === 'vip' && <Crown size={10} className="text-[#FCD116] flex-shrink-0" />}
                                        </div>
                                        <div className="text-[10px] text-gray-500 truncate">{r.email}</div>
                                        {ticket && (
                                            <div className="font-mono text-[9px] text-gray-600 mt-1 truncate">{ticket.ticket_code}</div>
                                        )}
                                    </div>
                                    <div className="flex-shrink-0">
                                        {ticket ? (
                                            ticket.is_used ? (
                                                <span className="text-[9px] font-bold text-[#008751] bg-[#008751]/10 px-2 py-1 rounded-full">Validé</span>
                                            ) : (
                                                <button onClick={() => validateTicket(ticket.ticket_code)}
                                                    className="text-[9px] font-bold text-[#FCD116] bg-[#FCD116]/10 px-2 py-1 rounded-full border border-[#FCD116]/30 hover:bg-[#FCD116] hover:text-black transition-all cursor-pointer">
                                                    Valider
                                                </button>
                                            )
                                        ) : (
                                            <span className="text-[9px] text-gray-600">—</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </motion.div>
    )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AgentEventsPage() {
    const [events, setEvents] = useState<EventData[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editingEvent, setEditingEvent] = useState<EventData | null>(null)
    const [viewingRegs, setViewingRegs] = useState<EventData | null>(null)

    const fetchEvents = useCallback(() => {
        setLoading(true)
        fetch('/api/events?admin=true')
            .then(r => r.json())
            .then(d => setEvents(d.events || []))
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { fetchEvents() }, [fetchEvents])

    const handleStatusChange = async (id: string, status: string) => {
        await fetch(`/api/events/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        })
        fetchEvents()
    }

    const filtered = events.filter(e => !search || e.title.toLowerCase().includes(search.toLowerCase()))
    const published = events.filter(e => e.status === 'published').length
    const upcoming = events.filter(e => new Date(e.start_date) > new Date()).length

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #008751, #006b40)' }}>
                            <Calendar size={18} className="text-white" />
                        </div>
                        Événements
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {events.length} événement{events.length > 1 ? 's' : ''} • {published} publié{published > 1 ? 's' : ''} • {upcoming} à venir
                    </p>
                </div>
                {!showForm && !editingEvent && (
                    <button onClick={() => { setShowForm(true); setViewingRegs(null) }}
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black text-white cursor-pointer hover:scale-[1.02] transition-all"
                        style={{ background: 'linear-gradient(135deg, #008751, #006b40)', boxShadow: '0 8px 24px rgba(0,135,81,0.3)' }}>
                        <Plus size={14} /> Créer un événement
                    </button>
                )}
            </div>

            {/* Stats rapides */}
            {!showForm && !editingEvent && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total', value: events.length, color: 'text-white' },
                        { label: 'Publiés', value: published, color: 'text-[#008751]' },
                        { label: 'À venir', value: upcoming, color: 'text-[#FCD116]' },
                        { label: 'Terminés', value: events.filter(e => e.status === 'completed').length, color: 'text-gray-400' },
                    ].map(s => (
                        <div key={s.label} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                            <div className="text-[10px] text-gray-500 uppercase font-bold mt-0.5">{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form panel */}
            <AnimatePresence mode="wait">
                {(showForm || editingEvent) && (
                    <EventForm
                        initial={editingEvent || undefined}
                        onSave={() => { setShowForm(false); setEditingEvent(null); fetchEvents() }}
                        onCancel={() => { setShowForm(false); setEditingEvent(null) }}
                    />
                )}
            </AnimatePresence>

            {/* Registrations panel */}
            <AnimatePresence>
                {viewingRegs && (
                    <RegistrationsPanel
                        eventId={viewingRegs.id}
                        eventTitle={viewingRegs.title}
                        onClose={() => setViewingRegs(null)}
                    />
                )}
            </AnimatePresence>

            {/* Search */}
            {!showForm && !editingEvent && (
                <div className="relative max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#008751]/50" />
                </div>
            )}

            {/* Table */}
            {!showForm && !editingEvent && (
                loading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <Calendar size={40} className="mx-auto text-gray-700 mb-3" />
                        <p className="text-gray-500 font-bold text-sm">Aucun événement</p>
                        <button onClick={() => setShowForm(true)}
                            className="mt-4 text-[#008751] text-xs font-bold hover:underline cursor-pointer">
                            + Créer le premier événement
                        </button>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-white/[0.06] overflow-hidden"
                        style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/[0.06]">
                                        <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider">Événement</th>
                                        <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider">Date</th>
                                        <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider">Prix</th>
                                        <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider">Statut</th>
                                        <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(evt => {
                                        const st = STATUS_MAP[evt.status] || STATUS_MAP.draft
                                        const StIcon = st.icon
                                        return (
                                            <tr key={evt.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-[#008751]/10 flex items-center justify-center flex-shrink-0">
                                                            <Calendar size={16} className="text-[#008751]" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white text-xs">{evt.title}</div>
                                                            <div className="text-[10px] text-gray-600">{evt.location || '—'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-xs text-gray-400">{formatDate(evt.start_date)}</td>
                                                <td className="px-5 py-4">
                                                    <div className="text-xs font-bold text-[#FCD116]">{formatPrice(evt.price_standard)} <span className="text-gray-600">{evt.currency}</span></div>
                                                    {evt.price_vip > 0 && <div className="text-[10px] text-gray-600 flex items-center gap-1"><Crown size={9} className="text-[#FCD116]" /> VIP: {formatPrice(evt.price_vip)}</div>}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="relative inline-block">
                                                        <select value={evt.status} onChange={e => handleStatusChange(evt.id, e.target.value)}
                                                            className="appearance-none px-3 py-1.5 pr-7 rounded-full text-[10px] font-bold border cursor-pointer"
                                                            style={{ background: `${st.color}15`, borderColor: `${st.color}30`, color: st.color }}>
                                                            <option value="draft">Brouillon</option>
                                                            <option value="published">Publié</option>
                                                            <option value="cancelled">Annulé</option>
                                                            <option value="completed">Terminé</option>
                                                        </select>
                                                        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: st.color }} />
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Link href={`/evenements/${evt.slug}`} target="_blank"
                                                            className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-gray-500 hover:text-[#008751] hover:bg-[#008751]/10 transition-colors" title="Voir">
                                                            <ExternalLink size={13} />
                                                        </Link>
                                                        <button onClick={() => { setEditingEvent(evt); setShowForm(false); setViewingRegs(null) }}
                                                            className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-gray-500 hover:text-[#FCD116] hover:bg-[#FCD116]/10 transition-colors cursor-pointer" title="Modifier">
                                                            <Edit size={13} />
                                                        </button>
                                                        <button onClick={() => { setViewingRegs(evt); setShowForm(false); setEditingEvent(null) }}
                                                            className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer" title="Inscrits">
                                                            <Users size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}
        </div>
    )
}
