'use client';

import { useList, useUpdate } from "@refinedev/core";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Save, Mail, Server, Fingerprint, Send, Loader2, CheckCircle2, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SettingItem {
    id: string;
    key: string;
    value: string;
    description?: string;
}

export default function EmailSettingsPage() {
    const queryResult = useList<SettingItem>({
        resource: "settings",
        pagination: { mode: "off" }
    });
    const settingsData = queryResult.query?.data;
    const isLoading = queryResult.query?.isLoading;

    const { mutate: updateSetting } = useUpdate();
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success?: boolean, message?: string } | null>(null);

    const [form, setForm] = useState({
        smtp_host: "smtp.gmail.com",
        smtp_port: "465",
        smtp_user: "",
        smtp_pass: "",
        smtp_from_email: "",
        smtp_from_name: "Retour Gagnant"
    });

    // Mapping of key values in DB to their IDs internally so we can update them
    const [settingIds, setSettingIds] = useState<Record<string, string>>({});

    useEffect(() => {
        if (settingsData?.data) {
            const newForm = { ...form };
            const newIds: Record<string, string> = {};

            settingsData.data.forEach((item) => {
                if (item.key in newForm) {
                    (newForm as Record<string, string>)[item.key] = item.value || "";
                    newIds[item.key] = item.id;
                }
            });

            setForm(newForm);
            setSettingIds(newIds);
        }
    }, [settingsData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
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
                return Promise.resolve();
            });

            await Promise.all(updates);
            alert("Paramètres sauvegardés avec succès !");
        } catch (error) {
            console.error("Save error", error);
            alert("Erreur lors de la sauvegarde.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleTest = async () => {
        if (!form.smtp_user || !form.smtp_from_email) {
            setTestResult({ success: false, message: "Veuillez configurer et sauvegarder une adresse d'envoi avant de tester." });
            return;
        }

        setIsTesting(true);
        setTestResult(null);

        try {
            const res = await fetch('/api/settings/email/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: form.smtp_user })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                setTestResult({ success: true, message: "L'e-mail de test est bien parti. Vérifiez votre boîte de réception (" + form.smtp_user + ")." });
            } else {
                setTestResult({ success: false, message: data.error || "La connexion au serveur SMTP a échoué. Vérifiez vos identifiants ou le mot de passe d'application." });
            }
        } catch (e) {
            setTestResult({ success: false, message: "Erreur réseau lors du test d'envoi." });
        } finally {
            setIsTesting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-[#3b82f6] mb-4" size={40} />
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]">Lecture des protocoles SMTP...</p>
            </div>
        );
    }

    const isGmail = form.smtp_host.includes("gmail");

    return (
        <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-[#0a0f18]/40 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
                <div className="flex items-center gap-6">
                    <Link href="/admin/settings" className="p-4 bg-white/5 border border-white/5 rounded-2xl text-gray-500 hover:text-[#3b82f6] transition-all">
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black font-heading text-white tracking-tight italic"><span className="text-[#3b82f6]">SERVEUR</span> D&apos;EMAILS</h1>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em] mt-1">SMTP & Facturation Web</p>
                    </div>
                </div>

                <div className="flex gap-4 w-full md:w-auto">
                    <Button onClick={handleSave} disabled={isSaving} className="w-full md:w-auto bg-[#3b82f6] hover:bg-blue-600 text-white h-16 px-8 rounded-[1.5rem] font-black tracking-widest gap-2 shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all">
                        {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                        SAUVEGARDER
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-10">
                <Card className="bg-[#0a0f18] border-white/5 overflow-hidden rounded-[3rem] shadow-2xl relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#3b82f6]/5 blur-[80px] rounded-full pointer-events-none" />
                    <div className="p-10 space-y-8 relative z-10">
                        <div className="flex items-center gap-4 border-b border-white/5 pb-8 mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center">
                                <Server size={24} className="text-[#3b82f6]" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">Protocole de Transmission</h3>
                                <p className="text-xs text-gray-500">Configurez la liaison sortante des emails (Gmail ou SMTP Privé)</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Serveur Sortant (Hôte)</label>
                                <input
                                    name="smtp_host"
                                    value={form.smtp_host}
                                    onChange={handleChange}
                                    placeholder="smtp.gmail.com"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#3b82f6]/50 transition-all font-mono text-sm"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Port</label>
                                <input
                                    name="smtp_port"
                                    value={form.smtp_port}
                                    onChange={handleChange}
                                    placeholder="465 ou 587"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#3b82f6]/50 transition-all font-mono text-sm"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <Fingerprint size={12} /> Email (Utilisateur)
                                </label>
                                <input
                                    name="smtp_user"
                                    type="email"
                                    value={form.smtp_user}
                                    onChange={handleChange}
                                    placeholder="votre.adresse@gmail.com"
                                    className="w-full bg-[#131b2c] border border-[#3b82f6]/30 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#3b82f6] shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-all font-mono text-sm"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <Fingerprint size={12} /> Mot de Passe {isGmail && "(Mot de passe d'Application)"}
                                </label>
                                <input
                                    name="smtp_pass"
                                    type="password"
                                    value={form.smtp_pass}
                                    onChange={handleChange}
                                    placeholder="••••••••••••••••"
                                    className="w-full bg-[#131b2c] border border-[#3b82f6]/30 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#3b82f6] shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-all font-mono text-sm"
                                />
                                {isGmail && (
                                    <p className="text-[9px] text-[#3b82f6]/70 mt-2 px-1">
                                        Sur Gmail, n&apos;utilisez pas votre vrai mot de passe. Allez dans compte Google {">"} Sécurité {">"} Validation en 2 étapes {">"} <b>Mots de passe des applications</b>.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="pt-8 mt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nom visible par les clients</label>
                                <input
                                    name="smtp_from_name"
                                    value={form.smtp_from_name}
                                    onChange={handleChange}
                                    placeholder="Retour Gagnant - Agence"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-white/30 transition-all font-bold text-sm"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Adresse affichée (Reply-To)</label>
                                <input
                                    name="smtp_from_email"
                                    value={form.smtp_from_email}
                                    onChange={handleChange}
                                    placeholder="contact@retourgagnant.bj"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-white/30 transition-all font-mono text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Test Panel */}
                <Card className="bg-[#0a0f18] border-white/5 overflow-hidden rounded-[3rem] shadow-2xl">
                    <div className="p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div>
                            <h3 className="text-xl font-black text-white flex items-center gap-3">
                                <Send className="text-[#3b82f6]" size={24} /> Ping Diagnostique
                            </h3>
                            <p className="text-xs text-gray-500 mt-2">Envoyez un e-mail de test via l&apos;API Nodemailer pour valider la configuration et les credentials.</p>
                        </div>
                        <Button
                            onClick={handleTest}
                            disabled={isTesting || !form.smtp_user}
                            variant="outline"
                            className="bg-transparent border-white/10 text-white hover:bg-white hover:text-black shrink-0 h-16 px-8 rounded-[1.5rem] font-black tracking-widest gap-2"
                        >
                            {isTesting ? <Loader2 className="animate-spin" size={20} /> : <Mail size={20} />}
                            TESTER LA LIAISON
                        </Button>
                    </div>

                    <AnimatePresence>
                        {testResult && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className={cx("p-6 border-t font-mono text-xs flex items-start gap-4", testResult.success ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-500")}
                            >
                                {testResult.success ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                                {testResult.message}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>
            </div>
        </div>
    );
}

function cx(...classes: (string | undefined | null | false)[]) { return classes.filter(Boolean).join(' '); }
