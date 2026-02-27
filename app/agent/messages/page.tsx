'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    MessageSquare, Search, Mail, Phone, Clock, CheckCircle2,
    Eye, ChevronDown, Filter, Headphones
} from 'lucide-react'

interface Message {
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

export default function AgentMessagesPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'all' | 'unread' | 'contact' | 'support'>('all')
    const [selected, setSelected] = useState<Message | null>(null)

    useEffect(() => {
        fetchMessages()
    }, [])

    const fetchMessages = async () => {
        const { data } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false })

        setMessages((data || []) as Message[])
        setLoading(false)
    }

    const markAsRead = async (msg: Message) => {
        if (!msg.lu) {
            await supabase.from('messages').update({ lu: true }).eq('id', msg.id)
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, lu: true } : m))
        }
        setSelected(msg)
    }

    const filtered = messages.filter(m => {
        const matchSearch = m.nom?.toLowerCase().includes(search.toLowerCase()) ||
            m.email?.toLowerCase().includes(search.toLowerCase()) ||
            m.sujet?.toLowerCase().includes(search.toLowerCase())

        if (filter === 'unread') return matchSearch && !m.lu
        if (filter === 'contact') return matchSearch && m.type === 'contact'
        if (filter === 'support') return matchSearch && m.type === 'support'
        return matchSearch
    })

    const unreadCount = messages.filter(m => !m.lu).length

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white">Messagerie</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {messages.length} message(s) • {unreadCount} non lu(s)
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Rechercher..."
                            title="Rechercher un message"
                            className="bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm w-56"
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                        {[
                            { key: 'all', label: 'Tous' },
                            { key: 'unread', label: 'Non Lus' },
                            { key: 'contact', label: 'Contact' },
                            { key: 'support', label: 'Support' },
                        ].map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key as typeof filter)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${filter === f.key
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'text-gray-500 hover:text-white'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Split View: List + Detail */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 min-h-[600px]">
                {/* Messages List */}
                <div className="xl:col-span-2 bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="divide-y divide-white/5 max-h-[650px] overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 text-sm">Aucun message trouvé</div>
                        ) : (
                            filtered.map((m) => (
                                <div
                                    key={m.id}
                                    onClick={() => markAsRead(m)}
                                    className={`p-4 cursor-pointer transition-all hover:bg-white/[0.03] ${selected?.id === m.id ? 'bg-emerald-500/5 border-l-2 border-emerald-500' : ''
                                        } ${!m.lu ? 'bg-white/[0.02]' : ''}`}
                                >
                                    <div className="flex items-start justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            {!m.lu && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />}
                                            <span className={`text-sm font-semibold ${!m.lu ? 'text-white' : 'text-gray-400'}`}>
                                                {m.nom} {m.prenom}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-gray-600 flex-shrink-0">
                                            {new Date(m.created_at).toLocaleDateString('fr-FR')}
                                        </span>
                                    </div>
                                    <p className={`text-xs ${!m.lu ? 'text-gray-300' : 'text-gray-500'} truncate`}>{m.sujet}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${m.type === 'support' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {m.type === 'support' ? '🎙️ Support' : '✉️ Contact'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Message Detail */}
                <div className="xl:col-span-3 bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
                    {selected ? (
                        <div className="p-6 h-full flex flex-col">
                            <div className="flex items-start justify-between mb-6 pb-4 border-b border-white/5">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">{selected.sujet}</h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Mail size={12} className="text-emerald-400" />
                                            {selected.email}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={12} />
                                            {new Date(selected.created_at).toLocaleString('fr-FR')}
                                        </span>
                                    </div>
                                </div>
                                <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${selected.type === 'support' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                                    }`}>
                                    {selected.type}
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                <div className="bg-white/[0.03] rounded-xl p-5 border border-white/5">
                                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                        {selected.message}
                                    </p>
                                </div>
                            </div>

                            {/* Quick Response (Placeholder) */}
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Répondre rapidement... (bientôt disponible)"
                                        title="Réponse rapide"
                                        disabled
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-gray-500 placeholder:text-gray-700"
                                    />
                                    <button
                                        disabled
                                        className="bg-emerald-500/20 text-emerald-400/50 px-4 py-3 rounded-xl font-bold text-sm"
                                    >
                                        Envoyer
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3 p-8">
                            <MessageSquare size={40} className="text-gray-700" />
                            <p className="text-sm font-semibold">Sélectionnez un message pour le lire</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
