'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Eye, MousePointerClick, TrendingUp, AlertCircle } from "lucide-react";

export default function AdminDashboard() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-bold text-white font-heading tracking-tight">Tableau de Bord</h2>
                    <p className="text-gray-400 mt-2">Vue d'ensemble de la performance du Retour Gagnant.</p>
                </div>
                <div className="flex gap-2">
                    <span className="px-3 py-1 rounded bg-[#008751]/20 text-[#008751] border border-[#008751]/30 text-xs font-mono">STATUS: EN LIGNE</span>
                    <span className="px-3 py-1 rounded bg-[#FCD116]/20 text-[#FCD116] border border-[#FCD116]/30 text-xs font-mono">V1.0.0</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Visiteurs Totaux"
                    value="12,345"
                    change="+12%"
                    icon={Users}
                    color="#FCD116"
                />
                <StatCard
                    title="Vues Patrimoine"
                    value="45,678"
                    change="+5%"
                    icon={Eye}
                    color="#008751"
                />
                <StatCard
                    title="Taux de Clic"
                    value="3.2%"
                    change="-1%"
                    icon={MousePointerClick}
                    color="#E8112D"
                />
                <StatCard
                    title="Réservations"
                    value="89"
                    change="+24%"
                    icon={TrendingUp}
                    color="#3b82f6"
                />
            </div>

            {/* Quick Actions & Recent */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity */}
                <Card className="lg:col-span-2 bg-[#1a2332] border-white/5 shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-white">Activité Récente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                                    <div className="w-2 h-2 rounded-full bg-[#008751]" />
                                    <div className="flex-1">
                                        <p className="text-sm text-white font-medium">Nouveau message de contact reçu</p>
                                        <p className="text-xs text-gray-500">Il y a 2 heures • Kevin CHACHA</p>
                                    </div>
                                    <button className="text-xs text-[#FCD116] hover:underline">Voir</button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* System Status / Alerts */}
                <Card className="bg-[#1a2332] border-white/5 shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <AlertCircle size={20} className="text-[#FCD116]" /> Système
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 rounded bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
                            <strong>Backend:</strong> Supabase non connecté. Mode fallback actif.
                        </div>
                        <div className="p-4 rounded bg-green-500/10 border border-green-500/20 text-green-200 text-sm">
                            <strong>Frontend:</strong> Vercel Deployment Ready.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatCard({ title, value, change, icon: Icon, color }: any) {
    return (
        <Card className="bg-[#1a2332] border-white/5 shadow-xl hover:border-[#FCD116]/30 transition-all group">
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-gray-400">{title}</p>
                        <h3 className="text-2xl font-bold text-white mt-2 font-heading">{value}</h3>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                        <Icon size={24} style={{ color }} />
                    </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${change.startsWith('+') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {change}
                    </span>
                    <span className="text-xs text-gray-500">vs mois dernier</span>
                </div>
            </CardContent>
        </Card>
    );
}
