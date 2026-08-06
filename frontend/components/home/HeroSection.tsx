"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarBlank } from "@phosphor-icons/react";
import { useTranslation, T } from "@/lib/translation";
import { supabase } from "@/lib/supabase";

/**
 * Hero — direction éditoriale asymétrique, palette CLAIRE (ivoire), titre
 * cinétique Fraunces (révélation par mots). Un seul CTA primaire. Filet
 * tricolore fin (pas d'aplat patriotique). Image réelle du Bénin en duotone
 * vert-or. Titre/sous-titre restent éditables via `settings` (Supabase).
 */
export default function HeroSection() {
    const { t, lang } = useTranslation();
    const reduce = useReducedMotion();
    const [content, setContent] = useState({
        title: "VOTRE RETOUR GAGNANT",
        subtitle:
            "Réalisez vos ambitions au cœur du Bénin : là où vos racines deviennent des héritages d'exception.",
    });

    const SLOGAN_VALS: Record<string, string> = {
        en: "YOUR WINNING RETURN",
        es: "SU REGRESO GANADOR",
        pt: "SEU RETORNO VENCEDOR",
        cr: "RETOU GAYAN ZÒT",
        ht: "RETOU GAYAN OU",
        fr: "VOTRE RETOUR GAGNANT",
    };

    useEffect(() => {
        const fetchHero = async () => {
            const { data, error } = await supabase
                .from("settings")
                .select("key, value")
                .or("key.eq.frontend_hero_title,key.eq.frontend_hero_subtitle");
            if (data && !error) {
                setContent((prev) => {
                    const next = { ...prev };
                    data.forEach((item) => {
                        if (item.key === "frontend_hero_title") next.title = item.value;
                        if (item.key === "frontend_hero_subtitle") next.subtitle = item.value;
                    });
                    return next;
                });
            }
        };
        fetchHero();
        const channel = supabase
            .channel("hero_settings_changes")
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, fetchHero)
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Titre → mots (le slogan principal a une traduction précise dédiée).
    const rawTitle = (() => {
        const isMain =
            content.title.toUpperCase().includes("VOTRE RETOUR GAGNANT") ||
            t(content.title).toUpperCase() === "VOTRE RETOUR GAGNANT";
        return isMain ? SLOGAN_VALS[lang] || t(content.title) : t(content.title);
    })();
    const words = rawTitle.split(" ").filter(Boolean);

    const container = {
        hidden: {},
        show: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
    };
    const wordV = {
        hidden: { y: "115%" },
        show: { y: 0, transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] as const } },
    };
    const fade = {
        hidden: { opacity: 0, y: 18 },
        show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } },
    };

    return (
        <section className="relative overflow-hidden bg-[#FBFAF7] -mt-20 pt-28 md:pt-32 pb-16 md:pb-20 min-h-[100dvh] flex items-center">
            {/* halo clair très doux (ivoire/menthe/or), aucun fond sombre */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="absolute -top-24 -left-24 h-[520px] w-[520px] rounded-full bg-[#008751]/[0.06] blur-[120px]" />
                <div className="absolute -bottom-32 right-[8%] h-[440px] w-[440px] rounded-full bg-[#FCD116]/[0.10] blur-[120px]" />
            </div>

            <div className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-10 px-5 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
                {/* ── Colonne texte ── */}
                <div>
                    <motion.p
                        initial={reduce ? false : "hidden"}
                        animate="show"
                        variants={fade}
                        className="mb-6 font-geistmono text-[11px] font-medium uppercase tracking-[0.32em] text-[#008751]"
                    >
                        <T>Diaspora · Bénin</T>
                    </motion.p>

                    <motion.h1
                        initial={reduce ? false : "hidden"}
                        animate="show"
                        variants={container}
                        className="font-fraunces text-[3.2rem] font-semibold leading-[0.98] tracking-[-0.02em] text-[#0d1a12] sm:text-6xl md:text-7xl lg:text-[5.1rem]"
                    >
                        {words.map((w, i) => (
                            <span key={i} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
                                <motion.span
                                    variants={wordV}
                                    className={`inline-block ${i === words.length - 1 ? "italic text-[#008751]" : ""}`}
                                >
                                    {w}
                                </motion.span>
                                {i < words.length - 1 ? " " : ""}
                            </span>
                        ))}
                    </motion.h1>

                    {/* filet tricolore fin (accent, pas d'aplat) */}
                    <motion.div
                        initial={reduce ? false : "hidden"}
                        animate="show"
                        variants={fade}
                        className="mt-7 flex h-[3px] w-40 overflow-hidden rounded-full"
                    >
                        <span className="flex-[46] bg-[#008751]" />
                        <span className="flex-[27] bg-[#FCD116]" />
                        <span className="flex-[27] bg-[#E8112D]" />
                    </motion.div>

                    <motion.p
                        initial={reduce ? false : "hidden"}
                        animate="show"
                        variants={fade}
                        className="mt-6 max-w-[46ch] font-geist text-lg leading-relaxed text-[#4a5751]"
                    >
                        {t(content.subtitle)}
                    </motion.p>

                    <motion.div
                        initial={reduce ? false : "hidden"}
                        animate="show"
                        variants={fade}
                        className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
                    >
                        <Link
                            href="/rendez-vous"
                            className="group inline-flex items-center gap-2.5 rounded-full bg-[#008751] px-7 py-4 font-geist text-[15px] font-semibold text-white shadow-[0_16px_40px_-14px_rgba(0,135,81,0.6)] transition-all hover:bg-[#00693f] active:scale-[0.98]"
                        >
                            <CalendarBlank size={18} weight="bold" />
                            <T>Prendre rendez-vous</T>
                            <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
                        </Link>
                        <Link
                            href="/services"
                            className="group inline-flex items-center gap-2 font-geist text-[15px] font-semibold text-[#0d1a12] underline decoration-[#FCD116] decoration-2 underline-offset-[6px] transition-colors hover:text-[#008751]"
                        >
                            <T>Découvrir nos services</T>
                            <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
                        </Link>
                    </motion.div>
                </div>

                {/* ── Colonne image (Bénin, duotone vert-or) ── */}
                <motion.div
                    initial={reduce ? false : { opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                    className="relative"
                >
                    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.6rem] shadow-[0_40px_80px_-40px_rgba(13,26,18,0.4)] sm:aspect-[5/5] lg:aspect-[4/5]">
                        <Image
                            src="/images/hero-bg.jpg"
                            alt={t("Retour au Bénin")}
                            fill
                            priority
                            sizes="(max-width: 1024px) 100vw, 45vw"
                            className="object-cover"
                        />
                        {/* duotone léger vert-or pour la cohérence */}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#00432a]/45 via-[#008751]/10 to-[#FCD116]/20 mix-blend-multiply" />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d1a12]/30 to-transparent" />
                    </div>
                    {/* filet tricolore d'ancrage bas */}
                    <div className="absolute -bottom-3 left-8 right-8 flex h-1.5 overflow-hidden rounded-full shadow-lg">
                        <span className="flex-[46] bg-[#008751]" />
                        <span className="flex-[27] bg-[#FCD116]" />
                        <span className="flex-[27] bg-[#E8112D]" />
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
