'use client';

import DashboardScene from '@/components/dashboard/3d/DashboardScene';
import DashboardNav from '@/components/dashboard/ui/DashboardNav';
import Link from 'next/link';
import { LogOut } from 'lucide-react';

export default function ClientDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="relative w-full h-screen overflow-hidden bg-[#05080a] text-white">
            {/* 1. The 3D Universe (Background) */}
            <DashboardScene />

            {/* 2. UI Overlay */}
            <div className="relative z-10 w-full h-full flex flex-col">
                {/* Header Minimaliste */}
                <header className="px-8 py-6 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
                    <Link href="/" className="flex flex-col">
                        <span className="font-heading font-bold text-xl tracking-tight text-[#008751]">
                            ESPACE <span className="text-[#FCD116]">CLIENT</span>
                        </span>
                    </Link>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-bold text-white">Bienvenue, Kevin</p>
                            <p className="text-xs text-[#FCD116]">Membre Gold</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/10 border border-[#FCD116] flex items-center justify-center">
                            <span className="font-heading font-bold">K</span>
                        </div>
                        <button className="text-gray-400 hover:text-red-400 transition-colors">
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 flex overflow-hidden">
                    {/* Sidebar Navigation */}
                    <DashboardNav />

                    {/* Page Content (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:pl-24 scroll-smooth">
                        <div className="max-w-7xl mx-auto min-h-full">
                            {children}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
