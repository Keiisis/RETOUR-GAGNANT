'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence, LayoutGroup, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import {
    ChevronRight, MapPin, Ruler, BedDouble, Building2, Check, X, ShieldCheck,
    FileCheck2, Home, Loader2, Send, Landmark, Layers, KeyRound, ClipboardCheck,
    Building, MapPinned, CalendarClock, Wallet, Flame, ChevronDown, Quote, ExternalLink,
} from 'lucide-react'
import Gallery from '@/components/logements/Gallery'
import CountUp from '@/components/logements/CountUp'
import Building3D from '@/components/logements/Building3D'
import TowerJourney from '@/components/logements/TowerJourney'
import TransitionLink from '@/components/TransitionLink'
import type { SitePoint } from '@/components/logements/SitesMap'

const SitesMap = dynamic(() => import('@/components/logements/SitesMap'), {
    ssr: false,
    loading: () => <div className="h-[380px] rounded-3xl bg-slate-100 animate-pulse" />,
})

interface Logement {
    id: string; programme: string; nom: string; type: string; ville: string; site: string
    surface_m2: number; chambres: number; prix_comptant: number; devise: string; mensualite: number
    duree_annees: number; formules: string[]; description: string; atouts: string[]; images: string[]
    plan_url: string | null; visite_url: string | null; disponibilite: string; lat: number | null; lng: number | null
}

interface Content {
    stats: { value: string; suffix: string; label: string }[]
    temoignages: { nom: string; ville: string; texte: string }[]
    faq: { q: string; r: string }[]
    rarete_active: boolean
    rarete_texte: string
}
const emptyContent: Content = { stats: [], temoignages: [], faq: [], rarete_active: false, rarete_texte: '' }

const money = (n: number, d = 'XOF') => `${Math.round(n).toLocaleString('fr-FR')} ${d === 'XOF' ? 'FCFA' : d}`

const CONDITIONS = [
    { icon: Landmark, t: 'Nationalité béninoise', d: 'Ouvert à la diaspora comme aux résidents.' },
    { icon: Home, t: 'Premier logement', d: "N'être propriétaire d'aucun immeuble bâti au Bénin (logement social)." },
    { icon: Layers, t: 'Ressources justifiées', d: 'Le revenu du ménage est pris en compte pour la solvabilité.' },
    { icon: KeyRound, t: 'Un logement par ville', d: 'Une acquisition maximum par ville du programme.' },
    { icon: ClipboardCheck, t: 'Règlement de copropriété', d: 'Adhésion obligatoire au règlement général.' },
]
const CIBLES = ["Fonctionnaires de l'État", 'Salariés du privé', 'Artisans · commerçants · agriculteurs', 'Professions libérales', 'Retraités', 'Diaspora béninoise']
const PIECES = ["Pièce d'identité / passeport en cours de validité", 'Justificatif de nationalité béninoise', 'Justificatifs de revenus (ménage)', 'Attestation de non-propriété', 'Fiche de (pré)réservation renseignée']

export default function ProgrammeLogementsPage() {
    const [all, setAll] = useState<Logement[]>([])
    const [loading, setLoading] = useState(true)
    const [prog, setProg] = useState<'20000' | 'residences'>('20000')
    const [ville, setVille] = useState('')
    const [type, setType] = useState('')
    const [formule, setFormule] = useState('')
    const [detail, setDetail] = useState<Logement | null>(null)
    const [leadFor, setLeadFor] = useState<Logement | null | 'general'>(null)
    const [content, setContent] = useState<Content>(emptyContent)

    // Parallax doux du décor du hero (Framer, SSR-safe). Désactivé si
    // l'utilisateur préfère moins d'animations.
    const reduce = useReducedMotion()
    const { scrollY } = useScroll()
    const heroY = useTransform(scrollY, [0, 600], reduce ? [0, 0] : [0, 110])

    useEffect(() => {
        fetch('/api/logements').then(r => r.json()).then(j => setAll(j.logements || [])).catch(() => setAll([])).finally(() => setLoading(false))
        fetch('/api/logements/content').then(r => r.json()).then(j => setContent({ ...emptyContent, ...(j.content || {}) })).catch(() => { })
    }, [])

    const inProg = useMemo(() => all.filter(l => l.programme === prog), [all, prog])
    const villes = useMemo(() => [...new Set(inProg.map(l => l.ville).filter(Boolean))].sort(), [inProg])
    const types = useMemo(() => [...new Set(inProg.map(l => l.type).filter(Boolean))].sort(), [inProg])
    const list = useMemo(() => inProg.filter(l =>
        (!ville || l.ville === ville) && (!type || l.type === type) && (!formule || l.formules?.includes(formule))
    ), [inProg, ville, type, formule])

    const points: SitePoint[] = useMemo(() => {
        const m = new Map<string, { lat: number; lng: number; n: number; min: number; dev: string }>()
        inProg.forEach(l => {
            if (typeof l.lat !== 'number' || typeof l.lng !== 'number') return
            const e = m.get(l.ville) || { lat: l.lat, lng: l.lng, n: 0, min: Infinity, dev: l.devise }
            e.n++; e.min = Math.min(e.min, l.prix_comptant || Infinity)
            m.set(l.ville, e)
        })
        return [...m.entries()].map(([ville, e]) => ({ ville, lat: e.lat, lng: e.lng, count: e.n, min: isFinite(e.min) ? e.min : undefined, devise: e.dev }))
    }, [inProg])

    const stats = useMemo(() => {
        const minPrix = inProg.length ? Math.min(...inProg.map(l => l.prix_comptant).filter(Boolean)) : 0
        return { total: inProg.length, villes: villes.length, min: minPrix }
    }, [inProg, villes])

    return (
        <LayoutGroup>
            <div className="bg-white text-slate-900 pb-16 md:pb-0">
                {/* Tour 3D qui voyage du héros jusqu'au CTA final (desktop large) */}
                <TowerJourney />
                {/* Bandeau rareté (éditable en admin) */}
                {content.rarete_active && content.rarete_texte && (
                    <div className="bg-[#E8112D] text-white text-center text-[13px] md:text-sm font-bold py-2.5 px-4 flex items-center justify-center gap-2"><Flame size={15} /> {content.rarete_texte}</div>
                )}
                {/* ═══ HERO ═══ */}
                <section className="relative overflow-hidden">
                    <motion.div style={{ y: heroY }} className="absolute -inset-x-8 -top-24 h-[135%] bg-[radial-gradient(55%_55%_at_12%_0%,rgba(0,135,81,0.16),transparent),radial-gradient(42%_45%_at_92%_2%,rgba(252,209,22,0.14),transparent),linear-gradient(180deg,#FBFDFC,#FFFFFF)]" />
                    <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-24 md:pt-28 pb-14 grid lg:grid-cols-[1.12fr_0.88fr] gap-6 lg:gap-8 items-center">
                      <div>
                        <nav className="flex items-center gap-1.5 text-[13px] text-slate-400 mb-7">
                            <Link href="/services" className="hover:text-[#008751]">Services</Link><ChevronRight size={13} />
                            <TransitionLink href="/services/logement" className="hover:text-[#008751]">Logement</TransitionLink><ChevronRight size={13} />
                            <span className="text-slate-600 font-medium">Programme national</span>
                        </nav>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E6F3ED] text-[#00643C] text-[11px] font-black uppercase tracking-[0.15em] mb-5"><Building2 size={13} /> En partenariat — Programme national</div>
                        <h1 className="font-display text-4xl md:text-[3.7rem] font-bold leading-[1.03] tracking-[-0.02em] max-w-3xl">
                            <span className="bg-gradient-to-br from-[#008751] via-[#0a7d52] to-[#00643C] bg-clip-text text-transparent">Devenez propriétaire</span> au Bénin.
                        </h1>
                        <p className="mt-5 text-[17px] text-slate-600 max-w-2xl leading-relaxed">
                            Logements économiques et sociaux du Programme 20 000 logements et résidences. <strong className="text-slate-900">Retour Gagnant ne vend pas</strong> : nous montons votre <strong className="text-[#008751]">dossier viable et vite accepté</strong>, puis transmettons votre demande.
                        </p>
                        <div className="mt-7 flex flex-wrap gap-3">
                            <a href="#catalogue" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#008751] hover:bg-[#00643C] text-white font-bold transition-all hover:shadow-[0_16px_38px_-12px_rgba(0,135,81,0.75)]"><Home size={18} /> Voir les logements</a>
                            <a href="#eligibilite" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white border border-slate-200 hover:border-[#008751] text-slate-800 font-bold transition-colors"><ShieldCheck size={18} className="text-[#008751]" /> Mon éligibilité</a>
                        </div>
                        {!loading && stats.total > 0 && (
                            <div className="mt-9 flex flex-wrap gap-x-8 gap-y-3">
                                <div className="flex items-baseline gap-2"><CountUp to={stats.total} className="font-display text-2xl font-bold text-[#008751]" /><span className="text-sm text-slate-500">logements</span></div>
                                <div className="flex items-baseline gap-2"><CountUp to={stats.villes} className="font-display text-2xl font-bold text-[#008751]" /><span className="text-sm text-slate-500">villes</span></div>
                                <div className="flex items-baseline gap-2"><span className="font-display text-2xl font-bold text-[#008751]">2</span><span className="text-sm text-slate-500">formules</span></div>
                                {stats.min > 0 && <div className="flex items-baseline gap-2"><span className="text-sm text-slate-500">dès</span><span className="font-display text-2xl font-bold text-slate-900"><CountUp to={stats.min} suffix=" FCFA" /></span></div>}
                            </div>
                        )}
                      </div>
                      {/* Ancre héros : la tour s'y pose au départ (voir TowerJourney). */}
                      <div id="tower-hero-slot" className="relative min-h-[300px] lg:min-h-[360px] mt-4 lg:mt-0">
                        {/* < xl : tour statique embarquée (le voyage fixed est réservé au desktop large). */}
                        <div className="xl:hidden"><Building3D transitionName="logement-tower" /></div>
                      </div>
                    </div>
                </section>

                {/* ═══ CHIFFRES CLÉS DU PROGRAMME (faits réels, animés) ═══ */}
                <section className="relative overflow-hidden">
                    <div className="bg-gradient-to-br from-[#00643C] via-[#008751] to-[#0a7d52] text-white">
                        <div className="max-w-6xl mx-auto px-5 md:px-8 py-9 grid grid-cols-2 md:grid-cols-4 gap-6">
                            {[
                                { Ic: Building, to: 20000, suffix: '', label: 'logements économiques & sociaux' },
                                { Ic: MapPinned, to: 14, suffix: '', label: 'villes couvertes au Bénin' },
                                { Ic: CalendarClock, to: 25, suffix: ' ans', label: 'durée max en location-accession' },
                                { Ic: Wallet, to: 22.88, dec: 2, suffix: ' M', label: 'FCFA — dès la villa sociale' },
                            ].map((k, i) => (
                                <div key={i} className="flex flex-col">
                                    <k.Ic size={20} className="text-[#FCD116] mb-2" />
                                    <span className="font-display text-3xl md:text-4xl font-bold leading-none"><CountUp to={k.to} decimals={k.dec || 0} suffix={k.suffix} /></span>
                                    <span className="text-[13px] text-white/75 mt-1.5 leading-snug">{k.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ═══ BARRE PROGRAMME + FILTRES (sticky) ═══ */}
                <div className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-y border-slate-100">
                    <div className="max-w-6xl mx-auto px-5 md:px-8 py-3 flex flex-wrap items-center gap-2">
                        {([['20000', 'Programme 20 000'], ['residences', 'Résidences']] as const).map(([v, l]) => (
                            <button key={v} onClick={() => { setProg(v); setVille(''); setType('') }} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${prog === v ? 'bg-[#008751] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{l}</button>
                        ))}
                        <span className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />
                        <select value={ville} onChange={e => setVille(e.target.value)} className={flt}><option value="">Toutes les villes</option>{villes.map(v => <option key={v}>{v}</option>)}</select>
                        <select value={type} onChange={e => setType(e.target.value)} className={flt}><option value="">Tous les types</option>{types.map(t => <option key={t}>{t}</option>)}</select>
                        <select value={formule} onChange={e => setFormule(e.target.value)} className={flt}><option value="">Toutes formules</option><option value="location-accession">Location-accession</option><option value="comptant">Comptant / crédit</option></select>
                        {(ville || type || formule) && <button onClick={() => { setVille(''); setType(''); setFormule('') }} className="text-sm font-bold text-[#E8112D] hover:underline">Réinitialiser</button>}
                    </div>
                </div>

                {/* ═══ CATALOGUE ═══ */}
                <section id="catalogue" className="max-w-6xl mx-auto px-5 md:px-8 py-14 scroll-mt-16">
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded-3xl border border-slate-200 overflow-hidden"><div className="aspect-[4/3] bg-slate-100 animate-pulse" /><div className="p-4 space-y-2"><div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" /><div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" /><div className="h-5 bg-slate-100 rounded animate-pulse w-2/5 mt-3" /></div></div>)}
                        </div>
                    ) : list.length === 0 ? (
                        <div className="text-center py-20 text-slate-400"><Building2 size={40} className="mx-auto mb-3 opacity-40" /><p className="font-semibold text-slate-500">Aucun logement pour ces critères. Le catalogue est mis à jour régulièrement.</p></div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {list.map((l, i) => (
                                <motion.button key={l.id} onClick={() => setDetail(l)}
                                    initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.05 }}
                                    className="group text-left bg-white rounded-3xl border border-slate-200 overflow-hidden hover:shadow-[0_28px_64px_-28px_rgba(15,23,42,0.45)] hover:-translate-y-1 transition-all">
                                    <motion.div layoutId={`ph-${l.id}`} className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                                        {l.images?.[0]
                                            // eslint-disable-next-line @next/next/no-img-element
                                            ? <img src={l.images[0]} alt={l.nom} className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-[600ms]" onError={e => { e.currentTarget.style.display = 'none' }} />
                                            : <div className="w-full h-full flex items-center justify-center text-slate-300"><Home size={40} /></div>}
                                        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-[11px] font-black text-slate-800">{l.type}</span>
                                        {l.disponibilite !== 'disponible' && <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#FCD116] text-[#5A4A00] text-[10px] font-black uppercase tracking-wide">{l.disponibilite === 'bientot' ? 'Bientôt' : 'Épuisé'}</span>}
                                    </motion.div>
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

                    {/* Carte + sites */}
                    {points.length > 0 && (
                        <div className="mt-14 grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
                            <SitesMap points={points} onSelect={v => { setVille(v); document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' }) }} />
                            <div>
                                <h2 className="font-display text-2xl font-bold mb-4">Sites du programme</h2>
                                <div className="flex flex-wrap gap-2.5">
                                    {points.sort((a, b) => b.count - a.count).map(p => (
                                        <button key={p.ville} onClick={() => { setVille(p.ville); document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' }) }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-[#008751] transition-colors">
                                            <MapPin size={15} className="text-[#008751]" /><span className="font-bold text-slate-800">{p.ville}</span><span className="text-xs font-black text-white bg-[#008751] rounded-full px-2 py-0.5">{p.count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* ═══ POURQUOI RGB (contraste solo vs accompagné) ═══ */}
                <section className="max-w-6xl mx-auto px-5 md:px-8 py-14">
                    <div className="text-center max-w-2xl mx-auto mb-10">
                        <h2 className="font-display text-3xl md:text-4xl font-bold">Le logement est ouvert à tous. <span className="text-[#008751]">L'acceptation, non.</span></h2>
                        <p className="mt-3 text-slate-600">Un dossier incomplet ou mal monté est recalé — et la place part à un autre. C'est précisément là que nous intervenons.</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
                        <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-6">
                            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-4">En solo</p>
                            <ul className="space-y-3">
                                {['Pièces manquantes ou non conformes = dossier recalé', 'Allers-retours administratifs depuis l\'étranger', 'Critères stricts mal interprétés', 'Délais qui s\'allongent, place qui s\'envole'].map((t, i) => (
                                    <li key={i} className="flex gap-2.5 text-sm text-slate-500"><span className="w-5 h-5 rounded-full bg-[#FDECEA] text-[#E8112D] flex items-center justify-center shrink-0"><X size={12} /></span> {t}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="rounded-3xl border-2 border-[#008751]/25 bg-[#E6F3ED]/40 p-6 shadow-[0_18px_50px_-28px_rgba(0,135,81,0.5)]">
                            <p className="text-[11px] font-black uppercase tracking-wider text-[#008751] mb-4">Avec Retour Gagnant</p>
                            <ul className="space-y-3">
                                {['Dossier vérifié et fiabilisé, pièce par pièce', 'Tout géré localement — zéro déplacement pour la diaspora', 'Éligibilité confirmée avant de déposer', 'Transmission de votre demande pour une acceptation rapide'].map((t, i) => (
                                    <li key={i} className="flex gap-2.5 text-sm text-slate-700 font-medium"><span className="w-5 h-5 rounded-full bg-[#008751] text-white flex items-center justify-center shrink-0"><Check size={12} /></span> {t}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto mt-5">
                        {[[ShieldCheck, 'Éligibilité confirmée', 'On valide votre profil avant tout dépôt.'], [FileCheck2, 'Pièces fiabilisées', 'Chaque document contrôlé et conforme.'], [Send, 'Transmission assurée', 'Nous portons votre demande au programme.']].map(([Ic, t, d], i) => (
                            <div key={i} className="rounded-2xl border border-slate-200 p-5 text-center">
                                <div className="w-11 h-11 rounded-2xl bg-[#E6F3ED] text-[#008751] flex items-center justify-center mx-auto mb-3">{(() => { const I = Ic as typeof ShieldCheck; return <I size={19} /> })()}</div>
                                <p className="font-bold text-slate-900 text-sm">{t as string}</p>
                                <p className="text-xs text-slate-500 mt-1">{d as string}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ═══ PREUVE (stats + témoignages, éditable en admin) ═══ */}
                {(content.stats.length > 0 || content.temoignages.length > 0) && (
                    <section className="max-w-6xl mx-auto px-5 md:px-8 py-14">
                        <div className="text-center max-w-2xl mx-auto mb-9">
                            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-2">La preuve</p>
                            <h2 className="font-display text-3xl md:text-4xl font-bold">Ils nous ont confié leur dossier.</h2>
                        </div>
                        {content.stats.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-11">
                                {content.stats.map((s, i) => (
                                    <div key={i} className="text-center">
                                        <p className="font-display text-3xl md:text-4xl font-bold text-[#008751]">{s.value}<span className="text-2xl">{s.suffix}</span></p>
                                        <p className="text-sm text-slate-500 mt-1 leading-snug">{s.label}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        {content.temoignages.length > 0 && (
                            <div className="grid md:grid-cols-3 gap-5">
                                {content.temoignages.map((t, i) => (
                                    <motion.div key={i} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.06 }} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.3)]">
                                        <Quote size={24} className="text-[#008751]/25 mb-3" />
                                        <p className="text-slate-700 leading-relaxed">« {t.texte} »</p>
                                        <p className="mt-4 text-sm font-bold text-slate-900">{t.nom}{t.ville && <span className="text-slate-400 font-normal"> · {t.ville}</span>}</p>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* ═══ CONDITIONS & ÉLIGIBILITÉ ═══ */}
                <section id="eligibilite" className="bg-gradient-to-b from-[#F7F9F8] to-white border-y border-slate-100 py-16 scroll-mt-16">
                    <div className="max-w-6xl mx-auto px-5 md:px-8">
                        <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">Conditions & éligibilité</h2>
                        <p className="text-slate-500 mb-8 max-w-2xl">Les critères officiels du programme. Notre rôle : vérifier votre profil et fiabiliser chaque pièce.</p>
                        <div className="grid lg:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                {CONDITIONS.map((c, i) => (
                                    <div key={i} className="flex gap-3.5 bg-white rounded-2xl border border-slate-200 p-4">
                                        <div className="w-10 h-10 rounded-xl bg-[#E6F3ED] text-[#008751] flex items-center justify-center shrink-0"><c.icon size={18} /></div>
                                        <div><p className="font-bold text-slate-900">{c.t}</p><p className="text-sm text-slate-500 mt-0.5">{c.d}</p></div>
                                    </div>
                                ))}
                                <div className="pt-2">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Cibles éligibles</p>
                                    <div className="flex flex-wrap gap-2">{CIBLES.map(c => <span key={c} className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700">{c}</span>)}</div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.3)]">
                                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><FileCheck2 size={18} className="text-[#008751]" /> Pièces du dossier</h3>
                                    <ul className="space-y-2.5">{PIECES.map((p, i) => <li key={i} className="flex gap-2.5 text-sm text-slate-600"><span className="w-5 h-5 rounded-md bg-[#E6F3ED] text-[#008751] flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</span> {p}</li>)}</ul>
                                    <p className="text-[11px] text-slate-400 mt-3">Liste indicative — la liste officielle définitive accompagne la fiche de réservation.</p>
                                </div>
                                <EligibiliteCheck onLead={() => setLeadFor('general')} />
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══ FAQ (accordéon, éditable en admin) ═══ */}
                {content.faq.length > 0 && (
                    <section className="max-w-3xl mx-auto px-5 md:px-8 py-14">
                        <div className="text-center mb-9">
                            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-2">On répond avant que vous demandiez</p>
                            <h2 className="font-display text-3xl md:text-4xl font-bold">Questions fréquentes</h2>
                        </div>
                        <div className="space-y-3">{content.faq.map((f, i) => <FaqItem key={i} q={f.q} r={f.r} />)}</div>
                        <div className="text-center mt-8">
                            <button onClick={() => setLeadFor('general')} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#008751] text-white font-bold hover:bg-[#00643C] transition-colors">Une autre question ? Parlons de votre dossier <ChevronRight size={16} /></button>
                        </div>
                    </section>
                )}

                {/* ═══ CTA final ═══ */}
                <section className="max-w-6xl mx-auto px-5 md:px-8 py-16">
                    <div className="rounded-[2rem] bg-gradient-to-br from-[#00643C] via-[#008751] to-[#0a7d52] text-white p-8 md:p-12 relative overflow-hidden">
                        <div className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-[#FCD116]/15 blur-3xl" />
                        {/* Ancre d'arrivée : la tour vient se déposer ici (desktop large). */}
                        <div id="tower-cta-slot" aria-hidden="true" className="hidden xl:block absolute right-10 top-1/2 -translate-y-1/2 w-[300px] h-[340px] pointer-events-none" />
                        <div className="relative max-w-2xl">
                            <h2 className="font-display text-3xl md:text-4xl font-bold">Un dossier recalé, c'est une place perdue.</h2>
                            <p className="mt-3 text-white/85">Les critères sont stricts et les places limitées. Nous fiabilisons chaque pièce et transmettons votre demande — pour qu'elle passe du premier coup.</p>
                            <div className="mt-7">
                                <button onClick={() => setLeadFor('general')} className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-[#008751] font-black hover:bg-[#FCD116] transition-colors text-lg"><Send size={18} /> Composer mon dossier</button>
                                <p className="mt-3 text-white/70 text-sm">Sans engagement · réponse sous 48 h · nous transmettons pour vous.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Barre CTA sticky (mobile) — toujours visible, conversion */}
                <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 flex items-center gap-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                    <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-black text-slate-900 leading-tight truncate">Prêt à devenir propriétaire ?</p>
                        <p className="text-[11px] text-slate-500 truncate">On monte et on transmet votre dossier.</p>
                    </div>
                    <button onClick={() => setLeadFor('general')} className="shrink-0 inline-flex items-center gap-1.5 px-5 py-3 rounded-full bg-[#008751] text-white font-black text-sm active:scale-95 transition-transform"><Send size={15} /> Composer</button>
                </div>

                <AnimatePresence>{detail && <DetailModal l={detail} onClose={() => setDetail(null)} onLead={() => { setLeadFor(detail); setDetail(null) }} />}</AnimatePresence>
                <AnimatePresence>{leadFor && <LeadModal logement={leadFor === 'general' ? null : leadFor} onClose={() => setLeadFor(null)} />}</AnimatePresence>
            </div>
        </LayoutGroup>
    )
}

const flt = 'bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 font-semibold focus:outline-none focus:border-[#008751]'

/* ── Détail (morph layoutId + galerie Embla) ── */
function DetailModal({ l, onClose, onLead }: { l: Logement; onClose: () => void; onLead: () => void }) {
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={onClose}>
            <motion.div initial={{ y: 24 }} animate={{ y: 0 }} exit={{ y: 24, opacity: 0 }} className="w-full max-w-3xl max-h-[93vh] overflow-y-auto bg-white rounded-[1.8rem] shadow-2xl" onClick={e => e.stopPropagation()}>
                <motion.div layoutId={`ph-${l.id}`} className="relative aspect-[16/10] bg-slate-100">
                    <Gallery images={l.images || []} alt={l.nom} />
                    <button onClick={onClose} className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/90 text-slate-700 hover:bg-white shadow"><X size={18} /></button>
                </motion.div>
                <div className="p-6 md:p-7">
                    <div className="flex items-center gap-2 mb-1.5"><span className="px-2 py-0.5 rounded-full bg-[#E6F3ED] text-[#00643C] text-[11px] font-black">{l.type}</span><span className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={12} className="text-[#E8112D]" /> {[l.ville, l.site].filter(Boolean).join(' · ')}</span></div>
                    <h3 className="font-display text-2xl md:text-3xl font-bold text-slate-900">{l.nom}</h3>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600 mt-2.5">
                        <span className="inline-flex items-center gap-1.5"><Ruler size={15} className="text-slate-400" /> {l.surface_m2} m²</span>
                        {l.chambres > 0 && <span className="inline-flex items-center gap-1.5"><BedDouble size={15} className="text-slate-400" /> {l.chambres} chambres</span>}
                    </div>
                    {l.description && <p className="text-slate-600 mt-4 leading-relaxed">{l.description}</p>}
                    {l.atouts?.length > 0 && <div className="flex flex-wrap gap-2 mt-4">{l.atouts.map((a, i) => <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E6F3ED] text-[#00643C] text-xs font-semibold"><Check size={12} /> {a}</span>)}</div>}
                    <div className="grid grid-cols-2 gap-3 mt-6">
                        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comptant / crédit</p><p className="text-xl font-black text-slate-900 mt-0.5">{money(l.prix_comptant, l.devise)}</p></div>
                        {l.mensualite > 0 && <div className="rounded-2xl bg-[#E6F3ED] border border-[#008751]/20 p-4"><p className="text-[10px] font-bold text-[#008751] uppercase tracking-wider">Location-accession</p><p className="text-xl font-black text-[#008751] mt-0.5">{money(l.mensualite, l.devise)}<span className="text-xs font-bold">/mois</span></p><p className="text-[10px] text-slate-500">sur {l.duree_annees} ans</p></div>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-6">
                        <button onClick={onLead} className="flex-1 min-w-[190px] inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-[#008751] hover:bg-[#00643C] text-white font-bold transition-colors"><Send size={16} /> Composer mon dossier</button>
                        {l.visite_url && <a href={l.visite_url} target="_blank" rel="noreferrer" className="px-5 py-3.5 rounded-full bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold inline-flex items-center gap-2">Visite <ExternalLink size={14} /></a>}
                        {l.plan_url && <a href={l.plan_url} target="_blank" rel="noreferrer" className="px-5 py-3.5 rounded-full bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold inline-flex items-center gap-2">Plan <ExternalLink size={14} /></a>}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

/* ── Vérification d'éligibilité (outil réel, pas un gadget) ── */
function EligibiliteCheck({ onLead }: { onLead: () => void }) {
    const [q, setQ] = useState<{ nat: boolean | null; prop: boolean | null }>({ nat: null, prop: null })
    const done = q.nat !== null && q.prop !== null
    const eligible = q.nat === true && q.prop === false
    const Row = ({ k, label }: { k: keyof typeof q; label: string }) => (
        <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm text-slate-700">{label}</span>
            <div className="flex gap-1.5">
                <button onClick={() => setQ(s => ({ ...s, [k]: true }))} className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-colors ${q[k] === true ? 'bg-[#008751] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Oui</button>
                <button onClick={() => setQ(s => ({ ...s, [k]: false }))} className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-colors ${q[k] === false ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Non</button>
            </div>
        </div>
    )
    return (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.3)]">
            <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2"><ShieldCheck size={18} className="text-[#008751]" /> Vérifiez votre éligibilité</h3>
            <p className="text-xs text-slate-500 mb-2">Deux questions pour une première orientation.</p>
            <div className="divide-y divide-slate-100">
                <Row k="nat" label="Êtes-vous de nationalité béninoise ?" />
                <Row k="prop" label="Possédez-vous déjà un bien bâti au Bénin ?" />
            </div>
            {done && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 rounded-2xl p-4 border ${eligible ? 'bg-[#E6F3ED] border-[#008751]/20' : 'bg-[#FDECEA] border-[#E8112D]/15'}`}>
                    <p className={`font-black flex items-center gap-1.5 ${eligible ? 'text-[#008751]' : 'text-[#E8112D]'}`}>{eligible ? <Check size={16} /> : <ShieldCheck size={16} />} {eligible ? 'Profil a priori éligible' : 'À étudier ensemble'}</p>
                    <p className="text-sm text-slate-600 mt-1">{eligible ? 'Composons votre dossier pour une acceptation rapide.' : 'Certaines conditions demandent une analyse ; nos conseillers vous orientent.'}</p>
                    <button onClick={onLead} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#008751] hover:bg-[#00643C] text-white text-sm font-bold"><Send size={14} /> Être accompagné</button>
                </motion.div>
            )}
        </div>
    )
}

/* ── Lead ── */
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={onClose}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="h-1 flex"><span className="flex-[46] bg-[#008751]" /><span className="flex-[27] bg-[#FCD116]" /><span className="flex-[27] bg-[#E8112D]" /></div>
                {done ? (
                    <div className="p-10 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-[#E6F3ED] flex items-center justify-center mx-auto mb-4"><Check size={28} className="text-[#008751]" /></div>
                        <h3 className="text-lg font-black text-slate-900">Demande transmise.</h3>
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

/* ── FAQ (accordéon) ── */
function FaqItem({ q, r }: { q: string; r: string }) {
    const [open, setOpen] = useState(false)
    return (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
                <span className="font-bold text-slate-900 text-[15px]">{q}</span>
                <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                        <p className="px-5 pb-4 text-slate-600 leading-relaxed text-sm whitespace-pre-line">{r}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
