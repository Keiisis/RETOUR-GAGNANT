"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";

interface HeritageItem {
    id: number;
    title: string;
    imageName: string;
    description: string;
    location?: string;
    color?: string;
}

const fallbackItems: HeritageItem[] = [
    {
        id: 1,
        title: "Porte du Non-Retour",
        description: "Symbole mémoriel historique de la traite transatlantique.",
        imageName: "Porte du Non-Retour.jpg",
        location: "Ouidah",
        color: "#E8112D"
    },
    {
        id: 2,
        title: "Palais Royaux d'Abomey",
        description: "Vestiges de la puissance du Royaume de Dahomey.",
        imageName: "Palais Royaux Abomey.jpg",
        location: "Abomey",
        color: "#FCD116"
    },
    {
        id: 3,
        title: "Cité Lacustre de Ganvié",
        description: "La Venise de l'Afrique, entièrement bâtie sur l'eau.",
        imageName: "Cité Lacustre Ganvié.jpg",
        location: "Ganvié",
        color: "#008751"
    },
    {
        id: 4,
        title: "Tata Somba",
        description: "Architecture forteresse unique au monde.",
        imageName: "TATA SOMBA.jpg",
        location: "Atacora",
        color: "#E8112D"
    },
    {
        id: 5,
        title: "Zangbeto",
        description: "Gardien de la nuit et police traditionnelle vaudou.",
        imageName: "Zangpeto.jpg",
        location: "Sud Bénin",
        color: "#008751"
    },
    {
        id: 6,
        title: "Chutes de Kota",
        description: "Un havre de fraîcheur et de nature préservée.",
        imageName: "Chutes de Kota.jpg",
        location: "Natitingou",
        color: "#FCD116"
    },
    {
        id: 7,
        title: "Place de l'Amazone",
        description: "Hommage aux guerrières Agoodjié du Dahomey.",
        imageName: "place-amazone.jpg",
        location: "Cotonou",
        color: "#E8112D"
    },
    {
        id: 8,
        title: "Monument Bio Guerra",
        description: "Héros de la résistance nationale.",
        imageName: "bio-guera.jpg",
        location: "Parakou",
        color: "#FCD116"
    },
    {
        id: 9,
        title: "Temple des Pythons",
        description: "Site sacré et culturel emblématique.",
        imageName: "ouidah-temple-python-3.jpg",
        location: "Ouidah",
        color: "#008751"
    },
    {
        id: 10,
        title: "Grand-Popo",
        description: "Cité balnéaire entre mer et fleuve.",
        imageName: "Grand-Popo.jpg",
        location: "Mono",
        color: "#E8112D"
    },
    {
        id: 11,
        title: "Mur de Fresques",
        description: "Art urbain retraçant l'histoire du Bénin.",
        imageName: "Mur de Fresque de Cotonou.jpg",
        location: "Cotonou",
        color: "#FCD116"
    },
    {
        id: 12,
        title: "Parc de la Pendjari",
        description: "Sanctuaire sauvage de la biodiversité.",
        imageName: "Parc Pendjari.jpg",
        location: "Tanguiéta",
        color: "#008751"
    }
];

const colorPalette = ["#E8112D", "#FCD116", "#008751", "#E8112D", "#008751", "#FCD116"];

export default function HeritageCarousel() {
    const [items, setItems] = useState<HeritageItem[]>(fallbackItems);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        const fetchData = async () => {
            try {
                // Short timeout to fallback quickly if server is down
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);

                const response = await fetch('http://localhost:1337/api/patrimoines', {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    return; // Silently fail to fallback
                }

                const json = await response.json();

                // Map Strapi data to component format
                if (json.data && Array.isArray(json.data)) {
                    const mappedItems = json.data.map((item: any, index: number) => ({
                        id: item.id,
                        title: item.title,
                        description: item.description,
                        imageName: item.imageName,
                        // Auto-assign location/colors for demo purposes if not in DB
                        location: "Bénin",
                        color: colorPalette[index % colorPalette.length]
                    }));
                    setItems(mappedItems);
                }
            } catch (err) {
                // Suppress error overlay by not throwing
                console.warn('Heritage items using fallback data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Duplicate list for infinite scroll effect
    const displayItems = items.length > 0 ? [...items, ...items] : [];

    if (loading) return <div className="py-24 text-center">Chargement du patrimoine...</div>;
    if (items.length === 0) return null;

    return (
        <section className="py-24 bg-[#fafafa] overflow-hidden relative">
            {/* Section Title */}
            <div className="container mx-auto px-4 mb-16 text-center">
                <span className="text-[#008751] font-semibold tracking-widest uppercase text-sm mb-2 block">
                    Découverte & Racines
                </span>
                <h2 className="text-4xl md:text-5xl font-bold font-heading text-[#1a2332] mb-4">
                    Patrimoine & <span className="text-benin-gradient">Culture</span>
                </h2>
                <p className="text-gray-600 max-w-2xl mx-auto text-lg">
                    Plongez au cœur de l'histoire et des traditions qui font la fierté du Bénin. Un héritage vivant à préserver et à transmettre.
                </p>
            </div>

            {/* Infinite Marquee */}
            <div className="flex relative">
                <div className="flex gap-8 animate-marquee whitespace-nowrap px-4">
                    {displayItems.map((item, index) => (
                        <HeritageCard key={`${item.id}-${index}`} item={item} />
                    ))}
                </div>

                {/* Gradients to fade edges */}
                <div className="absolute top-0 left-0 h-full w-24 bg-gradient-to-r from-[#fafafa] to-transparent z-10" />
                <div className="absolute top-0 right-0 h-full w-24 bg-gradient-to-l from-[#fafafa] to-transparent z-10" />
            </div>

            <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
        </section>
    );
}

function HeritageCard({ item }: { item: HeritageItem }) {
    return (
        <div className="relative group w-[350px] h-[450px] flex-shrink-0 cursor-pointer overflow-hidden rounded-3xl border border-gray-100 shadow-flag bg-white">
            <div className={`absolute inset-0 bg-gray-200 transition-transform duration-700 group-hover:scale-110`}>
                <Image
                    src={`/assets/patrimoine/${item.imageName}`}
                    alt={item.title}
                    fill
                    className="object-cover"
                    onError={(e) => {
                        // Fallback placeholder
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerText = item.title;
                    }}
                />
            </div>

            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />

            {/* Content */}
            <div className="absolute bottom-0 left-0 w-full p-8 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                <div className="flex items-center gap-2 mb-2">
                    <MapPin size={16} className="text-white/80" />
                    <span className="text-white/90 text-sm font-medium uppercase tracking-wide">{item.location}</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 font-heading leading-tight whitespace-normal">
                    {item.title}
                </h3>
                <p className="text-white/80 text-sm line-clamp-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100 whitespace-normal">
                    {item.description}
                </p>

                {/* Accent Bar */}
                <div className="h-1 w-12 mt-4 rounded-full transition-all duration-300 group-hover:w-full" style={{ backgroundColor: item.color }} />
            </div>
        </div>
    );
}
