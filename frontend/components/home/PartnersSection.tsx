"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { useTranslation, T } from "@/lib/translation";

interface Sponsor {
    id: string;
    name: string;
    logo_url: string | null;
    website_url: string | null;
    sort_order: number;
}

const BADGE_GRADIENTS: [string, string][] = [
    ["#008751", "#006b40"],
    ["#FCD116", "#e6bc00"],
    ["#E8112D", "#c00d25"],
    ["#0d1a12", "#284034"],
];

function getInitials(name: string) {
    return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const FALLBACK: Sponsor[] = [
    { id: "1", name: "Gouvernement du Bénin", logo_url: null, website_url: null, sort_order: 0 },
    { id: "2", name: "APIEX", logo_url: null, website_url: null, sort_order: 1 },
    { id: "3", name: "Chambre de Commerce", logo_url: null, website_url: null, sort_order: 2 },
    { id: "4", name: "SIMAU", logo_url: null, website_url: null, sort_order: 3 },
];

function Tile({ sponsor, index }: { sponsor: Sponsor; index: number }) {
    const [start, end] = BADGE_GRADIENTS[index % BADGE_GRADIENTS.length];
    const inner = (
        <div className="group flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-[#e7e4db] bg-white px-5 py-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#008751]/40 hover:shadow-[0_20px_44px_-28px_rgba(13,26,18,0.5)]">
            <div className="flex h-12 w-full items-center justify-center">
                {sponsor.logo_url ? (
                    <div className="relative h-full w-full">
                        <Image src={sponsor.logo_url} alt={sponsor.name} fill unoptimized className="object-contain opacity-70 grayscale transition-all duration-500 group-hover:opacity-100 group-hover:grayscale-0" />
                    </div>
                ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl shadow-sm" style={{ background: `linear-gradient(135deg, ${start}, ${end})` }}>
                        <span className="font-geist text-sm font-bold text-white">{getInitials(sponsor.name)}</span>
                    </div>
                )}
            </div>
            <p className="text-center font-geist text-xs font-medium leading-tight text-[#8a938c] transition-colors group-hover:text-[#0d1a12]">{sponsor.name}</p>
        </div>
    );
    return sponsor.website_url ? (
        <Link href={sponsor.website_url} target="_blank" rel="noopener noreferrer">{inner}</Link>
    ) : inner;
}

export default function PartnersSection() {
    const [sponsors, setSponsors] = useState<Sponsor[]>(FALLBACK);

    useEffect(() => {
        fetch("/api/sponsors")
            .then((r) => r.json())
            .then((d) => { if (d.sponsors && d.sponsors.length) setSponsors(d.sponsors); })
            .catch(() => { });
    }, []);

    return (
        <section className="bg-[#FBFAF7] py-20 md:py-28">
            <div className="mx-auto max-w-[1400px] px-5 md:px-8">
                <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <h2 className="max-w-2xl font-fraunces text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-[#0d1a12] md:text-5xl">
                        <T>Ils nous font confiance.</T>
                    </h2>
                    <Link href="/partenaires" className="group inline-flex shrink-0 items-center gap-2 font-geist text-[15px] font-semibold text-[#0d1a12] underline decoration-[#FCD116] decoration-2 underline-offset-[6px] transition-colors hover:text-[#008751]">
                        <T>Tous nos partenaires</T>
                        <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {sponsors.map((s, i) => (
                        <Tile key={s.id} sponsor={s} index={i} />
                    ))}
                </div>
            </div>
        </section>
    );
}
