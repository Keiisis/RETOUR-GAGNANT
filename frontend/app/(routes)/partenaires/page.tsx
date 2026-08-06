"use client";

import PartnerDirectory from "@/components/partners/PartnerDirectory";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from '@phosphor-icons/react';
import Link from "next/link";
import { T } from "@/lib/translation";

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
                            <ArrowLeft className="mr-2 h-4 w-4" /> <T>Retour</T>
                        </Button>
                    </Link>

                    <span className="inline-block px-4 py-1 rounded-full border border-white/20 bg-white/5 backdrop-blur-md text-[#FCD116] text-xs font-semibold tracking-[0.2em] uppercase mb-4">
                        <T>Réseau & Confiance</T>
                    </span>
                    <h1 className="text-4xl md:text-6xl font-bold font-heading mb-6">
                        <T>Le Marché des</T> <span className="text-[#FCD116]"><T>Alliés</T></span>
                    </h1>
                    <p className="text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
                        <T>Découvrez une sélection exclusive d&apos;entreprises et d&apos;artisans qui font bouger le Bénin.</T>
                        <T>Des produits authentiques et des services d&apos;exception recommandés par Retour Gagnant.</T>
                    </p>
                </div>
            </div>

            {/* Main Directory */}
            <PartnerDirectory />

            {/* CTA Join */}
            <section className="py-16 bg-[#FCD116]/10 border-t border-[#FCD116]/20">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-2xl font-bold text-[#1a2332] mb-4"><T>Vous êtes entrepreneur au Bénin ?</T></h2>
                    <p className="text-gray-600 mb-8 max-w-xl mx-auto">
                        <T>Rejoignez notre réseau de partenaires privilégiés et mettez en avant vos produits auprès de la diaspora.</T>
                    </p>
                    <Link href="/devenir-partenaire">
                        <Button className="bg-[#1a2332] text-white hover:bg-[#008751] transition-colors rounded-full px-8 py-6 text-lg">
                            <T>Devenir Partenaire</T>
                        </Button>
                    </Link>
                </div>
            </section>
        </div>
    );
}
