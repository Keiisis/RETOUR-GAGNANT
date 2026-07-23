'use client'

// ══════════════════════════════════════════════════════════════
//  ANNUAIRE PUBLIC DES PRÊTRES FA (Bokonon)
//  Alimenté par /api/fa-priests — aucun contenu codé en dur.
//  Affiche uniquement les prêtres actifs et les avis publiés.
//  Les visiteurs peuvent déposer un avis (modéré avant publication).
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Star, MapPin, Award, Briefcase, Languages, X, Loader2,
    MessageSquare, ChevronRight, UserRound, CheckCircle2, Quote,
} from 'lucide-react'
import { useTranslation, T } from '@/lib/translation'

const ACCENT = '#7C5CCA'

interface Prestation { label: string; description?: string; price?: string }
interface Certification { label: string; issuer?: string; year?: string }
interface Review { author_name: string; rating: number; comment: string | null; created_at: string }
interface Priest {
    id: string; nom: string; prenom: string; titre: string | null
    localisation: string | null; bio: string | null; photo_url: string | null
    prestations: Prestation[]; gallery: string[]; certifications: Certification[]
    langues: string[]; experience_ans: number | null
    rating_avg: number; rating_count: number; reviews: Review[]
}

function Stars({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
    const [hover, setHover] = useState(0)
    const shown = hover || value
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
                <button key={i} type="button" disabled={!onChange}
                    aria-label={`${i} étoile${i > 1 ? 's' : ''}`}
                    onClick={() => onChange?.(i)}
                    onMouseEnter={() => onChange && setHover(i)}
                    onMouseLeave={() => onChange && setHover(0)}
                    className={onChange ? 'transition-transform hover:scale-125' : 'cursor-default'}>
                    <Star size={size} className={i <= Math.round(shown) ? 'text-amber-400' : 'text-gray-300'}
                        fill={i <= Math.round(shown) ? '#fbbf24' : 'none'} />
                </button>
            ))}
        </div>
    )
}

export default function FaPriestsDirectory() {
    const { t } = useTranslation()
    const [priests, setPriests] = useState<Priest[]>([])
    const [loading, setLoading] = useState(true)
    const [open, setOpen] = useState<Priest | null>(null)
    const [lightbox, setLightbox] = useState<string | null>(null)
    const [form, setForm] = useState({ author_name: '', author_email: '', rating: 5, comment: '' })
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState('')
    const [err, setErr] = useState('')

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/fa-priests', { cache: 'no-store' })
            const data = await res.json()
            setPriests(data.priests || [])
        } catch { /* silencieux : la section se masque */ }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const submitReview = async () => {
        if (!open || !form.author_name.trim()) { setErr(t('Veuillez indiquer votre nom.')); return }
        setSending(true); setErr(''); setSent('')
        try {
            const res = await fetch('/api/fa-priests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, priest_id: open.id }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Envoi impossible')
            setSent(data.message || t('Merci ! Votre avis sera publié après validation.'))
            setForm({ author_name: '', author_email: '', rating: 5, comment: '' })
        } catch (e) { setErr(e instanceof Error ? e.message : t('Erreur')) }
        setSending(false)
    }

    // Section masquée tant qu'aucun prêtre n'est publié
    if (loading) {
        return <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin" style={{ color: ACCENT }} /></div>
    }
    if (priests.length === 0) return null

    return (
        <div className="mb-12">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-[#1a2332]"><T>Nos Prêtres Fa</T></h2>
                    <p className="text-sm text-gray-500 mt-1">
                        <T>Des Bokonons reconnus, sélectionnés pour leur lignée, leur expérience et le respect du rite.</T>
                    </p>
                </div>
                <span className="text-[11px] font-bold px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: 'rgba(124,92,202,0.10)', color: ACCENT }}>
                    {priests.length} <T>praticien(s) référencé(s)</T>
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {priests.map((p, i) => (
                    <motion.button
                        key={p.id}
                        type="button"
                        onClick={() => { setOpen(p); setSent(''); setErr('') }}
                        initial={{ opacity: 0, y: 14 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: Math.min(i * 0.06, 0.3) }}
                        className="group text-left bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:border-[#7C5CCA]/30 transition-all"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden shrink-0 border flex items-center justify-center"
                                style={{ borderColor: 'rgba(124,92,202,0.2)', backgroundColor: 'rgba(124,92,202,0.06)' }}>
                                {p.photo_url
                                    // eslint-disable-next-line @next/next/no-img-element
                                    ? <img src={p.photo_url} alt={`${p.prenom} ${p.nom}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    : <UserRound size={26} style={{ color: ACCENT }} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-[#1a2332] truncate">{p.prenom} {p.nom}</p>
                                <p className="text-[12px] text-gray-500 truncate">
                                    {p.titre || 'Bokonon'}
                                    {p.localisation && <> · <MapPin size={11} className="inline -mt-0.5" /> {p.localisation}</>}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                    <Stars value={p.rating_avg} size={13} />
                                    <span className="text-[12px] font-bold text-[#1a2332]">
                                        {p.rating_avg > 0 ? p.rating_avg.toFixed(1) : '—'}
                                    </span>
                                    <span className="text-[11px] text-gray-400">({p.rating_count})</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                    {p.experience_ans ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-100">
                                            {p.experience_ans} <T>ans d&apos;expérience</T>
                                        </span>
                                    ) : null}
                                    {(p.certifications?.length || 0) > 0 && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border"
                                            style={{ backgroundColor: 'rgba(252,209,22,0.10)', borderColor: 'rgba(252,209,22,0.3)', color: '#a16207' }}>
                                            <Award size={10} /> {p.certifications.length} <T>certification(s)</T>
                                        </span>
                                    )}
                                    {(p.langues || []).slice(0, 2).map(l => (
                                        <span key={l} className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-100">{l}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                            <span className="text-[11px] text-gray-400">
                                {(p.prestations?.length || 0)} <T>prestation(s)</T> · {(p.gallery?.length || 0)} <T>photo(s)</T>
                            </span>
                            <span className="inline-flex items-center gap-1 text-[12px] font-black transition-transform group-hover:translate-x-0.5" style={{ color: ACCENT }}>
                                <T>Voir le profil</T> <ChevronRight size={14} />
                            </span>
                        </div>
                    </motion.button>
                ))}
            </div>

            {/* ══ FICHE DÉTAILLÉE ══ */}
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
                        onClick={() => setOpen(null)}>
                        <motion.div initial={{ scale: 0.97, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 16 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-2xl my-8 bg-white rounded-3xl overflow-hidden shadow-2xl">

                            {/* En-tête */}
                            <div className="relative p-6 pb-5" style={{ background: 'linear-gradient(135deg, rgba(124,92,202,0.12), rgba(124,92,202,0.03))' }}>
                                <button type="button" title={t('Fermer')} onClick={() => setOpen(null)}
                                    className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-white/70 transition-all"><X size={18} /></button>
                                <div className="flex items-center gap-4">
                                    <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border-2 bg-white flex items-center justify-center"
                                        style={{ borderColor: 'rgba(124,92,202,0.25)' }}>
                                        {open.photo_url
                                            // eslint-disable-next-line @next/next/no-img-element
                                            ? <img src={open.photo_url} alt={`${open.prenom} ${open.nom}`} className="w-full h-full object-cover" />
                                            : <UserRound size={30} style={{ color: ACCENT }} />}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-xl font-black text-[#1a2332] truncate">{open.prenom} {open.nom}</h3>
                                        <p className="text-[13px] text-gray-600">
                                            {open.titre || 'Bokonon'}
                                            {open.localisation && <> · <MapPin size={12} className="inline -mt-0.5" /> {open.localisation}</>}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <Stars value={open.rating_avg} size={14} />
                                            <span className="text-[13px] font-bold text-[#1a2332]">{open.rating_avg > 0 ? open.rating_avg.toFixed(1) : '—'}</span>
                                            <span className="text-[11px] text-gray-400">({open.rating_count} <T>avis</T>)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
                                {open.bio && <p className="text-[14px] text-gray-600 leading-relaxed">{open.bio}</p>}

                                {/* Prestations */}
                                {(open.prestations?.length || 0) > 0 && (
                                    <section>
                                        <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3">
                                            <Briefcase size={13} style={{ color: ACCENT }} /> <T>Prestations</T>
                                        </h4>
                                        <div className="space-y-2">
                                            {open.prestations.map((s, i) => (
                                                <div key={i} className="flex items-start justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3">
                                                    <div className="min-w-0">
                                                        <p className="text-[13px] font-bold text-[#1a2332]">{s.label}</p>
                                                        {s.description && <p className="text-[12px] text-gray-500 mt-0.5">{s.description}</p>}
                                                    </div>
                                                    {s.price && <span className="text-[13px] font-black shrink-0" style={{ color: ACCENT }}>{s.price}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Certifications */}
                                {(open.certifications?.length || 0) > 0 && (
                                    <section>
                                        <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3">
                                            <Award size={13} className="text-amber-500" /> <T>Certifications & distinctions</T>
                                        </h4>
                                        <div className="space-y-2">
                                            {open.certifications.map((c, i) => (
                                                <div key={i} className="flex items-start gap-2.5 rounded-xl px-4 py-3 border"
                                                    style={{ backgroundColor: 'rgba(252,209,22,0.06)', borderColor: 'rgba(252,209,22,0.25)' }}>
                                                    <CheckCircle2 size={15} className="text-amber-500 mt-0.5 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-[13px] font-bold text-[#1a2332]">{c.label}</p>
                                                        {(c.issuer || c.year) && (
                                                            <p className="text-[12px] text-gray-500">{[c.issuer, c.year].filter(Boolean).join(' · ')}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Langues */}
                                {(open.langues?.length || 0) > 0 && (
                                    <section>
                                        <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">
                                            <Languages size={13} style={{ color: ACCENT }} /> <T>Langues</T>
                                        </h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {open.langues.map(l => (
                                                <span key={l} className="text-[12px] font-bold px-3 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-100">{l}</span>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Galerie */}
                                {(open.gallery?.length || 0) > 0 && (
                                    <section>
                                        <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3"><T>Galerie</T></h4>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                            {open.gallery.map((u, i) => (
                                                <button key={i} type="button" onClick={() => setLightbox(u)} title={t('Agrandir')}
                                                    className="aspect-square rounded-xl overflow-hidden border border-gray-100 hover:opacity-85 transition-opacity">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={u} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Avis */}
                                <section>
                                    <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3">
                                        <MessageSquare size={13} style={{ color: ACCENT }} /> <T>Avis des clients</T>
                                    </h4>
                                    {open.reviews.length === 0 ? (
                                        <p className="text-[13px] text-gray-400 italic"><T>Aucun avis publié pour le moment.</T></p>
                                    ) : (
                                        <div className="space-y-3">
                                            {open.reviews.map((r, i) => (
                                                <div key={i} className="bg-gray-50 rounded-2xl p-4">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-[13px] font-bold text-[#1a2332]">{r.author_name}</p>
                                                        <Stars value={r.rating} size={12} />
                                                    </div>
                                                    {r.comment && (
                                                        <p className="text-[13px] text-gray-600 mt-2 leading-relaxed flex gap-2">
                                                            <Quote size={13} className="text-gray-300 shrink-0 mt-1" />{r.comment}
                                                        </p>
                                                    )}
                                                    <p className="text-[11px] text-gray-400 mt-2">{new Date(r.created_at).toLocaleDateString('fr-FR')}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* Déposer un avis */}
                                <section className="border-t border-gray-100 pt-5">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3"><T>Laisser un avis</T></h4>
                                    {sent ? (
                                        <div className="flex items-start gap-2.5 rounded-2xl px-4 py-3.5 border"
                                            style={{ backgroundColor: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.25)' }}>
                                            <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                                            <p className="text-[13px] text-emerald-700">{sent}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <input value={form.author_name} onChange={e => setForm({ ...form, author_name: e.target.value })}
                                                    placeholder={t('Votre nom')} title={t('Votre nom')}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-[13px] outline-none focus:border-[#7C5CCA]/60 transition-colors" />
                                                <input value={form.author_email} onChange={e => setForm({ ...form, author_email: e.target.value })}
                                                    placeholder={t('Votre email (optionnel)')} title={t('Votre email')}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-[13px] outline-none focus:border-[#7C5CCA]/60 transition-colors" />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[12px] text-gray-500"><T>Votre note</T></span>
                                                <Stars value={form.rating} size={20} onChange={v => setForm({ ...form, rating: v })} />
                                                <span className="text-[13px] font-bold text-[#1a2332]">{form.rating}/5</span>
                                            </div>
                                            <textarea rows={3} value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })}
                                                placeholder={t('Votre expérience (optionnel)')} title={t('Commentaire')}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-[13px] outline-none focus:border-[#7C5CCA]/60 transition-colors" />
                                            {err && <p className="text-[12px] text-red-500">{err}</p>}
                                            <button type="button" onClick={submitReview} disabled={sending}
                                                className="w-full py-3 rounded-xl text-[13px] font-black text-white disabled:opacity-50 transition-all hover:brightness-110 flex items-center justify-center gap-2"
                                                style={{ backgroundColor: ACCENT }}>
                                                {sending ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />}
                                                <T>Publier mon avis</T>
                                            </button>
                                            <p className="text-[11px] text-gray-400 text-center">
                                                <T>Votre avis est vérifié par notre équipe avant publication.</T>
                                            </p>
                                        </div>
                                    )}
                                </section>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ══ LIGHTBOX ══ */}
            <AnimatePresence>
                {lightbox && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
                        <button type="button" title={t('Fermer')} className="absolute top-5 right-5 p-2 text-white/70 hover:text-white"><X size={24} /></button>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <motion.img initial={{ scale: 0.94 }} animate={{ scale: 1 }} src={lightbox} alt=""
                            className="max-h-[85vh] max-w-full rounded-2xl object-contain" onClick={e => e.stopPropagation()} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
