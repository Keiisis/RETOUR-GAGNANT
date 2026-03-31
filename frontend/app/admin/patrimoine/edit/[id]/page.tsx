'use client';

import { useTranslation, T } from '@/lib/translation';
import { useForm, useNavigation, useList } from "@refinedev/core";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Save, MapPin, Image as ImageIcon, Sparkles, Loader2, Plus, Trash2, Grid, Check, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Patrimoine } from "../../page";

export default function PatrimonioEdit() {
    const { t } = useTranslation();
    const { id } = useParams();
    const { list } = useNavigation();

    const { onFinish, query, formLoading } = useForm<Patrimoine>({
        resource: "patrimoine",
        id: id as string,
        redirect: "list",
        action: "edit"
    });

    const { query: galleryQuery } = useList<{ id: string, url?: string, image_url?: string }>({
        resource: "gallery",
        pagination: { pageSize: 100 }
    });

    const galleryData = galleryQuery?.data;
    const record = query?.data?.data;
    const [formData, setFormData] = useState<Partial<Patrimoine>>({
        title: "",
        location: "",
        description: "",
        imagename: "",
        gallery: []
    });

    const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);

    useEffect(() => {
        if (record) {
            setFormData({
                title: record.title || "",
                location: record.location || "",
                description: record.description || "",
                imagename: record.imagename || record.imageName || "",
                gallery: record.gallery || []
            });
        }
    }, [record]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const toggleGalleryImage = (url: string) => {
        const currentGallery = [...(formData.gallery || [])];
        const index = currentGallery.indexOf(url);
        if (index > -1) {
            currentGallery.splice(index, 1);
        } else {
            currentGallery.push(url);
        }
        setFormData((prev) => ({ ...prev, gallery: currentGallery }));
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
                    type: 'patrimoine'
                })
            });
            const data = await resp.json();
            if (data.text) {
                setFormData((prev) => ({ ...prev, description: data.text }));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsOptimizing(false);
        }
    };

    if (formLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="animate-spin text-[#FCD116]" size={40} />
                <p className="text-gray-500 font-mono text-sm"><T>Synchronisation avec l&apos;archive...</T></p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-12 animate-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Navigation Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-[#0a0f18]/40 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => list("patrimoine")}
                        title="Retour au patrimoine"
                        className="p-4 bg-white/5 border border-white/5 rounded-2xl text-gray-400 hover:text-[#FCD116] hover:bg-white/10 transition-all shadow-2xl group"
                    >
                        <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black font-heading text-white tracking-tight"><T>Configuration de l&apos;Archive</T></h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]"><T>Node ID:</T></span>
                            <span className="text-[#FCD116] font-mono text-xs">{id}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <Button
                        onClick={handleSave}
                        disabled={formLoading}
                        className="flex-1 lg:flex-none bg-benin-gradient text-white font-black tracking-[0.2em] gap-3 px-10 h-16 rounded-[1.5rem] shadow-[0_20px_40px_-10px_rgba(252,209,22,0.3)] hover:scale-[1.02] transition-all border-none"
                    >
                        <Save size={20} /> PUBLIER LES MISES À JOUR
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                {/* Form Section */}
                <div className="xl:col-span-8 space-y-8">
                    {/* Basic Info */}
                    <Card className="bg-[#0a0f18] border-white/5 p-10 rounded-[3rem] shadow-3xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-benin-gradient opacity-30" />
                        <form className="space-y-10">
                            <div className="space-y-3">
                                <label className="text-xs font-black text-[#FCD116] uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                                    <Sparkles size={14} /> Désignation Officielle
                                </label>
                                <input
                                    name="title"
                                    value={formData.title || ''}
                                    onChange={handleChange}
                                    placeholder={t("Ex: Palais Royaux d'Abomey")}
                                    className="w-full bg-white/5 border-2 border-white/5 rounded-[1.5rem] py-5 px-8 text-white focus:outline-none focus:border-[#FCD116]/30 transition-all text-2xl font-black font-heading placeholder:text-gray-700"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
                                        <MapPin size={14} className="text-[#008751]" /> Emplacement Stratégique
                                    </label>
                                    <input
                                        name="location"
                                        value={formData.location || ''}
                                        onChange={handleChange}
                                        placeholder={t("Ex: Abomey, Sud Bénin")}
                                        className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-sm font-bold focus:outline-none focus:border-[#008751]/40 transition-all"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
                                        <ImageIcon size={14} className="text-[#3b82f6]" /> Image de Couverture (URL)
                                    </label>
                                    <input
                                        name="imagename"
                                        value={formData.imagename || ''}
                                        onChange={handleChange}
                                        placeholder="image.jpg ou https://..."
                                        className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-xs font-mono focus:outline-none focus:border-[#3b82f6]/40 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1">
                                    Récit Historique & Description Immersive
                                </label>
                                <textarea
                                    name="description"
                                    value={formData.description || ''}
                                    onChange={handleChange}
                                    rows={8}
                                    placeholder={t("Déployez l'histoire captivante de ce lieu...")}
                                    className="w-full bg-white/5 border-2 border-white/5 rounded-[2rem] py-6 px-8 text-white focus:outline-none focus:border-[#FCD116]/20 transition-all resize-none leading-relaxed text-sm font-medium"
                                />
                            </div>
                        </form>
                    </Card>

                    {/* ═══════════════════════════════════════════ */}
                    {/* EDITABLE GALLERY - PHOTO MANAGER */}
                    {/* ═══════════════════════════════════════════ */}
                    <Card className="bg-[#0a0f18] border-white/5 p-10 rounded-[3rem] shadow-3xl overflow-hidden group">
                        <div className="flex justify-between items-center mb-8">
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-white font-heading"><T>Galerie Média</T></h3>
                                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest"><T>Gérez l&apos;immersion visuelle</T></p>
                            </div>
                            <Button
                                onClick={() => setIsGalleryModalOpen(true)}
                                className="bg-white/5 border border-white/10 hover:bg-[#FCD116] hover:text-black rounded-2xl h-12 px-6 text-[10px] font-black uppercase tracking-widest transition-all shadow-xl"
                            >
                                <Plus size={16} className="mr-2" /> AJOUTER DES PHOTOS
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {formData.gallery && formData.gallery.length > 0 ? (
                                formData.gallery.map((url: string, idx: number) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="aspect-square relative rounded-2xl overflow-hidden border border-white/5 group/img shadow-2xl"
                                    >
                                        <Image src={url} alt={`Gallery ${idx}`} fill className="object-cover transition-transform group-hover/img:scale-110" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => toggleGalleryImage(url)}
                                                title="Retirer cette image"
                                                className="p-2 bg-red-500 text-white rounded-lg hover:scale-110 transition-transform"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <div
                                    onClick={() => setIsGalleryModalOpen(true)}
                                    className="col-span-full py-16 border-2 border-dashed border-white/5 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:bg-white/[0.02] hover:border-[#FCD116]/30 transition-all"
                                >
                                    <Grid size={32} className="text-gray-800 mb-4" />
                                    <p className="text-gray-600 font-black uppercase tracking-widest text-[10px]"><T>La galerie est vide.</T></p>
                                    <p className="text-gray-700 text-[8px] mt-2 uppercase"><T>Cliquez pour synchroniser des médias</T></p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Live Preview & Meta */}
                <div className="xl:col-span-4 space-y-8">
                    <div className="sticky top-10 space-y-8">
                        {/* Status Hub */}
                        <Card className="bg-[#0a0f18] border-white/5 p-8 rounded-[2.5rem] shadow-3xl">
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]" />
                                    <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]"><T>Live sur le Portail</T></span>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest"><T>Visibilité</T></span>
                                        <span className="text-[10px] font-black text-[#FCD116] uppercase"><T>Max Immersion</T></span>
                                    </div>
                                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest"><T>Médias Liés</T></span>
                                        <span className="text-[10px] font-black text-white">{formData.gallery?.length || 0} Photos</span>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Real-time Card Preview */}
                        <div className="space-y-4">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1"><T>Rendu Final Temps Réel</T></span>
                            <div className="relative aspect-[3/4] rounded-[3rem] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] border-4 border-white/5 group">
                                <Image
                                    src={formData.imagename ? (formData.imagename.startsWith('http') ? formData.imagename : `/assets/patrimoine/${formData.imagename}`) : '/images/placeholder.jpg'}
                                    alt={t("Preview")}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-1000"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                                <div className="absolute bottom-0 left-0 w-full p-10">
                                    <div className="flex items-center gap-2 mb-3">
                                        <MapPin size={16} className="text-[#FCD116]" />
                                        <span className="text-[#FCD116] text-[10px] font-black uppercase tracking-[0.3em]">{formData.location || "BÉNIN"}</span>
                                    </div>
                                    <h2 className="text-4xl font-black text-white font-heading leading-[0.9] mb-4">{formData.title || "Archive"}</h2>
                                    <div className="h-1.5 w-20 bg-benin-gradient rounded-full" />
                                </div>
                            </div>
                        </div>

                        {/* IA Optimization Trigger */}
                        <motion.button
                            whileHover={{ y: -5 }}
                            onClick={handleOptimize}
                            disabled={isOptimizing}
                            className={cn(
                                "w-full bg-white/5 border border-[#FCD116]/20 py-6 rounded-[2rem] flex items-center justify-center gap-4 group hover:bg-[#FCD116]/10 transition-all",
                                isOptimizing && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <div className="w-10 h-10 rounded-xl bg-benin-gradient flex items-center justify-center text-white shadow-lg">
                                {isOptimizing ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                            </div>
                            <div className="text-left">
                                <h4 className="text-white font-bold text-xs"><T>Optimisation Narrative IA</T></h4>
                                <p className="text-[9px] text-gray-500 font-medium lowercase"><T>Llama 3 • SEO & Storytelling</T></p>
                            </div>
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* GALLERY PICKER MODAL */}
            {/* ═══════════════════════════════════════════ */}
            <AnimatePresence>
                {isGalleryModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-20">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/90 backdrop-blur-3xl"
                            onClick={() => setIsGalleryModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 40 }}
                            className="relative w-full max-w-6xl max-h-[85vh] bg-[#0a0f18] border border-white/10 rounded-[4rem] shadow-3xl overflow-hidden flex flex-col"
                        >
                            <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black text-white font-heading"><T>Archives Média</T></h2>
                                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em]"><T>Sélectionnez les visuels pour cette archive</T></p>
                                </div>
                                <button
                                    onClick={() => setIsGalleryModalOpen(false)}
                                    title="Fermer la galerie"
                                    className="p-4 bg-white/5 rounded-2xl text-gray-500 hover:text-white transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 scrollbar-hide">
                                {galleryData?.data?.map((img) => {
                                    const imageSource = img.url || img.image_url;
                                    const isSelected = formData.gallery?.includes(imageSource || "");
                                    return (
                                        <div
                                            key={img.id}
                                            onClick={() => {
                                                if (imageSource) toggleGalleryImage(imageSource);
                                            }}
                                            className={cn(
                                                "aspect-square relative rounded-[2rem] overflow-hidden cursor-pointer transition-all duration-500 group border-2",
                                                isSelected ? "border-[#FCD116] scale-95 shadow-[0_0_30px_rgba(252,209,22,0.3)]" : "border-transparent group-hover:border-white/20"
                                            )}
                                        >
                                            <Image src={imageSource || ''} alt={t("Gallery")} fill className="object-cover" />
                                            <div className={cn(
                                                "absolute inset-0 transition-all duration-500",
                                                isSelected ? "bg-[#FCD116]/20" : "bg-black/40 group-hover:bg-black/0"
                                            )} />
                                            {isSelected && (
                                                <div className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-[#FCD116] text-black flex items-center justify-center shadow-2xl animate-in zoom-in">
                                                    <Check size={18} />
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="p-10 border-t border-white/5 bg-white/[0.02] flex justify-between items-center">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{formData.gallery?.length || 0} éléments sélectionnés</span>
                                <Button
                                    onClick={() => setIsGalleryModalOpen(false)}
                                    className="bg-white text-black h-14 px-10 rounded-2xl font-black tracking-widest"
                                >
                                    CONFIRMER LA SÉLECTION
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
