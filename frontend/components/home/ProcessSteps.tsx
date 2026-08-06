"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useSpring, useTransform, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion";
import Step3DIcon, { type StepKind } from "@/components/home/Step3DIcon";
import { supabase } from "@/lib/supabase";
import { useTranslation, T } from "@/lib/translation";

const KINDS: StepKind[] = ["contact", "plan", "build", "install"];

interface Step {
    id: number;
    title: string;
    description: string;
    icon_type: string;
    order: number;
}

const fallbackSteps: Step[] = [
    { id: 1, title: "Prise de contact", description: "Échange initial pour comprendre votre projet de retour.", icon_type: "cowrie", order: 1 },
    { id: 2, title: "Planification", description: "Stratégie sur-mesure et feuille de route claire.", icon_type: "recade", order: 2 },
    { id: 3, title: "Mise en œuvre", description: "Lancement des procédures administratives et logistiques.", icon_type: "drum", order: 3 },
    { id: 4, title: "Installation", description: "Accueil à Cotonou et remise des clés et documents.", icon_type: "tata", order: 4 },
];

const SPAN = 0.82;

function StepNode({ step, i, count, progress, reduce }: { step: Step; i: number; count: number; progress: MotionValue<number>; reduce: boolean }) {
    const { t } = useTranslation();
    const seg = SPAN / count;
    const s = i * seg;
    const opacity = useTransform(progress, [s, s + 0.12], [0, 1]);
    const y = useTransform(progress, [s, s + 0.18], [26, 0]);
    const scale = useTransform(progress, [s, s + 0.2], [0.7, 1]);
    const flip = useTransform(progress, [s, s + 0.24], [-95, 0]); // atterrissage 3D de l'icône
    const badge = useTransform(progress, [s + 0.05, s + 0.2], [0, 1]);
    const ring = useTransform(progress, [s, s + 0.08, s + 0.28], [0, 0.6, 0]);

    // Parallaxe à la souris (desktop) — lissée par ressort.
    const mx = useMotionValue(0);
    const my = useMotionValue(0);
    const rotY = useSpring(mx, { stiffness: 150, damping: 14, mass: 0.3 });
    const rotX = useSpring(my, { stiffness: 150, damping: 14, mass: 0.3 });
    const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width - 0.5) * 16);
        my.set(-((e.clientY - r.top) / r.height - 0.5) * 16);
    };
    const onLeave = () => { mx.set(0); my.set(0); };

    return (
        <motion.div
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            style={reduce ? {} : { opacity, y, rotateX: rotX, rotateY: rotY, transformPerspective: 900 }}
            className="relative flex flex-col items-center text-center [transform-style:preserve-3d]"
        >
            <div className="relative" style={{ perspective: 700 }}>
                <motion.div
                    style={reduce ? {} : { scale, rotateY: flip }}
                    className="relative z-10 flex h-[92px] w-[92px] items-center justify-center rounded-full border border-[#ece9e0] bg-white shadow-[0_20px_38px_-18px_rgba(13,26,18,0.45)]"
                >
                    <Step3DIcon kind={KINDS[i] ?? "build"} />
                    {!reduce && <motion.span style={{ opacity: ring }} className="pointer-events-none absolute inset-[-7px] rounded-full ring-2 ring-[#008751]" />}
                    <motion.span
                        style={reduce ? {} : { scale: badge }}
                        className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#008751] font-geistmono text-xs font-semibold text-white shadow"
                    >
                        {i + 1}
                    </motion.span>
                </motion.div>
            </div>
            <h3 className="mt-6 font-fraunces text-xl font-semibold text-[#0d1a12]">{t(step.title)}</h3>
            <p className="mt-2 max-w-[26ch] font-geist text-[14px] leading-relaxed text-[#6b756e]">{t(step.description)}</p>
        </motion.div>
    );
}

export default function ProcessSteps() {
    const reduce = useReducedMotion() ?? false;
    const [steps, setSteps] = useState<Step[]>(fallbackSteps);
    const ref = useRef<HTMLDivElement>(null);

    const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.5"] });
    const progress = useSpring(scrollYProgress, { stiffness: 70, damping: 20, mass: 0.45, restDelta: 0.0005 });
    const lineWidth = useTransform(progress, [0, SPAN], ["0%", "100%"]);
    const dotOpacity = useTransform(progress, [0, 0.04, SPAN - 0.02, SPAN], [0, 1, 1, 0]);

    useEffect(() => {
        const fetchSteps = async () => {
            try {
                const { data, error } = await supabase
                    .from("process_steps")
                    .select("*")
                    .eq("is_active", true)
                    .order("order", { ascending: true });
                if (!error && data && data.length > 0) {
                    setSteps(
                        data.map((item: Record<string, unknown>) => ({
                            id: Number(item.id),
                            title: String(item.title),
                            description: String(item.description),
                            icon_type: String(item.icon_type) || "cowrie",
                            order: Number(item.order),
                        })),
                    );
                }
            } catch {
                // fallback conservé
            }
        };
        fetchSteps();
    }, []);

    return (
        <section className="relative overflow-hidden bg-[#FBFAF7] py-20 md:py-28">
            {/* fond mesh clair + halos */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="absolute left-[6%] top-8 h-80 w-80 rounded-full bg-[#008751]/[0.06] blur-[120px]" />
                <div className="absolute right-[10%] bottom-2 h-72 w-72 rounded-full bg-[#FCD116]/[0.10] blur-[120px]" />
                <div className="absolute left-1/2 top-1/2 h-64 w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0a9d63]/[0.04] blur-[130px]" />
            </div>

            <div ref={ref} className="relative mx-auto max-w-[1400px] px-5 md:px-8">
                <div className="mb-16 max-w-2xl">
                    <h2 className="font-fraunces text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-[#0d1a12] md:text-5xl">
                        <T>Un parcours en quatre temps.</T>
                    </h2>
                    <p className="mt-4 font-geist text-lg leading-relaxed text-[#4a5751]">
                        <T>De la première conversation à la remise des clés, vous savez toujours où vous en êtes.</T>
                    </p>
                </div>

                <div className="relative">
                    {/* ligne vivante : base grise + remplissage vert lumineux + point qui file */}
                    <div className="absolute left-[12%] right-[12%] top-[46px] hidden h-[2px] rounded-full bg-[#e2ded3] md:block">
                        <motion.span
                            style={{ width: reduce ? "100%" : lineWidth }}
                            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#008751] to-[#0fbf7a] shadow-[0_0_12px_rgba(0,135,81,0.55)]"
                        />
                        {!reduce && (
                            <motion.span
                                style={{ left: lineWidth, opacity: dotOpacity }}
                                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FCD116] shadow-[0_0_16px_5px_rgba(252,209,22,0.7)]"
                            />
                        )}
                    </div>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 md:grid-cols-4" style={{ perspective: 1200 }}>
                        {steps.map((step, i) => (
                            <StepNode key={step.id} step={step} i={i} count={steps.length} progress={progress} reduce={reduce} />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
