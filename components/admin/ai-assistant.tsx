"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Send, Loader2, Bot, BrainCircuit, Terminal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const AIAssistant = () => {
    const [prompt, setPrompt] = useState("");
    const [response, setResponse] = useState("");
    const [loading, setLoading] = useState(false);

    const handleAskAI = async () => {
        if (!prompt) return;
        setLoading(true);
        try {
            const res = await fetch("/api/ai/admin-help", {
                method: "POST",
                body: JSON.stringify({ prompt }),
            });
            const data = await res.json();
            setResponse(data.text);
        } catch (error) {
            setResponse("ALERTE : Interruption de la liaison neuronale. Vérifiez votre connectivité.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="bg-[#0a0f18]/80 backdrop-blur-2xl border-white/5 shadow-2xl overflow-hidden rounded-[2.5rem] border-t border-white/10 group">
            <div className="absolute inset-0 bg-benin-gradient opacity-5 pointer-events-none" />

            <CardContent className="p-0">
                <div className="flex flex-col md:flex-row h-full min-h-[160px]">
                    {/* IA Persona Sidebar */}
                    <div className="w-full md:w-64 bg-black/40 p-8 border-b md:border-b-0 md:border-r border-white/5 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-3xl bg-benin-gradient p-0.5 animate-shimmer shadow-[0_0_30px_rgba(252,209,22,0.2)]">
                                <div className="w-full h-full bg-[#0a0f18] rounded-[22px] flex items-center justify-center">
                                    <BrainCircuit size={36} className="text-[#FCD116]" />
                                </div>
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-4 border-[#0a0f18] rounded-full animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-sm tracking-tight">KAGE COGNITIVE</h3>
                            <p className="text-[10px] text-[#FCD116] font-black uppercase tracking-[0.2em]">Neural Node v3.3</p>
                        </div>
                    </div>

                    {/* Chat Interaction */}
                    <div className="flex-1 p-8 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-6">
                            <Terminal size={14} className="text-gray-500" />
                            <span className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]">Module d'assistance stratégique</span>
                        </div>

                        <div className="flex gap-4 items-center">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Demander une action stratégique ou rédactionnelle..."
                                    className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-all placeholder:text-gray-600 font-medium"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <span className="text-[10px] text-gray-600 font-mono hidden sm:block">RETURN to execute</span>
                                </div>
                            </div>
                            <Button
                                onClick={handleAskAI}
                                disabled={loading || !prompt}
                                className="h-14 w-14 rounded-2xl bg-[#FCD116] hover:bg-white text-black transition-all shadow-lg hover:shadow-[#FCD116]/20 group/btn"
                            >
                                {loading ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />}
                            </Button>
                        </div>

                        <AnimatePresence>
                            {response && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-8 p-6 rounded-2xl bg-[#FCD116]/5 border border-[#FCD116]/20 relative group/response">
                                        <Sparkles className="absolute top-4 right-4 text-[#FCD116]/20 group-hover/response:text-[#FCD116]/40 transition-colors" size={20} />
                                        <p className="text-sm text-gray-300 leading-relaxed font-medium">
                                            <span className="text-[#FCD116] font-black mr-2">COG:</span>
                                            {response}
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
