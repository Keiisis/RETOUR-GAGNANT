'use client'

/**
 * Récaps de dossier MyAfroOrigins déposés depuis le site.
 *
 * Avant, reprendre un dossier bloqué supposait qu'un agent envoie un lien : la
 * démarche partait toujours de l'agence. Le service en ligne inverse le sens, et
 * les demandes arrivent ici, déjà réglées, avec le récit du client et la fiche
 * d'analyse produite automatiquement.
 *
 * L'analyste garde la main : la fiche est modifiable avant d'être remise.
 */
import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
    FileMagnifyingGlass, Clock, CheckCircle, Archive, User, Envelope,
    Phone, CircleNotch, WarningCircle, FloppyDisk, Trash, X, Paperclip, DeviceMobile, Globe,
    Plus, Sparkle,
} from '@phosphor-icons/react'
import RecapMyafroAjout from './RecapMyafroAjout'

interface Recap {
    id: string
    reference: string
    nom: string
    prenom: string
    email: string
    telephone: string
    pays_residence: string | null
    myafro_reference: string | null
    depuis_quand: string | null
    situation: string
    attentes: string | null
    montant: number
    devise: string
    paiement_ref: string | null
    paiement_moyen: string | null
    statut: string
    recap_ia: string | null
    notes_agent: string | null
    consentement_le: string | null
    purge_apres: string | null
    created_at: string
}

const STATUTS: Record<string, { label: string; classe: string; Icone: typeof Clock }> = {
    nouveau: { label: 'Nouveau', classe: 'text-amber-400 bg-amber-500/10 border-amber-500/30', Icone: Clock },
    en_analyse: { label: 'En analyse', classe: 'text-blue-400 bg-blue-500/10 border-blue-500/30', Icone: FileMagnifyingGlass },
    recap_livre: { label: 'Récap livré', classe: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', Icone: CheckCircle },
    clos: { label: 'Clos', classe: 'text-gray-400 bg-white/5 border-white/10', Icone: Archive },
}

interface Piece {
    id: string
    file_name: string
    file_type: string | null
    file_size: number | null
    status: string
    source: string | null
    created_at: string
}

const poids = (o: number | null) => {
    const n = Number(o) || 0
    return n > 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.round(n / 1024)} Ko`
}

const dateFr = (iso: string | null) => {
    if (!iso) return '—'
    try { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
    catch { return '—' }
}

export default function RecapMyafroSection() {
    const [demandes, setDemandes] = useState<Recap[]>([])
    const [chargement, setChargement] = useState(true)
    const [erreur, setErreur] = useState('')
    const [migration, setMigration] = useState(false)
    const [ouverte, setOuverte] = useState<Recap | null>(null)
    const [brouillon, setBrouillon] = useState('')
    const [notes, setNotes] = useState('')
    const [enregistre, setEnregistre] = useState(false)
    // Les pièces déposées par le client pour CETTE demande — depuis le site ou
    // depuis l'application. Elles vivent dans la fiche, pas dans une liste à part.
    const [pieces, setPieces] = useState<Piece[]>([])
    const [piecesChargees, setPiecesChargees] = useState(false)
    // Saisie manuelle d'un client recu hors du site.
    const [ajoutOuvert, setAjoutOuvert] = useState(false)
    // Generation de la fiche d'analyse a la demande.
    const [generation, setGeneration] = useState(false)
    const [erreurGen, setErreurGen] = useState('')

    const charger = useCallback(async () => {
        setChargement(true); setErreur(''); setMigration(false)
        try {
            const res = await fetch('/api/admin/myafro-recap')
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setMigration(!!json.migration_requise)
                throw new Error(json.error || 'Chargement impossible.')
            }
            setDemandes(Array.isArray(json.demandes) ? json.demandes : [])
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Chargement impossible.')
        } finally { setChargement(false) }
    }, [])

    useEffect(() => { charger() }, [charger])

    /* (Re)génère la fiche d'analyse depuis la situation décrite.
       Le texte revient dans le BROUILLON, donc modifiable : la machine
       propose, l'analyste dispose. Un échec ne vide rien — la fiche déjà
       en place, ou rédigée à la main, reste intacte. */
    const genererFiche = async (id: string) => {
        setGeneration(true); setErreurGen('')
        try {
            const res = await fetch('/api/admin/myafro-recap', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(json.error || 'Génération impossible.')
            setBrouillon(String(json.recap_ia || ''))
            setDemandes(l => l.map(d => (d.id === id
                ? { ...d, recap_ia: String(json.recap_ia || ''), statut: 'en_analyse' }
                : d)))
        } catch (e) {
            setErreurGen(e instanceof Error ? e.message : 'Génération impossible.')
        } finally { setGeneration(false) }
    }

    const ouvrir = async (d: Recap) => {
        setOuverte(d)
        setBrouillon(d.recap_ia || ''); setErreurGen('')
        setNotes(d.notes_agent || '')
        setPieces([]); setPiecesChargees(false)
        try {
            const res = await fetch(`/api/admin/myafro-recap/pieces?id=${encodeURIComponent(d.id)}`)
            const json = await res.json().catch(() => ({}))
            if (res.ok && Array.isArray(json.pieces)) setPieces(json.pieces)
        } catch { /* la fiche reste lisible sans ses pièces */ }
        finally { setPiecesChargees(true) }
    }

    /* Le coffre est privé : on demande une adresse signée, valable quelques
       minutes, plutôt que d'exposer un lien permanent sur des pièces d'identité. */
    const ouvrirPiece = async (pieceId: string) => {
        try {
            const res = await fetch(`/api/admin/myafro-recap/pieces?piece=${encodeURIComponent(pieceId)}`)
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.url) { alert(json.error || 'Ouverture impossible.'); return }
            window.open(json.url, '_blank', 'noopener,noreferrer')
        } catch { alert('Ouverture impossible.') }
    }

    const majStatut = async (id: string, statut: string) => {
        await fetch('/api/admin/myafro-recap', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, statut }),
        })
        setDemandes(l => l.map(d => (d.id === id ? { ...d, statut } : d)))
        setOuverte(o => (o && o.id === id ? { ...o, statut } : o))
    }

    const enregistrer = async () => {
        if (!ouverte) return
        setEnregistre(false)
        await fetch('/api/admin/myafro-recap', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: ouverte.id, recap_ia: brouillon, notes_agent: notes }),
        })
        setDemandes(l => l.map(d => (d.id === ouverte.id ? { ...d, recap_ia: brouillon, notes_agent: notes } : d)))
        setEnregistre(true)
        setTimeout(() => setEnregistre(false), 2500)
    }

    const effacer = async (d: Recap) => {
        // Droit à l'effacement : irréversible, donc confirmé explicitement.
        if (!confirm(`Effacer définitivement la demande ${d.reference} et toutes les données de ${d.prenom} ${d.nom} ?`)) return
        const res = await fetch(`/api/admin/myafro-recap?id=${encodeURIComponent(d.id)}`, { method: 'DELETE' })
        if (res.ok) {
            setDemandes(l => l.filter(x => x.id !== d.id))
            setOuverte(null)
        }
    }

    return (
        <section className="mb-12">
            <RecapMyafroAjout
                ouvert={ajoutOuvert}
                onFermer={() => setAjoutOuvert(false)}
                onCree={(d) => setDemandes(l => [d as unknown as Recap, ...l])}
            />
            <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Service en ligne</span>
                    <h2 className="text-2xl font-black text-white flex items-center gap-2">
                        <FileMagnifyingGlass size={22} className="text-emerald-400" />
                        Récaps de dossier <span className="text-gray-500 font-bold text-lg">({demandes.length})</span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Demandes déposées et réglées directement depuis la page du service — aucun lien à envoyer.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={charger} className="text-xs font-bold text-emerald-400 hover:text-emerald-300">Actualiser</button>
                    {/* La file ne se remplissait QUE par le formulaire public : un
                        client recu au telephone ou en agence n'existait nulle part. */}
                    <button
                        onClick={() => setAjoutOuvert(true)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-black hover:bg-emerald-400"
                    >
                        <Plus size={13} weight="bold" /> Ajouter un client
                    </button>
                </div>
            </div>

            {migration && (
                <div className="mb-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                    <WarningCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200">
                        La table <code className="font-mono">myafro_recap_requests</code> n’existe pas encore :
                        exécutez la migration <code className="font-mono">20260820_recap_myafroorigins.sql</code> dans Supabase.
                    </p>
                </div>
            )}

            {chargement ? (
                <div className="flex justify-center py-14">
                    <CircleNotch size={26} className="text-emerald-500 animate-spin" />
                </div>
            ) : erreur && !migration ? (
                <p className="text-center py-10 text-sm text-gray-500">{erreur}</p>
            ) : demandes.length === 0 ? (
                <div className="text-center py-14 text-gray-500 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <FileMagnifyingGlass className="mx-auto mb-3 text-gray-700" size={40} />
                    <p className="text-sm">Aucun récap demandé pour l’instant.</p>
                    <p className="text-xs text-gray-600 mt-1">Les demandes payées depuis le site apparaîtront ici.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {demandes.map((d, i) => {
                        const cfg = STATUTS[d.statut] || STATUTS.nouveau
                        return (
                            <motion.div
                                key={d.id}
                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                                className="bg-white/[0.03] border border-white/5 rounded-xl p-5 hover:border-emerald-500/20 transition-all"
                            >
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${cfg.classe}`}>
                                                {cfg.label}
                                            </span>
                                            <span className="font-mono text-[11px] text-gray-500">{d.reference}</span>
                                            <span className="text-[11px] text-emerald-400 font-bold">
                                                {d.montant} {d.devise === 'XOF' ? 'FCFA' : d.devise}
                                            </span>
                                        </div>
                                        <h3 className="text-white font-black mt-2 flex items-center gap-2">
                                            <User size={15} className="text-gray-500" /> {d.prenom} {d.nom}
                                        </h3>
                                        <div className="flex items-center gap-4 mt-1 flex-wrap text-[11px] text-gray-500">
                                            <span className="flex items-center gap-1"><Envelope size={12} /> {d.email}</span>
                                            <span className="flex items-center gap-1"><Phone size={12} /> {d.telephone}</span>
                                            {!!d.depuis_quand && <span>Bloqué depuis : {d.depuis_quand}</span>}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-3 line-clamp-2 max-w-2xl">{d.situation}</p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => ouvrir(d)}
                                            className="text-xs font-bold px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all"
                                        >
                                            Ouvrir la fiche
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {/* ── Fiche détaillée ── */}
            {ouverte && (
                <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 sm:p-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-[#0b0f14] border border-white/10 rounded-2xl w-full max-w-3xl my-8"
                    >
                        <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5">
                            <div>
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">
                                    Récap de dossier MyAfroOrigins
                                </span>
                                <h3 className="text-xl font-black text-white mt-1">{ouverte.prenom} {ouverte.nom}</h3>
                                <p className="font-mono text-[11px] text-gray-500 mt-1">{ouverte.reference}</p>
                            </div>
                            <button onClick={() => setOuverte(null)} className="w-9 h-9 rounded-full bg-white/5 text-gray-400 hover:text-white flex items-center justify-center">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Ce que le client a écrit */}
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Situation décrite</p>
                                <p className="text-sm text-gray-200 whitespace-pre-wrap bg-white/[0.03] border border-white/5 rounded-xl p-4">
                                    {ouverte.situation}
                                </p>
                                {!!ouverte.attentes && (
                                    <>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-4 mb-2">Attentes</p>
                                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{ouverte.attentes}</p>
                                    </>
                                )}
                            </div>

                            {/* Traçabilité */}
                            <div className="grid grid-cols-2 gap-3 text-[11px]">
                                {[
                                    ['Déposé le', dateFr(ouverte.created_at)],
                                    ['Réf. MyAfroOrigins', ouverte.myafro_reference || 'non communiquée'],
                                    ['Pays de résidence', ouverte.pays_residence || '—'],
                                    ['Paiement', `${ouverte.paiement_moyen || '—'} · ${ouverte.paiement_ref || '—'}`],
                                    ['Consentement', dateFr(ouverte.consentement_le)],
                                    ['Conservation jusqu’au', ouverte.purge_apres || '—'],
                                ].map(([k, v]) => (
                                    <div key={k} className="bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
                                        <span className="block text-gray-600">{k}</span>
                                        <span className="text-gray-300 font-semibold break-words">{v}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Pièces déposées par le client */}
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Paperclip size={13} /> Pièces déposées par le client
                                    <span className="text-gray-600">({pieces.length})</span>
                                </p>
                                {!piecesChargees ? (
                                    <p className="text-xs text-gray-600">Chargement…</p>
                                ) : pieces.length === 0 ? (
                                    <p className="text-xs text-gray-600 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                        Aucune pièce déposée. Le client peut en ajouter depuis la page du service
                                        ou depuis l’application, avec sa référence.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {pieces.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => ouvrirPiece(p.id)}
                                                className="w-full flex items-center gap-3 bg-white/[0.03] border border-white/5 hover:border-emerald-500/30 rounded-xl px-4 py-3 text-left transition-all"
                                            >
                                                {p.source === 'mobile'
                                                    ? <DeviceMobile size={15} className="text-emerald-400 shrink-0" />
                                                    : <Globe size={15} className="text-blue-400 shrink-0" />}
                                                <span className="flex-1 min-w-0 text-xs font-semibold text-white truncate">{p.file_name}</span>
                                                <span className="text-[10px] text-gray-500 shrink-0">{poids(p.file_size)}</span>
                                                <span className="text-[10px] text-gray-600 shrink-0">{dateFr(p.created_at)}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* La fiche, modifiable avant remise */}
                            <div>
                                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                        Fiche d’analyse — relisez avant de la remettre
                                    </p>
                                    {/* La fiche n'etait produite qu'UNE FOIS, a la seconde du
                                        depot public : une demande saisie a la main n'en avait
                                        aucune, et l'equipe pouvait seulement la reecrire
                                        entierement a la main. */}
                                    <button
                                        type="button"
                                        onClick={() => genererFiche(ouverte.id)}
                                        disabled={generation}
                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-black hover:bg-emerald-500/25 disabled:opacity-50"
                                    >
                                        {generation
                                            ? <CircleNotch size={12} className="animate-spin" />
                                            : <Sparkle size={12} weight="fill" />}
                                        {brouillon.trim() ? 'Regénérer la fiche' : 'Générer la fiche'}
                                    </button>
                                </div>
                                {erreurGen && (
                                    <p className="mb-2 text-[11px] text-amber-400">{erreurGen}</p>
                                )}
                                <textarea
                                    value={brouillon}
                                    onChange={e => setBrouillon(e.target.value)}
                                    rows={14}
                                    placeholder="La fiche générée apparaît ici. Vous pouvez la corriger, la compléter, ou la rédiger entièrement."
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 text-sm text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-emerald-500/40"
                                />
                            </div>

                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Notes internes</p>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    rows={3}
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-sm text-gray-300 focus:outline-none focus:border-emerald-500/40"
                                />
                            </div>

                            {/* Avancement */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {Object.entries(STATUTS).map(([cle, cfg]) => (
                                    <button
                                        key={cle}
                                        onClick={() => majStatut(ouverte.id, cle)}
                                        className={`text-[11px] font-bold px-3 py-2 rounded-xl border transition-all ${ouverte.statut === cle ? cfg.classe : 'bg-white/5 text-gray-500 border-white/5 hover:text-white'}`}
                                    >
                                        {cfg.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 p-6 border-t border-white/5">
                            <button
                                onClick={() => effacer(ouverte)}
                                className="flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300"
                                title="Droit à l’effacement"
                            >
                                <Trash size={15} /> Effacer les données
                            </button>
                            <button
                                onClick={enregistrer}
                                className="flex items-center gap-2 text-xs font-bold px-5 py-3 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 transition-all"
                            >
                                <FloppyDisk size={15} /> {enregistre ? 'Enregistré' : 'Enregistrer'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </section>
    )
}
