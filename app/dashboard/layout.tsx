'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import DashboardNav from '@/components/dashboard/ui/DashboardNav';
import Link from 'next/link';
import { LogOut, ShieldCheck, Menu, X } from 'lucide-react';
import { SkeletonLoader } from '@/components/ui/skeleton-loader';
import { motion, AnimatePresence } from 'framer-motion';

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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Close mobile menu on resize to desktop
    useEffect(() => {
        const handler = () => {
            if (window.innerWidth >= 768) setMobileMenuOpen(false);
        };
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);

    return (
        <div className="relative w-full h-screen overflow-hidden bg-[#05080a] text-white">
            {/* ═══════════════════════════════════════════ */}
            {/* 1. THE 3D UNIVERSE (DYNAMIC BACKGROUND) */}
            {/* ═══════════════════════════════════════════ */}
            <div className="hidden md:block">
                <DashboardScene />
            </div>
            {/* Mobile: gradient background instead of 3D */}
            <div className="md:hidden absolute inset-0 bg-gradient-to-br from-[#05080a] via-[#0a1628] to-[#05080a]">
                <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-[#FCD116]/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[10%] right-[10%] w-[200px] h-[200px] bg-[#008751]/5 rounded-full blur-[100px]" />
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* 2. UI OVERLAY */}
            {/* ═══════════════════════════════════════════ */}
            <div className="relative z-10 w-full h-full flex flex-col">
                {/* Header */}
                <header className="px-4 md:px-8 py-4 md:py-6 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent backdrop-blur-sm border-b border-white/5">
                    <div className="flex items-center gap-3">
                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setMobileMenuOpen(true)}
                            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 md:hidden"
                            title="Menu"
                        >
                            <Menu size={20} />
                        </button>

                        <Link href="/" className="flex items-center gap-2 md:gap-3 group">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-benin-gradient p-0.5 shadow-lg group-hover:scale-110 transition-transform">
                                <div className="w-full h-full bg-[#05080a] rounded-[9px] flex items-center justify-center">
                                    <ShieldCheck size={16} className="text-[#FCD116] md:w-5 md:h-5" />
                                </div>
                            </div>
                            <span className="font-heading font-bold text-base md:text-xl tracking-tight text-white">
                                ESPACE <span className="text-[#FCD116]">CLIENT</span>
                            </span>
                        </Link>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-bold text-white">Kevin Akpotrossou</p>
                            <p className="text-[10px] text-[#FCD116] uppercase tracking-widest font-black">Membre Gold • Bénin</p>
                        </div>
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center shadow-inner group cursor-pointer hover:border-[#FCD116]/50 transition-all">
                            <span className="font-heading font-bold text-[#FCD116] text-sm md:text-base">K</span>
                        </div>
                        <button className="text-gray-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-400/10">
                            <LogOut size={18} />
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 flex overflow-hidden">
                    {/* Desktop Sidebar Navigation */}
                    <div className="hidden md:block">
                        <DashboardNav />
                    </div>

                    {/* Mobile Sidebar Overlay */}
                    <AnimatePresence>
                        {mobileMenuOpen && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
                                    onClick={() => setMobileMenuOpen(false)}
                                />
                                <motion.div
                                    initial={{ x: -320, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: -320, opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    className="fixed left-0 top-0 h-full w-[280px] bg-[#0a0f18] border-r border-white/5 z-[101] md:hidden shadow-2xl"
                                >
                                    <div className="flex items-center justify-between p-4 border-b border-white/5">
                                        <span className="font-heading font-bold text-sm text-white">
                                            NAVIGATION
                                        </span>
                                        <button
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="p-2 rounded-lg hover:bg-white/5 text-gray-400"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="p-2">
                                        <DashboardNav onNavigate={() => setMobileMenuOpen(false)} />
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

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
