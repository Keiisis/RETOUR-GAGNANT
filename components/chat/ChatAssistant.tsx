"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";

interface Message {
    role: "user" | "assistant";
    content: string;
}

export default function ChatAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "Bienvenue chez Retour Gagnant ! 🇧🇯 Je suis votre assistant. Comment puis-je vous aider dans votre projet de retour au Bénin ?",
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Auto-open the assistant after 10 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsOpen(true);
        }, 10000);
        return () => clearTimeout(timer);
    }, []);

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
                { role: "assistant", content: "Connexion interrompue. Veuillez réessayer ou nous contacter directement au +229 01 23 45 67." },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Floating Button */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-[#008751] text-white shadow-[0_8px_30px_rgba(0,135,81,0.4)] flex items-center justify-center hover:bg-[#006039] transition-all hover:scale-110"
                whileTap={{ scale: 0.9 }}
                animate={!isOpen ? { scale: [1, 1.1, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2, repeatDelay: 3 }}
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
            </motion.button>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] max-h-[550px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="bg-[#008751] text-white px-5 py-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                <Bot size={22} />
                            </div>
                            <div>
                                <h3 className="font-bold font-heading text-sm">Assistant Retour Gagnant</h3>
                                <span className="text-xs text-white/70 flex items-center gap-1">
                                    <span className="w-2 h-2 bg-[#FCD116] rounded-full animate-pulse" />
                                    En ligne
                                </span>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[350px] bg-[#fafafa]">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                    {msg.role === "assistant" && (
                                        <div className="w-7 h-7 rounded-full bg-[#008751] flex items-center justify-center shrink-0 mt-1">
                                            <Bot size={14} className="text-white" />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === "user"
                                                ? "bg-[#008751] text-white rounded-br-sm"
                                                : "bg-white text-gray-800 border border-gray-100 rounded-bl-sm shadow-sm"
                                            }`}
                                    >
                                        {msg.content}
                                    </div>
                                    {msg.role === "user" && (
                                        <div className="w-7 h-7 rounded-full bg-[#FCD116] flex items-center justify-center shrink-0 mt-1">
                                            <User size={14} className="text-[#1a2332]" />
                                        </div>
                                    )}
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex gap-2 items-center">
                                    <div className="w-7 h-7 rounded-full bg-[#008751] flex items-center justify-center shrink-0">
                                        <Bot size={14} className="text-white" />
                                    </div>
                                    <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm border border-gray-100 shadow-sm">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-[#008751] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                            <span className="w-2 h-2 bg-[#FCD116] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                            <span className="w-2 h-2 bg-[#E8112D] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-3 border-t border-gray-100 bg-white">
                            <form
                                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                                className="flex gap-2"
                            >
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Posez votre question..."
                                    className="flex-1 px-4 py-3 rounded-xl bg-[#fafafa] border border-gray-200 text-sm focus:outline-none focus:border-[#008751] transition-colors"
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading || !input.trim()}
                                    className="w-11 h-11 rounded-xl bg-[#008751] text-white flex items-center justify-center hover:bg-[#006039] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send size={16} />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
