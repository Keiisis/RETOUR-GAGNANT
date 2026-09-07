'use client'

// ══════════════════════════════════════════════════════════════
//  L'ÉDITEUR DE RAPPORT HEBDOMADAIRE — partagé par les deux panels.
//
//  Un seul composant pour l'agent et pour l'admin : la différence n'est pas
//  dans l'écran mais dans les DROITS, et ceux-ci sont tenus par le serveur.
//  En faire deux copies aurait garanti qu'elles divergent.
//
//  Le formulaire est DYNAMIQUE parce que le modèle l'est : une semaine compte
//  trois réalisations, la suivante en compte huit ; un dossier a quatre champs
//  de suivi, un autre en a deux. Un formulaire à cases fixes aurait obligé à
//  tout faire entrer dans un moule, ou à laisser des vides dans le PDF.
//
//  Couleurs : variables `--panel-*`, qui suivent le thème clair ⇄ sombre du
//  panel. Aucune couleur écrite en dur.
// ══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
    FloppyDisk, FilePdf, Plus, Trash, CircleNotch, WarningCircle, CheckCircle,
    PaperPlaneTilt, CaretDown, CaretRight, Notepad, User,
} from '@phosphor-icons/react'
import {
    normaliserContenu, rapportVierge, realisationVierge, ficheVierge,
    lundiDe, dimancheDe,
    type ContenuRapport, type Accent,
} from '@/lib/rapport-hebdo'

interface Rapport {
    id: string
    auteur_id: string
    auteur_nom: string
    auteur_role: string | null
    semaine_du: string
    semaine_au: string | null
    titre: string | null
    destinataire: string
    contenu: unknown
    statut: string
    transmis_le: string | null
    created_at: string
}

const ACCENTS: Array<{ v: Accent; l: string; c: string }> = [
    { v: 'vert', l: 'Vert — avancée', c: '#008751' },
    { v: 'jaune', l: 'Jaune — vigilance', c: '#FCD116' },
    { v: 'rouge', l: 'Rouge — alerte', c: '#E8112D' },
]

const ETATS = ['EN COURS', 'ATTENTE PAIEMENT', 'ATTENTE CLIENT', 'ATTENTE PIÈCES', 'BLOQUÉ', 'TERMINÉ']

const dateFr = (iso?: string | null) => {
    if (!iso) return '—'
    try { return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) }
    catch { return String(iso) }
}

export default function RapportHebdoEditeur() {
    const [rapports, setRapports] = useState<Rapport[]>([])
    const [estAdmin, setEstAdmin] = useState(false)
    const [moi, setMoi] = useState<string | null>(null)
    const [chargement, setChargement] = useState(true)
    const [migration, setMigration] = useState(false)
    const [erreur, setErreur] = useState('')

    const [semaine, setSemaine] = useState(() => lundiDe())
    const [contenu, setContenu] = useState<ContenuRapport>(() => rapportVierge())
    const [role, setRole] = useState('')
    const [destinataire, setDestinataire] = useState('Madame la Directrice Générale')
    const [enregistre, setEnregistre] = useState(false)
    const [envoi, setEnvoi] = useState(false)
    const [ouvertes, setOuvertes] = useState({ s1: true, s2: true, s3: true })

    const champ = 'w-full rounded-xl px-3.5 py-2.5 text-sm outline-none border focus:border-emerald-500/60'
    const sc = {
        background: 'var(--panel-surface-alt)',
        borderColor: 'var(--panel-border)',
        color: 'var(--panel-text)',
    } as React.CSSProperties
    const lab = 'block text-[10px] font-bold uppercase tracking-widest mb-1.5'
    const sl = { color: 'var(--panel-text-muted)' } as React.CSSProperties

    const charger = useCallback(async () => {
        setChargement(true); setErreur(''); setMigration(false)
        try {
            const res = await fetch('/api/agent/rapports-hebdo')
            const json = await res.json().catch(() => ({}))
            if (!res.ok) { setMigration(!!json.migration_requise); throw new Error(json.error || 'Chargement impossible.') }
            setRapports(Array.isArray(json.rapports) ? json.rapports : [])
            setEstAdmin(!!json.est_admin)
            setMoi(json.moi || null)
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Chargement impossible.')
        } finally { setChargement(false) }
    }, [])

    useEffect(() => { charger() }, [charger])

    /* Le rapport DE LA SEMAINE CHOISIE, s'il existe déjà : on reprend l'édition
       au lieu d'en créer un second — la base l'interdirait de toute façon. */
    const rapportCourant = useMemo(
        () => rapports.find(r => r.semaine_du === semaine && (estAdmin ? r.auteur_id === moi : true)) || null,
        [rapports, semaine, estAdmin, moi],
    )

    useEffect(() => {
        if (rapportCourant) {
            setContenu(normaliserContenu(rapportCourant.contenu))
            setRole(rapportCourant.auteur_role || '')
            setDestinataire(rapportCourant.destinataire || 'Madame la Directrice Générale')
        } else {
            setContenu(rapportVierge())
        }
    }, [rapportCourant])

    const maj = <K extends keyof ContenuRapport>(k: K, v: ContenuRapport[K]) =>
        setContenu(p => ({ ...p, [k]: v }))

    const enregistrer = async (): Promise<string | null> => {
        setEnvoi(true); setErreur('')
        try {
            const res = await fetch('/api/agent/rapports-hebdo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ semaine_du: semaine, contenu, auteur_role: role, destinataire }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) { setMigration(!!json.migration_requise); throw new Error(json.error || 'Enregistrement impossible.') }
            await charger()
            setEnregistre(true); setTimeout(() => setEnregistre(false), 2500)
            return json.rapport?.id || null
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.')
            return null
        } finally { setEnvoi(false) }
    }

    /* Télécharger suppose que le rapport EXISTE côté serveur : on enregistre
       d'abord, sinon on produirait le PDF d'une version périmée — ou de rien. */
    const telecharger = async () => {
        const id = rapportCourant?.id || await enregistrer()
        if (!id) return
        window.open(`/api/agent/rapports-hebdo/pdf?id=${encodeURIComponent(id)}`, '_blank', 'noopener')
    }

    const transmettre = async () => {
        const id = rapportCourant?.id || await enregistrer()
        if (!id) return
        await fetch('/api/agent/rapports-hebdo', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, statut: 'transmis' }),
        })
        charger()
    }

    const Section = ({ id, num, titre, enfants }: { id: 's1' | 's2' | 's3'; num: string; titre: string; enfants: React.ReactNode }) => (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-surface)' }}>
            <button type="button" onClick={() => setOuvertes(o => ({ ...o, [id]: !o[id] }))}
                className="w-full flex items-center gap-3 px-5 py-4 text-left">
                <span className="w-7 h-7 rounded-lg bg-emerald-500 text-black text-xs font-black flex items-center justify-center shrink-0">{num}</span>
                <span className="flex-1 text-sm font-black" style={{ color: 'var(--panel-text-heading)' }}>{titre}</span>
                {ouvertes[id] ? <CaretDown size={14} style={{ color: 'var(--panel-text-muted)' }} /> : <CaretRight size={14} style={{ color: 'var(--panel-text-muted)' }} />}
            </button>
            {ouvertes[id] && <div className="px-5 pb-5 space-y-4">{enfants}</div>}
        </div>
    )

    if (chargement) {
        return <div className="flex justify-center py-20"><CircleNotch size={26} className="text-emerald-500 animate-spin" /></div>
    }

    return (
        <div className="space-y-6">
            {migration && (
                <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
                    <WarningCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200">
                        La table <code className="font-mono">rapports_hebdo</code> n’existe pas encore :
                        exécutez <code className="font-mono">20260905_rapports_hebdo.sql</code> dans Supabase.
                    </p>
                </div>
            )}

            {/* ── Période et destinataire ── */}
            <div className="rounded-2xl border p-5 grid sm:grid-cols-4 gap-4"
                style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-surface)' }}>
                <div>
                    <label className={lab} style={sl}>Semaine du (lundi)</label>
                    <input type="date" value={semaine} onChange={e => setSemaine(lundiDe(new Date(e.target.value + 'T00:00:00')))}
                        className={champ} style={sc} title="Semaine du rapport" />
                    <p className="mt-1 text-[11px]" style={sl}>au {dateFr(dimancheDe(semaine))}</p>
                </div>
                <div>
                    <label className={lab} style={sl}>Votre fonction</label>
                    <input value={role} onChange={e => setRole(e.target.value)} className={champ} style={sc} placeholder="Agent terrain" />
                </div>
                <div className="sm:col-span-2">
                    <label className={lab} style={sl}>Destinataire</label>
                    <input value={destinataire} onChange={e => setDestinataire(e.target.value)} className={champ} style={sc} />
                </div>
            </div>

            {/* ── Note de cadrage ── */}
            <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-surface)' }}>
                <label className={lab} style={sl}>Note de cadrage pour la direction</label>
                <textarea rows={3} value={contenu.note_cadrage} onChange={e => maj('note_cadrage', e.target.value)}
                    className={champ + ' resize-y leading-relaxed'} style={sc}
                    placeholder="En deux ou trois phrases : ce qu’il faut retenir de la semaine." />
                <div className="mt-3">
                    <label className={lab} style={sl}>Statut des opérations</label>
                    <input value={contenu.statut_operations} onChange={e => maj('statut_operations', e.target.value)} className={champ} style={sc} />
                </div>
            </div>

            {/* ── Section 1 : réalisations ── */}
            <Section id="s1" num="1" titre="Réalisations de la semaine" enfants={
                <>
                    <div>
                        <label className={lab} style={sl}>Titre de la section</label>
                        <input value={contenu.section1_titre} onChange={e => maj('section1_titre', e.target.value)} className={champ} style={sc} />
                    </div>

                    {contenu.realisations.map((r, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border p-4 space-y-3"
                            style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-surface-alt)' }}>
                            <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-md text-[10px] font-black flex items-center justify-center shrink-0"
                                    style={{ background: ACCENTS.find(a => a.v === r.accent)?.c, color: r.accent === 'jaune' ? '#3C3C3C' : '#fff' }}>
                                    {i + 1}
                                </span>
                                <input value={r.titre} placeholder="Intitulé de la réalisation"
                                    onChange={e => maj('realisations', contenu.realisations.map((x, j) => j === i ? { ...x, titre: e.target.value } : x))}
                                    className={champ} style={sc} />
                                <button type="button" title="Retirer"
                                    onClick={() => maj('realisations', contenu.realisations.filter((_, j) => j !== i))}
                                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-gray-400 hover:text-red-400"
                                    style={{ background: 'var(--panel-surface-hover)' }}>
                                    <Trash size={14} />
                                </button>
                            </div>
                            <textarea rows={2} value={r.description} placeholder="Ce que cela change concrètement, en langage clair."
                                onChange={e => maj('realisations', contenu.realisations.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                                className={champ + ' resize-y'} style={sc} />
                            <div className="grid sm:grid-cols-2 gap-3">
                                <input value={r.tag} placeholder="Étiquette : COMPTABILITÉ, SÉCURITÉ…"
                                    onChange={e => maj('realisations', contenu.realisations.map((x, j) => j === i ? { ...x, tag: e.target.value.toUpperCase() } : x))}
                                    className={champ} style={sc} />
                                <select value={r.accent} title="Couleur d’accent"
                                    onChange={e => maj('realisations', contenu.realisations.map((x, j) => j === i ? { ...x, accent: e.target.value as Accent } : x))}
                                    className={champ} style={sc}>
                                    {ACCENTS.map(a => <option key={a.v} value={a.v}>{a.l}</option>)}
                                </select>
                            </div>
                        </motion.div>
                    ))}

                    <button type="button" onClick={() => maj('realisations', [...contenu.realisations, realisationVierge()])}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-black">
                        <Plus size={13} weight="bold" /> Ajouter une réalisation
                    </button>

                    {/* Encadré libre */}
                    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-surface-alt)' }}>
                        <div className="flex items-center gap-2">
                            <Notepad size={14} className="text-emerald-500" />
                            <input value={contenu.encadre?.titre || ''} placeholder="Encadré complémentaire (facultatif) — son titre"
                                onChange={e => maj('encadre', { titre: e.target.value, lignes: contenu.encadre?.lignes || [] })}
                                className={champ} style={sc} />
                        </div>
                        {(contenu.encadre?.lignes || []).map((l, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span style={sl} className="text-xs">•</span>
                                <input value={l} placeholder="Une ligne = une puce"
                                    onChange={e => maj('encadre', {
                                        titre: contenu.encadre?.titre || '',
                                        lignes: (contenu.encadre?.lignes || []).map((x, j) => j === i ? e.target.value : x),
                                    })}
                                    className={champ} style={sc} />
                                <button type="button" title="Retirer la ligne"
                                    onClick={() => maj('encadre', {
                                        titre: contenu.encadre?.titre || '',
                                        lignes: (contenu.encadre?.lignes || []).filter((_, j) => j !== i),
                                    })}
                                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-gray-400 hover:text-red-400"
                                    style={{ background: 'var(--panel-surface-hover)' }}>
                                    <Trash size={13} />
                                </button>
                            </div>
                        ))}
                        <button type="button"
                            onClick={() => maj('encadre', { titre: contenu.encadre?.titre || '', lignes: [...(contenu.encadre?.lignes || []), ''] })}
                            className="text-xs font-bold text-emerald-500 hover:text-emerald-400">+ Ajouter une puce</button>
                    </div>
                </>
            } />

            {/* ── Section 2 : suivi des dossiers ── */}
            <Section id="s2" num="2" titre="Suivi opérationnel des dossiers" enfants={
                <>
                    <div>
                        <label className={lab} style={sl}>Titre de la section</label>
                        <input value={contenu.section2_titre} onChange={e => maj('section2_titre', e.target.value)} className={champ} style={sc} />
                    </div>
                    <div>
                        <label className={lab} style={sl}>Règle mise en avant (encadré rouge)</label>
                        <input value={contenu.regle_titre} onChange={e => maj('regle_titre', e.target.value)} className={champ + ' mb-2'} style={sc} />
                        <textarea rows={2} value={contenu.regle_texte} onChange={e => maj('regle_texte', e.target.value)}
                            className={champ + ' resize-y'} style={sc}
                            placeholder="La consigne que la direction doit voir en premier. Laissez vide pour ne pas l’afficher." />
                    </div>

                    {contenu.dossiers.map((d, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border p-4 space-y-3"
                            style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-surface-alt)' }}>
                            <div className="flex items-center gap-3">
                                <User size={15} className="text-emerald-500 shrink-0" />
                                <input value={d.client} placeholder="Nom du client"
                                    onChange={e => maj('dossiers', contenu.dossiers.map((x, j) => j === i ? { ...x, client: e.target.value } : x))}
                                    className={champ} style={sc} />
                                <button type="button" title="Retirer la fiche"
                                    onClick={() => maj('dossiers', contenu.dossiers.filter((_, j) => j !== i))}
                                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-gray-400 hover:text-red-400"
                                    style={{ background: 'var(--panel-surface-hover)' }}>
                                    <Trash size={14} />
                                </button>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <select value={d.etat} title="État du dossier"
                                    onChange={e => maj('dossiers', contenu.dossiers.map((x, j) => j === i ? { ...x, etat: e.target.value } : x))}
                                    className={champ} style={sc}>
                                    {ETATS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <select value={d.accent} title="Couleur d’accent"
                                    onChange={e => maj('dossiers', contenu.dossiers.map((x, j) => j === i ? { ...x, accent: e.target.value as Accent } : x))}
                                    className={champ} style={sc}>
                                    {ACCENTS.map(a => <option key={a.v} value={a.v}>{a.l}</option>)}
                                </select>
                            </div>

                            {d.champs.map((c, k) => (
                                <div key={k} className="grid sm:grid-cols-[minmax(0,13rem)_1fr_auto] gap-2 items-start">
                                    <input value={c.label} placeholder="Libellé"
                                        onChange={e => maj('dossiers', contenu.dossiers.map((x, j) => j === i
                                            ? { ...x, champs: x.champs.map((y, m) => m === k ? { ...y, label: e.target.value } : y) } : x))}
                                        className={champ} style={sc} />
                                    <textarea rows={2} value={c.valeur} placeholder="Contenu"
                                        onChange={e => maj('dossiers', contenu.dossiers.map((x, j) => j === i
                                            ? { ...x, champs: x.champs.map((y, m) => m === k ? { ...y, valeur: e.target.value } : y) } : x))}
                                        className={champ + ' resize-y'} style={sc} />
                                    <div className="flex gap-1">
                                        <button type="button" title="Mettre en évidence (rouge)"
                                            onClick={() => maj('dossiers', contenu.dossiers.map((x, j) => j === i
                                                ? { ...x, champs: x.champs.map((y, m) => m === k ? { ...y, alerte: !y.alerte } : y) } : x))}
                                            className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black"
                                            style={{ background: c.alerte ? 'rgba(232,17,45,0.15)' : 'var(--panel-surface-hover)', color: c.alerte ? '#E8112D' : 'var(--panel-text-muted)' }}>
                                            !
                                        </button>
                                        <button type="button" title="Retirer le champ"
                                            onClick={() => maj('dossiers', contenu.dossiers.map((x, j) => j === i
                                                ? { ...x, champs: x.champs.filter((_, m) => m !== k) } : x))}
                                            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400"
                                            style={{ background: 'var(--panel-surface-hover)' }}>
                                            <Trash size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button type="button"
                                onClick={() => maj('dossiers', contenu.dossiers.map((x, j) => j === i
                                    ? { ...x, champs: [...x.champs, { label: '', valeur: '' }] } : x))}
                                className="text-xs font-bold text-emerald-500 hover:text-emerald-400">+ Ajouter un champ de suivi</button>
                        </motion.div>
                    ))}

                    <button type="button" onClick={() => maj('dossiers', [...contenu.dossiers, ficheVierge()])}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-black">
                        <Plus size={13} weight="bold" /> Ajouter une fiche de suivi
                    </button>
                </>
            } />

            {/* ── Section 3 : synthèse ── */}
            <Section id="s3" num="3" titre="Synthèse et engagement" enfants={
                <>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                            <label className={lab} style={sl}>Titre de la section</label>
                            <input value={contenu.section3_titre} onChange={e => maj('section3_titre', e.target.value)} className={champ} style={sc} />
                        </div>
                        <div>
                            <label className={lab} style={sl}>Intitulé du bloc</label>
                            <input value={contenu.synthese_titre} onChange={e => maj('synthese_titre', e.target.value)} className={champ} style={sc} />
                        </div>
                    </div>
                    <div>
                        <label className={lab} style={sl}>Points majeurs pour la direction</label>
                        <textarea rows={5} value={contenu.synthese_texte} onChange={e => maj('synthese_texte', e.target.value)}
                            className={champ + ' resize-y leading-relaxed'} style={sc}
                            placeholder="Ce que la direction doit retenir, et ce sur quoi vous vous engagez pour la semaine suivante." />
                    </div>
                    <div>
                        <label className={lab} style={sl}>Mention finale</label>
                        <input value={contenu.mention_finale} onChange={e => maj('mention_finale', e.target.value)} className={champ + ' max-w-xs'} style={sc} />
                    </div>
                </>
            } />

            {erreur && !migration && (
                <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 p-3">
                    <WarningCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300">{erreur}</p>
                </div>
            )}

            {/* ── Barre d'action ── */}
            <div className="sticky bottom-0 flex flex-wrap gap-3 py-4 border-t"
                style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-bg)' }}>
                <button type="button" onClick={enregistrer} disabled={envoi}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 text-black text-xs font-black hover:bg-emerald-400 disabled:opacity-50">
                    {envoi ? <CircleNotch size={14} className="animate-spin" /> : enregistre ? <CheckCircle size={14} weight="fill" /> : <FloppyDisk size={14} />}
                    {enregistre ? 'Enregistré' : 'Enregistrer'}
                </button>
                <button type="button" onClick={telecharger} disabled={envoi}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black border disabled:opacity-50"
                    style={{ borderColor: 'var(--panel-border)', color: 'var(--panel-text)', background: 'var(--panel-surface)' }}>
                    <FilePdf size={14} /> Télécharger le PDF
                </button>
                <button type="button" onClick={transmettre} disabled={envoi}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black border disabled:opacity-50"
                    style={{ borderColor: 'var(--panel-border)', color: 'var(--panel-text)', background: 'var(--panel-surface)' }}>
                    <PaperPlaneTilt size={14} /> Transmettre à la direction
                </button>
                {rapportCourant && (
                    <span className="ml-auto self-center text-[11px]" style={sl}>
                        {rapportCourant.statut === 'transmis' ? 'Transmis le ' + dateFr(rapportCourant.transmis_le?.slice(0, 10))
                            : rapportCourant.statut === 'lu' ? 'Lu par la direction'
                                : 'Brouillon'}
                    </span>
                )}
            </div>

            {/* ── Historique ── */}
            {rapports.length > 0 && (
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-surface)' }}>
                    <p className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest border-b"
                        style={{ ...sl, borderColor: 'var(--panel-border)' }}>
                        {estAdmin ? 'Tous les rapports de l’équipe' : 'Mes rapports'}
                    </p>
                    <div className="divide-y" style={{ borderColor: 'var(--panel-border)' }}>
                        {rapports.map(r => (
                            <div key={r.id} className="flex items-center gap-3 px-5 py-3 flex-wrap">
                                <button type="button" onClick={() => setSemaine(r.semaine_du)}
                                    className="text-sm font-bold hover:underline" style={{ color: 'var(--panel-text-heading)' }}>
                                    {dateFr(r.semaine_du)}
                                </button>
                                {estAdmin && <span className="text-xs" style={sl}>{r.auteur_nom}</span>}
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
                                    style={{
                                        background: r.statut === 'transmis' ? 'rgba(16,185,129,0.15)' : 'var(--panel-surface-hover)',
                                        color: r.statut === 'transmis' ? '#10b981' : 'var(--panel-text-muted)',
                                    }}>
                                    {r.statut}
                                </span>
                                <a href={`/api/agent/rapports-hebdo/pdf?id=${encodeURIComponent(r.id)}`} target="_blank" rel="noopener noreferrer"
                                    className="ml-auto text-[11px] font-bold text-emerald-500 hover:text-emerald-400">PDF</a>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
