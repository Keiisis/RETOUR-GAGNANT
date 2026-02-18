"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";

export default function NationalitySection() {
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Implement actual form submission logic
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 5000); // Reset after 5s for demo
    };

    return (
        <section className="py-20 bg-gradient-to-b from-white to-[#fafafa] relative overflow-hidden" id="nationalite">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-[#008751]/5 -skew-x-12 transform origin-top-right z-0" />

            <div className="container mx-auto px-4 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                    {/* Left: Content */}
                    <div className="space-y-6">
                        <div className="inline-block px-4 py-1.5 rounded-full bg-[#E8112D]/10 text-[#E8112D] text-sm font-semibold tracking-widest uppercase mb-2">
                            Identité & Citoyenneté
                        </div>
                        <h2 className="text-4xl md:text-5xl font-bold font-heading text-[#1a2332] leading-tight">
                            Obtenir la <span className="text-benin-gradient">Nationalité Béninoise</span>
                        </h2>
                        <p className="text-lg text-gray-600 leading-relaxed">
                            Retrouvez votre fierté et vos droits. Que vous soyez descendant d'afro-descendants ou ayant des liens familiaux, nous vous accompagnons dans toutes les démarches administratives pour officialiser votre appartenance au Bénin.
                        </p>

                        <ul className="space-y-4 pt-4">
                            {[
                                "Analyse de votre éligibilité",
                                "Constitution du dossier complet",
                                "Dépôt et suivi auprès des autorités",
                                "Accompagnement jusqu'à l'obtention du passeport"
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3">
                                    <CheckCircle2 className="text-[#008751] w-5 h-5 flex-shrink-0" />
                                    <span className="text-gray-700 font-medium">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Right: Form */}
                    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 relative">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] rounded-t-2xl" />

                        <h3 className="text-2xl font-bold mb-6 text-gray-800">Vérifiez votre éligibilité</h3>

                        {submitted ? (
                            <div className="text-center py-12 space-y-4 animate-in fade-in zoom-in">
                                <div className="w-16 h-16 bg-[#008751]/10 text-[#008751] rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 size={32} />
                                </div>
                                <h4 className="text-xl font-bold text-[#008751]">Demande Reçue !</h4>
                                <p className="text-gray-600">
                                    Un expert de notre équipe va évaluer votre profil et vous recontactera sous 24h ouvrées.
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Nom</label>
                                        <Input placeholder="Votre nom" required className="bg-gray-50 border-gray-200" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Prénom</label>
                                        <Input placeholder="Votre prénom" required className="bg-gray-50 border-gray-200" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Email</label>
                                    <Input type="email" placeholder="email@exemple.com" required className="bg-gray-50 border-gray-200" />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Nationalité Actuelle</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Sélectionnez...</option>
                                        <option value="france">Française</option>
                                        <option value="usa">Américaine</option>
                                        <option value="canada">Canadienne</option>
                                        <option value="autre">Autre</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Votre Situation / Motivation</label>
                                    <Textarea
                                        placeholder="Décrivez brièvement votre lien avec le Bénin..."
                                        className="bg-gray-50 border-gray-200 min-h-[100px]"
                                    />
                                </div>

                                <Button type="submit" className="w-full bg-[#1a2332] hover:bg-[#1a2332]/90 text-white font-semibold py-6 rounded-xl transition-all shadow-lg hover:shadow-xl mt-2">
                                    <Send className="w-4 h-4 mr-2" />
                                    Demander mon étude gratuite
                                </Button>
                                <p className="text-xs text-center text-gray-400 mt-4">
                                    Vos données sont confidentielles et sécurisées.
                                </p>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
