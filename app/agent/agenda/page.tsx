'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    CalendarDays, Plus, Clock, MapPin, User, Video, Phone,
    ChevronLeft, ChevronRight, X, Loader2
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

const typeConfig: Record<string, { color: string; icon: typeof MapPin; label: string }> = {
    visite: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: MapPin, label: 'Visite Terrain' },
    appel: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: Phone, label: 'Appel Client' },
    reunion: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Video, label: 'Réunion' },
    rdv_client: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: User, label: 'RDV Client' },
}

export default function AgentAgendaPage() {
    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)

    // New event form
    const [newTitle, setNewTitle] = useState('')
    const [newDate, setNewDate] = useState('')
    const [newTime, setNewTime] = useState('09:00')
    const [newType, setNewType] = useState<string>('rdv_client')
    const [newClient, setNewClient] = useState('')
    const [newLocation, setNewLocation] = useState('')

    const fetchEvents = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('agent_events')
            .select('*')
            .eq('agent_id', user.id)
            .order('date', { ascending: true })

        setEvents((data || []) as Event[])
        setLoading(false)
    }

    useEffect(() => {
        fetchEvents()
    }, [])

    const handleAddEvent = async () => {
        if (!newTitle.trim() || !newDate) return
        setSaving(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('agent_events').insert({
            agent_id: user.id,
            title: newTitle,
            date: newDate,
            time: newTime,
            type: newType,
            client: newClient,
            location: newLocation,
        })

        if (!error) {
            await fetchEvents()
            setShowModal(false)
            setNewTitle('')
            setNewDate('')
            setNewTime('09:00')
            setNewType('rdv_client')
            setNewClient('')
            setNewLocation('')
        }
        setSaving(false)
    }

    const handleDeleteEvent = async (id: string) => {
        await supabase.from('agent_events').delete().eq('id', id)
        setEvents(prev => prev.filter(e => e.id !== id))
    }

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))

    const getEventsForDay = (day: number) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        return events.filter(e => e.date === dateStr)
    }

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
    const firstDayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()
    const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

    const today = new Date()
    const isToday = (day: number) =>
        today.getDate() === day && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear()

    // Upcoming events (next 7 days)
    const upcomingEvents = events.filter(e => {
        const eventDate = new Date(e.date)
        const diff = (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        return diff >= 0 && diff <= 7
    })

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Agenda</h1>
                    <p className="text-gray-500 text-sm mt-1">{events.length} événement(s) planifié(s)</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all"
                >
                    <Plus size={16} /> Nouvel Événement
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Calendar */}
                <div className="xl:col-span-2 bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={prevMonth} className="text-gray-500 hover:text-white transition-colors" title="Mois précédent">
                            <ChevronLeft size={20} />
                        </button>
                        <h2 className="text-lg font-bold text-white">
                            {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                        </h2>
                        <button onClick={nextMonth} className="text-gray-500 hover:text-white transition-colors" title="Mois suivant">
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                            <div key={d} className="text-center text-[10px] font-bold text-gray-500 uppercase py-2">{d}</div>
                        ))}
                        {Array.from({ length: adjustedFirstDay }).map((_, i) => (
                            <div key={`empty-${i}`} />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1
                            const dayEvents = getEventsForDay(day)
                            return (
                                <div
                                    key={day}
                                    className={`relative p-2 rounded-xl text-center min-h-[60px] transition-all ${isToday(day)
                                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold'
                                        : 'hover:bg-white/[0.03] text-gray-400'
                                        }`}
                                >
                                    <span className="text-xs">{day}</span>
                                    {dayEvents.length > 0 && (
                                        <div className="flex justify-center gap-0.5 mt-1">
                                            {dayEvents.slice(0, 3).map((e) => (
                                                <span
                                                    key={e.id}
                                                    className={`w-1.5 h-1.5 rounded-full ${typeConfig[e.type]?.color.split(' ')[0] || 'bg-gray-500'}`}
                                                    title={e.title}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Upcoming Events Sidebar */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <CalendarDays size={14} className="text-emerald-400" /> Prochains événements
                    </h3>
                    <div className="space-y-3">
                        {upcomingEvents.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-8">Aucun événement cette semaine</p>
                        ) : (
                            upcomingEvents.map(event => {
                                const config = typeConfig[event.type] || typeConfig.rdv_client
                                const Icon = config.icon
                                return (
                                    <motion.div
                                        key={event.id}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`p-3 rounded-xl border ${config.color} group relative`}
                                    >
                                        <button
                                            onClick={() => handleDeleteEvent(event.id)}
                                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                                            title="Supprimer"
                                        >
                                            <X size={12} />
                                        </button>
                                        <div className="flex items-start gap-2">
                                            <Icon size={14} className="mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-xs font-bold">{event.title}</p>
                                                <p className="text-[10px] opacity-70 mt-0.5">
                                                    {new Date(event.date).toLocaleDateString('fr-FR')} à {event.time}
                                                </p>
                                                {event.client && <p className="text-[10px] opacity-60">{event.client}</p>}
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Add Event Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-[#0a0f14] border border-white/10 rounded-2xl p-6 w-full max-w-md"
                        >
                            <h3 className="text-lg font-bold text-white mb-4">Nouvel Événement</h3>
                            <div className="space-y-3">
                                <input
                                    type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                                    placeholder="Titre de l&apos;événement" title="Titre"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="date" value={newDate} onChange={e => setNewDate(e.target.value)} title="Date"
                                        className="bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                                    />
                                    <input
                                        type="time" value={newTime} onChange={e => setNewTime(e.target.value)} title="Heure"
                                        className="bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                                    />
                                </div>
                                <select
                                    value={newType} onChange={e => setNewType(e.target.value)} title="Type"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                                >
                                    <option value="rdv_client">RDV Client</option>
                                    <option value="appel">Appel</option>
                                    <option value="visite">Visite Terrain</option>
                                    <option value="reunion">Réunion</option>
                                </select>
                                <input
                                    type="text" value={newClient} onChange={e => setNewClient(e.target.value)}
                                    placeholder="Nom du client (optionnel)" title="Client"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
                                />
                                <input
                                    type="text" value={newLocation} onChange={e => setNewLocation(e.target.value)}
                                    placeholder="Lieu (optionnel)" title="Lieu"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
                                />
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/5 transition-all">
                                        Annuler
                                    </button>
                                    <button
                                        onClick={handleAddEvent} disabled={saving || !newTitle.trim() || !newDate}
                                        className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-bold hover:bg-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
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
