"use client";

import { GoldenIcon } from "@/components/ui/GoldenIcon";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Home, Briefcase, HardHat, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const FALLBACK_SERVICES = [
    {
        id: 1,
        title: "Passeport & Administratif",
        description: "Obtention rapide de vos documents officiels. Le Sceptre (Récade) ouvre toutes les portes.",
        icon: undefined,
        iconType: "passport",
        slug: "passeport",
    },
    {
        id: 2,
        title: "Logement Premium",
        description: "Location et achat. Votre forteresse (Tata) sécurisée au Bénin.",
        icon: undefined,
        iconType: "tata",
        slug: "logement",
    },
    {
        id: 3,
        title: "Création d'Entreprise",
        description: "Lancez votre business. Au rythme du Tam-Tam des affaires.",
        icon: undefined,
        iconType: "drum",
        slug: "business",
    },
    {
        id: 4,
        title: "Guide Culturel",
        description: "Reconnectez-vous avec vos racines. La richesse des Cauris.",
        icon: undefined,
        iconType: "tree",
        slug: "culture",
    },
    {
        id: 5,
        title: "Construction",
        description: "Bâtissez pour la postérité. L'ancrage de l'Assin.",
        icon: undefined,
        iconType: "assin",
        slug: "construction",
    },
    {
        id: 6,
        title: "Investissement",
        description: "Opportunités d'affaires rentables. Faites fructifier votre héritage.",
        icon: undefined,
        iconType: "cowrie",
        slug: "investissement",
    },
];

export default function ServicesGrid() {
    const [servicesList, setServicesList] = useState(FALLBACK_SERVICES);

    useEffect(() => {
        const fetchServices = async () => {
            try {
                const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
                const res = await fetch(`${STRAPI_URL}/api/services`);
                if (!res.ok) throw new Error('Network response was not ok');
                const json = await res.json();

                if (json.data && json.data.length > 0) {
                    const mappedServices = json.data.map((item: any) => ({
                        id: item.id,
                        title: item.attributes.title,
                        description: item.attributes.subtitle || "Découvrez ce service", // Use subtitle as short description
                        icon: undefined,
                        iconType: item.attributes.icon_type || "passport",
                        slug: item.attributes.slug,
                    }));

                    // Sort by ID to maintain order if desired, or relying on Strapi default sort
                    mappedServices.sort((a: any, b: any) => a.id - b.id);
                    setServicesList(mappedServices);
                }
            } catch (error) {
                console.log("Using fallback services grid (Strapi fetch failed or empty)");
            }
        };

        fetchServices();
    }, []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicesList.map((service) => (
                <div
                    key={service.id}
                    className="group relative glass-card-premium hover:border-[#FCD116] rounded-2xl p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-flag bg-white"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="text-[#008751] w-6 h-6 -rotate-45 group-hover:rotate-0 transition-transform duration-500" />
                    </div>

                    <div className="mb-6 flex justify-center md:justify-start">
                        <GoldenIcon
                            // @ts-ignore
                            icon={service.icon}
                            // @ts-ignore
                            type={service.iconType}
                            className="group-hover:scale-110 transition-transform duration-500"
                        />
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
