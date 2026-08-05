'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft, MapPin, Ruler, BedDouble, Building2, Check, X, ChevronRight,
    ShieldCheck, FileCheck2, Home, Sparkles, ExternalLink, Loader2, Send, Wand2,
} from 'lucide-react'

interface Logement {
    id: string; programme: string; nom: string; type: string; ville: string; site: string
    surface_m2: number; chambres: number; prix_comptant: number; devise: string; mensualite: number
    duree_annees: number; formules: string[]; description: string; atouts: string[]; images: string[]
    plan_url: string | null; visite_url: string | null; disponibilite: string
}

const money = (n: number, d = 'XOF') => `${Math.round(n).toLocaleString('fr-FR')} ${d === 'XOF' ? 'FCFA' : d}`

const CONDITIONS = [
    'Être de nationalité béninoise (diaspora incluse).',
    "N'être propriétaire d'aucun immeuble bâti sur le territoire national (logement social).",
    'Justifier de ressources suffisantes (le revenu du ménage est pris en compte).',
    'Un logement maximum par ville du programme.',
    'Adhésion obligatoire au règlement général de copropriété.',
]
const CIBLES = ['Fonctionnaires de l\'État', 'Salariés du privé', 'Artisans · commerçants · agriculteurs', 'Professions libérales', 'Retraités', 'Diaspora béninoise']
const PIECES = ['Pièce d\'identité / passeport en cours de validité', 'Justificatif de nationalité béninoise', 'Justificatifs de revenus (ménage)', 'Attestation de non-propriété', 'Fiche de (pré)réservation renseignée']

export default function ProgrammeLogementsPage() {
    const [all, setAll] = useState<Logement[]>([])
    const [loading, setLoading] = useState(true)
    const [prog, setProg] = useState<'20000' | 'residences'>('20000')
    const [ville, setVille] = useState('')
    const [type, setType] = useState('')
    const [formule, setFormule] = useState('')
    const [detail, setDetail] = useState<Logement | null>(null)
    const [leadFor, setLeadFor] = useState<Logement | null | 'general'>(null)

    useEffect(() => {
        fetch('/api/logements').then(r => r.json()).then(j => setAll(j.logements || [])).catch(() => setAll([])).finally(() => setLoading(false))
    }, [])

    const villes = useMemo(() => [...new Set(all.filter(l => l.programme === prog).map(l => l.ville).filter(Boolean))].sort(), [all, prog])
    const types = useMemo(() => [...new Set(all.filter(l => l.programme === prog).map(l => l.type).filter(Boolean))].sort(), [all, prog])
    const list = useMemo(() => all.filter(l => l.programme === prog
        && (!ville || l.ville === ville) && (!type || l.type === type) && (!formule || l.formules?.includes(formule))
    ), [all, prog, ville, type, formule])

    const sites = useMemo(() => {
        const m = new Map<string, number>()
        all.filter(l => l.programme === prog).forEach(l => l.ville && m.set(l.ville, (m.get(l.ville) || 0) + 1))
        return [...m.entries()].sort((a, b) => b[1] - a[1])
    }, [all, prog])

    return (
        <div className="bg-white text-slate-900">
            {/* ═══ HERO ═══ */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_0%,rgba(0,135,81,0.12),transparent),radial-gradient(ellipse_50%_50%_at_90%_10%,rgba(252,209,22,0.10),transparent)]" />
                <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-28 md:pt-32 pb-14">
                    <Link href="/services/logement" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#008751] transition-colors mb-6"><ArrowLeft size={15} /> Service logement</Link>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E6F3ED] text-[#008751] text-[11px] font-black uppercase tracking-widest mb-5"><Building2 size={13} /> Programme national · en partenariat</div>
                    <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight max-w-3xl">
                        <span className="bg-gradient-to-r from-[#008751] via-[#00643C] to-[#E8112D] bg-clip-text text-transparent">Devenez propriétaire</span> au Bénin.
                    </h1>
                    <p className="mt-5 text-base md:text-lg text-slate-600 max-w-2xl leading-relaxed">
                        Logements économiques et sociaux du Programme national (20 000 logements) et résidences. <strong className="text-slate-900">Retour Gagnant ne vend pas</strong> : nous montons votre <strong className="text-[#008751]">dossier viable et vite accepté</strong>, puis transmettons votre demande.
                    </p>
                    <div className="mt-7 flex flex-wrap gap-3">
                        <button onClick={() => document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#008751] hover:bg-[#00643C] text-white font-bold transition-colors shadow-[0_14px_34px_-12px_rgba(0,135,81,0.7)]"><Home size={18} /> Voir les logements</button>
                        <button onClick={() => document.getElementById('eligibilite')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white border border-slate-200 hover:border-[#008751] text-slate-800 font-bold transition-colors"><ShieldCheck size={18} className="text-[#008751]" /> Vérifier mon éligibilité</button>
                    </div>
                </div>
            </section>

            {/* ═══ ONGLETS PROGRAMME ═══ */}
            <div className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-y border-slate-100">
                <div className="max-w-6xl mx-auto px-5 md:px-8 flex gap-2 py-3">
                    {([['20000', 'Programme 20 000 logements'], ['residences', 'Résidences']] as const).map(([v, l]) => (
                        <button key={v} onClick={() => { setProg(v); setVille(''); setType('') }} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${prog === v ? 'bg-[#008751] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{l}</button>
                    ))}
                </div>
            </div>

            {/* ═══ CATALOGUE ═══ */}
            <section id="catalogue" className="max-w-6xl mx-auto px-5 md:px-8 py-14 scroll-mt-16">
                {/* Filtres */}
                <div className="flex flex-wrap gap-2 mb-8">
                    <select value={ville} onChange={e => setVille(e.target.value)} className={flt}><option value="">Toutes les villes</option>{villes.map(v => <option key={v}>{v}</option>)}</select>
                    <select value={type} onChange={e => setType(e.target.value)} className={flt}><option value="">Tous les types</option>{types.map(t => <option key={t}>{t}</option>)}</select>
                    <select value={formule} onChange={e => setFormule(e.target.value)} className={flt}><option value="">Toutes formules</option><option value="location-accession">Location-accession</option><option value="comptant">Comptant / crédit</option></select>
                    {(ville || type || formule) && <button onClick={() => { setVille(''); setType(''); setFormule('') }} className="px-3 py-2 text-sm font-bold text-[#E8112D] hover:underline">Réinitialiser</button>}
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#008751]" /></div>
                ) : list.length === 0 ? (
                    <div className="text-center py-20 text-slate-400"><Building2 size={40} className="mx-auto mb-3 opacity-40" /><p className="font-semibold text-slate-500">Aucun logement pour ces critères. Le catalogue est mis à jour régulièrement.</p></div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {list.map((l, i) => (
                            <motion.button key={l.id} onClick={() => setDetail(l)}
                                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.06 }}
                                className="group text-left bg-white rounded-3xl border border-slate-200 overflow-hidden hover:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.4)] hover:-translate-y-1 transition-all">
                                <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                                    {l.images?.[0]
                                        // eslint-disable-next-line @next/next/no-img-element
                                        ? <img src={l.images[0]} alt={l.nom} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={e => { e.currentTarget.style.display = 'none' }} />
                                        : <div className="w-full h-full flex items-center justify-center text-slate-300"><Home size={40} /></div>}
                                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-[11px] font-black text-slate-800">{l.type}</span>
                                    {l.disponibilite !== 'disponible' && <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#FCD116] text-[#5A4A00] text-[10px] font-black uppercase">{l.disponibilite === 'bientot' ? 'Bientôt' : 'Épuisé'}</span>}
                                </div>
                                <div className="p-4">
                                    <h3 className="font-extrabold text-slate-900 truncate">{l.nom}</h3>
                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><MapPin size={12} className="text-[#E8112D]" /> {[l.ville, l.site].filter(Boolean).join(' · ')}</p>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                                        <span className="inline-flex items-center gap-1"><Ruler size={13} /> {l.surface_m2} m²</span>
                                        {l.chambres > 0 && <span className="inline-flex items-center gap-1"><BedDouble size={13} /> {l.chambres}</span>}
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                        <p className="text-lg font-black text-[#008751]">{money(l.prix_comptant, l.devise)}</p>
                                        {l.mensualite > 0 && <p className="text-xs text-slate-500">ou {money(l.mensualite, l.devise)}/mois · {l.duree_annees} ans</p>}
                                    </div>
                                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#008751] group-hover:gap-2 transition-all">Détails & dossier <ChevronRight size={15} /></span>
                                </div>
                            </motion.button>
                        ))}
                    </div>
                )}

                {/* Sites */}
                {sites.length > 0 && (
                    <div className="mt-14">
                        <h2 className="font-display text-2xl font-bold mb-5">Sites du programme</h2>
                        <div className="flex flex-wrap gap-3">
                            {sites.map(([v, n]) => (
                                <button key={v} onClick={() => { setVille(v); document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' }) }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-[#008751] transition-colors">
                                    <MapPin size={15} className="text-[#008751]" /><span className="font-bold text-slate-800">{v}</span><span className="text-xs font-black text-white bg-[#008751] rounded-full px-2 py-0.5">{n}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* ═══ CONDITIONS & ÉLIGIBILITÉ ═══ */}
            <section id="eligibilite" className="bg-[#F7F9F8] border-y border-slate-100 py-16 scroll-mt-16">
                <div className="max-w-6xl mx-auto px-5 md:px-8 grid md:grid-cols-2 gap-8">
                    <div>
                        <h2 className="font-display text-3xl font-bold mb-4">Conditions & éligibilité</h2>
                        <ul className="space-y-2.5">
                            {CONDITIONS.map((c, i) => <li key={i} className="flex gap-2.5 text-slate-700"><Check size={18} className="text-[#008751] shrink-0 mt-0.5" /> <span>{c}</span></li>)}
                        </ul>
                        <h3 className="font-bold text-slate-900 mt-6 mb-2 text-sm uppercase tracking-wide">Cibles éligibles</h3>
                        <div className="flex flex-wrap gap-2">{CIBLES.map(c => <span key={c} className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700">{c}</span>)}</div>
                    </div>
                    <div>
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.3)]">
                            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><FileCheck2 size={18} className="text-[#008751]" /> Pièces du dossier</h3>
                            <ul className="space-y-2">{PIECES.map((p, i) => <li key={i} className="flex gap-2 text-sm text-slate-600"><span className="w-5 h-5 rounded-md bg-[#E6F3ED] text-[#008751] flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</span> {p}</li>)}</ul>
                            <p className="text-[11px] text-slate-400 mt-3">Liste indicative — la liste officielle définitive est fournie avec la fiche de réservation.</p>
                        </div>
                        <EligibiliteSimulateur onLead={() => setLeadFor('general')} />
                    </div>
                </div>
            </section>

            {/* ═══ CTA final ═══ */}
            <section className="max-w-6xl mx-auto px-5 md:px-8 py-16 text-center">
                <Sparkles size={28} className="mx-auto text-[#008751] mb-4" />
                <h2 className="font-display text-3xl md:text-4xl font-bold">Un dossier prêt-à-accepter, c'est notre métier.</h2>
                <p className="mt-3 text-slate-600 max-w-xl mx-auto">Nous vérifions votre éligibilité, réunissons vos pièces et transmettons votre demande au programme.</p>
                <div className="mt-7 flex flex-wrap gap-3 justify-center">
                    <button onClick={() => setLeadFor('general')} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#008751] hover:bg-[#00643C] text-white font-bold transition-colors shadow-[0_14px_34px_-12px_rgba(0,135,81,0.7)]"><Send size={17} /> Composer mon dossier</button>
                    <a href="https://programmelogements.bj/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold transition-colors">Portail officiel <ExternalLink size={15} /></a>
                </div>
            </section>

            {/* ═══ MODAL DÉTAIL ═══ */}
            <AnimatePresence>
                {detail && <DetailModal l={detail} onClose={() => setDetail(null)} onLead={() => { setLeadFor(detail); setDetail(null) }} />}
            </AnimatePresence>

            {/* ═══ MODAL LEAD ═══ */}
            <AnimatePresence>
                {leadFor && <LeadModal logement={leadFor === 'general' ? null : leadFor} onClose={() => setLeadFor(null)} />}
            </AnimatePresence>
        </div>
    )
}

const flt = 'bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 font-semibold focus:outline-none focus:border-[#008751]'

/* ── Détail logement ── */
function DetailModal({ l, onClose, onLead }: { l: Logement; onClose: () => void; onLead: () => void }) {
    const [img, setImg] = useState(0)
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={onClose}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="relative aspect-[16/10] bg-slate-100">
                    {l.images?.length
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={l.images[img]} alt={l.nom} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-slate-300"><Home size={48} /></div>}
                    <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-full bg-white/90 text-slate-700 hover:bg-white"><X size={18} /></button>
                    {l.images?.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">{l.images.map((_, i) => <button key={i} onClick={() => setImg(i)} className={`w-2 h-2 rounded-full ${i === img ? 'bg-white' : 'bg-white/50'}`} />)}</div>
                    )}
                </div>
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-1"><span className="px-2 py-0.5 rounded-full bg-[#E6F3ED] text-[#008751] text-[11px] font-black">{l.type}</span><span className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={12} className="text-[#E8112D]" /> {[l.ville, l.site].filter(Boolean).join(' · ')}</span></div>
                    <h3 className="font-display text-2xl font-bold text-slate-900">{l.nom}</h3>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600 mt-2">
                        <span className="inline-flex items-center gap-1"><Ruler size={15} /> {l.surface_m2} m²</span>
                        {l.chambres > 0 && <span className="inline-flex items-center gap-1"><BedDouble size={15} /> {l.chambres} ch.</span>}
                    </div>
                    {l.description && <p className="text-slate-600 mt-4 leading-relaxed">{l.description}</p>}
                    {l.atouts?.length > 0 && <div className="flex flex-wrap gap-2 mt-4">{l.atouts.map((a, i) => <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#E6F3ED] text-[#00643C] text-xs font-semibold"><Check size={12} /> {a}</span>)}</div>}
                    <div className="grid grid-cols-2 gap-3 mt-5">
                        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comptant / crédit</p><p className="text-lg font-black text-slate-900">{money(l.prix_comptant, l.devise)}</p></div>
                        {l.mensualite > 0 && <div className="rounded-2xl bg-[#E6F3ED] border border-[#008751]/20 p-3"><p className="text-[10px] font-bold text-[#008751] uppercase tracking-wider">Location-accession</p><p className="text-lg font-black text-[#008751]">{money(l.mensualite, l.devise)}<span className="text-xs font-bold">/mois</span></p><p className="text-[10px] text-slate-500">sur {l.duree_annees} ans</p></div>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-6">
                        <button onClick={onLead} className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-[#008751] hover:bg-[#00643C] text-white font-bold transition-colors"><Send size={16} /> Composer mon dossier</button>
                        {l.visite_url && <a href={l.visite_url} target="_blank" rel="noreferrer" className="px-5 py-3.5 rounded-full bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold inline-flex items-center gap-2">Visite <ExternalLink size={14} /></a>}
                        {l.plan_url && <a href={l.plan_url} target="_blank" rel="noreferrer" className="px-5 py-3.5 rounded-full bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold inline-flex items-center gap-2">Plan <ExternalLink size={14} /></a>}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

/* ── Simulateur d'éligibilité ── */
function EligibiliteSimulateur({ onLead }: { onLead: () => void }) {
    const [q, setQ] = useState<{ nat: boolean | null; prop: boolean | null; dia: boolean | null }>({ nat: null, prop: null, dia: null })
    const done = q.nat !== null && q.prop !== null && q.dia !== null
    const eligible = q.nat === true && q.prop === false
    const Q = ({ k, label }: { k: keyof typeof q; label: string }) => (
        <div className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm text-slate-700">{label}</span>
            <div className="flex gap-1.5">
                <button onClick={() => setQ(s => ({ ...s, [k]: true }))} className={`px-3 py-1 rounded-lg text-xs font-bold ${q[k] === true ? 'bg-[#008751] text-white' : 'bg-slate-100 text-slate-500'}`}>Oui</button>
                <button onClick={() => setQ(s => ({ ...s, [k]: false }))} className={`px-3 py-1 rounded-lg text-xs font-bold ${q[k] === false ? 'bg-[#E8112D] text-white' : 'bg-slate-100 text-slate-500'}`}>Non</button>
            </div>
        </div>
    )
    return (
        <div className="mt-4 bg-white rounded-3xl border border-slate-200 p-6 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.3)]">
            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><Wand2 size={18} className="text-[#008751]" /> Vérifiez votre éligibilité</h3>
            <div className="divide-y divide-slate-100">
                <Q k="nat" label="Êtes-vous de nationalité béninoise ?" />
                <Q k="prop" label="Possédez-vous déjà un bien bâti au Bénin ?" />
                <Q k="dia" label="Résidez-vous à l'étranger (diaspora) ?" />
            </div>
            {done && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 rounded-2xl p-4 ${eligible ? 'bg-[#E6F3ED]' : 'bg-[#FDECEA]'}`}>
                    <p className={`font-black ${eligible ? 'text-[#008751]' : 'text-[#E8112D]'}`}>{eligible ? 'Profil a priori éligible 🎉'.replace('🎉', '') : 'À étudier ensemble'}</p>
                    <p className="text-sm text-slate-600 mt-1">{eligible ? 'Excellent ! Composons votre dossier pour une acceptation rapide.' : 'Certaines conditions demandent une analyse. Nos conseillers vous orientent.'}</p>
                    <button onClick={onLead} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#008751] hover:bg-[#00643C] text-white text-sm font-bold"><Send size={14} /> Être accompagné</button>
                </motion.div>
            )}
        </div>
    )
}

/* ── Formulaire lead ── */
function LeadModal({ logement, onClose }: { logement: Logement | null; onClose: () => void }) {
    const [f, setF] = useState({ prenom: '', nom: '', email: '', telephone: '', pays_residence: '', diaspora: false, formule_souhaitee: '', message: '' })
    const [sending, setSending] = useState(false)
    const [done, setDone] = useState(false)
    const submit = async () => {
        if (!f.nom.trim() || (!f.email.trim() && !f.telephone.trim())) { alert('Nom + email ou téléphone requis.'); return }
        setSending(true)
        try {
            const res = await fetch('/api/logements/lead', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...f, logement_id: logement?.id || null, logement_nom: logement?.nom || null, programme: logement?.programme || null }),
            })
            const j = await res.json().catch(() => ({}))
            if (!res.ok || !j.success) throw new Error(j.error || 'Envoi impossible.')
            setDone(true)
        } catch (e) { alert(e instanceof Error ? e.message : 'Erreur.') } finally { setSending(false) }
    }
    const inp = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15'
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={onClose}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="h-1 flex"><span className="flex-[46] bg-[#008751]" /><span className="flex-[27] bg-[#FCD116]" /><span className="flex-[27] bg-[#E8112D]" /></div>
                {done ? (
                    <div className="p-10 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-[#E6F3ED] flex items-center justify-center mx-auto mb-4"><Check size={28} className="text-[#008751]" /></div>
                        <h3 className="text-lg font-black text-slate-900">Demande transmise !</h3>
                        <p className="text-sm text-slate-500 mt-1">Notre équipe vous recontacte pour composer votre dossier et transmettre votre demande.</p>
                        <button onClick={onClose} className="mt-5 px-5 py-2.5 rounded-full bg-[#008751] text-white font-bold">Fermer</button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div><h3 className="font-black text-slate-900">Composer mon dossier</h3>{logement && <p className="text-xs text-slate-500">{logement.nom}</p>}</div>
                            <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <input value={f.prenom} onChange={e => setF({ ...f, prenom: e.target.value })} placeholder="Prénom" className={inp} />
                                <input value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} placeholder="Nom *" className={inp} />
                            </div>
                            <input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="Email" className={inp} />
                            <input value={f.telephone} onChange={e => setF({ ...f, telephone: e.target.value })} placeholder="Téléphone / WhatsApp" className={inp} />
                            <input value={f.pays_residence} onChange={e => setF({ ...f, pays_residence: e.target.value })} placeholder="Pays de résidence" className={inp} />
                            <select value={f.formule_souhaitee} onChange={e => setF({ ...f, formule_souhaitee: e.target.value })} className={inp}><option value="">Formule souhaitée</option><option>Location-accession</option><option>Comptant / crédit</option></select>
                            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={f.diaspora} onChange={e => setF({ ...f, diaspora: e.target.checked })} className="w-4 h-4 accent-[#008751]" /> Je fais partie de la diaspora</label>
                            <textarea rows={2} value={f.message} onChange={e => setF({ ...f, message: e.target.value })} placeholder="Message (optionnel)" className={inp + ' resize-none'} />
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50">Annuler</button>
                            <button onClick={submit} disabled={sending} className="px-5 py-2.5 rounded-xl bg-[#008751] hover:bg-[#00643C] text-white text-sm font-black flex items-center gap-2 disabled:opacity-60">{sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer</button>
                        </div>
                    </>
                )}
            </motion.div>
        </motion.div>
    )
}
