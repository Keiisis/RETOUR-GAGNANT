"use client";

import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GoldenIcon } from "@/components/ui/GoldenIcon";
import { supabase } from "@/lib/supabase";
import { useTranslation, T } from "@/lib/translation";

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

export default function ProcessSteps() {
    const { t } = useTranslation();
    const reduce = useReducedMotion();
    const [steps, setSteps] = useState<Step[]>(fallbackSteps);

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
        <section className="bg-[#FBFAF7] py-20 md:py-28">
            <div className="mx-auto max-w-[1400px] px-5 md:px-8">
                <div className="mb-16 max-w-2xl">
                    <h2 className="font-fraunces text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-[#0d1a12] md:text-5xl">
                        <T>Un parcours en quatre temps.</T>
                    </h2>
                    <p className="mt-4 font-geist text-lg leading-relaxed text-[#4a5751]">
                        <T>De la première conversation à la remise des clés, vous savez toujours où vous en êtes.</T>
                    </p>
                </div>

                <div className="relative">
                    {/* ligne de liaison */}
                    <span aria-hidden className="absolute left-[12%] right-[12%] top-11 hidden h-px bg-[#e2ded3] md:block" />
                    <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 md:grid-cols-4">
                        {steps.map((step, i) => (
                            <motion.div
                                key={step.id}
                                initial={reduce ? false : { opacity: 0, y: 22 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.4 }}
                                transition={{ duration: 0.6, delay: (i % 4) * 0.08, ease: [0.16, 1, 0.3, 1] }}
                                className="relative flex flex-col items-center text-center"
                            >
                                <div className="relative z-10 flex h-[88px] w-[88px] items-center justify-center rounded-full border border-[#ece9e0] bg-white shadow-[0_14px_30px_-16px_rgba(13,26,18,0.35)]">
                                    {/* @ts-ignore GoldenIcon accepte un type union, ici string dynamique */}
                                    <GoldenIcon type={step.icon_type} size={34} />
                                    <span className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#008751] font-geistmono text-xs font-semibold text-white shadow">
                                        {i + 1}
                                    </span>
                                </div>
                                <h3 className="mt-6 font-fraunces text-xl font-semibold text-[#0d1a12]">{t(step.title)}</h3>
                                <p className="mt-2 max-w-[26ch] font-geist text-[14px] leading-relaxed text-[#6b756e]">{t(step.description)}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
