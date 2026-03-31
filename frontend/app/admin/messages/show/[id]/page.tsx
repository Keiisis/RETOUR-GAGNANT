'use client';

import { useShow, useNavigation, useDelete, useUpdate } from "@refinedev/core";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Mail, Phone, Calendar, Clock,
    Trash2, User, MoreVertical, ShieldCheck,
    MessageSquare, Reply, ExternalLink, Globe,
    Download, Printer, AlertCircle, CheckCircle2,
    Inbox, HardDrive, Share2, Sparkles, Loader2, Send,
    Languages
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatMessage {
    id: string;
    conversation_id: string;
    role: 'agent' | 'client';
    content: string;
    created_at: string;
}

interface MessageRecord {
    id: string;
    type: string;
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
    sujet?: string;
    message: string;
    created_at: string;
    lu?: boolean;
    date_rdv?: string;
    duree?: string;
}

export default function MessageShow() {
    const { id } = useParams();
    const { list } = useNavigation();
    const { query } = useShow<MessageRecord>({
        resource: "messages",
        id: id as string,
    });

    const { mutate: deleteItem } = useDelete();
    const { mutate: updateItem } = useUpdate();

    const record = query?.data?.data;
    const isLoading = query?.isLoading;

    const [isDrafting, setIsDrafting] = useState(false);
    const [draft, setDraft] = useState("");

    const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [translations, setTranslations] = useState<Record<string, { translated?: string, sourceLanguage?: string, translating?: boolean }>>({});
    const [detectedClientLanguage, setDetectedClientLanguage] = useState<string>("Anglais"); // Defaults to English for outgoing if unknown
    const [translatingOwn, setTranslatingOwn] = useState(false);

    // Live chat effect
    useEffect(() => {
        if (!record || record.type !== 'support') return;

        const fetchMessages = async () => {
            const { data } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('conversation_id', id)
                .order('created_at', { ascending: true });
            if (data) setLiveMessages(data);
        };
        fetchMessages();

        const channel = supabase.channel(`admin_chat_${id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `conversation_id=eq.${id}`
            }, (payload) => {
                const newMsg = payload.new as ChatMessage;
                setLiveMessages(prev => {
                    if (prev.find(m => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg];
                });
                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 100);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [record, id]);

    // Trigger Auto-translate for client messages
    useEffect(() => {
        liveMessages.forEach(msg => {
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
                            const langLow = data.sourceLanguage?.toLowerCase() || '';
                            if (!langLow.includes('franç') && !langLow.includes('french') && data.sourceLanguage !== "Inconnue") {
                                setDetectedClientLanguage(data.sourceLanguage);
                            }
                        }
                    })
                    .catch(console.error);
            }
        });
    }, [liveMessages, translations]);

    const handleTranslateOutbox = async () => {
        if (!chatInput.trim()) return;
        setTranslatingOwn(true);
        try {
            const res = await fetch('/api/ai/translate-message', {
                method: 'POST',
                body: JSON.stringify({ text: chatInput, mode: 'translate_to', targetLanguage: detectedClientLanguage })
            });
            const data = await res.json();
            if (data.translated) {
                setChatInput(data.translated);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setTranslatingOwn(false);
        }
    };

    // Send admin msg
    const sendAdminMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const msg = chatInput.trim();
        setChatInput("");

        await supabase.from('chat_messages').insert({
            conversation_id: id,
            role: 'agent',
            content: msg
        });
    };

    useEffect(() => {
        if (record?.type === 'support') {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        }
    }, [liveMessages, record]);

    const handleDraftReply = async () => {
        if (!record?.message) return;
        setIsDrafting(true);
        try {
            const resp = await fetch('/api/ai/admin-help', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Rédige une réponse professionnelle, chaleureçuse et stratégique au message suivant de ${record.nom} ${record.prenom}. 
                    Le but est de montrer que Retour Gagnant est à l'écoute et prêt à accompagner. 
                    Si c'est un RDV, confirmée l'intérêt. 
                    Ton : Premium, Expert, Bienveillant. 
                    Langue : Français.
                    
                    Message du client :
                    "${record.message}"`
                })
            });
            const data = await resp.json();
            if (data.text) {
                setDraft(data.text);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsDrafting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-60">
                <div className="w-16 h-16 border-t-2 border-[#E8112D] border-b-2 border-white/10 rounded-full animate-spin" />
                <p className="mt-6 text-[10px] text-gray-600 font-black uppercase tracking-[0.5em]">Décryptage de la liaison...</p>
            </div>
        );
    }

    if (!record) return null;

    return (
        <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in zoom-in-95 duration-700 pb-20">
            {/* ═══════════════════════════════════════════ */}
            {/* DOSSIER HEADER */}
            {/* ═══════════════════════════════════════════ */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => list("messages")}
                        title="Retour aux messages"
                        className="p-4 bg-white/5 border border-white/5 rounded-2xl text-gray-400 hover:text-white hover:bg-white/10 transition-all shadow-2xl group"
                    >
                        <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 text-[#E8112D] mb-1">
                            <Inbox size={14} />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Transmission Nexus Entrante</span>
                        </div>
                        <h1 className="text-4xl font-black text-white font-heading tracking-tight">COMMUNICATION <span className="text-[#E8112D]">#{id?.toString().slice(-4).toUpperCase()}</span></h1>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <Button
                        onClick={() => {
                            if (confirm("Archiver definitivement cette liaison ?")) {
                                deleteItem({ resource: "messages", id: id as string });
                                list("messages");
                            }
                        }}
                        className="flex-1 md:flex-none h-14 px-6 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all font-bold"
                    >
                        <Trash2 size={18} className="mr-2" /> SUPPRIMER
                    </Button>
                    <Button
                        className="flex-1 md:flex-none h-14 px-8 rounded-2xl bg-[#008751] text-white font-black tracking-widest gap-2 shadow-xl shadow-green-500/20"
                        onClick={() => {
                            const body = draft ? encodeURIComponent(draft) : "";
                            window.location.href = `mailto:${record.email}?subject=RE: ${record.sujet || 'Retour Gagnant'}&body=${body}`;
                        }}
                    >
                        <Reply size={20} /> RÉPONDRE
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* ═══════════════════════════════════════════ */}
                {/* LEFT COLUMN: THE MESSAGE BODY */}
                {/* ═══════════════════════════════════════════ */}
                <div className="lg:col-span-8 space-y-8">
                    {record.type === 'support' ? (
                        <Card className="bg-[#0a0f18] border-white/5 rounded-[3rem] shadow-3xl overflow-hidden relative flex flex-col h-[750px]">
                            {/* Live Chat Header */}
                            <div className="p-8 border-b border-white/5 bg-gradient-to-r from-[#FCD116]/10 to-transparent flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center">
                                    <MessageSquare className="text-[#FCD116]" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white font-heading tracking-tight">Support Direct Session</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Liaison Active</span>
                                    </div>
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-premium relative bg-white/[0.01]">
                                {liveMessages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                                        <Loader2 className="animate-spin mb-4" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Synchronisation Nexus...</p>
                                    </div>
                                ) : (
                                    liveMessages.map((msg, idx) => (
                                        <motion.div
                                            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                                            key={idx}
                                            className={`flex gap-3 ${msg.role === 'agent' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            {msg.role === 'client' && (
                                                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-1">
                                                    <User size={14} className="text-gray-400" />
                                                </div>
                                            )}
                                            <div className="flex flex-col gap-1 max-w-[80%]">
                                                <div className={`px-5 py-4 rounded-2xl text-[14px] leading-relaxed shadow-xl ${msg.role === 'agent'
                                                    ? 'bg-[#008751] text-white rounded-tr-sm border border-[#008751]/30'
                                                    : 'bg-white/[0.03] text-gray-300 rounded-tl-sm border border-white/10'
                                                    }`}>
                                                    {msg.content}
                                                </div>
                                                {msg.role === 'client' && translations[msg.id]?.translated && translations[msg.id]?.translated !== msg.content && (
                                                    <div className="text-[11px] text-gray-400 bg-white/5 border border-white/5 p-3 rounded-xl flex flex-col gap-1 mt-1 font-mono">
                                                        <span className="text-[#FCD116] font-bold"><Languages size={12} className="inline mr-1" /> Traduit de: {translations[msg.id]?.sourceLanguage}</span>
                                                        <span>{translations[msg.id]?.translated}</span>
                                                    </div>
                                                )}
                                                {msg.role === 'client' && translations[msg.id]?.translating && !translations[msg.id]?.translated && (
                                                    <span className="text-[10px] text-gray-500 animate-pulse ml-2"><Languages size={10} className="inline mr-1" /> Traduction auto...</span>
                                                )}
                                            </div>
                                            {msg.role === 'agent' && (
                                                <div className="w-8 h-8 rounded-full bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center shrink-0 mt-1 shadow-[0_0_15px_rgba(252,209,22,0.15)]">
                                                    <ShieldCheck size={14} className="text-[#FCD116]" />
                                                </div>
                                            )}
                                        </motion.div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Chat Input */}
                            <div className="p-6 bg-[#0a0f18] border-t border-white/5 z-10 space-y-3">
                                <form onSubmit={sendAdminMessage} className="flex gap-3">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Rédigez votre réponse en direct pour ce client..."
                                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-[#FCD116]/50 transition-all font-medium text-sm"
                                    />
                                    <Button
                                        type="submit"
                                        disabled={!chatInput.trim()}
                                        className="w-14 h-[58px] p-0 rounded-2xl bg-[#008751] hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-xl"
                                    >
                                        <Send size={20} className="text-white ml-0.5" />
                                    </Button>
                                </form>
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Languages size={14} className="text-[#FCD116]" />
                                        Langue détectée (client) : <span className="font-bold text-gray-300">{detectedClientLanguage}</span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleTranslateOutbox}
                                        disabled={!chatInput.trim() || translatingOwn}
                                        className="text-xs text-[#FCD116] hover:text-[#E5BD14] hover:bg-[#FCD116]/10"
                                    >
                                        {translatingOwn ? <Loader2 size={14} className="animate-spin mr-1" /> : <Languages size={14} className="mr-1" />}
                                        Traduire mon texte avant envoi
                                    </Button>
                                </div>
                            </div>                </Card>
                    ) : (
                        <>
                            <Card className="bg-[#0a0f18] border-white/5 rounded-[3rem] shadow-3xl overflow-hidden relative">
                                {/* Dossier Aesthetic Strip */}
                                <div className="absolute top-0 right-0 w-32 h-full bg-white/[0.01] pointer-events-none" />

                                <div className="p-12 space-y-10">
                                    {/* Subject Line */}
                                    <div className="space-y-2">
                                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Sujet de la Liaison</span>
                                        <h2 className="text-3xl font-black text-white font-heading leading-tight italic">
                                            "{record.sujet || (record.type === 'rdv' ? 'Demande de Rendez-vous Stratégique' : 'Interaction Générale')}"
                                        </h2>
                                    </div>

                                    {/* Message Body */}
                                    <div className="relative">
                                        <div className="absolute -left-6 top-0 bottom-0 w-1 bg-benin-gradient opacity-20" />
                                        <div className="bg-white/[0.02] p-8 rounded-3xl border border-white/5 min-h-[300px]">
                                            <p className="text-xl text-gray-300 leading-relaxed font-serif">
                                                {record.message}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Interaction Type Specifics */}
                                    {record.type === 'rdv' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <DataField label="Date Souhaitée" value={record.date_rdv || 'Non spécifiée'} icon={Calendar} color="#3b82f6" />
                                            <DataField label="Durée / Motif" value={record.duree || 'Standard (30min)'} icon={Clock} color="#FCD116" />
                                        </div>
                                    )}

                                    {/* Metadata Footer */}
                                    <div className="pt-10 border-t border-white/5 flex flex-wrap gap-8 items-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 font-mono">
                                        <div className="flex items-center gap-2">
                                            <Globe size={14} /> BJ NODE L-09
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck size={14} /> AES-256 ENCRYPTED
                                        </div>
                                        <div className="ml-auto text-gray-800">
                                            UUID: {record.id}
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* Quick Response Suggestion IA */}
                            <AnimatePresence mode="wait">
                                {!draft ? (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                    >
                                        <Card className="bg-benin-gradient p-[1px] rounded-[2.5rem] shadow-3xl group">
                                            <div className="bg-[#0a0f18] rounded-[2.45rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-[#FCD116]">
                                                        {isDrafting ? <Loader2 size={32} className="animate-spin" /> : <HardDrive size={32} className="animate-pulse" />}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-white font-black font-heading text-lg">Générer une réponse stratégique ?</h4>
                                                        <p className="text-sm text-gray-500 font-medium">L&apos;IA KAGE peut rédiger un brouillon adapté au ton du client.</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    onClick={handleDraftReply}
                                                    disabled={isDrafting}
                                                    className="w-full md:w-auto bg-[#FCD116] text-black font-black uppercase tracking-widest text-[10px] h-12 px-6 rounded-xl hover:bg-white transition-all"
                                                >
                                                    {isDrafting ? "ANALYSE EN COURS..." : "ANALYSER & RÉDIGER"}
                                                </Button>
                                            </div>
                                        </Card>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                    >
                                        <Card className="bg-[#0a0f18] border-2 border-[#008751]/30 rounded-[2.5rem] p-10 shadow-3xl">
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-3 text-[#008751]">
                                                    <Sparkles size={20} />
                                                    <h4 className="font-black font-heading uppercase tracking-widest text-sm text-white">Brouillon Stratégique Généré</h4>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setDraft("")}
                                                    className="text-gray-500 hover:text-white"
                                                >
                                                    Effacer
                                                </Button>
                                            </div>
                                            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 mb-6">
                                                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap italic">
                                                    {draft}
                                                </p>
                                            </div>
                                            <Button
                                                className="w-full bg-[#008751] text-white font-black tracking-widest h-14 rounded-xl"
                                                onClick={() => {
                                                    const body = encodeURIComponent(draft);
                                                    window.location.href = `mailto:${record.email}?subject=RE: ${record.sujet || 'Retour Gagnant'}&body=${body}`;
                                                }}
                                            >
                                                UTILISER CE BROUILLON (MAILTO)
                                            </Button>
                                        </Card>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </>
                    )}
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* RIGHT COLUMN: SENDER INTEL */}
                {/* ═══════════════════════════════════════════ */}
                <div className="lg:col-span-4 space-y-8">
                    {/* User Profile Card */}
                    <Card className="bg-[#0a0f18] border-white/5 rounded-[3rem] p-10 shadow-3xl overflow-hidden relative group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#E8112D]/5 rounded-full blur-[60px] pointer-events-none" />

                        <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                            <div className="w-32 h-32 rounded-[2.5rem] bg-benin-gradient p-1 group-hover:rotate-3 transition-transform duration-700 shadow-2xl">
                                <div className="w-full h-full bg-[#0a0f18] rounded-[2.3rem] flex items-center justify-center">
                                    <User size={64} className="text-gray-700" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-3xl font-black text-white font-heading tracking-tight">{record.nom} {record.prenom}</h3>
                                <div className="flex items-center justify-center gap-2 text-[#008751]">
                                    <CheckCircle2 size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Identité Vérifiée</span>
                                </div>
                            </div>

                            <div className="w-full space-y-4 pt-6">
                                <ContactInfo icon={Mail} value={record.email} label="Email Officiel" />
                                <ContactInfo icon={Phone} value={record.telephone || 'Non renseigné'} label="Canal Téléphonique" />
                                <ContactInfo icon={Calendar} value={new Date(record.created_at).toLocaleDateString()} label="Transmission Initiale" />
                            </div>

                            {/* Status Toggle */}
                            <div className="w-full pt-8">
                                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] mb-4">Statut de la Liaison</label>
                                <div className="flex items-center gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/5">
                                    <button
                                        onClick={() => updateItem({ resource: "messages", id: id as string, values: { lu: false } })}
                                        className={cn(
                                            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                            !record.lu ? "bg-[#E8112D] text-white shadow-lg" : "text-gray-500 hover:text-white"
                                        )}
                                    >
                                        NON LU
                                    </button>
                                    <button
                                        onClick={() => updateItem({ resource: "messages", id: id as string, values: { lu: true } })}
                                        className={cn(
                                            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                            record.lu ? "bg-[#008751] text-white shadow-lg" : "text-gray-500 hover:text-white"
                                        )}
                                    >
                                        TRAITÉ
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Quick Tools */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ToolButton icon={Printer} label="Imprimer Dossier" />
                        <ToolButton icon={Download} label="Export JSON" />
                        <ToolButton icon={Share2} label="Relayer" />
                        <ToolButton icon={AlertCircle} label="Signaler" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function ContactInfo({ icon: Icon, value, label }: { icon: React.ComponentType<{ size?: number; className?: string }>, value: string, label: string }) {
    return (
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all text-left">
            <div>
                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-xs font-bold text-white max-w-[150px] truncate">{value}</p>
            </div>
            <div className="p-2 rounded-lg bg-white/5 text-gray-500 group-hover:text-white">
                <Icon size={16} />
            </div>
        </div>
    );
}

function DataField({ label, value, icon: Icon, color }: { label: string, value: string, icon: React.ComponentType<{ size?: number; className?: string }>, color: string }) {
    return (
        <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl flex items-center gap-5">
            <div className="p-3 rounded-xl bg-white/5" style={{ color }}>
                <Icon size={20} />
            </div>
            <div>
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-sm font-bold text-white">{value}</p>
            </div>
        </div>
    );
}

function ToolButton({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; className?: string }>, label: string }) {
    return (
        <button className="flex flex-col items-center justify-center p-6 bg-[#0a0f18] border border-white/5 rounded-[1.5rem] hover:bg-white/10 transition-all group">
            <Icon size={20} className="text-gray-600 group-hover:text-white transition-colors mb-2" />
            <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest group-hover:text-white">{label}</span>
        </button>
    );
}
