'use client'
// ══════════════════════════════════════════════════════════════
//  Enregistrement MyAfroOrigins + fiche de synthèse (panels admin ET agent).
//
//  L'équipe saisit À LA MAIN ce que le client a fourni et utilisé sur la
//  plateforme MyAfroOrigins : nom, prénom, numéro de dossier, e-mail et mot
//  de passe du portail. Le dossier source ne sert qu'à pré-remplir.
//  Une fois enregistré : marqueur « Transmis sur MyAfroOrigins » dans les
//  listes, suivi du statut chez MyAfroOrigins (historique), fiche PDF à
//  télécharger ou à envoyer au client dans sa langue.
// ══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react'
import { CircleNotch, Download, PaperPlaneTilt, PencilSimple, Eye, EyeSlash, Check, Sparkle, X, UploadSimple, FilePlus, Trash, ClockCounterClockwise } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { STATUTS_MYAFRO, statutMyafro, proposerMotDePasse, type Civilite, type NatureDossier, type ResumeEnregistrement, type SaisieEnregistrement, type StatutMyafro } from '@/lib/myafro-enregistrement'
import { LANGUES_DOC, langueDoc, type LangueDoc } from '@/lib/document-langues'

const API = '/api/agent/myafro-enregistrements'

async function entetes(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }
}

const dateFr = (iso?: string) => {
    if (!iso) return '—'
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Enregistrements d'une nature, indexés par dossier (marqueurs et filtres des listes). */
export function useEnregistrementsMyafro(nature: NatureDossier) {
    const [parDossier, setParDossier] = useState<Record<string, ResumeEnregistrement>>({})
    const [charge, setCharge] = useState(false)
    const rafraichir = useCallback(async () => {
        try {
            const r = await fetch(`${API}?nature=${nature}`, { headers: await entetes(), cache: 'no-store' })
            const j = await r.json()
            if (r.ok) setParDossier(Object.fromEntries((j.enregistrements as ResumeEnregistrement[]).map(e => [e.dossierId, e])))
        } finally { setCharge(true) }
    }, [nature])
    useEffect(() => { void rafraichir() }, [rafraichir])
    return { parDossier, charge, rafraichir }
}

/** Marqueur compact pour l'en-tête d'une carte de liste. */
export function BadgeMyafro({ e }: { e?: ResumeEnregistrement }) {
    if (!e) return null
    const s = statutMyafro(e.statut)
    return <span title={`MyAfroOrigins N° ${e.numeroDossier} · déposé le ${dateFr(e.dateDepot)}`} className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${s.badge}`}>{e.statut === 'transmis' ? 'Transmis MyAfroOrigins' : s.label} · N° {e.numeroDossier}</span>
}

const VIDE: SaisieEnregistrement = { nom: '', prenom: '', numeroDossier: '', dateDepot: new Date().toISOString().slice(0, 10), emailSuivi: '', motDePasse: '', statut: 'transmis', civilite: '' }

/** Formulaire de saisie (création ou modification). */
function Formulaire({ titre, initial, nature, dossierId, statutDossier, onClose, onSaved }: {
    titre: string; initial: SaisieEnregistrement; nature: NatureDossier; dossierId?: string; statutDossier?: string
    onClose: () => void; onSaved: (e: ResumeEnregistrement) => void
}) {
    const [s, setS] = useState<SaisieEnregistrement>(initial)
    const [voir, setVoir] = useState(false)
    const [passer, setPasser] = useState(nature === 'nationalite' && statutDossier === 'soumis')
    const [erreurs, setErreurs] = useState<Record<string, string>>({})
    const [msg, setMsg] = useState('')
    const [occupe, setOccupe] = useState(false)
    const maj = <K extends keyof SaisieEnregistrement>(k: K, v: SaisieEnregistrement[K]) => setS(x => ({ ...x, [k]: v }))
    const classe = (k: string) => `mt-1 w-full bg-slate-50 border rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#008751] ${erreurs[k] ? 'border-red-400' : 'border-slate-200'}`
    const champ = (k: keyof SaisieEnregistrement, l: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
        <label className="block">
            <span className="text-[11px] font-bold text-slate-500">{l} <span className="text-red-500">*</span></span>
            <input value={String(s[k] ?? '')} onChange={e => maj(k, e.target.value as never)} className={classe(k)} {...extra} />
            {erreurs[k] && <span className="text-[11px] text-red-600">{erreurs[k]}</span>}
        </label>
    )

    const valider = async () => {
        setOccupe(true); setErreurs({}); setMsg('')
        try {
            const nouvelle = nature === 'libre' && !dossierId
            const r = await fetch(nouvelle ? API : `${API}/${nature}/${dossierId}`, { method: nouvelle ? 'POST' : 'PUT', headers: await entetes(), body: JSON.stringify({ saisie: s, passerEnTraitement: passer }) })
            const j = await r.json()
            if (!r.ok) { setErreurs(j.erreurs || {}); setMsg(j.error || 'Enregistrement impossible'); return }
            onSaved(j.enregistrement)
        } catch (e) { setMsg(e instanceof Error ? e.message : 'Réseau indisponible') } finally { setOccupe(false) }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={() => !occupe && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="h-1 flex"><div className="flex-1 bg-[#008751]" /><div className="flex-1 bg-[#FCD116]" /><div className="flex-1 bg-[#E8112D]" /></div>
                <div className="p-5 flex items-start justify-between gap-3 border-b border-slate-100">
                    <div>
                        <p className="text-base font-black text-slate-900">{titre}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Saisissez exactement ce que le client a fourni et utilisé sur la plateforme MyAfroOrigins.</p>
                    </div>
                    <button onClick={() => !occupe && onClose()} title="Fermer" className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={18} /></button>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block sm:col-span-2">
                        <span className="text-[11px] font-bold text-slate-500">Civilité (pied de la fiche)</span>
                        <select value={s.civilite} onChange={e => maj('civilite', e.target.value as Civilite)} className={classe('civilite')}>
                            <option value="">—</option><option value="M.">M.</option><option value="Mme">Mme</option>
                        </select>
                    </label>
                    {champ('nom', 'Nom', { autoComplete: 'off' })}
                    {champ('prenom', 'Prénom', { autoComplete: 'off' })}
                    {champ('numeroDossier', 'Numéro de dossier MyAfroOrigins', { inputMode: 'numeric', placeholder: 'ex. 622378302', autoComplete: 'off' })}
                    {champ('dateDepot', 'Date de dépôt', { type: 'date', max: new Date().toISOString().slice(0, 10) })}
                    <div className="sm:col-span-2">{champ('emailSuivi', 'E-mail utilisé sur MyAfroOrigins', { type: 'email', autoComplete: 'off' })}</div>
                    <label className="block sm:col-span-2">
                        <span className="text-[11px] font-bold text-slate-500">Mot de passe utilisé sur MyAfroOrigins <span className="text-red-500">*</span></span>
                        <div className="mt-1 flex gap-2">
                            <input type={voir ? 'text' : 'password'} value={s.motDePasse} onChange={e => maj('motDePasse', e.target.value)} autoComplete="new-password" className={`${classe('motDePasse')} mt-0 font-mono`} />
                            <button type="button" onClick={() => setVoir(v => !v)} title={voir ? 'Masquer' : 'Afficher'} className="px-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{voir ? <EyeSlash size={16} /> : <Eye size={16} />}</button>
                            <button type="button" onClick={() => { maj('motDePasse', proposerMotDePasse()); setVoir(true) }} title="Proposer un mot de passe solide (si le client n'en a pas encore)" className="px-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><Sparkle size={16} /></button>
                        </div>
                        {erreurs.motDePasse && <span className="text-[11px] text-red-600">{erreurs.motDePasse}</span>}
                    </label>
                    <label className="block">
                        <span className="text-[11px] font-bold text-slate-500">Avancement chez MyAfroOrigins</span>
                        <select value={s.statut} onChange={e => maj('statut', e.target.value as StatutMyafro)} className={classe('statut')}>
                            {STATUTS_MYAFRO.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-[11px] font-bold text-slate-500">Note (historique)</span>
                        <input value={s.note || ''} onChange={e => maj('note', e.target.value)} placeholder="ex. complément envoyé le…" className={classe('note')} />
                    </label>
                    {nature === 'nationalite' && statutDossier === 'soumis' && (
                        <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-600">
                            <input type="checkbox" checked={passer} onChange={e => setPasser(e.target.checked)} />
                            Passer aussi la demande en « En traitement »
                        </label>
                    )}
                </div>
                {msg && <p className="px-5 text-xs text-red-600">{msg}</p>}
                <div className="p-5 pt-3 flex justify-end gap-2">
                    <button onClick={onClose} disabled={occupe} className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">Annuler</button>
                    <button onClick={valider} disabled={occupe} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#008751] hover:bg-[#00643C] text-white inline-flex items-center gap-2 disabled:opacity-50">
                        {occupe ? <CircleNotch size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer
                    </button>
                </div>
            </div>
        </div>
    )
}

/** Panneau d'un dossier : transmettre, suivre, produire la fiche. */
export function PanneauMyafro({ nature, dossierId, resume, statutDossier, titre, onChange }: {
    nature: NatureDossier; dossierId: string; resume?: ResumeEnregistrement; statutDossier?: string; titre?: string
    onChange?: () => void
}) {
    const [form, setForm] = useState<SaisieEnregistrement | null>(null)
    const [ouvrant, setOuvrant] = useState(false)
    const [langue, setLangue] = useState<LangueDoc>('fr')
    const [etat, setEtat] = useState<'' | 'pdf' | 'envoi' | 'retrait'>('')
    const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
    const [histo, setHisto] = useState(false)

    const ouvrir = async () => {
        setOuvrant(true); setMsg(null)
        try {
            const r = await fetch(`${API}/${nature}/${dossierId}`, { headers: await entetes(), cache: 'no-store' })
            const j = await r.json()
            if (!r.ok) { setMsg({ ok: false, t: j.error || 'Lecture impossible' }); return }
            const e = j.enregistrement, g = j.suggestion
            setForm(e
                ? { nom: e.demandeur.nom, prenom: e.demandeur.prenom, numeroDossier: e.numeroDossier, dateDepot: e.dateDepot, emailSuivi: e.emailSuivi, motDePasse: e.motDePasse, statut: e.statut, civilite: e.demandeur.civilite }
                : { ...VIDE, nom: g?.nom || '', prenom: g?.prenom || '', emailSuivi: g?.emailSuivi || '', numeroDossier: g?.numeroDossier || '', civilite: g?.civilite || '' })
        } finally { setOuvrant(false) }
    }

    const telecharger = async () => {
        setEtat('pdf'); setMsg(null)
        try {
            const r = await fetch(`${API}/${nature}/${dossierId}/fiche?lang=${langue}`, { headers: await entetes() })
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`)
            const nom = decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(r.headers.get('content-disposition') || '')?.[1] || 'Fiche_suivi_MyAfroOrigins.pdf')
            const url = URL.createObjectURL(await r.blob())
            const a = document.createElement('a'); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
        } catch (e) { setMsg({ ok: false, t: `Fiche impossible : ${e instanceof Error ? e.message : 'erreur'}` }) }
        setEtat('')
    }

    const envoyer = async () => {
        if (!resume || !confirm(`Envoyer la fiche (identifiants compris) à ${resume.emailSuivi} ?`)) return
        setEtat('envoi'); setMsg(null)
        try {
            const r = await fetch(`${API}/${nature}/${dossierId}/fiche`, { method: 'POST', headers: await entetes(), body: JSON.stringify({ lang: langue }) })
            const j = await r.json()
            if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
            setMsg({ ok: true, t: `Fiche envoyée à ${j.envoyeeA}.` }); onChange?.()
        } catch (e) { setMsg({ ok: false, t: `Envoi impossible : ${e instanceof Error ? e.message : 'erreur'}` }) }
        setEtat('')
    }

    const retirer = async () => {
        if (!confirm('Retirer cette fiche ? Elle est conservée en corbeille (récupérable par l\'admin).')) return
        setEtat('retrait')
        try {
            const r = await fetch(`${API}/${nature}/${dossierId}`, { method: 'DELETE', headers: await entetes() })
            const j = await r.json()
            if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
            onChange?.()
        } catch (e) { setMsg({ ok: false, t: `Retrait impossible : ${e instanceof Error ? e.message : 'erreur'}` }) }
        setEtat('')
    }

    const s = resume ? statutMyafro(resume.statut) : null
    return (
        <div className="bg-cyan-500/[0.06] border border-cyan-500/25 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.18em] mr-auto">{titre || 'Plateforme MyAfroOrigins'}</p>
                {s && <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${s.badge}`}>{s.label}</span>}
            </div>
            {resume ? (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {[['N° de dossier', resume.numeroDossier], ['Déposé le', dateFr(resume.dateDepot)], ['E-mail de suivi', resume.emailSuivi], ['Fiche envoyée', resume.ficheEnvoyeeLe ? `${dateFr(resume.ficheEnvoyeeLe)}` : 'Pas encore']].map(([k, v]) => (
                            <div key={k} className="min-w-0"><span className="text-gray-500 block text-[10px]">{k}</span><span className="text-white font-bold break-all">{v}</span></div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <select value={langue} onChange={e => setLangue(langueDoc(e.target.value))} title="Langue de la fiche" className="bg-[#0c1420] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white">
                            {LANGUES_DOC.map(l => <option key={l.code} value={l.code}>{l.drapeau} {l.libelle}</option>)}
                        </select>
                        <button onClick={telecharger} disabled={!!etat} className="bg-[#008751] hover:bg-[#00643C] text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                            {etat === 'pdf' ? <CircleNotch size={13} className="animate-spin" /> : <Download size={13} />} Fiche de suivi (PDF)
                        </button>
                        <button onClick={envoyer} disabled={!!etat} className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                            {etat === 'envoi' ? <CircleNotch size={13} className="animate-spin" /> : <PaperPlaneTilt size={13} />} Envoyer au client
                        </button>
                        <button onClick={ouvrir} disabled={ouvrant || !!etat} className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                            {ouvrant ? <CircleNotch size={13} className="animate-spin" /> : <PencilSimple size={13} />} Modifier / suivre
                        </button>
                        <button onClick={() => setHisto(h => !h)} className="text-gray-400 hover:text-white font-bold text-[11px] px-2 py-1.5 rounded-lg flex items-center gap-1"><ClockCounterClockwise size={13} /> Historique ({resume.historique.length})</button>
                        <button onClick={retirer} disabled={!!etat} title="Admin seulement" className="text-gray-500 hover:text-red-400 text-[11px] px-2 py-1.5 rounded-lg flex items-center gap-1 ml-auto"><Trash size={13} /> Retirer</button>
                    </div>
                    {histo && (
                        <ol className="text-[11px] text-gray-400 space-y-1 border-t border-white/10 pt-2">
                            {[...resume.historique].reverse().map((h, i) => (
                                <li key={i}><span className="text-gray-500">{dateFr(h.le)}</span> · <strong className="text-white">{statutMyafro(h.statut).label}</strong> · {h.par}{h.note ? ` — ${h.note}` : ''}</li>
                            ))}
                        </ol>
                    )}
                </>
            ) : (
                <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-[11px] text-gray-400 mr-auto">Dossier pas encore déposé sur MyAfroOrigins (ou non renseigné).</p>
                    <button onClick={ouvrir} disabled={ouvrant} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                        {ouvrant ? <CircleNotch size={13} className="animate-spin" /> : <UploadSimple size={13} />} Transmis sur MyAfroOrigins
                    </button>
                </div>
            )}
            {msg && <p className={`text-[11px] ${msg.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{msg.t}</p>}
            {form && (
                <Formulaire titre={resume ? 'Enregistrement MyAfroOrigins' : 'Marquer comme transmis sur MyAfroOrigins'} initial={form} nature={nature} dossierId={dossierId} statutDossier={statutDossier}
                    onClose={() => setForm(null)} onSaved={() => { setForm(null); setMsg({ ok: true, t: 'Enregistrement MyAfroOrigins à jour.' }); onChange?.() }} />
            )}
        </div>
    )
}

/** Fiches libres : clients suivis sur MyAfroOrigins sans dossier dans nos fichiers. */
export function FichesLibresMyafro() {
    const { parDossier, charge, rafraichir } = useEnregistrementsMyafro('libre')
    const [nouvelle, setNouvelle] = useState(false)
    const [ouverte, setOuverte] = useState<string | null>(null)
    const fiches = Object.values(parDossier).sort((a, b) => b.majLe.localeCompare(a.majLe))
    return (
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="mr-auto">
                    <p className="text-sm font-black text-white">Fiches de suivi MyAfroOrigins</p>
                    <p className="text-[11px] text-gray-500">Clients déposés sur la plateforme sans demande enregistrée chez nous : saisissez nom, prénom, numéro, e-mail et mot de passe utilisés.</p>
                </div>
                <button onClick={() => setNouvelle(true)} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[11px] px-3 py-2 rounded-lg flex items-center gap-1.5"><FilePlus size={14} /> Nouvelle fiche de suivi</button>
            </div>
            {!charge ? <p className="text-[11px] text-gray-500">Chargement…</p> : fiches.length === 0 ? <p className="text-[11px] text-gray-500">Aucune fiche libre pour l’instant.</p> : (
                <div className="space-y-2">
                    {fiches.map(f => (
                        <div key={f.dossierId} className="border border-white/10 rounded-xl">
                            <button onClick={() => setOuverte(o => o === f.dossierId ? null : f.dossierId)} className="w-full text-left px-3 py-2.5 flex items-center gap-3 flex-wrap">
                                <span className="text-sm font-bold text-white">{f.demandeur.nom.toUpperCase()} {f.demandeur.prenom}</span>
                                <BadgeMyafro e={f} />
                                <span className="text-[10px] text-gray-500 ml-auto">{f.referenceRgb}</span>
                            </button>
                            {ouverte === f.dossierId && <div className="px-3 pb-3"><PanneauMyafro nature="libre" dossierId={f.dossierId} resume={f} onChange={rafraichir} /></div>}
                        </div>
                    ))}
                </div>
            )}
            {nouvelle && <Formulaire titre="Nouvelle fiche de suivi MyAfroOrigins" initial={VIDE} nature="libre" onClose={() => setNouvelle(false)} onSaved={e => { setNouvelle(false); void rafraichir(); setOuverte(e.dossierId) }} />}
        </div>
    )
}

/** Filtre de liste « à transmettre / transmis ». */
export type FiltreMyafro = 'tous' | 'a_transmettre' | 'transmis'
export function FiltreMyafroChips({ valeur, onChange, aTransmettre, transmis }: { valeur: FiltreMyafro; onChange: (f: FiltreMyafro) => void; aTransmettre: number; transmis: number }) {
    const chip = (v: FiltreMyafro, l: string, n?: number) => (
        <button key={v} onClick={() => onChange(v)} className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${valeur === v ? 'bg-cyan-600 border-cyan-600 text-white' : 'border-white/10 text-gray-400 hover:text-white'}`}>
            {l}{n !== undefined ? ` (${n})` : ''}
        </button>
    )
    return <div className="flex items-center gap-2 flex-wrap">{chip('tous', 'Tous')}{chip('a_transmettre', 'À transmettre sur MyAfroOrigins', aTransmettre)}{chip('transmis', 'Transmis sur MyAfroOrigins', transmis)}</div>
}
