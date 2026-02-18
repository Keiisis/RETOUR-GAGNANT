"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const PARTNERS = [
    { name: "Gouvernement du Bénin", logo: "/assets/partners/gouv.png" }, // Placeholder paths
    { name: "APIEX", logo: "/assets/partners/apiex.png" },
    { name: "Chambre de Commerce", logo: "/assets/partners/ccib.png" },
    { name: "Ambassade de France", logo: "/assets/partners/ambassade.png" },
    { name: "Diaspora Connect", logo: "/assets/partners/diaspora.png" },
];

export default function PartnersSection() {
    return (
        <section className="py-16 bg-white border-t border-gray-100">
            <div className="container mx-auto px-4 text-center">
                <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold mb-8">
                    Ils nous font confiance & nous soutiennent
                </p>

                <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
                    {/* Since we don't have actual logos yet, we'll use text placeholders styled nicely */}
                    {PARTNERS.map((partner, index) => (
                        <div key={index} className="flex flex-col items-center justify-center p-4 min-w-[150px]">
                            {/* 
                            <div className="relative w-32 h-16 mb-2">
                                <Image 
                                    src={partner.logo} 
                                    alt={partner.name} 
                                    fill 
                                    className="object-contain" 
                                /> 
                            </div>
                           */}
                            {/* Placeholder Text Logo */}
                            <span className="text-xl font-bold font-heading text-gray-400 hover:text-[#008751] transition-colors cursor-default">
                                {partner.name}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="mt-12">
                    <Link href="/partenaires">
                        <Button variant="link" className="text-[#008751] font-semibold hover:text-[#006e42] text-lg">
                            Découvrir nos partenaires privilégiés &rarr;
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
}
