'use client'

/**
 * Prospects logement — la page qui manquait.
 *
 * `logement_leads` était alimentée par le site et l'application, plus un email
 * vers SIMAU, mais AUCUN écran ne l'affichait : les prospects n'apparaissaient
 * nulle part dans les panels. On les liste ici, avec leur avancement.
 *
 * Lecture via /api/logements/leads, protégée par requireLogementManager
 * (admins + agent nommément habilité). L'espace agent réutilise ce composant.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
    Users, CircleNotch as Loader2, Envelope as Mail, Phone, MapPin,
    CheckCircle as CheckCircle2, PaperPlaneTilt as Send, House as Home,
    MagnifyingGlass as Search, Globe,
} from '@phosphor-icons/react'

interface Lead {
    id: string
    logement_id: string | null
    logement_nom: string | null
    programme: string | null
    nom: string | null
    prenom: string | null
    email: string | null
    telephone: string | null
    pays_residence: string | null
    diaspora: boolean | null
    formule_souhaitee: string | null
    message: string | null
    statut: string
    transmis_simau: boolean
    created_at: string
}

const STATUTS: Array<{ v: string; l: string; cls: string }> = [
    { v: 'nouveau', l: 'Nouveau', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    { v: 'transmis', l: 'Transmis à SIMAU', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    { v: 'traite', l: 'Traité', cls: 'bg-[#E6F3ED] text-[#00643C] border-[#008751]/30' },
]

const dateFr = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

export default function LogementProspects() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [filtre, setFiltre] = useState<string>('all')
    const [recherche, setRecherche] = useState('')
    const [busyId, setBusyId] = useState<string | null>(null)

    const charger = useCallback(async () => {
        setLoading(true); setError('')
        try {
            const res = await fetch('/api/logements/leads')
            const json = await res.json()
            if (!res.ok) throw new Error(json?.error || 'Chargement impossible.')
            setLeads(Array.isArray(json.leads) ? json.leads : [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Chargement impossible.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { charger() }, [charger])

    const changerStatut = async (id: string, statut: string) => {
        setBusyId(id)
        // Optimiste : l'utilisateur voit l'effet immédiatement.
        setLeads(prev => prev.map(l => (l.id === id
            ? { ...l, statut, transmis_simau: statut === 'transmis' ? true : l.transmis_simau }
            : l)))
        try {
            const res = await fetch('/api/logements/leads', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, statut }),
            })
            if (!res.ok) throw new Error()
        } catch {
            await charger() // rollback par rechargement : l'état réel gagne
        } finally {
            setBusyId(null)
        }
    }

    const visibles = useMemo(() => {
        const q = recherche.trim().toLowerCase()
        return leads.filter(l => {
            if (filtre !== 'all' && l.statut !== filtre) return false
            if (!q) return true
            return [l.nom, l.prenom, l.email, l.telephone, l.logement_nom, l.pays_residence]
                .some(v => (v || '').toLowerCase().includes(q))
        })
    }, [leads, filtre, recherche])

    const compte = (v: string) => leads.filter(l => l.statut === v).length

    return (
        <div className="max-w-6xl mx-auto">
            {/* En-tête */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#E6F3ED] flex items-center justify-center text-[#008751]"><Users size={20} /></div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Prospects Logement</h1>
                        <p className="text-sm text-slate-500">
                            {leads.length} demande{leads.length > 1 ? 's' : ''} · {compte('nouveau')} à traiter
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={recherche}
                            onChange={e => setRecherche(e.target.value)}
                            placeholder="Nom, email, ville…"
                            className="rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#008751] w-56"
                        />
                    </div>
                    {[{ v: 'all', l: 'Tous' }, ...STATUTS].map(f => (
                        <button
                            key={f.v}
                            onClick={() => setFiltre(f.v)}
                            className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${filtre === f.v
                                ? 'bg-[#008751] text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            {f.l}{f.v !== 'all' ? ` (${compte(f.v)})` : ''}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-[#008751]" /></div>
            ) : error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                    <p className="font-semibold text-red-700">{error}</p>
                    <button onClick={charger} className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">Réessayer</button>
                </div>
            ) : visibles.length === 0 ? (
                <div className="py-24 text-center text-slate-400">
                    <Home size={40} className="mx-auto mb-3 opacity-40" />
                    <p className="font-semibold text-slate-500">
                        {leads.length === 0
                            ? 'Aucun prospect pour le moment.'
                            : 'Aucun prospect ne correspond à ce filtre.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {visibles.map((l, i) => {
                        const st = STATUTS.find(s => s.v === l.statut) || STATUTS[0]
                        return (
                            <motion.div
                                key={l.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.3)]"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="font-black text-slate-900">
                                                {[l.prenom, l.nom].filter(Boolean).join(' ') || 'Sans nom'}
                                            </h2>
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${st.cls}`}>
                                                {st.l}
                                            </span>
                                            {l.diaspora && (
                                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                                    <Globe size={10} /> Diaspora
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs text-slate-500">{dateFr(l.created_at)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {STATUTS.map(s => (
                                            <button
                                                key={s.v}
                                                onClick={() => changerStatut(l.id, s.v)}
                                                disabled={busyId === l.id || l.statut === s.v}
                                                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${l.statut === s.v
                                                    ? 'bg-[#008751] text-white'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50'}`}
                                            >
                                                {s.v === 'transmis' ? <Send size={12} className="inline" /> : s.v === 'traite' ? <CheckCircle2 size={12} className="inline" /> : null} {s.l}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                    {l.logement_nom && (
                                        <p className="flex items-center gap-2 text-sm text-slate-700">
                                            <Home size={14} className="text-[#008751]" />
                                            <span className="font-semibold">{l.logement_nom}</span>
                                            {l.programme && <span className="text-xs text-slate-400">({l.programme})</span>}
                                        </p>
                                    )}
                                    {l.formule_souhaitee && (
                                        <p className="text-sm text-slate-700">
                                            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Formule : </span>
                                            {l.formule_souhaitee}
                                        </p>
                                    )}
                                    {l.email && (
                                        <a href={`mailto:${l.email}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-[#008751]">
                                            <Mail size={14} className="text-slate-400" /> {l.email}
                                        </a>
                                    )}
                                    {l.telephone && (
                                        <a href={`tel:${l.telephone}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-[#008751]">
                                            <Phone size={14} className="text-slate-400" /> {l.telephone}
                                        </a>
                                    )}
                                    {l.pays_residence && (
                                        <p className="flex items-center gap-2 text-sm text-slate-700">
                                            <MapPin size={14} className="text-slate-400" /> {l.pays_residence}
                                        </p>
                                    )}
                                </div>

                                {l.message && (
                                    <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 whitespace-pre-wrap">{l.message}</p>
                                )}
                            </motion.div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
