'use client';

import { useTranslation, T } from '@/lib/translation';
import { useList, useUpdate, useCreate } from "@refinedev/core";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, FloppyDisk as Save, MonitorPlay, FilmStrip as Film, TextT as Type, CircleNotch as Loader2, CheckCircle as CheckCircle2, WarningCircle as AlertCircle, Link as LinkIcon, Plus, Trash as Trash2, Palette, GridFour as LayoutGrid, Info } from '@phosphor-icons/react';
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SettingItem {
    id: string;
    key: string;
    value: string;
    description?: string;
}

export default function FrontendSettingsPage() {
    const { t } = useTranslation();
    const queryResult = useList<SettingItem>({
        resource: "settings",
        pagination: { mode: "off" }
    });

    const settingsData = queryResult.query?.data;
    const isLoading = queryResult.query?.isLoading;

    const { mutate: updateSetting } = useUpdate();
    const { mutate: createSetting } = useCreate();
    const [isSaving, setIsSaving] = useState(false);

    const [form, setForm] = useState({
        frontend_hero_video: "",
        frontend_hero_audio: "",
        frontend_hero_title: "",
        frontend_hero_subtitle: "",
        frontend_colors_primary: "#008751",
        passeport_show_calculator: "false",
        services_show_calculator: "true",
        autres_services_json: "",
        about_us_title: "",
        about_us_video: "",
        about_us_text: "",
    });

    // Navbar links managed separately as an array
    const [navbarLinks, setNavbarLinks] = useState<{ label: string, href: string }[]>([]);

    // Mapping of key values in DB to their IDs internally so we can update them
    const [settingIds, setSettingIds] = useState<Record<string, string>>({});

    useEffect(() => {
        if (settingsData?.data) {
            const newForm = { ...form };
            const newIds: Record<string, string> = {};
            let loadedLinks: { label: string, href: string }[] = [];

            settingsData.data.forEach((item) => {
                if (item.key in newForm) {
                    (newForm as Record<string, string>)[item.key] = item.value || "";
                    newIds[item.key] = item.id;
                }

                if (item.key === 'frontend_navbar_json') {
                    newIds[item.key] = item.id;
                    try {
                        loadedLinks = JSON.parse(item.value);
                    } catch (e) { }
                }
            });

            setForm(newForm);
            setSettingIds(newIds);
            if (loadedLinks.length > 0) setNavbarLinks(loadedLinks);
        }
    }, [settingsData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleLinkChange = (index: number, field: 'label' | 'href', value: string) => {
        const newLinks = [...navbarLinks];
        newLinks[index][field] = value;
        setNavbarLinks(newLinks);
    };

    const addLink = () => {
        setNavbarLinks([...navbarLinks, { label: "Nouveau Lien", href: "/" }]);
    };

    const removeLink = (index: number) => {
        const newLinks = [...navbarLinks];
        newLinks.splice(index, 1);
        setNavbarLinks(newLinks);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Text & media updates
            const updates = Object.entries(form).map(([key, value]) => {
                const id = settingIds[key];
                if (id) {
                    return new Promise((resolve) => {
                        updateSetting({
                            resource: "settings",
                            id,
                            values: { value }
                        }, { onSuccess: resolve, onError: resolve });
                    });
                }
                // Clé absente en base → on la crée (ex. nouveau réglage déployé)
                return new Promise((resolve) => {
                    createSetting({
                        resource: "settings",
                        values: { key, value, category: "frontend" }
                    }, { onSuccess: resolve, onError: resolve });
                });
            });

            // Navbar links update
            const navId = settingIds['frontend_navbar_json'];
            if (navId) {
                updates.push(new Promise((resolve) => {
                    updateSetting({
                        resource: "settings",
                        id: navId,
                        values: { value: JSON.stringify(navbarLinks) }
                    }, { onSuccess: resolve, onError: resolve });
                }));
            }

            await Promise.all(updates);
            alert("Paramètres publics sauvegardés avec succès !");
        } catch (error) {
            console.error("Save error", error);
            alert("Erreçur lors de la sauvegarde.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-purple-500 mb-4" size={40} />
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]"><T>Chargement de l&apos;interface visuelle...</T></p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-[#0a0f18]/40 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
                <div className="flex items-center gap-6">
                    <Link href="/admin/settings" className="p-4 bg-white/5 border border-white/5 rounded-2xl text-gray-500 hover:text-purple-500 transition-all">
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black font-heading text-white tracking-tight italic"><span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500"><T>VITRINE</T></span> <T>PUBLIQUE</T></h1>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em] mt-1"><T>Personnalisation du FrontEnd</T></p>
                    </div>
                </div>

                <div className="flex gap-4 w-full md:w-auto">
                    <Button onClick={handleSave} disabled={isSaving} className="w-full md:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white h-16 px-8 rounded-[1.5rem] font-black tracking-widest gap-2 shadow-[0_0_30px_rgba(168,85,247,0.3)] transition-all">
                        {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                        PUBLIER LES CHANGEMENTS
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

                {/* Textes & Identité */}
                <Card className="bg-[#0a0f18] border-white/5 overflow-hidden rounded-[3rem] shadow-2xl relative">
                    <div className="p-10 space-y-8 relative z-10">
                        <div className="flex items-center gap-4 border-b border-white/5 pb-8 mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                                <Type size={24} className="text-purple-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white"><T>Identité Visuelle</T></h3>
                                <p className="text-xs text-gray-500"><T>Textes d&apos;accroche et couleurs</T></p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1"><T>Grand Titre (Hero)</T></label>
                                <input
                                    name="frontend_hero_title"
                                    value={form.frontend_hero_title}
                                    onChange={handleChange}
                                    placeholder={t("VOTRE VISION, NOTRE MISSION")}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-purple-500/50 transition-all font-bold text-sm"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1"><T>Sous-Titre Descriptif</T></label>
                                <textarea
                                    name="frontend_hero_subtitle"
                                    value={form.frontend_hero_subtitle}
                                    onChange={handleChange}
                                    rows={4}
                                    placeholder={t("Bâtissons l&apos;avenir...")}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-purple-500/50 transition-all font-medium text-sm"
                                />
                            </div>

                            <div className="space-y-3 pb-4">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <Palette size={14} /> Couleur Primaire
                                </label>
                                <div className="flex gap-4 items-center">
                                    <input
                                        type="color"
                                        name="frontend_colors_primary"
                                        value={form.frontend_colors_primary}
                                        onChange={handleChange}
                                        className="w-14 h-14 rounded-2xl cursor-pointer bg-transparent border-none outline-none overflow-hidden"
                                    />
                                    <input
                                        name="frontend_colors_primary"
                                        value={form.frontend_colors_primary}
                                        onChange={handleChange}
                                        className="bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none font-mono text-sm w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Immersion Multimédia */}
                <Card className="bg-[#0a0f18] border-white/5 overflow-hidden rounded-[3rem] shadow-2xl relative">
                    <div className="p-10 space-y-8 relative z-10">
                        <div className="flex items-center gap-4 border-b border-white/5 pb-8 mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <Film size={24} className="text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white"><T>Création d&apos;Ambiance</T></h3>
                                <p className="text-xs text-gray-500"><T>Multimédia d&apos;arrière-plan interactif</T></p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1"><T>URL Vidéo d&apos;Arrière-plan (MP4 ou lien web)</T></label>
                                <input
                                    name="frontend_hero_video"
                                    value={form.frontend_hero_video}
                                    onChange={handleChange}
                                    placeholder={t("/videos/hero-bg.mp4")}
                                    className="w-full bg-[#131b2c] border border-blue-500/30 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-blue-500 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-all font-mono text-sm"
                                />
                                <p className="text-[10px] text-gray-500 font-bold ml-1">Utilisez un lien absolu (https://...) ou un fichier placé dans /public</p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1"><T>URL Musique d&apos;Ambiance (MP3)</T></label>
                                <input
                                    name="frontend_hero_audio"
                                    value={form.frontend_hero_audio}
                                    onChange={handleChange}
                                    placeholder={t("/audio/ambient.mp3")}
                                    className="w-full bg-[#131b2c] border border-blue-500/30 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-blue-500 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-all font-mono text-sm"
                                />
                                <p className="text-[10px] text-gray-500 font-bold ml-1"><T>Le son s&apos;activera au clic ou à l&apos;interaction de l&apos;utilisateur.</T></p>
                            </div>

                            {form.frontend_hero_video && (
                                <div className="mt-6 aspect-video rounded-3xl overflow-hidden border border-white/10 relative group">
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="text-white font-black tracking-widest text-xs py-2 px-4 bg-black/50 backdrop-blur-md rounded-xl"><T>APERÇU VIDÉO</T></div>
                                    </div>
                                    <video src={form.frontend_hero_video} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Qui Sommes-Nous */}
                <Card className="bg-[#0a0f18] border-white/5 overflow-hidden rounded-[3rem] shadow-2xl relative lg:col-span-2">
                    <div className="p-10 space-y-8 relative z-10">
                        <div className="flex items-center gap-4 border-b border-white/5 pb-8 mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                <Info size={24} className="text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white"><T>Section : Qui Sommes-Nous</T></h3>
                                <p className="text-xs text-gray-500"><T>La section décrivant la mission et les objectifs (présentée avec vidéo)</T></p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1"><T>Titre de la section</T></label>
                                    <input
                                        name="about_us_title"
                                        value={form.about_us_title}
                                        onChange={handleChange}
                                        placeholder={t("L'Excellence au Service de vos Racines")}
                                        className="w-full bg-[#131b2c] border border-amber-500/30 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-amber-500 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-all font-bold text-sm"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1"><T>URL Vidéo Centrale (Ex: Logo Animé MP4)</T></label>
                                    <input
                                        name="about_us_video"
                                        value={form.about_us_video}
                                        onChange={handleChange}
                                        placeholder={t("/videos/logo animé.mp4")}
                                        className="w-full bg-[#131b2c] border border-amber-500/30 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-amber-500 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-all font-mono text-sm"
                                    />
                                    <p className="text-[10px] text-gray-500 font-bold ml-1"><T>La vidéo joue en boucle (autoplay, muted).</T></p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1"><T>Copywriting Expert (L&apos;histoire)</T></label>
                                <textarea
                                    name="about_us_text"
                                    value={form.about_us_text}
                                    onChange={handleChange}
                                    rows={10}
                                    placeholder={t("Depuis la création...")}
                                    className="w-full bg-[#131b2c] border border-amber-500/30 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-amber-500 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-all font-medium text-sm leading-relaxed"
                                />
                                <p className="text-[10px] text-gray-500 font-bold ml-1"><T>Séparez vos paragraphes par un saut de ligne. Affichage de prestige automatique.</T></p>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Services : Toggle calculateur + JSON autres services */}
                <Card className="bg-[#0a0f18] border-white/5 overflow-hidden rounded-[3rem] shadow-2xl relative lg:col-span-2">
                    <div className="p-10 space-y-8 relative z-10">
                        <div className="flex items-center gap-4 border-b border-white/5 pb-8 mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                                <LayoutGrid size={24} className="text-green-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white"><T>Services</T></h3>
                                <p className="text-xs text-gray-500"><T>Calculateur de prix et services complémentaires</T></p>
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* Toggle GLOBAL : Calculateurs intelligents (tous les services) */}
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-green-500/[0.04] border border-green-500/20">
                                <div>
                                    <p className="text-sm font-bold text-white"><T>Calculateurs intelligents (tous les services)</T></p>
                                    <p className="text-xs text-gray-500 mt-1"><T>Active ou désactive le calculateur de prix sur toutes les pages service en une fois.</T></p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, services_show_calculator: prev.services_show_calculator === 'true' ? 'false' : 'true' }))}
                                    title={form.services_show_calculator === 'true' ? 'Désactiver tous les calculateurs' : 'Activer tous les calculateurs'}
                                    aria-label={form.services_show_calculator === 'true' ? 'Désactiver tous les calculateurs' : 'Activer tous les calculateurs'}
                                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none ${form.services_show_calculator === 'true' ? 'bg-green-500' : 'bg-white/10'}`}
                                >
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${form.services_show_calculator === 'true' ? 'translate-x-8' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {/* Toggle PricingCalculator : spécifique Passeport / Nationalité VIP */}
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                <div>
                                    <p className="text-sm font-bold text-white"><T>Afficher le calculateur de prix</T></p>
                                    <p className="text-xs text-gray-500 mt-1"><T>Page Passeport / Nationalité Béninoise VIP (ignoré si le réglage global est désactivé)</T></p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, passeport_show_calculator: prev.passeport_show_calculator === 'true' ? 'false' : 'true' }))}
                                    title={form.passeport_show_calculator === 'true' ? 'Désactiver le calculateur' : 'Activer le calculateur'}
                                    aria-label={form.passeport_show_calculator === 'true' ? 'Désactiver le calculateur' : 'Activer le calculateur'}
                                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none ${form.passeport_show_calculator === 'true' ? 'bg-green-500' : 'bg-white/10'}`}
                                >
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${form.passeport_show_calculator === 'true' ? 'translate-x-8' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {/* JSON autres services */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-green-500 uppercase tracking-widest ml-1">
                                    <T>Services complémentaires (JSON)</T>
                                </label>
                                <textarea
                                    name="autres_services_json"
                                    value={form.autres_services_json}
                                    onChange={handleChange}
                                    rows={8}
                                    placeholder={`[\n  { "icon": "Car", "title": "Transport", "description": "Description..." },\n  { "icon": "HeartPulse", "title": "Santé", "description": "Description..." }\n]`}
                                    className="w-full bg-[#131b2c] border border-green-500/30 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-green-500 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-all font-mono text-xs"
                                />
                                <p className="text-[10px] text-gray-500 font-bold ml-1">
                                    <T>Icônes disponibles : Car, HeartPulse, GraduationCap, FileCheck, Home, Briefcase, Star, Globe</T>
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Structure de la Navigation */}
                <Card className="bg-[#0a0f18] border-white/5 overflow-hidden rounded-[3rem] shadow-2xl relative lg:col-span-2">
                    <div className="p-10 space-y-8 relative z-10">
                        <div className="flex items-center justify-between border-b border-white/5 pb-8 mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                                    <LinkIcon size={24} className="text-pink-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white"><T>Barre de Navigation</T></h3>
                                    <p className="text-xs text-gray-500"><T>Gérez les menus visibles par le public (En haut à droite du site)</T></p>
                                </div>
                            </div>
                            <Button onClick={addLink} variant="outline" className="border-pink-500/30 text-pink-400 hover:bg-pink-500/10 h-10 px-4 rounded-xl gap-2 font-bold text-xs uppercase">
                                <Plus size={16} /> Ajouter un lien
                            </Button>
                        </div>

                        <div className="grid gap-4">
                            <AnimatePresence>
                                {navbarLinks.map((link, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                                            {index + 1}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                                            <div>
                                                <input
                                                    value={link.label}
                                                    onChange={(e) => handleLinkChange(index, 'label', e.target.value)}
                                                    placeholder={t("Titre du lien (ex: Accueil)")}
                                                    className="w-full bg-transparent border-b border-white/10 py-2 px-1 text-white focus:outline-none focus:border-pink-500 transition-all font-bold text-sm"
                                                />
                                            </div>
                                            <div>
                                                <input
                                                    value={link.href}
                                                    onChange={(e) => handleLinkChange(index, 'href', e.target.value)}
                                                    placeholder={t("Destination (ex: /boutique)")}
                                                    className="w-full bg-transparent border-b border-white/10 py-2 px-1 text-gray-400 focus:outline-none focus:border-pink-500 transition-all font-mono text-sm"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeLink(index)}
                                            className="p-3 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {navbarLinks.length === 0 && (
                                <div className="text-center py-10 opacity-50">
                                    <p className="text-sm font-bold text-white mb-2"><T>Aucun lien défini.</T></p>
                                    <p className="text-xs text-gray-500"><T>Ajoutez des liens pour construire le menu principal.</T></p>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
