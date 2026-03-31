'use client';

import { useTranslation, T } from '@/lib/translation';
import { useForm, useNavigation } from "@refinedev/core";
import { motion } from "framer-motion";
import {
    ArrowLeft, Save, User, Quote, Star,
    MapPin, ShieldCheck, MessageSquareQuote,
    Loader2, Sparkles, Plus, Camera
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Testimonial } from "../page";

export default function TestimonialsCreate() {
    const { t } = useTranslation();
    const { list } = useNavigation();

    const { onFinish, formLoading } = useForm<Testimonial>({
        resource: "testimonials",
        redirect: "list",
        action: "create"
    });

    const [formData, setFormData] = useState<Partial<Testimonial>>({
        name: "",
        location: "",
        text: "",
        rating: 5,
        service: "",
        photo: "",
        approved: true
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        onFinish(formData);
    };

    const [isOptimizing, setIsOptimizing] = useState(false);

    const handleOptimize = async () => {
        if (!formData.text) return;
        setIsOptimizing(true);
        try {
            const resp = await fetch('/api/ai/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: formData.text,
                    type: 'testimonial'
                })
            });
            const data = await resp.json();
            if (data.text) {
                setFormData((prev) => ({ ...prev, text: data.text }));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsOptimizing(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => list("testimonials")}
                        title="Retour aux témoignages"
                        className="p-4 bg-[#0a0f18] border border-white/5 rounded-2xl text-gray-500 hover:text-white hover:border-[#3b82f6]/30 transition-all shadow-2xl group"
                    >
                        <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 text-[#3b82f6] mb-1">
                            <Quote size={14} />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em]"><T>Amplification de Voix</T></span>
                        </div>
                        <h1 className="text-4xl font-black text-white font-heading tracking-tight italic"><T>NOUVEL</T> <span className="text- benin-gradient"><T>AMBASSADEUR</T></span></h1>
                    </div>
                </div>

                <Button
                    onClick={handleSave}
                    disabled={formLoading}
                    className="w-full md:w-auto bg-white text-black h-16 px-10 rounded-[1.5rem] font-black tracking-widest gap-3 shadow-2xl hover:bg-[#FCD116] transition-all"
                >
                    {formLoading ? <Loader2 size={24} className="animate-spin" /> : <Plus size={20} />}
                    PUBLIER L'AVIS
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-7 space-y-8">
                    <Card className="bg-[#0a0f18] border-white/5 p-10 rounded-[3rem] shadow-3xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-[#3b82f6] opacity-30" />

                        <form className="space-y-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1"><T>Identité de l'auteur</T></label>
                                    <input
                                        name="name"
                                        value={formData.name || ''}
                                        onChange={handleChange}
                                        placeholder={t("Ex: Koffi Mensah")}
                                        className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-sm font-bold focus:outline-none focus:border-[#3b82f6]/40 transition-all"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1"><T>Localisation / Diaspora</T></label>
                                    <input
                                        name="location"
                                        value={formData.location || ''}
                                        onChange={handleChange}
                                        placeholder={t("Ex: Paris, France")}
                                        className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-sm font-bold focus:outline-none focus:border-[#3b82f6]/40 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1"><T>Service Concerné</T></label>
                                    <input
                                        name="service"
                                        value={formData.service || ''}
                                        onChange={handleChange}
                                        placeholder={t("Ex: Construction Immobilière")}
                                        className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-sm font-bold focus:outline-none focus:border-[#3b82f6]/40 transition-all"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1"><T>Note de Satisfaction</T></label>
                                    <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border-2 border-white/5">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setFormData((prev) => ({ ...prev, rating: s }))}
                                                title={`Note ${s} étoile${s > 1 ? 's' : ''}`}
                                                className={cn(
                                                    "transition-all transform hover:scale-125",
                                                    (formData.rating ?? 5) >= s ? "text-[#FCD116]" : "text-gray-800"
                                                )}
                                            >
                                                <Star size={24} fill={(formData.rating ?? 5) >= s ? "currentColor" : "none"} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1 flex items-center justify-between">
                                    <span><T>Contenu du Témoignage</T></span>
                                    <button
                                        type="button"
                                        onClick={handleOptimize}
                                        disabled={isOptimizing || !formData.text}
                                        className="text-[#3b82f6] hover:text-white transition-colors flex items-center gap-1 group"
                                    >
                                        {isOptimizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="group-hover:animate-pulse" />}
                                        <span><T>OPTIMISER PAR IA</T></span>
                                    </button>
                                </label>
                                <textarea
                                    name="text"
                                    value={formData.text || ''}
                                    onChange={handleChange}
                                    rows={8}
                                    placeholder={t("Copiez ici le témoignage brut reçu...")}
                                    className="w-full bg-white/5 border-2 border-white/5 rounded-[2rem] py-6 px-8 text-white text-sm font-medium focus:outline-none focus:border-[#3b82f6]/40 transition-all resize-none italic leading-relaxed"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1"><T>URL de la photo (Optionnel)</T></label>
                                <input
                                    name="photo"
                                    value={formData.photo || ''}
                                    onChange={handleChange}
                                    placeholder="https://..."
                                    className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-xs font-mono focus:outline-none"
                                />
                            </div>
                        </form>
                    </Card>
                </div>

                <div className="lg:col-span-5 space-y-8">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1"><T>Aperçu de l'Impact</T></span>
                    <Card className="bg-[#0a0f18] border-white/5 rounded-[2.5rem] p-10 shadow-3xl relative overflow-hidden group border-2 border-white/5">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#3b82f6]/10 rounded-full blur-[60px] pointer-events-none" />

                        <div className="relative space-y-6">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-benin-gradient p-1 shadow-2xl">
                                        <div className="w-full h-full bg-[#0a0f18] rounded-[1.2rem] flex items-center justify-center overflow-hidden">
                                            {formData.photo ? <Image src={formData.photo} alt={t("Avatar")} fill className="object-cover" /> : <User size={24} className="text-gray-800" />}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-white font-black text-xl leading-none">{formData.name || 'Prénom Nom'}</h4>
                                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-2">{formData.location || 'Localisation'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="relative">
                                <Quote size={40} className="absolute -top-4 -left-4 text-white/5" />
                                <p className="text-gray-400 text-sm leading-relaxed font-medium italic relative">
                                    "{formData.text || 'Entrez un témoignage...'}"
                                </p>
                            </div>
                            <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest bg-white/5 px-4 py-1.5 rounded-full">
                                    {formData.service || 'Service Global'}
                                </span>
                                <div className="flex gap-1">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} size={12} className={i < (formData.rating ?? 5) ? "fill-[#FCD116] text-[#FCD116]" : "text-gray-800"} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
