'use client';

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, Edit2, Trash2, Save, X } from "lucide-react";
import Image from 'next/image';

// Initial Data (Simulated from Database)
const INITIAL_ITEMS = [
    { id: 1, title: "Porte du Non-Retour", description: "Symbole mémoriel historique de la traite transatlantique.", imageName: "Porte du Non-Retour.jpg" },
    { id: 2, title: "Palais Royaux d'Abomey", description: "Vestiges de la puissance du Royaume de Dahomey.", imageName: "Palais Royaux Abomey.jpg" },
    { id: 3, title: "Cité Lacustre de Ganvié", description: "La Venise de l'Afrique, entièrement bâtie sur l'eau.", imageName: "Cité Lacustre Ganvié.jpg" },
    { id: 4, title: "Tata Somba", description: "Architecture forteresse unique au monde.", imageName: "TATA SOMBA.jpg" },
    { id: 5, title: "Zangbeto", description: "Gardien de la nuit et police traditionnelle vaudou.", imageName: "Zangpeto.jpg" },
    { id: 6, title: "Chutes de Kota", description: "Un havre de fraîcheur et de nature préservée.", imageName: "Chutes de Kota.jpg" },
    // ... complete list could be added
];

export default function PatrimoineAdmin() {
    const [items, setItems] = useState(INITIAL_ITEMS);
    const [isEditing, setIsEditing] = useState<number | null>(null); // ID being edited
    const [searchTerm, setSearchTerm] = useState("");

    // Simulate Filtering
    const filteredItems = items.filter(item =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.includes(searchTerm)
    );

    const handleDelete = (id: number) => {
        if (confirm("Êtes-vous sûr de vouloir supprimer cet élément ?")) {
            setItems(items.filter(i => i.id !== id));
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold font-heading text-white">Gestion du Patrimoine</h1>
                <Button className="bg-[#008751] hover:bg-[#006B40] text-white gap-2">
                    <Plus size={18} /> Ajouter un élément
                </Button>
            </div>

            {/* Search & Filter */}
            <div className="bg-[#1a2332] p-4 rounded-xl border border-white/5 flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#0f141e] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-[#FCD116] outline-none"
                    />
                </div>
            </div>

            {/* Content List */}
            <div className="grid grid-cols-1 gap-4">
                {filteredItems.map(item => (
                    <Card key={item.id} className="bg-[#1a2332] border-white/5 hover:border-white/10 transition-all group overflow-hidden">
                        <CardContent className="p-0 flex items-center h-32">
                            {/* Image Thumbnail */}
                            <div className="w-48 h-full relative shrink-0">
                                <Image
                                    src={`/assets/patrimoine/${item.imageName}`}
                                    alt={item.title}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    onError={(e) => e.currentTarget.src = '/images/placeholder.jpg'}
                                />
                                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
                            </div>

                            {/* Content or Edit Form */}
                            <div className="flex-1 p-6 flex justify-between items-center gap-6">
                                {isEditing === item.id ? (
                                    <div className="flex-1 gap-4 grid grid-cols-2">
                                        <input defaultValue={item.title} className="bg-[#0f141e] p-2 rounded text-white border border-white/10" />
                                        <input defaultValue={item.imageName} className="bg-[#0f141e] p-2 rounded text-white border border-white/10" />
                                        <textarea defaultValue={item.description} className="col-span-2 bg-[#0f141e] p-2 rounded text-white border border-white/10" rows={2} />
                                    </div>
                                ) : (
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                                        <p className="text-gray-400 text-sm line-clamp-2">{item.description}</p>
                                        <span className="text-xs text-[#FCD116] mt-2 block font-mono">{item.imageName}</span>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2">
                                    {isEditing === item.id ? (
                                        <>
                                            <Button size="icon" onClick={() => setIsEditing(null)} className="bg-green-600 hover:bg-green-700">
                                                <Save size={18} />
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => setIsEditing(null)}>
                                                <X size={18} />
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button size="icon" variant="ghost" onClick={() => setIsEditing(item.id)} className="hover:bg-white/10 hover:text-[#FCD116]">
                                                <Edit2 size={18} />
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="hover:bg-red-900/20 hover:text-[#E8112D]">
                                                <Trash2 size={18} />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
