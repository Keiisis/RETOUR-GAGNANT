'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    Bell, CheckCheck, FolderOpen, MessageSquare, CalendarDays,
    Receipt, Inbox, Loader2, Circle,
} from 'lucide-react'

interface Notif {
    id: string
    title: string
    body: string | null
    type: string | null
    is_read: boolean
    created_at: string
}

const typeMeta = (type: string | null) => {
    switch (type) {
        case 'dossier': return { icon: FolderOpen, color: '#3B82F6' }
        case 'message': return { icon: MessageSquare, color: '#8B5CF6' }
        case 'appointment': return { icon: CalendarDays, color: '#10B981' }
        case 'order': case 'facture': return { icon: Receipt, color: '#C9A84C' }
        default: return { icon: Bell, color: '#64748B' }
    }
}
const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return "à l'instant"
    if (m < 60) return `il y a ${m} min`
    const h = Math.floor(m / 60)
    if (h < 24) return `il y a ${h} h`
    const d = Math.floor(h / 24)
    if (d < 7) return `il y a ${d} j`
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export default function ClientNotificationsPage() {
    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState<Notif[]>([])
    const [uid, setUid] = useState<string | null>(null)

    const load = useCallback(async (userId: string) => {
        const { data } = await supabase
            .from('notifications')
            .select('id, title, body, type, is_read, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100)
        setItems((data as Notif[]) || [])
        setLoading(false)
    }, [])

    useEffect(() => {
        let channel: ReturnType<typeof supabase.channel> | null = null
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) { setLoading(false); return }
            const id = session.user.id
            setUid(id)
            await load(id)
            channel = supabase
                .channel(`client-notifs-page-${id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${id}` },
                    (payload) => setItems(prev => (prev.some(p => p.id === (payload.new as Notif).id) ? prev : [payload.new as Notif, ...prev])))
                .subscribe()
        }
        init()
        return () => { if (channel) supabase.removeChannel(channel) }
    }, [load])

    const markRead = async (id: string) => {
        setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
        await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    }
    const markAllRead = async () => {
        if (!uid) return
        setItems(prev => prev.map(n => ({ ...n, is_read: true })))
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', uid).eq('is_read', false)
    }

    const unread = items.filter(n => !n.is_read).length

    return (
        <div className="p-5 md:p-8 max-w-3xl mx-auto text-white">
            <header className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <Bell className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Notifications</h1>
                        <p className="text-sm text-gray-400">{unread > 0 ? `${unread} non lue(s)` : 'Tout est à jour'}</p>
                    </div>
                </div>
                {unread > 0 && (
                    <button type="button" onClick={markAllRead}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-gray-200 hover:bg-white/10">
                        <CheckCheck className="w-4 h-4" /> Tout marquer lu
                    </button>
                )}
            </header>

            {loading ? (
                <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />)}</div>
            ) : items.length === 0 ? (
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-10 text-center">
                    <Inbox className="w-9 h-9 mx-auto mb-3 text-gray-600" />
                    <p className="font-semibold mb-1">Aucune notification</p>
                    <p className="text-sm text-gray-400">Vous serez prévenu ici de l&apos;avancée de vos dossiers, des réponses de votre conseiller et de vos rendez-vous.</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    <AnimatePresence initial={false}>
                        {items.map(n => {
                            const m = typeMeta(n.type)
                            const Icon = m.icon
                            return (
                                <motion.button key={n.id} type="button" layout onClick={() => !n.is_read && markRead(n.id)}
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    className={`w-full text-left flex items-start gap-3 rounded-2xl border p-4 transition ${n.is_read ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-blue-500/[0.06] border-blue-500/20'}`}>
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${m.color}22` }}>
                                        <Icon className="w-4.5 h-4.5" style={{ color: m.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm ${n.is_read ? 'font-medium text-gray-200' : 'font-bold text-white'}`}>{n.title}</p>
                                        {n.body && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{n.body}</p>}
                                        <p className="text-[11px] text-gray-500 mt-1">{timeAgo(n.created_at)}</p>
                                    </div>
                                    {!n.is_read && <Circle className="w-2.5 h-2.5 text-blue-400 fill-blue-400 shrink-0 mt-1.5" />}
                                </motion.button>
                            )
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    )
}
