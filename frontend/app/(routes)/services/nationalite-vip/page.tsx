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

interface PricingOption { label: string; price: string; }

interface PageContent {
    hero_title: string;
    hero_subtitle: string;
    accompagnement_title: string;
    accompagnement_text: string;
    documents_title: string;
    documents_note: string;
    documents: string[];
    pricing_show_calculator: boolean;
    pricing_options: PricingOption[];
    cta1_title: string;
    cta1_description: string;
    cta1_button_text: string;
    cta2_title: string;
    cta2_description: string;
    cta2_button_text: string;
    cta2_note: string;
}

const DEFAULT_CONTENT: PageContent = {
    hero_title: "Nationalité Béninoise — Accompagnement VIP",
    hero_subtitle: "Procédure personnalisée et accompagnée de A à Z pour obtenir la nationalité béninoise.",
    accompagnement_title: "Notre accompagnement",
    accompagnement_text: "Nous guidons les membres de la diaspora afro-descendante dans l'ensemble des démarches administratives nécessaires à l'obtention de la nationalité béninoise. De la constitution du dossier à la remise des documents officiels, notre équipe assure un suivi personnalisé et transparent à chaque étape.",
    documents_title: "Pièces à fournir",
    documents_note: "* Cette liste peut varier selon votre situation individuelle. Nos conseillers vous transmettront la liste définitive lors de votre consultation.",
    documents: [
        "Preuve d'afro-descendance",
        "Preuve de profession",
        "Justificatif de domicile",
        "Pièce d'identité en cours de validité",
        "Votre extrait de naissance",
        "Casier judiciaire",
        "Extrait de naissance de vos deux parents (père et mère)",
        "Copie du livret de famille de vos parents",
        "Extrait de naissance de vos arrière-grands-parents (du côté du père et du côté de la mère)",
        "Copie de votre livret de famille si enfant mineur",
        "Et tout autre document (acte de mariage ; notariale ; acte militaire ; de décès) de vos grands-parents et arrière-grands-parents.",
    ],
    pricing_show_calculator: false,
    pricing_options: [
        { label: "Accompagnement dossier standard", price: "150.000 FCFA" },
        { label: "Pack VIP — suivi prioritaire complet", price: "350.000 FCFA" },
        { label: "Consultation initiale", price: "Gratuit" },
    ],
    cta1_title: "Commencer ma demande",
    cta1_description: "Remplissez le formulaire de demande en ligne. Notre équipe vous recontactera sous 48h.",
    cta1_button_text: "Commencer ma demande",
    cta2_title: "Prendre un rendez-vous",
    cta2_description: "Échangez avec un conseiller pour évaluer votre situation et préparer votre dossier.",
    cta2_button_text: "Réserver un créneau",
    cta2_note: "Premier appel de 15 min gratuit",
};

// ── Piliers de valeur (charte, pas de chiffres inventés) ──
const PILIERS = [
    { Ic: Crown, t: 'Accompagnement VIP', d: 'Pris en charge de A à Z' },
    { Ic: UsersThree, t: 'Suivi personnalisé', d: 'Un conseiller dédié, transparent' },
    { Ic: Globe, t: 'Pensé pour la diaspora', d: 'Tout géré à distance' },
    { Ic: Clock, t: 'Réponse sous 48 h', d: 'Sans engagement' },
];

// ── Notre rôle, étape par étape (issu du texte d'accompagnement) ──
const ETAPES = [
    { n: '01', t: 'Constitution du dossier', d: 'Nous réunissons et fiabilisons chaque pièce — la vôtre et celle de votre lignée.' },
    { n: '02', t: 'Suivi personnalisé', d: 'Un conseiller dédié vous accompagne, étape par étape, en toute transparence.' },
    { n: '03', t: 'Remise des documents', d: 'Nous vous accompagnons jusqu\'à la remise de vos documents officiels.' },
];

const SOLO = [
    "Actes d'état civil sur plusieurs générations, difficiles à réunir",
    'Exigences mal comprises = dossier rejeté',
    'Allers-retours administratifs depuis l\'étranger',
    'Délais qui s\'allongent, procédure qui traîne',
];
const AVEC = [
    'On vous dit exactement quoi fournir, pièce par pièce',
    'Dossier vérifié et fiabilisé avant tout dépôt',
    'Tout géré à distance — zéro déplacement pour la diaspora',
    'Suivi transparent jusqu\'à la remise des documents',
];

const FAQ: { q: string; r: string }[] = [
    { q: "Qui peut demander la nationalité par afro-descendance ?", r: "Toute personne de la diaspora afro-descendante en mesure d'établir un lien avec le Bénin. Nos conseillers évaluent précisément votre situation lors du premier échange, sans engagement." },
    { q: "Dois-je résider au Bénin pour lancer la démarche ?", r: "Non. Nous accompagnons la diaspora à distance : la constitution du dossier et le suivi se font sans que vous ayez à vous déplacer." },
    { q: "Et si des documents de mes parents ou grands-parents manquent ?", r: "C'est fréquent sur plusieurs générations. Nous vous indiquons les pièces alternatives acceptées et vous aidons à reconstituer ce qui manque." },
    { q: "Combien de temps prend la procédure ?", r: "Les délais dépendent de votre dossier et de l'administration. Nous vous donnons une estimation réaliste dès l'analyse de votre situation." },
    { q: "Comment se passe le premier échange ?", r: "Un premier échange sans engagement permet d'évaluer votre situation et de préparer la suite. Le détail de l'accompagnement vous est présenté ensuite." },
];

export default function NationaliteVipPage() {
    const { t } = useTranslation();
    const [content, setContent] = useState<PageContent>(DEFAULT_CONTENT);
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
                if (data?.content) setContent(prev => ({ ...prev, ...(data.content as Partial<PageContent>) }));
            } catch { /* fallback defaults */ }
        })();
        fetch('/api/settings/frontend')
            .then(r => r.json())
            .then(json => { if (json.settings?.services_show_calculator === 'false') setGlobalCalcEnabled(false); })
            .catch(() => { });
    }, []);

    return (
        <div className="bg-white text-slate-900 pb-16 md:pb-0">
            {/* ═══ HERO (clair, charte) ═══ */}
            <section className="relative overflow-hidden">
                <motion.div style={{ y: heroY }} className="absolute -inset-x-8 -top-24 h-[135%] bg-[radial-gradient(55%_55%_at_12%_0%,rgba(0,135,81,0.16),transparent),radial-gradient(42%_45%_at_92%_2%,rgba(252,209,22,0.16),transparent),linear-gradient(180deg,#FBFDFC,#FFFFFF)]" />
                <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-24 md:pt-28 pb-14 grid lg:grid-cols-[1.12fr_0.88fr] gap-8 items-center">
                    <div>
                        <nav className="flex items-center gap-1.5 text-[13px] text-slate-400 mb-7">
                            <Link href="/" className="hover:text-[#008751]"><T>Accueil</T></Link><ChevronRight size={13} />
                            <Link href="/services" className="hover:text-[#008751]"><T>Services</T></Link><ChevronRight size={13} />
                            <span className="text-slate-600 font-medium"><T>Nationalité VIP</T></span>
                        </nav>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FDF6D8] text-[#7a5c00] text-[11px] font-black uppercase tracking-[0.15em] mb-5"><Crown size={13} weight="fill" /> <T>Service phare — Nationalité béninoise</T></div>
                        <h1 className="font-display text-4xl md:text-[3.6rem] font-bold leading-[1.04] tracking-[-0.02em] max-w-3xl">
                            <span className="bg-gradient-to-br from-[#008751] via-[#0a7d52] to-[#00643C] bg-clip-text text-transparent">{t(content.hero_title)}</span>
                        </h1>
                        <p className="mt-5 text-[17px] text-slate-600 max-w-2xl leading-relaxed">{t(content.hero_subtitle)}</p>
                        <div className="mt-7 flex flex-wrap gap-3">
                            <Link href="/nationalite" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#008751] hover:bg-[#00643C] text-white font-bold transition-all hover:shadow-[0_16px_38px_-12px_rgba(0,135,81,0.75)]"><Send size={18} /> {t(content.cta1_button_text)}</Link>
                            <Link href="/rendez-vous?service=nationalite-vip" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white border border-slate-200 hover:border-[#008751] text-slate-800 font-bold transition-colors"><Calendar size={18} className="text-[#008751]" /> {t(content.cta2_button_text)}</Link>
                        </div>
                        <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                            {[['De A à Z', ShieldCheck], ['Suivi transparent', UsersThree], ['Diaspora afro-descendante', Globe], ['Réponse 48 h', Clock]].map(([label, Ic], i) => {
                                const I = Ic as typeof ShieldCheck;
                                return <span key={i} className="inline-flex items-center gap-1.5"><I size={15} className="text-[#008751]" /> <T>{label as string}</T></span>;
                            })}
                        </div>
                    </div>
                    {/* Visuel — illustration officielle (halo + flottement doux) */}
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

            {/* ═══ PILIERS (bande verte) ═══ */}
            <section className="bg-gradient-to-br from-[#00643C] via-[#008751] to-[#0a7d52] text-white">
                <div className="max-w-6xl mx-auto px-5 md:px-8 py-9 grid grid-cols-2 md:grid-cols-4 gap-6">
                    {PILIERS.map((p, i) => (
                        <div key={i} className="flex flex-col">
                            <p.Ic size={20} className="text-[#FCD116] mb-2" weight="fill" />
                            <span className="font-display text-xl md:text-2xl font-bold leading-tight"><T>{p.t}</T></span>
                            <span className="text-[13px] text-white/75 mt-1 leading-snug"><T>{p.d}</T></span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══ NOTRE ACCOMPAGNEMENT + ÉTAPES ═══ */}
            <section className="max-w-6xl mx-auto px-5 md:px-8 py-16">
                <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-14 items-start">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-2"><T>Notre métier</T></p>
                        <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight">{t(content.accompagnement_title)}</h2>
                        <p className="mt-4 text-slate-600 leading-relaxed text-[17px]">{t(content.accompagnement_text)}</p>
                    </div>
                    <div className="space-y-3">
                        {ETAPES.map((e, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                                className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)] transition-shadow">
                                <span className="font-display text-2xl font-bold text-[#008751]/30 shrink-0">{e.n}</span>
                                <div>
                                    <h3 className="font-extrabold text-slate-900"><T>{e.t}</T></h3>
                                    <p className="text-sm text-slate-600 mt-1 leading-relaxed"><T>{e.d}</T></p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ SOLO vs ACCOMPAGNÉ (contraste — aversion à la perte) ═══ */}
            <section className="bg-gradient-to-b from-[#F7F9F8] to-white border-y border-slate-100 py-16">
                <div className="max-w-6xl mx-auto px-5 md:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-10">
                        <h2 className="font-display text-3xl md:text-4xl font-bold"><T>Une procédure exigeante.</T> <span className="text-[#008751]"><T>Un dossier qui ne pardonne pas l'à-peu-près.</T></span></h2>
                        <p className="mt-3 text-slate-600"><T>La nationalité par afro-descendance demande des actes sur plusieurs générations. Une pièce manquante ou non conforme, et tout est retardé. C'est là que nous intervenons.</T></p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
                        <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-6">
                            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-4"><T>En solo</T></p>
                            <ul className="space-y-3">
                                {SOLO.map((s, i) => (
                                    <li key={i} className="flex gap-2.5 text-sm text-slate-500"><span className="w-5 h-5 rounded-full bg-[#FDECEA] text-[#E8112D] flex items-center justify-center shrink-0"><X size={12} /></span> <T>{s}</T></li>
                                ))}
                            </ul>
                        </div>
                        <div className="rounded-3xl border-2 border-[#008751]/25 bg-[#E6F3ED]/40 p-6 shadow-[0_18px_50px_-28px_rgba(0,135,81,0.5)]">
                            <p className="text-[11px] font-black uppercase tracking-wider text-[#008751] mb-4"><T>Avec Retour Gagnant</T></p>
                            <ul className="space-y-3">
                                {AVEC.map((s, i) => (
                                    <li key={i} className="flex gap-2.5 text-sm text-slate-700 font-medium"><span className="w-5 h-5 rounded-full bg-[#008751] text-white flex items-center justify-center shrink-0"><Check size={12} /></span> <T>{s}</T></li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ PIÈCES À FOURNIR ═══ */}
            <section id="pieces" className="max-w-6xl mx-auto px-5 md:px-8 py-16 scroll-mt-16">
                <div className="max-w-2xl mb-9">
                    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-2"><T>On sait exactement quoi réunir</T></p>
                    <h2 className="font-display text-3xl md:text-4xl font-bold flex items-center gap-3"><ClipboardText size={30} className="text-[#008751]" /> {t(content.documents_title)}</h2>
                    <p className="mt-3 text-slate-600"><T>Nous vous guidons pièce par pièce — y compris pour les actes de vos parents, grands-parents et arrière-grands-parents.</T></p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {content.documents.map((item, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 2) * 0.05 }}
                            className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-[#008751]/40 transition-colors">
                            <span className="w-6 h-6 rounded-lg bg-[#E6F3ED] text-[#008751] flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5">{i + 1}</span>
                            <span className="text-slate-700 text-[15px] leading-snug">{t(item)}</span>
                        </motion.div>
                    ))}
                </div>
                <p className="mt-5 text-sm text-slate-500 italic flex items-start gap-2"><Sparkle size={15} className="text-[#FCD116] shrink-0 mt-0.5" weight="fill" /> {t(content.documents_note)}</p>
            </section>

            {/* ═══ ÉLIGIBILITÉ (mini-check) + RÉASSURANCE ═══ */}
            <section id="eligibilite" className="bg-gradient-to-b from-white to-[#F7F9F8] border-y border-slate-100 py-16 scroll-mt-16">
                <div className="max-w-6xl mx-auto px-5 md:px-8 grid lg:grid-cols-2 gap-8 items-start">
                    <div>
                        <h2 className="font-display text-3xl md:text-4xl font-bold mb-2"><T>Suis-je concerné(e) ?</T></h2>
                        <p className="text-slate-600 mb-6 max-w-lg"><T>Deux questions pour une première orientation. Aucune donnée n'est enregistrée — c'est indicatif.</T></p>
                        <EligibiliteCheck />
                    </div>
                    <div className="lg:pt-4 space-y-4">
                        {[[ShieldCheck, 'Sans engagement', 'Le premier échange n\'engage à rien.'], [UsersThree, 'Un conseiller dédié', 'La même personne vous suit du début à la fin.'], [Certificate, 'Confidentialité', 'Vos documents et informations restent privés.']].map(([Ic, ti, d], i) => {
                            const I = Ic as typeof ShieldCheck;
                            return (
                                <div key={i} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                                    <div className="w-11 h-11 rounded-2xl bg-[#E6F3ED] text-[#008751] flex items-center justify-center shrink-0"><I size={19} /></div>
                                    <div><p className="font-bold text-slate-900"><T>{ti as string}</T></p><p className="text-sm text-slate-500 mt-0.5"><T>{d as string}</T></p></div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ═══ FAQ (objections) ═══ */}
            <section className="max-w-3xl mx-auto px-5 md:px-8 py-16">
                <div className="text-center mb-9">
                    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-2"><T>On répond avant que vous demandiez</T></p>
                    <h2 className="font-display text-3xl md:text-4xl font-bold"><T>Questions fréquentes</T></h2>
                </div>
                <div className="space-y-3">{FAQ.map((f, i) => <FaqItem key={i} q={t(f.q)} r={t(f.r)} />)}</div>
            </section>

            {/* ═══ DÉMARRER — 2 façons (calculateur gardé, gated) ═══ */}
            <section id="demarrer" className="max-w-6xl mx-auto px-5 md:px-8 pb-4">
                {content.pricing_show_calculator && globalCalcEnabled && (
                    <div className="mb-8 max-w-xl">
                        <PricingCalculator3D options={content.pricing_options} baseColor="#FCD116" serviceName="Nationalité Béninoise VIP" />
                    </div>
                )}
                <div className="grid md:grid-cols-2 gap-5">
                    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                        <div className="h-1 w-full bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />
                        <div className="p-7">
                            <div className="w-11 h-11 rounded-2xl bg-[#E6F3ED] text-[#008751] flex items-center justify-center mb-4"><Send size={20} /></div>
                            <h3 className="font-display text-2xl font-bold text-slate-900">{t(content.cta1_title)}</h3>
                            <p className="text-slate-600 mt-2">{t(content.cta1_description)}</p>
                            <Link href="/nationalite" className="mt-5 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#008751] hover:bg-[#00643C] text-white font-bold transition-all hover:shadow-[0_16px_38px_-12px_rgba(0,135,81,0.75)]">{t(content.cta1_button_text)} <ChevronRight size={17} /></Link>
                        </div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-[#FBFDFC] overflow-hidden">
                        <div className="h-1 w-full bg-gradient-to-r from-[#FCD116] to-[#008751]" />
                        <div className="p-7">
                            <div className="w-11 h-11 rounded-2xl bg-[#FDF6D8] text-[#7a5c00] flex items-center justify-center mb-4"><Calendar size={20} /></div>
                            <h3 className="font-display text-2xl font-bold text-slate-900">{t(content.cta2_title)}</h3>
                            <p className="text-slate-600 mt-2">{t(content.cta2_description)}</p>
                            <Link href="/rendez-vous?service=nationalite-vip" className="mt-5 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white border border-slate-200 hover:border-[#008751] text-slate-800 font-bold transition-colors">{t(content.cta2_button_text)} <ChevronRight size={17} /></Link>
                            <p className="text-xs text-slate-400 mt-3">{t(content.cta2_note)}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ CTA FINAL (aversion à la perte) ═══ */}
            <section className="max-w-6xl mx-auto px-5 md:px-8 py-16">
                <div className="rounded-[2rem] bg-gradient-to-br from-[#00643C] via-[#008751] to-[#0a7d52] text-white p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-[#FCD116]/15 blur-3xl" />
                    <div className="relative max-w-2xl">
                        <h2 className="font-display text-3xl md:text-4xl font-bold"><T>La nationalité se gagne sur un dossier impeccable.</T></h2>
                        <p className="mt-3 text-white/85"><T>Un dossier mal monté, c'est un rejet et des mois perdus. Nous montons le vôtre pour qu'il passe — et nous vous suivons jusqu'à la remise de vos documents.</T></p>
                        <div className="mt-7">
                            <Link href="/nationalite" className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-[#008751] font-black hover:bg-[#FCD116] transition-colors text-lg"><Send size={18} /> {t(content.cta1_button_text)}</Link>
                            <p className="mt-3 text-white/70 text-sm"><T>Sans engagement · réponse sous 48 h · premier échange gratuit.</T></p>
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
function EligibiliteCheck() {
    const [q, setQ] = useState<{ afro: boolean | null; lien: boolean | null }>({ afro: null, lien: null });
    const done = q.afro !== null && q.lien !== null;
    const eligible = q.afro === true && q.lien === true;
    const Row = ({ k, label }: { k: keyof typeof q; label: string }) => (
        <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm text-slate-700"><T>{label}</T></span>
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
                <Row k="afro" label="Êtes-vous afro-descendant(e) de la diaspora ?" />
                <Row k="lien" label="Pouvez-vous documenter un lien avec le Bénin (ascendance, actes) ?" />
            </div>
            {done && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 rounded-2xl p-4 border ${eligible ? 'bg-[#E6F3ED] border-[#008751]/20' : 'bg-[#FFF7E6] border-[#FCD116]/40'}`}>
                    <p className={`font-black flex items-center gap-1.5 ${eligible ? 'text-[#008751]' : 'text-[#7a5c00]'}`}>{eligible ? <Check size={16} /> : <ShieldCheck size={16} />} <T>{eligible ? 'Profil a priori éligible' : 'À étudier ensemble'}</T></p>
                    <p className="text-sm text-slate-600 mt-1"><T>{eligible ? 'Lançons votre demande pour une prise en charge rapide.' : 'Certaines situations demandent une analyse ; nos conseillers vous orientent gratuitement.'}</T></p>
                    <Link href="/nationalite" className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#008751] hover:bg-[#00643C] text-white text-sm font-bold"><Send size={14} /> <T>Être accompagné</T></Link>
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
