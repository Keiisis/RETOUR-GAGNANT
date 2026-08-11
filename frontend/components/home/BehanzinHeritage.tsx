"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowRight } from "@phosphor-icons/react";
import { T } from "@/lib/translation";

// Canvas 3D chargé côté client uniquement, et seulement quand la section
// approche du viewport (cf. IntersectionObserver) → 0 coût au 1er paint.
const BehanzinWalk = dynamic(() => import("./BehanzinWalk"), { ssr: false });

/**
 * L'Héritage — section cinématique « Le Roi Béhanzin marche encore ».
 * Ouverture du chapitre patrimoine : le dernier roi indépendant du Dahomey
 * marche en boucle pendant qu'un léger travelling avant (scroll) rapproche
 * la caméra et que le récit se dévoile ligne par ligne.
 *
 * - h-[300vh] + intérieur sticky : 3 écrans de scroll pilotent le récit.
 * - Le Canvas est monté à la volée (IO) puis alimenté par un ref de scroll
 *   (progressRef) lu dans useFrame → aucune re-render React à chaque frame.
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

    // Monter le Canvas quand la section arrive à ~1 écran de distance.
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

    // Révélations séquentielles du récit (restent visibles une fois apparues).
    const l1 = useTransform(scrollYProgress, [0.08, 0.20], [0, 1]);
    const l1y = useTransform(scrollYProgress, [0.08, 0.20], [24, 0]);
    const l2 = useTransform(scrollYProgress, [0.30, 0.42], [0, 1]);
    const l2y = useTransform(scrollYProgress, [0.30, 0.42], [24, 0]);
    const l3 = useTransform(scrollYProgress, [0.52, 0.64], [0, 1]);
    const l3y = useTransform(scrollYProgress, [0.52, 0.64], [24, 0]);
    const cta = useTransform(scrollYProgress, [0.72, 0.84], [0, 1]);
    const ctay = useTransform(scrollYProgress, [0.72, 0.84], [24, 0]);
    // Halo « Porte du Retour » qui s'ouvre légèrement à l'approche.
    const arch = useTransform(scrollYProgress, [0, 1], [0.92, 1.12]);

    const st = (mv: unknown, fallback = 1) => (reduce ? fallback : (mv as never));

    return (
        <section ref={sectionRef} className="relative h-[300vh] bg-[#04140d]">
            <div className="sticky top-0 flex h-screen items-center overflow-hidden">
                {/* Fond : émeraude radial profond + voile tricolore + grain d'or */}
                <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(120% 90% at 50% 78%, #0a3b26 0%, #072a1b 42%, #04140d 78%)",
                    }}
                />
                {/* Arche « Porte du Retour » — cerne d'or diffus derrière la silhouette */}
                <motion.div
                    aria-hidden
                    className="absolute left-1/2 top-1/2 -z-0 h-[86vh] w-[52vh] -translate-x-1/2 -translate-y-1/2"
                    style={{
                        scale: st(arch, 1),
                        borderRadius: "50% 50% 8% 8% / 62% 62% 8% 8%",
                        border: "1.5px solid rgba(252,209,22,0.28)",
                        boxShadow:
                            "0 0 120px 20px rgba(0,135,81,0.28), inset 0 0 90px rgba(252,209,22,0.06)",
                        background:
                            "radial-gradient(60% 55% at 50% 45%, rgba(11,178,104,0.18), transparent 70%)",
                    }}
                />
                {/* Liseré tricolore vertical, discret */}
                <div
                    aria-hidden
                    className="absolute right-8 top-1/2 hidden h-40 w-[3px] -translate-y-1/2 rounded-full md:block"
                    style={{
                        background:
                            "linear-gradient(180deg,#008751 0 33%,#FCD116 33% 66%,#E8112D 66% 100%)",
                        opacity: 0.55,
                    }}
                />

                {/* Personnage 3D — pleine hauteur, centré */}
                <div className="absolute inset-0">
                    {mounted && <BehanzinWalk progressRef={progressRef} className="!h-full !w-full" />}
                </div>

                {/* Récit — colonne éditoriale à gauche */}
                <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-[1400px] px-6 md:px-10">
                    <div className="max-w-xl">
                        <p className="mb-5 font-geist text-[12px] font-semibold uppercase tracking-[0.32em] text-[#FCD116]">
                            <T>L&apos;Héritage</T>
                        </p>
                        <h2 className="font-fraunces text-4xl font-semibold leading-[1.04] tracking-[-0.02em] text-white md:text-6xl">
                            <T>Le Roi Béhanzin</T>{" "}
                            <span className="italic text-[#0bb268]">
                                <T>marche encore.</T>
                            </span>
                        </h2>

                        <div className="mt-8 space-y-5 font-geist text-lg leading-relaxed text-[#d7e4dd] md:text-xl">
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
                                className="font-medium text-white"
                            >
                                <T>
                                    Aujourd&apos;hui, ses enfants reviennent. Et vous êtes des
                                    leurs.
                                </T>
                            </motion.p>
                        </div>

                        <motion.div style={{ opacity: st(cta), y: st(ctay, 0) }} className="mt-10">
                            <Link
                                href="/patrimoine"
                                className="pointer-events-auto group inline-flex items-center gap-2 rounded-full border border-[#FCD116]/40 bg-[#FCD116]/5 px-6 py-3 font-geist text-[15px] font-semibold text-[#FCD116] backdrop-blur-sm transition-colors hover:bg-[#FCD116]/12"
                            >
                                <T>Découvrir notre patrimoine</T>
                                <ArrowRight
                                    size={16}
                                    weight="bold"
                                    className="transition-transform group-hover:translate-x-0.5"
                                />
                            </Link>
                        </motion.div>
                    </div>
                </div>

                {/* Dégradé bas pour ancrer les pieds dans le sol sombre */}
                <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#04140d] to-transparent"
                />
            </div>
        </section>
    );
}
