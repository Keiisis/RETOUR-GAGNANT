"use client";

import { useState } from "react";
import PartnerCard, { Partner } from "./PartnerCard";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// --- MOCK DATA ---
const MOCK_PARTNERS: Partner[] = [
    {
        id: 1,
        name: "Immo Bénin Prestige",
        description: "Agence immobilière de luxe spécialisée dans les villas et appartements meublés à Cotonou et Ouidah.",
        logo: "/assets/partners/logo-immo.png",
        coverImage: "/assets/partners/cover-immo.jpg",
        category: "Immobilier",
        location: "Cotonou, Haie Vive",
        isPremium: true,
        products: [
            { id: 101, name: "Villa Fidjrossè", image: "/assets/partners/p1.jpg" },
            { id: 102, name: "Appt Gbégamey", image: "/assets/partners/p2.jpg" },
            { id: 103, name: "Terrain Ouidah", image: "/assets/partners/p3.jpg" },
        ]
    },
    {
        id: 2,
        name: "Saveurs du Terroir",
        description: "Exportation de produits agroalimentaires béninois bio : ananas pain de sucre, cajou, et jus naturels.",
        logo: "/assets/partners/logo-food.png",
        coverImage: "/assets/partners/cover-food.jpg",
        category: "Agro-Business",
        location: "Abomey-Calavi",
        products: [
            { id: 201, name: "Jus d'Ananas", image: "/assets/partners/p4.jpg" },
            { id: 202, name: "Noix de Cajou", image: "/assets/partners/p5.jpg" },
            { id: 203, name: "Gari Soja", image: "/assets/partners/p6.jpg" },
        ]
    },
    {
        id: 3,
        name: "Art & Racines",
        description: "Galerie d'art proposant des sculptures, masques et toiles d'artistes contemporains béninois.",
        logo: "/assets/partners/logo-art.png",
        coverImage: "/assets/partners/cover-art.jpg",
        category: "Art & Culture",
        location: "Ouidah",
        isPremium: true,
        products: [
            { id: 301, name: "Masque Guèlèdé", image: "/assets/partners/p7.jpg" },
            { id: 302, name: "Toile Zinkpè", image: "/assets/partners/p8.jpg" },
            { id: 303, name: "Bronze Ifè", image: "/assets/partners/p9.jpg" },
        ]
    },
    {
        id: 4,
        name: "Tech Hub Cotonou",
        description: "Espace de coworking et incubateur pour startups numériques. Accompagnement technique et levée de fonds.",
        logo: "/assets/partners/logo-tech.png",
        coverImage: "/assets/partners/cover-tech.jpg",
        category: "Services & Tech",
        location: "Cotonou, Ganhi",
        products: [
            { id: 401, name: "Bureau Privé", image: "/assets/partners/p10.jpg" },
            { id: 402, name: "Formation Dev", image: "/assets/partners/p11.jpg" },
        ]
    }
];

const CATEGORIES = ["Tous", "Immobilier", "Agro-Business", "Art & Culture", "Services & Tech", "Mode & Beauté"];

export default function PartnerDirectory() {
    const [selectedCategory, setSelectedCategory] = useState("Tous");
    const [searchQuery, setSearchQuery] = useState("");

    const filteredPartners = MOCK_PARTNERS.filter(partner => {
        const matchesCategory = selectedCategory === "Tous" || partner.category === selectedCategory;
        const matchesSearch = partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            partner.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <section className="py-12 bg-gray-50 min-h-screen">
            <div className="container mx-auto px-4">

                {/* Controls */}
                <div className="flex flex-col md:flex-row gap-6 justify-between items-center mb-12">
                    {/* Categories Scroll */}
                    <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto no-scrollbar mask-gradient-right">
                        {CATEGORIES.map(cat => (
                            <Button
                                key={cat}
                                variant={selectedCategory === cat ? "default" : "outline"}
                                onClick={() => setSelectedCategory(cat)}
                                className={`rounded-full whitespace-nowrap ${selectedCategory === cat ? 'bg-[#008751] hover:bg-[#006e42]' : 'border-gray-200 text-gray-600'}`}
                            >
                                {cat}
                            </Button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                            placeholder="Rechercher un partenaire..."
                            className="pl-10 bg-white border-gray-200 rounded-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredPartners.map(partner => (
                        <PartnerCard key={partner.id} partner={partner} />
                    ))}
                </div>

                {/* Empty State */}
                {filteredPartners.length === 0 && (
                    <div className="text-center py-20 opacity-50">
                        <p className="text-xl font-medium">Aucun partenaire trouvé pour cette recherche.</p>
                        <Button variant="link" onClick={() => { setSelectedCategory("Tous"); setSearchQuery("") }}>
                            Réinitialiser les filtres
                        </Button>
                    </div>
                )}
            </div>
        </section>
    );
}
