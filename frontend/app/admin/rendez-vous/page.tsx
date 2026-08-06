'use client'

// ══════════════════════════════════════════════════════════════
//  ADMIN — SUPERVISION DES RENDEZ-VOUS
//
//  L'admin n'avait AUCUNE vue des rendez-vous : seul l'agent les
//  voyait dans son agenda. Un client (ou un visiteur) prenait RDV et la
//  direction était aveugle. Cette page lit TOUS les rdv_requests, avec
//  l'identité du client, et permet de confirmer / annuler / terminer via
//  l'API centralisée /api/rdv/[id] (qui notifie le client à chaque
//  changement). Temps réel : un nouveau RDV apparaît sans recharger.
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Calendar, Clock, User, Phone, Envelope as Mail, VideoCamera as Video, MapPin, CheckCircle, XCircle, Checks as CheckCheck, CircleNotch as Loader2, MagnifyingGlass as Search } from '@phosphor-icons/react';

interface RDV {
    id: string
    client_id: string | null
    client_email: string
    date: string
    heure: string
    type: string
    motif: string
    notes: string | null
    statut: 'en_attente' | 'confirme' | 'annule' | 'termine'
    created_at: string
    client_profiles?: { nom: string | null; prenom: string | null; phone: string | null } | null
}

const STATUTS: Record<RDV['statut'], { label: string; cls: string }> = {
    en_attente: { label: 'En attente', cls: 'text-amber-600 bg-amber-50 border-amber-200' },
    confirme: { label: 'Confirmé', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    annule: { label: 'Annulé', cls: 'text-red-600 bg-red-50 border-red-200' },
    termine: { label: 'Terminé', cls: 'text-gray-500 bg-gray-100 border-gray-200' },
}

const TYPE_ICON: Record<string, typeof Video> = {
    visio: Video, telephone: Phone, presentiel: MapPin,
}

type Filtre = 'a_venir' | 'en_attente' | 'passes' | 'tous'

export default function AdminRendezVousPage() {
    const [rdvs, setRdvs] = useState<RDV[]>([])
    const [loading, setLoading] = useState(true)
    const [filtre, setFiltre] = useState<Filtre>('a_venir')
    const [recherche, setRecherche] = useState('')
    const [busy, setBusy] = useState<string | null>(null)

    const charger = useCallback(async () => {
        const { data } = await supabase
            .from('rdv_requests')
            .select('*, client_profiles(nom, prenom, phone)')
            .order('date', { ascending: true })
            .order('heure', { ascending: true })
        setRdvs((data as RDV[]) || [])
        setLoading(false)
    }, [])

    useEffect(() => {
        charger()
        const channel = supabase.channel('admin_rdv')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rdv_requests' }, charger)
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [charger])

    // Changement de statut via l'API centralisée (autorisation + notif client)
    const changerStatut = async (rdv: RDV, statut: RDV['statut']) => {
        setBusy(rdv.id)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch(`/api/rdv/${rdv.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                },
                body: JSON.stringify({ statut }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) { alert(data.error || 'Action impossible'); return }
            setRdvs(prev => prev.map(r => r.id === rdv.id ? { ...r, statut } : r))
        } finally {
            setBusy(null)
        }
    }

    const auj = new Date(); auj.setHours(0, 0, 0, 0)
    const estPasse = (r: RDV) => new Date(`${r.date}T23:59:59`) < auj
    const filtres = rdvs.filter(r => {
        if (filtre === 'en_attente' && r.statut !== 'en_attente') return false
        if (filtre === 'a_venir' && (estPasse(r) || r.statut === 'annule' || r.statut === 'termine')) return false
        if (filtre === 'passes' && !estPasse(r) && r.statut !== 'termine') return false
        if (recherche.trim()) {
            const q = recherche.toLowerCase()
            const nom = `${r.client_profiles?.prenom || ''} ${r.client_profiles?.nom || ''} ${r.client_email} ${r.motif}`.toLowerCase()
            if (!nom.includes(q)) return false
        }
        return true
    })

    const compteurAttente = rdvs.filter(r => r.statut === 'en_attente').length

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Calendar className="text-blue-500" size={22} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Rendez-vous</h1>
                    <p className="text-sm text-gray-500">
                        {compteurAttente > 0
                            ? `${compteurAttente} demande(s) en attente de traitement`
                            : 'Toutes les demandes sont traitées'}
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-5">
                {([['a_venir', 'À venir'], ['en_attente', 'En attente'], ['passes', 'Passés'], ['tous', 'Tous']] as [Filtre, string][]).map(([f, lbl]) => (
                    <button key={f} onClick={() => setFiltre(f)}
                        className={`px-3.5 py-1.5 rounded-lg text-sm font-bold border transition-colors ${filtre === f
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-transparent text-gray-500 border-gray-200 dark:border-white/10 hover:border-blue-500/40'}`}>
                        {lbl}
                    </button>
                ))}
                <div className="relative ml-auto">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={recherche} onChange={e => setRecherche(e.target.value)}
                        placeholder="Rechercher un client…"
                        className="pl-9 pr-3 py-1.5 rounded-lg text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-blue-500/50 outline-none w-52" />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-gray-400">
                    <Loader2 className="animate-spin" size={22} />
                </div>
            ) : filtres.length === 0 ? (
                <div className="text-center py-20 text-gray-400 text-sm">Aucun rendez-vous dans cette vue.</div>
            ) : (
                <div className="space-y-3">
                    {filtres.map(rdv => {
                        const st = STATUTS[rdv.statut] || STATUTS.en_attente
                        const Icon = TYPE_ICON[rdv.type] || Calendar
                        const nomClient = `${rdv.client_profiles?.prenom || ''} ${rdv.client_profiles?.nom || ''}`.trim()
                            || rdv.client_email
                        const d = new Date(rdv.date)
                        return (
                            <div key={rdv.id} className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl p-4">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="flex items-start gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center flex-shrink-0">
                                            <span className="text-lg font-black text-blue-500 leading-none">{d.getDate()}</span>
                                            <span className="text-[9px] font-bold uppercase text-blue-500/70">{d.toLocaleDateString('fr-FR', { month: 'short' })}</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white text-sm">{rdv.motif}</p>
                                            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-gray-500">
                                                <span className="flex items-center gap-1"><Clock size={11} /> {rdv.heure}</span>
                                                <span className="flex items-center gap-1"><Icon size={11} /> {rdv.type}</span>
                                                <span className="flex items-center gap-1"><User size={11} /> {nomClient}</span>
                                                {rdv.client_profiles?.phone && <span className="flex items-center gap-1"><Phone size={11} /> {rdv.client_profiles.phone}</span>}
                                                <span className="flex items-center gap-1"><Mail size={11} /> {rdv.client_email}</span>
                                            </div>
                                            {rdv.notes && <p className="text-[11px] text-gray-400 mt-1">{rdv.notes}</p>}
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                                </div>

                                {/* Actions — masquées si déjà annulé/terminé */}
                                {rdv.statut !== 'annule' && rdv.statut !== 'termine' && (
                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
                                        {rdv.statut !== 'confirme' && (
                                            <button disabled={busy === rdv.id} onClick={() => changerStatut(rdv, 'confirme')}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50">
                                                <CheckCircle size={13} /> Confirmer
                                            </button>
                                        )}
                                        <button disabled={busy === rdv.id} onClick={() => changerStatut(rdv, 'termine')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors disabled:opacity-50">
                                            <CheckCheck size={13} /> Terminer
                                        </button>
                                        <button disabled={busy === rdv.id} onClick={() => changerStatut(rdv, 'annule')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50">
                                            <XCircle size={13} /> Annuler
                                        </button>
                                        {busy === rdv.id && <Loader2 size={14} className="animate-spin text-gray-400" />}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
