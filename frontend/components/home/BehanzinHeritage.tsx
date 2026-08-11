"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowRight } from "@phosphor-icons/react";
import { T } from "@/lib/translation";

// Canvas 3D chargé côté client uniquement, monté à la volée (IO) → 0 coût 1er paint.
const BehanzinWalk = dynamic(() => import("./BehanzinWalk"), { ssr: false });

/**
 * L'Héritage — « Le Roi Béhanzin marche encore ».
 * Parti pris ANTI-AI-SLOP : fond BLANC, traitement éditorial façon exposition
 * de musée (aucun dégradé/halo/glow). La mémorabilité vient de la typographie
 * (Fraunces géant en filigrane), d'une chronologie RÉELLE en cartel, et d'un
 * cercle « Porte du Retour » tracé plat (pas de lueur). Le roi marche sur une
 * scène blanche, ancré par une ombre portée réelle.
 *
 * - h-[300vh] + intérieur sticky : 3 écrans de scroll pilotent caméra + récit.
 * - Layout responsive : desktop = texte à gauche / roi à droite ; mobile = texte
 *   en haut / roi en bas (plus aucun chevauchement).
 * - prefers-reduced-motion : pose figée, texte affiché d'emblée.
 */
export default function BehanzinHeritage() {
    const sectionRef = useRef<HTMLElement>(null);
    const progressRef = useRef(0);
    const [mounted, setMounted] = useState(false);
    const reduce = useReducedMotion() ?? false;

    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start start", "end end"],
    });

    useEffect(() => {
        const unsub = scrollYProgress.on("change", (v) => {
            progressRef.current = v;
        });
        return () => unsub();
    }, [scrollYProgress]);

    useEffect(() => {
        const el = sectionRef.current;
        if (!el) return;
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    setMounted(true);
                    io.disconnect();
                }
            },
            { rootMargin: "600px 0px" }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    // Révélations séquentielles (restent visibles une fois apparues).
    const l1 = useTransform(scrollYProgress, [0.08, 0.19], [0, 1]);
    const l1y = useTransform(scrollYProgress, [0.08, 0.19], [22, 0]);
    const l2 = useTransform(scrollYProgress, [0.26, 0.37], [0, 1]);
    const l2y = useTransform(scrollYProgress, [0.26, 0.37], [22, 0]);
    const l3 = useTransform(scrollYProgress, [0.44, 0.55], [0, 1]);
    const l3y = useTransform(scrollYProgress, [0.44, 0.55], [22, 0]);
    const plaque = useTransform(scrollYProgress, [0.60, 0.70], [0, 1]);
    const cta = useTransform(scrollYProgress, [0.74, 0.84], [0, 1]);
    const ctay = useTransform(scrollYProgress, [0.74, 0.84], [18, 0]);
    // Filigrane « DAHOMEY » qui dérive lentement (parallaxe discrète).
    const wordX = useTransform(scrollYProgress, [0, 1], [0, -60]);

    const st = (mv: unknown, fb = 1) => (reduce ? fb : (mv as never));

    return (
        <section ref={sectionRef} className="relative h-[300vh] bg-white">
            <div className="sticky top-0 h-screen overflow-hidden">
                {/* Filigrane typographique — DAHOMEY, le royaume ancestral (bleed). */}
                <motion.span
                    aria-hidden
                    style={{ x: st(wordX, 0) }}
                    className="pointer-events-none absolute right-[-4vw] top-1/2 -translate-y-1/2 select-none font-fraunces text-[26vw] font-semibold leading-none tracking-[-0.03em] text-[#0d1a12] opacity-[0.035] md:text-[18vw]"
                >
                    DAHOMEY
                </motion.span>

                {/* Roi 3D — zone dédiée : desktop à droite, mobile en bas. */}
                <div className="absolute inset-x-0 bottom-0 h-[56%] md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[56%]">
                    {/* Cercle « Porte du Retour » — tracé PLAT (aucune lueur). */}
                    <div
                        aria-hidden
                        className="absolute left-1/2 top-1/2 aspect-square h-[80%] max-h-[62vh] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#9A7B2E]/35 md:h-[86%]"
                    />
                    <div
                        aria-hidden
                        className="absolute left-1/2 top-1/2 aspect-square h-[68%] max-h-[52vh] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#9A7B2E]/15 md:h-[72%]"
                    />
                    <div className="absolute inset-0">
                        {mounted && <BehanzinWalk progressRef={progressRef} className="!h-full !w-full" />}
                    </div>
                </div>

                {/* Colonne éditoriale — desktop à gauche, mobile en haut. */}
                <div className="absolute inset-x-0 top-0 px-6 pt-[calc(env(safe-area-inset-top)+5.5rem)] md:inset-y-0 md:right-auto md:left-0 md:flex md:w-[52%] md:items-center md:px-12 md:pt-0 lg:px-20">
                    <div className="max-w-xl">
                        <div className="mb-5 flex items-center gap-3">
                            <span className="h-px w-8 bg-[#9A7B2E]/50" />
                            <p className="font-geist text-[11.5px] font-semibold uppercase tracking-[0.34em] text-[#9A7B2E]">
                                <T>L&apos;Héritage</T>
                            </p>
                        </div>

                        <h2 className="font-fraunces text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.02em] text-[#0d1a12] sm:text-5xl md:text-6xl">
                            <T>Le Roi Béhanzin</T>{" "}
                            <span className="italic text-[#008751]">
                                <T>marche encore.</T>
                            </span>
                        </h2>

                        <div className="mt-7 space-y-4 font-geist text-[1.02rem] leading-relaxed text-[#4a5751] md:text-lg">
                            <motion.p style={{ opacity: st(l1), y: st(l1y, 0) }}>
                                <T>
                                    Dernier souverain indépendant du Dahomey, il refusa de plier
                                    devant l&apos;empire.
                                </T>
                            </motion.p>
                            <motion.p style={{ opacity: st(l2), y: st(l2y, 0) }}>
                                <T>
                                    On l&apos;exila de force, loin de sa terre — jamais de son
                                    peuple.
                                </T>
                            </motion.p>
                            <motion.p
                                style={{ opacity: st(l3), y: st(l3y, 0) }}
                                className="font-medium text-[#0d1a12]"
                            >
                                <T>
                                    Aujourd&apos;hui, ses enfants reviennent. Et vous êtes des
                                    leurs.
                                </T>
                            </motion.p>
                        </div>

                        {/* Cartel — chronologie RÉELLE (justifie la structure datée). */}
                        <motion.dl
                            style={{ opacity: st(plaque) }}
                            className="mt-8 hidden gap-x-8 gap-y-3 border-t border-[#E7E2D6] pt-5 font-geist sm:grid sm:grid-cols-[auto_auto_auto]"
                        >
                            {[
                                ["Titre", "Roi du Dahomey"],
                                ["Règne", "1889 – 1894"],
                                ["Exil", "1894 – 1906"],
                            ].map(([k, v]) => (
                                <div key={k}>
                                    <dt className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[#9A7B2E]">
                                        <T>{k}</T>
                                    </dt>
                                    <dd className="mt-1 text-[13.5px] font-medium text-[#0d1a12]">
                                        {v}
                                    </dd>
                                </div>
                            ))}
                        </motion.dl>

                        <motion.div style={{ opacity: st(cta), y: st(ctay, 0) }} className="mt-8">
                            <Link
                                href="/patrimoine"
                                className="group inline-flex items-center gap-2 font-geist text-[15px] font-semibold text-[#0d1a12] underline decoration-[#FCD116] decoration-2 underline-offset-[6px] transition-colors hover:text-[#008751]"
                            >
                                <T>Découvrir notre patrimoine</T>
                                <ArrowRight
                                    size={15}
                                    weight="bold"
                                    className="transition-transform group-hover:translate-x-0.5"
                                />
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
}
