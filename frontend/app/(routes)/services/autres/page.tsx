'use client';

import { useEffect, useState } from 'react';
import { CaretRight as ChevronRight, Car, Heartbeat as HeartPulse, GraduationCap, FileText as FileCheck, Airplane as Plane, House as Home, Buildings as Building2, Stethoscope, BookOpen, Briefcase, Globe, MapTrifold as Map, Truck, Heart, GraduationCap as School, Clipboard, Icon as LucideIcon } from '@phosphor-icons/react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { T, useTranslation } from '@/lib/translation';

interface ServiceItem {
    icon: string;
    title: string;
    description: string;
}

interface PageContent {
    hero_title: string;
    hero_subtitle: string;
    services: ServiceItem[];
    cta_title: string;
    cta_description: string;
    cta_button_text: string;
}

const DEFAULT_CONTENT: PageContent = {
    hero_title: "Autres Services",
    hero_subtitle: "Transport, santé, éducation, démarches administratives — Découvrez tous nos services complémentaires pour faciliter votre installation au Bénin.",
    services: [
        { icon: "Car", title: "Transport & Logistique", description: "Transfert aéroport, location de véhicule avec chauffeur, organisation de déplacements interurbains." },
        { icon: "HeartPulse", title: "Santé", description: "Mise en relation avec des cliniques et médecins partenaires, accompagnement pour les soins et hospitalisations." },
        { icon: "GraduationCap", title: "Scolarité & Éducation", description: "Orientation et inscription dans des établissements scolaires francophones et internationaux au Bénin." },
        { icon: "FileCheck", title: "Démarches Administratives", description: "Assistance pour les demandes de visa, titres de séjour, regroupement familial et autres démarches officielles." },
    ],
    cta_title: "Un besoin spécifique ?",
    cta_description: "Contactez-nous pour discuter de votre situation. Nous évaluons chaque demande individuellement et vous orientons vers la meilleure solution.",
    cta_button_text: "Prendre rendez-vous",
};

const ICON_MAP: Record<string, LucideIcon> = {
    Car, HeartPulse, GraduationCap, FileCheck,
    Plane, Home, Building2, Stethoscope,
    BookOpen, Briefcase, Globe, Map,
    Truck, Heart, School, Clipboard,
};

export default function AutresServicesPage() {
    const { t } = useTranslation();
    const [content, setContent] = useState<PageContent>(DEFAULT_CONTENT);

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const { data } = await supabase
                    .from('page_sections')
                    .select('content')
                    .eq('page', 'autres-services')
                    .eq('section_key', 'page_content')
                    .eq('is_active', true)
                    .single();
                if (data?.content) {
                    setContent(prev => ({ ...prev, ...(data.content as Partial<PageContent>) }));
                }
            } catch {
                // fallback to defaults
            }
        };
        fetchContent();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Banner */}
            <section className="relative py-20 bg-gradient-to-br from-[#0f141e] via-[#1a2a3a] to-[#0f141e] text-white overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 right-20 w-64 h-64 rounded-full blur-[100px] bg-white" />
                </div>
                <div className="container mx-auto px-4 relative z-10">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-sm text-white/50 mb-8 flex-wrap">
                        <Link href="/" className="hover:text-white/80 transition-colors"><T>Accueil</T></Link>
                        <ChevronRight size={14} />
                        <Link href="/services" className="hover:text-white/80 transition-colors"><T>Services</T></Link>
                        <ChevronRight size={14} />
                        <span className="text-white/80"><T>Autres Services</T></span>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-4xl flex flex-col md:flex-row items-center gap-8"
                    >
                        <div className="shrink-0 drop-shadow-[0_0_30px_rgba(252,209,22,0.4)]">
                            <div className="w-32 h-32 md:w-40 md:h-40 flex items-center justify-center relative">
                                <Image
                                    src="/assets/icones/Autres Services.png"
                                    alt="Autres Services"
                                    fill
                                    className="object-contain bg-transparent drop-shadow-[0_15px_35px_rgba(0,0,0,0.4)]"
                                    sizes="160px"
                                />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-bold font-heading mb-4">
                                {t(content.hero_title)}
                            </h1>
                            <p className="text-xl text-white/70">
                                {t(content.hero_subtitle)}
                            </p>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Services Grid */}
            <section className="py-16">
                <div className="container mx-auto px-4 max-w-5xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {content.services.map((service, i) => {
                            const IconComponent = ICON_MAP[service.icon] || FileCheck;
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 + i * 0.07 }}
                                    className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-[#008751]/30 hover:shadow-md transition-all duration-300 group"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="shrink-0 w-12 h-12 rounded-xl bg-[#008751]/10 flex items-center justify-center group-hover:bg-[#008751]/20 transition-colors">
                                            <IconComponent className="text-[#008751]" size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-[#1a2332] mb-2 group-hover:text-[#008751] transition-colors">
                                                {t(service.title)}
                                            </h3>
                                            <p className="text-gray-600 text-sm leading-relaxed">
                                                {t(service.description)}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* CTA */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="mt-12 text-center bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
                    >
                        <h2 className="text-2xl font-bold text-[#1a2332] mb-3">
                            {t(content.cta_title)}
                        </h2>
                        <p className="text-gray-600 mb-6 max-w-xl mx-auto">
                            {t(content.cta_description)}
                        </p>
                        <Link href="/rendez-vous?service=autres">
                            <button type="button" className="px-8 py-3 bg-[#008751] text-white font-bold rounded-full hover:bg-[#006e42] transition-colors shadow-md hover:shadow-lg">
                                {t(content.cta_button_text)}
                            </button>
                        </Link>
                    </motion.div>
                </div>
            </section>
        </div>
    );
}
