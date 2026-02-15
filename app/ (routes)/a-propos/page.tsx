import { GoldenIcon } from "@/components/ui/GoldenIcon";
import { Button } from "@/components/ui/button";
import { Quote } from "lucide-react";
import Image from "next/image";

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-[#1a2332] text-white">
            {/* Header Section */}
            <section className="relative py-24 px-4 overflow-hidden">
                <div className="absolute inset-0 bg-gold-gradient opacity-5" />
                <div className="container mx-auto text-center relative z-10">
                    <h1 className="text-4xl md:text-6xl font-bold font-heading mb-6">
                        Notre <span className="text-gold-gradient">Histoire</span>
                    </h1>
                    <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                        Plus qu'une agence, nous sommes le pont entre vos ambitions internationaux et votre terre natale.
                    </p>
                </div>
            </section>

            {/* Mission Section */}
            <section className="py-20 container mx-auto px-4">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="glass-card p-8 rounded-2xl border-l-4 border-[#FDB931]">
                        <h2 className="text-3xl font-bold mb-6 font-heading">Notre Mission</h2>
                        <p className="text-gray-300 leading-relaxed mb-6">
                            Faciliter le retour et l'investissement de la diaspora béninoise en offrant un accompagnement de haute facture, sécurisé et transparent. Nous éliminons les barrières administratives pour vous permettre de vous concentrer sur l'essentiel : votre projet de vie.
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-1 bg-[#FDB931] rounded-full" />
                            <span className="text-[#FDB931] font-semibold">Excellence & Intégrité</span>
                        </div>
                    </div>
                    <div className="relative h-[400px] rounded-2xl overflow-hidden shadow-premium group">
                        {/* Placeholder for About Image */}
                        <div className="absolute inset-0 bg-gradient-to-br from-[#28a745] to-[#1a2332] opacity-80" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Quote size={64} className="text-[#FDB931] opacity-20" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Values Grid */}
            <section className="py-20 bg-[#151b26]">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl font-bold text-center mb-16 font-heading">Nos <span className="text-[#28a745]">Valeurs</span></h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { title: "Authenticité", desc: "Respect profond de nos traditions et de la culture locale." },
                            { title: "Transparence", desc: "Clarté totale sur les coûts, les délais et les procédures." },
                            { title: "Engagement", desc: "Un suivi personnalisé jusqu'à la réussite complète de votre projet." }
                        ].map((val, i) => (
                            <div key={i} className="text-center p-8 glass-card hover:border-[#FDB931]/50 transition-colors rounded-xl">
                                <div className="w-16 h-16 mx-auto bg-gold-gradient rounded-full flex items-center justify-center mb-6 shadow-lg">
                                    <span className="text-2xl font-bold text-[#1a2332]">{i + 1}</span>
                                </div>
                                <h3 className="text-xl font-bold mb-4 text-white">{val.title}</h3>
                                <p className="text-gray-400">{val.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
