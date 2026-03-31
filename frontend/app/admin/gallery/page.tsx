'use client';

import { useTranslation, T } from '@/lib/translation';
import { useList, useNavigation, useDelete, useUpdate } from "@refinedev/core";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Edit2, Maximize2, Grid, Image as ImageIcon, Loader2, Search, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface GalleryItem {
    id: string;
    url?: string;
    image?: string;
    image_url?: string;
    title?: string;
    category?: string;
    type?: string;
    location?: string;
    is_featured?: boolean;
    created_at?: string;
}

export default function GalleryList() {
    const { t } = useTranslation();
    const { create, edit } = useNavigation();
    const queryResult = useList<GalleryItem>({
        resource: "gallery",
        pagination: { pageSize: 24 },
        sorters: [{ field: "created_at", order: "desc" }]
    });

    const { mutate: deleteItem } = useDelete();
    const { mutate: updateItem } = useUpdate();
    const [searchTerm, setSearchTerm] = useState("");
    const [filter, setFilter] = useState<'all' | 'hero' | 'gallery'>('all');

    const queryInternal = queryResult as unknown as Record<string, unknown>
    const queryObj = (queryInternal.query ?? queryInternal) as Record<string, boolean | undefined>
    const isLoading = queryObj.isLoading ?? false
    const resultData = queryResult.result ?? (queryInternal.data as { data?: GalleryItem[] } | undefined)
    const items: GalleryItem[] = resultData?.data ?? [];

    const filteredItems = items.filter((item) => {
        const matchesSearch = (item.title?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (item.category?.toLowerCase() || "").includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'all' || item.type === filter;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-700">
            {/* ═══════════════════════════════════════════ */}
            {/* HEADER & CONTROLS */}
            {/* ═══════════════════════════════════════════ */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#FCD116]">
                        <ImageIcon size={18} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em]"><T>Média & Archives Visuelles</T></span>
                    </div>
                    <h1 className="text-5xl font-black text-white font-heading tracking-tighter">
                        GALERIE <span className="text- benin-gradient"><T>IMMERSIVE</T></span>
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                    <div className="relative flex-1 min-w-[250px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder={t("Rechercher un média...")}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#0a0f18] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-[#FCD116]/30 transition-all text-sm font-medium"
                        />
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/5 rounded-2xl">
                        {(['all', 'hero', 'gallery'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    filter === f ? "bg-[#FCD116] text-black shadow-lg" : "text-gray-500 hover:text-white"
                                )}
                            >
                                {f === 'all' ? 'Tous' : f === 'hero' ? 'Slides' : 'Mosaïque'}
                            </button>
                        ))}
                    </div>

                    <Button
                        onClick={() => create("gallery")}
                        className="bg-benin-gradient h-14 px-8 rounded-2xl text-white font-black tracking-widest gap-2 shadow-xl hover:shadow-[#FCD116]/10 transform active:scale-95 transition-all"
                    >
                        <Plus size={20} /> IMPORTER
                    </Button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* MEDIA GRID */}
            {/* ═══════════════════════════════════════════ */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40 space-y-6">
                    <div className="relative">
                        <Loader2 className="animate-spin text-[#FCD116]" size={48} />
                        <div className="absolute inset-0 blur-xl bg-[#FCD116]/20 animate-pulse" />
                    </div>
                    <p className="text-gray-500 font-mono text-xs uppercase tracking-[0.2em]"><T>Synchronisation de la photothèque...</T></p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    <AnimatePresence mode="popLayout">
                        {filteredItems.map((item, index: number) => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.4, delay: (index % 10) * 0.05 }}
                            >
                                <Card className="group relative bg-[#0a0f18] border-white/5 aspect-square overflow-hidden rounded-[2rem] hover:border-[#FCD116]/40 transition-all duration-500 shadow-2xl">
                                    <Image
                                        src={item.url || item.image || item.image_url || '/images/placeholder.jpg'}
                                        alt={item.title || "Gallery Item"}
                                        fill
                                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                                    />

                                    {/* Glass Overlay on Hover */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[2px] p-6 flex flex-col justify-between">
                                        <div className="flex justify-between items-start">
                                            <div className="px-3 py-1 bg-white/10 border border-white/10 rounded-full backdrop-blur-md">
                                                <span className="text-[10px] font-bold text-white uppercase tracking-tighter">
                                                    {item.category || item.type || 'Média'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => edit("gallery", item.id)}
                                                    className="p-2 bg-white/20 text-white rounded-xl hover:bg-[#FCD116] hover:text-black transition-all shadow-lg"
                                                    title={t("Modifier cette image")}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm("Confirmer la suppression ?")) deleteItem({ resource: "gallery", id: item.id });
                                                    }}
                                                    title="Supprimer cette image"
                                                    className="p-2 bg-red-500/20 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-4 translate-y-4 group-hover:translate-y-0 transition-transform">
                                            <div>
                                                <h4 className="text-white font-bold text-sm leading-tight line-clamp-1">{item.title || "Sans Titre"}</h4>
                                                <p className="text-[10px] text-gray-400 mt-1 uppercase font-black tracking-widest">{item.location || 'Bénin'}</p>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" className="flex-1 h-9 rounded-xl border-white/10 text-white bg-white/5 hover:bg-white/10 text-[10px]">
                                                    <Maximize2 size={12} className="mr-2" /> APERÇU
                                                </Button>
                                                {item.is_featured ? (
                                                    <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-500/20 text-green-400 border border-green-500/20">
                                                        <CheckCircle2 size={16} />
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => updateItem({ resource: "gallery", id: item.id, values: { is_featured: true } })}
                                                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-[#FCD116] hover:text-black transition-all"
                                                        title={t("Mettre en avant")}
                                                    >
                                                        <Grid size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Featured Badge */}
                                    {item.is_featured && (
                                        <div className="absolute top-4 left-4 bg-[#FCD116] text-black px-3 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.2em] shadow-lg">
                                            ⭐ Vedette
                                        </div>
                                    )}
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {filteredItems.length === 0 && !isLoading && (
                        <div className="col-span-full py-32 flex flex-col items-center justify-center bg-white/5 rounded-[3rem] border border-dashed border-white/10">
                            <ImageIcon size={48} className="text-gray-700 mb-4" />
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs"><T>Aucun média ne correspond à vos critères.</T></p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
