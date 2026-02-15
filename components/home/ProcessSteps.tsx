"use client";

import { cn } from "@/lib/utils";
import { GoldenIcon } from "@/components/ui/GoldenIcon";

export default function ProcessSteps() {
    const steps = [
        {
            id: 1,
            title: "Prise de Contact",
            desc: "Échange initial pour comprendre votre projet de retour.",
            type: "cowrie"
        },
        {
            id: 2,
            title: "Planification",
            desc: "Stratégie sur-mesure et feuille de route claire.",
            type: "recade"
        },
        {
            id: 3,
            title: "Mise en Œuvre",
            desc: "Lancement des procédures administratives et logistiques.",
            type: "drum"
        },
        {
            id: 4,
            title: "Installation",
            desc: "Accueil VIP à Cotonou et remise des clés/documents.",
            type: "tata"
        }
    ];

    return (
        <section className="py-24 relative overflow-hidden bg-[#151b26]">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')]"></div>

            <div className="container mx-auto px-4 relative z-10">
                <div className="text-center mb-20 space-y-4">
                    <span className="text-[#FDB931] font-bold tracking-widest uppercase text-sm">Votre Parcours</span>
                    <h2 className="text-4xl md:text-5xl font-bold font-heading text-white">Notre <span className="text-gold-gradient">Démarche</span></h2>
                    <div className="w-24 h-1.5 bg-gradient-to-r from-transparent via-[#28a745] to-transparent mx-auto rounded-full mt-4" />
                </div>

                <div className="relative">
                    {/* Connecting Line (The Path) */}
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-[#FDB931]/20 -translate-y-1/2 hidden md:block" />

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
                        {steps.map((step, index) => (
                            <div key={step.id} className="relative group">
                                {/* Step Marker */}
                                <div className="relative z-10 mx-auto mb-8 w-24 h-24 flex items-center justify-center bg-[#1a2332] rounded-full border-4 border-[#1a2332] group-hover:border-[#FDB931] transition-colors duration-500 shadow-premium">
                                    <div className="absolute -top-4 -right-4 w-8 h-8 bg-[#28a745] rounded-full flex items-center justify-center font-bold text-white text-sm shadow-md">
                                        {index + 1}
                                    </div>
                                    {/* @ts-ignore */}
                                    <GoldenIcon type={step.type} size={32} />
                                </div>

                                {/* Content */}
                                <div className="text-center space-y-3 px-4">
                                    <h3 className="text-xl font-bold text-white group-hover:text-[#FDB931] transition-colors">{step.title}</h3>
                                    <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
