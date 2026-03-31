"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/lib/translation";

export default function AboutUsSection() {
    const { t } = useTranslation();
    const [content, setContent] = useState({
        video: "/videos/logo animé.mp4",
        title: "L'Excellence au Service de vos Racines",
        text: "Depuis la création de Retour Gagnant Bénin, notre mission a toujours été limpide : être le pont de confiance exclusif entre la diaspora et la terre de ses racines.\n\nNous comprenons intimement les défis, les doutes et les frustrations qui accompagnent la volonté de s'investir, de construire ou de revenir au pays. C'est pourquoi nous avons forgé un écosystème de services sur-mesure, alliant la rigueur des standards internationaux à une maîtrise parfaite des réalités locales.\n\nQu'il s'agisse d'acquérir de l'immobilier en toute sécurité, d'initier une fondation économique, de raviver votre patrimoine, ou d'établir des connexions administratives solides, notre équipe d'experts s'engage à faire de vos ambitions, une réalité tangible et sereine."
    });

    useEffect(() => {
        const fetchContent = async () => {
            const { data, error } = await supabase
                .from('settings')
                .select('key, value')
                .in('key', ['about_us_video', 'about_us_title', 'about_us_text']);

            if (data && !error) {
                setContent(prev => {
                    const next = { ...prev };
                    data.forEach(item => {
                        if (item.key === 'about_us_video' && item.value) next.video = item.value;
                        if (item.key === 'about_us_title' && item.value) next.title = item.value;
                        if (item.key === 'about_us_text' && item.value) next.text = item.value;
                    });
                    return next;
                });
            }
        };

        fetchContent();

        const channel = supabase
            .channel('about_us_settings')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' }, fetchContent)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Split text into paragraphs
    const paragraphs = content.text.split('\n').filter(p => p.trim() !== '');

    return (
        <section className="relative py-24 md:py-32 bg-white overflow-hidden" id="qui-sommes-nous">
            {/* Soft Background elements for white theme */}
            <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-[#008751]/5 rounded-full blur-[100px]" />
                <div className="absolute top-1/2 -left-1/4 w-1/2 h-1/2 bg-[#FCD116]/5 rounded-full blur-[100px]" />
                <div className="absolute -bottom-1/4 right-1/4 w-1/2 h-1/2 bg-[#E8112D]/5 rounded-full blur-[100px]" />
            </div>

            <div className="container relative z-10 mx-auto px-4 max-w-7xl">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
                    
                    {/* LEFT COLUMN: Video & Logo Title */}
                    <div className="flex flex-col items-center lg:items-start order-2 lg:order-1">
                        
                        {/* Video Container */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, x: -30 }}
                            whileInView={{ opacity: 1, scale: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
                            className="w-full aspect-video relative rounded-[2rem] overflow-hidden shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] border border-gray-100 mb-8 group bg-gray-50"
                        >
                            {/* Glow effect behind video adapted for light theme */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-[#008751]/10 via-[#FCD116]/10 to-[#E8112D]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 z-0" />
                            
                            <video 
                                src={content.video} 
                                autoPlay 
                                loop 
                                muted 
                                playsInline 
                                className="w-full h-full object-cover relative z-10 opacity-95 group-hover:opacity-100 transition-opacity duration-700" 
                            />
                            
                            {/* Subtle inner shadow instead of dark vignette */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.05)_100%)] pointer-events-none z-20" />
                        </motion.div>

                        {/* Logo Title (RETOUR GAGNANT BENIN) */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="w-full text-center lg:text-left"
                        >
                            <h2 className="text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-black font-heading tracking-tight sm:tracking-tighter flex flex-wrap justify-center lg:justify-start gap-x-3 gap-y-2">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008751] to-[#00b06a]">
                                    RETOUR
                                </span>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#e6be10]">
                                    GAGNANT
                                </span>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E8112D] to-[#ff3b56]">
                                    BÉNIN
                                </span>
                            </h2>
                        </motion.div>
                    </div>

                    {/* RIGHT COLUMN: Badge, Title & Text */}
                    <div className="flex flex-col items-center lg:items-start order-1 lg:order-2">
                        
                        {/* Header Label */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-gray-50 border border-gray-100 text-gray-600 text-[11px] font-black tracking-[0.2em] uppercase mb-8 shadow-sm"
                        >
                            {t("Qui sommes-nous")}
                        </motion.div>

                        {/* White Theme Story / Copywriting Container */}
                        <div className="w-full relative">
                            {/* Quote icon overlay - light theme */}
                            <div className="absolute -top-10 -left-6 text-[140px] font-serif text-gray-100 leading-none select-none pointer-events-none z-0">
                                &quot;
                            </div>

                            <motion.h3 
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8 }}
                                className="text-3xl md:text-4xl lg:text-5xl font-black font-heading text-gray-900 mb-8 text-center lg:text-left leading-tight relative z-10"
                            >
                                {t(content.title)}
                            </motion.h3>

                            <div className="space-y-6 text-base md:text-lg text-gray-600 leading-relaxed font-medium relative z-10">
                                {paragraphs.map((para, idx) => (
                                    <motion.p 
                                        key={idx}
                                        initial={{ opacity: 0, y: 15 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.6, delay: 0.2 + (idx * 0.1) }}
                                        className="text-center lg:text-left text-balance"
                                    >
                                        {t(para)}
                                    </motion.p>
                                ))}
                            </div>

                            {/* Divider Line */}
                            <motion.div 
                                initial={{ scaleX: 0 }}
                                whileInView={{ scaleX: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 1, delay: 0.6 }}
                                className="w-full h-px bg-gradient-to-r from-gray-200 via-gray-300 to-transparent mt-12 mb-8 origin-left"
                            />

                            {/* Signature or closing mark */}
                            <motion.div 
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8, delay: 0.8 }}
                                className="flex justify-center lg:justify-start items-center gap-4"
                            >
                                <div className="w-2.5 h-2.5 rounded-full bg-[#008751] shadow-[0_0_10px_rgba(0,135,81,0.5)]" />
                                <div className="w-2.5 h-2.5 rounded-full bg-[#FCD116] shadow-[0_0_10px_rgba(252,209,22,0.5)]" />
                                <div className="w-2.5 h-2.5 rounded-full bg-[#E8112D] shadow-[0_0_10px_rgba(232,17,45,0.5)]" />
                            </motion.div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
