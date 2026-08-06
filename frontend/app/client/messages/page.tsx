'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { ClientCallButton } from '@/components/client/ClientCallButton'
import { ChatText as MessageSquare, PaperPlaneTilt as Send, CircleNotch as Loader2, CheckCircle as CheckCircle2, WarningCircle as AlertCircle, Clock, CaretRight as ChevronRight, User } from '@phosphor-icons/react';

interface Message {
    id: string
    sujet: string
    message: string
    type: string
    lu: boolean
    created_at: string
}

interface ChatMessage {
    id: string
    conversation_id: string
    role: 'agent' | 'client'
    content: string
    created_at: string
}

interface Thread {
    msg: Message
    replies: ChatMessage[]
    hasUnread: boolean
}

const LAST_SEEN_KEY = 'client_messages_last_seen'

export default function ClientMessagesPage() {
    const [threads, setThreads] = useState<Thread[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<Thread | null>(null)
    const [form, setForm] = useState({ sujet: '', message: '' })
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState('')
    const [clientInfo, setClientInfo] = useState({ nom: '', prenom: '', email: '', phone: '', id: '' })
    const [replyText, setReplyText] = useState('')
    const [sendingReply, setSendingReply] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)
    const threadBottomRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const getLastSeen = () => {
        try { return parseInt(localStorage.getItem(LAST_SEEN_KEY) || '0', 10) } catch { return 0 }
    }

    const markSeen = () => {
        try { localStorage.setItem(LAST_SEEN_KEY, Date.now().toString()) } catch { /* ignore */ }
    }

    const loadThreads = async (uid: string, email: string) => {
        const { data: msgs } = await supabase
            .from('messages')
            .select('id, sujet, message, type, lu, created_at')
            .or(`client_id.eq.${uid},email.eq.${email}`)
            .order('created_at', { ascending: false })

        const msgList = (msgs as Message[]) || []

        if (msgList.length === 0) {
            setThreads([])
            return
        }

        const ids = msgList.map(m => m.id)
        const { data: chats } = await supabase
            .from('chat_messages')
            .select('id, conversation_id, role, content, created_at')
            .in('conversation_id', ids)
            .order('created_at', { ascending: true })

        const chatList = (chats as ChatMessage[]) || []
        const lastSeen = getLastSeen()

        const built: Thread[] = msgList.map(msg => {
            const replies = chatList.filter(c => c.conversation_id === msg.id)
            const agentReplies = replies.filter(r => r.role === 'agent')
            const hasUnread = agentReplies.some(r => new Date(r.created_at).getTime() > lastSeen)
            return { msg, replies, hasUnread }
        })

        setThreads(built)
    }

    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) return
            const email = session.user.email || ''

            const { data: profile } = await supabase
                .from('client_profiles')
                .select('nom, prenom, phone')
                .eq('id', session.user.id)
                .single()

            setClientInfo({ email, nom: profile?.nom || '', prenom: profile?.prenom || '', phone: profile?.phone || '', id: session.user.id })

            await loadThreads(session.user.id, email)
            setLoading(false)
        }
        load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Supabase Realtime — reçoit les nouvelles réponses de l'agent en direct
    useEffect(() => {
        if (!selected) return

        const channel = supabase
            .channel(`chat-${selected.msg.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `conversation_id=eq.${selected.msg.id}`,
            }, (payload) => {
                const newMsg = payload.new as ChatMessage
                // Déduplique (évite double ajout si on vient d'envoyer)
                setSelected(prev => {
                    if (!prev || prev.replies.some(r => r.id === newMsg.id)) return prev
                    return { ...prev, replies: [...prev.replies, newMsg] }
                })
                setThreads(prev => prev.map(t => {
                    if (t.msg.id !== newMsg.conversation_id || t.replies.some(r => r.id === newMsg.id)) return t
                    return { ...t, replies: [...t.replies, newMsg] }
                }))
                if (newMsg.role === 'agent') markSeen()
                setTimeout(() => threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.msg.id])

    // Auto-resize du textarea de réponse
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 96)}px`
        }
    }, [replyText])

    const openThread = (thread: Thread) => {
        setSelected(thread)
        setReplyText('')
        markSeen()
        setThreads(prev => prev.map(t =>
            t.msg.id === thread.msg.id ? { ...t, hasUnread: false } : t
        ))
        setTimeout(() => threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 120)
    }

    const handleReply = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!replyText.trim() || !selected || sendingReply) return
        setSendingReply(true)
        const content = replyText.trim()
        setReplyText('')

        const { data, error: insertErr } = await supabase
            .from('chat_messages')
            .insert({ conversation_id: selected.msg.id, role: 'client', content })
            .select()
            .single()

        if (!insertErr && data) {
            const newMsg = data as ChatMessage
            setSelected(prev => prev ? { ...prev, replies: [...prev.replies, newMsg] } : null)
            setThreads(prev => prev.map(t =>
                t.msg.id === selected.msg.id ? { ...t, replies: [...t.replies, newMsg] } : t
            ))
            setTimeout(() => threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
        setSendingReply(false)
    }

    const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleReply()
        }
    }

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.sujet.trim() || !form.message.trim()) return
        setSending(true)
        setError('')

        try {
            const { error: insertErr } = await supabase
                .from('messages')
                .insert({
                    client_id: clientInfo.id || null,
                    nom: clientInfo.nom || clientInfo.email.split('@')[0],
                    prenom: clientInfo.prenom || '',
                    email: clientInfo.email,
                    telephone: clientInfo.phone,
                    sujet: form.sujet,
                    message: form.message,
                    type: 'support',
                    lu: false,
                })

            if (insertErr) throw new Error(insertErr.message)

            await loadThreads(clientInfo.id, clientInfo.email)
            setForm({ sujet: '', message: '' })
            setSent(true)
            setTimeout(() => setSent(false), 3000)
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi.')
        }
        setSending(false)
    }

    const totalUnread = threads.filter(t => t.hasUnread).length
    const fmtTime = (d: string) => {
        if (!d) return '—'
        const dateObj = new Date(d)
        return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }
    const fmtDate = (d: string) => {
        if (!d) return '—'
        const dateObj = new Date(d)
        return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    }

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <MessageSquare size={14} className="text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Messagerie</span>
                </div>
                <h1 className="text-2xl font-black text-white flex items-center gap-3">
                    Messages
                    {totalUnread > 0 && (
                        <span className="text-sm font-bold bg-[var(--panel-accent)] text-white px-2 py-0.5 rounded-full">
                            {totalUnread} nouvelle{totalUnread > 1 ? 's' : ''} réponse{totalUnread > 1 ? 's' : ''}
                        </span>
                    )}
                </h1>
                <p className="text-gray-500 text-sm mt-1">Échangez avec votre agent en temps réel.</p>
            </div>

            {/* Appel vocal direct — la voix passe en pair-à-pair, sans serveur intermédiaire. */}
            <div className="bg-[#0a1221] border border-white/[0.06] rounded-2xl p-5">
                <h2 className="font-black text-white text-sm mb-1">Parler à un conseiller</h2>
                <p className="text-gray-500 text-xs mb-4">
                    Un agent disponible décroche directement depuis son poste.
                </p>
                <ClientCallButton sujet="Appel depuis l'espace client" />
            </div>

            <div className="grid lg:grid-cols-5 gap-5">
                {/* Formulaire nouveau message */}
                <div className="lg:col-span-2 bg-[#0a1221] border border-white/[0.06] rounded-2xl p-5">
                    <h2 className="font-black text-white text-sm mb-4 flex items-center gap-2">
                        <Send size={15} className="text-emerald-400" /> Nouveau sujet
                    </h2>

                    <AnimatePresence>
                        {error && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/8 border border-red-500/15">
                                    <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-red-400 text-[12px]">{error}</p>
                                </div>
                            </motion.div>
                        )}
                        {sent && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                                    <CheckCircle2 size={14} className="text-emerald-400" />
                                    <p className="text-emerald-400 text-[12px] font-bold">Message envoyé !</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSend} className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">Sujet</label>
                            <input type="text" required value={form.sujet} onChange={e => setForm(f => ({ ...f, sujet: e.target.value }))}
                                placeholder="Ex: Question sur mon dossier"
                                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-emerald-500/40 rounded-xl py-2.5 px-3 text-white placeholder:text-gray-600 focus:outline-none text-sm transition-colors" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">Message</label>
                            <textarea required rows={5} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                                placeholder="Décrivez votre demande ou question..."
                                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-emerald-500/40 rounded-xl py-2.5 px-3 text-white placeholder:text-gray-600 focus:outline-none text-sm resize-none transition-colors" />
                        </div>
                        <motion.button type="submit" disabled={sending} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold h-11 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                            {sending ? <Loader2 className="animate-spin" size={16} /> : <><Send size={14} /> Envoyer</>}
                        </motion.button>
                    </form>
                </div>

                {/* Conversations + thread chat */}
                <div className={`lg:col-span-3 bg-[#0a1221] border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col ${selected ? 'h-[600px]' : 'min-h-[480px]'}`}>
                    {loading ? (
                        <div className="flex items-center justify-center flex-1 p-10">
                            <div className="w-6 h-6 border-2 border-[var(--panel-accent)]/30 border-t-blue-500 rounded-full animate-spin" />
                        </div>
                    ) : threads.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                            <MessageSquare size={28} className="text-gray-700 mb-2" />
                            <p className="text-gray-500 text-sm">Aucun message pour le moment.</p>
                            <p className="text-gray-600 text-xs mt-1">Envoyez votre premier message à votre agent.</p>
                        </div>
                    ) : selected ? (

                        /* ═══ Vue chat instantané ═══ */
                        <div className="flex flex-col h-full">

                            {/* Header fil */}
                            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3 flex-shrink-0">
                                <button type="button" aria-label="Retour" onClick={() => setSelected(null)}
                                    className="text-gray-500 hover:text-white transition-colors flex-shrink-0 p-1 rounded-lg hover:bg-white/[0.05]">
                                    <ChevronRight size={16} className="rotate-180" />
                                </button>
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/25 to-teal-500/20 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                                    <User size={14} className="text-emerald-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white text-sm truncate">{selected.msg.sujet}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <p className="text-[10px] text-emerald-400 font-semibold">Votre agent · En ligne</p>
                                    </div>
                                </div>
                            </div>

                            {/* Zone messages — scrollable */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">

                                {/* Message initial du client */}
                                <div className="flex justify-end">
                                    <div className="max-w-[78%]">
                                        <div className="bg-[var(--panel-accent-soft)] border border-[var(--panel-accent)]/20 rounded-2xl rounded-tr-sm px-4 py-2.5">
                                            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line">{selected.msg.message}</p>
                                        </div>
                                        <p className="text-[10px] text-gray-600 mt-1 text-right pr-1">{fmtTime(selected.msg.created_at)}</p>
                                    </div>
                                </div>

                                {/* Réponses (agent + client) */}
                                {selected.replies.map((reply) => (
                                    <motion.div
                                        key={reply.id}
                                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                        className={`flex items-end gap-2 ${reply.role === 'agent' ? 'justify-start' : 'justify-end'}`}
                                    >
                                        {reply.role === 'agent' && (
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500/25 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 mb-4">
                                                <User size={11} className="text-emerald-400" />
                                            </div>
                                        )}
                                        <div className={`max-w-[78%] ${reply.role === 'agent' ? '' : ''}`}>
                                            <div className={`rounded-2xl px-4 py-2.5 ${reply.role === 'agent'
                                                ? 'bg-[#0f2a1e] border border-emerald-500/15 rounded-bl-sm'
                                                : 'bg-[var(--panel-accent-soft)] border border-[var(--panel-accent)]/20 rounded-br-sm'}`}>
                                                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line">{reply.content}</p>
                                            </div>
                                            <p className={`text-[10px] text-gray-600 mt-1 px-1 ${reply.role === 'agent' ? 'text-left' : 'text-right'}`}>
                                                {fmtTime(reply.created_at)}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}

                                {/* Aucune réponse encore */}
                                {selected.replies.filter(r => r.role === 'agent').length === 0 && (
                                    <div className="flex items-center justify-center gap-2 py-4">
                                        <Clock size={12} className="text-gray-600" />
                                        <p className="text-[11px] text-gray-600">En attente de réponse · Délai habituel : 24h</p>
                                    </div>
                                )}

                                <div ref={threadBottomRef} />
                            </div>

                            {/* Zone de réponse instantanée */}
                            <div className="border-t border-white/[0.06] p-3 flex-shrink-0 bg-[#060e1a]/50">
                                <form onSubmit={handleReply} className="flex items-end gap-2">
                                    <textarea
                                        ref={textareaRef}
                                        value={replyText}
                                        onChange={e => setReplyText(e.target.value)}
                                        onKeyDown={handleReplyKeyDown}
                                        placeholder="Répondre à votre agent…"
                                        rows={1}
                                        className="flex-1 bg-white/[0.05] border border-white/[0.08] focus:border-[var(--panel-accent)]/40 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder:text-gray-600 focus:outline-none resize-none transition-colors leading-relaxed"
                                    />
                                    <motion.button
                                        type="submit"
                                        disabled={!replyText.trim() || sendingReply}
                                        whileTap={{ scale: 0.94 }}
                                        className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--panel-accent)] flex items-center justify-center disabled:opacity-35 disabled:cursor-not-allowed transition-all hover:shadow-[0_4px_16px_rgba(59,130,246,0.4)]"
                                    >
                                        {sendingReply
                                            ? <Loader2 size={15} className="animate-spin text-white" />
                                            : <Send size={15} className="text-white" />
                                        }
                                    </motion.button>
                                </form>
                                <p className="text-[10px] text-gray-700 mt-1.5 text-center select-none">
                                    ↵ Entrée pour envoyer &nbsp;·&nbsp; Shift+↵ pour saut de ligne
                                </p>
                            </div>
                        </div>

                    ) : (
                        /* ═══ Liste des conversations ═══ */
                        <div className="flex flex-col flex-1">
                            <div className="p-4 border-b border-white/[0.06]">
                                <p className="font-black text-white text-sm flex items-center gap-2">
                                    <Clock size={14} className="text-[var(--panel-accent)]" /> Conversations ({threads.length})
                                </p>
                            </div>
                            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
                                {threads.map(thread => (
                                    <button type="button" key={thread.msg.id} onClick={() => openThread(thread)}
                                        className="w-full text-left p-4 hover:bg-white/[0.02] transition-colors flex items-start gap-3">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${thread.hasUnread ? 'bg-[var(--panel-accent)] shadow-[0_0_6px_rgba(59,130,246,0.6)]' : 'bg-transparent'}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className={`text-sm truncate ${thread.hasUnread ? 'font-bold text-white' : 'font-semibold text-gray-300'}`}>
                                                    {thread.msg.sujet}
                                                </p>
                                                <span className="text-[10px] text-gray-600 flex-shrink-0">
                                                    {fmtDate(thread.msg.created_at)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {thread.replies.filter(r => r.role === 'agent').length > 0 ? (
                                                    <>
                                                        <CheckCircle2 size={11} className={thread.hasUnread ? 'text-emerald-400' : 'text-gray-600'} />
                                                        <p className={`text-[11px] truncate ${thread.hasUnread ? 'text-emerald-400 font-bold' : 'text-gray-500'}`}>
                                                            {thread.hasUnread
                                                                ? 'Nouvelle réponse de votre agent'
                                                                : `${thread.replies.filter(r => r.role === 'agent').length} réponse(s)`}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Clock size={11} className="text-gray-600" />
                                                        <p className="text-[11px] text-gray-600">En attente de réponse</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronRight size={13} className="text-gray-600 flex-shrink-0 mt-1" />
                                    </button>
                                ))}
                                <div ref={bottomRef} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
