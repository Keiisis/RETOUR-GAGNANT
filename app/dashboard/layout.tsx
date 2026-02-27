'use client';

import dynamic from 'next/dynamic';
import DashboardNav from '@/components/dashboard/ui/DashboardNav';
import Link from 'next/link';
import { LogOut, ShieldCheck } from 'lucide-react';
import { SkeletonLoader } from '@/components/ui/skeleton-loader';

// Progressive loading of the 3D Scene with a premium skeleton fallback
const DashboardScene = dynamic(() => import('@/components/dashboard/3d/DashboardScene'), {
    ssr: false,
    loading: () => <SkeletonLoader variant="3d" />
});

export default function ClientDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="relative w-full h-screen overflow-hidden bg-[#05080a] text-white">
            {/* ═══════════════════════════════════════════ */}
            {/* 1. THE 3D UNIVERSE (DYNAMIC BACKGROUND) */}
            {/* ═══════════════════════════════════════════ */}
            <DashboardScene />

            {/* ═══════════════════════════════════════════ */}
            {/* 2. UI OVERLAY */}
            {/* ═══════════════════════════════════════════ */}
            <div className="relative z-10 w-full h-full flex flex-col">
                {/* Header Minimaliste */}
                <header className="px-8 py-6 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent backdrop-blur-sm border-b border-white/5">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-xl bg-benin-gradient p-0.5 shadow-lg group-hover:scale-110 transition-transform">
                            <div className="w-full h-full bg-[#05080a] rounded-[9px] flex items-center justify-center">
                                <ShieldCheck size={20} className="text-[#FCD116]" />
                            </div>
                        </div>
                        <span className="font-heading font-bold text-xl tracking-tight text-white">
                            ESPACE <span className="text-[#FCD116]">CLIENT</span>
                        </span>
                    </Link>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-bold text-white">Kevin Akpotrossou</p>
                            <p className="text-[10px] text-[#FCD116] uppercase tracking-widest font-black">Membre Gold • Bénin</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center shadow-inner group cursor-pointer hover:border-[#FCD116]/50 transition-all">
                            <span className="font-heading font-bold text-[#FCD116]">K</span>
                        </div>
                        <button className="text-gray-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-400/10">
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 flex overflow-hidden">
                    {/* Sidebar Navigation */}
                    <DashboardNav />

                    {/* Page Content (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:pl-24 scrollbar-premium">
                        <div className="max-w-7xl mx-auto min-h-full pb-20">
                            {children}
                        </div>
                    </div>
                </main>
            </div>

            <style jsx global>{`
                .scrollbar-premium::-webkit-scrollbar { width: 4px; }
                .scrollbar-premium::-webkit-scrollbar-track { background: transparent; }
                .scrollbar-premium::-webkit-scrollbar-thumb { 
                    background: rgba(255, 255, 255, 0.05); 
                    border-radius: 10px;
                }
                .scrollbar-premium::-webkit-scrollbar-thumb:hover { 
                    background: rgba(252, 209, 22, 0.3); 
                }
            `}</style>
        </div>
    );
}
