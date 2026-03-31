'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Bell, Search, Clock, ShieldCheck, Mail, Map, Archive, Loader2 } from 'lucide-react'
import { T } from '@/lib/translation'

interface Notification {
    id: string
    nom: string
    prenom: string
    email: string
    sujet: string
    message: string
    type: string
    lu: boolean
    created_at: string
}

export default function AgentNotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'all' | 'unread'>('all')

    const fetchNotifications = async () => {
        const { data } = await supabase
            .from('messages')
            .select('*')
            .eq('type', 'nationality')
            .order('created_at', { ascending: false })

        setNotifications((data || []) as Notification[])
        setLoading(false)
    }

    useEffect(() => {
        fetchNotifications()

        const channel = supabase
            .channel('agent_notifications')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: "type=eq.nationality" }, () => {
                fetchNotifications()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const toggleReadStatus = async (id: string, currentStatus: boolean) => {
        await supabase.from('messages').update({ lu: !currentStatus }).eq('id', id)
        setNotifications(notifications.map(n => n.id === id ? { ...n, lu: !currentStatus } : n))
    }

    const filteredNotifications = notifications.filter(n => {
        const matchesSearch = n.nom?.toLowerCase().includes(search.toLowerCase()) ||
            n.sujet?.toLowerCase().includes(search.toLowerCase()) ||
            n.email?.toLowerCase().includes(search.toLowerCase())
        const matchesFilter = filter === 'all' || (filter === 'unread' && !n.lu)
        return matchesSearch && matchesFilter
    })

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
                        <button
                            onClick={() => setFilter('all')}
                            className={`flex-1 px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filter === 'all' ? 'bg-emerald-500 text-white shadow-nexus-glow' : 'text-nexus-text-muted hover:text-white'}`}
                        >
                            <T>Toutes</T>
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            className={`flex-1 px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filter === 'unread' ? 'bg-emerald-500 text-white shadow-nexus-glow' : 'text-nexus-text-muted hover:text-white'}`}
                        >
                            <T>Non lues</T>
                        </button>
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
                                {filteredNotifications.map((notif) => (
                                    <motion.div
                                        key={notif.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className={`group relative p-6 flex flex-col sm:flex-row gap-5 hover:bg-white/[0.02] transition-colors cursor-pointer ${!notif.lu ? 'bg-emerald-500/[0.02]' : ''}`}
                                        onClick={() => toggleReadStatus(notif.id, notif.lu)}
                                    >
                                        {!notif.lu && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                                        )}
                                        
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${!notif.lu ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-nexus-text-muted border border-white/10'}`}>
                                            <Map size={20} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${!notif.lu ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                                                    Demande de Nationalité
                                                </span>
                                                <span className="text-[10px] flex items-center gap-1 text-nexus-text-muted">
                                                    <Clock size={10} />
                                                    {new Date(notif.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <h3 className={`text-sm font-bold truncate mb-1 ${!notif.lu ? 'text-white' : 'text-gray-400'}`}>
                                                {notif.nom} {notif.prenom}
                                            </h3>
                                            <p className="text-xs text-nexus-text-muted line-clamp-2">
                                                Le profil {notif.nom} a soumis une nouvelle demande de passeport / CI.
                                            </p>
                                            <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-500 font-mono">
                                                <Mail size={10} />
                                                {notif.email}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end sm:flex-col sm:justify-start gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); toggleReadStatus(notif.id, notif.lu); }}
                                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-nexus-text-muted transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <ShieldCheck size={16} className={notif.lu ? "text-emerald-400" : ""} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
