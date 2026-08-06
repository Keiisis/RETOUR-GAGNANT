"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { MapPin } from "@phosphor-icons/react";
import { useTranslation, T } from "@/lib/translation";
import { supabase } from "@/lib/supabase";

interface HeritageItem {
    id: number;
    title: string;
    imageName: string;
    description: string;
    location?: string;
    color?: string;
}

const fallbackItems: HeritageItem[] = [
    { id: 1, title: "Porte du Non-Retour", description: "Symbole mémoriel de la traite transatlantique.", imageName: "Porte du Non-Retour.jpg", location: "Ouidah" },
    { id: 2, title: "Palais Royaux d'Abomey", description: "Vestiges du Royaume de Dahomey.", imageName: "Palais Royaux Abomey.jpg", location: "Abomey" },
    { id: 3, title: "Cité Lacustre de Ganvié", description: "La Venise de l'Afrique, bâtie sur l'eau.", imageName: "Cité Lacustre Ganvié.jpg", location: "Ganvié" },
    { id: 4, title: "Tata Somba", description: "Architecture forteresse unique au monde.", imageName: "TATA SOMBA.jpg", location: "Atacora" },
    { id: 5, title: "Zangbeto", description: "Gardien de la nuit, police traditionnelle vodun.", imageName: "Zangpeto.jpg", location: "Sud Bénin" },
    { id: 6, title: "Chutes de Kota", description: "Un havre de fraîcheur et de nature préservée.", imageName: "Chutes de Kota.jpg", location: "Natitingou" },
    { id: 7, title: "Place de l'Amazone", description: "Hommage aux guerrières Agoodjié du Dahomey.", imageName: "place-amazone.jpg", location: "Cotonou" },
    { id: 8, title: "Monument Bio Guéra", description: "Héros de la résistance nationale.", imageName: "bio-guera.jpg", location: "Parakou" },
    { id: 9, title: "Temple des Pythons", description: "Site sacré et culturel emblématique.", imageName: "ouidah-temple-python-3.jpg", location: "Ouidah" },
    { id: 10, title: "Grand-Popo", description: "Cité balnéaire entre mer et fleuve.", imageName: "Grand-Popo.jpg", location: "Mono" },
    { id: 11, title: "Mur de Fresques", description: "Art urbain retraçant l'histoire du Bénin.", imageName: "Mur de Fresque de Cotonou.jpg", location: "Cotonou" },
    { id: 12, title: "Parc de la Pendjari", description: "Sanctuaire sauvage de la biodiversité.", imageName: "Parc Pendjari.jpg", location: "Tanguiéta" },
];

function HeritageCard({ item }: { item: HeritageItem }) {
    const { t } = useTranslation();
    return (
        <div className="group relative h-[380px] w-[300px] shrink-0 overflow-hidden rounded-[1.4rem]">
            <Image
                src={`/assets/patrimoine/${item.imageName}`}
                alt={t(item.title)}
                fill
                sizes="300px"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d1a12]/85 via-[#0d1a12]/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <span className="inline-flex items-center gap-1.5 font-geistmono text-[11px] uppercase tracking-[0.16em] text-[#FCD116]">
                    <MapPin size={12} weight="fill" /> {t(item.location || "Bénin")}
                </span>
                <h3 className="mt-1.5 font-fraunces text-xl font-semibold leading-tight">{t(item.title)}</h3>
                <p className="mt-1 font-geist text-[13px] leading-snug text-white/70 line-clamp-2">{t(item.description)}</p>
            </div>
        </div>
    );
}

export default function HeritageCarousel() {
    const { t } = useTranslation();
    const [items, setItems] = useState<HeritageItem[]>(fallbackItems);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data, error } = await supabase.from("patrimoine").select("*").order("created_at", { ascending: false });
                if (error) throw error;
                if (data && data.length > 0) {
                    setItems(
                        data.map((item: { id: number; title: string; description: string; imagename?: string; imageName?: string; image_url?: string; location?: string }) => ({
                            id: item.id,
                            title: item.title,
                            description: item.description,
                            imageName: item.imagename || item.imageName || item.image_url || "",
                            location: item.location || "Bénin",
                        })),
                    );
                }
            } catch {
                // fallback conservé
            }
        };
        fetchData();
    }, []);

    if (items.length === 0) return null;
    const track = [...items, ...items];

    return (
        <section className="overflow-hidden bg-[#FBFAF7] py-20 md:py-28">
            <div className="mx-auto mb-12 max-w-[1400px] px-5 md:px-8">
                <h2 className="max-w-2xl font-fraunces text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-[#0d1a12] md:text-5xl">
                    <T>Patrimoine &amp; culture</T>
                </h2>
                <p className="mt-4 max-w-xl font-geist text-lg leading-relaxed text-[#4a5751]">
                    <T>L&apos;histoire et les traditions qui font la fierté du Bénin. Un héritage vivant, à retrouver.</T>
                </p>
            </div>

            <div className="flex overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
                <div className="flex w-max gap-5 px-2.5 animate-marquee-left" style={{ animationPlayState: paused ? "paused" : "running" }}>
                    {track.map((item, index) => (
                        <HeritageCard key={`${item.id}-${index}`} item={item} />
                    ))}
                </div>
            </div>
        </section>
    );
}
