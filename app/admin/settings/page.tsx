'use client';

import { useList, useNavigation } from "@refinedev/core";
import {
    Settings, Zap, Database,
    Save, RotateCcw,
    Sliders, Palette, Share2, Loader2,
    CreditCard, Mail, MonitorPlay
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsList() {
    const { edit } = useNavigation();
    const [deployMsg, setDeployMsg] = useState<string | null>(null);
    const queryResult = useList({
        resource: "settings",
    });

    const data = (queryResult as any).data || (queryResult as any).query?.data;
    const isLoading = (queryResult as any).isLoading || (queryResult as any).query?.isLoading;

    const items = data?.data || [];

    return (
        <div className="space-y-12 animate-in fade-in duration-1000">
            {/* ═══════════════════════════════════════════ */}
            {/* CONFIG HEADER */}
            {/* ═══════════════════════════════════════════ */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#FCD116]">
                        <Settings size={18} className="animate-spin-slow" />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em]">Configuration du Noyau</span>
                    </div>
                    <h1 className="text-6xl font-black text-white font-heading tracking-tighter">
                        SYSTÈME <span className="text- benin-gradient">CONFIG</span>
                    </h1>
                    <p className="text-gray-500 max-w-xl font-medium text-sm">Contrôlez les paramètres globaux, les API et l&apos;identité visuelle de Retour Gagnant.</p>
                </div>

                <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={() => window.location.reload()}
                            className="h-14 px-6 rounded-2xl border-white/5 bg-white/5 text-gray-400 font-bold text-xs uppercase tracking-widest hover:bg-white/10"
                        >
                            <RotateCcw size={16} className="mr-2" /> Réinitialiser
                        </Button>
                        <Button
                            onClick={() => { setDeployMsg('Toutes les modifications sont automatiquement synchronisées avec le serveur.'); setTimeout(() => setDeployMsg(null), 4000); }}
                            className="h-14 px-8 rounded-2xl bg-[#008751] text-white font-black tracking-widest gap-2 shadow-xl shadow-green-500/20"
                        >
                            <Save size={20} /> DÉPLOYER LES MODIFS
                        </Button>
                    </div>
                    {deployMsg && (
                        <p className="text-xs text-[#008751] font-bold">{deployMsg}</p>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* SETTINGS CATEGORIES */}
            {/* ═══════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Visual Identity */}
                <SettingCategory
                    title="Identité Visuelle"
                    icon={Palette}
                    color="#FCD116"
                    description="Logo, couleurs primaires, et thèmes du site public."
                    items={[
                        { label: "Couleur Primaire", value: "#FCD116", type: "color" },
                        { label: "Slogan Office", value: "L'alliance parfaite...", type: "text" },
                        { label: "Logo URL", value: "/logo.png", type: "text" },
                    ]}
                />

                {/* API & Services */}
                <SettingCategory
                    title="API & Intelligence"
                    icon={Zap}
                    color="#3b82f6"
                    description="Connecteurs IA, Supabase et services tiers."
                    items={[
                        { label: "Modèle IA Actif", value: "Llama 3.3 (Groq)", type: "status" },
                        { label: "Edge Cache", value: "Activé (12h)", type: "status" },
                        { label: "Analytiques", value: "Opérationnel", type: "status" },
                    ]}
                />

                {/* Company Info */}
                <SettingCategory
                    title="Contact & Social"
                    icon={Share2}
                    color="#008751"
                    description="Coordonnées officielles et réseaux sociaux."
                    items={[
                        { label: "Email Support", value: "contact@retourgagnant.bj", type: "text" },
                        { label: "Téléphone", value: "+229 01 23 45 67", type: "text" },
                        { label: "Siège Social", value: "Haie Vive, Cotonou", type: "text" },
                    ]}
                />
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* EMAIL AND PAYMENT SHORTCUTS */}
            {/* ═══════════════════════════════════════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Email Gateway */}
                <Link href="/admin/settings/email" className="block group">
                    <Card className="bg-[#0a0f18] h-full border-white/5 rounded-[2rem] overflow-hidden hover:border-[#3b82f6]/20 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-[#3b82f6]/5">
                        <div className="p-8 flex items-center justify-between h-full">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 shrink-0 rounded-2xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center group-hover:bg-[#3b82f6]/20 transition-colors">
                                    <Mail size={24} className="text-[#3b82f6]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white font-heading">Serveur d&apos;Emails (SMTP)</h3>
                                    <p className="text-xs text-gray-500 mt-1">Configurez l&apos;envoi des factures, notifications webhooks via Gmail ou SMTP privé.</p>
                                </div>
                            </div>
                            <div className="text-gray-600 group-hover:text-[#3b82f6] transition-colors shrink-0">
                                <Settings size={20} />
                            </div>
                        </div>
                    </Card>
                </Link>

                {/* Payment Gateway */}
                <Link href="/admin/settings/payment" className="block group">
                    <Card className="bg-[#0a0f18] h-full border-white/5 rounded-[2rem] overflow-hidden hover:border-[#FCD116]/20 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-[#FCD116]/5">
                        <div className="p-8 flex items-center justify-between h-full">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 shrink-0 rounded-2xl bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center group-hover:bg-[#FCD116]/20 transition-colors">
                                    <CreditCard size={24} className="text-[#FCD116]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white font-heading">Passerelles de Paiement</h3>
                                    <p className="text-xs text-gray-500 mt-1">Configurez Kkiapay, FedaPay, Zeyow — activez/desactivez, sandbox/production.</p>
                                </div>
                            </div>
                            <div className="text-gray-600 group-hover:text-[#FCD116] transition-colors shrink-0">
                                <Settings size={20} />
                            </div>
                        </div>
                    </Card>
                </Link>

                {/* Frontend Gateway */}
                <Link href="/admin/settings/frontend" className="block group md:col-span-2">
                    <Card className="bg-[#0a0f18] h-full border-white/5 rounded-[2rem] overflow-hidden hover:border-purple-500/20 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-purple-500/5">
                        <div className="p-8 flex items-center justify-between h-full">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 shrink-0 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                                    <MonitorPlay size={24} className="text-purple-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white font-heading">Personnalisation FrontEnd</h3>
                                    <p className="text-xs text-gray-500 mt-1">Gérez le design visuel public : Vidéo d&apos;accueil, textes, liens de la barre de navigation, immersion totale.</p>
                                </div>
                            </div>
                            <div className="text-gray-600 group-hover:text-purple-500 transition-colors shrink-0">
                                <Palette size={20} />
                            </div>
                        </div>
                    </Card>
                </Link>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* ADVANCED NODE CONFIG (Database Items) */}
            {/* ═══════════════════════════════════════════ */}
            <Card className="bg-[#0a0f18] border-white/5 rounded-[3rem] overflow-hidden shadow-3xl">
                <CardHeader className="p-10 border-b border-white/5 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl font-black text-white font-heading">Paramètres de la Table</CardTitle>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">Éléments configurables depuis Supabase</p>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-white/5">
                        {isLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="animate-spin text-[#FCD116]" />
                            </div>
                        ) : items.length > 0 ? (
                            items.map((item: any) => (
                                <div key={item.id} className="flex items-center justify-between p-10 hover:bg-white/[0.02] transition-colors group">
                                    <div className="flex items-center gap-6">
                                        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-400 group-hover:bg-[#FCD116]/10 group-hover:text-[#FCD116] transition-all">
                                            <Database size={24} />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-lg">{item.key || "Clé de config"}</h4>
                                            <p className="text-sm text-gray-500 font-mono mt-1">{item.value || "Valeur non définie"}</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={() => edit("settings", item.id)}
                                        className="h-12 px-6 rounded-xl border-white/10 text-gray-400 hover:bg-white hover:text-black font-bold text-xs uppercase tracking-widest transition-all"
                                    >
                                        MODIFIER LE NOEUD
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <div className="p-20 text-center opacity-30">
                                <Sliders size={48} className="mx-auto mb-4" />
                                <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Aucune donnée de configuration brute trouvée.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <style jsx global>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 12s linear infinite;
                }
            `}</style>
        </div>
    );
}

function SettingCategory({ title, icon: Icon, color, description, items }: any) {
    return (
        <Card className="bg-[#0a0f18] border-white/5 rounded-[2.5rem] p-8 hover:border-white/10 transition-all group overflow-hidden relative shadow-2xl">
            <div className="absolute -top-10 -right-10 w-32 h-32 blur-[60px] opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity" style={{ backgroundColor: color }} />

            <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-gray-400 group-hover:scale-110 transition-transform" style={{ color: color }}>
                        <Icon size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white font-heading tracking-tight">{title}</h3>
                        <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mt-0.5">Catégorie Système</p>
                    </div>
                </div>

                <p className="text-xs text-gray-500 font-medium leading-relaxed">{description}</p>

                <div className="space-y-3 pt-4">
                    {items.map((it: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{it.label}</span>
                            {it.type === 'color' ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: it.value }} />
                                    <span className="text-[10px] font-mono text-white opacity-60 uppercase">{it.value}</span>
                                </div>
                            ) : it.type === 'status' ? (
                                <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[8px] font-black uppercase tracking-widest border border-green-500/20">
                                    {it.value}
                                </span>
                            ) : (
                                <span className="text-[11px] font-mono text-white/80 max-w-[150px] truncate">{it.value}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
}
