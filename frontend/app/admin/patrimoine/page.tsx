'use client';

import { useTranslation, T } from '@/lib/translation';
import { useList, useNavigation, useDelete, useUpdate } from "@refinedev/core";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, Edit2, Trash2, MapPin, Search,
    Filter, Loader2, BookOpen, Layers,
    Sparkles, ArrowRight, Star, ImageIcon,
    Settings2, ChevronRight, Globe, ScrollText
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BaseRecord } from "@refinedev/core";

export interface Patrimoine extends BaseRecord {
    id: string;
    title?: string;
    description?: string;
    location?: string;
    imagename?: string;
    imageName?: string;
    gallery?: string[];
    created_at?: string;
}

export default function PatrimonioList() {
    const { t } = useTranslation();
    const { create, edit } = useNavigation();
    const queryResult = useList<Patrimoine>({
        resource: "patrimoine",
        pagination: { pageSize: 12 },
        sorters: [{ field: "created_at", order: "desc" }]
    });

    const { mutate: deleteItem } = useDelete();
    const { mutate: updateItem } = useUpdate();
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState('all');

    const returnedData = (queryResult as unknown as { data?: { data: Patrimoine[] }, query?: { data?: { data: Patrimoine[] } } }).data ||
        (queryResult as unknown as { query?: { data?: { data: Patrimoine[] } } }).query?.data;
    const isLoading = (queryResult as unknown as { isLoading?: boolean }).isLoading ||
        (queryResult as unknown as { query?: { isLoading?: boolean } }).query?.isLoading;

    const items = returnedData?.data || [];

    const filteredItems = items.filter((item) =>
        item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-top-4 duration-1000">
            {/* ═══════════════════════════════════════════ */}
            {/* ARCHIVE HEADER */}
            {/* ═══════════════════════════════════════════ */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-[#FCD116]">
                        <ScrollText size={20} />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em]"><T>Curateur National des Trésors</T></span>
                    </div>
                    <h1 className="text-7xl font-black text-white font-heading tracking-tighter leading-none">
                        HERITAGE <span className="text- benin-gradient"><T>VAULT</T></span>
                    </h1>
                    <p className="text-gray-500 max-w-2xl font-medium text-lg leading-relaxed">
                        Gérez le patrimoine culturel et historique du Bénin. Chaque archive est un pont entre le passé glorieux et le futur numérique.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-6 w-full xl:w-auto">
                    <div className="relative flex-1 min-w-[320px]">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                        <input
                            type="text"
                            placeholder={t("Rechercher dans les archives...")}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#0a0f18] border-2 border-white/5 rounded-[2rem] py-5 pl-14 pr-6 text-white text-sm font-bold focus:outline-none focus:border-[#FCD116]/40 transition-all placeholder:text-gray-700"
                        />
                    </div>

                    <Button
                        onClick={() => create("patrimoine")}
                        className="h-16 px-10 rounded-[1.5rem] bg-white text-black font-black tracking-[0.2em] gap-3 shadow-[0_20px_40px_-5px_rgba(255,255,255,0.1)] hover:bg-[#FCD116] transition-all transform active:scale-95 group"
                    >
                        <Plus size={24} className="group-hover:rotate-90 transition-transform" /> ARCHIVER UN TRÉSOR
                    </Button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* HERITAGE GRID - CINEMATIC CARDS */}
            {/* ═══════════════════════════════════════════ */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-60">
                    <div className="relative">
                        <div className="w-24 h-24 border-b-2 border-t-2 border-[#FCD116] rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <BookOpen size={32} className="text-[#FCD116] animate-pulse" />
                        </div>
                    </div>
                    <p className="mt-8 text-[10px] text-gray-600 font-black uppercase tracking-[0.6em] animate-pulse"><T>Ouverture des Sceaux...</T></p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-10">
                    <AnimatePresence mode="popLayout">
                        {filteredItems.map((item, index: number) => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.6, delay: index * 0.08 }}
                            >
                                <Card className="group relative bg-[#0a0f18] border-white/5 rounded-[3rem] overflow-hidden shadow-3xl hover:border-[#FCD116]/30 transition-all duration-700 h-[500px]">
                                    {/* Ambient Glow */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-benin-gradient opacity-0 group-hover:opacity-10 blur-[60px] transition-opacity" />

                                    {/* Image Base */}
                                    <div className="absolute inset-0">
                                        {(() => {
                                            const imageSource = item.imagename || item.imageName;
                                            return (
                                                <Image
                                                    src={imageSource ? (imageSource.startsWith('http') ? imageSource : `/assets/patrimoine/${imageSource}`) : '/images/placeholder.jpg'}
                                                    alt={item.title || 'Patrimoine'}
                                                    fill
                                                    className="object-cover group-hover:scale-110 transition-transform duration-1000 grayscale-[0.2] group-hover:grayscale-0"
                                                />
                                            );
                                        })()}
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f18] via-[#0a0f18]/40 to-transparent" />
                                    </div>

                                    {/* Top Metadata */}
                                    <div className="absolute top-8 left-8 right-8 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-[-10px] group-hover:translate-y-0">
                                        <div className="px-5 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-2">
                                            <MapPin size={14} className="text-[#FCD116]" />
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">{item.location || 'BÉNIN'}</span>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); edit("patrimoine", item.id); }}
                                                title="Modifier cette archive"
                                                className="w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-white hover:text-black transition-all"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm("Défendre cette archive ou la supprimer ?")) deleteItem({ resource: "patrimoine", id: item.id });
                                                }}
                                                className="w-12 h-12 bg-red-500/20 backdrop-blur-xl border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all"
                                                title="Supprimer cette archive"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Bottom Info */}
                                    <div className="absolute bottom-0 left-0 w-full p-10 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-[#008751]" />
                                            <span className="text-[10px] font-black text-[#008751] uppercase tracking-[0.4em]"><T>Archive Déployée</T></span>
                                        </div>

                                        <h3 className="text-3xl font-black text-white font-heading leading-none group-hover:text-[#FCD116] transition-colors">
                                            {item.title}
                                        </h3>

                                        <p className="text-gray-400 text-sm font-medium leading-relaxed line-clamp-2 opacity-60 group-hover:opacity-100 group-hover:text-gray-200 transition-all duration-500">
                                            {item.description}
                                        </p>

                                        <div className="pt-4 flex items-center gap-6">
                                            <button
                                                onClick={() => edit("patrimoine", item.id)}
                                                className="group/btn flex items-center gap-3 text-[10px] font-black text-white uppercase tracking-[0.3em]"
                                            >
                                                Configuration
                                                <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                                            </button>

                                            <div className="h-[1px] flex-1 bg-white/10" />

                                            <div className="flex items-center gap-2">
                                                <ImageIcon size={14} className="text-gray-600" />
                                                <span className="text-[10px] font-mono text-gray-600">{(item.gallery?.length || 0) + 1}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* Create New Card (Ghost) */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group relative bg-white/[0.02] border-4 border-dashed border-white/5 rounded-[3rem] overflow-hidden flex flex-col items-center justify-center p-10 hover:bg-white/[0.05] hover:border-[#FCD116]/20 transition-all cursor-pointer h-[500px]"
                        onClick={() => create("patrimoine")}
                    >
                        <div className="w-24 h-24 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-[#FCD116]/40 transition-all">
                            <Plus size={40} className="text-gray-600 group-hover:text-[#FCD116]" />
                        </div>
                        <h3 className="text-white font-black font-heading text-xl uppercase tracking-widest text-center"><T>Ajouter un Joyau</T></h3>
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.4em] mt-2"><T>Expansion de l&apos;Archive</T></p>
                    </motion.div>
                </div>
            )}

            {/* QUICK STATS VAULT */}
            <div className="flex flex-wrap gap-8 py-10 border-t border-white/5">
                <div className="flex items-baseline gap-4">
                    <span className="text-6xl font-black text-white font-heading">{items.length}</span>
                    <span className="text-xs font-black text-[#FCD116] uppercase tracking-[0.5em]"><T>Trésors Répertoriés</T></span>
                </div>
                <div className="h-16 w-[1px] bg-white/5 hidden md:block" />
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/5 rounded-2xl text-[#008751]">
                        <Globe size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest"><T>Couverture Géographique</T></p>
                        <p className="text-white font-bold text-sm"><T>Pancan-Bénin • Diaspora</T></p>
                    </div>
                </div>
            </div>
        </div>
    );
}
