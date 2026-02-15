'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface PatrimoineItem {
    id: number;
    documentId: string;
    title: string;
    description: string;
    imageName: string;
}

const fallbackItems: PatrimoineItem[] = [
    {
        id: 1,
        documentId: "f1",
        title: "Porte du Non-Retour",
        description: "Symbole mémoriel historique de la traite transatlantique.",
        imageName: "Porte du Non-Retour.jpg"
    },
    {
        id: 2,
        documentId: "f2",
        title: "Palais Royaux d'Abomey",
        description: "Vestiges de la puissance du Royaume de Dahomey.",
        imageName: "Palais Royaux Abomey.jpg"
    },
    {
        id: 3,
        documentId: "f3",
        title: "Cité Lacustre de Ganvié",
        description: "La Venise de l'Afrique, entièrement bâtie sur l'eau.",
        imageName: "Cité Lacustre Ganvié.jpg"
    },
    {
        id: 4,
        documentId: "f4",
        title: "Tata Somba",
        description: "Architecture forteresse unique au monde.",
        imageName: "TATA SOMBA.jpg"
    },
    {
        id: 5,
        documentId: "f5",
        title: "Zangbeto",
        description: "Gardien de la nuit et police traditionnelle vaudou.",
        imageName: "Zangpeto.jpg"
    },
    {
        id: 6,
        documentId: "f6",
        title: "Chutes de Kota",
        description: "Un havre de fraîcheur et de nature préservée.",
        imageName: "Chutes de Kota.jpg"
    },
    {
        id: 7,
        documentId: "f7",
        title: "Place de l'Amazone",
        description: "Monument majestueux rendant hommage aux guerrières Agoodjié du Dahomey, symbole de la bravoure et de la force féminine au Bénin.",
        imageName: "place-amazone.jpg"
    },
    {
        id: 8,
        documentId: "f8",
        title: "Monument Bio Guerra",
        description: "Statue équestre honorant le héros national Bio Guerra, figure de proue de la résistance contre la colonisation dans le nord du pays.",
        imageName: "bio-guera.jpg"
    },
    {
        id: 9,
        documentId: "f9",
        title: "Temple des Pythons",
        description: "Site sacré à Ouidah dédié au culte du python, illustrant la cohabitation pacifique entre l'homme, la nature et le sacré.",
        imageName: "ouidah-temple-python-3.jpg"
    },
    {
        id: 10,
        documentId: "f10",
        title: "Grand-Popo",
        description: "Cité balnéaire pittoresque entre mer et fleuve, réputée pour ses plages de sable fin et son patrimoine colonial préservé.",
        imageName: "Grand-Popo.jpg"
    },
    {
        id: 11,
        documentId: "f11",
        title: "Mur de Fresques de Cotonou",
        description: "L'une des plus longues fresques murales d'Afrique, racontant l'histoire et les aspirations du peuple béninois à travers l'art urbain.",
        imageName: "Mur de Fresque de Cotonou.jpg"
    },
    {
        id: 12,
        documentId: "f12",
        title: "Parc National de la Pendjari",
        description: "Joyau de la biodiversité ouest-africaine, ce sanctuaire sauvage abrite lions, éléphants et une faune exceptionnelle dans un cadre protégé.",
        imageName: "Parc Pendjari.jpg"
    }
];

export default function PatrimoineList() {
    const [items, setItems] = useState<PatrimoineItem[]>(fallbackItems);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);


    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('http://localhost:1337/api/patrimoines');
                if (!response.ok) {
                    throw new Error('Failed to fetch data');
                }
                const data = await response.json();
                // Handle Strapi v5 response structure (data.data)
                setItems(data.data);
            } catch {
                // Silently fail to fallback in production/demo to avoid console noise
                console.warn('Backend unavailable, using local heritage data.');
                setError(null);
                setItems(fallbackItems);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div className="text-center py-10 text-white">Chargement du patrimoine...</div>;
    if (error) return <div className="text-center py-10 text-red-400">{error}</div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {items.map((item, index) => (
                <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition-colors group"
                >
                    <div className="relative h-64 w-full overflow-hidden">
                        {/* Using local assets mapped by name as requested */}
                        <Image
                            src={`/assets/patrimoine/${item.imageName}`}
                            alt={item.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                            onError={(e) => {
                                // Fallback if image not found
                                e.currentTarget.src = '/images/placeholder.jpg'; // Ensure this exists or use a generic one
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <h3 className="absolute bottom-4 left-4 text-xl font-bold text-white font-heading">
                            {item.title}
                        </h3>
                    </div>
                    <div className="p-6">
                        <p className="text-gray-300 text-sm leading-relaxed line-clamp-4">
                            {item.description}
                        </p>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
