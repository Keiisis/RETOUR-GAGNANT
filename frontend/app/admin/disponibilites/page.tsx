'use client'

// ══════════════════════════════════════════════════════════════
//  ADMIN — DISPONIBILITÉS & CRÉNEAUX
//  Horaires récurrents (par jour de semaine) + fermetures ou
//  ouvertures exceptionnelles. Les créneaux proposés aux clients
//  en découlent automatiquement — rien n'est figé en base.
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    CalendarDays, Plus, Trash2, Loader2, RefreshCw, AlertTriangle,
    Clock, Eye, EyeOff, CalendarX2, CalendarCheck2, Users,
} from 'lucide-react'

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const ACCENT = '#008751'

interface Rule {
    id: string; weekday: number; start_time: string; end_time: string
    slot_minutes: number; capacity: number; service: string | null; is_active: boolean
}
interface Exception {
    id: string; date: string; kind: 'closed' | 'open'
    start_time: string | null; end_time: string | null
    capacity: number | null; service: string | null; reason: string | null
}
interface DaySlots { date: string; ferme: boolean; motif?: string; slots: Array<{ heure: string; restant: number }> }

export default function DisponibilitesPage() {
    const [rules, setRules] = useState<Rule[]>([])
    const [exceptions, setExceptions] = useState<Exception[]>([])
    const [apercu, setApercu] = useState<DaySlots[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const [newRule, setNewRule] = useState({ weekday: 1, start_time: '09:00', end_time: '17:00', slot_minutes: 30, capacity: 1 })
    const [newExc, setNewExc] = useState({ date: '', exception_kind: 'closed' as 'closed' | 'open', start_time: '', end_time: '', reason: '' })

    const load = useCallback(async () => {
        setLoading(true); setError('')
        try {
            const res = await fetch('/api/admin/availability', { cache: 'no-store' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Chargement impossible')
            setRules(data.rules || []); setExceptions(data.exceptions || [])
            const ap = await fetch('/api/availability?days=7', { cache: 'no-store' }).then(r => r.json())
            setApercu(ap.jours || [])
        } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const post = async (payload: Record<string, unknown>) => {
        setSaving(true); setError('')
        try {
            const res = await fetch('/api/admin/availability', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Enregistrement impossible')
            load()
        } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
        setSaving(false)
    }

    const toggleRule = async (r: Rule) => {
        await fetch('/api/admin/availability', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: r.id, is_active: !r.is_active }),
        })
        load()
    }

    const remove = async (id: string, kind: 'rule' | 'exception') => {
        await fetch(`/api/admin/availability?id=${id}&kind=${kind}`, { method: 'DELETE' })
        load()
    }

    const parJour = useMemo(() => {
        const m: Record<number, Rule[]> = {}
        for (const r of rules) (m[r.weekday] ||= []).push(r)
        return m
    }, [rules])

    const card = {
        backgroundColor: 'var(--panel-surface, rgba(255,255,255,0.03))',
        borderColor: 'var(--panel-border, rgba(255,255,255,0.08))',
    }
    const lblStyle = { color: 'var(--panel-text-muted, #9CA3AF)' }
    const field = 'w-full bg-transparent border rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#008751] transition-colors'
    const fieldStyle = { borderColor: 'var(--panel-border, rgba(255,255,255,0.12))', color: 'var(--panel-text, #E5E7EB)' }

    return (
        <div className="min-h-screen py-8 px-4" style={{ backgroundColor: 'var(--panel-bg, #0a0f14)' }}>
            <div className="max-w-5xl mx-auto">

                <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: ACCENT }}>Rendez-vous</span>
                        <h1 className="text-2xl font-black flex items-center gap-2.5 mt-1" style={{ color: 'var(--panel-text-heading, #fff)' }}>
                            <CalendarDays size={22} style={{ color: ACCENT }} /> Disponibilités
                        </h1>
                        <p className="text-xs mt-1 max-w-2xl leading-relaxed" style={lblStyle}>
                            Les créneaux proposés aux clients sont calculés automatiquement : horaires récurrents, moins les
                            fermetures exceptionnelles, moins les rendez-vous déjà pris.
                        </p>
                    </div>
                    <button type="button" onClick={load} title="Rafraîchir"
                        className="p-2.5 rounded-xl border transition-colors hover:text-white" style={{ ...card, color: 'var(--panel-text-muted, #9CA3AF)' }}>
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {error && (
                    <div className="mb-5 rounded-2xl border px-4 py-3 text-[13px] flex items-start gap-2.5"
                        style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                        <AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>{error}</span>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin" style={{ color: ACCENT }} /></div>
                ) : (
                    <div className="space-y-6">

                        {/* ── Horaires récurrents ── */}
                        <section className="border rounded-2xl p-5" style={card}>
                            <h2 className="flex items-center gap-2 text-sm font-black mb-4" style={{ color: 'var(--panel-text-heading, #fff)' }}>
                                <Clock size={15} style={{ color: ACCENT }} /> Horaires d&apos;ouverture
                            </h2>

                            <div className="space-y-3 mb-5">
                                {JOURS.map((nom, wd) => (
                                    <div key={wd} className="flex items-start gap-3 flex-wrap">
                                        <span className="w-24 text-[12px] font-bold pt-1.5 shrink-0" style={lblStyle}>{nom}</span>
                                        <div className="flex-1 flex flex-wrap gap-2 min-w-[220px]">
                                            {(parJour[wd] || []).length === 0 && (
                                                <span className="text-[11px] italic pt-1.5" style={{ color: 'var(--panel-text-muted, #6B7280)' }}>Fermé</span>
                                            )}
                                            {(parJour[wd] || []).map(r => (
                                                <span key={r.id}
                                                    className="inline-flex items-center gap-2 text-[11px] font-bold px-2.5 py-1.5 rounded-xl border"
                                                    style={{
                                                        borderColor: r.is_active ? 'rgba(0,135,81,0.35)' : 'var(--panel-border, rgba(255,255,255,0.1))',
                                                        backgroundColor: r.is_active ? 'rgba(0,135,81,0.08)' : 'transparent',
                                                        color: r.is_active ? '#00c870' : 'var(--panel-text-muted, #6B7280)',
                                                    }}>
                                                    {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                                                    <span className="opacity-60">· {r.slot_minutes}min</span>
                                                    {r.capacity > 1 && <span className="inline-flex items-center gap-0.5 opacity-70"><Users size={9} />{r.capacity}</span>}
                                                    <button type="button" title={r.is_active ? 'Désactiver' : 'Activer'} onClick={() => toggleRule(r)}
                                                        className="opacity-60 hover:opacity-100">
                                                        {r.is_active ? <Eye size={11} /> : <EyeOff size={11} />}
                                                    </button>
                                                    <button type="button" title="Supprimer" onClick={() => remove(r.id, 'rule')}
                                                        className="opacity-60 hover:opacity-100 hover:text-red-400"><Trash2 size={11} /></button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-4 border-t" style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.06))' }}>
                                <select title="Jour" className={field} style={fieldStyle} value={newRule.weekday}
                                    onChange={e => setNewRule({ ...newRule, weekday: Number(e.target.value) })}>
                                    {JOURS.map((j, i) => <option key={i} value={i}>{j}</option>)}
                                </select>
                                <input type="time" title="Début" className={field} style={fieldStyle} value={newRule.start_time}
                                    onChange={e => setNewRule({ ...newRule, start_time: e.target.value })} />
                                <input type="time" title="Fin" className={field} style={fieldStyle} value={newRule.end_time}
                                    onChange={e => setNewRule({ ...newRule, end_time: e.target.value })} />
                                <input type="number" min={5} step={5} title="Durée d'un créneau (min)" className={field} style={fieldStyle}
                                    value={newRule.slot_minutes} onChange={e => setNewRule({ ...newRule, slot_minutes: Number(e.target.value) })} />
                                <input type="number" min={1} title="RDV simultanés" className={field} style={fieldStyle}
                                    value={newRule.capacity} onChange={e => setNewRule({ ...newRule, capacity: Number(e.target.value) })} />
                                <button type="button" disabled={saving} onClick={() => post({ kind: 'rule', ...newRule })}
                                    className="flex items-center justify-center gap-1.5 rounded-xl text-[12px] font-black text-white disabled:opacity-50 transition-all hover:brightness-110"
                                    style={{ backgroundColor: ACCENT }}>
                                    <Plus size={14} /> Ajouter
                                </button>
                            </div>
                        </section>

                        {/* ── Exceptions ── */}
                        <section className="border rounded-2xl p-5" style={card}>
                            <h2 className="flex items-center gap-2 text-sm font-black mb-1" style={{ color: 'var(--panel-text-heading, #fff)' }}>
                                <CalendarX2 size={15} className="text-amber-400" /> Fermetures & ouvertures exceptionnelles
                            </h2>
                            <p className="text-[11px] mb-4" style={lblStyle}>
                                Sans heures : journée entière. Avec heures : uniquement cette plage.
                            </p>

                            <div className="space-y-2 mb-5">
                                {exceptions.length === 0 && (
                                    <p className="text-[12px] italic" style={{ color: 'var(--panel-text-muted, #6B7280)' }}>Aucune exception à venir.</p>
                                )}
                                {exceptions.map(e => (
                                    <div key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2 border" style={card}>
                                        {e.kind === 'closed'
                                            ? <CalendarX2 size={14} className="text-red-400 shrink-0" />
                                            : <CalendarCheck2 size={14} className="text-emerald-400 shrink-0" />}
                                        <span className="text-[12px] font-bold font-mono" style={{ color: 'var(--panel-text, #E5E7EB)' }}>
                                            {new Date(e.date + 'T12:00:00Z').toLocaleDateString('fr-FR')}
                                        </span>
                                        <span className="text-[11px]" style={lblStyle}>
                                            {e.start_time ? `${e.start_time.slice(0, 5)}–${(e.end_time || '').slice(0, 5)}` : 'Journée entière'}
                                            {e.reason ? ` · ${e.reason}` : ''}
                                        </span>
                                        <button type="button" title="Supprimer" onClick={() => remove(e.id, 'exception')}
                                            className="ml-auto p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 size={13} /></button>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-4 border-t" style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.06))' }}>
                                <input type="date" title="Date" className={field} style={fieldStyle} value={newExc.date}
                                    onChange={e => setNewExc({ ...newExc, date: e.target.value })} />
                                <select title="Type" className={field} style={fieldStyle} value={newExc.exception_kind}
                                    onChange={e => setNewExc({ ...newExc, exception_kind: e.target.value as 'closed' | 'open' })}>
                                    <option value="closed">Fermeture</option>
                                    <option value="open">Ouverture</option>
                                </select>
                                <input type="time" title="Début (optionnel)" className={field} style={fieldStyle} value={newExc.start_time}
                                    onChange={e => setNewExc({ ...newExc, start_time: e.target.value })} />
                                <input type="time" title="Fin (optionnel)" className={field} style={fieldStyle} value={newExc.end_time}
                                    onChange={e => setNewExc({ ...newExc, end_time: e.target.value })} />
                                <input type="text" title="Motif" placeholder="Motif" className={field} style={fieldStyle} value={newExc.reason}
                                    onChange={e => setNewExc({ ...newExc, reason: e.target.value })} />
                                <button type="button" disabled={saving || !newExc.date}
                                    onClick={() => post({
                                        kind: 'exception', date: newExc.date, exception_kind: newExc.exception_kind,
                                        start_time: newExc.start_time || null, end_time: newExc.end_time || null,
                                        reason: newExc.reason || null,
                                    })}
                                    className="flex items-center justify-center gap-1.5 rounded-xl text-[12px] font-black text-white disabled:opacity-50 transition-all hover:brightness-110"
                                    style={{ backgroundColor: '#B45309' }}>
                                    <Plus size={14} /> Ajouter
                                </button>
                            </div>
                        </section>

                        {/* ── Aperçu 7 jours ── */}
                        <section className="border rounded-2xl p-5" style={card}>
                            <h2 className="text-sm font-black mb-1" style={{ color: 'var(--panel-text-heading, #fff)' }}>
                                Aperçu — ce que voit le client
                            </h2>
                            <p className="text-[11px] mb-4" style={lblStyle}>7 prochains jours, créneaux réellement réservables.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {apercu.map(j => (
                                    <motion.div key={j.date} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                        className="border rounded-xl p-3" style={card}>
                                        <p className="text-[11px] font-black mb-2" style={{ color: 'var(--panel-text-heading, #fff)' }}>
                                            {new Date(j.date + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                                        </p>
                                        {j.ferme ? (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                style={{ backgroundColor: 'rgba(107,114,128,0.15)', color: '#9CA3AF' }}>
                                                {j.motif || 'Fermé'}
                                            </span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {j.slots.slice(0, 10).map(s => (
                                                    <span key={s.heure} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                                        style={{ backgroundColor: 'rgba(0,135,81,0.12)', color: '#00c870' }}>{s.heure}</span>
                                                ))}
                                                {j.slots.length > 10 && (
                                                    <span className="text-[10px]" style={lblStyle}>+{j.slots.length - 10}</span>
                                                )}
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    )
}
