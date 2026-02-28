'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    MessageSquare, Search, Mail, Clock, CheckCircle2,
    Send, Reply, User, AlertCircle, Bot
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

interface ChatMessage {
    id: string
    conversation_id: string
    role: 'client' | 'agent'
    content: string
    created_at: string
}

export default function AgentMessagesPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'all' | 'unread' | 'contact' | 'support'>('all')
    const [selected, setSelected] = useState<Message | null>(null)
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
    const [replyText, setReplyText] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const fetchMessages = async () => {
        const { data } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false })

        setMessages((data || []) as Message[])
        setLoading(false)
    }

    const fetchChatHistory = async (conversationId: string) => {
        const { data } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })

        setChatHistory((data || []) as ChatMessage[])
        setTimeout(scrollToBottom, 100)
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        fetchMessages()

        // Abonnement Supabase Realtime (WebSocket) pour les conversations globales (tickets)
        const channel = supabase
            .channel('realtime_messages')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => {
                    const newMsg = payload.new as Message
                    setMessages(prev => [newMsg, ...prev])
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'messages' },
                (payload) => {
                    const updatedMsg = payload.new as Message
                    setMessages(prev => {
                        const others = prev.filter(m => m.id !== updatedMsg.id)
                        return [updatedMsg, ...others]
                    })
                    if (selected?.id === updatedMsg.id) {
                        setSelected(updatedMsg)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [selected])

    // Abonnement aux messages du chat selectionné
    useEffect(() => {
        if (!selected) return

        fetchChatHistory(selected.id)

        const chatChannel = supabase
            .channel(`chat_messages_${selected.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${selected.id}` },
                (payload) => {
                    const newChat = payload.new as ChatMessage
                    setChatHistory(prev => {
                        if (prev.find(m => m.id === newChat.id || (m.role === newChat.role && m.content === newChat.content))) {
                            return prev;
                        }
                        return [...prev, newChat]
                    })
                    setTimeout(scrollToBottom, 100)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(chatChannel)
        }
    }, [selected?.id])

    const markAsRead = async (msg: Message) => {
        if (!msg.lu) {
            await supabase.from('messages').update({ lu: true }).eq('id', msg.id)
        }
        setSelected(msg)
    }

    const handleReply = async (method: 'chat' | 'email') => {
        if (!selected || !replyText.trim()) return

        const content = replyText.trim()
        setReplyText('') // Reset input immediately for UX

        // Optimistic update
        const tempMsg: ChatMessage = {
            id: `temp-${Date.now()}`,
            conversation_id: selected.id,
            role: 'agent',
            content: content,
            created_at: new Date().toISOString()
        }
        setChatHistory(prev => [...prev, tempMsg])
        setTimeout(scrollToBottom, 100)

        // Insert into chat_messages
        await supabase
            .from('chat_messages')
            .insert({
                conversation_id: selected.id,
                role: 'agent',
                content: content
            })

        // Also mark as read if it wasn't
        if (!selected.lu) {
            markAsRead(selected)
        }

        // If email method, send the email
        if (method === 'email') {
            try {
                await fetch('/api/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: selected.email,
                        subject: `Retour Gagnant — Réponse à : ${selected.sujet}`,
                        message: content,
                        clientName: `${selected.nom} ${selected.prenom}`.trim() || 'Client',
                        context: 'agent_reply',
                        relatedId: selected.id
                    })
                });
            } catch (err) {
                console.error("Erreur lors de l'envoi de l'email :", err);
            }
        }
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
        return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <MessageSquare size={16} className="text-blue-400" />
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.3em] flex items-center gap-2">
                            Live Chat
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Console Live</h1>
                    <p className="text-gray-500 text-sm mt-1">{messages.length} conversation(s) • {unreadCount} en attente</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 text-sm w-56" />
                    </div>
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                        {[{ key: 'all', label: 'Toutes' }, { key: 'unread', label: 'En attente' }, { key: 'contact', label: 'Contact' }, { key: 'support', label: 'Support' }].map((f) => (
                            <button key={f.key} onClick={() => setFilter(f.key as typeof filter)} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${filter === f.key ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-white'}`}>{f.label}</button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-7 gap-4 min-h-[600px] h-[calc(100vh-200px)]">
                {/* Liste des discussions */}
                <div className="xl:col-span-3 bg-white/[0.03] border border-white/5 rounded-2xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-white/[0.01]">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                            Files d'attente
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                        <AnimatePresence>
                            {filtered.length === 0 ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center text-gray-500 text-sm">
                                    <CheckCircle2 className="mx-auto mb-2 text-gray-700" size={32} />
                                    La file est vide
                                </motion.div>
                            ) : (
                                filtered.map((m) => (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        key={m.id}
                                        onClick={() => markAsRead(m)}
                                        className={`p-4 cursor-pointer transition-all hover:bg-white/[0.03] ${selected?.id === m.id ? 'bg-blue-500/10 border-l-2 border-blue-500' : 'border-l-2 border-transparent'} ${!m.lu ? 'bg-white/[0.02]' : ''}`}
                                    >
                                        <div className="flex items-start justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                {!m.lu ? (
                                                    <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)] flex-shrink-0" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                                                        <User size={12} className="text-gray-500" />
                                                    </div>
                                                )}
                                                <span className={`text-sm ${!m.lu ? 'text-white font-bold' : 'text-gray-400 font-semibold'}`}>{m.nom} {m.prenom}</span>
                                            </div>
                                            <span className={`text-[10px] ${!m.lu ? 'text-blue-400 font-bold' : 'text-gray-600'} flex-shrink-0`}>
                                                {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className={`text-xs pl-8 ${!m.lu ? 'text-gray-300 font-medium' : 'text-gray-500'} truncate`}>{m.sujet}</p>
                                        <div className="flex justify-between items-center pl-8 mt-2">
                                            <span className="text-[10px] text-gray-600 truncate mr-2">{m.message}</span>
                                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${m.type === 'support' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                {m.type}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Vue Chat (Message actuel) */}
                <div className="xl:col-span-4 bg-white/[0.03] border border-white/5 rounded-2xl flex flex-col overflow-hidden relative">
                    {selected ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-white/5 bg-[#0a0f14]/80 backdrop-blur-md z-10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                                        <User size={18} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                                            {selected.nom} {selected.prenom}
                                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${selected.type === 'support' ? 'border-purple-500/30 text-purple-400' : 'border-blue-500/30 text-blue-400'}`}>{selected.type}</span>
                                        </h3>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                            <span className="flex items-center gap-1"><Mail size={10} /> {selected.email}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Chat Body */}
                            <div className="flex-1 p-6 overflow-y-auto space-y-6">
                                <div className="flex justify-center">
                                    <span className="text-[10px] uppercase font-bold text-gray-600 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                                        {new Date(selected.created_at).toLocaleDateString('fr-FR')} à {new Date(selected.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>

                                {/* First Message Bubble (From messages table) */}
                                <div className="flex items-start gap-3 max-w-[85%]">
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-auto">
                                        <User size={14} className="text-gray-400" />
                                    </div>
                                    <div>
                                        <div className="bg-white/10 border border-white/5 rounded-2xl rounded-tl-sm p-4 text-sm text-gray-200 leading-relaxed shadow-lg">
                                            <p className="font-bold text-white mb-2 pb-2 border-b border-white/10 text-xs">Objet: {selected.sujet}</p>
                                            <p className="whitespace-pre-wrap">{selected.message}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Live Thread Bubbles */}
                                {chatHistory.map((chat) => (
                                    <div key={chat.id} className={`flex items-start gap-3 ${chat.role === 'agent' ? 'justify-end' : 'justify-start'}`}>
                                        {chat.role === 'client' && (
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-auto">
                                                <User size={14} className="text-gray-400" />
                                            </div>
                                        )}
                                        <div className={`max-w-[70%] text-sm p-4 leading-relaxed shadow-lg
                                            ${chat.role === 'agent'
                                                ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm'
                                                : 'bg-white/10 border border-white/5 text-gray-200 rounded-2xl rounded-tl-sm'
                                            }`}
                                        >
                                            <p className="whitespace-pre-wrap">{chat.content}</p>
                                        </div>
                                        {chat.role === 'agent' && (
                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-auto border border-blue-500/50">
                                                <Bot size={14} className="text-blue-400" />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <div ref={messagesEndRef} />
                            </div>

                            {/* Chat Input */}
                            <div className="p-4 bg-white/[0.02] border-t border-white/5">
                                <div className="bg-[#0a0f14] border border-white/10 rounded-2xl p-2 flex gap-2">
                                    <input
                                        type="text"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleReply('chat');
                                        }}
                                        placeholder={`Répondre en direct à ${selected.nom}...`}
                                        className="flex-1 bg-transparent py-3 px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none"
                                    />
                                    <button
                                        onClick={() => handleReply('chat')}
                                        disabled={!replyText.trim()}
                                        className="bg-purple-500/20 text-purple-400 hover:bg-purple-500 hover:text-white disabled:opacity-50 disabled:bg-white/5 disabled:text-gray-500 rounded-xl px-4 font-bold text-sm transition-all flex items-center gap-2"
                                        title="Répondre sur le Chat en direct"
                                    >
                                        <MessageSquare size={16} /> <span className="hidden sm:inline">Invité (Chat)</span>
                                    </button>
                                    <button
                                        onClick={() => handleReply('email')}
                                        disabled={!replyText.trim()}
                                        className="bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white disabled:opacity-50 disabled:bg-white/5 disabled:text-gray-500 rounded-xl px-4 font-bold text-sm transition-all flex items-center gap-2"
                                        title="Répondre par Email"
                                    >
                                        <Mail size={16} /> <span className="hidden sm:inline">Envoyer (Email)</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 mt-2 px-2">
                                    <AlertCircle size={10} className="text-blue-400" />
                                    <p className="text-[10px] text-gray-400 font-medium">Répondez depuis cette console, l'email sera envoyé via l'adresse officielle.</p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4 p-8 bg-[url('/grid.svg')] bg-center opacity-70">
                            <div className="w-20 h-20 rounded-3xl bg-white/[0.02] border border-white/10 flex items-center justify-center">
                                <MessageSquare size={32} className="text-gray-600" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-white font-bold mb-1">Aucune discussion sélectionnée</h3>
                                <p className="text-sm">Cliquez sur un message dans la file pour ouvrir le chat</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>
    )
}

