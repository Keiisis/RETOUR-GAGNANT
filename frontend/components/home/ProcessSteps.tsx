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
        <section className="bg-white py-20 md:py-28">
            <div className="mx-auto max-w-[1400px] px-5 md:px-8">
                <div className="mb-14 max-w-2xl">
                    <h2 className="font-fraunces text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-[#0d1a12] md:text-5xl">
                        <T>Un parcours en quatre temps.</T>
                    </h2>
                    <p className="mt-4 font-geist text-lg leading-relaxed text-[#4a5751]">
                        <T>De la première conversation à la remise des clés, vous savez toujours où vous en êtes.</T>
                    </p>
                </div>

                <ol className="relative mx-auto max-w-3xl">
                    {/* rail vertical */}
                    <span aria-hidden className="absolute left-[27px] top-2 bottom-2 w-px bg-[#e7e4db] md:left-[31px]" />
                    {steps.map((step, i) => (
                        <motion.li
                            key={step.id}
                            initial={reduce ? false : { opacity: 0, x: 18 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, amount: 0.6 }}
                            transition={{ duration: 0.6, delay: (i % 4) * 0.06, ease: [0.16, 1, 0.3, 1] }}
                            className="relative flex gap-6 pb-12 last:pb-0 md:gap-8"
                        >
                            <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#ece9e0] bg-[#FBFAF7] shadow-sm md:h-16 md:w-16">
                                {/* @ts-ignore GoldenIcon accepte un type union, ici string dynamique */}
                                <GoldenIcon type={step.icon_type} size={26} />
                            </div>
                            <div className="pt-1.5">
                                <span className="font-geistmono text-xs font-medium tracking-widest text-[#c0a53a]">
                                    {String(i + 1).padStart(2, "0")}
                                </span>
                                <h3 className="mt-1 font-fraunces text-2xl font-semibold text-[#0d1a12]">{t(step.title)}</h3>
                                <p className="mt-2 max-w-md font-geist text-[15px] leading-relaxed text-[#6b756e]">{t(step.description)}</p>
                            </div>
                        </motion.li>
                    ))}
                </ol>
            </div>
        </section>
    );
}
