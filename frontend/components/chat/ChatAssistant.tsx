"use client";

import { useTranslation, T } from '@/lib/translation';
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatCircle as MessageCircle, X, PaperPlaneTilt as Send, Robot as Bot, Headphones, CircleNotch as Loader2, CheckCircle, ArrowLeft, Microphone as Mic, MicrophoneSlash as MicOff } from '@phosphor-icons/react';
import { supabase } from "@/lib/supabase";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface DBMessage {
    id: string;
    conversation_id: string;
    role: 'client' | 'agent';
    content: string;
    created_at: string;
}

type ChatMode = "ai" | "checking_agents" | "offline_form" | "live_form" | "live_chat" | "success";

export default function ChatAssistant() {
    const { t, lang } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [liveMessages, setLiveMessages] = useState<DBMessage[]>([]);
    const [mode, setMode] = useState<ChatMode>("ai");
    const [messages, setMessages] = useState<Message[]>([]);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    const fetchLiveMessages = useCallback(async (id: string) => {
        const { data } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('conversation_id', id)
            .order('created_at', { ascending: true });
        if (data) {
            setLiveMessages(data as DBMessage[]);
            setTimeout(scrollToBottom, 100);
        }
    }, [scrollToBottom]);

    // Initialize messages once or when language changes if no messages yet
    useEffect(() => {
        if (messages.length === 0) {
            setMessages([
                {
                    role: "assistant",
                    content: t("Bienvenue chez Retour Gagnant ! 🇧🇯 Je suis votre assistant virtuel. Comment puis-je vous aider dans votre projet de retour au Bénin ?"),
                },
            ]);
        }
    }, [t, messages.length]);

    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Support Form state
    const [activeAgents, setActiveAgents] = useState<number | null>(null);
    const [nom, setNom] = useState("");
    const [prenom, setPrenom] = useState("");
    const [email, setEmail] = useState("");
    const [whatsapp, setWhatsapp] = useState("");
    const [supportMsg, setSupportMsg] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState("");
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recognitionRef = useRef<any>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const savedSession = sessionStorage.getItem('supportSessionId');
        if (savedSession) {
            setSessionId(savedSession);
            setMode("live_chat");
            fetchLiveMessages(savedSession);
        }
    }, [fetchLiveMessages]);

    useEffect(() => {
        if (mode === "live_chat" && sessionId) {
            const channel = supabase.channel(`client_chat_${sessionId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `conversation_id=eq.${sessionId}`
                }, (payload) => {
                    const newMsg = payload.new as DBMessage;
                    setLiveMessages(prev => {
                        if (prev.find(m => m.id === newMsg.id || (m.role === newMsg.role && m.content === newMsg.content))) {
                            return prev;
                        }
                        return [...prev, newMsg];
                    });
                    setTimeout(scrollToBottom, 100);
                })
                .subscribe();
            return () => { supabase.removeChannel(channel); };
        }
    }, [mode, sessionId, scrollToBottom]);

    const sendVoiceMessage = useCallback(async (transcript: string, duration: number) => {
        if (!transcript.trim()) return;

        const voiceContent = ` [Message vocal : ${duration}s] : ${transcript.trim()}`;

        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: voiceContent }]);
        setIsLoading(true);

        fetch("/api/support/voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                transcript: transcript.trim(),
                duration: duration,
                source: "chat",
            }),
        }).catch((err) => console.error("Voice save error:", err));

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [
                        ...messages.map((m) => ({ role: m.role, content: m.content })),
                        { role: "user", content: transcript.trim() },
                    ],
                    lang: lang
                }),
            });

            const data = await res.json();
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: data.reply || "Désolé, une erreur s'est produite. Veuillez réessayer." },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Connexion interrompue. Veuillez réessayer." },
            ]);
        } finally {
            setIsLoading(false);
            setVoiceTranscript("");
        }
    }, [messages, lang]);

    const stopRecording = useCallback(() => {
        const finalTranscript = voiceTranscript;
        const finalDuration = recordingDuration;

        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setIsRecording(false);
        setRecordingDuration(0);
        setInput("");

        if (finalTranscript.trim()) {
            sendVoiceMessage(finalTranscript, finalDuration);
        }
    }, [voiceTranscript, recordingDuration, sendVoiceMessage]);

    const startRecording = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Votre navigateur ne supporte pas la reconnaissance vocale. Essayez Chrome ou Edge.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = lang === 'fr' ? 'fr-FR' : (lang === 'en' ? 'en-US' : 'fr-FR');
        recognition.interimResults = true;
        recognition.continuous = true;

        recognition.onresult = (event: any) => {
            let finalTranscript = "";
            for (let i = 0; i < event.results.length; i++) {
                finalTranscript += event.results[i][0].transcript;
            }
            setVoiceTranscript(finalTranscript);
            setInput(finalTranscript);
        };

        recognition.onerror = () => {
            if (recognitionRef.current) recognitionRef.current = null;
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            setIsRecording(false);
            setRecordingDuration(0);
        };

        recognition.onend = () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
        setRecordingDuration(0);
        setVoiceTranscript("");
        setInput("");

        timerRef.current = setInterval(() => {
            setRecordingDuration(prev => prev + 1);
        }, 1000);
    }, [lang]);

    useEffect(() => {
        if (mode === "ai" || mode === "live_chat") scrollToBottom();
    }, [messages, liveMessages, mode, scrollToBottom]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [
                        ...messages.map((m) => ({ role: m.role, content: m.content })),
                        { role: "user", content: userMessage },
                    ],
                    lang: lang
                }),
            });

            const data = await res.json();
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: data.reply || "Désolé, une erreur s'est produite. Veuillez réessayer." },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Connexion interrompue. Veuillez réessayer ou nous contacter directement au +229 01 60 32 21 21 ou au +229 01 94 35 50 50." },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCheckSupport = async () => {
        setMode("checking_agents");
        try {
            const res = await fetch("/api/support/status");
            const data = await res.json();

            setTimeout(() => {
                const onlineCount = data.onlineAgents || 0;
                setActiveAgents(onlineCount);
                if (onlineCount > 0) {
                    setMode("live_form");
                } else {
                    setMode("offline_form");
                }
            }, 1000);
        } catch {
            setTimeout(() => {
                setActiveAgents(0);
                setMode("offline_form");
            }, 1000);
        }
    };

    const handleLiveStart = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nom.trim() || !email.trim() || !supportMsg.trim()) return;

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/support/start_live", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nom, email, question: supportMsg })
            });
            const data = await res.json();
            if (data.sessionId) {
                setSessionId(data.sessionId);
                sessionStorage.setItem('supportSessionId', data.sessionId);
                setMode("live_chat");
                fetchLiveMessages(data.sessionId);
                setInput("");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const sendLiveMessage = async () => {
        if (!input.trim() || !sessionId) return;
        const msg = input.trim();
        setInput("");

        await supabase.from('chat_messages').insert({
            conversation_id: sessionId,
            role: 'client',
            content: msg
        });
    };

    const handleSupportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nom.trim() || !prenom.trim() || !email.trim() || !whatsapp.trim() || !supportMsg.trim()) return;

        setIsSubmitting(true);
        try {
            await fetch("/api/support/offline", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nom, prenom, email, whatsapp, message: supportMsg })
            });
            setMode("success");
            setNom(""); setPrenom(""); setEmail(""); setWhatsapp(""); setSupportMsg("");
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-gradient-to-tr from-[#008751] to-[#00b06a] text-white shadow-[0_8px_30px_rgba(0,135,81,0.4)] flex items-center justify-center hover:scale-110 transition-transform"
                whileTap={{ scale: 0.9 }}
                animate={!isOpen ? { scale: [1, 1.05, 1], boxShadow: ["0 8px 30px rgba(0,135,81,0.4)", "0 8px 40px rgba(0,135,81,0.6)", "0 8px 30px rgba(0,135,81,0.4)"] } : {}}
                transition={{ repeat: Infinity, duration: 2.5 }}
                title={isOpen ? t("Fermer") : t("Ouvrir l'assistant")}
            >
                {isOpen ? <X size={26} /> : <MessageCircle size={26} />}
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-8rem)] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-black/5"
                    >
                        <div className="bg-gradient-to-r from-[#008751] to-[#006039] text-white px-6 py-5 flex items-center justify-between shadow-md relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
                                    {mode === "ai" ? <Bot size={24} className="text-[#FCD116]" /> : <Headphones size={24} className="text-[#FCD116]" />}
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="font-black font-heading tracking-wide text-[15px]">
                                        {mode === "ai" ? t("Assistant Virtuel") : t("Assistance Humaine")}
                                    </h3>
                                    <span className="text-[11px] text-white/80 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                                        <span className={`w-2 h-2 rounded-full animate-pulse ${mode === "ai" ? "bg-[#FCD116]" : "bg-blue-400"}`} />
                                        {mode === "ai" ? t("IA En Ligne") : t("Pôle Client")}
                                    </span>
                                </div>
                            </div>
                            {mode !== "ai" && mode !== "checking_agents" && (
                                <button
                                    onClick={() => setMode("ai")}
                                    className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center hover:bg-black/30 transition-colors"
                                    title={t("Retour à l'IA")}
                                >
                                    <ArrowLeft size={18} />
                                </button>
                            )}
                        </div>

                        {mode === "ai" && (
                            <>
                                <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#f8f9fc]">
                                    {messages.map((msg, i) => (
                                        <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                            {msg.role === "assistant" && (
                                                <div className="w-8 h-8 rounded-full bg-[#008751] flex items-center justify-center shrink-0 mt-1 shadow-md">
                                                    <Bot size={16} className="text-white" />
                                                </div>
                                            )}
                                            <div
                                                className={`max-w-[80%] px-5 py-3.5 rounded-2xl text-[14px] leading-relaxed shadow-sm ${msg.role === "user"
                                                    ? "bg-[#008751] text-white rounded-br-sm"
                                                    : "bg-white text-gray-800 border border-black/5 rounded-bl-sm"
                                                    }`}
                                            >
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex gap-2 items-center">
                                            <div className="w-8 h-8 rounded-full bg-[#008751] flex items-center justify-center shrink-0 shadow-md">
                                                <Bot size={16} className="text-white" />
                                            </div>
                                            <div className="bg-white px-5 py-4 rounded-2xl rounded-bl-sm border border-black/5 shadow-sm">
                                                <div className="flex gap-1.5">
                                                    <span className="w-2 h-2 bg-[#008751] rounded-full animate-bounce [animation-delay:0ms]" />
                                                    <span className="w-2 h-2 bg-[#FCD116] rounded-full animate-bounce [animation-delay:150ms]" />
                                                    <span className="w-2 h-2 bg-[#E8112D] rounded-full animate-bounce [animation-delay:300ms]" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                <div className="bg-[#f8f9fc] px-5 pb-3">
                                    <button
                                        onClick={handleCheckSupport}
                                        className="w-full flex items-center justify-center gap-2 bg-white border border-[#FCD116]/40 hover:border-[#FCD116] text-black font-bold uppercase tracking-widest text-[11px] py-3 rounded-xl shadow-sm hover:shadow-md transition-all group"
                                        title={t("Parler à l&apos;assistance")}
                                    >
                                        <Headphones size={16} className="text-[#008751] group-hover:scale-110 transition-transform" />
                                        <T>Parler à l&apos;assistance</T>
                                    </button>
                                </div>

                                <div className="p-4 border-t border-black/5 bg-white">
                                    <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder={isRecording ? t(" Parlez maintenant...") : t("Posez votre question...")}
                                            className="flex-1 px-5 py-3.5 rounded-xl bg-[#f8f9fc] border border-black/5 text-[14px] focus:outline-none focus:border-[#008751] transition-colors"
                                            disabled={isLoading || isRecording}
                                        />
                                        <button
                                            type="button"
                                            onClick={isRecording ? stopRecording : startRecording}
                                            title={isRecording ? t("Arrêter l&apos;enregistrement") : t("Enregistrer un message vocal")}
                                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-md ${isRecording
                                                ? "bg-[#E8112D] text-white animate-pulse"
                                                : "bg-[#FCD116]/10 text-[#008751] border border-[#FCD116]/30 hover:bg-[#FCD116]/20"
                                                }`}
                                        >
                                            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isLoading || !input.trim()}
                                            className="w-12 h-12 rounded-xl bg-[#008751] text-white flex items-center justify-center hover:bg-[#006039] disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95 shadow-md"
                                            title={t("Envoyer le message")}
                                        >
                                            <Send size={18} />
                                        </button>
                                    </form>
                                    {isRecording && (
                                        <div className="mt-2 flex items-center gap-3 px-4 py-2 rounded-xl bg-[#E8112D]/5 border border-[#E8112D]/20">
                                            <span className="w-3 h-3 bg-[#E8112D] rounded-full animate-pulse" />
                                            <div className="flex gap-[2px] items-end h-4">
                                                {[1, 2, 3, 4, 5, 6, 7].map(i => (
                                                    <span key={i} className="w-[3px] bg-[#E8112D]/60 rounded-full animate-pulse" style={{ height: `${Math.random() * 14 + 4}px`, animationDelay: `${i * 80}ms` }} />
                                                ))}
                                            </div>
                                            <span className="text-[11px] font-bold text-[#E8112D] uppercase tracking-widest">
                                                {recordingDuration}s : <T>En écoute...</T>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {mode === "live_chat" && (
                            <>
                                <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#f8f9fc]">
                                    {liveMessages.map((msg, i) => (
                                        <div key={i} className={`flex gap-3 ${msg.role === "client" ? "justify-end" : "justify-start"}`}>
                                            {msg.role === "agent" && (
                                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mt-1 shadow-md">
                                                    <Headphones size={16} className="text-white" />
                                                </div>
                                            )}
                                            <div
                                                className={`max-w-[80%] px-5 py-3.5 rounded-2xl text-[14px] leading-relaxed shadow-sm ${msg.role === "client"
                                                    ? "bg-[#008751] text-white rounded-br-sm"
                                                    : "bg-white text-gray-800 border border-black/5 rounded-bl-sm"
                                                    }`}
                                            >
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>

                                <div className="p-4 border-t border-black/5 bg-white">
                                    <form onSubmit={(e) => { e.preventDefault(); sendLiveMessage(); }} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder={t("Répondre...")}
                                            className="flex-1 px-5 py-3.5 rounded-xl bg-[#f8f9fc] border border-black/5 text-[14px] focus:outline-none focus:border-[#008751] transition-colors"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!input.trim()}
                                            className="w-12 h-12 rounded-xl bg-[#008751] text-white flex items-center justify-center hover:bg-[#006039] disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95 shadow-md"
                                            title={t("Envoyer le message")}
                                        >
                                            <Send size={18} />
                                        </button>
                                    </form>
                                </div>
                            </>
                        )}

                        {mode === "live_form" && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto bg-[#f8f9fc]">
                                <div className="p-6">
                                    <div className="border p-4 rounded-xl mb-6 bg-emerald-50 border-emerald-100">
                                        <p className="text-[13px] font-medium leading-relaxed text-emerald-800">
                                            <strong className="font-black">({activeAgents}) <T>agent(s) en ligne</T></strong> ! <T>Renseignez vos informations pour démarrer un chat en direct immédiatement.</T>
                                        </p>
                                    </div>
                                    <form onSubmit={handleLiveStart} className="space-y-4">
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block"><T>Votre Nom</T></label>
                                            <input type="text" required value={nom} onChange={e => setNom(e.target.value)} placeholder={t("Nom complet")} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#008751]" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block"><T>Email</T></label>
                                            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={t("Email de contact")} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#008751]" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block"><T>Quelle est votre question ?</T></label>
                                            <textarea required rows={3} value={supportMsg} onChange={e => setSupportMsg(e.target.value)} placeholder={t("Votre premier message...")} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#008751] resize-none" />
                                        </div>
                                        <button type="submit" disabled={isSubmitting} className="w-full py-4 mt-2 bg-[#008751] hover:bg-[#006039] text-white font-black uppercase tracking-widest text-[12px] rounded-xl transition-all shadow-md flex items-center justify-center gap-2" title={t("Lancer le Chat Live")}>
                                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                            {isSubmitting ? t("Connexion...") : t("Lancer le Chat Live")}
                                        </button>
                                    </form>
                                </div>
                            </motion.div>
                        )}

                        {mode === "checking_agents" && (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#f8f9fc]">
                                <Loader2 size={48} className="animate-spin text-[#008751] mb-6" />
                                <h4 className="font-black text-lg text-gray-800 font-heading mb-2"><T>Recherche d&apos;agents</T></h4>
                                <p className="text-gray-500 text-[13px] leading-relaxed">
                                    <T>Nous vérifions la disponibilité de nos conseillers en temps réel. Un instant s&apos;il vous plaît...</T>
                                </p>
                            </div>
                        )}

                        {mode === "offline_form" && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto bg-[#f8f9fc]">
                                <div className="p-6">
                                    <div className={`border p-4 rounded-xl mb-6 ${activeAgents && activeAgents > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}>
                                        <p className={`text-[13px] font-medium leading-relaxed ${activeAgents && activeAgents > 0 ? 'text-emerald-800' : 'text-orange-800'}`}>
                                            {activeAgents && activeAgents > 0 ? (
                                                <><T>Actuellement,</T> <strong className="font-black">({activeAgents}) <T>agent(s) en ligne</T></strong> ! <T>Remplissez avec votre nom et la nature de votre requête pour être pris en charge immédiatement par votre conseiller.</T></>
                                            ) : (
                                                <><T>Actuellement,</T> <strong className="font-black"><T>(0) agent connecté</T></strong>. <T>Mais ne vous inquiétez pas ! Laissez votre message et notre équipe vous recontactera en ultra priorité.</T></>
                                            )}
                                        </p>
                                    </div>

                                    <form onSubmit={handleSupportSubmit} className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block"><T>Nom</T></label>
                                                <input type="text" required value={nom} onChange={e => setNom(e.target.value)} placeholder={t("Votre nom")} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#008751]" />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block"><T>Prénom</T></label>
                                                <input type="text" required value={prenom} onChange={e => setPrenom(e.target.value)} placeholder={t("Votre prénom")} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#008751]" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block"><T>Email de contact</T></label>
                                            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={t("votreemail@domaine.com")} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#008751]" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block"><T>Numéro WhatsApp</T></label>
                                            <input type="tel" required value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder={t("+229 XX XX XX XX")} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#008751]" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block"><T>Votre préoccupation</T></label>
                                            <textarea required rows={4} value={supportMsg} onChange={e => setSupportMsg(e.target.value)} placeholder={t("Décrivez votre besoin en détail...")} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#008751] resize-none" />
                                        </div>

                                        <button type="submit" disabled={isSubmitting} className="w-full py-4 mt-2 bg-[#FCD116] hover:bg-[#008751] hover:text-white text-black font-black uppercase tracking-widest text-[12px] rounded-xl transition-all shadow-md flex items-center justify-center gap-2" title={t("Envoyer ma demande")}>
                                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                            {isSubmitting ? t("Envoi en cours...") : t("Envoyer ma demande")}
                                        </button>
                                    </form>
                                </div>
                            </motion.div>
                        )}

                        {mode === "success" && (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#f8f9fc]">
                                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center border-4 border-white shadow-lg mb-6">
                                    <CheckCircle size={40} className="text-[#008751]" />
                                </div>
                                <h4 className="font-black text-xl text-gray-800 font-heading mb-3"><T>Demande Reçue !</T></h4>
                                <p className="text-gray-500 text-[14px] leading-relaxed mb-8">
                                    <T>Une alerte prioritaire vient d&apos;être envoyée à notre équipe et un mail intelligent vous a été transmis pour confirmation. Nous revenons vers vous sur WhatsApp très rapidement !</T>
                                </p>
                                <button onClick={() => setMode("ai")} className="px-6 py-3 bg-[#008751] text-white font-bold rounded-xl shadow-md hover:bg-[#006039] transition-colors" title={t("Retour à l'IA")}>
                                    <T>Retour à l&apos;IA</T>
                                </button>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
