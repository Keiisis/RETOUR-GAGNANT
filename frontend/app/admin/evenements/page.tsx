'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Calendar, Plus, Trash as Trash2, PencilSimple as Edit, Users, CheckCircle as CheckCircle2, XCircle, Clock, Crown, MagnifyingGlass as Search, CaretDown as ChevronDown, ArrowSquareOut as ExternalLink } from '@phosphor-icons/react';

interface EventData {
    id: string; title: string; slug: string; status: string
    start_date: string; location: string; category: string
    price_standard: number; price_vip: number; currency: string
    max_capacity: number; is_featured: boolean; cover_image_url: string
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    draft: { label: 'Brouillon', color: '#71717a', icon: Clock },
    published: { label: 'Publié', color: '#008751', icon: CheckCircle2 },
    cancelled: { label: 'Annulé', color: '#E8112D', icon: XCircle },
    completed: { label: 'Terminé', color: '#FCD116', icon: CheckCircle2 },
}

const formatDate = (d: string) => {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
const formatPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

export default function AdminEventsPage() {
    const { t } = useTranslation();
    const [events, setEvents] = useState<EventData[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [deleting, setDeleting] = useState<string | null>(null)

    const fetchEvents = useCallback(() => {
        if (!loading) setLoading(true)
        fetch('/api/events?admin=true')
            .then(r => r.json())
            .then(d => setEvents(d.events || []))
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [loading])

    useEffect(() => { fetchEvents() }, [fetchEvents])

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer cet événement ?')) return
        setDeleting(id)
        try {
            await fetch(`/api/events/${id}`, { method: 'DELETE' })
            fetchEvents()
        } catch { /* */ }
        setDeleting(null)
    }

    const handleStatusChange = async (id: string, status: string) => {
        await fetch(`/api/events/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        })
        fetchEvents()
    }

    const filtered = events.filter(e => !search || e.title.toLowerCase().includes(search.toLowerCase()))

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
                    <p className="text-sm text-gray-500 mt-1">{events.length} événement{events.length > 1 ? 's' : ''}</p>
                </div>
                <Link href="/admin/evenements/create"
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black text-white transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, #008751, #006b40)', boxShadow: '0 8px 24px rgba(0,135,81,0.3)' }}>
                    <Plus size={14} /> Créer un événement
                </Link>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Rechercher...")}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#008751]/50" />
            </div>

            {/* Table */}
            {loading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                    <Calendar size={40} className="mx-auto text-gray-700 mb-3" />
                    <p className="text-gray-500 font-bold text-sm"><T>Aucun événement</T></p>
                </div>
            ) : (
                <div className="rounded-2xl border border-white/[0.06] overflow-hidden"
                    style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/[0.06]">
                                    <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider"><T>Événement</T></th>
                                    <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider"><T>Date</T></th>
                                    <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider"><T>Prix</T></th>
                                    <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider"><T>Statut</T></th>
                                    <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider"><T>Actions</T></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(evt => {
                                    const st = STATUS_MAP[evt.status] || STATUS_MAP.draft
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
                                                    <select
                                                        value={evt.status}
                                                        onChange={e => handleStatusChange(evt.id, e.target.value)}
                                                        className="appearance-none px-3 py-1.5 pr-7 rounded-full text-[10px] font-bold border cursor-pointer"
                                                        style={{ background: `${st.color}15`, borderColor: `${st.color}30`, color: st.color }}
                                                        aria-label="Changer le statut"
                                                    >
                                                        <option value="draft"><T>Brouillon</T></option>
                                                        <option value="published"><T>Publié</T></option>
                                                        <option value="cancelled"><T>Annulé</T></option>
                                                        <option value="completed"><T>Terminé</T></option>
                                                    </select>
                                                    <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: st.color }} />
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Link href={`/evenements/${evt.slug}`}
                                                        className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-gray-500 hover:text-[#008751] hover:bg-[#008751]/10 transition-colors" title={t("Voir")} aria-label={t("Voir l'événement en ligne")}>
                                                        <ExternalLink size={13} />
                                                    </Link>
                                                    <Link href={`/admin/evenements/edit/${evt.id}`}
                                                        className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-gray-500 hover:text-[#FCD116] hover:bg-[#FCD116]/10 transition-colors" title={t("Modifier")} aria-label={t("Modifier l'événement")}>
                                                        <Edit size={13} />
                                                    </Link>
                                                    <Link href={`/admin/evenements/${evt.id}/registrations`}
                                                        className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title={t("Inscrits")} aria-label={t("Voir les inscriptions de l'événement")}>
                                                        <Users size={13} />
                                                    </Link>
                                                    <button onClick={() => handleDelete(evt.id)} disabled={deleting === evt.id}
                                                        className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-30" title={t("Supprimer")} aria-label={t("Supprimer l'événement")}>
                                                        <Trash2 size={13} />
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
            )}
        </div>
    )
}
