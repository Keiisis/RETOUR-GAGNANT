'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, CheckCircle2, ShieldAlert, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Notification {
    id: string
    client_email: string
    title: string
    message: string
    type: string
    is_read: boolean
    link: string | null
    created_at: string
}

export default function ClientBell() {
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [clientEmail, setClientEmail] = useState<string | null>(null)

    const fetchNotifications = async (email: string) => {
        const { data } = await supabase
            .from('client_notifications')
            .select('*')
            .eq('client_email', email)
            .order('created_at', { ascending: false })
            .limit(20)

        if (data) {
            setNotifications(data as Notification[])
            setUnreadCount(data.filter((n: Notification) => !n.is_read).length)
        }
    }

    useEffect(() => {
        // Read client email from local storage (set after login in Mon Compte)
        const email = localStorage.getItem('rg_client_email')
        if (email) {
            setClientEmail(email)
            fetchNotifications(email)
        }

        // Subscribe to real-time notifications
        if (email) {
            const channel = supabase
                .channel(`public:client_notifications:client_email=eq.${email}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'client_notifications',
                    filter: `client_email=eq.${email}`
                }, (payload) => {
                    setNotifications(prev => [payload.new as Notification, ...prev])
                    setUnreadCount(prev => prev + 1)
                })
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const markAsRead = async (id?: string) => {
        if (!clientEmail) return

        let query = supabase.from('client_notifications').update({ is_read: true }).eq('client_email', clientEmail)
        if (id) query = query.eq('id', id)

        await query

        setNotifications(notifications.map(n => id ? (n.id === id ? { ...n, is_read: true } : n) : { ...n, is_read: true }))
        setUnreadCount(id ? Math.max(0, unreadCount - 1) : 0)
    }

    if (!clientEmail) return null // Hide bell if not logged in

    return (
        <div className="relative z-[60]">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-full hover:bg-white/5 transition-colors group"
            >
                <Bell size={20} className="text-gray-300 group-hover:text-white transition-colors" />
                {unreadCount > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#E8112D] text-white text-[9px] font-bold flex items-center justify-center border-2 border-[#05080a]"
                    >
                        {unreadCount}
                    </motion.span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full right-0 mt-4 w-80 bg-[#0B1015] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <h3 className="font-bold text-white text-sm">Notifications</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={() => markAsRead()}
                                    className="text-[10px] text-gray-400 hover:text-emerald-400 font-medium transition-colors"
                                >
                                    Tout marquer comme lu
                                </button>
                            )}
                        </div>

                        <div className="max-h-[300px] overflow-y-auto nexus-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-sm text-gray-500">
                                    <Bell size={24} className="mx-auto mb-2 opacity-50" />
                                    Aucune notification
                                </div>
                            ) : (
                                notifications.map(notif => (
                                    <div
                                        key={notif.id}
                                        onClick={() => markAsRead(notif.id)}
                                        className={`p-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer ${notif.is_read ? 'opacity-60' : 'bg-white/[0.03]'}`}
                                    >
                                        <div className="flex gap-3">
                                            <div className="shrink-0 mt-0.5">
                                                {notif.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-500" />
                                                    : notif.type === 'warning' ? <ShieldAlert size={16} className="text-amber-500" />
                                                        : <Bell size={16} className="text-blue-500" />}
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-xs ${notif.is_read ? 'text-gray-400' : 'text-white font-medium'}`}>{notif.title}</p>
                                                <p className="text-[10px] text-gray-500 mt-1 leading-snug">{notif.message}</p>
                                                <p className="text-[9px] text-gray-600 mt-2">
                                                    {new Date(notif.created_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-3 border-t border-white/5 bg-white/[0.02]">
                            <Link href="/mon-compte" onClick={() => setIsOpen(false)} className="flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-white transition-colors">
                                Mon Espace <ArrowRight size={12} />
                            </Link>
                        </div>
                    </motion.div >
                )
                }
            </AnimatePresence >

            {/* Click outside trigger */}
            {isOpen && <div className="fixed inset-0 z-[-1]" onClick={() => setIsOpen(false)} />}
        </div >
    )
}
