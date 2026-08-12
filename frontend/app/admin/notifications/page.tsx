'use client';

import { useTranslation, T } from '@/lib/translation';
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Trash as Trash2, MagnifyingGlass as Search, Envelope as Mail, Clock, CaretRight as ChevronRight, MapTrifold as Map, CircleNotch as Loader2, WarningCircle as AlertCircle, ShoppingCart, CheckCircle as CheckCircle2, Warning as AlertTriangle } from '@phosphor-icons/react';
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from '@/lib/supabase';

// Notification unifiée (messages de nationalité + alertes commandes)
interface UnifiedNotification {
    id: string
    nom?: string
    prenom?: string
    email?: string
    sujet?: string
    message?: string
    title?: string
    type: string
    lu: boolean
    created_at: string
    order_id?: string
    source: 'messages' | 'notifications'
}

export default function AdminNotificationsPage() {
    const { t } = useTranslation();
    const [notifications, setNotifications] = useState<UnifiedNotification[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("");
    const [filter, setFilter] = useState<'all' | 'unread' | 'abandoned'>('all');

    const fetchNotifications = async () => {
        // 1. Messages de nationalité
        const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .eq('type', 'nationality')
            .order('created_at', { ascending: false })

        const msgNotifs: UnifiedNotification[] = (messages || []).map(m => ({
            id: m.id,
            nom: m.nom,
            prenom: m.prenom,
            email: m.email,
            sujet: m.sujet,
            message: m.message,
            type: m.type || 'nationality',
            lu: m.lu || false,
            created_at: m.created_at,
            source: 'messages' as const,
        }))

        // 2. Alertes commandes (paniers abandonnés + nouvelles commandes)
        const { data: orderNotifs } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)

        const cmdNotifs: UnifiedNotification[] = (orderNotifs || []).map(n => ({
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.type || 'order_update',
            lu: n.is_read || false,
            created_at: n.created_at,
            order_id: n.order_id,
            source: 'notifications' as const,
        }))

        const all = [...msgNotifs, ...cmdNotifs].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        setNotifications(all)
        setLoading(false)
    }

    useEffect(() => {
        fetchNotifications()

        const ch1 = supabase
            .channel('admin_notifs_messages')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: "type=eq.nationality" }, () => fetchNotifications())
            .subscribe()

        const ch2 = supabase
            .channel('admin_notifs_orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchNotifications())
            .subscribe()

        return () => {
            supabase.removeChannel(ch1)
            supabase.removeChannel(ch2)
        }
    }, [])

    const toggleReadStatus = async (notif: UnifiedNotification) => {
        const newStatus = !notif.lu
        if (notif.source === 'messages') {
            await supabase.from('messages').update({ lu: newStatus }).eq('id', notif.id)
        } else {
            await supabase.from('notifications').update({ is_read: newStatus }).eq('id', notif.id)
        }
        setNotifications(notifications.map(n => n.id === notif.id ? { ...n, lu: newStatus } : n))
    }

    const deleteNotification = async (notif: UnifiedNotification) => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette alerte ?")) return
        const table = notif.source === 'messages' ? 'messages' : 'notifications'
        await supabase.from(table).delete().eq('id', notif.id)
        setNotifications(notifications.filter(n => n.id !== notif.id))
    }

    const getIcon = (type: string, isUnread: boolean) => {
        switch (type) {
            case 'cart_abandoned': return <ShoppingCart size={24} className="text-orange-400" />
            case 'payment_success': return <CheckCircle2 size={24} className={isUnread ? "text-[#008751]" : "text-gray-500"} />
            case 'nationality': return <Map size={24} className={isUnread ? "text-[#E8112D]" : "text-gray-500"} />
            default: return <AlertCircle size={24} className="text-gray-500" />
        }
    }

    const getBadgeLabel = (type: string) => {
        switch (type) {
            case 'cart_abandoned': return 'Panier Abandonné'
            case 'payment_success': return 'Commande Payée'
            case 'nationality': return 'Demande Nationalité'
            default: return 'Mise à jour'
        }
    }

    const getBorderColor = (type: string, isUnread: boolean) => {
        if (!isUnread) return 'border-white/5 hover:border-white/20'
        switch (type) {
            case 'cart_abandoned': return 'border-orange-500'
            case 'payment_success': return 'border-[#008751]'
            default: return 'border-[#E8112D]'
        }
    }

    const filteredItems = notifications.filter((item) => {
        const text = `${item.nom || ''} ${item.prenom || ''} ${item.email || ''} ${item.title || ''} ${item.message || ''} ${item.sujet || ''}`.toLowerCase()
        const matchesSearch = text.includes(searchTerm.toLowerCase());
        if (filter === 'abandoned') return matchesSearch && item.type === 'cart_abandoned'
        if (filter === 'unread') return matchesSearch && !item.lu
        return matchesSearch;
    });

    const abandonedCount = notifications.filter(n => n.type === 'cart_abandoned' && !n.lu).length

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-1000">
            {/* HEADER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#E8112D]">
                        <Bell size={18} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]"><T>Alertes & Demandes</T></span>
                    </div>
                    <h1 className="text-5xl font-black text-white font-heading tracking-tighter">
                        CENTRE <span className="benin-gradient"><T>NOTIFICATIONS</T></span>
                    </h1>
                    {abandonedCount > 0 && (
                        <div className="flex items-center gap-2 mt-1 p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
                            <AlertTriangle size={14} className="text-orange-400" />
                            <span className="text-xs text-orange-400 font-black uppercase tracking-wider">
                                {abandonedCount} panier(s) abandonné(s) : relancez ces clients !
                            </span>
                        </div>
                    )}
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
                        {(['all', 'unread', 'abandoned'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1",
                                    filter === f
                                        ? f === 'abandoned' ? "bg-orange-500 text-white shadow-lg" : f === 'unread' ? "bg-[#E8112D] text-white shadow-lg" : "bg-white text-black shadow-lg"
                                        : "text-gray-500 hover:text-white"
                                )}
                            >
                                {f === 'all' ? <T>Toutes</T> : f === 'unread' ? <T>Non lues</T> : <T>Abandons</T>}
                                {f === 'abandoned' && abandonedCount > 0 && (
                                    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/20 text-[8px]">{abandonedCount}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* CONTENT LIST */}
            <div className="grid grid-cols-1 gap-4 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[400px] bg-[#E8112D]/5 blur-[120px] rounded-full pointer-events-none" />

                {loading ? (
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
                        <p className="text-gray-500 max-w-sm text-sm"><T>Aucune alerte correspondant à vos critères.</T></p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {filteredItems.map((item, index) => (
                            <motion.div
                                key={`${item.source}-${item.id}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: index * 0.03 }}
                            >
                                <Card className={cn(
                                    "p-0 overflow-hidden group hover:scale-[1.01] transition-all duration-300 border-none",
                                    !item.lu
                                        ? item.type === 'cart_abandoned' ? "bg-gradient-to-r from-orange-500/10 to-[#0a0f18]"
                                        : item.type === 'payment_success' ? "bg-gradient-to-r from-[#008751]/10 to-[#0a0f18]"
                                        : "bg-gradient-to-r from-[#E8112D]/10 to-[#0a0f18]"
                                        : "bg-[#0a0f18]"
                                )}>
                                    <div className={cn(
                                        "px-6 py-5 flex flex-col md:flex-row gap-6 border-l-4",
                                        getBorderColor(item.type, !item.lu)
                                    )}>
                                        {/* Icon */}
                                        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/5 group-hover:border-white/10 transition-colors shrink-0">
                                            {getIcon(item.type, !item.lu)}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 space-y-1 justify-center flex flex-col">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <h3 className={cn(
                                                    "text-lg font-bold truncate",
                                                    !item.lu ? "text-white" : "text-gray-400"
                                                )}>
                                                    {item.source === 'messages'
                                                        ? `Demande de Nationalité : ${item.nom} ${item.prenom}`
                                                        : item.title
                                                    }
                                                </h3>
                                                {!item.lu && (
                                                    <span className={cn(
                                                        "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest animate-pulse",
                                                        item.type === 'cart_abandoned' ? "bg-orange-500 text-white" : "bg-[#E8112D] text-white"
                                                    )}>
                                                        {item.type === 'cart_abandoned' ? 'À relancer' : <T>Nouveau</T>}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                                                {item.source === 'messages'
                                                    ? `Le profil ${item.nom} a soumis une nouvelle demande de passeport / CI.`
                                                    : item.message
                                                }
                                            </p>

                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                                                {item.email && (
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                                                        <Mail size={12} className="text-gray-600" />
                                                        {item.email}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono bg-white/[0.02] px-2 py-1 border border-white/5 rounded-md">
                                                    <Clock size={12} className="text-gray-600" />
                                                    {new Date(item.created_at).toLocaleString('fr-FR')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 justify-end shrink-0 pointer-events-auto">
                                            <button
                                                onClick={() => toggleReadStatus(item)}
                                                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-gray-400 hover:text-white transition-all shadow-sm"
                                                title={item.lu ? "Marquer non lu" : "Marquer comme lu"}
                                            >
                                                {item.lu ? <AlertCircle size={16} /> : <div className={cn(
                                                    "w-4 h-4 rounded-full shadow-lg",
                                                    item.type === 'cart_abandoned' ? "bg-orange-500 shadow-orange-500/50" : "bg-[#E8112D] shadow-[0_0_10px_#E8112D]"
                                                )} />}
                                            </button>

                                            <button
                                                onClick={() => deleteNotification(item)}
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
