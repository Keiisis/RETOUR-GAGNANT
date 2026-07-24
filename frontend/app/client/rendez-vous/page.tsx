'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Calendar, Clock, Plus, Loader2, CheckCircle2, AlertCircle, MapPin, Video, Phone, User, X } from 'lucide-react'

interface Rdv {
    id: string
    date: string
    heure: string
    type: 'presentiel' | 'visio' | 'telephone'
    motif: string
    statut: 'en_attente' | 'confirme' | 'annule' | 'termine'
    notes?: string
    created_at: string
}

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    presentiel: { label: 'Présentiel', icon: <MapPin size={12} />, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    visio: { label: 'Visioconférence', icon: <Video size={12} />, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
    telephone: { label: 'Téléphone', icon: <Phone size={12} />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
}

const STATUT_LABELS: Record<string, { label: string; color: string }> = {
    en_attente: { label: 'En attente', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
    confirme: { label: 'Confirmé', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    annule: { label: 'Annulé', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    termine: { label: 'Terminé', color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
}

const MOTIFS = [
    'Suivi de dossier nationalité',
    'Signature de documents',
    'Présentation de proposition de voyage',
    'Consultation investissement immobilier',
    'Renseignements généraux',
    'Autre',
]

export default function ClientRendezVousPage() {
    const [rdvs, setRdvs] = useState<Rdv[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState('')
    const [clientEmail, setClientEmail] = useState('')
    const [clientId, setClientId] = useState('')
    const [clientName, setClientName] = useState('')
    const [form, setForm] = useState({
        date: '',
        heure: '10:00',
        type: 'visio',
        motif: '',
        motifCustom: '',
        notes: '',
    })

    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) return
            const email = session.user.email || ''
            setClientEmail(email)
            setClientId(session.user.id)
            // Récupérer le nom depuis les métadonnées ou client_profiles
            const meta = session.user.user_metadata
            const name = meta?.full_name || meta?.name || email.split('@')[0]
            setClientName(name)

            const { data } = await supabase
                .from('rdv_requests')
                .select('*')
                .or(`client_id.eq.${session.user.id},client_email.eq.${email}`)
                .order('date', { ascending: true })

            setRdvs((data as Rdv[]) || [])
            setLoading(false)
        }
        load()
    }, [])

    // Annulation d'un RDV à venir. L'API vérifie côté serveur que le RDV
    // appartient bien au client et qu'il est encore annulable.
    const handleCancel = async (rdvId: string) => {
        if (!confirm('Annuler ce rendez-vous ?')) return
        try {
            const res = await fetch(`/api/rdv/${rdvId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ statut: 'annule' }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) { alert(data.error || 'Annulation impossible'); return }
            setRdvs(prev => prev.map(r => r.id === rdvId ? { ...r, statut: 'annule' } : r))
        } catch {
            alert('Erreur réseau. Réessayez.')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.date || !form.heure || !form.motif) return
        setSending(true)
        setError('')

        try {
            const motifFinal = form.motif === 'Autre' ? form.motifCustom : form.motif
            const { data: insertedRdv, error: insertErr } = await supabase
                .from('rdv_requests')
                .insert({
                    client_id: clientId,
                    client_email: clientEmail,
                    date: form.date,
                    heure: form.heure,
                    type: form.type,
                    motif: motifFinal,
                    notes: form.notes || null,
                    statut: 'en_attente',
                })
                .select('id')
                .single()

            if (insertErr) throw new Error(insertErr.message)

            // Fire-and-forget : email de confirmation
            fetch('/api/rdv/confirm-client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rdvId: insertedRdv?.id,
                    clientName,
                    clientEmail,
                    service: motifFinal,
                    date: form.date,
                    heure: form.heure,
                    type: form.type,
                }),
            }).catch(console.error);

            // Reload
            const { data } = await supabase
                .from('rdv_requests')
                .select('*')
                .or(`client_id.eq.${clientId},client_email.eq.${clientEmail}`)
                .order('date', { ascending: true })

            setRdvs((data as Rdv[]) || [])
            setForm({ date: '', heure: '10:00', type: 'visio', motif: '', motifCustom: '', notes: '' })
            setSent(true)
            setShowForm(false)
            setTimeout(() => setSent(false), 4000)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de la demande.')
        }
        setSending(false)
    }

    const upcoming = rdvs.filter(r => r.statut !== 'annule' && r.statut !== 'termine' && new Date(r.date) >= new Date())
    const past = rdvs.filter(r => r.statut === 'termine' || (r.statut !== 'annule' && new Date(r.date) < new Date()))

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Calendar size={14} className="text-blue-400" />
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.3em]">Agenda</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Rendez-vous</h1>
                    <p className="text-gray-500 text-sm mt-1">Planifiez un échange avec votre agent.</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold px-4 h-10 rounded-xl text-sm shadow-[0_4px_20px_rgba(59,130,246,0.3)]"
                >
                    <Plus size={15} /> Demander un RDV
                </motion.button>
            </div>

            <AnimatePresence>
                {sent && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                            <CheckCircle2 size={14} className="text-emerald-400" />
                            <p className="text-emerald-400 text-sm font-bold">Demande de rendez-vous envoyée ! Votre agent vous confirmera sous 24h.</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Prochains RDVs */}
            <div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] mb-3">À venir ({upcoming.length})</h2>
                {loading ? (
                    <div className="flex items-center justify-center p-10">
                        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                ) : upcoming.length === 0 ? (
                    <div className="bg-[#0a1221] border border-white/[0.06] rounded-2xl p-8 text-center">
                        <Calendar size={28} className="text-gray-700 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">Aucun rendez-vous à venir.</p>
                        <button onClick={() => setShowForm(true)} className="mt-3 text-blue-400 text-sm font-bold hover:text-blue-300 transition-colors">
                            + Planifier un rendez-vous
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {upcoming.map(rdv => <RdvCard key={rdv.id} rdv={rdv} onCancel={handleCancel} />)}
                    </div>
                )}
            </div>

            {/* Historique */}
            {past.length > 0 && (
                <div>
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] mb-3">Historique ({past.length})</h2>
                    <div className="space-y-3">
                        {past.map(rdv => <RdvCard key={rdv.id} rdv={rdv} />)}
                        {/* Les RDV passés/terminés ne sont plus annulables : pas de callback. */}
                    </div>
                </div>
            )}

            {/* Modal demande RDV */}
            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.96 }}
                            className="w-full max-w-md bg-[#0a1221] border border-white/[0.08] rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                        >
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="font-black text-white text-base flex items-center gap-2">
                                    <Calendar size={16} className="text-blue-400" /> Demander un rendez-vous
                                </h2>
                                <button onClick={() => setShowForm(false)} className="text-gray-600 hover:text-white transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            <AnimatePresence>
                                {error && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
                                        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/8 border border-red-500/15">
                                            <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                                            <p className="text-red-400 text-[12px]">{error}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">Date *</label>
                                        <input type="date" required value={form.date} min={new Date().toISOString().split('T')[0]}
                                            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                            className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/40 rounded-xl py-2.5 px-3 text-white focus:outline-none text-sm transition-colors" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">Heure *</label>
                                        <input type="time" required value={form.heure}
                                            onChange={e => setForm(f => ({ ...f, heure: e.target.value }))}
                                            className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/40 rounded-xl py-2.5 px-3 text-white focus:outline-none text-sm transition-colors" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">Type de rendez-vous *</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['visio', 'telephone', 'presentiel'] as const).map(type => {
                                            const t = TYPE_LABELS[type]
                                            return (
                                                <button key={type} type="button"
                                                    onClick={() => setForm(f => ({ ...f, type }))}
                                                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-[11px] font-bold transition-all ${form.type === type ? `${t.color} border-current` : 'bg-white/[0.03] border-white/[0.06] text-gray-500 hover:border-white/20'}`}
                                                >
                                                    {t.icon}{t.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">Motif *</label>
                                    <select required value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
                                        className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/40 rounded-xl py-2.5 px-3 text-white focus:outline-none text-sm transition-colors">
                                        <option value="">Sélectionner...</option>
                                        {MOTIFS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>

                                {form.motif === 'Autre' && (
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">Précisez *</label>
                                        <input type="text" required value={form.motifCustom}
                                            onChange={e => setForm(f => ({ ...f, motifCustom: e.target.value }))}
                                            placeholder="Décrivez votre motif..."
                                            className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/40 rounded-xl py-2.5 px-3 text-white placeholder:text-gray-600 focus:outline-none text-sm transition-colors" />
                                    </div>
                                )}

                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">Notes (optionnel)</label>
                                    <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                        placeholder="Informations complémentaires..."
                                        className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/40 rounded-xl py-2.5 px-3 text-white placeholder:text-gray-600 focus:outline-none text-sm resize-none transition-colors" />
                                </div>

                                <div className="flex gap-3 pt-1">
                                    <button type="button" onClick={() => setShowForm(false)}
                                        className="flex-1 h-10 rounded-xl border border-white/[0.08] text-gray-400 text-sm font-bold hover:border-white/20 transition-colors">
                                        Annuler
                                    </button>
                                    <motion.button type="submit" disabled={sending} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                                        className="flex-1 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                        {sending ? <Loader2 className="animate-spin" size={15} /> : <><Calendar size={13} /> Envoyer la demande</>}
                                    </motion.button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function RdvCard({ rdv, onCancel }: { rdv: Rdv; onCancel?: (id: string) => void }) {
    const type = TYPE_LABELS[rdv.type] || TYPE_LABELS.visio
    const statut = STATUT_LABELS[rdv.statut] || STATUT_LABELS.en_attente
    const dateObj = new Date(rdv.date)
    const isUpcoming = rdv.statut !== 'annule' && rdv.statut !== 'termine'
    // Annulable seulement si à venir ET si le parent a fourni le callback
    // (les RDV passés n'en reçoivent pas).
    const annulable = isUpcoming && !!onCancel

    return (
        <div className={`bg-[#0a1221] border rounded-2xl p-4 transition-colors ${isUpcoming ? 'border-white/[0.08] hover:border-blue-500/20' : 'border-white/[0.04] opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${isUpcoming ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-white/[0.04] border border-white/[0.06]'}`}>
                        <span className={`text-lg font-black leading-none ${isUpcoming ? 'text-blue-400' : 'text-gray-600'}`}>
                            {dateObj.getDate()}
                        </span>
                        <span className={`text-[9px] font-bold uppercase ${isUpcoming ? 'text-blue-400/70' : 'text-gray-700'}`}>
                            {dateObj.toLocaleDateString('fr-FR', { month: 'short' })}
                        </span>
                    </div>
                    <div>
                        <p className="font-bold text-white text-sm">{rdv.motif}</p>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1 text-[11px] text-gray-500">
                                <Clock size={10} /> {rdv.heure}
                            </span>
                            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${type.color}`}>
                                {type.icon} {type.label}
                            </span>
                        </div>
                        {rdv.notes && <p className="text-[11px] text-gray-600 mt-1">{rdv.notes}</p>}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statut.color}`}>
                        {statut.label}
                    </span>
                    {annulable && (
                        <button
                            type="button"
                            onClick={() => onCancel!(rdv.id)}
                            className="text-[10px] font-bold text-red-400/80 hover:text-red-400 transition-colors"
                        >
                            Annuler
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
