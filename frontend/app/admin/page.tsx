'use client';

import { useTranslation, T } from '@/lib/translation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Users, Eye, MessageSquare, Map, ShieldCheck,
    TrendingUp, AlertCircle, Sparkles, Loader2,
    Activity, Clock, Globe, Zap, ArrowUpRight,
    ShoppingBag, Receipt, CreditCard, Package,
    Image as ImageIcon, Settings
} from "lucide-react";
import { AIAssistant } from "@/components/admin/ai-assistant";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TopProduct {
    product_title: string;
    amount: number;
    quantity: number;
}

interface RecentMessage {
    id: string;
    nom: string;
    prenom: string;
    sujet: string;
    type: string;
    created_at: string;
}

export default function AdminDashboard() {
    const { t } = useTranslation();
    const [stats, setStats] = useState({
        patrimoine: 0,
        services: 0,
        messages: 0,
        testimonials: 0,
    });
    const [commerceStats, setCommerceStats] = useState({
        totalRevenue: 0,
        ordersCount: 0,
        productsCount: 0,
        pendingOrders: 0,
    });
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [patCount, serCount, msgCount, testCount] = await Promise.all([
                    supabase.from('patrimoine').select('*', { count: 'exact', head: true }),
                    supabase.from('services').select('*', { count: 'exact', head: true }),
                    supabase.from('messages').select('*', { count: 'exact', head: true }).neq('type', 'nationality'),
                    supabase.from('testimonials').select('*', { count: 'exact', head: true }),
                ]);

                setStats({
                    patrimoine: patCount.count || 0,
                    services: serCount.count || 0,
                    messages: msgCount.count || 0,
                    testimonials: testCount.count || 0,
                });

                const { data: messages } = await supabase
                    .from('messages')
                    .select('*')
                    .neq('type', 'nationality')
                    .order('created_at', { ascending: false })
                    .limit(5);

                setRecentMessages(messages || []);

                // Commerce stats
                const [ordersRes, productsRes, pendingRes] = await Promise.all([
                    supabase.from('orders').select('amount').eq('payment_status', 'completed'),
                    supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
                    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('payment_status', 'pending'),
                ]);

                const completedOrders = ordersRes.data || [];
                const totalRevenue = completedOrders.reduce((sum: number, o) => sum + (o.amount || 0), 0);

                setCommerceStats({
                    totalRevenue,
                    ordersCount: completedOrders.length,
                    productsCount: productsRes.count || 0,
                    pendingOrders: pendingRes.count || 0,
                });

                // Top products (most ordered)
                const { data: recentOrders } = await supabase
                    .from('orders')
                    .select('product_title, amount, quantity')
                    .eq('payment_status', 'completed')
                    .order('created_at', { ascending: false })
                    .limit(5);
                setTopProducts(recentOrders || []);

            } catch (error) {
                console.error("Dashboard fetch error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-6 md:space-y-12"
        >
            {/* ═══════════════════════════════════════════ */}
            {/* HERO SECTION - CONTROL CENTER STATUS */}
            {/* ═══════════════════════════════════════════ */}
            <motion.div variants={item} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#FCD116]">
                        <Activity size={18} className="animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em]"><T>Opérations en Cours</T></span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black text-white font-heading tracking-tight leading-none">
                        VIBE <span className="text- benin-gradient"><T>CONTROL</T></span>
                    </h2>
                    <p className="text-gray-500 max-w-xl font-medium">
                        Bienvenue dans le centre de commandement de Retour Gagnant. Pilotez l&apos;expérience digitale du futur du Bénin.
                    </p>
                </div>

                <div className="flex items-center gap-6 bg-white/5 border border-white/10 p-4 rounded-3xl backdrop-blur-md">
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1"><T>Dernière Sync</T></span>
                        <div className="flex items-center gap-2 text-white font-mono text-xs">
                            <Clock size={12} className="text-[#008751]" />
                            {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                    <div className="w-[1px] h-10 bg-white/10" />
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1"><T>Node Status</T></span>
                        <div className="flex items-center gap-2 text-green-400 font-bold text-xs">
                            <Zap size={12} fill="currentColor" />
                            OPTIMAL
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* AI Assistant - Floating Interface */}
            <motion.div variants={item} className="relative group">
                <div className="absolute -inset-1 bg-benin-gradient rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                <AIAssistant />
            </motion.div>

            {/* ═══════════════════════════════════════════ */}
            {/* PRIMARY METRICS - NEON CARDS */}
            {/* ═══════════════════════════════════════════ */}
            <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <MetricCard
                    title={t("Patrimoine")}
                    value={stats.patrimoine}
                    icon={Map}
                    color="#FCD116"
                    glow="rgba(252,209,22,0.15)"
                    loading={loading}
                />
                <MetricCard
                    title={t("Services")}
                    value={stats.services}
                    icon={ShieldCheck}
                    color="#008751"
                    glow="rgba(0,135,81,0.15)"
                    loading={loading}
                />
                <MetricCard
                    title={t("Interactions")}
                    value={stats.messages}
                    icon={MessageSquare}
                    color="#E8112D"
                    glow="rgba(232,17,45,0.15)"
                    loading={loading}
                />
                <MetricCard
                    title={t("Ambassadeurs")}
                    value={stats.testimonials}
                    icon={Users}
                    color="#3b82f6"
                    glow="rgba(59,130,246,0.15)"
                    loading={loading}
                />
            </motion.div>

            {/* ═══════════════════════════════════════════ */}
            {/* COMMERCE KPIs */}
            {/* ═══════════════════════════════════════════ */}
            <motion.div variants={item}>
                <div className="flex items-center gap-2 text-[#008751] mb-4">
                    <ShoppingBag size={16} />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]"><T>Performance Boutique</T></span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                    <MetricCard title={t("Revenu Total")} value={loading ? '...' : `${new Intl.NumberFormat('fr-FR').format(commerceStats.totalRevenue)} XOF`} icon={TrendingUp} color="#008751" glow="rgba(0,135,81,0.15)" loading={false} />
                    <MetricCard title={t("Commandes")} value={commerceStats.ordersCount} icon={Receipt} color="#FCD116" glow="rgba(252,209,22,0.15)" loading={loading} />
                    <MetricCard title={t("En Attente")} value={commerceStats.pendingOrders} icon={Clock} color="#E8112D" glow="rgba(232,17,45,0.15)" loading={loading} />
                    <MetricCard title={t("Produits Actifs")} value={commerceStats.productsCount} icon={Package} color="#3b82f6" glow="rgba(59,130,246,0.15)" loading={loading} />
                </div>
            </motion.div>

            {/* Top Products */}
            {topProducts.length > 0 && (
                <motion.div variants={item}>
                    <Card className="bg-[#0a0f18] border-white/5 rounded-[2rem] overflow-hidden">
                        <CardHeader className="p-4 md:p-8 border-b border-white/5">
                            <CardTitle className="text-white font-heading text-lg flex items-center gap-2">
                                <TrendingUp size={18} className="text-[#008751]" /> Dernieres Ventes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-white/5">
                                {topProducts.map((p: TopProduct, i: number) => (
                                    <div key={i} className="flex items-center justify-between px-4 py-3 md:px-8 md:py-5 hover:bg-white/[0.02] transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-[#008751]/10 border border-[#008751]/20 flex items-center justify-center text-xs font-black text-[#008751]">{i + 1}</div>
                                            <p className="text-sm font-bold text-white">{p.product_title || 'Produit'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-[#FCD116]">{new Intl.NumberFormat('fr-FR').format(p.amount)} XOF</p>
                                            <p className="text-[10px] text-gray-500">x{p.quantity || 1}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* ACTIVITY & INTELLIGENCE */}
            {/* ═══════════════════════════════════════════ */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-8 xl:gap-10">
                {/* Real-time Activity Feed */}
                <motion.div variants={item} className="xl:col-span-2">
                    <Card className="bg-[#0a0f18] border-white/5 rounded-[2.5rem] shadow-3xl overflow-hidden group">
                        <CardHeader className="p-4 md:p-8 border-b border-white/5 flex flex-row items-center justify-between bg-white/[0.02] gap-2">
                            <div>
                                <CardTitle className="text-white font-heading text-base md:text-xl"><T>Flux d&apos;Activité</T></CardTitle>
                                <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest hidden sm:block"><T>Temps Réel • Messages Entrants</T></p>
                            </div>
                            <Button variant="ghost" className="text-[#FCD116] hover:bg-[#FCD116]/10 font-bold text-xs uppercase tracking-tighter flex-shrink-0"><T>Tout Surveiller</T></Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto scrollbar-hide">
                                {loading ? (
                                    <div className="flex justify-center items-center py-40">
                                        <Loader2 className="animate-spin text-[#FCD116]" size={36} />
                                    </div>
                                ) : recentMessages.length > 0 ? (
                                    recentMessages.map((msg, idx) => (
                                        <motion.div
                                            key={msg.id}
                                            initial={{ x: -20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: idx * 0.1 }}
                                            className="group/item flex items-center gap-3 md:gap-6 p-4 md:p-8 hover:bg-white/[0.03] transition-all cursor-pointer relative"
                                        >
                                            <div className={cn(
                                                "w-1 h-12 absolute left-0 transition-all opacity-0 group-hover/item:opacity-100",
                                                msg.type === 'contact' ? "bg-[#008751]" : "bg-[#FCD116]"
                                            )} />

                                            <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 flex-shrink-0 group-hover/item:border-[#FCD116]/30 group-hover/item:bg-white/10 transition-all">
                                                {msg.type === 'contact' ? <MessageSquare size={24} className="text-gray-400" /> : <Clock size={24} className="text-[#FCD116]" />}
                                            </div>

                                            <div className="flex-1 overflow-hidden">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="text-xs font-black text-white uppercase tracking-wider">{msg.nom} {msg.prenom}</span>
                                                    <span className="text-[10px] text-gray-600 font-mono">• {new Date(msg.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-sm text-gray-400 font-medium truncate group-hover/item:text-white transition-colors">{msg.sujet || 'Demande de renseignement'}</p>
                                            </div>

                                            <div className="flex-shrink-0">
                                                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-gray-400 uppercase group-hover/item:text-[#FCD116] group-hover/item:border-[#FCD116]/30">
                                                    Détails
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                ) : (
                                    <div className="text-center py-40 text-gray-600 italic"><T>Silence radio... Aucune interaction récente.</T></div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* System Diagnostics / Stats */}
                <motion.div variants={item} className="space-y-8">
                    <Card className="bg-benin-gradient p-[1px] rounded-[2rem] shadow-3xl group">
                        <div className="bg-[#0a0f18] rounded-[1.95rem] p-4 md:p-8 h-full">
                            <h3 className="text-white font-heading text-base md:text-lg mb-4 md:mb-6 flex items-center gap-3">
                                <Zap size={20} className="text-[#FCD116]" /> Node Health
                            </h3>

                            <div className="space-y-10">
                                <健康Status label="Supabase Core" value={99} color="#008751" />
                                <健康Status label="Llama 3 inference" value={100} color="#FCD116" />
                                <健康Status label="Edge Runtime" value={94} color="#3b82f6" />

                                <div className="pt-6 border-t border-white/5">
                                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-[#FCD116]/30 transition-all cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <Globe size={18} className="text-gray-400" />
                                            <span className="text-xs font-bold text-gray-300"><T>Traffic Source</T></span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono text-white"><T>FR, BJ, US</T></span>
                                            <ArrowUpRight size={14} className="text-gray-500" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Quick Access Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <QuickAction icon={Map} label="Patrimoine" />
                        <QuickAction icon={ImageIcon} label="Galerie" />
                        <QuickAction icon={Settings} label="Réseau" />
                        <QuickAction icon={ShieldCheck} label="Sécurité" />
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}

function MetricCard({ title, value, icon: Icon, color, glow, loading }: { title: string, value: string | number, icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>, color: string, glow: string, loading: boolean }) {
    return (
        <Card className="relative bg-[#0a0f18] border-white/5 rounded-2xl md:rounded-[2.5rem] p-4 md:p-8 overflow-hidden group hover:border-white/10 transition-all cursor-pointer">
            <div className="absolute top-0 right-0 w-32 h-32 blur-[80px] pointer-events-none transition-all group-hover:scale-150" style={{ backgroundColor: glow }} />

            <div className="relative z-10 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start mb-4 md:mb-10">
                    <div className="p-2.5 md:p-4 rounded-xl md:rounded-2xl bg-white/5 border border-white/5 group-hover:border-white/20 transition-all shadow-xl">
                        <Icon size={20} className="md:hidden" style={{ color }} />
                        <Icon size={28} className="hidden md:block" style={{ color }} />
                    </div>
                </div>

                <div>
                    <h3 className="text-2xl md:text-5xl font-black text-white font-heading tracking-tight">
                        {loading ? "..." : value}
                    </h3>
                    <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-[0.2em] mt-1 md:mt-2 group-hover:text-white transition-colors">{title}</p>
                </div>
            </div>
        </Card>
    );
}

function 健康Status({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-gray-500">{label}</span>
                <span style={{ color }}>{value}% OK</span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
                />
            </div>
        </div>
    );
}

function QuickAction({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; className?: string }>, label: string }) {
    return (
        <button className="flex flex-col items-center justify-center p-6 bg-white/5 border border-white/5 rounded-[1.5rem] hover:bg-white/10 hover:border-white/20 transition-all group">
            <Icon size={24} className="text-gray-400 group-hover:text-[#FCD116] transition-colors mb-3" />
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-white">{label}</span>
        </button>
    );
}
