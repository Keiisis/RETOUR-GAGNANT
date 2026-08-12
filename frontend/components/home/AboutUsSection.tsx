"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useTranslation, T } from "@/lib/translation";

/**
 * Qui sommes-nous : éditorial image + prose, un seul message. Palette claire.
 * Contenu (titre/texte/vidéo) éditable via `settings`. Sans blobs, sans titre
 * en dégradé, sans pastilles décoratives (anti-slop).
 */
export default function AboutUsSection() {
    const { t } = useTranslation();
    const reduce = useReducedMotion();
    const [content, setContent] = useState({
        video: "/videos/logo animé.mp4",
        title: "Le pont de confiance entre la diaspora et sa terre.",
        text: "Depuis la création de Retour Gagnant Bénin, notre mission est limpide : rendre votre retour simple, sûr et serein.\n\nNous connaissons les doutes qui accompagnent l'envie de revenir, construire ou investir au pays. Nous avons donc bâti un écosystème de services sur-mesure, alliant standards internationaux et maîtrise fine des réalités locales.\n\nImmobilier sécurisé, création d'entreprise, patrimoine, démarches administratives : notre équipe transforme vos ambitions en réalités tangibles.",
    });

    useEffect(() => {
        const fetchContent = async () => {
            const { data, error } = await supabase
                .from("settings")
                .select("key, value")
                .in("key", ["about_us_video", "about_us_title", "about_us_text"]);
            if (data && !error) {
                setContent((prev) => {
                    const next = { ...prev };
                    data.forEach((item) => {
                        if (item.key === "about_us_video" && item.value) next.video = item.value;
                        if (item.key === "about_us_title" && item.value) next.title = item.value;
                        if (item.key === "about_us_text" && item.value) next.text = item.value;
                    });
                    return next;
                });
            }
        };
        fetchContent();
        const channel = supabase
            .channel("about_us_settings")
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, fetchContent)
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const paragraphs = content.text.split("\n").filter((p) => p.trim() !== "");

    return (
        <section id="qui-sommes-nous" className="bg-white py-20 md:py-28">
            <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-12 px-5 md:px-8 lg:grid-cols-2 lg:gap-20">
                {/* Média éditable */}
                <motion.div
                    initial={reduce ? false : { opacity: 0, y: 26 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="relative order-2 lg:order-1"
                >
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.6rem] border border-[#ece9e0] bg-[#f6f4ee] shadow-[0_36px_70px_-40px_rgba(13,26,18,0.35)]">
                        <video src={content.video} autoPlay loop muted playsInline className="h-full w-full object-cover" />
                    </div>
                </motion.div>

                {/* Prose */}
                <div className="order-1 lg:order-2">
                    <motion.h2
                        initial={reduce ? false : { opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.4 }}
                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                        className="max-w-xl font-fraunces text-4xl font-semibold leading-[1.06] tracking-[-0.02em] text-[#0d1a12] md:text-[3.1rem]"
                    >
                        {t(content.title)}
                    </motion.h2>
                    <div className="mt-7 max-w-[60ch] space-y-5 font-geist text-[17px] leading-relaxed text-[#4a5751]">
                        {paragraphs.map((para, idx) => (
                            <motion.p
                                key={idx}
                                initial={reduce ? false : { opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.5 }}
                                transition={{ duration: 0.6, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                            >
                                {t(para)}
                            </motion.p>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
