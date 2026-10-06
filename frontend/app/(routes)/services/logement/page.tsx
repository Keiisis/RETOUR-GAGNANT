'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import TransitionLink from '@/components/TransitionLink'
import { useTranslation, T } from '@/lib/translation'

// Modèle 3D réaliste (WebGL) chargé en lazy, désactivé côté SSR.
const BuildingModel3D = dynamic(() => import('@/components/logements/BuildingModel3D'), {
    ssr: false,
    loading: () => <div className="h-[340px] w-full animate-pulse rounded-[1.6rem] bg-slate-100 lg:h-[460px]" />,
})
import { House as Home, ArrowRight, ShieldCheck, PaperPlaneTilt as Send, MapPin, Ruler, Handshake, Check, CaretRight as ChevronRight } from '@phosphor-icons/react';

interface Logement { id: string; nom: string; type: string; ville: string; site: string; surface_m2: number; prix_comptant: number; devise: string; mensualite: number; images: string[] }
const money = (n: number, d = 'XOF') => `${Math.round(n).toLocaleString('fr-FR')} ${d === 'XOF' ? 'FCFA' : d}`

const ETAPES = [
    { t: 'Éligibilité', d: 'Nous vérifions votre profil (nationalité, non-propriété, revenus, diaspora).' },
    { t: 'Constitution du dossier', d: 'Nous réunissons et fiabilisons chaque pièce pour un dossier viable.' },
    { t: 'Transmission', d: 'Nous transmettons votre demande au programme pour une acceptation rapide.' },
]

export default function LogementTremplin() {
    const { t } = useTranslation()
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
                        <Link href="/services" className="hover:text-[#008751]"><T>Services</T></Link><ChevronRight size={13} />
                        <span className="text-slate-600 font-medium"><T>Logement</T></span>
                    </nav>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E6F3ED] text-[#00643C] text-[11px] font-black uppercase tracking-[0.15em] mb-5"><Handshake size={13} /> <T>Partenariat immobilier</T></div>
                    <h1 className="font-display text-4xl md:text-[3.7rem] font-bold leading-[1.03] tracking-[-0.02em] max-w-3xl">
                        <T>Votre</T> <span className="bg-gradient-to-br from-[#008751] via-[#0a7d52] to-[#00643C] bg-clip-text text-transparent"><T>logement</T></span> <T>au Bénin, un dossier bien monté.</T>
                    </h1>
                    <p className="mt-5 text-base md:text-lg text-slate-600 max-w-2xl leading-relaxed">
                        <T>Accédez aux logements économiques et sociaux du</T> <strong className="text-slate-900"><T>Programme national</T></strong>. <T>Retour Gagnant ne vend pas les logements : nous</T> <strong className="text-[#008751]"><T>composons votre dossier</T></strong> <T>pour qu'il soit viable et rapidement accepté.</T>
                    </p>
                    <div className="mt-7 flex flex-wrap gap-3">
                        <TransitionLink href="/services/logement/programme" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#008751] hover:bg-[#00643C] text-white font-bold transition-colors shadow-[0_14px_34px_-12px_rgba(0,135,81,0.7)]"><Home size={18} /> <T>Découvrir les logements</T> <ArrowRight size={17} /></TransitionLink>
                        <TransitionLink href="/services/logement/programme#eligibilite" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white border border-slate-200 hover:border-[#008751] text-slate-800 font-bold transition-colors"><ShieldCheck size={18} className="text-[#008751]" /> <T>Vérifier mon éligibilité</T></TransitionLink>
                    </div>
                  </div>
                  {/* Élément 3D : tour transportée d'une page à l'autre (View Transitions) + scroll (GSAP) */}
                  <BuildingModel3D className="mt-4 h-[340px] w-full lg:mt-0 lg:h-[460px]" />
                </div>
            </section>

            {/* NOTRE RÔLE */}
            <section className="max-w-6xl mx-auto px-5 md:px-8 py-14">
                <div className="grid md:grid-cols-3 gap-5">
                    {ETAPES.map((e, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                            className="bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] transition-shadow">
                            <div className="w-11 h-11 rounded-2xl bg-[#E6F3ED] text-[#008751] flex items-center justify-center font-black">{i + 1}</div>
                            <h3 className="font-extrabold text-slate-900 mt-4">{t(e.t)}</h3>
                            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{t(e.d)}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* TEASER CATALOGUE */}
            {featured.length > 0 && (
                <section className="bg-[#F7F9F8] border-y border-slate-100 py-14">
                    <div className="max-w-6xl mx-auto px-5 md:px-8">
                        <div className="flex items-end justify-between gap-4 mb-7">
                            <div><h2 className="font-display text-3xl font-bold"><T>Aperçu du catalogue</T></h2><p className="text-slate-500 mt-1"><T>Programme 20 000 logements · résidences</T></p></div>
                            <Link href="/services/logement/programme" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-[#008751] hover:gap-2.5 transition-all"><T>Tout voir</T> <ArrowRight size={15} /></Link>
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
                                            <p className="text-[#008751] font-black mt-2">{money(l.prix_comptant, l.devise)}{l.mensualite ? ` · ${money(l.mensualite, l.devise)}${t('/mois')}` : ''}</p>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                        <div className="mt-7 text-center sm:hidden"><Link href="/services/logement/programme" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#008751]"><T>Tout voir</T> <ArrowRight size={15} /></Link></div>
                    </div>
                </section>
            )}

            {/* POURQUOI RGB + CTA */}
            <section className="max-w-6xl mx-auto px-5 md:px-8 py-16">
                <div className="rounded-[2rem] bg-gradient-to-br from-[#008751] to-[#00643C] text-white p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative">
                        <h2 className="font-display text-3xl md:text-4xl font-bold max-w-2xl"><T>Un dossier viable, c'est une acceptation rapide.</T></h2>
                        <p className="mt-3 text-white/85 max-w-xl"><T>Les critères sont stricts (nationalité, non-propriété, revenus, pièces d'état civil). Notre métier : rendre votre dossier impeccable et le transmettre.</T></p>
                        <div className="mt-6 grid sm:grid-cols-3 gap-3 max-w-2xl">
                            {['Éligibilité vérifiée', 'Pièces fiabilisées', 'Transmission au programme'].map(x => <div key={x} className="flex items-center gap-2 text-sm font-semibold"><Check size={16} className="text-[#FCD116]" /> {t(x)}</div>)}
                        </div>
                        <Link href="/services/logement/programme" className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-[#008751] font-black hover:bg-[#FCD116] transition-colors text-lg"><Send size={18} /> <T>Composer mon dossier</T> <ArrowRight size={18} /></Link>
                        <p className="mt-3 text-white/70 text-sm"><T>Sans engagement · réponse sous 48 h · nous transmettons pour vous.</T></p>
                    </div>
                </div>
            </section>
        </div>
    )
}
