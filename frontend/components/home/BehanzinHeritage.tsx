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
 * L'Héritage : « Le Roi Béhanzin marche encore ».
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

    // ── Récit en « beats » cinématiques (fondu enchaîné) ──────────
    // Chaque beat apparaît, se tient, puis s'efface pendant que le suivant
    // monte : un seul visible à la fois, comme un générique sur le roi qui
    // marche. Permet un texte long et émouvant sans jamais surcharger l'écran
    // (essentiel sur mobile). Le bloc final (ligne de clôture + cartel + CTA)
    // reste, lui, affiché jusqu'au bout.
    const b1o = useTransform(scrollYProgress, [0.05, 0.10, 0.16, 0.21], [0, 1, 1, 0]);
    const b1y = useTransform(scrollYProgress, [0.05, 0.10], [20, 0]);
    const b2o = useTransform(scrollYProgress, [0.19, 0.24, 0.30, 0.35], [0, 1, 1, 0]);
    const b2y = useTransform(scrollYProgress, [0.19, 0.24], [20, 0]);
    const b3o = useTransform(scrollYProgress, [0.33, 0.38, 0.44, 0.49], [0, 1, 1, 0]);
    const b3y = useTransform(scrollYProgress, [0.33, 0.38], [20, 0]);
    const b4o = useTransform(scrollYProgress, [0.47, 0.52, 0.58, 0.63], [0, 1, 1, 0]);
    const b4y = useTransform(scrollYProgress, [0.47, 0.52], [20, 0]);
    const b5o = useTransform(scrollYProgress, [0.61, 0.66, 0.72, 0.77], [0, 1, 1, 0]);
    const b5y = useTransform(scrollYProgress, [0.61, 0.66], [20, 0]);
    const beats = [
        { o: b1o, y: b1y }, { o: b2o, y: b2y }, { o: b3o, y: b3y },
        { o: b4o, y: b4y }, { o: b5o, y: b5y },
    ];
    const finalO = useTransform(scrollYProgress, [0.80, 0.88], [0, 1]);
    const finalY = useTransform(scrollYProgress, [0.80, 0.88], [20, 0]);
    // Filigrane « DAHOMEY » qui dérive lentement (parallaxe discrète).
    const wordX = useTransform(scrollYProgress, [0, 1], [0, -60]);

    const st = (mv: unknown, fb = 1) => (reduce ? fb : (mv as never));

    // Texte du récit : expressif, incarné, factuel (Abomey, emblème du requin,
    // Amazones du Dahomey, exil Martinique puis Algérie, mort en 1906).
    const RECIT = [
        "À Abomey, il y a plus d'un siècle, un roi refusa de courber l'échine. Sous son emblème : le requin qui trouble les eaux : Béhanzin défia l'empire le plus puissant de son temps.",
        "À ses côtés, les Amazones du Dahomey combattirent jusqu'au dernier souffle. Pas pour un trône : pour une terre, une langue, une dignité que nul ne devait leur arracher.",
        "On finit par l'emmener loin des siens. Déporté au-delà des mers : la Martinique, puis l'Algérie : il s'éteignit en exil, le regard tourné vers le Bénin. Son corps partit. Jamais son âme.",
        "Comme lui, des millions d'enfants d'Afrique furent séparés de leur terre. Comme lui, ils n'ont jamais cessé de lui appartenir. Ce fil que l'exil n'a pas rompu, c'est le vôtre.",
        "Le jour où vous poserez le pied sur cette terre rouge, où l'on prononcera votre nom dans la langue de vos aïeux, vous le sentirez au fond de la poitrine : vous n'êtes pas un visiteur. Vous rentrez chez vous.",
    ];

    return (
        <section ref={sectionRef} className="relative h-[400vh] bg-white">
            <div className="sticky top-0 h-screen overflow-hidden">
                {/* Filigrane typographique : DAHOMEY, le royaume ancestral (bleed). */}
                <motion.span
                    aria-hidden
                    style={{ x: st(wordX, 0) }}
                    className="pointer-events-none absolute right-[-4vw] top-1/2 -translate-y-1/2 select-none font-fraunces text-[26vw] font-semibold leading-none tracking-[-0.03em] text-[#0d1a12] opacity-[0.035] md:text-[18vw]"
                >
                    DAHOMEY
                </motion.span>

                {/* Roi 3D : zone dédiée : desktop à droite, mobile en bas. */}
                <div className="absolute inset-x-0 bottom-0 h-[58%] md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[60%]">
                    {/* Cercle « Porte du Retour » : tracé PLAT (aucune lueur). */}
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

                {/* Colonne éditoriale : desktop à gauche, mobile en haut. */}
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

                        {/* ── Récit ──────────────────────────────────────────
                            Mouvement : beats en fondu enchaîné (un à la fois).
                            Reduced-motion : pile statique, tout lisible d'emblée. */}
                        {reduce ? (
                            <div className="mt-7 space-y-4 font-geist text-[1.02rem] leading-relaxed text-[#4a5751] md:text-lg">
                                {RECIT.map((txt, i) => (
                                    <p key={i} className={i === 4 ? 'font-medium text-[#0d1a12]' : ''}>
                                        <T>{txt}</T>
                                    </p>
                                ))}
                                <p className="pt-2 font-fraunces text-xl italic leading-snug text-[#008751]">
                                    <T>Béhanzin marche encore : dans chacun de ses enfants qui revient.</T>{" "}
                                    <span className="not-italic font-medium text-[#0d1a12]"><T>Et vous êtes des leurs.</T></span>
                                </p>
                                <ChronoCta />
                            </div>
                        ) : (
                            <div className="relative mt-7 min-h-[48vh] md:min-h-[19rem]">
                                {beats.map((b, i) => (
                                    <motion.p
                                        key={i}
                                        style={{ opacity: b.o, y: b.y }}
                                        className={`absolute inset-x-0 top-0 font-geist text-[1.08rem] leading-relaxed md:text-xl ${i === 4 ? 'font-medium text-[#0d1a12]' : 'text-[#4a5751]'}`}
                                    >
                                        <T>{RECIT[i]}</T>
                                    </motion.p>
                                ))}
                                {/* Clôture persistante : ligne finale + cartel + CTA */}
                                <motion.div style={{ opacity: finalO, y: finalY }} className="absolute inset-x-0 top-0">
                                    <p className="font-fraunces text-2xl italic leading-snug text-[#008751] md:text-[1.9rem]">
                                        <T>Béhanzin marche encore : dans chacun de ses enfants qui revient.</T>{" "}
                                        <span className="not-italic font-medium text-[#0d1a12]"><T>Et vous êtes des leurs.</T></span>
                                    </p>
                                    <ChronoCta />
                                </motion.div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

/** Cartel chronologique RÉEL + appel à l'action patrimoine. */
function ChronoCta() {
    return (
        <>
            <dl className="mt-7 grid grid-cols-3 gap-x-6 gap-y-3 border-t border-[#E7E2D6] pt-5 font-geist">
                {[
                    ["Titre", "Roi du Dahomey"],
                    ["Règne", "1889 – 1894"],
                    ["Exil", "1894 – 1906"],
                ].map(([k, v]) => (
                    <div key={k}>
                        <dt className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[#9A7B2E]">
                            <T>{k}</T>
                        </dt>
                        <dd className="mt-1 text-[13px] font-medium text-[#0d1a12] md:text-[13.5px]">{v}</dd>
                    </div>
                ))}
            </dl>
            <Link
                href="/patrimoine"
                className="group mt-7 inline-flex items-center gap-2 font-geist text-[15px] font-semibold text-[#0d1a12] underline decoration-[#FCD116] decoration-2 underline-offset-[6px] transition-colors hover:text-[#008751]"
            >
                <T>Découvrir notre patrimoine</T>
                <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
            </Link>
        </>
    );
}
