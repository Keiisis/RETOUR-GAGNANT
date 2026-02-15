'use client';

import { use, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, ChevronRight, ArrowRight, Calendar } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { GoldenIcon } from '@/components/ui/GoldenIcon';
import PricingCalculator3D from '@/components/services/PricingCalculator3D';

// Fallback service data — user can override this via Strapi Admin
const FALLBACK_SERVICES: Record<string, {
    title: string;
    subtitle: string;
    description: string;
    features: string[];
    price: string;
    color: string;
    icon_type: string;
    pricing_options: Array<{ label: string; price: string }>;
}> = {
    passeport: {
        title: "Passeport & Documents VIP",
        subtitle: "Reprenez le contrôle de votre identité sans le moindre stress",
        description: "Imaginez la tranquillité d'esprit absolue : plus aucune file d'attente interminable, plus aucun formulaire rejeté, plus aucune incertitude. Votre identité béninoise est votre héritage le plus précieux. Nous transformons le parcours du combattant administratif en une promenade de santé. Laissez-nous naviguer la bureaucratie pour vous pendant que vous vous concentrez sur l'essentiel : votre retour. Obtenez vos documents officiels avec une rapidité déconcertante et une efficacité chirurgicale.",
        features: [
            "Passeport Béninois Express (Renouvellement & 1ère demande)",
            "Certificat de Nationalité & Actes d'État Civil Sécurisés",
            "CIP & Légalisation Apostille (valable à l'international)",
            "Transcription de Mariage & Naissance",
            "Assistance VIP Consulat & Ambassade",
            "Tracking temps réel de votre dossier sur WhatsApp",
        ],
        price: "À partir de 50.000 FCFA",
        color: "#008751",
        icon_type: "passport",
        pricing_options: [
            { label: "Pack Basique (Dossier simple)", price: "50.000 FCFA" },
            { label: "Pack Sérénité (Gestion complète)", price: "85.000 FCFA" },
            { label: "Pack Urgence VIP (72h chrono)", price: "150.000 FCFA" },
        ]
    },
    logement: {
        title: "Chasseur Immobilier de Luxe",
        subtitle: "Votre havre de paix à Cotonou, sans les pièges ni les déceptions",
        description: "Fermez les yeux et visualisez-vous sur votre terrasse à Cotonou, brise marine au visage. Le rêve est accessible, mais la réalité immobilière peut être impitoyable (arnaques, vices cachés, prix 'diaspora'). Nous sommes votre bouclier et vos yeux sur le terrain. Nous ne visitons pas des maisons, nous dénichons des perles rares qui correspondent à votre standing occidental. Location meublée de prestige ou achat sécurisé : nous sécurisons chaque centime de votre investissement. Dormez tranquille, vous êtes chez vous.",
        features: [
            "Chasse immobilière sur-mesure (Cotonou & Calavi)",
            "Visites vidéo 4K immersives & transparentes",
            "Audit Juridique Anti-Arnaque (Titres Fonciers Vérifiés)",
            "Négociation de loyer agressive en votre faveur",
            "Conciergerie & Mise en service (Eau, Élec, Internet activés)",
            "Gestion locative premium en votre absence",
        ],
        price: "À partir de 75.000 FCFA",
        color: "#FCD116",
        icon_type: "tata",
        pricing_options: [
            { label: "Recherche Location Meublée", price: "75.000 FCFA" },
            { label: "Chasse Achat Terrain/Maison", price: "250.000 FCFA" },
            { label: "Audit Juridique & Titre Foncier", price: "100.000 FCFA" },
        ]
    },
    business: {
        title: "Business & Empire",
        subtitle: "L'Afrique est le nouvel Eldorado. Prenez votre part du gâteau.",
        description: "Pendant que le monde hésite, l'Afrique avance à pas de géant. Ne soyez pas spectateur de l'émergence du Bénin : devenez-en un acteur majeur. Créer une entreprise ici peut sembler complexe, mais avec le bon partenaire, c'est un jeu d'enfant. De la formalisation de votre idée à votre premier client, nous balisons la route du succès. Oubliez la paperasse, focalisez-vous sur votre vision. Votre empire commence aujourd'hui, et nous en posons les fondations juridiques et fiscales solides.",
        features: [
            "Création de Société Clé-en-main (K‑BIS APIEX en 72h chrono)",
            "Fiscalité Optimisée & Conseil Comptable Stratégique",
            "Ouverture Compte Bancaire Pro (UBA, Orabank, Ecobank)",
            "Domiciliation Prestigieuse au Cœur de Cotonou",
            "Recrutement de Talents Locaux de Confiance",
            "Réseautage VIP & Introduction aux Décideurs",
        ],
        price: "À partir de 150.000 FCFA",
        color: "#E8112D",
        icon_type: "drum",
        pricing_options: [
            { label: "Création Entreprise Simple", price: "150.000 FCFA" },
            { label: "Pack Business Ready (Banque+Siège)", price: "350.000 FCFA" },
            { label: "Coaching Implantation Stratégique", price: "500.000 FCFA" },
        ]
    },
    culture: {
        title: "Immersion & Racines",
        subtitle: "Plus qu'un voyage, une reconnexion spirituelle et émotionnelle",
        description: "Il y a visiter le Bénin, et il y a RESSENTIR le Bénin. Ce que nous vous proposons n'est pas du tourisme, c'est un pèlerinage, une initiation. Reconnectez-vous à la terre de vos ancêtres, comprenez les codes cachés, vibrez au rythme du Vodoun authentique, goûtez aux saveurs qui réveillent des mémoires cellulaires. Ne soyez plus un 'yovo' chez vous. Retrouvez votre fierté, votre histoire et votre place dans la grande lignée. Une expérience qui changera votre regard sur vous-même à jamais.",
        features: [
            "Pèlerinage Mémoriel à Ouidah (Route des Esclaves)",
            "Audience Privée avec Dignitaires & Rois Traditionnels",
            "Initiation aux Rites & Cérémonies Vodoun (Respectueux)",
            "Immersion Ganvié & Villages Lacustres (Hors sentiers battus)",
            "Ateliers Cuisine Ancestrale & Tissage Artisanal",
            "Guide Historien Expert & Passionné",
        ],
        price: "À partir de 100.000 FCFA",
        color: "#008751",
        icon_type: "cowrie",
        pricing_options: [
            { label: "Journée Pèlerinage Ouidah", price: "100.000 FCFA" },
            { label: "Week-end Immersion Royale", price: "250.000 FCFA" },
            { label: "Séjour Reconnexion 7 Jours", price: "1.200.000 FCFA" },
        ]
    },
    construction: {
        title: "Construction & Patrimoine",
        subtitle: "Bâtissez la maison qui rendra votre famille fière pour des générations",
        description: "On a tous entendu les histoires d'horreur : chantiers abandonnés, ciment volé, maçons fantômes. Ça suffit. Votre argent a été durement gagné, il mérite d'être transformé en pierre solide, pas en poussière. Nous importons la rigueur occidentale sur les chantiers béninois. Gestion de projet draconienne, rapports quotidiens, preuves par drone. Construire au Bénin redevient ce que ça aurait toujours dû être : l'accomplissement d'une vie, la fierté d'un nom gravé dans le béton.",
        features: [
            "Plans 3D Architecturaux Modernes & Fonctionnels",
            "Surveillance de Chantier par Drone & Caméras IP",
            "Achats Matériaux Directs Usine (Zéro surfacturation)",
            "Rapports WhatsApp Quotidiens (Photos/Vidéos)",
            "Respect Strict des Délais & Pénalités de Retard",
            "Garantie Décennale & Finitions Haut de Gamme",
        ],
        price: "Sur Devis",
        color: "#FCD116",
        icon_type: "assin",
        pricing_options: [
            { label: "Surveillance Chantier (Mensuel)", price: "150.000 FCFA" },
            { label: "Étude Architecturale 3D", price: "300.000 FCFA" },
            { label: "Gestion Projet Clé-en-main", price: "Sur Devis" },
        ]
    },
    investissement: {
        title: "Investissement Stratégique",
        subtitle: "Faites travailler votre argent là où la croissance est à deux chiffres",
        description: "L'Occident sature, l'inflation grignote votre épargne. Ici, tout est à construire et les retours sur investissement sont insolents pour ceux qui osent. Immobilier, Agriculture, Tech, Commerce... Nous ne vous vendons pas du rêve, nous vous apportons des données, des analyses de risque et des opportunités 'Off-Market'. Ne laissez pas votre argent dormir en Europe à 2%. Faites-le fructifier sur la terre qui vous a vu naître (ou celle de vos parents). L'avenir est ici.",
        features: [
            "Sourcing d'Affaires 'Off-Market' (Terrains, Immeubles)",
            "Projets Agricoles Rentables (Ananas, Cajou, Soja)",
            "Due Diligence & Audit de Risque Rigoureux",
            "Partenariats Public-Privé & Appels d'Offres",
            "Gestion de Portefeuille d'Actifs Locaux",
            "Optimisation Fiscale des Revenus Locaux",
        ],
        price: "Gratuit",
        color: "#E8112D",
        icon_type: "cowrie",
        pricing_options: [
            { label: "Premier Rendez-vous Conseil", price: "Gratuit" },
            { label: "Dossier Étude Opportunité", price: "200.000 FCFA" },
            { label: "Accompagnement Deal Flow", price: "Commission" },
        ]
    },
};

export default function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const [service, setService] = useState(FALLBACK_SERVICES[slug] || {
        title: slug ? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ') : 'Service',
        subtitle: "Découvrez nos solutions sur mesure",
        description: "Chargement des détails du service...",
        features: [],
        price: "Nous consulter",
        color: "#008751",
        icon_type: "passport",
        pricing_options: [{ label: "Standard", price: "Nous consulter" }]
    });

    useEffect(() => {
        const fetchService = async () => {
            if (!slug || !FALLBACK_SERVICES[slug]) return;

            try {
                const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
                const res = await fetch(`${STRAPI_URL}/api/services?filters[slug][$eq]=${slug}`);
                if (!res.ok) throw new Error('Network response was not ok');

                const json = await res.json();

                if (json.data && json.data.length > 0) {
                    const attr = json.data[0].attributes;

                    let fetchedPricing = FALLBACK_SERVICES[slug].pricing_options;
                    if (attr.pricing_options) {
                        fetchedPricing = attr.pricing_options;
                    }

                    setService({
                        title: attr.title || FALLBACK_SERVICES[slug].title,
                        subtitle: attr.subtitle || FALLBACK_SERVICES[slug].subtitle,
                        description: attr.description || FALLBACK_SERVICES[slug].description,
                        features: attr.features_text ? attr.features_text.split('\n').filter(Boolean) : FALLBACK_SERVICES[slug].features,
                        price: attr.price || FALLBACK_SERVICES[slug].price,
                        color: attr.color || FALLBACK_SERVICES[slug].color,
                        icon_type: attr.icon_type || FALLBACK_SERVICES[slug].icon_type,
                        pricing_options: fetchedPricing
                    });
                }
            } catch (error) {
                console.log("Using fallback content (Strapi not ready or empty for this service)");
            }
        };

        fetchService();
    }, [slug]);

    if (!service) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Chargement...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Banner */}
            <section className="relative py-20 bg-gradient-to-br from-[#0f141e] via-[#1a2a3a] to-[#0f141e] text-white overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 right-20 w-64 h-64 rounded-full blur-[100px]" style={{ background: service.color }} />
                </div>

                <div className="container mx-auto px-4 relative z-10">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-sm text-white/50 mb-8">
                        <Link href="/" className="hover:text-white/80 transition-colors">Accueil</Link>
                        <ChevronRight size={14} />
                        <Link href="/services" className="hover:text-white/80 transition-colors">Services</Link>
                        <ChevronRight size={14} />
                        <span className="text-[#FCD116]">{service.title}</span>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-4xl flex flex-col md:flex-row items-center gap-8"
                    >
                        <div className="shrink-0 drop-shadow-[0_0_30px_rgba(252,209,22,0.4)]">
                            <GoldenIcon
                                // @ts-ignore
                                type={service.icon_type}
                                className="w-32 h-32 md:w-40 md:h-40"
                            />
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-bold font-heading mb-4">{service.title}</h1>
                            <p className="text-xl text-white/70">{service.subtitle}</p>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Content & Pricing */}
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
                                <h2 className="text-2xl font-bold text-[#1a2332] mb-4">Description du service</h2>
                                <p className="text-gray-600 leading-relaxed text-lg">{service.description}</p>
                            </div>

                            <div>
                                <h2 className="text-2xl font-bold text-[#1a2332] mb-6">Ce que nous proposons</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {service.features.map((item, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.3 + i * 0.05 }}
                                            className="flex items-start gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100"
                                        >
                                            <CheckCircle2 className="shrink-0 mt-0.5" style={{ color: service.color }} size={20} />
                                            <span className="text-gray-700">{item}</span>
                                        </motion.div>
                                    ))}
                                </div>
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
                                <PricingCalculator3D
                                    options={service.pricing_options}
                                    baseColor={service.color}
                                    serviceName={service.title}
                                />

                                <Card className="border-0 shadow-lg overflow-hidden bg-white/80 backdrop-blur-sm">
                                    <div className="h-1 w-full" style={{ background: `linear-gradient(to right, ${service.color}, #FCD116)` }} />
                                    <CardContent className="p-6">
                                        <h3 className="text-lg font-bold text-[#1a2332] mb-2 flex items-center gap-2">
                                            <Calendar size={18} className="text-[#008751]" />
                                            Prêt à démarrer ?
                                        </h3>
                                        <p className="text-sm text-gray-500 mb-4">
                                            Réservez un créneau avec nos experts pour concrétiser votre projet.
                                        </p>
                                        <Link href="/rendez-vous" className="block">
                                            <Button className="w-full bg-[#1a2332] hover:bg-[#2c3b55] text-white font-bold h-12 rounded-xl transition-all shadow-md hover:shadow-lg">
                                                Prendre Rendez-vous
                                            </Button>
                                        </Link>
                                        <p className="text-xs text-center text-gray-400 mt-3">
                                            Premier appel de 15 min gratuit
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
