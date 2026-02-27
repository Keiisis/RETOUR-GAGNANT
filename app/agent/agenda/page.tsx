'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    CalendarDays, Plus, Clock, MapPin, User, Video, Phone,
    ChevronLeft, ChevronRight
} from 'lucide-react'

interface Event {
    id: string
    title: string
    date: string
    time: string
    type: 'visite' | 'appel' | 'reunion' | 'rdv_client'
    client: string
    location?: string
}

const typeConfig = {
    visite: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: MapPin, label: 'Visite Terrain' },
    appel: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: Phone, label: 'Appel Client' },
    reunion: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Video, label: 'Réunion' },
    rdv_client: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: User, label: 'RDV Client' },
}

// Données de démonstration
const demoEvents: Event[] = [
    { id: '1', title: 'Visite terrain Calavi', date: '2026-02-28', time: '09:00', type: 'visite', client: 'M. Dossou', location: 'Abomey-Calavi, Lot 234' },
    { id: '2', title: 'Appel suivi dossier', date: '2026-02-28', time: '14:30', type: 'appel', client: 'Mme Adjakou' },
    { id: '3', title: 'Réunion équipe', date: '2026-03-01', time: '10:00', type: 'reunion', client: 'Équipe RGB' },
    { id: '4', title: 'RDV Notaire', date: '2026-03-02', time: '11:00', type: 'rdv_client', client: 'Famille Martin', location: 'Cotonou Centre' },
]

export default function AgentAgendaPage() {
    const [events] = useState<Event[]>(demoEvents)
    const [currentDate, setCurrentDate] = useState(new Date())

    const today = new Date().toISOString().split('T')[0]

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()

    const monthName = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))

    const getEventsForDay = (day: number) => {
        const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
        return events.filter(e => e.date === dateStr)
    }

    const upcomingEvents = events
        .filter(e => e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Agenda</h1>
                    <p className="text-gray-500 text-sm mt-1">{upcomingEvents.length} événement(s) à venir</p>
                </div>
                <button className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all">
                    <Plus size={16} /> Nouvel Événement
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Calendar Grid */}
                <div className="xl:col-span-2 bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={prevMonth} title="Mois précédent" className="p-2 rounded-lg hover:bg-white/5 text-gray-400"><ChevronLeft size={20} /></button>
                        <h2 className="text-lg font-bold text-white capitalize">{monthName}</h2>
                        <button onClick={nextMonth} title="Mois suivant" className="p-2 rounded-lg hover:bg-white/5 text-gray-400"><ChevronRight size={20} /></button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                            <div key={d} className="text-center text-[10px] font-bold text-gray-600 uppercase tracking-wider py-2">{d}</div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: (firstDay + 6) % 7 }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-16" />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1
                            const dayEvents = getEventsForDay(day)
                            const isToday = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}` === today

                            return (
                                <div
                                    key={day}
                                    className={`h-16 rounded-lg p-1 text-center transition-all hover:bg-white/5 cursor-pointer ${isToday ? 'bg-emerald-500/10 border border-emerald-500/30' : ''
                                        }`}
                                >
                                    <span className={`text-xs font-semibold ${isToday ? 'text-emerald-400' : 'text-gray-400'}`}>
                                        {day}
                                    </span>
                                    {dayEvents.length > 0 && (
                                        <div className="flex justify-center gap-0.5 mt-1">
                                            {dayEvents.slice(0, 3).map(e => (
                                                <div key={e.id} className={`w-1.5 h-1.5 rounded-full ${typeConfig[e.type]?.color.split(' ')[0] || 'bg-gray-500'
                                                    }`} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Upcoming Events */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Clock size={14} className="text-emerald-400" /> Prochains Événements
                    </h3>
                    <div className="space-y-3">
                        {upcomingEvents.map((event) => {
                            const config = typeConfig[event.type]
                            const EventIcon = config.icon
                            return (
                                <motion.div
                                    key={event.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className={`p-3 rounded-xl border ${config.color} transition-all hover:scale-[1.01]`}
                                >
                                    <div className="flex items-start gap-3">
                                        <EventIcon size={16} className="mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-white">{event.title}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{event.client}</p>
                                            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                                                <span>{new Date(event.date).toLocaleDateString('fr-FR')}</span>
                                                <span>{event.time}</span>
                                                {event.location && <span>📍 {event.location}</span>}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
