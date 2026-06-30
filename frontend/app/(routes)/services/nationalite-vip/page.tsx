'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, ChevronRight, FileText, Calendar } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import PricingCalculator3D from '@/components/services/PricingCalculator3D';
import { supabase } from '@/lib/supabase';
import { T, useTranslation } from '@/lib/translation';

interface PricingOption {
    label: string;
    price: string;
}

interface PageContent {
    hero_title: string;
    hero_subtitle: string;
    accompagnement_title: string;
    accompagnement_text: string;
    documents_title: string;
    documents_note: string;
    documents: string[];
    pricing_show_calculator: boolean;
    pricing_options: PricingOption[];
    cta1_title: string;
    cta1_description: string;
    cta1_button_text: string;
    cta2_title: string;
    cta2_description: string;
    cta2_button_text: string;
    cta2_note: string;
}

const DEFAULT_CONTENT: PageContent = {
    hero_title: "Nationalité Béninoise — Accompagnement VIP",
    hero_subtitle: "Procédure personnalisée et accompagnée de A à Z pour obtenir la nationalité béninoise.",
    accompagnement_title: "Notre accompagnement",
    accompagnement_text: "Nous guidons les membres de la diaspora afro-descendante dans l'ensemble des démarches administratives nécessaires à l'obtention de la nationalité béninoise. De la constitution du dossier à la remise des documents officiels, notre équipe assure un suivi personnalisé et transparent à chaque étape.",
    documents_title: "Pièces à fournir",
    documents_note: "* Cette liste peut varier selon votre situation individuelle. Nos conseillers vous transmettront la liste définitive lors de votre consultation.",
    documents: [
        "Acte de naissance apostillé (original + traduction assermentée si nécessaire)",
        "Justificatif de domicile de moins de 3 mois",
        "Copie du passeport en cours de validité",
        "Certificat de bonne conduite / extrait de casier judiciaire",
        "Preuve de lien avec le Bénin (généalogie, acte de naissance d'un parent béninois, etc.)",
        "4 photos d'identité récentes",
        "Formulaire de demande de naturalisation (fourni par nos soins)",
    ],
    pricing_show_calculator: false,
    pricing_options: [
        { label: "Accompagnement dossier standard", price: "150.000 FCFA" },
        { label: "Pack VIP — suivi prioritaire complet", price: "350.000 FCFA" },
        { label: "Consultation initiale", price: "Gratuit" },
    ],
    cta1_title: "Commencer ma demande",
    cta1_description: "Remplissez le formulaire de demande en ligne. Notre équipe vous recontactera sous 48h.",
    cta1_button_text: "Commencer ma demande",
    cta2_title: "Prendre un rendez-vous",
    cta2_description: "Échangez avec un conseiller pour évaluer votre situation et préparer votre dossier.",
    cta2_button_text: "Réserver un créneau",
    cta2_note: "Premier appel de 15 min gratuit",
};

export default function NationaliteVipPage() {
    const { t } = useTranslation();
    const [content, setContent] = useState<PageContent>(DEFAULT_CONTENT);
    // Toggle global des calculateurs (Admin > Réglages Frontend) — a priorité.
    const [globalCalcEnabled, setGlobalCalcEnabled] = useState(true);

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const { data } = await supabase
                    .from('page_sections')
                    .select('content')
                    .eq('page', 'nationalite-vip')
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

        fetch('/api/settings/frontend')
            .then(r => r.json())
            .then(json => { if (json.settings?.services_show_calculator === 'false') setGlobalCalcEnabled(false); })
            .catch(() => { /* défaut : activé */ });
    }, []);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Banner */}
            <section className="relative py-20 bg-gradient-to-br from-[#0f141e] via-[#1a2a3a] to-[#0f141e] text-white overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 right-20 w-64 h-64 rounded-full blur-[100px] bg-[#FCD116]" />
                </div>
                <div className="container mx-auto px-4 relative z-10">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-sm text-white/50 mb-8 flex-wrap">
                        <Link href="/" className="hover:text-white/80 transition-colors"><T>Accueil</T></Link>
                        <ChevronRight size={14} />
                        <Link href="/services" className="hover:text-white/80 transition-colors"><T>Services</T></Link>
                        <ChevronRight size={14} />
                        <span className="text-[#FCD116]"><T>Nationalité Béninoise VIP</T></span>
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
                                    src="/assets/icones/Nationalité Béninoise VIP.png"
                                    alt="Nationalité Béninoise VIP"
                                    fill
                                    className="object-contain bg-transparent drop-shadow-[0_15px_35px_rgba(0,0,0,0.4)]"
                                    sizes="160px"
                                />
                            </motion.div>
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

            {/* Content */}
            <section className="py-16">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 max-w-6xl mx-auto">
                        {/* Main Content */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="lg:col-span-2 space-y-10"
                        >
                            <div>
                                <h2 className="text-2xl font-bold text-[#1a2332] mb-4">
                                    {t(content.accompagnement_title)}
                                </h2>
                                <p className="text-gray-600 leading-relaxed text-lg">
                                    {t(content.accompagnement_text)}
                                </p>
                            </div>

                            {/* Pièces à fournir */}
                            <div>
                                <h2 className="text-2xl font-bold text-[#1a2332] mb-6 flex items-center gap-3">
                                    <FileText className="text-[#008751]" size={24} />
                                    {t(content.documents_title)}
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {content.documents.map((item, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.3 + i * 0.05 }}
                                            className="flex items-start gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100"
                                        >
                                            <CheckCircle2 className="shrink-0 mt-0.5 text-[#008751]" size={20} />
                                            <span className="text-gray-700 text-sm">{t(item)}</span>
                                        </motion.div>
                                    ))}
                                </div>
                                <p className="mt-4 text-sm text-gray-500 italic">
                                    {t(content.documents_note)}
                                </p>
                            </div>
                        </motion.div>

                        {/* Sidebar */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="lg:col-span-1"
                        >
                            <div className="sticky top-24 space-y-6">
                                {content.pricing_show_calculator && globalCalcEnabled && (
                                    <PricingCalculator3D
                                        options={content.pricing_options}
                                        baseColor="#FCD116"
                                        serviceName="Nationalité Béninoise VIP"
                                    />
                                )}

                                <Card className="border-0 shadow-lg overflow-hidden bg-white/80 backdrop-blur-sm">
                                    <div className="h-1 w-full bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />
                                    <CardContent className="p-6">
                                        <h3 className="text-lg font-bold text-[#1a2332] mb-2">
                                            {t(content.cta1_title)}
                                        </h3>
                                        <p className="text-sm text-gray-500 mb-4">
                                            {t(content.cta1_description)}
                                        </p>
                                        <Link href="/nationalite" className="block">
                                            <Button className="w-full bg-[#008751] hover:bg-[#006e42] text-white font-bold h-12 rounded-xl transition-all shadow-md hover:shadow-lg">
                                                {t(content.cta1_button_text)}
                                            </Button>
                                        </Link>
                                    </CardContent>
                                </Card>

                                <Card className="border-0 shadow-lg overflow-hidden bg-white/80 backdrop-blur-sm">
                                    <div className="h-1 w-full bg-gradient-to-r from-[#FCD116] to-[#008751]" />
                                    <CardContent className="p-6">
                                        <h3 className="text-lg font-bold text-[#1a2332] mb-2 flex items-center gap-2">
                                            <Calendar size={18} className="text-[#008751]" />
                                            {t(content.cta2_title)}
                                        </h3>
                                        <p className="text-sm text-gray-500 mb-4">
                                            {t(content.cta2_description)}
                                        </p>
                                        <Link href="/rendez-vous?service=nationalite-vip" className="block">
                                            <Button variant="outline" className="w-full border-[#008751]/30 text-[#008751] hover:bg-[#008751] hover:text-white font-bold h-12 rounded-xl transition-all">
                                                {t(content.cta2_button_text)}
                                            </Button>
                                        </Link>
                                        <p className="text-xs text-center text-gray-400 mt-3">
                                            {t(content.cta2_note)}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>
        </div>
    );
}
