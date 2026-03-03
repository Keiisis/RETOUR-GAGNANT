'use client';

import { useList, useNavigation, useDelete, useUpdate } from "@refinedev/core";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, Trash2, Edit2, User, Star, Quote,
    CheckCircle, Search, Loader2,
    MessageSquareQuote, MapPin
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { BaseRecord } from "@refinedev/core";

export interface Testimonial extends BaseRecord {
    id: string;
    created_at?: string;
    name: string;
    text: string;
    photo?: string | null;
    location?: string | null;
    rating?: number | null;
    service?: string | null;
    approved: boolean;
}

export default function TestimonialsList() {
    const { create, edit } = useNavigation();
    const queryResult = useList<Testimonial>({
        resource: "testimonials",
        pagination: { pageSize: 12 },
        sorters: [{ field: "created_at", order: "desc" }]
    });

    const { mutate: deleteItem } = useDelete();
    const { mutate: updateItem } = useUpdate();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');

    const queryInternal = queryResult as unknown as Record<string, unknown>
    const queryObj = (queryInternal.query ?? queryInternal) as Record<string, boolean | undefined>
    const isLoading = queryObj.isLoading ?? false
    const resultData = queryResult.result ?? (queryInternal.data as { data?: Testimonial[] } | undefined)
    const items: Testimonial[] = resultData?.data ?? [];
    const filteredItems = items.filter((item) => {
        const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.text?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'approved' && item.approved) ||
            (statusFilter === 'pending' && !item.approved);
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* ═══════════════════════════════════════════ */}
            {/* HEADER SECTION */}
            {/* ═══════════════════════════════════════════ */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#3b82f6]">
                        <Quote size={18} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Preçuve Sociale & Impact</span>
                    </div>
                    <h1 className="text-5xl font-black text-white font-heading tracking-tighter">
                        LES <span className="text- benin-gradient">VOIX</span> DE LA DIASPORA
                    </h1>
                    <p className="text-gray-500 max-w-xl text-sm font-medium">Gérez les témoignages et la réputation de Retour Gagnant auprès de la communauté.</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Rechercher par nom ou contenu..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#0a0f18] border-2 border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-[#3b82f6]/40 transition-all font-medium"
                        />
                    </div>

                    <Button
                        onClick={() => create("testimonials")}
                        className="bg-white text-black h-14 px-8 rounded-2xl font-black tracking-widest gap-2 shadow-2xl hover:bg-[#FCD116] transition-all transform active:scale-95"
                    >
                        <Plus size={20} /> AJOUTER
                    </Button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* STATS & FILTERS */}
            {/* ═══════════════════════════════════════════ */}
            <div className="flex flex-wrap items-center gap-6">
                <div className="flex bg-[#0a0f18] p-1.5 rounded-2xl border border-white/5 shadow-inner">
                    {(['all', 'approved', 'pending'] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                statusFilter === s ? "bg-[#3b82f6] text-white shadow-lg shadow-[#3b82f6]/20" : "text-gray-500 hover:text-white"
                            )}
                        >
                            {s === 'all' ? 'Tous' : s === 'approved' ? 'Approuvés' : 'En Attente'}
                        </button>
                    ))}
                </div>

                <div className="h-6 w-[1px] bg-white/10 hidden md:block" />

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]" />
                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none">
                            {items.filter((i) => i.approved).length} Approuvés
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_#f97316]" />
                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none">
                            {items.filter((i) => !i.approved).length} À Modérer
                        </span>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* TESTIMONIALS GRID */}
            {/* ═══════════════════════════════════════════ */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40">
                    <Loader2 className="animate-spin text-[#3b82f6] opacity-50 mb-4" size={48} />
                    <p className="text-gray-600 font-black uppercase tracking-[0.3em] text-[10px]">Collecte des avis...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    <AnimatePresence mode="popLayout">
                        {filteredItems.map((item, index: number) => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.4, delay: (index % 12) * 0.05 }}
                            >
                                <Card className={cn(
                                    "relative bg-[#0a0f18] border-white/5 rounded-[2.5rem] p-8 overflow-hidden group hover:border-[#3b82f6]/40 transition-all duration-500 shadow-2xl h-full flex flex-col justify-between",
                                    !item.approved && "border-orange-500/20"
                                )}>
                                    {/* Glass Pattern Background */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#3b82f6]/5 rounded-full blur-[60px] pointer-events-none group-hover:scale-150 transition-transform" />

                                    <div className="relative z-10 space-y-6">
                                        {/* Avatar & Info */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-2xl bg-benin-gradient p-0.5 shadow-xl">
                                                    <div className="w-full h-full bg-[#0a0f18] rounded-[14px] flex items-center justify-center overflow-hidden">
                                                        {item.photo ? (
                                                            <Image src={item.photo} alt={item.name} fill className="object-cover" />
                                                        ) : (
                                                            <User size={24} className="text-gray-500" />
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="text-white font-bold text-lg leading-tight">{item.name}</h4>
                                                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                                        <MapPin size={10} className="text-[#3b82f6]" />
                                                        {item.location || 'Diaspora'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-1.5">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star key={i} size={10} className={i < (item.rating || 5) ? "fill-[#FCD116] text-[#FCD116]" : "text-gray-700"} />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Quote Text */}
                                        <div className="relative pt-4">
                                            <Quote size={40} className="absolute -top-2 -left-4 text-white/5 pointer-events-none" />
                                            <p className="text-gray-400 text-sm leading-relaxed font-medium line-clamp-4 group-hover:text-gray-200 transition-colors italic">
                                                "{item.text}"
                                            </p>
                                        </div>

                                        {/* Category Badge */}
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/5 rounded-full">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#FCD116]" />
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{item.service || 'Service Global'}</span>
                                        </div>
                                    </div>

                                    {/* Actions Table Footer */}
                                    <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-between">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => edit("testimonials", item.id)}
                                                title="Modifier"
                                                className="p-3 bg-white/5 text-gray-400 rounded-xl hover:bg-white/10 hover:text-white transition-all"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm("Confirmer la suppression ?")) deleteItem({ resource: "testimonials", id: item.id });
                                                }}
                                                title="Supprimer"
                                                className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        {item.approved ? (
                                            <button
                                                onClick={() => updateItem({ resource: "testimonials", id: item.id, values: { approved: false } })}
                                                className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 border border-green-500/20 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-green-500 hover:text-white transition-all"
                                            >
                                                <CheckCircle size={14} /> LIVE
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => updateItem({ resource: "testimonials", id: item.id, values: { approved: true } })}
                                                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-white hover:text-black shadow-xl shadow-orange-500/20 transition-all animate-pulse"
                                            >
                                                MODÉRER
                                            </button>
                                        )}
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {filteredItems.length === 0 && !isLoading && (
                        <div className="col-span-full py-20 text-center bg-white/5 rounded-3xl border-2 border-dashed border-white/5">
                            <MessageSquareQuote size={48} className="mx-auto text-gray-800 mb-4" />
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs font-heading">Aucun témoignage ne correspond à l'archive.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
