'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import {
    CaretRight as ChevronRight, CaretDown as ChevronDown, Check, X,
    ShieldCheck, PaperPlaneTilt as Send, Sparkle, UsersThree,
    GlobeHemisphereWest as Globe, Clock, CalendarDots as Calendar,
    ClipboardText, Certificate,
} from '@phosphor-icons/react';
import { T, useTranslation } from '@/lib/translation';
import type { ServiceLandingContent } from '@/lib/content/serviceLanding';

const PILIER_ICONS = [Sparkle, UsersThree, ShieldCheck, Clock];
const CHIP_ICONS = [ShieldCheck, UsersThree, Globe, Clock];
const REASSURE_ICONS = [ShieldCheck, UsersThree, Certificate];

export default function ServiceLanding({ content: c, slotAfterFeatures, slotBeforeFinal }: { content: ServiceLandingContent; slotAfterFeatures?: ReactNode; slotBeforeFinal?: ReactNode }) {
    const { t } = useTranslation();
    const reduce = useReducedMotion();
    const { scrollY } = useScroll();
    const heroY = useTransform(scrollY, [0, 600], reduce ? [0, 0] : [0, 110]);

    return (
        <div className="bg-white text-slate-900 pb-16 md:pb-0">
            {/* ═══ HERO ═══ */}
            <section className="relative overflow-hidden">
                <motion.div style={{ y: heroY }} className="absolute -inset-x-8 -top-24 h-[135%] bg-[radial-gradient(55%_55%_at_12%_0%,rgba(0,135,81,0.16),transparent),radial-gradient(42%_45%_at_92%_2%,rgba(252,209,22,0.16),transparent),linear-gradient(180deg,#FBFDFC,#FFFFFF)]" />
                <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-24 md:pt-28 pb-14 grid lg:grid-cols-[1.12fr_0.88fr] gap-8 items-center">
                    <div>
                        <nav className="flex items-center gap-1.5 text-[13px] text-slate-400 mb-7">
                            <Link href="/" className="hover:text-[#008751]"><T>Accueil</T></Link><ChevronRight size={13} />
                            <Link href="/services" className="hover:text-[#008751]"><T>Services</T></Link><ChevronRight size={13} />
                            <span className="text-slate-600 font-medium">{t(c.hero_title)}</span>
                        </nav>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E6F3ED] text-[#00643C] text-[11px] font-black uppercase tracking-[0.15em] mb-5"><Sparkle size={13} weight="fill" /> {t(c.hero_badge)}</div>
                        <h1 className="font-display text-4xl md:text-[3.6rem] font-bold leading-[1.04] tracking-[-0.02em] max-w-3xl">
                            <span className="bg-gradient-to-br from-[#008751] via-[#0a7d52] to-[#00643C] bg-clip-text text-transparent">{t(c.hero_title)}</span>
                        </h1>
                        <p className="mt-5 text-[17px] text-slate-600 max-w-2xl leading-relaxed">{t(c.hero_subtitle)}</p>
                        <div className="mt-7 flex flex-wrap gap-3">
                            <Link href={c.cta1_href} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#008751] hover:bg-[#00643C] text-white font-bold transition-all hover:shadow-[0_16px_38px_-12px_rgba(0,135,81,0.75)]"><Send size={18} /> {t(c.cta1_label)}</Link>
                            <Link href={c.cta2_href} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white border border-slate-200 hover:border-[#008751] text-slate-800 font-bold transition-colors"><Calendar size={18} className="text-[#008751]" /> {t(c.cta2_label)}</Link>
                        </div>
                        <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                            {c.hero_chips.map((label, i) => {
                                const I = CHIP_ICONS[i % CHIP_ICONS.length];
                                return <span key={i} className="inline-flex items-center gap-1.5"><I size={15} className="text-[#008751]" /> {t(label)}</span>;
                            })}
                        </div>
                    </div>
                    {c.hero_image && (
                        <div className="relative mt-4 h-[300px] w-full lg:mt-0 lg:h-[440px] flex items-center justify-center">
                            <div className="absolute h-64 w-64 rounded-full bg-[#FCD116]/25 blur-[90px]" />
                            <div className="absolute h-52 w-52 rounded-full bg-[#008751]/15 blur-[80px] -translate-x-16 translate-y-10" />
                            <motion.div animate={reduce ? undefined : { y: [0, -14, 0] }} transition={reduce ? undefined : { duration: 5.5, ease: 'easeInOut', repeat: Infinity }} className="relative h-56 w-56 md:h-72 md:w-72">
                                <Image src={c.hero_image} alt={t(c.hero_title)} fill sizes="288px" className="object-contain drop-shadow-[0_24px_45px_rgba(0,0,0,0.25)]" priority />
                            </motion.div>
                        </div>
                    )}
                </div>
            </section>

            {/* ═══ PILIERS ═══ */}
            {c.piliers.length > 0 && (
                <section className="bg-gradient-to-br from-[#00643C] via-[#008751] to-[#0a7d52] text-white">
                    <div className="max-w-6xl mx-auto px-5 md:px-8 py-9 grid grid-cols-2 md:grid-cols-4 gap-6">
                        {c.piliers.map((p, i) => {
                            const I = PILIER_ICONS[i % PILIER_ICONS.length];
                            return (
                                <div key={i} className="flex flex-col">
                                    <I size={20} className="text-[#FCD116] mb-2" weight="fill" />
                                    <span className="font-display text-xl md:text-2xl font-bold leading-tight">{t(p.title)}</span>
                                    <span className="text-[13px] text-white/75 mt-1 leading-snug">{t(p.desc)}</span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ═══ INTRO + ÉTAPES ═══ */}
            <section className="max-w-6xl mx-auto px-5 md:px-8 py-16">
                <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-14 items-start">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-2">{t(c.intro_eyebrow)}</p>
                        <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight">{t(c.intro_title)}</h2>
                        <p className="mt-4 text-slate-600 leading-relaxed text-[17px]">{t(c.intro_text)}</p>
                    </div>
                    {c.etapes.length > 0 && (
                        <div>
                            {c.etapes_title && <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#7a5c00] mb-3">{t(c.etapes_title)}</p>}
                            <div className="space-y-3">
                                {c.etapes.map((e, i) => (
                                    <motion.div key={i} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                                        className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)] transition-shadow">
                                        <span className="font-display text-2xl font-bold text-[#008751]/30 shrink-0">{e.num}</span>
                                        <div>
                                            <h3 className="font-extrabold text-slate-900">{t(e.title)}</h3>
                                            <p className="text-sm text-slate-600 mt-1 leading-relaxed">{t(e.desc)}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* ═══ CONTRASTE ═══ */}
            {(c.solo.length > 0 || c.avec.length > 0) && (
                <section className="bg-gradient-to-b from-[#F7F9F8] to-white border-y border-slate-100 py-16">
                    <div className="max-w-6xl mx-auto px-5 md:px-8">
                        <div className="text-center max-w-2xl mx-auto mb-10">
                            <h2 className="font-display text-3xl md:text-4xl font-bold">{t(c.contrast_title)} <span className="text-[#008751]">{t(c.contrast_accent)}</span></h2>
                            <p className="mt-3 text-slate-600">{t(c.contrast_intro)}</p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
                            <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-6">
                                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-4"><T>En solo</T></p>
                                <ul className="space-y-3">
                                    {c.solo.map((s, i) => <li key={i} className="flex gap-2.5 text-sm text-slate-500"><span className="w-5 h-5 rounded-full bg-[#FDECEA] text-[#E8112D] flex items-center justify-center shrink-0"><X size={12} /></span> {t(s)}</li>)}
                                </ul>
                            </div>
                            <div className="rounded-3xl border-2 border-[#008751]/25 bg-[#E6F3ED]/40 p-6 shadow-[0_18px_50px_-28px_rgba(0,135,81,0.5)]">
                                <p className="text-[11px] font-black uppercase tracking-wider text-[#008751] mb-4"><T>Avec Retour Gagnant</T></p>
                                <ul className="space-y-3">
                                    {c.avec.map((s, i) => <li key={i} className="flex gap-2.5 text-sm text-slate-700 font-medium"><span className="w-5 h-5 rounded-full bg-[#008751] text-white flex items-center justify-center shrink-0"><Check size={12} /></span> {t(s)}</li>)}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ FEATURES (pièces / prestations) ═══ */}
            {c.features.length > 0 && (
                <section id="details" className="max-w-6xl mx-auto px-5 md:px-8 py-16 scroll-mt-16">
                    <div className="max-w-2xl mb-9">
                        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-2">{t(c.features_eyebrow)}</p>
                        <h2 className="font-display text-3xl md:text-4xl font-bold flex items-center gap-3"><ClipboardText size={30} className="text-[#008751]" /> {t(c.features_title)}</h2>
                        {c.features_intro && <p className="mt-3 text-slate-600">{t(c.features_intro)}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {c.features.map((item, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 2) * 0.05 }}
                                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-[#008751]/40 transition-colors">
                                <span className="w-6 h-6 rounded-lg bg-[#E6F3ED] text-[#008751] flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5">{i + 1}</span>
                                <span className="text-slate-700 text-[15px] leading-snug">{t(item)}</span>
                            </motion.div>
                        ))}
                    </div>
                    {c.features_note && <p className="mt-5 text-sm text-slate-500 italic flex items-start gap-2"><Sparkle size={15} className="text-[#FCD116] shrink-0 mt-0.5" weight="fill" /> {t(c.features_note)}</p>}
                </section>
            )}

            {/* Slot outil (ex : annuaire prêtres Fa) injecté après la liste */}
            {slotAfterFeatures}

            {/* ═══ RÉASSURANCE ═══ */}
            {c.reassurance.length > 0 && (
                <section className="bg-gradient-to-b from-white to-[#F7F9F8] border-y border-slate-100 py-14">
                    <div className="max-w-6xl mx-auto px-5 md:px-8 grid sm:grid-cols-3 gap-4">
                        {c.reassurance.map((r, i) => {
                            const I = REASSURE_ICONS[i % REASSURE_ICONS.length];
                            return (
                                <div key={i} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                                    <div className="w-11 h-11 rounded-2xl bg-[#E6F3ED] text-[#008751] flex items-center justify-center shrink-0"><I size={19} /></div>
                                    <div><p className="font-bold text-slate-900">{t(r.title)}</p><p className="text-sm text-slate-500 mt-0.5">{t(r.desc)}</p></div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ═══ FAQ ═══ */}
            {c.faq.length > 0 && (
                <section className="max-w-3xl mx-auto px-5 md:px-8 py-16">
                    <div className="text-center mb-9">
                        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-2"><T>On répond avant que vous demandiez</T></p>
                        <h2 className="font-display text-3xl md:text-4xl font-bold"><T>Questions fréquentes</T></h2>
                    </div>
                    <div className="space-y-3">{c.faq.map((f, i) => <FaqItem key={i} q={t(f.q)} r={t(f.r)} />)}</div>
                </section>
            )}

            {/* Slot outil (ex : réservation Fa, choix Langues) injecté avant le CTA final */}
            {slotBeforeFinal}

            {/* ═══ CTA FINAL ═══ */}
            <section className="max-w-6xl mx-auto px-5 md:px-8 py-16">
                <div className="rounded-[2rem] bg-gradient-to-br from-[#00643C] via-[#008751] to-[#0a7d52] text-white p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-[#FCD116]/15 blur-3xl" />
                    <div className="relative max-w-2xl">
                        <h2 className="font-display text-3xl md:text-4xl font-bold">{t(c.final_title)}</h2>
                        <p className="mt-3 text-white/85">{t(c.final_text)}</p>
                        <div className="mt-7">
                            <Link href={c.cta1_href} className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-[#008751] font-black hover:bg-[#FCD116] transition-colors text-lg"><Send size={18} /> {t(c.cta1_label)}</Link>
                            {c.final_note && <p className="mt-3 text-white/70 text-sm">{t(c.final_note)}</p>}
                        </div>
                    </div>
                </div>
            </section>

            {/* Barre CTA sticky (mobile) */}
            <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 flex items-center gap-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black text-slate-900 leading-tight truncate">{t(c.hero_title)}</p>
                    <p className="text-[11px] text-slate-500 truncate">{t(c.cta2_label)}</p>
                </div>
                <Link href={c.cta1_href} className="shrink-0 inline-flex items-center gap-1.5 px-5 py-3 rounded-full bg-[#008751] text-white font-black text-sm active:scale-95 transition-transform"><Send size={15} /> {t(c.cta1_label)}</Link>
            </div>
        </div>
    );
}

function FaqItem({ q, r }: { q: string; r: string }) {
    const [open, setOpen] = useState(false);
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
    );
}
