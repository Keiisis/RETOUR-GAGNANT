"use client";

import { GoldenIcon } from "@/components/ui/GoldenIcon";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

import { LucideIcon } from "lucide-react";

type GoldenIconType = "passport" | "tata" | "drum" | "cowrie" | "assin" | "tree" | "recade" | "standard";

interface ServiceItem {
    id: number;
    title: string;
    description: string;
    icon?: LucideIcon;
    iconType?: GoldenIconType;
    slug: string;
    imageUrl: string;
}

const FALLBACK_SERVICES: ServiceItem[] = [
    {
        id: 1,
        title: "Passeport & Documents",
        description: "Obtention rapide de vos documents officiels. Le Sceptre (Récade) ouvre toutes les portes.",
        iconType: "passport",
        slug: "passeport",
        imageUrl: "/assets/icones/icone_Passeport_Documents.png",
    },
    {
        id: 2,
        title: "Acheter ou Louer",
        description: "Sécurisez vos transactions foncières. Votre forteresse (Tata) au Bénin.",
        iconType: "tata",
        slug: "logement",
        imageUrl: "/assets/icones/icone_Acheter_ou_louer.png",
    },
    {
        id: 3,
        title: "Création d'Entreprise",
        description: "Lancez votre business. Etudes de marché, créations de sociétés et implantation, Recherche de Partenaires.",
        iconType: "drum",
        slug: "business",
        imageUrl: "/assets/icones/icone_Creation_d_Entreprise.png",
    },
    {
        id: 4,
        title: "Guide Culturel",
        description: "Reconnectez-vous avec vos racines. La richesse des Cauris. Cérémonie du Nom et validation à l'état civil.",
        iconType: "cowrie",
        slug: "culture",
        imageUrl: "/assets/icones/icone_Guide_culturel.png",
    },
    {
        id: 5,
        title: "Construction",
        description: "Bâtissez pour la postérité. Aide aux suivis de chantiers. L'ancrage de l'Assin.",
        icon: undefined,
        iconType: "assin",
        slug: "construction",
        imageUrl: "/assets/icones/icone_Construction.png",
    },
    {
        id: 6,
        title: "Investissement",
        description: "Opportunités d'affaires rentables. Faites fructifier votre héritage.",
        icon: undefined,
        iconType: "tree",
        slug: "investissement",
        imageUrl: "/assets/icones/icone_Investissement.png",
    },
];

// Map DB icon names to fallback slugs for image lookup
const SLUG_BY_TITLE: Record<string, string> = {
    'Construction Immobilière': 'construction',
    'Gestion de Patrimoine': 'investissement',
    'Conciergerie Diaspora': 'culture',
    'Passeport & Documents': 'passeport',
    'Acheter ou Louer': 'logement',
    'Création d\'Entreprise': 'business',
    'Guide Culturel': 'culture',
    'Investissement': 'investissement',
    'Construction': 'construction',
}
const IMG_BY_SLUG: Record<string, string> = {
    passeport: '/assets/icones/icone_Passeport_Documents.png',
    logement: '/assets/icones/icone_Acheter_ou_louer.png',
    business: '/assets/icones/icone_Creation_d_Entreprise.png',
    culture: '/assets/icones/icone_Guide_culturel.png',
    construction: '/assets/icones/icone_Construction.png',
    investissement: '/assets/icones/icone_Investissement.png',
}

export default function ServicesGrid() {
    const [servicesList, setServicesList] = useState<ServiceItem[]>(FALLBACK_SERVICES);

    useEffect(() => {
        const fetchServices = async () => {
            try {
                const { data, error } = await supabase
                    .from('services')
                    .select('*')
                    .order('order', { ascending: true });

                if (error) throw error;

                if (data && data.length > 0) {
                    const mappedServices = data.map((item: Record<string, unknown>) => {
                        const slug = String(item.slug || SLUG_BY_TITLE[String(item.title)] || String(item.title).toLowerCase().replace(/\s+/g, '-'));
                        return {
                            id: Number(item.id),
                            title: String(item.title),
                            description: item.description ? String(item.description) : "Découvrez ce service",
                            iconType: (item.icon_type ? String(item.icon_type) : "passport") as GoldenIconType,
                            slug,
                            imageUrl: item.image_url ? String(item.image_url) : (IMG_BY_SLUG[slug] || ''),
                        };
                    });
                    setServicesList(mappedServices);
                }
            } catch (error) {
                console.log("Using fallback services grid (Supabase fetch failed or empty)");
            }
        };

        fetchServices();
    }, []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicesList.map((service: ServiceItem) => (
                <div
                    key={service.id}
                    className="group relative glass-card-premium hover:border-[#FCD116] rounded-2xl p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-flag bg-white"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="text-[#008751] w-6 h-6 -rotate-45 group-hover:rotate-0 transition-transform duration-500" />
                    </div>

                    <div className="mb-6 flex justify-center md:justify-start">
                        {service.imageUrl ? (
                            <div className="w-24 h-24 flex items-center justify-center relative">
                                <Image
                                    src={service.imageUrl}
                                    alt={service.title}
                                    fill
                                    className="object-contain bg-transparent group-hover:scale-110 group-hover:-translate-y-2 group-hover:drop-shadow-[0_12px_25px_rgba(252,209,22,0.4)] drop-shadow-[0_8px_20px_rgba(0,0,0,0.15)] transition-all duration-500"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                />
                            </div>
                        ) : (
                            <GoldenIcon
                                icon={service.icon}
                                type={service.iconType}
                                className="group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500"
                            />
                        )}
                    </div>

                    <h3 className="text-xl font-bold font-heading text-[#1a2332] mb-3 group-hover:text-[#008751] transition-colors">
                        {service.title}
                    </h3>

                    <p className="text-gray-600 font-medium mb-6 line-clamp-3">
                        {service.description}
                    </p>

                    <Link href={`/services/${service.slug}`} className="block w-full">
                        <Button variant="outline" className="w-full border-[#008751]/20 text-[#008751] hover:bg-[#008751] hover:text-white transition-colors rounded-xl font-semibold">
                            En savoir plus
                        </Button>
                    </Link>
                </div>
            ))}
        </div>
    );
}
