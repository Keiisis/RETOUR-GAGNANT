'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, CircleNotch, FileText, Plus, Prohibit, X } from '@phosphor-icons/react'
import { ETAPES_NATIONALITE, lireAvancement, statutPourAvancement, type Avancement, type EtapeSuivi } from '@/lib/suivi-nationalite'
import { statutNationalite } from '@/lib/constants/statuts'

/* Panneau « Suivi client » (onglets nationalité admin + agent).
   Montre et règle exactement ce que le client voit sur /suivi-dossier :
   les 7 étapes, une note par étape, les pièces qu'on lui demande. Le statut
   de la demande en découle (lib/suivi-nationalite). */

interface Piece { id: string; nom: string; date: string; url: string | null }
interface Donnees { ref: string | null; status: string; etapes: EtapeSuivi[]; documents_manquants: string[]; pieces: Piece[] }

const SUGGESTIONS = ['Acte de naissance (intégral)', 'Casier judiciaire (moins de 3 mois)', 'Justificatif de domicile', 'Copie du passeport', 'Acte de naissance du père', 'Acte de naissance de la mère', 'Acte de mariage', 'Photo d’identité']

export default function SuiviClientPanneau({ id, titre, onClose, onEnregistre }: {
    id: string
    titre: string
    onClose: () => void
    /** Appelé avec le nouveau statut de la demande après enregistrement. */
    onEnregistre?: (status: string) => void
}) {
    const [donnees, setDonnees] = useState<Donnees | null>(null)
    const [erreur, setErreur] = useState('')
    const [av, setAv] = useState<Avancement>({ faites: 1, enCours: false })
    const [rejet, setRejet] = useState(false)
    const [notes, setNotes] = useState<Record<number, string>>({})
    const [manquants, setManquants] = useState<string[]>([])
    const [nouvelle, setNouvelle] = useState('')
    const [enregistrement, setEnregistrement] = useState<'' | 'cours' | 'ok'>('')

    useEffect(() => {
        let actif = true
        fetch(`/api/agent/nationalite/suivi?id=${encodeURIComponent(id)}`).then(async r => {
            const j = await r.json().catch(() => ({}))
            if (!actif) return
            if (!r.ok) { setErreur(j.error || `Erreur ${r.status}`); return }
            const d = j as Donnees
            setDonnees(d)
            setAv(lireAvancement(d.etapes))
            setRejet(d.status === 'rejete')
            setNotes(Object.fromEntries((d.etapes || []).map(e => [e.id, NOTES_SYSTEME.has(e.note) ? '' : (e.note || '')])))
            setManquants(d.documents_manquants || [])
        }).catch(() => actif && setErreur('Erreur réseau.'))
        return () => { actif = false }
    }, [id])

    useEffect(() => {
        const avant = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', echap)
        return () => { document.body.style.overflow = avant; window.removeEventListener('keydown', echap) }
    }, [onClose])

    const choisir = (a: Avancement, r = false) => { setAv(a); setRejet(r); setEnregistrement('') }
    const ajouter = (v: string) => {
        const s = v.replace(/\s+/g, ' ').trim()
        if (s && !manquants.includes(s)) setManquants(m => [...m, s])
        setNouvelle(''); setEnregistrement('')
    }

    const enregistrer = async () => {
        setEnregistrement('cours'); setErreur('')
        try {
            const r = await fetch('/api/agent/nationalite/suivi', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, faites: av.faites, enCours: av.enCours, rejet, notes, documents_manquants: manquants }),
            })
            const j = await r.json().catch(() => ({}))
            if (!r.ok) throw new Error(j.error || `Erreur ${r.status}`)
            setEnregistrement('ok')
            onEnregistre?.(j.status)
        } catch (e) {
            setEnregistrement('')
            setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.')
        }
    }

    const liste = rejet ? ETAPES_NATIONALITE.slice(0, 6) : ETAPES_NATIONALITE
    const faitesAff = rejet ? 6 : av.faites
    const progression = Math.round((faitesAff / liste.length) * 100)
    const statutCalcule = statutNationalite(rejet ? 'rejete' : statutPourAvancement(av.faites))

    if (typeof document === 'undefined') return null
    return createPortal(
        <div className="fixed inset-0 z-[2147483000] bg-slate-900/60 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Suivi client">
            <div className="w-full sm:max-w-3xl h-full sm:h-auto sm:max-h-[94vh] bg-white sm:rounded-2xl flex flex-col overflow-hidden text-slate-900">
                <header className="shrink-0 px-5 py-4 border-b border-slate-200 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#008751]">Suivi client · ce que voit le client sur /suivi-dossier</p>
                        <h2 className="text-lg font-bold truncate">{titre}{donnees?.ref ? <span className="font-normal text-slate-500"> · {donnees.ref}</span> : null}</h2>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-2xl font-black text-[#008751] leading-none">{progression}%</p>
                        <p className="text-[11px] text-slate-500 mt-1">progression</p>
                    </div>
                    <button onClick={onClose} aria-label="Fermer" title="Fermer (Échap)" className="h-9 w-9 shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"><X size={18} /></button>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-6">
                    {!donnees && !erreur && <p className="text-sm text-slate-500 flex items-center gap-2"><CircleNotch size={16} className="animate-spin" /> Chargement du suivi…</p>}
                    {donnees && (
                        <>
                            <section>
                                <h3 className="text-sm font-bold mb-1">Étapes</h3>
                                <p className="text-xs text-slate-500 mb-3">Cliquez l&apos;étape en cours : les précédentes passent en « Terminé ». La note s&apos;affiche au client sous l&apos;étape.</p>
                                <ol className="space-y-2">
                                    {liste.map((def, i) => {
                                        const n = i + 1
                                        const etat = n <= faitesAff ? 'completed' : (n === faitesAff + 1 && av.enCours && !rejet) ? 'in_progress' : 'pending'
                                        const actif = etat === 'in_progress' || (rejet && n === 6)
                                        return (
                                            <li key={n} className={`rounded-xl border p-3 ${actif ? 'border-[#C99400] bg-[#FDF4D6]/60' : etat === 'completed' ? 'border-[#008751]/30 bg-[#008751]/[0.04]' : 'border-slate-200'}`}>
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-7 h-7 shrink-0 rounded-full text-xs font-bold flex items-center justify-center ${etat === 'completed' ? 'bg-[#008751] text-white' : etat === 'in_progress' ? 'bg-[#C99400] text-white' : 'bg-slate-200 text-slate-600'}`}>
                                                        {etat === 'completed' ? <Check size={14} weight="bold" /> : n}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-semibold">{def.label}</p>
                                                        <p className={`text-[11px] font-bold uppercase tracking-wider ${etat === 'completed' ? 'text-[#008751]' : etat === 'in_progress' ? 'text-[#A07600]' : 'text-slate-400'}`}>
                                                            {rejet && n === 6 ? 'Rejeté' : etat === 'completed' ? 'Terminé' : etat === 'in_progress' ? 'En cours' : 'En attente'}
                                                        </p>
                                                    </div>
                                                    {!rejet && n > 1 && etat !== 'in_progress' && (
                                                        <button onClick={() => choisir({ faites: n - 1, enCours: true })} className="text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                                                            {etat === 'completed' ? 'Revenir à cette étape' : 'Mettre en cours'}
                                                        </button>
                                                    )}
                                                    {!rejet && etat === 'in_progress' && (
                                                        <button onClick={() => choisir({ faites: n, enCours: n < 7 })} className="text-xs font-bold text-white bg-[#008751] hover:bg-[#00703F] px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                                                            {n === 7 ? 'Terminer le dossier' : 'Terminer cette étape'}
                                                        </button>
                                                    )}
                                                    {n === 6 && (rejet
                                                        ? <button onClick={() => choisir({ faites: 5, enCours: true })} className="text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg whitespace-nowrap">Annuler le rejet</button>
                                                        : <button onClick={() => choisir({ faites: 6, enCours: false }, true)} title="Rejeter la demande" className="text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap"><Prohibit size={13} /> Rejeter</button>)}
                                                </div>
                                                {(etat !== 'pending' || notes[n]) && (
                                                    <textarea
                                                        value={notes[n] || ''}
                                                        onChange={e => { setNotes(x => ({ ...x, [n]: e.target.value })); setEnregistrement('') }}
                                                        placeholder={etat === 'completed' ? def.fait : 'Note visible par le client (facultatif)'}
                                                        rows={1}
                                                        className="mt-2 w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:border-[#008751] focus-visible:ring-2 focus-visible:ring-[#008751]/25"
                                                    />
                                                )}
                                            </li>
                                        )
                                    })}
                                </ol>
                            </section>

                            <section>
                                <h3 className="text-sm font-bold mb-1">Pièces demandées au client</h3>
                                <p className="text-xs text-slate-500 mb-3">Affichées en « Action requise » sur /suivi-dossier ; le client les dépose depuis cette page.</p>
                                {manquants.length > 0 && (
                                    <ul className="space-y-1.5 mb-3">
                                        {manquants.map(m => (
                                            <li key={m} className="flex items-center gap-2 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                                <span className="flex-1 min-w-0">{m}</span>
                                                <button onClick={() => { setManquants(x => x.filter(y => y !== m)); setEnregistrement('') }} aria-label={`Retirer ${m}`} className="text-red-600 hover:bg-red-100 rounded p-1"><X size={14} /></button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <div className="flex gap-2">
                                    <input value={nouvelle} onChange={e => setNouvelle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ajouter(nouvelle) }} list="pieces-suggerees"
                                        placeholder="Ex. Casier judiciaire (moins de 3 mois)"
                                        className="flex-1 min-w-0 text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-[#008751] focus-visible:ring-2 focus-visible:ring-[#008751]/25" />
                                    <datalist id="pieces-suggerees">{SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
                                    <button onClick={() => ajouter(nouvelle)} className="text-sm font-bold text-[#008751] border border-[#008751]/40 hover:bg-[#008751]/10 px-3 rounded-lg flex items-center gap-1 whitespace-nowrap"><Plus size={14} /> Demander</button>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-sm font-bold mb-2">Pièces déposées par le client depuis le suivi</h3>
                                {donnees.pieces.length === 0
                                    ? <p className="text-sm text-slate-500">Aucune pour l&apos;instant.</p>
                                    : <ul className="space-y-1.5">{donnees.pieces.map(p => (
                                        <li key={p.id} className="flex items-center gap-2 text-sm">
                                            <FileText size={16} className="text-slate-400 shrink-0" />
                                            {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[#008751] font-semibold hover:underline truncate">{p.nom}</a> : <span className="truncate">{p.nom}</span>}
                                            <span className="text-xs text-slate-400 shrink-0">{new Date(p.date).toLocaleDateString('fr-FR')}</span>
                                        </li>
                                    ))}</ul>}
                            </section>
                        </>
                    )}
                    {erreur && <p className="text-sm font-semibold text-red-600">{erreur}</p>}
                </div>

                <footer className="shrink-0 px-5 py-3 border-t border-slate-200 flex flex-wrap items-center gap-3">
                    <p className="flex-1 min-w-0 text-sm text-slate-600">
                        Statut de la demande : <span className={`ml-1 text-xs font-bold px-2 py-0.5 rounded-full ${statutCalcule.badge}`} style={{ color: statutCalcule.hex }}>{statutCalcule.label}</span> <span className="text-xs text-slate-400">(automatique)</span>
                    </p>
                    <button onClick={enregistrer} disabled={!donnees || enregistrement === 'cours'} className="h-10 px-5 rounded-lg bg-[#008751] hover:bg-[#00703F] disabled:opacity-60 text-white text-sm font-bold flex items-center gap-2">
                        {enregistrement === 'cours' ? <><CircleNotch size={16} className="animate-spin" /> Enregistrement…</> : enregistrement === 'ok' ? <><Check size={16} /> Enregistré</> : 'Enregistrer le suivi'}
                    </button>
                </footer>
            </div>
        </div>,
        document.body,
    )
}

/** Notes générées par le système : pas affichées comme saisie de l'équipe. */
const NOTES_SYSTEME = new Set([...ETAPES_NATIONALITE.map(e => e.fait), 'Demande non retenue. Contactez-nous pour en connaître les motifs.', 'Décision rendue.', ''])
