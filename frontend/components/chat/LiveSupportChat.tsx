"use client";

import { useTranslation, T } from '@/lib/translation';
import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Send, HeadphonesIcon, Loader2, User } from "lucide-react";

interface LiveSupportChatProps {
    email: string;
    clientName: string;
}

interface ChatMessage {
    id: string;
    role: string;
    content: string;
    created_at?: string;
    conversation_id?: string;
}

export default function LiveSupportChat({ email, clientName }: LiveSupportChatProps) {
    const { t } = useTranslation();
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastCountRef = useRef(0);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    // Fetch messages via API (bypasses RLS for anonymous users)
    const fetchMessages = useCallback(async (sid: string) => {
        try {
            const res = await fetch(`/api/support/get_messages?session_id=${sid}`);
            if (!res.ok) return;
            const data = await res.json();
            const msgs: ChatMessage[] = data.messages || [];
            if (msgs.length !== lastCountRef.current) {
                lastCountRef.current = msgs.length;
                setMessages(msgs);
                scrollToBottom();
            }
        } catch {
            // silently ignore polling errors
        }
    }, []);

    // Start polling when session is active
    const startPolling = useCallback((sid: string) => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        fetchMessages(sid);
        pollingRef.current = setInterval(() => fetchMessages(sid), 3000);
    }, [fetchMessages]);

    // Initial check for an active session
    useEffect(() => {
        const checkSession = async () => {
            if (!email) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                // Use service-role API to check for existing session
                const res = await fetch(`/api/support/check_session?email=${encodeURIComponent(email)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.sessionId) {
                        setSessionId(data.sessionId);
                    }
                }
            } catch {
                // no existing session
            }
            setIsLoading(false);
        };

        checkSession();

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [email]);

    // Start polling when sessionId changes
    useEffect(() => {
        if (!sessionId) return;
        startPolling(sessionId);

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [sessionId, startPolling]);

    // Setup typing broadcast channel
    useEffect(() => {
        if (!sessionId) return;
        typingChannelRef.current = supabase.channel(`typing_${sessionId}`);
        typingChannelRef.current.subscribe();
        return () => {
            if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current);
        };
    }, [sessionId]);

    const broadcastTyping = () => {
        typingChannelRef.current?.send({
            type: 'broadcast',
            event: 'typing',
            payload: { role: 'client' },
        });
    };

    const startNewSession = async () => {
        if (!input.trim()) return;
        setIsSubmitting(true);

        const question = input.trim();
        setInput("");

        try {
            const res = await fetch("/api/support/start_live", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nom: clientName || "Client Retour Gagnant", email, question })
            });
            const data = await res.json();
            if (data.sessionId) {
                // Mise à jour optimiste : afficher le premier message immédiatement
                const firstMsg: ChatMessage = {
                    id: `temp-${Date.now()}`,
                    conversation_id: data.sessionId,
                    role: 'client',
                    content: question,
                    created_at: new Date().toISOString(),
                };
                setMessages([firstMsg]);
                lastCountRef.current = 1;
                setSessionId(data.sessionId);
            } else {
                console.error("start_live error:", data.error);
            }
        } catch (err) {
            console.error("Failed to start session:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const sendMessage = async () => {
        if (!input.trim() || !sessionId) return;
        const msg = input.trim();
        setInput("");

        // Optimistic update
        const tempMsg: ChatMessage = {
            id: `temp-${Date.now()}`,
            conversation_id: sessionId,
            role: 'client',
            content: msg,
            created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, tempMsg]);
        scrollToBottom();

        try {
            await fetch("/api/support/send_message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId, content: msg, role: 'client' })
            });
            // Fetch updated messages after sending
            await fetchMessages(sessionId);
        } catch (err) {
            console.error("Failed to send message:", err);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (sessionId) {
            sendMessage();
        } else {
            startNewSession();
        }
    };

    if (isLoading) {
        return (
            <div className="h-[min(600px,80dvh)] w-full rounded-3xl bg-white border border-gray-100 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-emerald-500 mb-4" size={32} />
                <p className="text-xs text-gray-400 font-bold tracking-widest uppercase"><T>Connexion au canal sécurisé...</T></p>
            </div>
        );
    }

    return (
        <div className="h-[min(600px,80dvh)] w-full flex flex-col rounded-3xl overflow-hidden bg-white border border-gray-100 shadow-xl relative animate-in fade-in zoom-in-95 duration-500">
            {/* Ambient Background glow */}
            <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-50 to-white border-b border-gray-100 p-3 sm:p-5 flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                        <HeadphonesIcon className="text-emerald-400" size={24} />
                    </div>
                    <div className="flex flex-col">
                        <h3 className="font-black text-[#1a2332] text-lg font-heading tracking-wide"><T>Support Direct</T></h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-[0.2em]"><T>Connecté avec nos agents</T></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 scrollbar-premium z-10 relative bg-gray-50/50">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                        <div className="w-24 h-24 rounded-[2rem] bg-emerald-500/10 flex items-center justify-center mb-6 shadow-2xl">
                            <HeadphonesIcon size={48} className="text-emerald-500" />
                        </div>
                        <h4 className="text-2xl font-black text-[#1a2332] mb-3 font-heading"><T>Ligne Directe Ouverte</T></h4>
                        <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
                            Ce canal vous met en relation instantanée avec nos conseillers experts hautement qualifiés.
                            Posez votre question pour initialiser la liaison.
                        </p>
                    </div>
                ) : (
                    messages.map((msg, i) => (
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={msg.id || i}
                            className={`flex gap-3 ${msg.role === 'client' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.role === 'agent' && (
                                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-[#181C14] border border-[#FCD116]/30 flex items-center justify-center mt-1 shadow-md">
                                    <HeadphonesIcon size={14} className="text-[#FCD116]" />
                                </div>
                            )}
                            <div className={`max-w-[80%] px-5 py-4 text-[14px] leading-relaxed shadow-lg ${msg.role === 'client'
                                ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-sm'
                                : 'bg-white text-[#1a2332] rounded-2xl rounded-tl-sm border border-gray-100'
                                }`}>
                                {msg.content}
                            </div>
                            {msg.role === 'client' && (
                                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mt-1">
                                    <User size={14} className="text-emerald-400" />
                                </div>
                            )}
                        </motion.div>
                    ))
                )}
                {isSubmitting && (
                    <div className="flex gap-3 justify-end items-end pb-2">
                        <div className="max-w-[80%] px-5 py-3.5 rounded-2xl bg-emerald-600/30 text-white rounded-tr-sm border border-emerald-500/20 flex items-center gap-3 shadow-md">
                            <Loader2 size={16} className="animate-spin text-emerald-400" />
                            <span className="text-sm text-emerald-100 font-medium"><T>Transmission...</T></span>
                        </div>
                        <div className="w-8 h-8 flex-shrink-0 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shadow-md">
                            <User size={14} className="text-emerald-400 opacity-50" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 sm:p-5 bg-white border-t border-gray-100 z-10">
                <form onSubmit={handleSubmit} className="flex gap-3 relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => { setInput(e.target.value); broadcastTyping(); }}
                        placeholder={t("Écrivez votre message ici...")}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl py-4 pl-6 pr-14 text-[#1a2332] placeholder-gray-400 focus:outline-none focus:border-emerald-400 focus:bg-white text-sm transition-all"
                        disabled={isSubmitting}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isSubmitting}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    >
                        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="translate-x-[1px]" />}
                    </button>
                </form>
            </div>
        </div>
    );
}
