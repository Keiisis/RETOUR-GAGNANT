'use client';

import { motion } from 'framer-motion';
import { Clock, CheckCircle, AlertTriangle, ArrowRight, FileText } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardHome() {
    return (
        <div className="space-y-12 pb-20">

            {/* 1. Welcome Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
            >
                <h1 className="text-4xl md:text-5xl font-heading font-bold mb-2">
                    Heureux de vous revoir, <span className="text-[#FCD116]">Roi.</span>
                </h1>
                <p className="text-gray-400 text-lg max-w-2xl">
                    Votre empire se construit pierre par pierre. Voici l'état de vos terres au Bénin.
                </p>
            </motion.div>

            {/* 2. Le Fil d'Ariane (Active Project) */}
            <motion.section
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Clock className="text-[#008751]" /> Projet en Cours : Villa Cotonou
                    </h2>
                    <span className="text-xs font-mono bg-[#008751]/20 text-[#008751] px-2 py-1 rounded border border-[#008751]/30">ÉTAPE 3/8</span>
                </div>

                {/* Timeline Visual (Simplified 2D for now, conceptual 3D) */}
                <div className="relative h-2 bg-white/5 rounded-full overflow-hidden mb-8">
                    <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#008751] to-[#FCD116] w-[45%]" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ActionCard
                        title="Validation Notaire"
                        status="completed"
                        date="12 Fév 2026"
                    />
                    <ActionCard
                        title="Permis de Construire"
                        status="active"
                        description="En attente de signature mairie."
                    />
                    <ActionCard
                        title="Fondations"
                        status="locked"
                        date="Est. 01 Mars"
                    />
                </div>
            </motion.section>

            {/* 3. Le Grenier (Recent Docs) */}
            <motion.section
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
                {/* Notifications (Griot) */}
                <Card className="bg-[#0f141e]/80 backdrop-blur border-white/5 hover:border-white/10 transition-colors">
                    <CardContent className="p-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#E8112D] animate-pulse" /> Le Griot a parlé
                        </h3>
                        <div className="space-y-4">
                            <NotifItem
                                icon={AlertTriangle}
                                color="#FCD116"
                                title="Action Requise"
                                desc="Veuillez signer le document 'Contrat_Architecte_v2.pdf'."
                                time="Il y a 2h"
                            />
                            <NotifItem
                                icon={CheckCircle}
                                color="#008751"
                                title="Succès"
                                desc="Virement de 5.000€ bien reçu pour l'acompte."
                                time="Hier"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Documents */}
                <Card className="bg-[#0f141e]/80 backdrop-blur border-white/5 hover:border-white/10 transition-colors">
                    <CardContent className="p-6">
                        <h3 className="text-lg font-bold mb-4">Documents Récents</h3>
                        <div className="space-y-3">
                            <DocItem name="Facture_Fevrier.pdf" size="1.2 MB" />
                            <DocItem name="Plan_Masse_Villa.dwg" size="4.5 MB" />
                            <DocItem name="Attestation_Propriete.pdf" size="800 KB" />
                        </div>
                        <Button variant="ghost" className="w-full mt-4 text-[#FCD116] hover:text-white hover:bg-white/5">
                            Voir tout le Grenier <ArrowRight size={16} className="ml-2" />
                        </Button>
                    </CardContent>
                </Card>
            </motion.section>
        </div>
    );
}

// Sub-components for cleaner code
function ActionCard({ title, status, date, description }: any) {
    const isCompleted = status === 'completed';
    const isActive = status === 'active';
    const isLocked = status === 'locked';

    return (
        <div className={`p-6 rounded-xl border transition-all ${isActive
                ? 'bg-[#0f141e] border-[#FCD116] shadow-[0_0_20px_rgba(252,209,22,0.1)] transform scale-105'
                : 'bg-white/5 border-white/5 opacity-80'
            }`}>
            <div className="flex justify-between items-start mb-2">
                {isCompleted && <CheckCircle className="text-[#008751]" size={24} />}
                {isActive && <div className="w-3 h-3 rounded-full bg-[#FCD116] animate-ping" />}
                {isLocked && <div className="w-3 h-3 rounded-full bg-gray-600" />}
            </div>
            <h4 className={`font-bold text-lg mb-1 ${isActive ? 'text-white' : 'text-gray-400'}`}>{title}</h4>
            <p className="text-xs text-gray-500">{date || description}</p>
            {isActive && (
                <Button size="sm" className="mt-4 w-full bg-[#FCD116] text-black hover:bg-[#D4AF37]">
                    Voir Détails
                </Button>
            )}
        </div>
    )
}

function NotifItem({ icon: Icon, color, title, desc, time }: any) {
    return (
        <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group">
            <div className="p-2 rounded bg-white/5 group-hover:bg-white/10">
                <Icon size={18} style={{ color }} />
            </div>
            <div className="flex-1">
                <div className="flex justify-between">
                    <h4 className="text-sm font-bold text-white">{title}</h4>
                    <span className="text-[10px] text-gray-500">{time}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 line-clamp-1">{desc}</p>
            </div>
        </div>
    )
}

function DocItem({ name, size }: any) {
    return (
        <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 hover:border-white/20 cursor-pointer bg-black/20">
            <div className="flex items-center gap-3">
                <FileText size={18} className="text-[#8899a6]" />
                <span className="text-sm text-gray-300">{name}</span>
            </div>
            <span className="text-xs text-gray-600">{size}</span>
        </div>
    )
}
