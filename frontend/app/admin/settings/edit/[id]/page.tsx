'use client';

import { useTranslation, T } from '@/lib/translation';
import { useForm, useNavigation, useOne } from "@refinedev/core";
import { ArrowLeft, FloppyDisk as Save, ShieldCheck, Database, GridFour as LayoutGrid, CircleNotch as Loader2 } from '@phosphor-icons/react';
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";

interface Setting {
    id: string;
    key: string;
    value: string;
    category?: string;
}

export default function SettingsEdit() {
    const { t } = useTranslation();
    const params = useParams();
    const id = params.id as string;
    const { list } = useNavigation();

    const queryResult = useOne<Setting>({
        resource: "settings",
        id,
    });
    const queryInternal = queryResult as unknown as Record<string, unknown>
    const queryObj = (queryInternal.query ?? queryInternal) as Record<string, boolean | undefined>
    const itemData = queryResult.result
        ? { data: queryResult.result }
        : (queryInternal.data as { data?: Setting } | undefined)
    const isFetching = queryObj.isLoading ?? false

    const { onFinish, formLoading } = useForm({
        resource: "settings",
        action: "edit",
        id,
        redirect: "list",
    });

    const [formData, setFormData] = useState<Partial<Setting>>({
        key: "",
        value: ""
    });

    useEffect(() => {
        if (itemData?.data) {
            setFormData({
                key: itemData.data.key || "",
                value: itemData.data.value || ""
            });
        }
    }, [itemData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: Partial<Setting>) => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        onFinish(formData);
    };

    if (isFetching) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-[#FCD116] mb-4" size={40} />
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]"><T>Chargement du bloc...</T></p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-[#0a0f18]/40 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => list("settings")}
                        title="Retour aux réglages"
                        className="p-4 bg-white/5 border border-white/5 rounded-2xl text-gray-500 hover:text-[#FCD116] transition-all"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black font-heading text-white tracking-tight italic"><T>RÉGLAGE</T> <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-400 to-white"><T>NOEUD</T></span></h1>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em] mt-1"><T>Paramètres avancés</T></p>
                    </div>
                </div>

                <Button
                    onClick={handleSave}
                    disabled={formLoading}
                    className="w-full md:w-auto bg-white text-black hover:bg-gray-200 h-16 px-10 rounded-[1.5rem] font-black tracking-widest gap-3 shadow-2xl"
                >
                    {formLoading ? <Loader2 size={24} className="animate-spin" /> : <Save size={20} />}
                    ENREGISTRER
                </Button>
            </div>

            <Card className="bg-[#0a0f18] border-white/5 p-12 rounded-[3.5rem] shadow-3xl">
                <form className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {/* Clé */}
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-[#FCD116] uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
                                <Database size={14} /> Clé Identifiant
                            </label>
                            <input
                                name="key"
                                value={formData.key || ''}
                                onChange={handleChange}
                                placeholder={t("ex: contact_email")}
                                className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-5 px-6 text-white text-sm font-bold font-mono focus:outline-none focus:border-[#FCD116]/40 transition-all"
                            />
                            <p className="text-[10px] text-gray-500 font-bold ml-1 uppercase"><T>Identifiant utilisé dans le code (minuscules, sans espace)</T></p>
                        </div>
                    </div>

                    {/* Valeur */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-[#FCD116] uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
                            <LayoutGrid size={14} /> Valeur
                        </label>
                        <textarea
                            name="value"
                            value={formData.value || ''}
                            onChange={handleChange}
                            rows={8}
                            placeholder={t("ex: contact@retour-gagnant.com")}
                            className="w-full bg-white/5 border-2 border-white/5 rounded-3xl py-6 px-8 text-white text-sm font-medium focus:outline-none focus:border-[#FCD116]/40 transition-all font-mono"
                        />
                        <p className="text-[10px] text-gray-500 font-bold ml-1 uppercase"><T>La valeur peut être du texte, JSON, ou une URL</T></p>
                    </div>
                </form>
            </Card>

            {/* Warning block */}
            <div className="bg-red-500/10 border border-red-500/20 rounded-[2rem] p-6 flex items-start gap-6">
                <div className="w-12 h-12 rounded-xl bg-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                    <ShieldCheck size={24} />
                </div>
                <div>
                    <h4 className="text-red-500 font-bold text-sm uppercase tracking-widest mb-1"><T>Attention</T></h4>
                    <p className="text-gray-400 text-xs font-medium leading-relaxed">
                        La modification de ces variables système peut altérer le fonctionnement public de l'application. Soyez certain des changements apportés.
                    </p>
                </div>
            </div>
        </div>
    );
}
