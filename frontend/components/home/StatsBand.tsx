"use client";

import CountUp from "@/components/logements/CountUp";
import { T } from "@/lib/translation";

/**
 * Bande de preuve — faits réels et vérifiables uniquement (aucun chiffre
 * inventé). Chiffres en Geist Mono. Palette claire, filets fins.
 */
const STATS: { to: number; suffix?: string; label: string }[] = [
    { to: 9, label: "Services clés en main" },
    { to: 6, label: "Langues disponibles" },
    { to: 14, label: "Villes du programme logement" },
    { to: 5, label: "Moyens de paiement sécurisés" },
];

export default function StatsBand() {
    return (
        <section className="bg-[#FBFAF7]">
            <div className="mx-auto max-w-[1400px] px-5 md:px-8">
                <div className="grid grid-cols-2 gap-x-6 gap-y-10 border-y border-[#e7e4db] py-14 md:grid-cols-4 md:py-16">
                    {STATS.map((s, i) => (
                        <div key={i} className="flex flex-col">
                            <span className="font-geistmono text-5xl font-medium tracking-tight text-[#008751] md:text-6xl">
                                <CountUp to={s.to} suffix={s.suffix} />
                            </span>
                            <span className="mt-3 max-w-[18ch] font-geist text-sm leading-snug text-[#6b756e]">
                                <T>{s.label}</T>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
