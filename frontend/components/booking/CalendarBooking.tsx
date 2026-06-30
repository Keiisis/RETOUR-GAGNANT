'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect } from 'react'
import ConsentCheckbox from '@/components/shared/ConsentCheckbox'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    CalendarDays, Clock, ChevronLeft, ChevronRight,
    CheckCircle2, User, Mail, Phone, MessageSquare, Loader2
} from 'lucide-react'

const SERVICES = [
    'Passeport & Documents',
    'Acheter ou Louer',
    "Création d'Entreprise",
    'Guide Culturel',
    'Construction',
    'Investissement',
    'Consultation Générale',
]

const TIME_SLOTS = [
    '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
    '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00',
]

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

export default function CalendarBooking() {
    const { t } = useTranslation();
    const [step, setStep] = useState(1)
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [selectedTime, setSelectedTime] = useState('')
    const [selectedService, setSelectedService] = useState('')
    const [form, setForm] = useState({ nom: '', email: '', phone: '', notes: '' })
    const [consent, setConsent] = useState(false)
    const [loading, setLoading] = useState(false)
    const [booked, setBooked] = useState(false)
    const [bookedSlots, setBookedSlots] = useState<string[]>([])
    const [currentMonth, setCurrentMonth] = useState(new Date())

    // Fetch booked slots for a given date
    useEffect(() => {
        if (!selectedDate) return
        const fetchBooked = async () => {
            const dateStr = selectedDate.toISOString().split('T')[0]
            const { data } = await supabase
                .from('appointments')
                .select('time_slot')
                .eq('date', dateStr)
                .eq('status', 'confirme')

            setBookedSlots((data || []).map((d: any) => d.time_slot))
        }
        fetchBooked()
    }, [selectedDate])

    const handleSubmit = async () => {
        if (!selectedDate || !selectedTime || !form.nom || !form.email || !consent) return
        setLoading(true)

        try {
            // Save to appointments
            await fetch('/api/rendez-vous', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nom: form.nom,
                    email: form.email,
                    telephone: form.phone,
                    service: selectedService,
                    message: form.notes,
                    date: selectedDate.toISOString().split('T')[0],
                    timeSlot: selectedTime,
                    contactMethod: 'calendrier',
                })
            })

            // Also save as appointment for calendar tracking
            const supabaseServer = supabase
            // This insert might fail if table doesn't exist yet, non-blocking
            try {
                await supabaseServer.from('appointments').insert({
                    client_nom: form.nom,
                    client_email: form.email,
                    client_phone: form.phone,
                    service: selectedService,
                    date: selectedDate.toISOString().split('T')[0],
                    time_slot: selectedTime,
                    status: 'confirme',
                    notes: form.notes,
                })
            } catch { }

            setBooked(true)
        } catch {
            alert('Erreur lors de la réservation.')
        }
        setLoading(false)
    }

    // Calendar rendering
    const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    const getFirstDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()

    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(currentMonth)
        const firstDay = getFirstDay(currentMonth)
        const today = new Date()
        const cells = []

        // Empty cells
        for (let i = 0; i < firstDay; i++) {
            cells.push(<div key={`empty-${i}`} />)
        }

        // Day cells
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
            const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
            const isWeekend = date.getDay() === 0 || date.getDay() === 6
            const isSelected = selectedDate?.toDateString() === date.toDateString()
            const isToday = date.toDateString() === today.toDateString()

            cells.push(
                <button
                    key={day}
                    disabled={isPast || isWeekend}
                    onClick={() => { setSelectedDate(date); setSelectedTime(''); setStep(2); }}
                    className={`aspect-square rounded-xl text-sm font-bold transition-all flex items-center justify-center
                        ${isSelected ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : ''}
                        ${isPast || isWeekend ? 'text-gray-700 cursor-not-allowed' : 'text-white hover:bg-white/10'}
                        ${isToday && !isSelected ? 'border border-emerald-500/50' : ''}
                    `}
                >
                    {day}
                </button>
            )
        }
        return cells
    }

    if (booked) {
        return (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/[0.03] border border-emerald-500/20 rounded-2xl p-8 text-center max-w-md mx-auto">
                <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
                <h3 className="text-xl font-black text-white mb-2"><T>Rendez-vous Confirmé !</T></h3>
                <p className="text-sm text-gray-400 mb-1">
                    {selectedDate?.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-emerald-400 font-bold text-sm mb-4">{selectedTime}</p>
                <p className="text-xs text-gray-500"><T>Un email de confirmation vous a été envoyé.</T></p>
            </motion.div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-8">
                {['Service', 'Date & Heure', 'Vos infos'].map((s, i) => (
                    <div key={i} className="flex items-center gap-2 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500' : 'bg-white/5 text-gray-600'}`}>
                            {step > i + 1 ? <CheckCircle2 size={16} /> : i + 1}
                        </div>
                        <span className={`text-xs font-bold hidden sm:block ${step >= i + 1 ? 'text-white' : 'text-gray-600'}`}>{s}</span>
                        {i < 2 && <div className={`flex-1 h-px transition-all ${step > i + 1 ? 'bg-emerald-500' : 'bg-white/10'}`} />}
                    </div>
                ))}
            </div>

            {/* Step 1: Service Selection */}
            {step === 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    <h2 className="text-lg font-bold text-white mb-4"><T>Quel service souhaitez-vous ?</T></h2>
                    {SERVICES.map(s => (
                        <button
                            key={s}
                            onClick={() => { setSelectedService(s); setStep(2); }}
                            className={`w-full text-left p-4 rounded-xl border transition-all text-sm font-medium ${selectedService === s ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/[0.03] border-white/5 text-gray-300 hover:border-white/20'}`}
                        >
                            {s}
                        </button>
                    ))}
                </motion.div>
            )}

            {/* Step 2: Calendar + Time */}
            {step === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Calendar */}
                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="text-gray-400 hover:text-white p-1"><ChevronLeft size={20} /></button>
                                <h3 className="text-sm font-bold text-white">{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
                                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="text-gray-400 hover:text-white p-1"><ChevronRight size={20} /></button>
                            </div>
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {DAYS.map(d => <div key={d} className="text-center text-[10px] font-bold text-gray-600 py-1">{d}</div>)}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {renderCalendar()}
                            </div>
                        </div>

                        {/* Time Slots */}
                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <Clock size={14} className="text-emerald-400" />
                                {selectedDate ? `Créneaux — ${selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Sélectionnez une date'}
                            </h3>
                            {selectedDate ? (
                                <div className="space-y-2">
                                    {TIME_SLOTS.map(slot => {
                                        const isBooked = bookedSlots.includes(slot)
                                        return (
                                            <button
                                                key={slot}
                                                disabled={isBooked}
                                                onClick={() => { setSelectedTime(slot); setStep(3); }}
                                                className={`w-full p-3 rounded-xl text-sm font-bold transition-all ${isBooked
                                                    ? 'bg-red-500/10 text-red-400/50 cursor-not-allowed line-through'
                                                    : selectedTime === slot
                                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                        : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/5'
                                                    }`}
                                            >
                                                {slot} {isBooked && '(Réservé)'}
                                            </button>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-500"><T>Cliquez sur une date dans le calendrier</T></p>
                            )}
                        </div>
                    </div>
                    <button onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-white mt-4 flex items-center gap-1"><ChevronLeft size={12} /> <T>Retour</T></button>
                </motion.div>
            )}

            {/* Step 3: Contact Info */}
            {step === 3 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 max-w-lg mx-auto">
                        <h2 className="text-lg font-bold text-white mb-1"><T>Vos coordonnées</T></h2>
                        <p className="text-xs text-gray-500 mb-6">
                            {selectedService} — {selectedDate?.toLocaleDateString('fr-FR')} — {selectedTime}
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-1 block"><T>Nom complet *</T></label>
                                <div className="relative">
                                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder={t("Jean Dupont")} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-9 pr-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-1 block"><T>Email *</T></label>
                                <div className="relative">
                                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t("votre@email.com")} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-9 pr-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-1 block"><T>Téléphone / WhatsApp</T></label>
                                <div className="relative">
                                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+33 6 12 34 56 78" className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-9 pr-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-1 block"><T>Notes (optionnel)</T></label>
                                <div className="relative">
                                    <MessageSquare size={14} className="absolute left-3 top-3 text-gray-500" />
                                    <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("Précisions sur votre demande...")} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-9 pr-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none" />
                                </div>
                            </div>
                        </div>

                        <ConsentCheckbox id="booking-consent" checked={consent} onChange={setConsent}
                            purpose="afin de planifier mon rendez-vous et de me recontacter" className="mt-5 !text-gray-400" />

                        <button
                            onClick={handleSubmit}
                            disabled={loading || !form.nom || !form.email || !consent}
                            className="w-full mt-6 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <CalendarDays size={16} />}
                            Confirmer le rendez-vous
                        </button>
                        <button onClick={() => setStep(2)} className="text-xs text-gray-500 hover:text-white mt-3 flex items-center gap-1 mx-auto"><ChevronLeft size={12} /> <T>Modifier la date</T></button>
                    </div>
                </motion.div>
            )}
        </div>
    )
}
