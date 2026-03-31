'use client';

import { useTranslation, T } from '@/lib/translation';
import { useList, useNavigation, useDelete, useUpdate } from "@refinedev/core";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bell, Trash2, Search, Mail, Clock,
    ChevronRight, Map, Loader2, AlertCircle
} from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface NotificationItem {
    id: string
    nom?: string
    prenom?: string
    email?: string
    sujet?: string
    message?: string
    type?: string
    lu?: boolean
    created_at: string
}

export default function AdminNotificationsPage() {
    const { t } = useTranslation();
    const { show } = useNavigation();
    const queryResult = useList<NotificationItem>({
        resource: "messages",
        pagination: { pageSize: 50 },
        sorters: [{ field: "created_at", order: "desc" }],
        filters: [
            { field: "type", operator: "eq", value: "nationality" }
        ]
    });

    const { mutate: deleteItem } = useDelete();
    const { mutate: updateItem } = useUpdate();
    const [searchTerm, setSearchTerm] = useState("");
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    const data = queryResult.query?.data;
    const isLoading = queryResult.query?.isLoading;
    const items: NotificationItem[] = data?.data || [];

    const filteredItems = items.filter((item) => {
        const matchesSearch = item.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.sujet?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'all' || (filter === 'unread' && !item.lu);
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-1000">
            {/* ═══════════════════════════════════════════ */}
            {/* HEADER */}
            {/* ═══════════════════════════════════════════ */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#E8112D]">
                        <Bell size={18} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]"><T>Alertes & Demandes</T></span>
                    </div>
                    <h1 className="text-5xl font-black text-white font-heading tracking-tighter">
                        CENTRE <span className="text-benin-gradient"><T>NOTIFICATIONS</T></span>
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                    <div className="relative w-full lg:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder={t("Rechercher dans les alertes...")}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#0a0f18] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white text-xs font-bold focus:outline-none focus:border-[#E8112D]/40 transition-all"
                        />
                    </div>

                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                        <button
                            onClick={() => setFilter('all')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                filter === 'all' ? "bg-white text-black shadow-lg" : "text-gray-500 hover:text-white"
                            )}
                        >
                            <T>Toutes</T>
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                filter === 'unread' ? "bg-[#E8112D] text-white shadow-lg" : "text-gray-500 hover:text-white"
                            )}
                        >
                            <T>Non lues</T>
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* CONTENT LIST */}
            {/* ═══════════════════════════════════════════ */}
            <div className="grid grid-cols-1 gap-4 relative">
                {/* Background ambient light */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[400px] bg-[#E8112D]/5 blur-[120px] rounded-full pointer-events-none" />

                {isLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="animate-spin text-[#E8112D]" size={40} />
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest animate-pulse"><T>Synchronisation...</T></p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="bg-[#0a0f18] border border-white/5 rounded-3xl p-20 flex flex-col items-center justify-center text-center">
                        <div className="w-24 h-24 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center mb-6">
                            <Bell size={40} className="text-gray-500 opacity-50" />
                        </div>
                        <h3 className="text-2xl font-black text-white font-heading tracking-tight mb-2 uppercase"><T>Aucune notification</T></h3>
                        <p className="text-gray-500 max-w-sm text-sm"><T>Vous n&apos;avez aucune alerte de nationalité correspondant à vos critères.</T></p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {filteredItems.map((item, index) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className={cn(
                                    "p-0 overflow-hidden group hover:scale-[1.01] transition-all duration-300 border-none",
                                    !item.lu ? "bg-gradient-to-r from-[#E8112D]/10 to-[#0a0f18]" : "bg-[#0a0f18]"
                                )}>
                                    <div className={cn(
                                        "px-6 py-5 flex flex-col md:flex-row gap-6 border-l-4",
                                        !item.lu ? "border-[#E8112D]" : "border-white/5 hover:border-white/20"
                                    )}>
                                        {/* Avatar / Icon */}
                                        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/5 group-hover:border-white/10 transition-colors shrink-0">
                                            {item.type === 'nationality' ? (
                                                <Map size={24} className={!item.lu ? "text-[#E8112D]" : "text-gray-500"} />
                                            ) : (
                                                <AlertCircle size={24} className="text-gray-500" />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 space-y-1 justify-center flex flex-col">
                                            <div className="flex items-center gap-3">
                                                <h3 className={cn(
                                                    "text-lg font-bold truncate",
                                                    !item.lu ? "text-white" : "text-gray-400"
                                                )}>
                                                    Demande de Nationalité : {item.nom} {item.prenom}
                                                </h3>
                                                {!item.lu && (
                                                    <span className="px-2.5 py-1 rounded-md bg-[#E8112D] text-white text-[9px] font-black uppercase tracking-widest animate-pulse">
                                                        <T>Nouveau</T>
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                                                    <Mail size={12} className="text-gray-600" />
                                                    {item.email}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono bg-white/[0.02] px-2 py-1 border border-white/5 rounded-md">
                                                    <Clock size={12} className="text-gray-600" />
                                                    {new Date(item.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 justify-end shrink-0 pointer-events-auto">
                                            <button
                                                onClick={() => {
                                                    updateItem({
                                                        resource: "messages",
                                                        id: item.id,
                                                        values: { lu: !item.lu }
                                                    })
                                                }}
                                                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-gray-400 hover:text-white transition-all shadow-sm"
                                                title={item.lu ? "Marquer non lu" : "Marquer comme lu"}
                                            >
                                                {item.lu ? <AlertCircle size={16} /> : <div className="w-4 h-4 rounded-full bg-[#E8112D] shadow-[0_0_10px_#E8112D]" />}
                                            </button>

                                            <button
                                                onClick={() => show("messages", item.id)}
                                                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-[#FCD116] transition-all shadow-sm"
                                                title="Voir les détails"
                                            >
                                                <ChevronRight size={16} />
                                            </button>

                                            <button
                                                onClick={() => {
                                                    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette alerte ?")) {
                                                        deleteItem({
                                                            resource: "messages",
                                                            id: item.id
                                                        });
                                                    }
                                                }}
                                                className="p-3 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/5 hover:border-red-500/30 text-red-500 hover:text-red-400 transition-all shadow-sm group/trash"
                                                title="Supprimer"
                                            >
                                                <Trash2 size={16} className="group-hover/trash:scale-110 transition-transform" />
                                            </button>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
