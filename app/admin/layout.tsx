'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Map, Settings, Users, MessageSquare, Image as ImageIcon, ShieldCheck, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    const menuItems = [
        { title: 'Tableau de Bord', icon: LayoutDashboard, href: '/admin' },
        { title: 'Patrimoine', icon: Map, href: '/admin/patrimoine' },
        { title: 'Services', icon: ShieldCheck, href: '/admin/services' },
        { title: 'Témoignages', icon: Users, href: '/admin/testimonials' },
        { title: 'Galerie', icon: ImageIcon, href: '/admin/gallery' },
        { title: 'Messages', icon: MessageSquare, href: '/admin/messages' },
        { title: 'Configuration', icon: Settings, href: '/admin/settings' },
    ];

    return (
        <div className="flex h-screen bg-[#0f141e] text-white font-sans overflow-hidden">
            {/* Sidebar - "KAGE" Panel Style */}
            <aside className="w-64 bg-[#05080a] border-r border-[#FCD116]/20 flex flex-col shadow-2xl relative z-20">
                {/* Header Imposant */}
                <div className="p-6 border-b border-[#FCD116]/10 bg-benin-gradient relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-0"></div>
                    <div className="relative z-10">
                        <h1 className="text-2xl font-bold font-heading tracking-wider text-white">
                            KAGE <span className="text-[#FCD116]">ADMIN</span>
                        </h1>
                        <p className="text-[#FCD116]/80 text-xs uppercase tracking-[0.2em] mt-1">Zone de Contrôle</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group relative overflow-hidden",
                                    isActive
                                        ? "bg-[#FCD116]/10 text-[#FCD116] border-l-4 border-[#FCD116]"
                                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                                )}
                            >
                                <item.icon size={20} className={cn("transition-transform duration-300", isActive && "scale-110")} />
                                <span className="font-medium tracking-wide">{item.title}</span>

                                {isActive && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-[#FCD116]/5 to-transparent pointer-events-none" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* User / Logout */}
                <div className="p-4 border-t border-white/5">
                    <button className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors group">
                        <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium">Déconnexion</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-[#0f141e] relative">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('/images/pattern-benin.png')] bg-repeat opacity-[0.03]" />

                <div className="p-8 relative z-10">
                    {children}
                </div>
            </main>
        </div>
    );
}
