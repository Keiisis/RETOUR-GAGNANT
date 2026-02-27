'use client';

import { useList, useNavigation, useDelete } from "@refinedev/core";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, Trash2, Edit2, ShieldCheck, Zap,
    ArrowRight, Search, Loader2, LayoutGrid,
    Menu, Star, Settings2, Sparkles, Layers
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ServicesList() {
    const { create, edit } = useNavigation();
    const queryResult = useList({
        resource: "services",
        pagination: { pageSize: 12 },
        sorters: [{ field: "created_at", order: "asc" }]
    });

    const { mutate: deleteItem } = useDelete();
    const [searchTerm, setSearchTerm] = useState("");

    const data = (queryResult as any).data || (queryResult as any).query?.data; const isLoading = (queryResult as any).isLoading || (queryResult as any).query?.isLoading; const items = data?.data || [];
    const filteredItems = items.filter((item: any) =>
        item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-12 animate-in fade-in zoom-in-95 duration-1000">
            {/* ═══════════════════════════════════════════ */}
            {/* LAB HEADER */}
            {/* ═══════════════════════════════════════════ */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[#008751]">
                        <Layers size={18} />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em]">Ingénierie de Services v2.0</span>
                    </div>
                    <h1 className="text-6xl font-black text-white font-heading tracking-tighter leading-none">
                        SOLUTIONS <span className="text- benin-gradient">PREMIUM</span>
                    </h1>
                    <p className="text-gray-500 max-w-xl font-medium text-sm leading-relaxed">
                        Concevez et déployez des offres d'accompagnement haut de gamme pour la diaspora béninoise.
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-[#0a0f18] p-2 rounded-[2rem] border border-white/5 shadow-2xl">
                    <div className="relative w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder="Rechercher une solution..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white text-xs font-bold focus:outline-none focus:border-[#008751]/40 transition-all placeholder:text-gray-600"
                        />
                    </div>
                    <Button
                        onClick={() => create("services")}
                        className="bg-[#008751] hover:bg-[#00a86b] text-white h-12 px-6 rounded-2xl font-black tracking-widest gap-2 shadow-xl shadow-green-500/10 transition-all"
                    >
                        <Plus size={18} /> CRÉER
                    </Button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* SERVICES LAB GRID */}
            {/* ═══════════════════════════════════════════ */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40">
                    <div className="w-16 h-16 relative">
                        <div className="absolute inset-0 border-4 border-[#008751]/20 rounded-2xl" />
                        <div className="absolute inset-0 border-4 border-[#008751] rounded-2xl animate-spin border-t-transparent" />
                        <Zap size={24} className="absolute inset-0 m-auto text-[#008751] animate-pulse" />
                    </div>
                    <p className="mt-6 text-[10px] text-gray-600 font-black uppercase tracking-[0.4em]">Initialisation des modules...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-10">
                    <AnimatePresence mode="popLayout">
                        {filteredItems.map((item: any, index: number) => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <Card className="group relative bg-[#0a0f18] border-white/5 rounded-[3rem] p-10 overflow-hidden hover:border-[#008751]/50 transition-all duration-700 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] h-full flex flex-col justify-between">
                                    {/* Design Elements */}
                                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#008751]/5 rounded-full blur-[100px] group-hover:bg-[#008751]/10 transition-colors" />
                                    <div className="absolute top-10 right-10 opacity-5 group-hover:opacity-20 transition-opacity">
                                        <ShieldCheck size={120} className="text-white" />
                                    </div>

                                    <div>
                                        {/* Icon & Index */}
                                        <div className="flex justify-between items-start mb-10">
                                            <div className="w-20 h-20 rounded-[2rem] bg-benin-gradient p-[1px] shadow-2xl group-hover:rotate-6 transition-transform duration-500">
                                                <div className="w-full h-full bg-[#0a0f18] rounded-[2rem] flex items-center justify-center">
                                                    <ShieldCheck size={32} className="text-[#008751]" />
                                                </div>
                                            </div>
                                            <span className="text-4xl font-black text-white/5 font-heading">0{index + 1}</span>
                                        </div>

                                        {/* Content */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2">
                                                <Sparkles size={14} className="text-[#FCD116]" />
                                                <span className="text-[10px] font-black text-[#008751] uppercase tracking-[0.3em]">Module Actif</span>
                                            </div>
                                            <h3 className="text-3xl font-black text-white font-heading tracking-tight group-hover:text-[#FCD116] transition-colors">{item.title}</h3>
                                            <p className="text-gray-500 text-sm leading-relaxed font-medium line-clamp-3 group-hover:text-gray-300 transition-colors italic">
                                                {item.description}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Hub */}
                                    <div className="mt-12 flex items-center justify-between gap-6">
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => edit("services", item.id)}
                                                className="w-14 h-14 bg-white/5 text-gray-400 rounded-2xl flex items-center justify-center hover:bg-white hover:text-black transition-all shadow-xl"
                                                title="Éditer la solution"
                                            >
                                                <Settings2 size={20} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm("Désactiver et archiver cette solution ?")) deleteItem({ resource: "services", id: item.id });
                                                }}
                                                className="w-14 h-14 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-xl"
                                                title="Supprimer la solution"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => edit("services", item.id)}
                                            className="h-14 flex-1 bg-white/[0.03] border border-white/5 rounded-2xl flex items-center justify-center gap-3 text-xs font-black text-white uppercase tracking-widest hover:bg-white/10 hover:border-[#008751]/30 transition-all group/btn"
                                        >
                                            <span>Configuration</span>
                                            <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                                        </button>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {filteredItems.length === 0 && !isLoading && (
                        <div className="col-span-full py-40 border-4 border-dashed border-white/5 rounded-[4rem] text-center bg-white/[0.02]">
                            <LayoutGrid size={64} className="mx-auto text-gray-800 mb-6" />
                            <h3 className="text-gray-400 font-black uppercase tracking-[0.3em] text-sm">Le laboratoire est vide.</h3>
                            <p className="text-gray-600 text-xs mt-2 uppercase font-bold tracking-widest">Lancez une nouvelle série d'offres.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
