"use client";

import PartnerDirectory from "@/components/partners/PartnerDirectory";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PartnersPage() {
    return (
        <div className="bg-white min-h-screen">
            {/* Hero Banner */}
            <div className="relative py-20 bg-[#0a1628] overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 bg-[url('/images/hero-bg.jpg')] bg-cover bg-center opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#008751]/90 to-[#1a2332]/90" />

                <div className="container mx-auto px-4 relative z-10 text-center text-white">
                    <Link href="/">
                        <Button variant="ghost" className="absolute top-0 left-0 text-white/50 hover:text-white -ml-4">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                        </Button>
                    </Link>

                    <span className="inline-block px-4 py-1 rounded-full border border-white/20 bg-white/5 backdrop-blur-md text-[#FCD116] text-xs font-semibold tracking-[0.2em] uppercase mb-4">
                        Réseau & Confiance
                    </span>
                    <h1 className="text-4xl md:text-6xl font-bold font-heading mb-6">
                        Le Marché des <span className="text-[#FCD116]">Alliés</span>
                    </h1>
                    <p className="text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
                        Découvrez une sélection exclusive d'entreprises et d'artisans qui font bouger le Bénin.
                        Des produits authentiques et des services d'exception recommandés par Retour Gagnant.
                    </p>
                </div>
            </div>

            {/* Main Directory */}
            <PartnerDirectory />

            {/* CTA Join */}
            <section className="py-16 bg-[#FCD116]/10 border-t border-[#FCD116]/20">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-2xl font-bold text-[#1a2332] mb-4">Vous êtes entrepreneur au Bénin ?</h2>
                    <p className="text-gray-600 mb-8 max-w-xl mx-auto">
                        Rejoignez notre réseau de partenaires privilégiés et mettez en avant vos produits auprès de la diaspora.
                    </p>
                    <Button className="bg-[#1a2332] text-white hover:bg-[#008751] transition-colors rounded-full px-8 py-6 text-lg">
                        Devenir Partenaire
                    </Button>
                </div>
            </section>
        </div>
    );
}
