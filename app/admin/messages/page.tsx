'use client';

import { useList, useNavigation, useDelete, useUpdate } from "@refinedev/core";
import { motion, AnimatePresence } from "framer-motion";
import {
    MessageSquare, Trash2, Search, Mail, Calendar, Clock,
    ChevronRight, User, Loader2, Inbox, AlertCircle, LucideIcon
} from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MessageItem {
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

export default function MessagesList() {
    const { show } = useNavigation();
    const queryResult = useList<MessageItem>({
        resource: "messages",
        pagination: { pageSize: 20 },
        sorters: [{ field: "created_at", order: "desc" }]
    });

    const { mutate: deleteItem } = useDelete();
    const { mutate: updateItem } = useUpdate();
    const [searchTerm, setSearchTerm] = useState("");
    const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

    const data = queryResult.query?.data;
    const isLoading = queryResult.query?.isLoading;
    const items: MessageItem[] = data?.data || [];
    const filteredItems = items.filter((item) => {
        const matchesSearch = item.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.sujet?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'all' ||
            (filter === 'unread' && !item.lu) ||
            (filter === 'read' && item.lu);
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-1000">
            {/* ═══════════════════════════════════════════ */}
            {/* NEXUS HEADER */}
            {/* ═══════════════════════════════════════════ */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#E8112D]">
                        <Inbox size={18} />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Flux d'Interactions Clients</span>
                    </div>
                    <h1 className="text-5xl font-black text-white font-heading tracking-tighter">
                        NEXUS <span className="text- benin-gradient">CLIENT</span>
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                    <div className="relative w-full lg:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder="Rechercher une conversion..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#0a0f18] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white text-xs font-bold focus:outline-none focus:border-[#E8112D]/40 transition-all"
                        />
                    </div>

                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                        {(['all', 'unread', 'read'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                    filter === f ? "bg-white text-black shadow-lg" : "text-gray-500 hover:text-white"
                                )}
                            >
                                {f === 'all' ? 'Inbox' : f === 'unread' ? 'Non lus' : 'Lus'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* MESSAGES LISTING */}
            {/* ═══════════════════════════════════════════ */}
            <Card className="bg-[#0a0f18] border-white/5 rounded-[2.5rem] overflow-hidden shadow-3xl">
                <div className="grid grid-cols-1 divide-y divide-white/5">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-40">
                            <Loader2 className="animate-spin text-[#E8112D] mb-4" size={40} />
                            <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest text-center italic">Scanning des liaisons entrantes...</p>
                        </div>
                    ) : filteredItems.length > 0 ? (
                        <AnimatePresence mode="popLayout">
                            {filteredItems.map((item, index: number) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.3, delay: index * 0.03 }}
                                    className={cn(
                                        "group flex flex-col md:flex-row items-start md:items-center gap-6 p-8 hover:bg-white/[0.03] transition-all cursor-pointer relative",
                                        !item.lu && "bg-white/[0.01]"
                                    )}
                                    onClick={() => {
                                        if (!item.lu) updateItem({ resource: "messages", id: item.id, values: { lu: true } });
                                        show("messages", item.id);
                                    }}
                                >
                                    {/* Status Indicator */}
                                    <div className={cn(
                                        "absolute left-0 top-0 bottom-0 w-1 transition-all opacity-0 group-hover:opacity-100",
                                        !item.lu ? "bg-[#E8112D]" : "bg-gray-700"
                                    )} />

                                    {/* Sender Avatar */}
                                    <div className="relative">
                                        <div className={cn(
                                            "w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 group-hover:rotate-3",
                                            !item.lu ? "bg-[#E8112D]/10 border-[#E8112D]/30" : "bg-white/5 border-white/5"
                                        )}>
                                            <User size={24} className={!item.lu ? "text-[#E8112D]" : "text-gray-500"} />
                                        </div>
                                        {!item.lu && (
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#E8112D] border-3 border-[#0a0f18] rounded-full animate-pulse shadow-[0_0_10px_#E8112D]" />
                                        )}
                                    </div>

                                    {/* Sender Info */}
                                    <div className="w-full md:w-56 overflow-hidden">
                                        <h4 className={cn(
                                            "text-sm font-bold truncate tracking-tight transition-colors",
                                            !item.lu ? "text-white" : "text-gray-400 group-hover:text-white"
                                        )}>
                                            {item.nom} {item.prenom}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Mail size={10} className="text-gray-600" />
                                            <p className="text-[10px] text-gray-500 truncate lowercase">{item.email}</p>
                                        </div>
                                    </div>

                                    {/* Message Content Preview */}
                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex items-center gap-2 mb-1">
                                            {item.type === 'rdv' && (
                                                <span className="px-2 py-0.5 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] text-[8px] font-black uppercase tracking-tighter border border-[#3b82f6]/20">
                                                    RDV
                                                </span>
                                            )}
                                            {item.type === 'support' && (
                                                <span className="px-2 py-0.5 rounded-full bg-[#FCD116]/10 text-[#FCD116] text-[8px] font-black uppercase tracking-tighter border border-[#FCD116]/20 shadow-[0_0_10px_rgba(252,209,22,0.2)]">
                                                    SUPPORT IA
                                                </span>
                                            )}
                                            <h5 className={cn(
                                                "text-xs font-bold truncate transition-colors",
                                                !item.lu ? "text-[#FCD116]" : "text-gray-400 group-hover:text-[#FCD116]"
                                            )}>
                                                {item.sujet || (item.type === 'rdv' ? 'Demande de Rendez-vous' : item.type === 'support' ? "Assistance Client" : 'Prise de contact')}
                                            </h5>
                                        </div>
                                        <p className="text-xs text-gray-500 line-clamp-1 italic font-medium group-hover:text-gray-400">
                                            "{item.message}"
                                        </p>
                                    </div>

                                    {/* Metadata & Actions */}
                                    <div className="flex items-center gap-8 flex-shrink-0">
                                        <div className="text-right hidden sm:block">
                                            <div className="flex items-center justify-end gap-2 text-gray-600 mb-0.5">
                                                <Clock size={10} />
                                                <span className="text-[9px] font-bold uppercase tracking-widest">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="text-[9px] text-gray-700 font-mono tracking-tighter">
                                                {new Date(item.created_at).toLocaleDateString()}
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm("Confirmer la suppression archivée ?")) deleteItem({ resource: "messages", id: item.id });
                                                }}
                                                className="p-3 rounded-xl bg-white/5 text-gray-600 hover:bg-red-500/10 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <div className="p-3 rounded-xl bg-white/5 text-gray-600 group-hover:bg-[#FCD116] group-hover:text-black transition-all">
                                                <ChevronRight size={18} />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    ) : (
                        <div className="py-40 flex flex-col items-center justify-center opacity-40">
                            <AlertCircle size={64} className="text-gray-800 mb-6" />
                            <p className="text-gray-500 font-black uppercase tracking-[0.4em] text-sm">Silence Opérationnel</p>
                            <p className="text-[10px] text-gray-700 mt-2 font-bold uppercase">Aucune liaison active dans cet espace.</p>
                        </div>
                    )}
                </div>
            </Card>

            {/* QUICK STATS FOOTER */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-60 hover:opacity-100 transition-opacity">
                <QuickStat value={items.length} label="Total Liaison" icon={MessageSquare} />
                <QuickStat value={items.filter((i) => !i.lu).length} label="Urgences" icon={AlertCircle} color="#E8112D" />
                <QuickStat value={items.filter((i) => i.type === 'rdv').length} label="Rendez-vous" icon={Calendar} color="#3b82f6" />
            </div>
        </div>
    );
}

interface QuickStatProps {
    value: number
    label: string
    icon: LucideIcon
    color?: string
}

function QuickStat({ value, label, icon: Icon, color = "gray" }: QuickStatProps) {
    return (
        <Card className="bg-[#0a0f18] border-white/5 p-6 rounded-3xl flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-white/5">
                    <Icon size={20} style={{ color }} />
                </div>
                <div>
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest">{label}</p>
                    <h5 className="text-2xl font-black text-white font-heading leading-tight">{value}</h5>
                </div>
            </div>
            <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-benin-gradient w-1/2" />
            </div>
        </Card>
    );
}
