'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import {
    CaretRight as ChevronRight, CaretDown as ChevronDown, Check, X,
    ShieldCheck, PaperPlaneTilt as Send, Crown, UsersThree,
    GlobeHemisphereWest as Globe, Clock, CalendarDots as Calendar,
    ClipboardText, Certificate, Sparkle,
} from '@phosphor-icons/react';
import PricingCalculator3D from '@/components/services/PricingCalculator3D';
import { supabase } from '@/lib/supabase';
import { T, useTranslation } from '@/lib/translation';
import { DEFAULT_NATIONALITE_VIP as DEF, type NationaliteVipContent } from '@/lib/content/nationaliteVip';

// Icônes fixes (le contenu texte est éditable, l'iconographie reste maîtrisée).
const PILIER_ICONS = [Crown, UsersThree, Globe, Clock];
const CHIP_ICONS = [ShieldCheck, UsersThree, Globe, Clock];
const REASSURE_ICONS = [ShieldCheck, UsersThree, Certificate];

export default function NationaliteVipPage() {
    const { t } = useTranslation();
    const [c, setC] = useState<NationaliteVipContent>(DEF);
    const [globalCalcEnabled, setGlobalCalcEnabled] = useState(true);
    const reduce = useReducedMotion();
    const { scrollY } = useScroll();
    const heroY = useTransform(scrollY, [0, 600], reduce ? [0, 0] : [0, 110]);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await supabase
                    .from('page_sections')
                    .select('content')
                    .eq('page', 'nationalite-vip')
                    .eq('section_key', 'page_content')
                    .eq('is_active', true)
                    .single();
                if (data?.content) setC(prev => ({ ...prev, ...(data.content as Partial<NationaliteVipContent>) }));
            } catch { /* fallback defaults */ }
        })();
        fetch('/api/settings/frontend')
            .then(r => r.json())
            .then(json => { if (json.settings?.services_show_calculator === 'false') setGlobalCalcEnabled(false); })
            .catch(() => { });
    }, []);

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
                            <span className="text-slate-600 font-medium"><T>Nationalité VIP</T></span>
                        </nav>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FDF6D8] text-[#7a5c00] text-[11px] font-black uppercase tracking-[0.15em] mb-5"><Crown size={13} weight="fill" /> {t(c.hero_badge)}</div>
                        <h1 className="font-display text-4xl md:text-[3.6rem] font-bold leading-[1.04] tracking-[-0.02em] max-w-3xl">
                            <span className="bg-gradient-to-br from-[#008751] via-[#0a7d52] to-[#00643C] bg-clip-text text-transparent">{t(c.hero_title)}</span>
                        </h1>
                        <p className="mt-5 text-[17px] text-slate-600 max-w-2xl leading-relaxed">{t(c.hero_subtitle)}</p>
                        <div className="mt-7 flex flex-wrap gap-3">
                            <Link href="/nationalite" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#008751] hover:bg-[#00643C] text-white font-bold transition-all hover:shadow-[0_16px_38px_-12px_rgba(0,135,81,0.75)]"><Send size={18} /> {t(c.cta1_button_text)}</Link>
                            <Link href="/rendez-vous?service=nationalite-vip" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white border border-slate-200 hover:border-[#008751] text-slate-800 font-bold transition-colors"><Calendar size={18} className="text-[#008751]" /> {t(c.cta2_button_text)}</Link>
                        </div>
                        <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                            {c.hero_chips.map((label, i) => {
                                const I = CHIP_ICONS[i % CHIP_ICONS.length];
                                return <span key={i} className="inline-flex items-center gap-1.5"><I size={15} className="text-[#008751]" /> {t(label)}</span>;
                            })}
                        </div>
                    </div>
                    <div className="relative mt-4 h-[300px] w-full lg:mt-0 lg:h-[440px] flex items-center justify-center">
                        <div className="absolute h-64 w-64 rounded-full bg-[#FCD116]/25 blur-[90px]" />
                        <div className="absolute h-52 w-52 rounded-full bg-[#008751]/15 blur-[80px] -translate-x-16 translate-y-10" />
                        <motion.div
                            animate={reduce ? undefined : { y: [0, -14, 0] }}
                            transition={reduce ? undefined : { duration: 5.5, ease: 'easeInOut', repeat: Infinity }}
                            className="relative h-56 w-56 md:h-72 md:w-72"
                        >
                            <Image src="/assets/icones/Nationalité Béninoise VIP.png" alt="Nationalité Béninoise VIP" fill sizes="288px" className="object-contain drop-shadow-[0_24px_45px_rgba(0,0,0,0.25)]" priority />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ═══ PILIERS ═══ */}
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

            {/* ═══ NOTRE ACCOMPAGNEMENT + ÉTAPES ═══ */}
            <section className="max-w-6xl mx-auto px-5 md:px-8 py-16">
                <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-14 items-start">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-2">{t(c.accompagnement_eyebrow)}</p>
                        <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight">{t(c.accompagnement_title)}</h2>
                        <p className="mt-4 text-slate-600 leading-relaxed text-[17px]">{t(c.accompagnement_text)}</p>
                    </div>
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
            </section>

            {/* ═══ SOLO vs ACCOMPAGNÉ ═══ */}
            <section className="bg-gradient-to-b from-[#F7F9F8] to-white border-y border-slate-100 py-16">
                <div className="max-w-6xl mx-auto px-5 md:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-10">
                        <h2 className="font-display text-3xl md:text-4xl font-bold">{t(c.contrast_title)} <span className="text-[#008751]">{t(c.contrast_title_accent)}</span></h2>
                        <p className="mt-3 text-slate-600">{t(c.contrast_intro)}</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
                        <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-6">
                            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-4"><T>En solo</T></p>
                            <ul className="space-y-3">
                                {c.solo.map((s, i) => (
                                    <li key={i} className="flex gap-2.5 text-sm text-slate-500"><span className="w-5 h-5 rounded-full bg-[#FDECEA] text-[#E8112D] flex items-center justify-center shrink-0"><X size={12} /></span> {t(s)}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="rounded-3xl border-2 border-[#008751]/25 bg-[#E6F3ED]/40 p-6 shadow-[0_18px_50px_-28px_rgba(0,135,81,0.5)]">
                            <p className="text-[11px] font-black uppercase tracking-wider text-[#008751] mb-4"><T>Avec Retour Gagnant</T></p>
                            <ul className="space-y-3">
                                {c.avec.map((s, i) => (
                                    <li key={i} className="flex gap-2.5 text-sm text-slate-700 font-medium"><span className="w-5 h-5 rounded-full bg-[#008751] text-white flex items-center justify-center shrink-0"><Check size={12} /></span> {t(s)}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ PIÈCES À FOURNIR ═══ */}
            <section id="pieces" className="max-w-6xl mx-auto px-5 md:px-8 py-16 scroll-mt-16">
                <div className="max-w-2xl mb-9">
                    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-2">{t(c.documents_eyebrow)}</p>
                    <h2 className="font-display text-3xl md:text-4xl font-bold flex items-center gap-3"><ClipboardText size={30} className="text-[#008751]" /> {t(c.documents_title)}</h2>
                    <p className="mt-3 text-slate-600">{t(c.documents_intro)}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {c.documents.map((item, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 2) * 0.05 }}
                            className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-[#008751]/40 transition-colors">
                            <span className="w-6 h-6 rounded-lg bg-[#E6F3ED] text-[#008751] flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5">{i + 1}</span>
                            <span className="text-slate-700 text-[15px] leading-snug">{t(item)}</span>
                        </motion.div>
                    ))}
                </div>
                <p className="mt-5 text-sm text-slate-500 italic flex items-start gap-2"><Sparkle size={15} className="text-[#FCD116] shrink-0 mt-0.5" weight="fill" /> {t(c.documents_note)}</p>
            </section>

            {/* ═══ ÉLIGIBILITÉ + RÉASSURANCE ═══ */}
            <section id="eligibilite" className="bg-gradient-to-b from-white to-[#F7F9F8] border-y border-slate-100 py-16 scroll-mt-16">
                <div className="max-w-6xl mx-auto px-5 md:px-8 grid lg:grid-cols-2 gap-8 items-start">
                    <div>
                        <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">{t(c.elig_title)}</h2>
                        <p className="text-slate-600 mb-6 max-w-lg">{t(c.elig_intro)}</p>
                        <EligibiliteCheck q1={t(c.elig_q1)} q2={t(c.elig_q2)} cta={t(c.cta1_button_text)} />
                    </div>
                    <div className="lg:pt-4 space-y-4">
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
                </div>
            </section>

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

            {/* ═══ DÉMARRER — 2 CTA (+ calculateur gated) ═══ */}
            <section id="demarrer" className="max-w-6xl mx-auto px-5 md:px-8 pb-4">
                {c.pricing_show_calculator && globalCalcEnabled && (
                    <div className="mb-8 max-w-xl">
                        <PricingCalculator3D options={c.pricing_options} baseColor="#FCD116" serviceName="Nationalité Béninoise VIP" />
                    </div>
                )}
                <div className="grid md:grid-cols-2 gap-5">
                    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                        <div className="h-1 w-full bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />
                        <div className="p-7">
                            <div className="w-11 h-11 rounded-2xl bg-[#E6F3ED] text-[#008751] flex items-center justify-center mb-4"><Send size={20} /></div>
                            <h3 className="font-display text-2xl font-bold text-slate-900">{t(c.cta1_title)}</h3>
                            <p className="text-slate-600 mt-2">{t(c.cta1_description)}</p>
                            <Link href="/nationalite" className="mt-5 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#008751] hover:bg-[#00643C] text-white font-bold transition-all hover:shadow-[0_16px_38px_-12px_rgba(0,135,81,0.75)]">{t(c.cta1_button_text)} <ChevronRight size={17} /></Link>
                        </div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-[#FBFDFC] overflow-hidden">
                        <div className="h-1 w-full bg-gradient-to-r from-[#FCD116] to-[#008751]" />
                        <div className="p-7">
                            <div className="w-11 h-11 rounded-2xl bg-[#FDF6D8] text-[#7a5c00] flex items-center justify-center mb-4"><Calendar size={20} /></div>
                            <h3 className="font-display text-2xl font-bold text-slate-900">{t(c.cta2_title)}</h3>
                            <p className="text-slate-600 mt-2">{t(c.cta2_description)}</p>
                            <Link href="/rendez-vous?service=nationalite-vip" className="mt-5 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white border border-slate-200 hover:border-[#008751] text-slate-800 font-bold transition-colors">{t(c.cta2_button_text)} <ChevronRight size={17} /></Link>
                            <p className="text-xs text-slate-400 mt-3">{t(c.cta2_note)}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ CTA FINAL ═══ */}
            <section className="max-w-6xl mx-auto px-5 md:px-8 py-16">
                <div className="rounded-[2rem] bg-gradient-to-br from-[#00643C] via-[#008751] to-[#0a7d52] text-white p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-[#FCD116]/15 blur-3xl" />
                    <div className="relative max-w-2xl">
                        <h2 className="font-display text-3xl md:text-4xl font-bold">{t(c.final_title)}</h2>
                        <p className="mt-3 text-white/85">{t(c.final_text)}</p>
                        <div className="mt-7">
                            <Link href="/nationalite" className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-[#008751] font-black hover:bg-[#FCD116] transition-colors text-lg"><Send size={18} /> {t(c.cta1_button_text)}</Link>
                            <p className="mt-3 text-white/70 text-sm">{t(c.final_note)}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Barre CTA sticky (mobile) */}
            <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 flex items-center gap-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black text-slate-900 leading-tight truncate"><T>Prêt à lancer votre demande ?</T></p>
                    <p className="text-[11px] text-slate-500 truncate"><T>On monte et on transmet votre dossier.</T></p>
                </div>
                <Link href="/nationalite" className="shrink-0 inline-flex items-center gap-1.5 px-5 py-3 rounded-full bg-[#008751] text-white font-black text-sm active:scale-95 transition-transform"><Send size={15} /> <T>Commencer</T></Link>
            </div>
        </div>
    );
}

/* ── Mini-check éligibilité (foot-in-the-door) ── */
function EligibiliteCheck({ q1, q2, cta }: { q1: string; q2: string; cta: string }) {
    const [q, setQ] = useState<{ a: boolean | null; b: boolean | null }>({ a: null, b: null });
    const done = q.a !== null && q.b !== null;
    const eligible = q.a === true && q.b === true;
    const Row = ({ k, label }: { k: 'a' | 'b'; label: string }) => (
        <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm text-slate-700">{label}</span>
            <div className="flex gap-1.5">
                <button onClick={() => setQ(s => ({ ...s, [k]: true }))} className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-colors ${q[k] === true ? 'bg-[#008751] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><T>Oui</T></button>
                <button onClick={() => setQ(s => ({ ...s, [k]: false }))} className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-colors ${q[k] === false ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><T>Non</T></button>
            </div>
        </div>
    );
    return (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.3)] max-w-md">
            <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2"><ShieldCheck size={18} className="text-[#008751]" /> <T>Vérifiez votre éligibilité</T></h3>
            <p className="text-xs text-slate-500 mb-2"><T>Deux questions pour une première orientation.</T></p>
            <div className="divide-y divide-slate-100">
                <Row k="a" label={q1} />
                <Row k="b" label={q2} />
            </div>
            {done && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 rounded-2xl p-4 border ${eligible ? 'bg-[#E6F3ED] border-[#008751]/20' : 'bg-[#FFF7E6] border-[#FCD116]/40'}`}>
                    <p className={`font-black flex items-center gap-1.5 ${eligible ? 'text-[#008751]' : 'text-[#7a5c00]'}`}>{eligible ? <Check size={16} /> : <ShieldCheck size={16} />} <T>{eligible ? 'Profil a priori éligible' : 'À étudier ensemble'}</T></p>
                    <p className="text-sm text-slate-600 mt-1"><T>{eligible ? 'Lançons votre demande pour une prise en charge rapide.' : 'Certaines situations demandent une analyse ; nos conseillers vous orientent gratuitement.'}</T></p>
                    <Link href="/nationalite" className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#008751] hover:bg-[#00643C] text-white text-sm font-bold"><Send size={14} /> {cta}</Link>
                </motion.div>
            )}
        </div>
    );
}

/* ── FAQ (accordéon) ── */
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
