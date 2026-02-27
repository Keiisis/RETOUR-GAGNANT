'use client';

import { useForm, useNavigation } from "@refinedev/core";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Save, ShieldCheck, Zap,
    Layers, Sparkles, Loader2, Info,
    LayoutGrid, ChevronRight, Palette,
    Type, AlignLeft, CheckCircle2, Star,
    Briefcase
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";

export default function ServicesEdit() {
    const { id } = useParams();
    const { list } = useNavigation();

    const { onFinish, query, formLoading } = useForm<any>({
        resource: "services",
        id: id as string,
        redirect: "list",
        action: "edit"
    });

    const record = query?.data?.data;
    const [formData, setFormData] = useState<any>({
        title: "",
        description: "",
        icon: "ShieldCheck",
        image_url: "",
        color: "#008751",
        order: 0
    });

    useEffect(() => {
        if (record) {
            setFormData({
                title: record.title || "",
                description: record.description || "",
                icon: record.icon || "ShieldCheck",
                image_url: record.image_url || "",
                color: record.color || "#008751",
                order: record.order || 0
            });
        }
    }, [record]);

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

    if (formLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-60">
                <div className="w-20 h-20 border-t-2 border-[#008751] border-b-2 border-white/10 rounded-full animate-spin" />
                <p className="mt-8 text-[10px] text-gray-600 font-black uppercase tracking-[0.6em] animate-pulse">Initialisation du Laboratoire...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in zoom-in-95 duration-1000 pb-20">
            {/* ═══════════════════════════════════════════ */}
            {/* ENGINEERING HEADER */}
            {/* ═══════════════════════════════════════════ */}
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
                            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Module d'Architecture v2.0</span>
                        </div>
                        <h1 className="text-4xl font-black text-white font-heading tracking-tight leading-none uppercase">
                            CONFIGURATION <span className="text- benin-gradient">SOLUTION</span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full xl:w-auto">
                    <Button
                        onClick={handleSave}
                        disabled={formLoading}
                        className="flex-1 xl:flex-none h-16 px-12 rounded-[1.5rem] bg-[#008751] text-white font-black tracking-[0.2em] gap-3 shadow-[0_20px_40px_-5px_rgba(0,135,81,0.3)] hover:scale-[1.02] transition-all border-none"
                    >
                        <Save size={20} /> DEPLOYER LA VERSION
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                {/* ═══════════════════════════════════════════ */}
                {/* CORE SPECS FORM */}
                {/* ═══════════════════════════════════════════ */}
                <div className="xl:col-span-8 space-y-10">
                    <Card className="bg-[#0a0f18] border-white/5 p-12 rounded-[3.5rem] shadow-3xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#008751]/5 rounded-full blur-[100px] pointer-events-none" />

                        <form className="space-y-12 relative z-10">
                            {/* Service Identity */}
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

                            {/* visual specs */}
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
                                        <input
                                            type="color"
                                            value={formData.color}
                                            onChange={(e) => setFormData((prev: any) => ({ ...prev, color: e.target.value }))}
                                            className="w-10 h-10 bg-transparent border-none cursor-pointer"
                                        />
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
                                        className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-xl font-black focus:outline-none focus:border-white/20 transition-all"
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

                            {/* Detailed description */}
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

                    {/* Service Utilities */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Card className="bg-benin-gradient/10 border-[#008751]/20 p-8 rounded-[2.5rem] flex items-start gap-6">
                            <div className="p-4 bg-[#008751]/20 rounded-2xl text-[#008751] shadow-xl">
                                <Sparkles size={28} />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm mb-2 uppercase tracking-widest">Optimisation IA</h4>
                                <p className="text-[11px] text-gray-500 leading-relaxed">Laissez KAGE IA affiner la description pour maximiser l'intérêt de la diaspora.</p>
                                <Button
                                    onClick={handleOptimize}
                                    disabled={isOptimizing || !formData.description}
                                    variant="link"
                                    className="text-[#008751] p-0 h-auto text-[10px] font-black uppercase tracking-widest mt-4 gap-2"
                                >
                                    {isOptimizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                    Lancer l'Analyse
                                </Button>
                            </div>
                        </Card>

                        <Card className="bg-white/[0.02] border-white/5 p-8 rounded-[2.5rem] flex items-start gap-6">
                            <div className="p-4 bg-white/5 rounded-2xl text-gray-500">
                                <ShieldCheck size={28} />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm mb-2 uppercase tracking-widest">Contrôle Qualité</h4>
                                <p className="text-[11px] text-gray-500 leading-relaxed">Vérifiez que tous les modules connexes (RDV, Contact) sont correctement liés.</p>
                                <Button variant="link" className="text-gray-400 p-0 h-auto text-[10px] font-black uppercase tracking-widest mt-4">Vérifier les Liaisons</Button>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* LIVE LAB RENDERING */}
                {/* ═══════════════════════════════════════════ */}
                <div className="xl:col-span-4 space-y-10">
                    <div className="sticky top-10 space-y-10">
                        <div className="space-y-4">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em] ml-2">Apparence en Production</span>

                            {/* Service Card Preview - Matching ServicesGrid style */}
                            <Card className="group relative bg-[#0a0f18] border-white/5 rounded-[3.5rem] p-12 overflow-hidden hover:border-[#008751]/50 transition-all duration-700 shadow-3xl h-[600px] flex flex-col justify-between">
                                <div className="absolute -top-20 -right-20 w-64 h-64 opacity-5 group-hover:opacity-10 transition-opacity" style={{ backgroundColor: formData.color, borderRadius: '50%', filter: 'blur(100px)' }} />

                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-12">
                                        <div className="w-24 h-24 rounded-[2.5rem] bg-benin-gradient p-[1px] shadow-2xl group-hover:rotate-6 transition-transform duration-500">
                                            <div className="w-full h-full bg-[#0a0f18] rounded-[2.5rem] flex items-center justify-center">
                                                {formData.image_url ? (
                                                    <img src={formData.image_url} alt="" className="w-20 h-20 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.15)]" />
                                                ) : (
                                                    <ShieldCheck size={40} style={{ color: formData.color || '#008751' }} />
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Star size={16} fill="#FCD116" className="text-[#FCD116]" />
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Premium</span>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: formData.color || '#008751' }} />
                                            <span className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: formData.color || '#008751' }}>Actif</span>
                                        </div>
                                        <h3 className="text-4xl font-black text-white font-heading tracking-tight leading-none group-hover:text-[#FCD116] transition-colors">
                                            {formData.title || 'Nouvelle Solution'}
                                        </h3>
                                        <p className="text-gray-400 text-base leading-relaxed font-medium line-clamp-6 group-hover:text-gray-200 transition-colors italic">
                                            {formData.description || 'Commencez à rédiger pour voir l\'aperçu ici...'}
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-10">
                                    <button className="h-16 w-full bg-white/[0.03] border border-white/5 rounded-3xl flex items-center justify-center gap-4 text-xs font-black text-white uppercase tracking-[0.3em] group/btn transition-all hover:bg-white hover:text-black">
                                        Explorer
                                        <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </Card>
                        </div>

                        {/* Node Metadata Card */}
                        <Card className="bg-[#0a0f18] border-white/5 p-8 rounded-[2.5rem] shadow-3xl">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                    <Briefcase size={12} /> Module ID: {id}
                                </h4>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">Statut Réseau</span>
                                    <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-[8px] font-black uppercase tracking-widest border border-green-500/20">Optimal</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
