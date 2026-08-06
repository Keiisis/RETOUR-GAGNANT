'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Building3D from '@/components/logements/Building3D'
import TransitionLink from '@/components/TransitionLink'
import { House as Home, ArrowRight, ShieldCheck, PaperPlaneTilt as Send, MapPin, Ruler, Handshake, Check, CaretRight as ChevronRight } from '@phosphor-icons/react';

interface Logement { id: string; nom: string; type: string; ville: string; site: string; surface_m2: number; prix_comptant: number; devise: string; mensualite: number; images: string[] }
const money = (n: number, d = 'XOF') => `${Math.round(n).toLocaleString('fr-FR')} ${d === 'XOF' ? 'FCFA' : d}`

const ETAPES = [
    { t: 'Éligibilité', d: 'Nous vérifions votre profil (nationalité, non-propriété, revenus, diaspora).' },
    { t: 'Constitution du dossier', d: 'Nous réunissons et fiabilisons chaque pièce pour un dossier viable.' },
    { t: 'Transmission', d: 'Nous transmettons votre demande au programme pour une acceptation rapide.' },
]

export default function LogementTremplin() {
    const [featured, setFeatured] = useState<Logement[]>([])
    useEffect(() => { fetch('/api/logements').then(r => r.json()).then(j => setFeatured((j.logements || []).slice(0, 3))).catch(() => { }) }, [])

    return (
        <div className="bg-white text-slate-900">
            {/* HERO */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_12%_-5%,rgba(0,135,81,0.14),transparent),radial-gradient(45%_45%_at_92%_0%,rgba(252,209,22,0.12),transparent),linear-gradient(180deg,#FBFDFC,#FFFFFF)]" />
                <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-24 md:pt-28 pb-16 grid lg:grid-cols-[1.12fr_0.88fr] gap-6 lg:gap-8 items-center">
                  <div>
                    <nav className="flex items-center gap-1.5 text-[13px] text-slate-400 mb-7">
                        <Link href="/services" className="hover:text-[#008751]">Services</Link><ChevronRight size={13} />
                        <span className="text-slate-600 font-medium">Logement</span>
                    </nav>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E6F3ED] text-[#00643C] text-[11px] font-black uppercase tracking-[0.15em] mb-5"><Handshake size={13} /> Partenariat immobilier</div>
                    <h1 className="font-display text-4xl md:text-[3.7rem] font-bold leading-[1.03] tracking-[-0.02em] max-w-3xl">
                        Votre <span className="bg-gradient-to-br from-[#008751] via-[#0a7d52] to-[#00643C] bg-clip-text text-transparent">logement</span> au Bénin, un dossier bien monté.
                    </h1>
                    <p className="mt-5 text-base md:text-lg text-slate-600 max-w-2xl leading-relaxed">
                        Accédez aux logements économiques et sociaux du <strong className="text-slate-900">Programme national</strong>. Retour Gagnant ne vend pas les logements : nous <strong className="text-[#008751]">composons votre dossier</strong> pour qu'il soit viable et rapidement accepté.
                    </p>
                    <div className="mt-7 flex flex-wrap gap-3">
                        <TransitionLink href="/services/logement/programme" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#008751] hover:bg-[#00643C] text-white font-bold transition-colors shadow-[0_14px_34px_-12px_rgba(0,135,81,0.7)]"><Home size={18} /> Découvrir les logements <ArrowRight size={17} /></TransitionLink>
                        <TransitionLink href="/services/logement/programme#eligibilite" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white border border-slate-200 hover:border-[#008751] text-slate-800 font-bold transition-colors"><ShieldCheck size={18} className="text-[#008751]" /> Vérifier mon éligibilité</TransitionLink>
                    </div>
                  </div>
                  {/* Élément 3D — tour transportée d'une page à l'autre (View Transitions) + scroll (GSAP) */}
                  <Building3D className="mt-4 lg:mt-0" transitionName="logement-tower" />
                </div>
            </section>

            {/* NOTRE RÔLE */}
            <section className="max-w-6xl mx-auto px-5 md:px-8 py-14">
                <div className="grid md:grid-cols-3 gap-5">
                    {ETAPES.map((e, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                            className="bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] transition-shadow">
                            <div className="w-11 h-11 rounded-2xl bg-[#E6F3ED] text-[#008751] flex items-center justify-center font-black">{i + 1}</div>
                            <h3 className="font-extrabold text-slate-900 mt-4">{e.t}</h3>
                            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{e.d}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* TEASER CATALOGUE */}
            {featured.length > 0 && (
                <section className="bg-[#F7F9F8] border-y border-slate-100 py-14">
                    <div className="max-w-6xl mx-auto px-5 md:px-8">
                        <div className="flex items-end justify-between gap-4 mb-7">
                            <div><h2 className="font-display text-3xl font-bold">Aperçu du catalogue</h2><p className="text-slate-500 mt-1">Programme 20 000 logements · résidences</p></div>
                            <Link href="/services/logement/programme" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-[#008751] hover:gap-2.5 transition-all">Tout voir <ArrowRight size={15} /></Link>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                            {featured.map((l, i) => (
                                <motion.div key={l.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                                    <Link href="/services/logement/programme" className="group block bg-white rounded-3xl border border-slate-200 overflow-hidden hover:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.4)] hover:-translate-y-1 transition-all">
                                        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                                            {l.images?.[0]
                                                // eslint-disable-next-line @next/next/no-img-element
                                                ? <img src={l.images[0]} alt={l.nom} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={e => { e.currentTarget.style.display = 'none' }} />
                                                : <div className="w-full h-full flex items-center justify-center text-slate-300"><Home size={36} /></div>}
                                            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 text-[11px] font-black text-slate-800">{l.type}</span>
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-extrabold text-slate-900 truncate">{l.nom}</h3>
                                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><MapPin size={12} className="text-[#E8112D]" /> {[l.ville, l.site].filter(Boolean).join(' · ')} · <Ruler size={11} /> {l.surface_m2} m²</p>
                                            <p className="text-[#008751] font-black mt-2">{money(l.prix_comptant, l.devise)}{l.mensualite ? ` · ${money(l.mensualite, l.devise)}/mois` : ''}</p>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                        <div className="mt-7 text-center sm:hidden"><Link href="/services/logement/programme" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#008751]">Tout voir <ArrowRight size={15} /></Link></div>
                    </div>
                </section>
            )}

            {/* POURQUOI RGB + CTA */}
            <section className="max-w-6xl mx-auto px-5 md:px-8 py-16">
                <div className="rounded-[2rem] bg-gradient-to-br from-[#008751] to-[#00643C] text-white p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative">
                        <h2 className="font-display text-3xl md:text-4xl font-bold max-w-2xl">Un dossier viable, c'est une acceptation rapide.</h2>
                        <p className="mt-3 text-white/85 max-w-xl">Les critères sont stricts (nationalité, non-propriété, revenus, pièces d'état civil). Notre métier : rendre votre dossier impeccable et le transmettre.</p>
                        <div className="mt-6 grid sm:grid-cols-3 gap-3 max-w-2xl">
                            {['Éligibilité vérifiée', 'Pièces fiabilisées', 'Transmission au programme'].map(x => <div key={x} className="flex items-center gap-2 text-sm font-semibold"><Check size={16} className="text-[#FCD116]" /> {x}</div>)}
                        </div>
                        <Link href="/services/logement/programme" className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-[#008751] font-black hover:bg-[#FCD116] transition-colors text-lg"><Send size={18} /> Composer mon dossier <ArrowRight size={18} /></Link>
                        <p className="mt-3 text-white/70 text-sm">Sans engagement · réponse sous 48 h · nous transmettons pour vous.</p>
                    </div>
                </div>
            </section>
        </div>
    )
}
