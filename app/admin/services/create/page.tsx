'use client';

import { useForm, useNavigation } from "@refinedev/core";
import { motion } from "framer-motion";
import {
    ArrowLeft, Save, ShieldCheck, Zap,
    Layers, Sparkles, Loader2, Info,
    LayoutGrid, ChevronRight, Palette,
    Type, AlignLeft, Briefcase, Plus
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ServicesCreate() {
    const { list } = useNavigation();

    const { onFinish, formLoading } = useForm<any>({
        resource: "services",
        redirect: "list",
        action: "create"
    });

    const [formData, setFormData] = useState<any>({
        title: "",
        description: "",
        icon: "ShieldCheck",
        image_url: "",
        color: "#008751",
        order: 0
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        onFinish(formData);
    };

    const [isOptimizing, setIsOptimizing] = useState(false);

    const handleOptimize = async () => {
        if (!formData.description) return;
        setIsOptimizing(true);
        try {
            const resp = await fetch('/api/ai/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: formData.description,
                    type: 'service'
                })
            });
            const data = await resp.json();
            if (data.text) {
                setFormData((prev: any) => ({ ...prev, description: data.text }));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsOptimizing(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in zoom-in-95 duration-1000 pb-20">
            {/* ENGINEERING HEADER */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-10 bg-[#0a0f18]/40 p-8 rounded-[3rem] border border-white/5 backdrop-blur-3xl shadow-3xl">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => list("services")}
                        className="p-5 bg-white/5 border border-white/10 rounded-[1.5rem] text-gray-500 hover:text-[#008751] hover:bg-white/10 transition-all shadow-2xl group"
                    >
                        <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 text-[#008751] mb-1">
                            <Layers size={14} />
                            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Laboratoire R&D v2.0</span>
                        </div>
                        <h1 className="text-4xl font-black text-white font-heading tracking-tight leading-none uppercase">
                            NOUVELLE <span className="text- benin-gradient">SOLUTION</span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full xl:w-auto">
                    <Button
                        onClick={handleSave}
                        disabled={formLoading}
                        className="flex-1 xl:flex-none h-16 px-12 rounded-[1.5rem] bg-[#008751] text-white font-black tracking-[0.2em] gap-3 shadow-[0_20px_40px_-5px_rgba(0,135,81,0.3)] hover:scale-[1.02] transition-all border-none"
                    >
                        {formLoading ? <Loader2 size={24} className="animate-spin" /> : <Plus size={20} />}
                        DÉPLOYER LA SOLUTION
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                <div className="xl:col-span-8 space-y-10">
                    <Card className="bg-[#0a0f18] border-white/5 p-12 rounded-[3.5rem] shadow-3xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#008751]/5 rounded-full blur-[100px] pointer-events-none" />

                        <form className="space-y-12 relative z-10">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-[#008751] uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
                                    <Type size={14} /> Titre de la Solution
                                </label>
                                <input
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    placeholder="Ex: Accompagnement Immobilier"
                                    className="w-full bg-white/5 border-2 border-white/5 rounded-[1.5rem] py-6 px-8 text-white text-3xl font-black font-heading focus:outline-none focus:border-[#008751]/40 transition-all placeholder:text-gray-800"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
                                        <Palette size={14} /> Accent Chromatique
                                    </label>
                                    <div className="flex items-center gap-4 p-4 bg-white/5 border-2 border-white/5 rounded-2xl">
                                        {["#008751", "#FCD116", "#E8112D", "#3b82f6", "#8b5cf6"].map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setFormData((prev: any) => ({ ...prev, color: c }))}
                                                className={cn(
                                                    "w-10 h-10 rounded-xl transition-all border-2",
                                                    formData.color === c ? "border-white scale-110 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"
                                                )}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
                                        <LayoutGrid size={14} /> Priorité Module
                                    </label>
                                    <input
                                        type="number"
                                        name="order"
                                        value={formData.order}
                                        onChange={handleChange}
                                        className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-xl font-black focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
                                    <LayoutGrid size={14} /> Image URL (Icone personnalisée)
                                </label>
                                <input
                                    type="text"
                                    name="image_url"
                                    value={formData.image_url}
                                    onChange={handleChange}
                                    placeholder="/assets/icones/icone-example.png"
                                    className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-base focus:outline-none focus:border-white/20 transition-all placeholder:text-gray-800"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
                                    <AlignLeft size={14} /> Définition Stratégique
                                </label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows={10}
                                    placeholder="Décrivez en détail la portée et les bénéfices de ce service..."
                                    className="w-full bg-white/5 border-2 border-white/5 rounded-[2.5rem] py-8 px-10 text-gray-300 text-lg font-medium focus:outline-none focus:border-[#008751]/30 transition-all resize-none leading-relaxed italic"
                                />
                            </div>
                        </form>
                    </Card>
                </div>

                <div className="xl:col-span-4 space-y-10">
                    <div className="sticky top-10 space-y-10">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em] ml-2">Aperçu en Direct</span>
                        <Card className="group relative bg-[#0a0f18] border-white/5 rounded-[3.5rem] p-12 overflow-hidden shadow-3xl h-[600px] flex flex-col justify-between">
                            <div className="absolute -top-20 -right-20 w-64 h-64 opacity-10 blur-[100px]" style={{ backgroundColor: formData.color }} />
                            <div className="relative z-10">
                                <div className="w-24 h-24 rounded-[2.5rem] bg-benin-gradient p-[1px] mb-12 shadow-2xl">
                                    <div className="w-full h-full bg-[#0a0f18] rounded-[2.5rem] flex items-center justify-center">
                                        {formData.image_url ? (
                                            <img src={formData.image_url} alt="" className="w-20 h-20 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.15)]" />
                                        ) : (
                                            <ShieldCheck size={40} style={{ color: formData.color }} />
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <h3 className="text-4xl font-black text-white font-heading leading-none">
                                        {formData.title || 'Nouvelle Solution'}
                                    </h3>
                                    <p className="text-gray-400 text-base leading-relaxed font-medium line-clamp-6 italic">
                                        {formData.description || 'La description apparaîtra ici...'}
                                    </p>
                                </div>
                            </div>
                            <div className="pt-10">
                                <div className="h-16 w-full bg-white/[0.03] border border-white/5 rounded-3xl flex items-center justify-center text-xs font-black text-white uppercase tracking-[0.3em]">
                                    Module Beta v0.1
                                </div>
                            </div>
                        </Card>

                        <Card className="bg-[#0a0f18] border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FCD116]/5 rounded-full blur-[40px] pointer-events-none" />
                            <h4 className="text-[#008751] font-black text-xs uppercase tracking-widest mb-4">Specs Ingénierie / IA</h4>
                            <div className="space-y-2 text-[10px] text-gray-500 font-bold uppercase leading-relaxed mb-8">
                                <p>• Code: SRV-{Math.floor(Math.random() * 1000)}</p>
                                <p>• Status: En conception</p>
                            </div>

                            <motion.button
                                whileHover={{ y: -5 }}
                                onClick={handleOptimize}
                                disabled={isOptimizing}
                                className={cn(
                                    "w-full bg-[#008751]/10 border border-[#008751]/20 py-4 rounded-2xl flex items-center justify-center gap-3 group hover:bg-[#008751]/20 transition-all",
                                    isOptimizing && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {isOptimizing ? <Loader2 size={16} className="animate-spin text-[#008751]" /> : <Sparkles size={16} className="text-[#008751]" />}
                                <span className="text-white font-bold text-[10px] uppercase tracking-widest">Optimiser par IA</span>
                            </motion.button>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
