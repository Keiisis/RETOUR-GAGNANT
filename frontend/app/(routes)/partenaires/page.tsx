"use client";

import PartnerDirectory from "@/components/partners/PartnerDirectory";
import { Button } from "@/components/ui/button";
import { CaretRight as ChevronRight, Handshake } from '@phosphor-icons/react';
import Link from "next/link";
import { T } from "@/lib/translation";

export default function PartnersPage() {
    return (
        <div className="bg-white min-h-screen">
            {/* Hero : clair, charte Bénin, Playfair */}
            <section className="relative overflow-hidden">
                <div className="absolute -inset-x-8 -top-24 h-[130%] bg-[radial-gradient(55%_55%_at_12%_0%,rgba(0,135,81,0.16),transparent),radial-gradient(42%_45%_at_92%_2%,rgba(252,209,22,0.16),transparent),linear-gradient(180deg,#FBFDFC,#FFFFFF)]" />
                <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-24 md:pt-28 pb-10 text-center text-slate-900">
                    <nav className="flex items-center justify-center gap-1.5 text-[13px] text-slate-400 mb-6">
                        <Link href="/" className="hover:text-[#008751]"><T>Accueil</T></Link><ChevronRight size={13} />
                        <span className="text-slate-600 font-medium"><T>Partenaires</T></span>
                    </nav>
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E6F3ED] text-[#00643C] text-[11px] font-black uppercase tracking-[0.15em] mb-5"><Handshake size={13} weight="fill" /> <T>Réseau & Confiance</T></span>
                    <h1 className="font-display text-4xl md:text-[3.6rem] font-bold leading-[1.04] tracking-[-0.02em]">
                        <T>Le Marché des</T>{' '}
                        <span className="bg-gradient-to-br from-[#008751] via-[#0a7d52] to-[#00643C] bg-clip-text text-transparent italic"><T>Alliés</T></span>
                    </h1>
                    <p className="mt-5 text-[17px] md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                        <T>Découvrez une sélection exclusive d&apos;entreprises et d&apos;artisans qui font bouger le Bénin.</T> <T>Des produits authentiques et des services d&apos;exception recommandés par Retour Gagnant.</T>
                    </p>
                </div>
            </section>

            {/* Main Directory */}
            <PartnerDirectory />

            {/* CTA Join */}
            <section className="py-16 bg-[#FCD116]/10 border-t border-[#FCD116]/20">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="font-display text-3xl font-bold text-[#111a15] mb-4"><T>Vous êtes entrepreneur au Bénin ?</T></h2>
                    <p className="text-gray-600 mb-8 max-w-xl mx-auto">
                        <T>Rejoignez notre réseau de partenaires privilégiés et mettez en avant vos produits auprès de la diaspora.</T>
                    </p>
                    <Link href="/devenir-partenaire">
                        <Button className="bg-[#008751] text-white hover:bg-[#00643C] transition-colors rounded-full px-8 py-6 text-lg font-bold">
                            <T>Devenir Partenaire</T>
                        </Button>
                    </Link>
                </div>
            </section>
        </div>
    );
}
