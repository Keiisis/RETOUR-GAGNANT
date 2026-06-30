'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, FileText, Calendar, Archive, Database, Users } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { T, useTranslation } from '@/lib/translation';

interface PageContent {
    hero_title: string;
    hero_subtitle: string;
    description: string;
    documents: string[];
    documents_note: string;
    pricing_label: string;
    pricing_amount: string;
    cta_title: string;
    cta_description: string;
    cta_button_text: string;
}

const DEFAULT_CONTENT: PageContent = {
    hero_title: "Recherche Ancestrale",
    hero_subtitle: "Retrouvez la trace de ceux que l'histoire a effacés. Reconstruire sa lignée, c'est se réapproprier ce qui nous a été pris.",
    description: "Pour des millions de descendants de la diaspora africaine, une partie du plan de composition de famille a été délibérément effacée par la traite transatlantique. Retrouver l'ancêtre réduit en esclavage, c'est un acte de mémoire, de dignité et d'identité. Nous mobilisons des bases de données spécialisées, des archives officielles et des associations expertes pour reconstituer votre lignée jusqu'aux racines béninoises ou africaines — avec méthode, rigueur et profond respect pour l'histoire de votre famille.",
    documents: [
        "Extrait de naissance de vos deux parents (père et mère)",
        "Extrait de naissance ou de décès de vos grands-parents (côté paternel et côté maternel)",
        "Tout autre document disponible : acte de mariage, acte notarié, acte militaire ou certificat de décès de vos grands-parents et arrière-grands-parents",
    ],
    documents_note: "L'ensemble des pièces sont à transmettre par voie électronique — une démarche simple et sécurisée pour débuter votre recherche.",
    pricing_label: "Recherche complète — archives, bases de données & associations spécialisées",
    pricing_amount: "250 €",
    cta_title: "Prêt à entreprendre cette démarche ?",
    cta_description: "Chaque histoire mérite d'être retrouvée. Prenez rendez-vous avec nos experts pour débuter votre recherche ancestrale et renouer avec vos origines africaines.",
    cta_button_text: "Prendre rendez-vous",
};

const METHODS = [
    {
        icon: Archive,
        title: "Archives officielles",
        desc: "Consultation des registres paroissiaux, d'état civil, actes notariaux et archives coloniales françaises, américaines et caribéennes.",
        color: "#FCD116",
    },
    {
        icon: Database,
        title: "Bases de données spécialisées",
        desc: "Accès aux plateformes de référence : Slave Voyages, FamilySearch, Ancestry, et bases africaines spécialisées dans le Plan de composition de Famille diasporique.",
        color: "#008751",
    },
    {
        icon: Users,
        title: "Associations expertes",
        desc: "Partenariats avec des associations spécialisées dans le Plan de composition de Famille afro-descendant et la recherche de racines africaines.",
        color: "#E8112D",
    },
];

export default function RechercheAncestralePage() {
    const { t } = useTranslation();
    const [content, setContent] = useState<PageContent>(DEFAULT_CONTENT);

    useEffect(() => {
        supabase
            .from('page_sections')
            .select('content')
            .eq('page', 'recherche-ancestrale')
            .eq('section_key', 'page_content')
            .eq('is_active', true)
            .single()
            .then(({ data }) => {
                if (data?.content) setContent(prev => ({ ...prev, ...(data.content as Partial<PageContent>) }));
            });
    }, []);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero */}
            <section className="relative py-20 bg-gradient-to-br from-[#0f141e] via-[#1a2a3a] to-[#0f141e] text-white overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 right-20 w-64 h-64 rounded-full blur-[100px] bg-[#FCD116]" />
                    <div className="absolute bottom-10 left-20 w-48 h-48 rounded-full blur-[80px] bg-[#008751]" />
                </div>

                <div className="container mx-auto px-4 relative z-10">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-sm text-white/50 mb-8 flex-wrap">
                        <Link href="/" className="hover:text-white/80 transition-colors"><T>Accueil</T></Link>
                        <ChevronRight size={14} />
                        <Link href="/services" className="hover:text-white/80 transition-colors"><T>Services</T></Link>
                        <ChevronRight size={14} />
                        <span className="text-[#FCD116]"><T>Recherche Ancestrale</T></span>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-4xl flex flex-col md:flex-row items-center gap-8"
                    >
                        <div className="shrink-0 drop-shadow-[0_0_30px_rgba(252,209,22,0.4)]">
                            <motion.div
                                className="w-32 h-32 md:w-40 md:h-40 flex items-center justify-center relative"
                                animate={{ y: [0, -15, 0], rotate: [0, 4, -4, 0] }}
                                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <Image
                                    src="/assets/icones/Recherche Ancestrale.png"
                                    alt="Recherche Ancestrale"
                                    fill
                                    className="object-contain bg-transparent drop-shadow-[0_15px_35px_rgba(0,0,0,0.4)]"
                                    sizes="160px"
                                />
                            </motion.div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[#FCD116]/70">
                                    Diaspora · Plan de composition de Famille · Identité
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold font-heading mb-4">
                                {t(content.hero_title)}
                            </h1>
                            <p className="text-xl text-white/70 leading-relaxed">
                                {t(content.hero_subtitle)}
                            </p>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Description + Méthodes */}
            <section className="py-16 bg-white">
                <div className="container mx-auto px-4 max-w-4xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mb-12"
                    >
                        <h2 className="text-2xl font-bold text-[#1a2332] mb-6 flex items-center gap-3">
                            <span className="w-8 h-0.5 bg-[#FCD116] shrink-0" />
                            <T>Une démarche de mémoire et d'identité</T>
                        </h2>
                        <p className="text-gray-600 leading-relaxed text-lg">
                            {t(content.description)}
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {METHODS.map((method, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + i * 0.1 }}
                                className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-[#FCD116]/40 hover:shadow-md transition-all group"
                            >
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                                    style={{ backgroundColor: method.color + '18', border: `1px solid ${method.color}35` }}
                                >
                                    <method.icon size={22} style={{ color: method.color }} />
                                </div>
                                <h3 className="font-bold text-[#1a2332] mb-2 group-hover:text-[#008751] transition-colors">
                                    {t(method.title)}
                                </h3>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    {t(method.desc)}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Documents requis */}
            <section className="py-16 bg-gradient-to-br from-[#0f141e] via-[#1a2a3a] to-[#0f141e]">
                <div className="container mx-auto px-4 max-w-3xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <h2 className="text-2xl font-bold text-white mb-2">
                            <T>Documents à fournir</T>
                        </h2>
                        <p className="text-white/40 text-sm mb-8">
                            <T>Pour démarrer votre recherche, transmettez-nous les éléments suivants :</T>
                        </p>

                        <div className="space-y-3 mb-8">
                            {content.documents.map((doc, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5 + i * 0.08 }}
                                    className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] transition-colors"
                                >
                                    <CheckCircle2 className="shrink-0 mt-0.5 text-[#FCD116]" size={18} />
                                    <span className="text-white/80 text-sm leading-relaxed">{t(doc)}</span>
                                </motion.div>
                            ))}
                        </div>

                        <div className="flex items-start gap-3 bg-[#FCD116]/10 border border-[#FCD116]/25 rounded-xl p-4">
                            <FileText className="shrink-0 mt-0.5 text-[#FCD116]" size={18} />
                            <p className="text-white/65 text-sm leading-relaxed italic">
                                {t(content.documents_note)}
                            </p>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Tarif + CTA */}
            <section className="py-16 bg-gray-50">
                <div className="container mx-auto px-4 max-w-3xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Tarif */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <Card className="border-0 shadow-lg overflow-hidden h-full">
                                <div className="h-1 w-full bg-gradient-to-r from-[#FCD116] to-[#008751]" />
                                <CardContent className="p-6 flex flex-col gap-4">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#008751]">
                                        <T>Investissement</T>
                                    </p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-black text-[#1a2332]">
                                            {content.pricing_amount}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        {t(content.pricing_label)}
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* CTA */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                        >
                            <Card className="border-0 shadow-lg overflow-hidden h-full">
                                <div className="h-1 w-full bg-gradient-to-r from-[#1a2332] to-[#2c3b55]" />
                                <CardContent className="p-6 flex flex-col justify-between h-full gap-4">
                                    <div>
                                        <h3 className="font-bold text-[#1a2332] mb-2 flex items-center gap-2">
                                            <Calendar size={16} className="text-[#008751]" />
                                            {t(content.cta_title)}
                                        </h3>
                                        <p className="text-sm text-gray-500 leading-relaxed">
                                            {t(content.cta_description)}
                                        </p>
                                    </div>
                                    <div>
                                        <Link href="/rendez-vous?service=recherche-ancestrale" className="block">
                                            <Button className="w-full bg-[#1a2332] hover:bg-[#2c3b55] text-white font-bold h-12 rounded-xl transition-all shadow-md hover:shadow-lg">
                                                {t(content.cta_button_text)}
                                            </Button>
                                        </Link>
                                        <p className="text-xs text-center text-gray-400 mt-3">
                                            <T>Premier appel de 15 min gratuit</T>
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </section>
        </div>
    );
}
