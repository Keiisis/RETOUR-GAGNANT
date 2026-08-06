'use client';

import { useTranslation, T } from '@/lib/translation';
import { useForm, useNavigation, useOne } from "@refinedev/core";
import { ArrowLeft, FloppyDisk as Save, Image as ImageIcon, CloudArrowUp as CloudUpload, CircleNotch as Loader2, Tag, TextT as Type } from '@phosphor-icons/react';
import Image from "next/image";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { GalleryItem } from "../../page";

export default function GalleryEdit() {
    const { t } = useTranslation();
    const params = useParams();
    const id = params.id as string;
    const { list } = useNavigation();

    const galleryQuery = useOne<GalleryItem>({
        resource: "gallery",
        id,
    });
    const galleryInternal = galleryQuery as unknown as Record<string, unknown>
    const isFetching = (galleryInternal.query as Record<string, boolean> | undefined)?.isLoading ?? false
    const itemData = galleryQuery.result ?? (galleryInternal.data as { data?: GalleryItem } | undefined)?.data;

    const { onFinish, formLoading } = useForm<GalleryItem>({
        resource: "gallery",
        action: "edit",
        id,
        redirect: "list",
    });

    const [formData, setFormData] = useState<Partial<GalleryItem> & { alt?: string }>({
        url: "",
        title: "",
        category: "general",
        alt: ""
    });

    useEffect(() => {
        if (itemData) {
            setFormData({
                url: itemData.url || itemData.image || itemData.image_url || "",
                title: itemData.title || "",
                category: itemData.category || itemData.type || "general",
                alt: itemData.title || ""
            });
        }
    }, [itemData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev: Partial<GalleryItem> & { alt?: string }) => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        onFinish({
            url: formData.url,
            title: formData.title,
            category: formData.category,
            type: formData.category, // Handle both category and type fields to be safe
            alt: formData.title // Just use the title as alt if not set
        });
    };

    if (isFetching) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-[#FCD116] mb-4" size={40} />
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]"><T>Chargement de l&apos;image...</T></p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-[#0a0f18]/40 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => list("gallery")}
                        title="Retour à la galerie"
                        className="p-4 bg-white/5 border border-white/5 rounded-2xl text-gray-500 hover:text-[#FCD116] transition-all"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black font-heading text-white tracking-tight italic"><T>ÉDITER L&apos;</T><span className="text- benin-gradient"><T>ACTE VISUEL</T></span></h1>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em] mt-1"><T>Imagerie &amp; Esthétique Diaspora</T></p>
                    </div>
                </div>

                <Button
                    onClick={handleSave}
                    disabled={formLoading}
                    className="w-full md:w-auto bg-benin-gradient text-white h-16 px-10 rounded-[1.5rem] font-black tracking-widest gap-3 shadow-2xl"
                >
                    {formLoading ? <Loader2 size={24} className="animate-spin" /> : <Save size={20} />}
                    METTRE A JOUR
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Form Section */}
                <div className="space-y-8">
                    <Card className="bg-[#0a0f18] border-white/5 p-10 rounded-[3rem] shadow-3xl">
                        <form className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
                                    <CloudUpload size={14} className="text-[#3b82f6]" /> URL de l&apos;Image
                                </label>
                                <input
                                    name="url"
                                    value={formData.url || ''}
                                    onChange={handleChange}
                                    placeholder="https://..."
                                    className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-xs font-mono focus:outline-none focus:border-[#3b82f6]/40 transition-all"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
                                    <Type size={14} /> Titre de l&apos;image
                                </label>
                                <input
                                    name="title"
                                    value={formData.title || ''}
                                    onChange={handleChange}
                                    placeholder={t("Ex: Villa Cotonou 2024")}
                                    className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-sm font-bold focus:outline-none"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
                                    <Tag size={14} /> Catégorie Nexus
                                </label>
                                <select
                                    name="category"
                                    title="Sélectionner une catégorie"
                                    value={formData.category}
                                    onChange={handleChange}
                                    className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-sm font-bold focus:outline-none appearance-none"
                                >
                                    <option value="general"><T>Général</T></option>
                                    <option value="heritage"><T>Patrimoine</T></option>
                                    <option value="construction"><T>Chantiers</T></option>
                                    <option value="tourisme"><T>Tourisme</T></option>
                                    <option value="hero"><T>Bannière</T></option>
                                    <option value="gallery"><T>Galerie Normale</T></option>
                                </select>
                            </div>
                        </form>
                    </Card>
                </div>

                {/* Preview Section */}
                <div className="space-y-8">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] ml-1"><T>Développement Visuel</T></span>
                    <div className="aspect-square relative rounded-[3.5rem] overflow-hidden border-4 border-white/5 shadow-3xl bg-white/[0.02] flex flex-col items-center justify-center p-10">
                        {formData.url ? (
                            <>
                                <Image src={formData.url} alt={t("Preview")} fill className="object-cover animate-in fade-in duration-1000" />
                                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-12 text-center text-white">
                                    <h3 className="text-2xl font-black font-heading mb-2">{formData.title || 'Sans Titre'}</h3>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#FCD116]">{formData.category}</span>
                                </div>
                            </>
                        ) : (
                            <div className="text-center space-y-4">
                                <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mx-auto mb-6">
                                    <ImageIcon size={40} className="text-gray-800" />
                                </div>
                                <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest"><T>En attente de liaison...</T></p>
                                <p className="text-[8px] text-gray-800 uppercase"><T>L&apos;aperçu se générera automatiquement</T></p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
