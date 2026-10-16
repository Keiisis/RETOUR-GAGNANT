'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowCounterClockwise as RotateCcw, FilePdf, Plus, Trash, X } from '@phosphor-icons/react'
import {
    ascendantVide, htmlPreuve, maillonVide, preuveDepuisDossier, preuveVierge,
    type Ascendant, type DossierSource, type MaillonLignee, type Parent, type PreuveAfro,
} from '@/lib/preuve-afro'

/* Éditeur de la « Preuve d'afro-descendance » (onglet Demandes de Nationalité).
   À gauche la saisie, à droite le document tel qu'il sera imprimé. Le PDF
   sort de la boîte d'impression du navigateur (« Enregistrer au format PDF »).
   Le brouillon est gardé dans ce navigateur, par référence de dossier. */

const CLE = (ref: string) => `rgb-preuve-afro:${ref || 'libre'}`

const lireBrouillon = (cle: string): PreuveAfro | null => {
    try {
        const brut = localStorage.getItem(cle)
        return brut ? { ...preuveVierge(), ...JSON.parse(brut) as PreuveAfro } : null
    } catch { return null }
}

const CLASSE = 'mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#008751] focus-visible:ring-2 focus-visible:ring-[#008751]/30'

function Champ({ l, v, maj, zone, ph }: { l: string; v: string; maj: (v: string) => void; zone?: boolean; ph?: string }) {
    return (
        <label className="block">
            <span className="text-[11px] font-bold text-slate-500">{l}</span>
            {zone
                ? <textarea value={v} onChange={e => maj(e.target.value)} rows={3} placeholder={ph} className={`${CLASSE} resize-y`} />
                : <input value={v} onChange={e => maj(e.target.value)} placeholder={ph} className={CLASSE} />}
        </label>
    )
}

function Bloc({ titre, children, ouvert }: { titre: string; children: React.ReactNode; ouvert?: boolean }) {
    return (
        <details open={ouvert} className="group border-b border-slate-200 py-3">
            <summary className="cursor-pointer select-none text-sm font-black text-slate-800 list-none flex items-center justify-between">
                {titre}<span className="text-slate-400 text-xs group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="mt-3 space-y-3">{children}</div>
        </details>
    )
}

export default function PreuveAfroEditeur({ source, onClose }: { source?: DossierSource | null; onClose: () => void }) {
    const depart = useMemo(() => source ? preuveDepuisDossier(source) : preuveVierge(), [source])
    const cle = CLE(source?.application_ref || '')
    const [d, setD] = useState<PreuveAfro>(() => lireBrouillon(cle) || depart)
    const [rendu, setRendu] = useState('')
    const iframe = useRef<HTMLIFrameElement>(null)
    const defilement = useRef(0)

    // Aperçu différé (250 ms) : chaque frappe ne recharge pas le document.
    useEffect(() => {
        const id = setTimeout(() => {
            defilement.current = iframe.current?.contentWindow?.scrollY || 0
            setRendu(htmlPreuve(d, window.location.origin))
            try { localStorage.setItem(cle, JSON.stringify(d)) } catch { /* stockage indisponible : brouillon non gardé */ }
        }, 250)
        return () => clearTimeout(id)
    }, [d, cle])

    useEffect(() => {
        const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', echap)
        return () => window.removeEventListener('keydown', echap)
    }, [onClose])

    const maj = <K extends keyof PreuveAfro>(k: K, v: PreuveAfro[K]) => setD(x => ({ ...x, [k]: v }))
    const majDem = (k: keyof PreuveAfro['demandeur'], v: string) => setD(x => ({ ...x, demandeur: { ...x.demandeur, [k]: v } }))
    const majFoyer = (k: keyof PreuveAfro['foyer'], v: string) => setD(x => ({ ...x, foyer: { ...x.foyer, [k]: v } }))
    const majParent = (qui: 'pere' | 'mere', k: keyof Parent, v: string) => setD(x => ({ ...x, [qui]: { ...x[qui], [k]: v } }))
    const majGp = (i: number, k: keyof Ascendant, v: string) =>
        setD(x => ({ ...x, grandsParents: x.grandsParents.map((g, j) => j === i ? { ...g, [k]: v } : g) }))
    const majLignee = (i: number, k: keyof MaillonLignee, v: string) =>
        setD(x => ({ ...x, lignee: x.lignee.map((m, j) => j === i ? { ...m, [k]: v } : m) }))

    const repartir = () => {
        if (!confirm(source ? 'Repartir des données du dossier ? La saisie en cours sera remplacée.' : 'Vider le document ?')) return
        setD(depart)
    }

    const imprimer = async () => {
        const w = iframe.current?.contentWindow
        if (!w) return
        await w.document.fonts?.ready
        // Le titre de la page devient le nom du fichier PDF proposé.
        const titre = document.title
        document.title = w.document.title
        w.focus()
        w.print()
        document.title = titre
    }

    const parent = (qui: 'pere' | 'mere', l: string) => (
        <Bloc titre={l}>
            <div className="grid grid-cols-2 gap-3">
                <Champ l="Nom" v={d[qui].nom} maj={v => majParent(qui, 'nom', v)} />
                <Champ l="Prénoms" v={d[qui].prenoms} maj={v => majParent(qui, 'prenoms', v)} />
            </div>
            <Champ l="Nom d'origine (si changement)" v={d[qui].nomOrigine} maj={v => majParent(qui, 'nomOrigine', v)} ph="COLGAR Joyce" />
            <Champ l="Naissance (date et lieu)" v={d[qui].naissance} maj={v => majParent(qui, 'naissance', v)} ph="31 octobre 1958 à Macouria (Guyane)" />
            <Champ l="Profession" v={d[qui].profession} maj={v => majParent(qui, 'profession', v)} />
            <Champ l="Filiation" v={d[qui].filiation} maj={v => majParent(qui, 'filiation', v)} ph="Fils de … et de …" />
        </Bloc>
    )

    return (
        <div className="fixed inset-0 z-[80] bg-slate-900/70 backdrop-blur-sm flex" role="dialog" aria-modal="true" aria-label="Preuve d'afro-descendance">
            <div className="m-auto w-full h-full lg:h-[94vh] lg:w-[96vw] bg-white lg:rounded-2xl overflow-hidden flex flex-col">
                <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#008751]">Document client</p>
                        <h2 className="text-lg font-black text-slate-900 truncate">Preuve d&apos;afro-descendance{source ? ` · ${[source.prenom, source.nom].filter(Boolean).join(' ')}` : ' · client hors plateforme'}</h2>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={repartir} className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap">
                            <RotateCcw size={14} /> {source ? 'Repartir du dossier' : 'Vider'}
                        </button>
                        <button onClick={imprimer} className="text-xs font-bold text-white bg-[#0F2350] hover:bg-[#0A1838] active:translate-y-px px-4 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E2AE22]">
                            <FilePdf size={15} /> Télécharger le PDF
                        </button>
                        <button onClick={onClose} title="Fermer" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
                    </div>
                </header>

                <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
                    <div className="lg:w-[430px] shrink-0 overflow-y-auto px-5 pb-8 border-r border-slate-200 max-h-[45vh] lg:max-h-none">
                        <Bloc titre="En-tête" ouvert>
                            <div className="grid grid-cols-2 gap-3">
                                <Champ l="Réf. dossier" v={d.ref} maj={v => maj('ref', v)} />
                                <Champ l="Date" v={d.date} maj={v => maj('date', v)} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className="text-[11px] font-bold text-slate-500">Civilité</span>
                                    <select value={d.civilite} onChange={e => maj('civilite', e.target.value as PreuveAfro['civilite'])} className={CLASSE}>
                                        <option value="M.">M.</option><option value="Mme">Mme</option>
                                    </select>
                                </label>
                                <Champ l="Statut" v={d.statut} maj={v => maj('statut', v)} />
                            </div>
                        </Bloc>

                        <Bloc titre="1 · Demandeur" ouvert={!source}>
                            <div className="grid grid-cols-2 gap-3">
                                <Champ l="Nom" v={d.demandeur.nom} maj={v => majDem('nom', v)} />
                                <Champ l="Prénoms" v={d.demandeur.prenoms} maj={v => majDem('prenoms', v)} />
                            </div>
                            <Champ l="Naissance (date et lieu)" v={d.demandeur.naissance} maj={v => majDem('naissance', v)} ph="22 août 1987 à Cayenne (Guyane française)" />
                            <Champ l="Nationalité actuelle" v={d.demandeur.nationalite} maj={v => majDem('nationalite', v)} />
                            <Champ l="Pièce d'identité" v={d.demandeur.piece} maj={v => majDem('piece', v)} ph="Passeport n° …" />
                            <Champ l="Profession" v={d.demandeur.profession} maj={v => majDem('profession', v)} />
                            <Champ l="Résidence" v={d.demandeur.residence} maj={v => majDem('residence', v)} />
                        </Bloc>

                        <Bloc titre="2 · Foyer">
                            <Champ l="Situation familiale" v={d.foyer.situation} maj={v => majFoyer('situation', v)} ph="Célibataire, marié(e), …" />
                            <Champ l="Filiation reconnue (vide = rédigée d'après les parents)" v={d.foyer.filiation} maj={v => majFoyer('filiation', v)} />
                            <Champ l="Conjoint(e)" v={d.foyer.conjoint} maj={v => majFoyer('conjoint', v)} />
                            <Champ l="Enfants (un par ligne)" v={d.foyer.enfants} maj={v => majFoyer('enfants', v)} zone />
                        </Bloc>

                        {parent('pere', '3 · Père')}
                        {parent('mere', '3 · Mère')}

                        <Bloc titre={`4 · Grands-parents (${d.grandsParents.length})`}>
                            {d.grandsParents.map((g, i) => (
                                <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-3 bg-slate-50/50">
                                    <div className="flex items-center gap-2">
                                        <select value={g.branche} onChange={e => majGp(i, 'branche', e.target.value)} className={`${CLASSE} mt-0`}>
                                            <option value="Maternelle">Branche maternelle</option><option value="Paternelle">Branche paternelle</option>
                                        </select>
                                        <button onClick={() => maj('grandsParents', d.grandsParents.filter((_, j) => j !== i))} title="Retirer" className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash size={15} /></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Champ l="Nom" v={g.nom} maj={v => majGp(i, 'nom', v)} />
                                        <Champ l="Prénoms" v={g.prenoms} maj={v => majGp(i, 'prenoms', v)} />
                                    </div>
                                    <Champ l="Surnom" v={g.surnom} maj={v => majGp(i, 'surnom', v)} />
                                    <Champ l="Naissance (date et lieu)" v={g.naissance} maj={v => majGp(i, 'naissance', v)} />
                                    <Champ l="Décès (date et lieu)" v={g.deces} maj={v => majGp(i, 'deces', v)} />
                                    <Champ l="Profession" v={g.profession} maj={v => majGp(i, 'profession', v)} />
                                    <Champ l="Filiation" v={g.filiation} maj={v => majGp(i, 'filiation', v)} />
                                </div>
                            ))}
                            <button onClick={() => maj('grandsParents', [...d.grandsParents, ascendantVide()])} className="text-xs font-bold text-[#008751] flex items-center gap-1"><Plus size={13} /> Ajouter un grand-parent</button>
                        </Bloc>

                        <Bloc titre={`5 · Lignée d'afro-descendance (${d.lignee.length})`}>
                            <label className="block">
                                <span className="text-[11px] font-bold text-slate-500">Branche portant l&apos;ascendance</span>
                                <select value={d.brancheLignee} onChange={e => maj('brancheLignee', e.target.value as PreuveAfro['brancheLignee'])} className={CLASSE}>
                                    <option value="Maternelle">Maternelle</option><option value="Paternelle">Paternelle</option><option value="Les deux">Les deux</option>
                                </select>
                            </label>
                            {d.lignee.map((m, i) => (
                                <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-3 bg-slate-50/50">
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1"><Champ l="Génération" v={m.generation} maj={v => majLignee(i, 'generation', v)} ph="4e génération" /></div>
                                        <button onClick={() => maj('lignee', d.lignee.filter((_, j) => j !== i))} title="Retirer" className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash size={15} /></button>
                                    </div>
                                    <Champ l="Branche (famille)" v={m.branche} maj={v => majLignee(i, 'branche', v)} ph="Monrose" />
                                    <Champ l="Identité" v={m.identite} maj={v => majLignee(i, 'identite', v)} ph="Wilson MONROSE & Estella GOODMAN" />
                                    <Champ l="Origines et mentions historiques" v={m.mentions} maj={v => majLignee(i, 'mentions', v)} zone />
                                </div>
                            ))}
                            <button onClick={() => maj('lignee', [...d.lignee, maillonVide()])} className="text-xs font-bold text-[#008751] flex items-center gap-1"><Plus size={13} /> Ajouter un ascendant</button>
                            <Champ l="Note sur l'ascendance" v={d.noteAscendance} maj={v => maj('noteAscendance', v)} zone />
                        </Bloc>

                        <Bloc titre="Clôture">
                            <Champ l="Note d'instruction (vide = texte par défaut)" v={d.noteInstruction} maj={v => maj('noteInstruction', v)} zone />
                            <Champ l="Cadre légal" v={d.cadreLegal} maj={v => maj('cadreLegal', v)} zone />
                            <Champ l="Signataire" v={d.signataire} maj={v => maj('signataire', v)} />
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" checked={d.cachet} onChange={e => maj('cachet', e.target.checked)} className="accent-[#008751]" /> Apposer le cachet de Retour Gagnant Bénin
                            </label>
                        </Bloc>
                    </div>

                    <div className="flex-1 min-h-0 bg-[#cfc8b8]">
                        <iframe
                            ref={iframe}
                            title="Aperçu du document"
                            srcDoc={rendu}
                            onLoad={() => iframe.current?.contentWindow?.scrollTo(0, defilement.current)}
                            className="w-full h-full border-0"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
