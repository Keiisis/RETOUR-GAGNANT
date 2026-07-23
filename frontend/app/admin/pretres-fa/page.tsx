'use client'

// ══════════════════════════════════════════════════════════════
//  ADMIN — PRÊTRES FA (Bokonon)
//  Annuaire complet : identité, prestations, galerie, certifications,
//  notation et modération des avis. Aucune donnée codée en dur :
//  tout vient de la table fa_priests / fa_priest_reviews.
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sparkles, Plus, Search, X, Star, MapPin, Trash2, Pencil, Save,
    Image as ImageIcon, Award, Briefcase, MessageSquare, Loader2,
    Eye, EyeOff, RefreshCw, GripVertical, Languages, Phone, Mail,
    CheckCircle2, AlertTriangle, UserRound,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────
interface Prestation { label: string; description?: string; price?: string; [k: string]: string | undefined }
interface Certification { label: string; issuer?: string; year?: string; [k: string]: string | undefined }
interface Priest {
    id: string
    nom: string; prenom: string; titre: string | null
    localisation: string | null; bio: string | null; photo_url: string | null
    prestations: Prestation[]; gallery: string[]; certifications: Certification[]
    langues: string[]; experience_ans: number | null
    telephone: string | null; email: string | null
    is_active: boolean; order_index: number
    rating_avg: number; rating_count: number; reviews_pending: number
}
interface Review {
    id: string; priest_id: string; author_name: string; author_email: string | null
    rating: number; comment: string | null; is_published: boolean; created_at: string
}

const EMPTY: Omit<Priest, 'id' | 'rating_avg' | 'rating_count' | 'reviews_pending'> = {
    nom: '', prenom: '', titre: '', localisation: '', bio: '', photo_url: '',
    prestations: [], gallery: [], certifications: [], langues: [],
    experience_ans: null, telephone: '', email: '', is_active: true, order_index: 0,
}

const ACCENT = '#7C5CCA'

// ─── Étoiles ──────────────────────────────────────────────────
function Stars({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
    const [hover, setHover] = useState(0)
    const shown = hover || value
    return (
        <div className="flex items-center gap-0.5" role={onChange ? 'radiogroup' : undefined} aria-label="Note">
            {[1, 2, 3, 4, 5].map(i => (
                <button
                    key={i}
                    type="button"
                    disabled={!onChange}
                    aria-label={`${i} étoile${i > 1 ? 's' : ''}`}
                    onClick={() => onChange?.(i)}
                    onMouseEnter={() => onChange && setHover(i)}
                    onMouseLeave={() => onChange && setHover(0)}
                    className={onChange ? 'transition-transform hover:scale-125 cursor-pointer' : 'cursor-default'}
                >
                    <Star
                        size={size}
                        className={i <= Math.round(shown) ? 'text-amber-400' : 'text-gray-600'}
                        fill={i <= Math.round(shown) ? '#fbbf24' : 'none'}
                    />
                </button>
            ))}
        </div>
    )
}

// ─── Éditeur de liste dynamique (prestations / certifications) ─
function RowEditor<T extends Record<string, string | undefined>>({
    title, icon: Icon, rows, fields, onChange, addLabel,
}: {
    title: string
    icon: typeof Award
    rows: T[]
    fields: Array<{ key: keyof T & string; placeholder: string; wide?: boolean }>
    onChange: (rows: T[]) => void
    addLabel: string
}) {
    const update = (i: number, key: string, v: string) => {
        const next = [...rows]; next[i] = { ...next[i], [key]: v } as T; onChange(next)
    }
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--panel-text-muted, #9CA3AF)' }}>
                    <Icon size={13} style={{ color: ACCENT }} /> {title}
                </label>
                <button type="button" onClick={() => onChange([...rows, {} as T])}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all hover:border-[#7C5CCA]"
                    style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.12))', color: ACCENT }}>
                    + {addLabel}
                </button>
            </div>
            <div className="space-y-2">
                {rows.length === 0 && (
                    <p className="text-[11px] italic px-1" style={{ color: 'var(--panel-text-muted, #6B7280)' }}>Aucune entrée — cliquez sur « + {addLabel} ».</p>
                )}
                {rows.map((r, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-2 rounded-xl p-2 border"
                        style={{ backgroundColor: 'var(--panel-surface-alt, rgba(255,255,255,0.03))', borderColor: 'var(--panel-border, rgba(255,255,255,0.08))' }}>
                        <GripVertical size={13} className="mt-2.5 opacity-30 shrink-0" />
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 flex-1">
                            {fields.map(f => (
                                <input
                                    key={f.key}
                                    value={(r[f.key] as string) || ''}
                                    onChange={e => update(i, f.key, e.target.value)}
                                    placeholder={f.placeholder}
                                    title={f.placeholder}
                                    className={`${f.wide ? 'sm:col-span-6' : 'sm:col-span-3'} bg-transparent border rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:border-[#7C5CCA] transition-colors`}
                                    style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.12))', color: 'var(--panel-text, #E5E7EB)' }}
                                />
                            ))}
                        </div>
                        <button type="button" title="Retirer" onClick={() => onChange(rows.filter((_, k) => k !== i))}
                            className="mt-1.5 p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0">
                            <Trash2 size={13} />
                        </button>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}

// ─── Éditeur de tags simples (langues) / URLs (galerie) ───────
function TagEditor({ title, icon: Icon, values, onChange, placeholder }: {
    title: string; icon: typeof Languages; values: string[]; onChange: (v: string[]) => void; placeholder: string
}) {
    const [draft, setDraft] = useState('')
    const add = () => { const v = draft.trim(); if (!v) return; onChange([...values, v]); setDraft('') }
    return (
        <div>
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--panel-text-muted, #9CA3AF)' }}>
                <Icon size={13} style={{ color: ACCENT }} /> {title}
            </label>
            <div className="flex gap-2 mb-2">
                <input value={draft} onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
                    placeholder={placeholder} title={placeholder}
                    className="flex-1 bg-transparent border rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#7C5CCA] transition-colors"
                    style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.12))', color: 'var(--panel-text, #E5E7EB)' }} />
                <button type="button" onClick={add} className="px-3 rounded-xl text-[11px] font-bold border transition-all hover:border-[#7C5CCA]"
                    style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.12))', color: ACCENT }}>Ajouter</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {values.map((v, i) => (
                    <span key={i} className="group inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                        style={{ backgroundColor: 'rgba(124,92,202,0.10)', borderColor: 'rgba(124,92,202,0.28)', color: ACCENT }}>
                        <span className="max-w-[220px] truncate">{v}</span>
                        <button type="button" title="Retirer" onClick={() => onChange(values.filter((_, k) => k !== i))}
                            className="opacity-50 group-hover:opacity-100 hover:text-red-400 transition-all"><X size={11} /></button>
                    </span>
                ))}
            </div>
        </div>
    )
}

// ══════════════════════════════════════════════════════════════
export default function PretresFaPage() {
    const [priests, setPriests] = useState<Priest[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [q, setQ] = useState('')
    const [editing, setEditing] = useState<(typeof EMPTY & { id?: string }) | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Priest | null>(null)
    const [reviewsFor, setReviewsFor] = useState<Priest | null>(null)
    const [reviews, setReviews] = useState<Review[]>([])
    const [newReview, setNewReview] = useState({ author_name: '', rating: 5, comment: '' })

    const fetchPriests = useCallback(async () => {
        setLoading(true); setError('')
        try {
            const res = await fetch('/api/admin/fa-priests', { cache: 'no-store' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Chargement impossible')
            setPriests(data.priests || [])
        } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
        setLoading(false)
    }, [])

    useEffect(() => { fetchPriests() }, [fetchPriests])

    const save = async () => {
        if (!editing?.nom?.trim()) { setError('Le nom est obligatoire.'); return }
        setSaving(true); setError('')
        try {
            const res = await fetch('/api/admin/fa-priests', {
                method: editing.id ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editing),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Enregistrement impossible')
            setEditing(null); fetchPriests()
        } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
        setSaving(false)
    }

    const remove = async () => {
        if (!deleteTarget) return
        await fetch(`/api/admin/fa-priests?id=${deleteTarget.id}`, { method: 'DELETE' })
        setDeleteTarget(null); fetchPriests()
    }

    const openReviews = async (p: Priest) => {
        setReviewsFor(p); setReviews([])
        const res = await fetch(`/api/admin/fa-priests/reviews?priest_id=${p.id}`, { cache: 'no-store' })
        const data = await res.json()
        setReviews(data.reviews || [])
    }

    const togglePublish = async (r: Review) => {
        await fetch('/api/admin/fa-priests/reviews', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: r.id, is_published: !r.is_published }),
        })
        setReviews(rs => rs.map(x => x.id === r.id ? { ...x, is_published: !x.is_published } : x))
        fetchPriests()
    }

    const deleteReview = async (r: Review) => {
        await fetch(`/api/admin/fa-priests/reviews?id=${r.id}`, { method: 'DELETE' })
        setReviews(rs => rs.filter(x => x.id !== r.id)); fetchPriests()
    }

    const addReview = async () => {
        if (!reviewsFor || !newReview.author_name.trim()) return
        const res = await fetch('/api/admin/fa-priests/reviews', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newReview, priest_id: reviewsFor.id, is_published: true }),
        })
        if (res.ok) { setNewReview({ author_name: '', rating: 5, comment: '' }); openReviews(reviewsFor); fetchPriests() }
    }

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase()
        if (!s) return priests
        return priests.filter(p =>
            `${p.prenom} ${p.nom} ${p.titre || ''} ${p.localisation || ''}`.toLowerCase().includes(s))
    }, [priests, q])

    const kpis = useMemo(() => ({
        total: priests.length,
        actifs: priests.filter(p => p.is_active).length,
        avis: priests.reduce((a, p) => a + p.rating_count, 0),
        enAttente: priests.reduce((a, p) => a + p.reviews_pending, 0),
    }), [priests])

    const card = {
        backgroundColor: 'var(--panel-surface, rgba(255,255,255,0.03))',
        borderColor: 'var(--panel-border, rgba(255,255,255,0.08))',
    }
    const field = 'w-full bg-transparent border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#7C5CCA] transition-colors'
    const fieldStyle = { borderColor: 'var(--panel-border, rgba(255,255,255,0.12))', color: 'var(--panel-text, #E5E7EB)' }
    const lbl = 'block text-[10px] font-black uppercase tracking-widest mb-1.5'
    const lblStyle = { color: 'var(--panel-text-muted, #9CA3AF)' }

    return (
        <div className="min-h-screen py-8 px-4" style={{ backgroundColor: 'var(--panel-bg, #0a0f14)' }}>
            <div className="max-w-6xl mx-auto">

                {/* ── En-tête ── */}
                <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: ACCENT }}>Annuaire spirituel</span>
                        <h1 className="text-2xl font-black flex items-center gap-2.5 mt-1" style={{ color: 'var(--panel-text-heading, #fff)' }}>
                            <Sparkles size={22} style={{ color: ACCENT }} /> Prêtres Fa
                        </h1>
                        <p className="text-xs mt-1 max-w-xl leading-relaxed" style={lblStyle}>
                            Bokonons référencés : identité, prestations, galerie, certifications et avis clients modérés.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={fetchPriests} title="Rafraîchir"
                            className="p-2.5 rounded-xl border transition-colors hover:text-white" style={{ ...card, color: 'var(--panel-text-muted, #9CA3AF)' }}>
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button type="button" onClick={() => { setEditing({ ...EMPTY }); setError('') }}
                            className="flex items-center gap-2 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all hover:brightness-110"
                            style={{ backgroundColor: ACCENT, boxShadow: '0 10px 30px rgba(124,92,202,0.25)' }}>
                            <Plus size={16} /> Nouveau prêtre
                        </button>
                    </div>
                </div>

                {/* ── KPIs ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {[
                        { label: 'Prêtres référencés', value: kpis.total, icon: UserRound, tone: ACCENT },
                        { label: 'Actifs (visibles)', value: kpis.actifs, icon: CheckCircle2, tone: '#10B981' },
                        { label: 'Avis publiés', value: kpis.avis, icon: MessageSquare, tone: '#FCD116' },
                        { label: 'Avis à modérer', value: kpis.enAttente, icon: AlertTriangle, tone: kpis.enAttente > 0 ? '#F59E0B' : '#6B7280' },
                    ].map(k => (
                        <div key={k.label} className="border rounded-2xl p-4" style={card}>
                            <div className="flex items-center gap-2 mb-1.5">
                                <k.icon size={14} style={{ color: k.tone }} />
                                <span className="text-[10px] font-bold uppercase tracking-widest" style={lblStyle}>{k.label}</span>
                            </div>
                            <p className="text-2xl font-black font-mono" style={{ color: 'var(--panel-text-heading, #fff)' }}>{k.value}</p>
                        </div>
                    ))}
                </div>

                {/* ── Recherche ── */}
                <div className="relative mb-5">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un prêtre, une ville…" title="Rechercher"
                        className="w-full border rounded-2xl pl-10 pr-4 py-3 text-sm outline-none focus:border-[#7C5CCA] transition-colors"
                        style={{ ...card, color: 'var(--panel-text, #E5E7EB)' }} />
                </div>

                {error && !editing && (
                    <div className="mb-5 rounded-2xl border px-4 py-3 text-[13px] flex items-start gap-2.5"
                        style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                        <AlertTriangle size={15} className="mt-0.5 shrink-0" /> <span>{error}</span>
                    </div>
                )}

                {/* ── Liste ── */}
                {loading ? (
                    <div className="flex items-center justify-center py-24"><Loader2 size={26} className="animate-spin" style={{ color: ACCENT }} /></div>
                ) : filtered.length === 0 ? (
                    <div className="border rounded-2xl py-20 text-center" style={card}>
                        <Sparkles size={28} className="mx-auto mb-3 opacity-30" style={{ color: ACCENT }} />
                        <p className="text-sm font-bold" style={{ color: 'var(--panel-text, #E5E7EB)' }}>Aucun prêtre référencé</p>
                        <p className="text-xs mt-1" style={lblStyle}>Ajoutez votre premier Bokonon pour l&apos;afficher sur le site.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {filtered.map((p, i) => (
                            <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}
                                className="group border rounded-2xl p-5 transition-all hover:border-[#7C5CCA]/40" style={card}>
                                <div className="flex items-start gap-4">
                                    {/* Portrait */}
                                    <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border flex items-center justify-center"
                                        style={{ borderColor: 'rgba(124,92,202,0.25)', backgroundColor: 'rgba(124,92,202,0.08)' }}>
                                        {p.photo_url
                                            // eslint-disable-next-line @next/next/no-img-element
                                            ? <img src={p.photo_url} alt={`${p.prenom} ${p.nom}`} className="w-full h-full object-cover" />
                                            : <UserRound size={24} style={{ color: ACCENT }} />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-black truncate" style={{ color: 'var(--panel-text-heading, #fff)' }}>
                                                    {p.prenom} {p.nom}
                                                </p>
                                                <p className="text-[11px] truncate" style={lblStyle}>
                                                    {p.titre || 'Bokonon'}{p.localisation ? <> · <MapPin size={10} className="inline -mt-0.5" /> {p.localisation}</> : null}
                                                </p>
                                            </div>
                                            <span className="text-[9px] font-black px-2 py-1 rounded-full shrink-0"
                                                style={p.is_active
                                                    ? { backgroundColor: 'rgba(16,185,129,0.12)', color: '#10B981' }
                                                    : { backgroundColor: 'rgba(107,114,128,0.15)', color: '#9CA3AF' }}>
                                                {p.is_active ? 'VISIBLE' : 'MASQUÉ'}
                                            </span>
                                        </div>

                                        {/* Note */}
                                        <div className="flex items-center gap-2 mt-2">
                                            <Stars value={p.rating_avg} />
                                            <span className="text-[11px] font-bold" style={{ color: 'var(--panel-text, #E5E7EB)' }}>
                                                {p.rating_avg > 0 ? p.rating_avg.toFixed(1) : '—'}
                                            </span>
                                            <span className="text-[10px]" style={lblStyle}>({p.rating_count} avis)</span>
                                            {p.reviews_pending > 0 && (
                                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                                                    {p.reviews_pending} à modérer
                                                </span>
                                            )}
                                        </div>

                                        {/* Compteurs */}
                                        <div className="flex flex-wrap items-center gap-1.5 mt-3">
                                            {[
                                                { icon: Briefcase, n: p.prestations?.length || 0, l: 'prestations' },
                                                { icon: Award, n: p.certifications?.length || 0, l: 'certifications' },
                                                { icon: ImageIcon, n: p.gallery?.length || 0, l: 'photos' },
                                            ].map(b => (
                                                <span key={b.l} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border"
                                                    style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.1))', color: 'var(--panel-text-muted, #9CA3AF)' }}>
                                                    <b.icon size={11} /> {b.n} {b.l}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.06))' }}>
                                    <button type="button" onClick={() => { setEditing({ ...EMPTY, ...p }); setError('') }}
                                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all hover:border-[#7C5CCA]"
                                        style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.12))', color: ACCENT }}>
                                        <Pencil size={12} /> Modifier
                                    </button>
                                    <button type="button" onClick={() => openReviews(p)}
                                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all hover:border-amber-500/50"
                                        style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.12))', color: '#FCD116' }}>
                                        <MessageSquare size={12} /> Avis
                                    </button>
                                    <button type="button" title="Supprimer" onClick={() => setDeleteTarget(p)}
                                        className="ml-auto p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* ══ MODAL ÉDITION ══ */}
            <AnimatePresence>
                {editing && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
                        onClick={() => setEditing(null)}>
                        <motion.div initial={{ scale: 0.97, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 14 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-3xl my-8 border rounded-3xl overflow-hidden shadow-2xl"
                            style={{ backgroundColor: 'var(--panel-surface, #0c1420)', borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}>

                            <div className="px-6 py-5 border-b flex items-center justify-between sticky top-0 z-10"
                                style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.08))', backgroundColor: 'var(--panel-surface, #0c1420)' }}>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: ACCENT }}>
                                        {editing.id ? 'Modification' : 'Nouveau'}
                                    </p>
                                    <h3 className="text-lg font-black" style={{ color: 'var(--panel-text-heading, #fff)' }}>
                                        {editing.id ? `${editing.prenom} ${editing.nom}`.trim() || 'Prêtre Fa' : 'Référencer un Prêtre Fa'}
                                    </h3>
                                </div>
                                <button type="button" title="Fermer" onClick={() => setEditing(null)} className="p-2 rounded-xl text-gray-500 hover:text-white transition-colors"><X size={19} /></button>
                            </div>

                            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                                {error && (
                                    <div className="rounded-xl border px-3.5 py-2.5 text-[12px] flex items-start gap-2"
                                        style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                                        <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
                                    </div>
                                )}

                                {/* Identité */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={lbl} style={lblStyle}>Prénom</label>
                                        <input className={field} style={fieldStyle} value={editing.prenom} title="Prénom" placeholder="Kossi"
                                            onChange={e => setEditing({ ...editing, prenom: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className={lbl} style={lblStyle}>Nom *</label>
                                        <input className={field} style={fieldStyle} value={editing.nom} title="Nom" placeholder="ADJOVI"
                                            onChange={e => setEditing({ ...editing, nom: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className={lbl} style={lblStyle}>Titre</label>
                                        <input className={field} style={fieldStyle} value={editing.titre || ''} title="Titre" placeholder="Bokonon, Maître du Fa…"
                                            onChange={e => setEditing({ ...editing, titre: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className={lbl} style={lblStyle}>Localisation</label>
                                        <input className={field} style={fieldStyle} value={editing.localisation || ''} title="Localisation" placeholder="Ouidah, Bénin"
                                            onChange={e => setEditing({ ...editing, localisation: e.target.value })} />
                                    </div>
                                </div>

                                <div>
                                    <label className={lbl} style={lblStyle}>Présentation</label>
                                    <textarea rows={3} className={field} style={fieldStyle} value={editing.bio || ''} title="Présentation"
                                        placeholder="Parcours, lignée, approche de la consultation…"
                                        onChange={e => setEditing({ ...editing, bio: e.target.value })} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className={lbl} style={lblStyle}>Photo principale (URL)</label>
                                        <input className={field} style={fieldStyle} value={editing.photo_url || ''} title="Photo" placeholder="https://…"
                                            onChange={e => setEditing({ ...editing, photo_url: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className={lbl} style={lblStyle}>Années d&apos;expérience</label>
                                        <input type="number" min={0} className={field} style={fieldStyle} title="Expérience"
                                            value={editing.experience_ans ?? ''} placeholder="15"
                                            onChange={e => setEditing({ ...editing, experience_ans: e.target.value === '' ? null : Number(e.target.value) })} />
                                    </div>
                                </div>

                                {/* Prestations */}
                                <RowEditor<Prestation>
                                    title="Prestations & services" icon={Briefcase} addLabel="prestation"
                                    rows={editing.prestations || []}
                                    fields={[
                                        { key: 'label', placeholder: 'Consultation du Fa', wide: true },
                                        { key: 'description', placeholder: 'Description (optionnel)', wide: true },
                                        { key: 'price', placeholder: 'Tarif (ex. 350 €)' },
                                    ]}
                                    onChange={rows => setEditing({ ...editing, prestations: rows })}
                                />

                                {/* Certifications */}
                                <RowEditor<Certification>
                                    title="Certifications & distinctions" icon={Award} addLabel="certification"
                                    rows={editing.certifications || []}
                                    fields={[
                                        { key: 'label', placeholder: 'Diplômé en …', wide: true },
                                        { key: 'issuer', placeholder: 'Délivré par (Ordre du mérite de …)', wide: true },
                                        { key: 'year', placeholder: 'Année' },
                                    ]}
                                    onChange={rows => setEditing({ ...editing, certifications: rows })}
                                />

                                {/* Galerie + langues */}
                                <TagEditor title="Galerie d'images (URLs)" icon={ImageIcon} placeholder="https://… puis Entrée"
                                    values={editing.gallery || []} onChange={v => setEditing({ ...editing, gallery: v })} />
                                {(editing.gallery?.length || 0) > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {editing.gallery.map((u, i) => (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img key={i} src={u} alt={`Aperçu ${i + 1}`} className="w-16 h-16 rounded-xl object-cover border"
                                                style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }} />
                                        ))}
                                    </div>
                                )}
                                <TagEditor title="Langues parlées" icon={Languages} placeholder="Fon, Yoruba… puis Entrée"
                                    values={editing.langues || []} onChange={v => setEditing({ ...editing, langues: v })} />

                                {/* Contact interne */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={lbl} style={lblStyle}><Phone size={11} className="inline mr-1" />Téléphone (interne)</label>
                                        <input className={field} style={fieldStyle} value={editing.telephone || ''} title="Téléphone" placeholder="+229 …"
                                            onChange={e => setEditing({ ...editing, telephone: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className={lbl} style={lblStyle}><Mail size={11} className="inline mr-1" />Email (interne)</label>
                                        <input className={field} style={fieldStyle} value={editing.email || ''} title="Email" placeholder="…@…"
                                            onChange={e => setEditing({ ...editing, email: e.target.value })} />
                                    </div>
                                </div>
                                <p className="text-[10px] -mt-3" style={lblStyle}>Ces coordonnées restent internes — elles ne sont jamais exposées sur le site public.</p>

                                {/* Visibilité */}
                                <div className="flex items-center justify-between rounded-2xl border p-4" style={card}>
                                    <div className="flex items-center gap-3">
                                        {editing.is_active ? <Eye size={16} style={{ color: '#10B981' }} /> : <EyeOff size={16} className="text-gray-500" />}
                                        <div>
                                            <p className="text-[13px] font-bold" style={{ color: 'var(--panel-text, #E5E7EB)' }}>
                                                {editing.is_active ? 'Visible sur le site' : 'Masqué du site'}
                                            </p>
                                            <p className="text-[10px]" style={lblStyle}>Un prêtre masqué reste enregistré mais n&apos;apparaît pas publiquement.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest mb-1" style={lblStyle}>Ordre</label>
                                            <input type="number" title="Ordre d'affichage" value={editing.order_index}
                                                onChange={e => setEditing({ ...editing, order_index: Number(e.target.value) || 0 })}
                                                className="w-16 bg-transparent border rounded-lg px-2 py-1 text-[12px] text-center outline-none focus:border-[#7C5CCA]"
                                                style={fieldStyle} />
                                        </div>
                                        <button type="button" onClick={() => setEditing({ ...editing, is_active: !editing.is_active })}
                                            title="Basculer la visibilité"
                                            className="relative w-12 h-6 rounded-full transition-colors shrink-0"
                                            style={{ backgroundColor: editing.is_active ? '#10B981' : 'rgba(107,114,128,0.4)' }}>
                                            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: editing.is_active ? 26 : 2 }} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t flex items-center justify-end gap-2"
                                style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.08))' }}>
                                <button type="button" onClick={() => setEditing(null)}
                                    className="px-4 py-2.5 rounded-xl text-[13px] font-bold border transition-colors"
                                    style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.12))', color: 'var(--panel-text-muted, #9CA3AF)' }}>
                                    Annuler
                                </button>
                                <button type="button" onClick={save} disabled={saving}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-black text-white disabled:opacity-50 transition-all hover:brightness-110"
                                    style={{ backgroundColor: ACCENT }}>
                                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                    {editing.id ? 'Enregistrer' : 'Créer le prêtre'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ══ PANNEAU AVIS ══ */}
            <AnimatePresence>
                {reviewsFor && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end" onClick={() => setReviewsFor(null)}>
                        <motion.div initial={{ x: 60 }} animate={{ x: 0 }} exit={{ x: 60 }} onClick={e => e.stopPropagation()}
                            className="w-full max-w-lg h-full overflow-y-auto border-l"
                            style={{ backgroundColor: 'var(--panel-surface, #0c1420)', borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}>

                            <div className="px-5 py-5 border-b flex items-center justify-between sticky top-0 z-10"
                                style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.08))', backgroundColor: 'var(--panel-surface, #0c1420)' }}>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: '#FCD116' }}>Avis clients</p>
                                    <h3 className="text-base font-black" style={{ color: 'var(--panel-text-heading, #fff)' }}>{reviewsFor.prenom} {reviewsFor.nom}</h3>
                                </div>
                                <button type="button" title="Fermer" onClick={() => setReviewsFor(null)} className="p-2 rounded-xl text-gray-500 hover:text-white"><X size={18} /></button>
                            </div>

                            {/* Ajout manuel */}
                            <div className="p-5 border-b space-y-3" style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.06))' }}>
                                <p className="text-[10px] font-black uppercase tracking-widest" style={lblStyle}>Ajouter un avis</p>
                                <input className={field} style={fieldStyle} placeholder="Nom du client" title="Nom du client"
                                    value={newReview.author_name} onChange={e => setNewReview({ ...newReview, author_name: e.target.value })} />
                                <div className="flex items-center gap-3">
                                    <Stars value={newReview.rating} size={20} onChange={v => setNewReview({ ...newReview, rating: v })} />
                                    <span className="text-[12px] font-bold" style={{ color: 'var(--panel-text, #E5E7EB)' }}>{newReview.rating}/5</span>
                                </div>
                                <textarea rows={2} className={field} style={fieldStyle} placeholder="Commentaire (optionnel)" title="Commentaire"
                                    value={newReview.comment} onChange={e => setNewReview({ ...newReview, comment: e.target.value })} />
                                <button type="button" onClick={addReview} disabled={!newReview.author_name.trim()}
                                    className="w-full py-2.5 rounded-xl text-[13px] font-black text-white disabled:opacity-40 transition-all"
                                    style={{ backgroundColor: ACCENT }}>Publier cet avis</button>
                            </div>

                            {/* Liste */}
                            <div className="p-5 space-y-3">
                                {reviews.length === 0 && <p className="text-[12px] italic text-center py-8" style={lblStyle}>Aucun avis pour le moment.</p>}
                                {reviews.map(r => (
                                    <div key={r.id} className="border rounded-2xl p-4" style={card}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-bold truncate" style={{ color: 'var(--panel-text-heading, #fff)' }}>{r.author_name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Stars value={r.rating} size={12} />
                                                    <span className="text-[10px]" style={lblStyle}>{new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
                                                </div>
                                            </div>
                                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full shrink-0"
                                                style={r.is_published
                                                    ? { backgroundColor: 'rgba(16,185,129,0.12)', color: '#10B981' }
                                                    : { backgroundColor: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                                                {r.is_published ? 'PUBLIÉ' : 'EN ATTENTE'}
                                            </span>
                                        </div>
                                        {r.comment && <p className="text-[12px] mt-2.5 leading-relaxed" style={{ color: 'var(--panel-text-muted, #9CA3AF)' }}>{r.comment}</p>}
                                        <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.06))' }}>
                                            <button type="button" onClick={() => togglePublish(r)}
                                                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all"
                                                style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.12))', color: r.is_published ? '#9CA3AF' : '#10B981' }}>
                                                {r.is_published ? <><EyeOff size={12} /> Dépublier</> : <><Eye size={12} /> Publier</>}
                                            </button>
                                            <button type="button" title="Supprimer l'avis" onClick={() => deleteReview(r)}
                                                className="ml-auto p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 size={13} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ══ CONFIRMATION SUPPRESSION ══ */}
            <AnimatePresence>
                {deleteTarget && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}
                            className="w-full max-w-sm border rounded-2xl p-6 text-center"
                            style={{ backgroundColor: 'var(--panel-surface, #0c1420)', borderColor: 'rgba(239,68,68,0.25)' }}>
                            <AlertTriangle size={26} className="mx-auto mb-3 text-red-400" />
                            <p className="font-black" style={{ color: 'var(--panel-text-heading, #fff)' }}>Supprimer ce prêtre ?</p>
                            <p className="text-[12px] mt-1.5 mb-5" style={lblStyle}>
                                {deleteTarget.prenom} {deleteTarget.nom} et tous ses avis seront définitivement supprimés.
                            </p>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setDeleteTarget(null)}
                                    className="flex-1 py-2.5 rounded-xl text-[13px] font-bold border"
                                    style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.12))', color: 'var(--panel-text-muted, #9CA3AF)' }}>Annuler</button>
                                <button type="button" onClick={remove}
                                    className="flex-1 py-2.5 rounded-xl text-[13px] font-black text-white bg-red-600 hover:bg-red-700 transition-colors">Supprimer</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
