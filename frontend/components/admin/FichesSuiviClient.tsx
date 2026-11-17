'use client'

// ══════════════════════════════════════════════════════════════
// Fiches de suivi client RGB — même composant monté dans les deux
// panels (app/admin/fiches-suivi et app/agent/fiches-suivi), sans copie.
//
// Les fiches des inscrits sont créées par la base à l'inscription ;
// l'agent peut aussi en ouvrir une à la main. Seul un admin supprime.
// Les suggestions ne sont jamais appliquées sans un clic.
// ══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ClipboardText, MagnifyingGlass as Search, Plus, Printer, FloppyDisk as Save, Trash as Trash2,
    CaretLeft, CaretRight, ArrowClockwise as RefreshCw, Lightbulb, CircleNotch as Loader2, FileText, X,
    CheckCircle as CheckCircle2, WarningCircle as AlertCircle,
} from '@phosphor-icons/react'
import { useTranslation } from '@/lib/translation'
import { cn } from '@/lib/utils'
import {
    LIMITES, OPTIONS, aujourdhuiCotonou, avancement, casesCochees, suggestions,
    type FicheSuivi, type PieceReclamee,
} from '@/lib/fiche-suivi'

type Toast = { type: 'success' | 'error'; message: string }
type ChampChoix = Exclude<keyof typeof OPTIONS, 'canaux'>

const API = '/api/agent/fiches-suivi'
const champ = 'w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#008751]/60'

async function lire<T>(res: Response): Promise<T> {
    const corps = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(corps.error || `Erreur ${res.status}`)
    return corps as T
}

export default function FichesSuiviClient({ admin = false }: { admin?: boolean }) {
    const { t } = useTranslation()
    const [fiches, setFiches] = useState<FicheSuivi[]>([])
    const [total, setTotal] = useState(0)
    const [parPage, setParPage] = useState(50)
    const [page, setPage] = useState(0)
    const [recherche, setRecherche] = useState('')
    const [q, setQ] = useState('')
    const [chargement, setChargement] = useState(true)
    const [fiche, setFiche] = useState<FicheSuivi | null>(null)
    const [modifie, setModifie] = useState(false)
    const [occupe, setOccupe] = useState(false)
    const [toast, setToast] = useState<Toast | null>(null)

    const notifier = (type: Toast['type'], message: string) => {
        setToast({ type, message })
        setTimeout(() => setToast(null), 4000)
    }

    useEffect(() => {
        const minuterie = setTimeout(() => { setQ(recherche.trim()); setPage(0) }, 300)
        return () => clearTimeout(minuterie)
    }, [recherche])

    const charger = useCallback(async () => {
        setChargement(true)
        try {
            const r = await lire<{ fiches: FicheSuivi[]; total: number; parPage: number }>(
                await fetch(`${API}?q=${encodeURIComponent(q)}&page=${page}&t=${Date.now()}`, { cache: 'no-store' }))
            setFiches(r.fiches); setTotal(r.total); setParPage(r.parPage)
        } catch (e) {
            notifier('error', e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setChargement(false)
        }
    }, [q, page])

    useEffect(() => { charger() }, [charger])

    const ouvrir = (f: FicheSuivi) => { setFiche(f); setModifie(false) }
    const fermer = () => {
        if (modifie && !confirm(t('Des modifications ne sont pas enregistrées. Fermer quand même ?'))) return
        setFiche(null); setModifie(false); charger()
    }
    const changer = (patch: Partial<FicheSuivi>) => { setFiche(p => (p ? { ...p, ...patch } : p)); setModifie(true) }

    const creer = async () => {
        setOccupe(true)
        try {
            const r = await lire<{ fiche: FicheSuivi }>(await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }))
            ouvrir(r.fiche)
            notifier('success', `${t('Fiche créée')} : ${r.fiche.numero}`)
        } catch (e) {
            notifier('error', e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setOccupe(false)
        }
    }

    const enregistrer = async () => {
        if (!fiche) return
        setOccupe(true)
        try {
            const r = await lire<{ fiche: FicheSuivi }>(await fetch(`${API}/${fiche.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fiche),
            }))
            setFiche(r.fiche); setModifie(false)
            notifier('success', t('Fiche enregistrée'))
        } catch (e) {
            notifier('error', e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setOccupe(false)
        }
    }

    const supprimer = async () => {
        if (!fiche || !confirm(`${t('Supprimer définitivement la fiche')} ${fiche.numero} ?`)) return
        setOccupe(true)
        try {
            await lire(await fetch(`${API}/${fiche.id}`, { method: 'DELETE' }))
            setFiche(null); setModifie(false); charger()
            notifier('success', t('Fiche supprimée'))
        } catch (e) {
            notifier('error', e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setOccupe(false)
        }
    }

    const pages = Math.max(1, Math.ceil(total / parPage))

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                        className={cn('fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl border text-sm font-bold shadow-2xl',
                            toast.type === 'success' ? 'bg-[#0a1a0f] border-[#008751]/30 text-[#00c870]' : 'bg-[#1a0a0a] border-[#E8112D]/30 text-[#ff4d4d]')}>
                        {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <ClipboardText className="text-[#008751]" size={16} />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">{t('Suivi client')}</span>
                    </div>
                    <h1 className="text-3xl font-black text-white font-heading tracking-tighter">
                        {t('Fiches de suivi')} <span className="text-[#FCD116]">RGB</span>
                    </h1>
                    <p className="text-gray-500 text-xs mt-1">{t('Demande de nationalité béninoise et accompagnement administratif')}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    {fiche ? (
                        <>
                            <button onClick={fermer} className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-bold text-xs px-4 py-3 rounded-xl">
                                <CaretLeft size={14} /> {t('Retour à la liste')}
                            </button>
                            <button onClick={() => window.open(`${API}/${fiche.id}/print`, '_blank')} disabled={modifie}
                                title={modifie ? t('Enregistrez d’abord la fiche') : undefined}
                                className="flex items-center gap-2 bg-[#FCD116]/10 border border-[#FCD116]/20 text-[#FCD116] font-bold text-xs px-4 py-3 rounded-xl disabled:opacity-40">
                                <Printer size={14} /> {t('Imprimer')}
                            </button>
                            {admin && (
                                <button onClick={supprimer} disabled={occupe} className="flex items-center gap-2 bg-[#E8112D]/10 border border-[#E8112D]/20 text-[#ff4d4d] font-bold text-xs px-4 py-3 rounded-xl disabled:opacity-40">
                                    <Trash2 size={14} /> {t('Supprimer')}
                                </button>
                            )}
                            <button onClick={enregistrer} disabled={occupe || !modifie} className="flex items-center gap-2 bg-[#008751] hover:bg-[#006b40] text-white font-bold text-xs px-5 py-3 rounded-xl disabled:opacity-40">
                                {occupe ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {t('Enregistrer')}
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={charger} title={t('Actualiser')} className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl">
                                <RefreshCw size={16} className={chargement ? 'animate-spin' : undefined} />
                            </button>
                            <button onClick={() => window.open(`${API}/vierge/print`, '_blank')} className="flex items-center gap-2 bg-[#FCD116]/10 border border-[#FCD116]/20 text-[#FCD116] font-bold text-xs px-4 py-3 rounded-xl">
                                <FileText size={14} /> {t('Modèle vierge')}
                            </button>
                            <button onClick={creer} disabled={occupe} className="flex items-center gap-2 bg-[#008751] hover:bg-[#006b40] text-white font-bold text-xs px-5 py-3 rounded-xl disabled:opacity-40">
                                {occupe ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {t('Nouvelle fiche')}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {fiche ? <Editeur fiche={fiche} changer={changer} /> : (
                <div className="space-y-4">
                    <div className="relative max-w-md">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder={t('Numéro, nom, e-mail ou téléphone')}
                            className={cn(champ, 'pl-9')} />
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                        {chargement && fiches.length === 0 ? (
                            <div className="flex justify-center py-16 text-gray-500"><Loader2 size={22} className="animate-spin" /></div>
                        ) : fiches.length === 0 ? (
                            <p className="text-center text-gray-500 text-sm py-16">{q ? t('Aucune fiche ne correspond à la recherche.') : t('Aucune fiche pour le moment.')}</p>
                        ) : (
                            <ul className="divide-y divide-white/5">
                                {fiches.map(f => {
                                    const a = avancement(f)
                                    return (
                                        <li key={f.id}>
                                            <button onClick={() => ouvrir(f)} className="w-full grid grid-cols-1 md:grid-cols-[170px_1fr_160px_110px] gap-2 md:gap-4 items-center text-left px-5 py-4 hover:bg-white/[0.04]">
                                                <span className="font-mono text-xs text-[#FCD116]">{f.numero}</span>
                                                <span className="min-w-0">
                                                    <span className="block text-sm font-bold text-white truncate">{f.nom_complet || t('Sans nom')}</span>
                                                    <span className="block text-xs text-gray-500 truncate">{[f.email, f.telephone].filter(Boolean).join(' · ') || '—'}</span>
                                                </span>
                                                <span className="flex items-center gap-2">
                                                    <span className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                                                        <span className="block h-full bg-[#008751]" style={{ width: `${a.pourcentage}%` }} />
                                                    </span>
                                                    <span className="text-[11px] text-gray-400 w-20 truncate">{t(a.etape)}</span>
                                                </span>
                                                <span className={cn('justify-self-start md:justify-self-end text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg',
                                                    f.source === 'inscription' ? 'bg-[#008751]/15 text-[#00c870]' : 'bg-white/10 text-gray-300')}>
                                                    {f.source === 'inscription' ? t('Inscription') : t('Manuelle')}
                                                </span>
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </div>

                    {pages > 1 && (
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{total} {t('fiches')}</span>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPage(p => p - 1)} disabled={page === 0} className="p-2 rounded-lg bg-white/5 border border-white/10 disabled:opacity-30"><CaretLeft size={14} /></button>
                                <span>{page + 1} / {pages}</span>
                                <button onClick={() => setPage(p => p + 1)} disabled={page + 1 >= pages} className="p-2 rounded-lg bg-white/5 border border-white/10 disabled:opacity-30"><CaretRight size={14} /></button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Éditeur : mêmes sections, même ordre que la fiche imprimée ──
function Editeur({ fiche: f, changer }: { fiche: FicheSuivi; changer: (patch: Partial<FicheSuivi>) => void }) {
    const { t } = useTranslation()
    const a = avancement(f)
    const conseils = suggestions(f, aujourdhuiCotonou())

    const piece = (i: number, patch: Partial<PieceReclamee>) =>
        changer({ pieces: f.pieces.map((p, j) => (j === i ? { ...p, ...patch } : p)) })

    return (
        <div className="space-y-6">
            <Bloc>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">{t('Dossier N°')}</p>
                        <p className="font-mono text-lg text-[#FCD116]">{f.numero}</p>
                        <p className="text-xs text-gray-500">{f.source === 'inscription' ? t('Créée à l’inscription du client') : t('Créée manuellement')}</p>
                    </div>
                    <div className="min-w-[220px] flex-1 max-w-sm">
                        <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-gray-400">{t('Étape')} : <b className="text-white">{t(a.etape)}</b></span>
                            <span className="text-[#00c870] font-bold">{a.pourcentage} %</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-[#008751] transition-all" style={{ width: `${a.pourcentage}%` }} />
                        </div>
                    </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
                    <Champ label={t('Date')}><Date_ valeur={f.date_fiche} change={v => changer({ date_fiche: v ?? f.date_fiche })} /></Champ>
                    <Champ label={t('Statut')}><Choix champ="statut_dossier" valeur={f.statut_dossier} requis change={v => changer({ statut_dossier: (v ?? f.statut_dossier) as FicheSuivi['statut_dossier'] })} /></Champ>
                    <Champ label={t('Date du dépôt')}><Date_ valeur={f.date_depot} change={v => changer({ date_depot: v })} /></Champ>
                </div>
            </Bloc>

            {conseils.length > 0 && (
                <div className="rounded-2xl border border-[#FCD116]/20 bg-[#FCD116]/[0.04] p-5 space-y-3">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#FCD116]"><Lightbulb size={14} /> {t('Suggestions')}</p>
                    {conseils.map(s => (
                        <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-300">
                            <span>{t(s.texte)}</span>
                            <button onClick={() => changer(s.changement)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#FCD116]/10 border border-[#FCD116]/20 text-[#FCD116] hover:bg-[#FCD116]/20">
                                {t('Appliquer')}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <Bloc titre={`1. ${t('Identité et localisation du client')}`}>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Champ label={t('Nom et prénom(s)')}><Texte valeur={f.nom_complet} max={LIMITES.court} change={v => changer({ nom_complet: v })} /></Champ>
                    <Champ label={t('Téléphone / WhatsApp')}><Texte valeur={f.telephone} max={60} change={v => changer({ telephone: v })} /></Champ>
                    <Champ label={t('E-mail')}><Texte valeur={f.email} max={LIMITES.court} type="email" change={v => changer({ email: v })} /></Champ>
                    <div className="grid grid-cols-2 gap-4">
                        <Champ label={t('Pays')}><Texte valeur={f.pays} max={80} change={v => changer({ pays: v })} /></Champ>
                        <Champ label={t('Ville')}><Texte valeur={f.ville} max={80} change={v => changer({ ville: v })} /></Champ>
                    </div>
                    <Champ label={t('Canal de contact')} large>
                        <div className="flex flex-wrap gap-2">
                            {OPTIONS.canaux.map(([v, l]) => (
                                <Pastille key={v} actif={f.canaux.includes(v)}
                                    onClick={() => changer({ canaux: f.canaux.includes(v) ? f.canaux.filter(c => c !== v) : [...f.canaux, v] })}>{l}</Pastille>
                            ))}
                        </div>
                    </Champ>
                </div>
            </Bloc>

            <Bloc titre={`2. ${t('Réclamation — dossier déjà introduit sur MyAfroOrigins')}`}>
                <div className="grid gap-4">
                    <Champ label={t('Statut de la réclamation')}><Choix champ="reclamation_statut" valeur={f.reclamation_statut} change={v => changer({ reclamation_statut: v })} /></Champ>
                    <div className="grid sm:grid-cols-[220px_1fr] gap-4">
                        <Champ label={t('Date état des lieux du dossier')}><Date_ valeur={f.date_etat_lieux} change={v => changer({ date_etat_lieux: v })} /></Champ>
                        <Champ label={t('Observation')}><Zone valeur={f.observation} max={LIMITES.observation} lignes={3} change={v => changer({ observation: v })} /></Champ>
                    </div>
                </div>
            </Bloc>

            <Bloc titre={`3. ${t('Demande de nationalité béninoise & paiements')}`}>
                <div className="grid gap-5">
                    <div className="grid lg:grid-cols-[1fr_180px_180px] gap-4">
                        <Champ label={t('Accueil & accompagnement à la demande de nationalité')}><Choix champ="accueil_statut" valeur={f.accueil_statut} change={v => changer({ accueil_statut: v })} /></Champ>
                        <Champ label={t('Date réclamation')}><Date_ valeur={f.accueil_date_reclamation} change={v => changer({ accueil_date_reclamation: v })} /></Champ>
                        <Champ label={t('Date de réception')}><Date_ valeur={f.accueil_date_reception} change={v => changer({ accueil_date_reception: v })} /></Champ>
                    </div>
                    <div className="grid lg:grid-cols-[1fr_180px_180px] gap-4">
                        <Champ label={t('Frais MyAfroOrigins (paiement)')}><Choix champ="frais_statut" valeur={f.frais_statut} change={v => changer({ frais_statut: v })} /></Champ>
                        <Champ label={t('Date')}><Date_ valeur={f.frais_date} change={v => changer({ frais_date: v })} /></Champ>
                        <Champ label={t('Justificatif')}>
                            <Pastille actif={f.frais_justificatif} onClick={() => changer({ frais_justificatif: !f.frais_justificatif })}>{t('Justificatif reçu')}</Pastille>
                        </Champ>
                    </div>
                </div>
            </Bloc>

            <Bloc titre={`4. ${t('Liste des pièces réclamées au client')}`}>
                <div className="space-y-3">
                    {f.pieces.length === 0 && <p className="text-sm text-gray-500">{t('Aucune pièce réclamée pour le moment.')}</p>}
                    {f.pieces.map((p, i) => (
                        <div key={i} className="grid md:grid-cols-[36px_160px_1fr_auto_36px] gap-3 items-start rounded-xl border border-white/5 bg-black/20 p-3">
                            <span className="text-sm font-bold text-gray-500 pt-2.5 text-center">{i + 1}</span>
                            <Date_ valeur={p.date} change={v => piece(i, { date: v })} />
                            <Zone valeur={p.piece} max={LIMITES.piece} lignes={1} placeholder={t('Pièce réclamée')} change={v => piece(i, { piece: v ?? '' })} />
                            <Choix champ="piece_statut" valeur={p.statut} requis change={v => piece(i, { statut: (v ?? p.statut) as PieceReclamee['statut'] })} />
                            <button onClick={() => changer({ pieces: f.pieces.filter((_, j) => j !== i) })} title={t('Retirer la pièce')}
                                className="p-2 mt-0.5 rounded-lg text-gray-500 hover:text-[#ff4d4d] hover:bg-[#E8112D]/10"><X size={16} /></button>
                        </div>
                    ))}
                    <button onClick={() => changer({ pieces: [...f.pieces, { date: aujourdhuiCotonou(), piece: '', statut: 'attente' }] })}
                        disabled={f.pieces.length >= LIMITES.pieces}
                        className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border border-dashed border-white/15 text-gray-300 hover:border-[#008751]/50 hover:text-white disabled:opacity-40">
                        <Plus size={14} /> {t('Ajouter une pièce')}
                    </button>
                </div>
            </Bloc>

            <Bloc titre={`5. ${t('Analyse et observations du suivi du dossier RGB')}`}>
                <Zone valeur={f.analyse_suivi} max={LIMITES.analyse} lignes={10} change={v => changer({ analyse_suivi: v })} />
                <p className="text-right text-[11px] text-gray-600 mt-1">{(f.analyse_suivi || '').length} / {LIMITES.analyse}</p>
            </Bloc>

            <Bloc titre={`6. ${t('Accompagnement final & cérémonie officielle')}`}>
                <div className="grid gap-5">
                    <div className="grid lg:grid-cols-[1fr_180px] gap-4">
                        <Champ label={t('Accompagnement au Guichet Unique (enrôlement)')}><Choix champ="guichet_statut" valeur={f.guichet_statut} change={v => changer({ guichet_statut: v })} /></Champ>
                        <Champ label={t('Date')}><Date_ valeur={f.guichet_date} change={v => changer({ guichet_date: v })} /></Champ>
                    </div>
                    <div className="grid lg:grid-cols-[1fr_180px] gap-4">
                        <Champ label={t('Accompagnement & inscription à la remise officielle de la cérémonie')}><Choix champ="ceremonie_statut" valeur={f.ceremonie_statut} change={v => changer({ ceremonie_statut: v })} /></Champ>
                        <Champ label={t('Date')}><Date_ valeur={f.ceremonie_date} change={v => changer({ ceremonie_date: v })} /></Champ>
                    </div>
                </div>
            </Bloc>
        </div>
    )
}

function Bloc({ titre, children }: { titre?: string; children: React.ReactNode }) {
    return (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
            {titre && <h2 className="text-xs font-black uppercase tracking-widest text-[#00c870] border-b border-[#008751]/30 pb-3 mb-5">{titre}</h2>}
            {children}
        </section>
    )
}

// <div> et non <label> : un clic sur l'intitulé d'un groupe de cases activerait la première.
function Champ({ label, large, children }: { label: string; large?: boolean; children: React.ReactNode }) {
    return (
        <div className={cn('space-y-1.5', large && 'sm:col-span-2')}>
            <span className="block text-[11px] font-bold text-gray-400">{label}</span>
            {children}
        </div>
    )
}

function Texte({ valeur, max, type = 'text', change }: { valeur: string | null; max: number; type?: string; change: (v: string | null) => void }) {
    return <input type={type} value={valeur ?? ''} maxLength={max} onChange={e => change(e.target.value || null)} className={champ} />
}

function Zone({ valeur, max, lignes, placeholder, change }: { valeur: string | null; max: number; lignes: number; placeholder?: string; change: (v: string | null) => void }) {
    return <textarea value={valeur ?? ''} maxLength={max} rows={lignes} placeholder={placeholder} onChange={e => change(e.target.value || null)} className={cn(champ, 'resize-y')} />
}

// Le suffixe évite l'homonymie avec l'objet global Date.
function Date_({ valeur, change }: { valeur: string | null; change: (v: string | null) => void }) {
    return <input type="date" value={valeur ?? ''} onChange={e => change(e.target.value || null)} className={cn(champ, '[color-scheme:dark]')} />
}

// Cases à choix unique ; un second clic décoche, sauf pour un champ obligatoire.
function Choix({ champ: nom, valeur, requis, change }: { champ: ChampChoix; valeur: string | null; requis?: boolean; change: (v: string | null) => void }) {
    const cochees = casesCochees(nom, valeur)
    return (
        <div className="flex flex-wrap gap-2">
            {OPTIONS[nom].map(([v, l]) => (
                <Pastille key={v} actif={cochees.includes(v)} onClick={() => change(valeur === v && !requis ? null : v)}>{l}</Pastille>
            ))}
        </div>
    )
}

function Pastille({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button type="button" onClick={onClick}
            className={cn('text-xs font-bold px-3 py-2 rounded-lg border transition-colors',
                actif ? 'bg-[#008751]/20 border-[#008751]/60 text-[#00c870]' : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white hover:border-white/20')}>
            {children}
        </button>
    )
}
