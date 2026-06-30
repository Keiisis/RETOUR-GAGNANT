'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    CalendarDays, Plus, Clock, MapPin, User, Video, Phone, Mail,
    ChevronLeft, ChevronRight, X, Loader2, ExternalLink, Trash2,
    Send, CheckCircle
} from 'lucide-react'

interface Event {
    id: string
    title: string
    description: string
    date: string
    time: string
    type: 'visite' | 'appel' | 'reunion' | 'rdv_client'
    client: string
    location: string
}

interface RDV {
    id: string
    client_id: string | null
    client_email: string
    date: string
    heure: string
    type: 'presentiel' | 'visio' | 'telephone'
    motif: string
    notes: string | null
    statut: 'en_attente' | 'confirme' | 'annule' | 'termine'
    created_at: string
    client_profiles?: { nom: string; prenom: string; phone: string | null } | null
}

const typeConfig: Record<string, { color: string; icon: typeof MapPin; label: string }> = {
    visite: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: MapPin, label: 'Visite' },
    appel: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: Phone, label: 'Appel' },
    reunion: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Video, label: 'Réunion' },
    rdv_client: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: User, label: 'RDV Client' },
}

export default function AgentAgendaPage() {
    const [events, setEvents] = useState<Event[]>([])
    const [rdvList, setRdvList] = useState<RDV[]>([])
    const [loading, setLoading] = useState(true)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [showModal, setShowModal] = useState(false)
    const [selectedRDV, setSelectedRDV] = useState<RDV | null>(null)
    const [selectedDay, setSelectedDay] = useState<number | null>(null)
    const [saving, setSaving] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Inline email reply state
    const [replyMode, setReplyMode] = useState(false)
    const [replyMsg, setReplyMsg] = useState('')
    const [sendingEmail, setSendingEmail] = useState(false)
    const [emailSent, setEmailSent] = useState(false)

    const [newTitle, setNewTitle] = useState('')
    const [newDate, setNewDate] = useState('')
    const [newTime, setNewTime] = useState('09:00')
    const [newType, setNewType] = useState<string>('rdv_client')
    const [newClient, setNewClient] = useState('')
    const [newLocation, setNewLocation] = useState('')

    const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [eventsRes, rdvRes] = await Promise.all([
            supabase.from('agent_events').select('*').eq('agent_id', user.id).order('date', { ascending: true }),
            supabase.from('rdv_requests').select('*, client_profiles(nom, prenom, phone)').order('created_at', { ascending: false }),
        ])

        setEvents((eventsRes.data || []) as Event[])
        setRdvList((rdvRes.data || []) as RDV[])
        setLoading(false)
    }

    useEffect(() => { fetchData() }, [])

    const handleAddEvent = async () => {
        if (!newTitle.trim() || !newDate) return
        setSaving(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('agent_events').insert({
            agent_id: user.id, title: newTitle, date: newDate, time: newTime,
            type: newType, client: newClient, location: newLocation,
        })

        await fetchData()
        setShowModal(false)
        setNewTitle(''); setNewDate(''); setNewTime('09:00')
        setNewType('rdv_client'); setNewClient(''); setNewLocation('')
        setSaving(false)
    }

    const handleDeleteEvent = async (id: string) => {
        await supabase.from('agent_events').delete().eq('id', id)
        setEvents(prev => prev.filter(e => e.id !== id))
    }

    const openAddEventForDay = (day: number) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        setNewDate(dateStr)
        setShowModal(true)
    }

    // Parse __VISITOR__: Name | Tel: +229... format in notes
    const parseVisitorInfo = (notes: string | null): { name?: string; phone?: string } => {
        if (!notes) return {}
        const match = notes.match(/^__VISITOR__:\s*(.+?)\s*\|\s*Tel:\s*(.+)/m)
        if (!match) return {}
        return { name: match[1].trim(), phone: match[2].trim() === 'N/A' ? undefined : match[2].trim() }
    }

    const getClientName = (rdv: RDV) => {
        if (rdv.client_profiles?.nom) return `${rdv.client_profiles.nom} ${rdv.client_profiles.prenom || ''}`.trim()
        const visitor = parseVisitorInfo(rdv.notes)
        if (visitor.name) return visitor.name
        return rdv.client_email
    }

    const getVisitorPhone = (rdv: RDV) => {
        if (rdv.client_profiles?.phone) return rdv.client_profiles.phone
        return parseVisitorInfo(rdv.notes).phone || null
    }

    const sendEmailReply = async () => {
        if (!selectedRDV || !replyMsg.trim()) return
        setSendingEmail(true)
        try {
            const res = await fetch('/api/rdv/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rdvId: selectedRDV.id,
                    clientEmail: selectedRDV.client_email,
                    clientName: getClientName(selectedRDV),
                    message: replyMsg.trim(),
                }),
            })
            if (res.ok) {
                setEmailSent(true)
                setReplyMsg('')
                setTimeout(() => { setEmailSent(false); setReplyMode(false) }, 3000)
            }
        } catch { /* non-blocking */ }
        setSendingEmail(false)
    }

    const updateRdvStatus = async (rdvId: string, statut: RDV['statut']) => {
        await supabase.from('rdv_requests').update({ statut }).eq('id', rdvId)
        const applyUpdate = (r: RDV): RDV => r.id === rdvId ? { ...r, statut } : r
        setRdvList(prev => prev.map(applyUpdate))
        setSelectedRDV(prev => prev ? applyUpdate(prev) : null)
    }

    const prevMonth = () => { setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)); setSelectedDay(null) }
    const nextMonth = () => { setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)); setSelectedDay(null) }

    const getItemsForDay = (day: number) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const ev = events.filter(e => e.date === dateStr)
        const rv = rdvList.filter(r => r.date === dateStr)
        return { events: ev, rdvs: rv, dateStr }
    }

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
    const firstDayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()
    const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

    const today = new Date()
    const isToday = (day: number) => today.getDate() === day && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear()

    // RDVs : en_attente en premier, puis par date décroissante — tous affichés
    const statutOrder: Record<string, number> = { en_attente: 0, confirme: 1, termine: 2, annule: 3 }
    const sortedRDVs = [...rdvList].sort((a, b) => {
        const sA = statutOrder[a.statut] ?? 4
        const sB = statutOrder[b.statut] ?? 4
        if (sA !== sB) return sA - sB
        const timeA = a.date && !isNaN(new Date(a.date).getTime()) ? new Date(a.date).getTime() : 0
        const timeB = b.date && !isNaN(new Date(b.date).getTime()) ? new Date(b.date).getTime() : 0
        return timeB - timeA
    })

    const upcomingEvents = events.filter(e => {
        if (!mounted) return false
        if (!e.date) return false
        const d = new Date(e.date)
        if (isNaN(d.getTime())) return false
        const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        return diff >= -1 && diff <= 14
    })

    // Items for the selected day
    const selectedDayItems = selectedDay ? getItemsForDay(selectedDay) : null

    if (loading) {
        return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Agenda</h1>
                    <p className="text-gray-500 text-sm mt-1">{events.length} événement(s) • {rdvList.length} demande(s) de RDV</p>
                </div>
                <button type="button" onClick={() => { setNewDate(''); setShowModal(true) }} className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all">
                    <Plus size={16} /> Nouvel Événement
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Calendar */}
                <div className="xl:col-span-2 bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <button type="button" onClick={prevMonth} className="text-gray-500 hover:text-white transition-colors" title="Mois précédent" aria-label="Mois précédent"><ChevronLeft size={20} /></button>
                        <h2 className="text-lg font-bold text-white capitalize">{mounted ? currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : ''}</h2>
                        <button type="button" onClick={nextMonth} className="text-gray-500 hover:text-white transition-colors" title="Mois suivant" aria-label="Mois suivant"><ChevronRight size={20} /></button>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                            <div key={d} className="text-center text-[10px] font-bold text-gray-500 uppercase py-2">{d}</div>
                        ))}
                        {Array.from({ length: adjustedFirstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1
                            const { events: dayEvents, rdvs: dayRdvs } = getItemsForDay(day)
                            const hasItems = dayEvents.length > 0 || dayRdvs.length > 0
                            const isSelected = selectedDay === day
                            return (
                                <button
                                    type="button"
                                    key={day}
                                    onClick={() => setSelectedDay(isSelected ? null : day)}
                                    className={`relative p-2 rounded-xl text-center min-h-[60px] transition-all w-full ${
                                        isSelected
                                            ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold'
                                            : isToday(day)
                                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold hover:bg-emerald-500/15'
                                            : 'hover:bg-white/[0.05] text-gray-400 border border-transparent'
                                    }`}
                                >
                                    <span className="text-xs">{day}</span>
                                    {hasItems && (
                                        <div className="flex justify-center gap-0.5 mt-1">
                                            {dayEvents.slice(0, 2).map(e => (
                                                <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${typeConfig[e.type]?.color.split(' ')[0] || 'bg-gray-500'}`} />
                                            ))}
                                            {dayRdvs.slice(0, 2).map(r => (
                                                <span key={r.id} className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                            ))}
                                            {(dayEvents.length + dayRdvs.length) > 4 && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                                            )}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Sidebar — Day detail or upcoming */}
                <div className="space-y-4">
                    <AnimatePresence mode="wait">
                        {selectedDay && selectedDayItems ? (
                            <motion.div key="day-detail" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                                {/* Day header */}
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                                                {mounted && selectedDayItems?.dateStr && !isNaN(new Date(selectedDayItems.dateStr + 'T12:00:00').getTime()) ? new Date(selectedDayItems.dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {selectedDayItems.events.length + selectedDayItems.rdvs.length} élément(s)
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openAddEventForDay(selectedDay)}
                                                className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all"
                                                title="Ajouter un événement"
                                                aria-label="Ajouter un événement"
                                            >
                                                <Plus size={14} />
                                            </button>
                                            <button type="button" onClick={() => setSelectedDay(null)} className="text-gray-500 hover:text-white" title="Fermer" aria-label="Fermer">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Events for this day */}
                                    <div className="space-y-2">
                                        {selectedDayItems.events.length === 0 && selectedDayItems.rdvs.length === 0 ? (
                                            <p className="text-xs text-gray-500 text-center py-3">Aucun événement ce jour</p>
                                        ) : (
                                            <>
                                                {selectedDayItems.events.map(event => {
                                                    const config = typeConfig[event.type] || typeConfig.rdv_client
                                                    const Icon = config.icon
                                                    return (
                                                        <div key={event.id} className={`p-3 rounded-xl border ${config.color} group relative`}>
                                                            <button type="button" onClick={() => handleDeleteEvent(event.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all" title="Supprimer" aria-label="Supprimer l'événement"><Trash2 size={11} /></button>
                                                            <div className="flex items-start gap-2">
                                                                <Icon size={13} className="mt-0.5 flex-shrink-0" />
                                                                <div>
                                                                    <p className="text-xs font-bold pr-4">{event.title}</p>
                                                                    <p className="text-[10px] opacity-70">{event.time}{event.location && ` — ${event.location}`}</p>
                                                                    {event.client && <p className="text-[10px] opacity-60">{event.client}</p>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                {selectedDayItems.rdvs.map(rdv => (
                                                    <div key={rdv.id} onClick={() => setSelectedRDV(rdv)} className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 cursor-pointer transition-all">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-xs font-bold text-white">{getClientName(rdv)}</p>
                                                            <ExternalLink size={10} className="text-gray-500" />
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{rdv.heure} — {rdv.motif}</p>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key="upcoming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                                {/* RDV from clients */}
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                        <CalendarDays size={14} className="text-amber-400" /> Demandes de RDV ({rdvList.length})
                                    </h3>
                                    <div className="space-y-2 max-h-72 overflow-y-auto">
                                        {sortedRDVs.length === 0 ? (
                                            <p className="text-gray-500 text-xs text-center py-4">Aucune demande de RDV</p>
                                        ) : sortedRDVs.map(rdv => (
                                            <div key={rdv.id} onClick={() => setSelectedRDV(rdv)} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/30 cursor-pointer transition-all">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-bold text-white">{getClientName(rdv)}</p>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                                        rdv.statut === 'en_attente' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        rdv.statut === 'confirme' ? 'bg-emerald-500/20 text-emerald-400' :
                                                        rdv.statut === 'annule' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-gray-500/20 text-gray-400'
                                                    }`}>
                                                        {rdv.statut === 'en_attente' ? 'En attente' : rdv.statut === 'confirme' ? 'Confirmé' : rdv.statut === 'annule' ? 'Annulé' : 'Terminé'}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-gray-500 mt-0.5">
                                                    {rdv.date && !isNaN(new Date(rdv.date + 'T12:00:00').getTime()) ? new Date(rdv.date + 'T12:00:00').toLocaleDateString('fr-FR') : 'Date à confirmer'}{rdv.heure ? ` à ${rdv.heure}` : ''}
                                                </p>
                                                <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-1">{rdv.motif}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Upcoming agent events */}
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                        <Clock size={14} className="text-emerald-400" /> Mes événements
                                    </h3>
                                    <div className="space-y-2">
                                        {upcomingEvents.length === 0 ? (
                                            <p className="text-gray-500 text-xs text-center py-4">Aucun événement planifié</p>
                                        ) : upcomingEvents.map(event => {
                                            const config = typeConfig[event.type] || typeConfig.rdv_client
                                            const Icon = config.icon
                                            return (
                                                <div key={event.id} className={`p-3 rounded-xl border ${config.color} group relative`}>
                                                    <button type="button" onClick={() => handleDeleteEvent(event.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all" title="Supprimer" aria-label="Supprimer l'événement"><X size={12} /></button>
                                                    <div className="flex items-start gap-2">
                                                        <Icon size={14} className="mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-xs font-bold">{event.title}</p>
                                                            <p className="text-[10px] opacity-70 mt-0.5">{event.date && !isNaN(new Date(event.date).getTime()) ? new Date(event.date).toLocaleDateString('fr-FR') : '—'} à {event.time}</p>
                                                            {event.client && <p className="text-[10px] opacity-60">{event.client}</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* RDV Detail Modal */}
            <AnimatePresence>
                {selectedRDV && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setSelectedRDV(null); setReplyMode(false); setReplyMsg(''); setEmailSent(false) }}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-[#0a0f14] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-white">Demande de Rendez-vous</h3>
                                <button type="button" onClick={() => { setSelectedRDV(null); setReplyMode(false); setReplyMsg(''); setEmailSent(false) }} className="text-gray-500 hover:text-white" title="Fermer" aria-label="Fermer"><X size={18} /></button>
                            </div>
                            <div className="space-y-3">
                                {/* Statut */}
                                <span className={`inline-flex items-center text-[11px] font-bold px-3 py-1 rounded-full border ${
                                    selectedRDV.statut === 'confirme' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                    selectedRDV.statut === 'annule' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                    selectedRDV.statut === 'termine' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                                    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                }`}>
                                    {selectedRDV.statut === 'en_attente' ? 'En attente de confirmation' :
                                     selectedRDV.statut === 'confirme' ? 'Confirmé' :
                                     selectedRDV.statut === 'annule' ? 'Annulé' : 'Terminé'}
                                </span>

                                {/* Infos client */}
                                <div className="bg-white/5 rounded-xl p-4 space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-gray-300"><User size={14} className="text-emerald-400" /> {getClientName(selectedRDV)}</div>
                                    <div className="flex items-center gap-2 text-sm text-gray-300"><Mail size={14} className="text-emerald-400" /> {selectedRDV.client_email}</div>
                                    {getVisitorPhone(selectedRDV) && <div className="flex items-center gap-2 text-sm text-gray-300"><Phone size={14} className="text-emerald-400" /> {getVisitorPhone(selectedRDV)}</div>}
                                    <div className="flex items-center gap-2 text-sm text-gray-300">
                                        <CalendarDays size={14} className="text-emerald-400" />
                                     {selectedRDV.date && !isNaN(new Date(selectedRDV.date + 'T12:00:00').getTime())
                                            ? new Date(selectedRDV.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                                            : 'Date à confirmer'
                                        }{selectedRDV.heure ? ` à ${selectedRDV.heure}` : ''}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-300">
                                        {selectedRDV.type === 'presentiel' ? <MapPin size={14} className="text-emerald-400" /> : selectedRDV.type === 'visio' ? <Video size={14} className="text-emerald-400" /> : <Phone size={14} className="text-emerald-400" />}
                                        {selectedRDV.type === 'presentiel' ? 'Présentiel' : selectedRDV.type === 'visio' ? 'Visioconférence' : 'Téléphone'}
                                    </div>
                                </div>

                                {/* Motif */}
                                <div className="bg-white/5 rounded-xl p-4">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Motif</p>
                                    <p className="text-sm text-gray-300">{selectedRDV.motif}</p>
                                </div>

                                {/* Notes — hide internal __VISITOR__ prefix, show only the message part */}
                                {selectedRDV.notes && (() => {
                                    const displayNotes = selectedRDV.notes.replace(/^__VISITOR__:[^\n]*\n?---\n?/m, '').replace(/^__VISITOR__:[^\n]*/m, '').replace(/^Message:\s*/m, '').trim()
                                    return displayNotes ? (
                                        <div className="bg-white/5 rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Message du client</p>
                                            <p className="text-sm text-gray-300">{displayNotes}</p>
                                        </div>
                                    ) : null
                                })()}

                                 <p className="text-[10px] text-gray-500">Reçu le {selectedRDV.created_at && !isNaN(new Date(selectedRDV.created_at).getTime()) ? new Date(selectedRDV.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</p>

                                {/* Actions statut */}
                                {selectedRDV.statut === 'en_attente' && (
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => updateRdvStatus(selectedRDV.id, 'confirme')} className="flex-1 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/30 transition-all">✓ Confirmer</button>
                                        <button type="button" onClick={() => updateRdvStatus(selectedRDV.id, 'annule')} className="flex-1 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold hover:bg-red-500/20 transition-all">✗ Annuler</button>
                                    </div>
                                )}
                                {selectedRDV.statut === 'confirme' && (
                                    <button type="button" onClick={() => updateRdvStatus(selectedRDV.id, 'termine')} className="w-full py-2 rounded-xl bg-gray-500/10 text-gray-400 border border-gray-500/20 text-xs font-bold hover:bg-gray-500/20 transition-all">Marquer comme terminé</button>
                                )}

                                {/* Contacter — inline email reply ou WhatsApp */}
                                <div className="border-t border-white/5 pt-4 space-y-3">
                                    {!replyMode ? (
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => setReplyMode(true)} className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold hover:bg-blue-500/30 transition-all">
                                                <Mail size={12} /> Répondre par email
                                            </button>
                                            {getVisitorPhone(selectedRDV) && (
                                                <a href={`https://wa.me/${getVisitorPhone(selectedRDV)!.replace(/\s+/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 font-bold hover:bg-green-500/30 transition-all">
                                                    <Phone size={12} /> WhatsApp
                                                </a>
                                            )}
                                        </div>
                                    ) : emailSent ? (
                                        <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-bold py-3">
                                            <CheckCircle size={16} /> Email envoyé !
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Mail size={10} /> Réponse à {selectedRDV.client_email}</p>
                                            <textarea
                                                value={replyMsg}
                                                onChange={e => setReplyMsg(e.target.value)}
                                                placeholder="Écrivez votre réponse..."
                                                rows={4}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 resize-none"
                                            />
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => { setReplyMode(false); setReplyMsg('') }} className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 text-xs font-bold">Annuler</button>
                                                <button type="button" onClick={sendEmailReply} disabled={sendingEmail || !replyMsg.trim()} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-bold hover:bg-blue-500/30 disabled:opacity-50 transition-all">
                                                    {sendingEmail ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                                    {sendingEmail ? 'Envoi…' : 'Envoyer'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Event Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-[#0a0f14] border border-white/10 rounded-2xl p-6 w-full max-w-md">
                            <h3 className="text-lg font-bold text-white mb-4">Nouvel Événement</h3>
                            <div className="space-y-3">
                                <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Titre" title="Titre" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} title="Date" className="bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                                    <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} title="Heure" className="bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                                </div>
                                <select value={newType} onChange={e => setNewType(e.target.value)} title="Type" aria-label="Type d'événement" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50">
                                    <option value="rdv_client">RDV Client</option>
                                    <option value="appel">Appel</option>
                                    <option value="visite">Visite Terrain</option>
                                    <option value="reunion">Réunion</option>
                                </select>
                                <input type="text" value={newClient} onChange={e => setNewClient(e.target.value)} placeholder="Client (optionnel)" title="Client" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                <input type="text" value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="Lieu (optionnel)" title="Lieu" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-bold">Annuler</button>
                                    <button type="button" onClick={handleAddEvent} disabled={saving || !newTitle.trim() || !newDate} className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ajouter
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
