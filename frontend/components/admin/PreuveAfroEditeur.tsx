'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowCounterClockwise as RotateCcw, CaretDown, CircleNotch, Eye, FilePdf, PencilSimpleLine, Plus, Trash, X } from '@phosphor-icons/react'
import {
    ascendantVide, htmlPreuve, maillonVide, preuveDepuisDossier, preuveVierge,
    type Ascendant, type DossierSource, type MaillonLignee, type Parent, type PreuveAfro,
} from '@/lib/preuve-afro'
import { telechargerPreuvePdf } from '@/lib/preuve-afro-pdf'

/* Éditeur de la « Preuve d'afro-descendance » (onglet Demandes de Nationalité).

   Rendu dans <body> par un portail : monté dans la page, il passait sous la
   barre latérale et la barre du haut du panneau (2026-10-16, champs et
   boutons masqués). À gauche la saisie, à droite le document tel qu'il sera
   imprimé ; sur petit écran, une bascule Saisie / Aperçu. Le PDF se télécharge
   directement (lib/preuve-afro-pdf). Brouillon gardé dans ce navigateur. */

const CLE = (ref: string) => `rgb-preuve-afro:${ref || 'libre'}`
const LARGEUR_A4 = 794 // 210 mm à 96 ppp

const lireBrouillon = (cle: string): PreuveAfro | null => {
    try {
        const brut = localStorage.getItem(cle)
        return brut ? { ...preuveVierge(), ...JSON.parse(brut) as PreuveAfro } : null
    } catch { return null }
}

const CHAMP = 'mt-1.5 w-full min-w-0 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors hover:border-slate-400 focus:outline-none focus:border-[#008751] focus-visible:ring-2 focus-visible:ring-[#008751]/25'

function Champ({ l, v, maj, zone, ph, large }: { l: string; v: string; maj: (v: string) => void; zone?: boolean; ph?: string; large?: boolean }) {
    return (
        <label className={`block min-w-0 ${large ? 'sm:col-span-2' : ''}`}>
            <span className="text-xs font-semibold text-slate-600">{l}</span>
            {zone
                ? <textarea value={v} onChange={e => maj(e.target.value)} rows={3} placeholder={ph} className={`${CHAMP} resize-y leading-relaxed`} />
                : <input value={v} onChange={e => maj(e.target.value)} placeholder={ph} className={CHAMP} />}
        </label>
    )
}

function Choix<T extends string>({ l, v, maj, options }: { l: string; v: T; maj: (v: T) => void; options: [T, string][] }) {
    return (
        <label className="block min-w-0">
            <span className="text-xs font-semibold text-slate-600">{l}</span>
            <select value={v} onChange={e => maj(e.target.value as T)} className={CHAMP}>
                {options.map(([val, lib]) => <option key={val} value={val}>{lib}</option>)}
            </select>
        </label>
    )
}

/** Section repliable : pastille numérotée, titre, résumé de ce qui est rempli. */
function Bloc({ num, titre, resume, ouvert, children }: { num: string; titre: string; resume?: string; ouvert?: boolean; children: React.ReactNode }) {
    return (
        <details open={ouvert} className="group rounded-xl border border-slate-200 bg-white open:shadow-sm">
            <summary className="list-none cursor-pointer select-none flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#008751]">
                <span className="w-7 h-7 shrink-0 rounded-full bg-[#008751] text-white text-xs font-bold flex items-center justify-center">{num}</span>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-900">{titre}</span>
                    {resume && <span className="block text-xs text-slate-500 truncate">{resume}</span>}
                </span>
                <CaretDown size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
        </details>
    )
}

const nomDe = (prenoms: string, nom: string) => [prenoms, nom].map(s => s.trim()).filter(Boolean).join(' ')

export default function PreuveAfroEditeur({ source, onClose }: { source?: DossierSource | null; onClose: () => void }) {
    const depart = useMemo(() => source ? preuveDepuisDossier(source) : preuveVierge(), [source])
    const cle = CLE(source?.application_ref || '')
    const [d, setD] = useState<PreuveAfro>(() => lireBrouillon(cle) || depart)
    const [rendu, setRendu] = useState('')
    const [vue, setVue] = useState<'saisie' | 'apercu'>('saisie')
    const iframe = useRef<HTMLIFrameElement>(null)
    const cadre = useRef<HTMLDivElement>(null)
    const defilement = useRef(0)

    // La page derrière ne défile plus tant que l'éditeur est ouvert.
    useEffect(() => {
        const avant = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = avant }
    }, [])

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

    /* La feuille A4 fait 794 px : sous cette largeur elle est réduite pour
       tenir entière dans l'aperçu. Sans effet sur l'impression. */
    const ajuster = useCallback(() => {
        const doc = iframe.current?.contentDocument
        const largeur = cadre.current?.clientWidth || 0
        if (!doc?.documentElement || !largeur) return
        const echelle = Math.min(1, (largeur - 32) / LARGEUR_A4)
        doc.documentElement.style.setProperty('zoom', String(echelle))
    }, [])
    useEffect(() => {
        if (!cadre.current) return
        const obs = new ResizeObserver(ajuster)
        obs.observe(cadre.current)
        return () => obs.disconnect()
    }, [ajuster])

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

    const [genere, setGenere] = useState(false)
    const telecharger = async () => {
        const doc = iframe.current?.contentDocument
        if (!doc || genere) return
        setGenere(true)
        try {
            await telechargerPreuvePdf(doc, doc.title || 'PREUVE_AFRO_DESCENDANCE', d.ref)
        } catch (err) {
            alert(`PDF non généré : ${err instanceof Error ? err.message : 'erreur inconnue'}`)
        } finally { setGenere(false) }
    }

    const parent = (qui: 'pere' | 'mere', num: string, l: string) => (
        <Bloc num={num} titre={l} resume={nomDe(d[qui].prenoms, d[qui].nom) || 'À renseigner'}>
            <Champ l="Nom" v={d[qui].nom} maj={v => majParent(qui, 'nom', v)} />
            <Champ l="Prénoms" v={d[qui].prenoms} maj={v => majParent(qui, 'prenoms', v)} />
            <Champ l="Nom d'origine (si changement)" v={d[qui].nomOrigine} maj={v => majParent(qui, 'nomOrigine', v)} ph="COLGAR Joyce" large />
            <Champ l="Naissance (date et lieu)" v={d[qui].naissance} maj={v => majParent(qui, 'naissance', v)} ph="31 octobre 1958 à Macouria (Guyane)" large />
            <Champ l="Profession" v={d[qui].profession} maj={v => majParent(qui, 'profession', v)} large />
            <Champ l="Filiation" v={d[qui].filiation} maj={v => majParent(qui, 'filiation', v)} ph="Fils de … et de …" large />
        </Bloc>
    )

    const sousCarte = 'sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3'
    const boutonRetirer = (retirer: () => void) => (
        <button onClick={retirer} className="sm:col-span-2 justify-self-end text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md flex items-center gap-1"><Trash size={13} /> Retirer</button>
    )
    const boutonAjouter = (l: string, ajouter: () => void) => (
        <button onClick={ajouter} className="sm:col-span-2 justify-self-start text-xs font-bold text-[#008751] hover:bg-[#008751]/10 px-2.5 py-1.5 rounded-md flex items-center gap-1"><Plus size={13} /> {l}</button>
    )

    // Ouvert seulement par un clic : toujours rendu côté navigateur.
    if (typeof document === 'undefined') return null
    return createPortal(
        <div className="fixed inset-0 z-[2147483000] bg-slate-100 flex flex-col text-slate-900" role="dialog" aria-modal="true" aria-label="Preuve d'afro-descendance">
            {/* Barre d'actions : toujours visible */}
            <header className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em]">
                        <span className="text-[#008751]">Retour</span> <span className="text-[#C99400]">Gagnant</span> <span className="text-[#D21034]">Bénin</span>
                    </p>
                    <h2 className="text-base sm:text-lg font-bold truncate">
                        Preuve d&apos;afro-descendance <span className="font-normal text-slate-500">· {source ? nomDe(source.prenom || '', source.nom || '') : 'client hors plateforme'}</span>
                    </h2>
                </div>
                <button onClick={onClose} title="Fermer (Échap)" aria-label="Fermer" className="sm:order-last h-9 w-9 shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 flex items-center justify-center"><X size={18} /></button>
                <div className="w-full sm:w-auto flex items-center gap-2">
                    <button onClick={repartir} className="flex-1 sm:flex-none h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <RotateCcw size={15} /> {source ? 'Repartir du dossier' : 'Vider'}
                    </button>
                    <button onClick={telecharger} disabled={genere} aria-busy={genere} className="flex-1 sm:flex-none h-9 px-4 rounded-lg bg-[#008751] hover:bg-[#00703F] active:translate-y-px disabled:opacity-70 disabled:cursor-wait text-white text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008751]">
                        {genere ? <><CircleNotch size={16} className="animate-spin" /> Génération…</> : <><FilePdf size={16} /> Télécharger le PDF</>}
                    </button>
                </div>
                {/* Bascule Saisie / Aperçu sous 1024 px */}
                <div className="w-full lg:hidden grid grid-cols-2 p-1 bg-slate-100 rounded-lg text-sm font-semibold">
                    {(['saisie', 'apercu'] as const).map(v => (
                        <button key={v} onClick={() => setVue(v)} aria-pressed={vue === v}
                            className={`h-8 rounded-md flex items-center justify-center gap-1.5 ${vue === v ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                            {v === 'saisie' ? <><PencilSimpleLine size={15} /> Saisie</> : <><Eye size={15} /> Aperçu</>}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex-1 min-h-0 lg:grid lg:grid-cols-[minmax(400px,480px)_minmax(0,1fr)]">
                {/* Saisie */}
                <div className={`h-full overflow-y-auto overscroll-contain border-r border-slate-200 bg-slate-50 ${vue === 'saisie' ? 'block' : 'hidden'} lg:block`}>
                    <div className="p-4 sm:p-5 space-y-3 max-w-2xl mx-auto">
                        <Bloc num="0" titre="En-tête du document" resume={`${d.ref} · ${d.date}`} ouvert>
                            <Champ l="Réf. dossier" v={d.ref} maj={v => maj('ref', v)} />
                            <Champ l="Date" v={d.date} maj={v => maj('date', v)} />
                            <Choix l="Civilité" v={d.civilite} maj={v => maj('civilite', v)} options={[['M.', 'M.'], ['Mme', 'Mme']]} />
                            <Champ l="Statut" v={d.statut} maj={v => maj('statut', v)} />
                        </Bloc>

                        <Bloc num="1" titre="Demandeur" resume={nomDe(d.demandeur.prenoms, d.demandeur.nom) || 'À renseigner'} ouvert>
                            <Champ l="Nom" v={d.demandeur.nom} maj={v => majDem('nom', v)} />
                            <Champ l="Prénoms" v={d.demandeur.prenoms} maj={v => majDem('prenoms', v)} />
                            <Champ l="Naissance (date et lieu)" v={d.demandeur.naissance} maj={v => majDem('naissance', v)} ph="22 août 1987 à Cayenne (Guyane française)" large />
                            <Champ l="Nationalité actuelle" v={d.demandeur.nationalite} maj={v => majDem('nationalite', v)} />
                            <Champ l="Pièce d'identité" v={d.demandeur.piece} maj={v => majDem('piece', v)} ph="Passeport n° …" />
                            <Champ l="Profession" v={d.demandeur.profession} maj={v => majDem('profession', v)} large />
                            <Champ l="Résidence" v={d.demandeur.residence} maj={v => majDem('residence', v)} large />
                        </Bloc>

                        <Bloc num="2" titre="Foyer" resume={d.foyer.situation || 'Situation, conjoint, enfants'}>
                            <Champ l="Situation familiale" v={d.foyer.situation} maj={v => majFoyer('situation', v)} ph="Célibataire, marié(e)…" large />
                            <Champ l="Filiation reconnue" v={d.foyer.filiation} maj={v => majFoyer('filiation', v)} ph="Vide : rédigée d'après les parents" large />
                            <Champ l="Conjoint(e)" v={d.foyer.conjoint} maj={v => majFoyer('conjoint', v)} large />
                            <Champ l="Enfants (un par ligne)" v={d.foyer.enfants} maj={v => majFoyer('enfants', v)} zone large />
                        </Bloc>

                        {parent('pere', '3', 'Père')}
                        {parent('mere', '3', 'Mère')}

                        <Bloc num="4" titre="Grands-parents" resume={`${d.grandsParents.length} renseigné(s)`}>
                            {d.grandsParents.map((g, i) => (
                                <div key={i} className={sousCarte}>
                                    <Choix l="Branche" v={g.branche} maj={v => majGp(i, 'branche', v)} options={[['Maternelle', 'Maternelle'], ['Paternelle', 'Paternelle']]} />
                                    <Champ l="Surnom" v={g.surnom} maj={v => majGp(i, 'surnom', v)} />
                                    <Champ l="Nom" v={g.nom} maj={v => majGp(i, 'nom', v)} />
                                    <Champ l="Prénoms" v={g.prenoms} maj={v => majGp(i, 'prenoms', v)} />
                                    <Champ l="Naissance (date et lieu)" v={g.naissance} maj={v => majGp(i, 'naissance', v)} large />
                                    <Champ l="Décès (date et lieu)" v={g.deces} maj={v => majGp(i, 'deces', v)} large />
                                    <Champ l="Profession" v={g.profession} maj={v => majGp(i, 'profession', v)} large />
                                    <Champ l="Filiation" v={g.filiation} maj={v => majGp(i, 'filiation', v)} large />
                                    {boutonRetirer(() => maj('grandsParents', d.grandsParents.filter((_, j) => j !== i)))}
                                </div>
                            ))}
                            {boutonAjouter('Ajouter un grand-parent', () => maj('grandsParents', [...d.grandsParents, ascendantVide()]))}
                        </Bloc>

                        <Bloc num="5" titre="Lignée d'afro-descendance" resume={`Branche ${d.brancheLignee.toLowerCase()} · ${d.lignee.length} ascendant(s)`}>
                            <Choix l="Branche portant l'ascendance" v={d.brancheLignee} maj={v => maj('brancheLignee', v)} options={[['Maternelle', 'Maternelle'], ['Paternelle', 'Paternelle'], ['Les deux', 'Les deux']]} />
                            <div className="hidden sm:block" />
                            {d.lignee.map((m, i) => (
                                <div key={i} className={sousCarte}>
                                    <Champ l="Génération" v={m.generation} maj={v => majLignee(i, 'generation', v)} ph="4e génération" />
                                    <Champ l="Branche (famille)" v={m.branche} maj={v => majLignee(i, 'branche', v)} ph="Monrose" />
                                    <Champ l="Identité" v={m.identite} maj={v => majLignee(i, 'identite', v)} ph="Wilson MONROSE & Estella GOODMAN" large />
                                    <Champ l="Origines et mentions historiques" v={m.mentions} maj={v => majLignee(i, 'mentions', v)} zone large />
                                    {boutonRetirer(() => maj('lignee', d.lignee.filter((_, j) => j !== i)))}
                                </div>
                            ))}
                            {boutonAjouter('Ajouter un ascendant', () => maj('lignee', [...d.lignee, maillonVide()]))}
                            <Champ l="Note sur l'ascendance" v={d.noteAscendance} maj={v => maj('noteAscendance', v)} zone large />
                        </Bloc>

                        <Bloc num="6" titre="Clôture et signature" resume={d.cachet ? 'Avec cachet' : 'Sans cachet'}>
                            <Champ l="Note d'instruction" v={d.noteInstruction} maj={v => maj('noteInstruction', v)} ph="Vide : texte par défaut" zone large />
                            <Champ l="Cadre légal" v={d.cadreLegal} maj={v => maj('cadreLegal', v)} zone large />
                            <Champ l="Signataire" v={d.signataire} maj={v => maj('signataire', v)} large />
                            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" checked={d.cachet} onChange={e => maj('cachet', e.target.checked)} className="w-4 h-4 accent-[#008751]" /> Apposer le cachet de Retour Gagnant Bénin
                            </label>
                        </Bloc>
                        <p className="text-xs text-slate-500 px-1 pb-2">Brouillon enregistré automatiquement dans ce navigateur.</p>
                    </div>
                </div>

                {/* Aperçu */}
                <div ref={cadre} className={`h-full min-w-0 bg-[#d9d6cf] ${vue === 'apercu' ? 'block' : 'hidden'} lg:block`}>
                    <iframe
                        ref={iframe}
                        title="Aperçu du document"
                        srcDoc={rendu}
                        onLoad={() => { ajuster(); iframe.current?.contentWindow?.scrollTo(0, defilement.current) }}
                        className="w-full h-full border-0"
                    />
                </div>
            </div>
        </div>,
        document.body,
    )
}
