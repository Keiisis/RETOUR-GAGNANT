'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Bell, Search, Clock, ShieldCheck, Mail, Map, Archive, Loader2, ShoppingCart, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { T } from '@/lib/translation'

// Notification unifiée (messages de nationalité + alertes de commandes)
interface UnifiedNotification {
    id: string
    // Champs pour les messages (table messages)
    nom?: string
    prenom?: string
    email?: string
    sujet?: string
    message?: string
    type: string
    lu: boolean
    created_at: string
    // Champs pour les alertes commandes (table notifications)
    title?: string
    order_id?: string
    source: 'messages' | 'notifications'
}

export default function AgentNotificationsPage() {
    const [notifications, setNotifications] = useState<UnifiedNotification[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'all' | 'unread' | 'abandoned'>('all')

    const fetchNotifications = async () => {
        // 1. Messages de nationalité (existant)
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
            .limit(50)

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

        // Fusionner et trier par date
        const all = [...msgNotifs, ...cmdNotifs].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        setNotifications(all)
        setLoading(false)
    }

    useEffect(() => {
        fetchNotifications()

        // Realtime sur les deux tables
        const ch1 = supabase
            .channel('agent_notifs_messages')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: "type=eq.nationality" }, () => {
                fetchNotifications()
            })
            .subscribe()

        const ch2 = supabase
            .channel('agent_notifs_orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
                fetchNotifications()
            })
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

    const getIcon = (type: string) => {
        switch (type) {
            case 'cart_abandoned': return <ShoppingCart size={20} className="text-orange-400" />
            case 'payment_success': return <CheckCircle2 size={20} className="text-emerald-400" />
            case 'nationality': return <Map size={20} />
            default: return <Bell size={20} />
        }
    }

    const getBadge = (type: string) => {
        switch (type) {
            case 'cart_abandoned': return { label: 'Panier Abandonné', classes: 'bg-orange-500/10 text-orange-400 border-orange-500/20' }
            case 'payment_success': return { label: 'Nouvelle Commande', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
            case 'nationality': return { label: 'Demande Nationalité', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
            default: return { label: 'Mise à jour', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
        }
    }

    const filteredNotifications = notifications.filter(n => {
        const text = `${n.nom || ''} ${n.prenom || ''} ${n.email || ''} ${n.title || ''} ${n.message || ''} ${n.sujet || ''}`.toLowerCase()
        const matchesSearch = text.includes(search.toLowerCase())
        if (filter === 'abandoned') return matchesSearch && n.type === 'cart_abandoned'
        if (filter === 'unread') return matchesSearch && !n.lu
        return matchesSearch
    })

    const abandonedCount = notifications.filter(n => n.type === 'cart_abandoned' && !n.lu).length

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <Bell size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]"><T>Alertes Système</T></span>
                    </div>
                    <h1 className="text-3xl font-black text-white font-heading"><T>NOTIFICATIONS</T></h1>
                    {abandonedCount > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                            <AlertTriangle size={14} className="text-orange-400" />
                            <span className="text-xs text-orange-400 font-bold">{abandonedCount} panier(s) abandonné(s) à relancer</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-text-muted" size={14} />
                        <input
                            type="text"
                            placeholder="Rechercher une notification..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-nexus-deep border border-nexus-border-subtle rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-emerald-500/40 transition-all"
                        />
                    </div>
                    <div className="flex bg-white/5 p-1 rounded-xl border border-nexus-border-subtle w-full sm:w-auto">
                        {(['all', 'unread', 'abandoned'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                    filter === f 
                                        ? f === 'abandoned' ? 'bg-orange-500 text-white shadow-lg' : 'bg-emerald-500 text-white shadow-nexus-glow' 
                                        : 'text-nexus-text-muted hover:text-white'
                                }`}
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

            {/* Notifications List */}
            <div className="bg-nexus-deep border border-nexus-border-subtle rounded-3xl overflow-hidden shadow-nexus-elevated flex flex-col min-h-[500px]">
                <div className="flex-1 overflow-y-auto nexus-scrollbar">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center p-20">
                            <Loader2 className="animate-spin text-emerald-500 mb-4" size={32} />
                            <p className="text-xs text-nexus-text-muted uppercase tracking-widest font-bold"><T>Chargement des notifications</T>...</p>
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-20 opacity-50">
                            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                                <Archive size={24} className="text-nexus-text-muted" />
                            </div>
                            <h3 className="text-white font-bold text-sm mb-1 uppercase tracking-wider"><T>Aucune alerte</T></h3>
                            <p className="text-xs text-nexus-text-muted"><T>Votre centre de notifications est vide</T></p>
                        </div>
                    ) : (
                        <div className="divide-y divide-nexus-border-subtle">
                            <AnimatePresence>
                                {filteredNotifications.map((notif) => {
                                    const badge = getBadge(notif.type)
                                    return (
                                        <motion.div
                                            key={`${notif.source}-${notif.id}`}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className={`group relative p-6 flex flex-col sm:flex-row gap-5 hover:bg-white/[0.02] transition-colors cursor-pointer ${
                                                !notif.lu 
                                                    ? notif.type === 'cart_abandoned' ? 'bg-orange-500/[0.03]' : 'bg-emerald-500/[0.02]' 
                                                    : ''
                                            }`}
                                            onClick={() => toggleReadStatus(notif)}
                                        >
                                            {!notif.lu && (
                                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                                    notif.type === 'cart_abandoned' ? 'bg-orange-500' : 'bg-emerald-500'
                                                }`} />
                                            )}
                                            
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                                                !notif.lu 
                                                    ? notif.type === 'cart_abandoned' 
                                                        ? 'bg-orange-500/10 border border-orange-500/20' 
                                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                                    : 'bg-white/5 text-nexus-text-muted border border-white/10'
                                            }`}>
                                                {getIcon(notif.type)}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${badge.classes}`}>
                                                        {badge.label}
                                                    </span>
                                                    <span className="text-[10px] flex items-center gap-1 text-nexus-text-muted">
                                                        <Clock size={10} />
                                                        {new Date(notif.created_at).toLocaleString('fr-FR')}
                                                    </span>
                                                    {!notif.lu && notif.type === 'cart_abandoned' && (
                                                        <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[8px] font-black uppercase tracking-wider animate-pulse">
                                                            À relancer
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className={`text-sm font-bold truncate mb-1 ${!notif.lu ? 'text-white' : 'text-gray-400'}`}>
                                                    {notif.source === 'messages' 
                                                        ? `${notif.nom || ''} ${notif.prenom || ''}`
                                                        : notif.title
                                                    }
                                                </h3>
                                                <p className="text-xs text-nexus-text-muted line-clamp-2">
                                                    {notif.source === 'messages'
                                                        ? `Le profil ${notif.nom} a soumis une nouvelle demande de passeport / CI.`
                                                        : notif.message
                                                    }
                                                </p>
                                                {notif.email && (
                                                    <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-500 font-mono">
                                                        <Mail size={10} />
                                                        {notif.email}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-end sm:flex-col sm:justify-start gap-2">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); toggleReadStatus(notif); }}
                                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-nexus-text-muted transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <ShieldCheck size={16} className={notif.lu ? "text-emerald-400" : ""} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
