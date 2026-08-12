'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { ChatText as MessageSquare, MagnifyingGlass as Search, Envelope as Mail, Clock, CheckCircle as CheckCircle2, PaperPlaneTilt as Send, ArrowBendUpLeft as Reply, User, WarningCircle as AlertCircle, Robot as Bot, Translate as Languages, CircleNotch as Loader2 } from '@phosphor-icons/react';

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
    const [translations, setTranslations] = useState<Record<string, { translated?: string, sourceLanguage?: string, translating?: boolean }>>({});
    const [detectedClientLanguage, setDetectedClientLanguage] = useState<string>("Français");
    const [translatingOwn, setTranslatingOwn] = useState(false);
    const [clientTyping, setClientTyping] = useState(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [replySuggestions, setReplySuggestions] = useState<string[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const fetchMessages = async () => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .neq('type', 'nationality')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('[agent/messages] fetchMessages error:', error)
            setFetchError(`${error.code || 'ERR'} : ${error.message}${error.hint ? ` (${error.hint})` : ''}`)
        } else {
            console.info('[agent/messages] fetchMessages OK, count =', data?.length, data)
            setFetchError(null)
        }

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

        // Typing presence channel
        const typingChannel = supabase
            .channel(`typing_${selected.id}`)
            .on('broadcast', { event: 'typing' }, (payload) => {
                if (payload.payload?.role === 'client') {
                    setClientTyping(true)
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
                    typingTimeoutRef.current = setTimeout(() => setClientTyping(false), 3000)
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(chatChannel)
            supabase.removeChannel(typingChannel)
            setClientTyping(false)
        }
    }, [selected?.id])

    const markAsRead = async (msg: Message) => {
        if (!msg.lu) {
            await supabase.from('messages').update({ lu: true }).eq('id', msg.id)
        }
        setSelected(msg)
    }

    // Auto-translate client messages
    useEffect(() => {
        chatHistory.forEach(msg => {
            if (msg.role === 'client' && !translations[msg.id]) {
                setTranslations(prev => {
                    if (prev[msg.id]) return prev;
                    return { ...prev, [msg.id]: { translating: true } };
                });

                fetch('/api/ai/translate-message', {
                    method: 'POST',
                    body: JSON.stringify({ text: msg.content, mode: 'detect_and_translate' })
                })
                    .then(r => r.json())
                    .then(data => {
                        if (data.translated) {
                            setTranslations(prev => ({
                                ...prev,
                                [msg.id]: { translated: data.translated, sourceLanguage: data.sourceLanguage }
                            }));
                            if (data.sourceLanguage && data.sourceLanguage !== "Inconnue") {
                                setDetectedClientLanguage(data.sourceLanguage);
                            }
                        }
                    })
                    .catch(console.error);
            }
        });
    }, [chatHistory, translations]);

    // Auto-suggestions IA quand le dernier message est du client
    useEffect(() => {
        const lastMsg = chatHistory[chatHistory.length - 1];
        if (!lastMsg || lastMsg.role !== 'client') return;

        setLoadingSuggestions(true);
        setReplySuggestions([]);

        const controller = new AbortController();
        fetch('/api/ai/translate-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: lastMsg.content,
                mode: 'suggest_reply',
                language: detectedClientLanguage,
                history: chatHistory.slice(-6).map(m => ({ role: m.role, content: m.content }))
            }),
            signal: controller.signal
        })
            .then(r => r.json())
            .then(data => {
                if (data.suggestions?.length > 0) setReplySuggestions(data.suggestions);
            })
            .catch(err => { if (err.name !== 'AbortError') console.error(err); })
            .finally(() => setLoadingSuggestions(false));

        return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatHistory.length]);

    // Clear suggestions when conversation changes
    useEffect(() => {
        setReplySuggestions([]);
        setDetectedClientLanguage("Français");
    }, [selected?.id]);

    const handleTranslateOutbox = async () => {
        if (!replyText.trim()) return;
        setTranslatingOwn(true);
        try {
            const res = await fetch('/api/ai/translate-message', {
                method: 'POST',
                body: JSON.stringify({ text: replyText, mode: 'translate_to', targetLanguage: detectedClientLanguage })
            });
            const data = await res.json();
            if (data.translated) {
                setReplyText(data.translated);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setTranslatingOwn(false);
        }
    };

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

        // Insert into chat_messages via API (bypasses RLS for reliability)
        await fetch('/api/support/agent_reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: selected.id, content }),
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
                        subject: `Retour Gagnant : Réponse à : ${selected.sujet}`,
                        message: content,
                        clientName: `${selected.nom} ${selected.prenom}`.trim() || 'Client',
                        context: 'agent_reply',
                        relatedId: selected.id,
                        language: detectedClientLanguage
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
        if (filter === 'support') return matchSearch && (m.type === 'support' || m.type === 'live_chat')
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
                    {fetchError && (
                        <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono max-w-xl">
                            <strong className="font-bold">Erreur Supabase :</strong> {fetchError}
                        </div>
                    )}
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
                            Files d&apos;attente
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
                                                {m.created_at && !isNaN(new Date(m.created_at).getTime()) ? new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </span>
                                        </div>
                                        <p className={`text-xs pl-8 ${!m.lu ? 'text-gray-300 font-medium' : 'text-gray-500'} truncate`}>{m.sujet}</p>
                                        <div className="flex justify-between items-center pl-8 mt-2">
                                            <span className="text-[10px] text-gray-600 truncate mr-2">{m.message}</span>
                                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${m.sujet?.includes('Live Chat') ? 'bg-emerald-500/20 text-emerald-400' : m.type === 'support' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                {m.sujet?.includes('Live Chat') ? ' Live' : m.type}
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
                                        {selected.created_at && !isNaN(new Date(selected.created_at).getTime()) ? `${new Date(selected.created_at).toLocaleDateString('fr-FR')} à ${new Date(selected.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '-'}
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
                                        <div className="flex flex-col gap-1 max-w-[70%]">
                                            <div className={`text-sm p-4 leading-relaxed shadow-lg
                                                ${chat.role === 'agent'
                                                    ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm'
                                                    : 'bg-white/10 border border-white/5 text-gray-200 rounded-2xl rounded-tl-sm'
                                                }`}
                                            >
                                                <p className="whitespace-pre-wrap">{chat.content}</p>
                                            </div>
                                            {chat.role === 'client' && translations[chat.id]?.translated && translations[chat.id]?.translated !== chat.content && (
                                                <div className="text-[11px] text-gray-400 bg-white/5 border border-white/5 p-3 rounded-xl flex flex-col gap-1 mt-1 font-mono">
                                                    <span className="text-blue-400 font-bold"><Languages size={12} className="inline mr-1" /> Traduit de: {translations[chat.id]?.sourceLanguage}</span>
                                                    <span>{translations[chat.id]?.translated}</span>
                                                </div>
                                            )}
                                            {chat.role === 'client' && translations[chat.id]?.translating && !translations[chat.id]?.translated && (
                                                <span className="text-[10px] text-gray-500 animate-pulse ml-2"><Languages size={10} className="inline mr-1" /> Traduction auto...</span>
                                            )}
                                        </div>
                                        {chat.role === 'agent' && (
                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-auto border border-blue-500/50">
                                                <Bot size={14} className="text-blue-400" />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <div ref={messagesEndRef} />

                                {/* Typing indicator */}
                                {clientTyping && (
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                                            <User size={14} className="text-gray-400" />
                                        </div>
                                        <div className="bg-white/10 border border-white/5 rounded-2xl rounded-tl-sm px-5 py-3 flex items-center gap-1">
                                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                        <span className="text-[10px] text-gray-500 self-center ml-1">écrit...</span>
                                    </div>
                                )}
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
                                <div className="flex items-center justify-between px-2 mt-2 border-t border-white/5 pt-3">
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Languages size={14} className="text-blue-400" />
                                        Langue détectée (client) : <span className="font-bold text-gray-300">{detectedClientLanguage}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleTranslateOutbox}
                                        disabled={!replyText.trim() || translatingOwn}
                                        className="text-xs font-bold text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all"
                                    >
                                        {translatingOwn ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
                                        Traduire mon texte avant envoi
                                    </button>
                                </div>
                                {/* Suggestions IA */}
                                {(loadingSuggestions || replySuggestions.length > 0) && (
                                    <div className="mt-3 px-2">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5">
                                            <Bot size={11} className="text-blue-400" />
                                            Suggestions IA ({detectedClientLanguage})
                                            {loadingSuggestions && <Loader2 size={10} className="animate-spin text-blue-400 ml-1" />}
                                        </p>
                                        <div className="flex flex-col gap-1.5">
                                            {loadingSuggestions && replySuggestions.length === 0 && (
                                                <div className="flex gap-2">
                                                    {[1, 2, 3].map(i => (
                                                        <div key={i} className="h-7 flex-1 bg-white/5 rounded-lg animate-pulse" />
                                                    ))}
                                                </div>
                                            )}
                                            {replySuggestions.map((s, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => setReplyText(s)}
                                                    className="text-left text-xs text-gray-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 rounded-xl px-3 py-2 transition-all leading-relaxed"
                                                >
                                                    <span className="text-blue-400 font-bold mr-1.5">#{i + 1}</span>{s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mt-4 px-2">
                                    <AlertCircle size={10} className="text-blue-400" />
                                    <p className="text-[10px] text-gray-400 font-medium">Répondez depuis cette console, l&apos;email sera envoyé via l&apos;adresse officielle.</p>
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

