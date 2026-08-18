'use client'

/**
 * Demandes de séjour — Tourisme & Culture.
 *
 * Les parcours saisis depuis l'application étaient enregistrés mais AUCUN écran
 * ne les montrait : l'équipe ne savait pas à qui envoyer un Smart Slide. Cet
 * écran répond exactement à cette question, et enchaîne sur la création de la
 * proposition avec le contexte déjà rempli.
 *
 * L'ordre des villes EST l'itinéraire voulu par le client : on l'affiche tel
 * quel, avec des flèches, plutôt que de le trier.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Compass, CircleNotch as Loader2, MapPin, CalendarBlank as Calendar, Users,
    Envelope as Mail, Phone, Sparkle as Sparkles, MagnifyingGlass as Search,
    Warning as AlertTriangle, CheckCircle as CheckCircle2, PaperPlaneTilt as Send,
} from '@phosphor-icons/react'

interface Demande {
    id: string
    client_id: string | null
    nom: string | null
    prenom: string | null
    email: string | null
    telephone: string | null
    date_debut: string | null
    date_fin: string | null
    duree_jours: number | null
    voyageurs: number | null
    budget: number | null
    devise: string | null
    villes: string[] | null
    activites: string[] | null
    recit: string | null
    statut: string
    notes_agent: string | null
    created_at: string
}

const STATUTS: Array<{ v: string; l: string; cls: string }> = [
    { v: 'nouveau', l: 'Nouvelle', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
    { v: 'en_preparation', l: 'En préparation', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    { v: 'propose', l: 'Proposition envoyée', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    { v: 'clos', l: 'Clos', cls: 'bg-white/5 text-gray-400 border-white/10' },
]

const dateFr = (iso: string | null) => {
    if (!iso) return null
    try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) }
    catch { return null }
}

export default function DemandesSejourPage() {
    const router = useRouter()
    const [demandes, setDemandes] = useState<Demande[]>([])
    const [chargement, setChargement] = useState(true)
    const [erreur, setErreur] = useState('')
    const [migrationRequise, setMigrationRequise] = useState(false)
    const [filtre, setFiltre] = useState('all')
    const [recherche, setRecherche] = useState('')
    const [busy, setBusy] = useState<string | null>(null)

    const charger = useCallback(async () => {
        setChargement(true); setErreur('')
        try {
            const res = await fetch('/api/tourisme/demandes')
            const j = await res.json()
            if (!res.ok) {
                setMigrationRequise(!!j.migration_requise)
                throw new Error(j.error || 'Chargement impossible.')
            }
            setDemandes(Array.isArray(j.demandes) ? j.demandes : [])
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Chargement impossible.')
        } finally { setChargement(false) }
    }, [])

    useEffect(() => { charger() }, [charger])

    const changerStatut = async (id: string, statut: string) => {
        setBusy(id)
        setDemandes(prev => prev.map(d => (d.id === id ? { ...d, statut } : d)))
        try {
            const res = await fetch('/api/tourisme/demandes', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, statut }),
            })
            if (!res.ok) throw new Error()
        } catch { await charger() }
        finally { setBusy(null) }
    }

    const visibles = useMemo(() => {
        const q = recherche.trim().toLowerCase()
        return demandes.filter(d => {
            if (filtre !== 'all' && d.statut !== filtre) return false
            if (!q) return true
            return [d.nom, d.prenom, d.email, ...(d.villes || []), ...(d.activites || [])]
                .some(v => (v || '').toLowerCase().includes(q))
        })
    }, [demandes, filtre, recherche])

    const compte = (v: string) => demandes.filter(d => d.statut === v).length

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* En-tête */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#008751]/20 text-[#008751]">
                        <Compass size={20} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">Demandes de séjour</h1>
                        <p className="mt-0.5 text-sm text-gray-500">
                            {demandes.length} demande{demandes.length > 1 ? 's' : ''} · {compte('nouveau')} à traiter
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            value={recherche} onChange={e => setRecherche(e.target.value)}
                            placeholder="Client, ville, activité…"
                            className="w-56 rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-[#008751]"
                        />
                    </div>
                    {[{ v: 'all', l: 'Toutes' }, ...STATUTS].map(f => (
                        <button
                            key={f.v} onClick={() => setFiltre(f.v)}
                            className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${filtre === f.v ? 'bg-[#008751] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                        >
                            {f.l}{f.v !== 'all' ? ` (${compte(f.v)})` : ''}
                        </button>
                    ))}
                </div>
            </div>

            {chargement ? (
                <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-[#008751]" /></div>
            ) : erreur ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
                    <p className="flex items-center gap-2 font-bold text-amber-300">
                        <AlertTriangle size={18} /> {erreur}
                    </p>
                    {migrationRequise && (
                        <p className="mt-2 text-sm text-amber-200/80">
                            La table <code className="font-mono">tourism_itineraries</code> n&apos;existe pas encore.
                            Exécutez la migration <code className="font-mono">20260818_sejour_et_slides_mobile.sql</code>
                            dans Supabase, puis rechargez cette page.
                        </p>
                    )}
                    <button onClick={charger} className="mt-3 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-black">
                        Réessayer
                    </button>
                </div>
            ) : visibles.length === 0 ? (
                <div className="py-24 text-center text-gray-500">
                    <Compass size={40} className="mx-auto mb-3 opacity-40" />
                    <p className="font-semibold">
                        {demandes.length === 0
                            ? 'Aucune demande de séjour pour le moment.'
                            : 'Aucune demande ne correspond à ce filtre.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {visibles.map((d, i) => {
                        const st = STATUTS.find(s => s.v === d.statut) || STATUTS[0]
                        const nom = [d.prenom, d.nom].filter(Boolean).join(' ') || 'Sans nom'
                        return (
                            <motion.div
                                key={d.id}
                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                                className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="font-black text-white">{nom}</h2>
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${st.cls}`}>
                                                {st.l}
                                            </span>
                                            {d.client_id && (
                                                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                                                    Compte lié
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                                            {d.email && (
                                                <a href={`mailto:${d.email}`} className="flex items-center gap-1.5 hover:text-emerald-300">
                                                    <Mail size={12} /> {d.email}
                                                </a>
                                            )}
                                            {d.telephone && (
                                                <a href={`tel:${d.telephone}`} className="flex items-center gap-1.5 hover:text-emerald-300">
                                                    <Phone size={12} /> {d.telephone}
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5">
                                        {STATUTS.map(s => (
                                            <button
                                                key={s.v}
                                                onClick={() => changerStatut(d.id, s.v)}
                                                disabled={busy === d.id || d.statut === s.v}
                                                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${d.statut === s.v ? 'bg-[#008751] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-50'}`}
                                            >
                                                {s.l}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Le parcours : l'ordre EST celui voulu par le client */}
                                {!!d.villes?.length && (
                                    <div className="mt-4 rounded-xl bg-[#008751]/10 p-3">
                                        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-[#008751]">Itinéraire souhaité</p>
                                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-white">
                                            <MapPin size={13} className="text-[#008751]" />
                                            {d.villes.join('  →  ')}
                                        </p>
                                    </div>
                                )}

                                {!!d.activites?.length && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {d.activites.map(a => (
                                            <span key={a} className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-gray-300">
                                                {a}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
                                    {dateFr(d.date_debut) && (
                                        <span className="flex items-center gap-1.5">
                                            <Calendar size={12} /> {dateFr(d.date_debut)}
                                            {d.duree_jours ? ` · ${d.duree_jours} jours` : ''}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1.5">
                                        <Users size={12} /> {d.voyageurs || 1} voyageur{(d.voyageurs || 1) > 1 ? 's' : ''}
                                    </span>
                                    {!!d.budget && (
                                        <span className="font-bold text-white">
                                            Budget : {new Intl.NumberFormat('fr-FR').format(d.budget)} {d.devise || 'EUR'}
                                        </span>
                                    )}
                                </div>

                                {d.recit && (
                                    <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white/[0.03] p-3 text-sm text-gray-300">
                                        {d.recit}
                                    </p>
                                )}

                                {/* Passage à l'action : créer la proposition pour CE client */}
                                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
                                    <button
                                        onClick={() => {
                                            // Le contexte part dans l'URL : le formulaire de proposition
                                            // s'ouvre déjà rempli, sans ressaisie.
                                            const p = new URLSearchParams({
                                                client_name: nom,
                                                client_email: d.email || '',
                                                client_phone: d.telephone || '',
                                                destination: (d.villes || []).join(', '),
                                                activities: (d.activites || []).join(', '),
                                                start_date: d.date_debut || '',
                                                end_date: d.date_fin || '',
                                                budget: d.budget ? String(d.budget) : '',
                                            })
                                            router.push(`/admin/proposals?${p.toString()}`)
                                        }}
                                        className="inline-flex items-center gap-2 rounded-xl bg-[#008751] px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-[#00643C]"
                                    >
                                        <Sparkles size={15} /> Créer la proposition
                                    </button>
                                    <a
                                        href="/admin/proposals"
                                        className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-bold text-gray-300 hover:bg-white/10"
                                    >
                                        <Send size={14} /> Envoyer un slide existant
                                    </a>
                                    {d.statut === 'propose' && (
                                        <span className="inline-flex items-center gap-1.5 px-2 text-xs font-bold text-emerald-300">
                                            <CheckCircle2 size={14} /> Proposition envoyée
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
