'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, Folder, CreditCard, User, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CLIENT_THEME } from '@/lib/theme/client-theme';

const navItems = [
    { name: 'Vue du Roi', href: '/dashboard', icon: Home, color: CLIENT_THEME.colors.primary },
    { name: 'Mes Dossiers', href: '/dashboard/projects', icon: Folder, color: CLIENT_THEME.colors.secondary },
    { name: 'Documents', href: '/dashboard/documents', icon: CreditCard, color: CLIENT_THEME.colors.accent },
    { name: 'Conciergerie', href: '/dashboard/concierge', icon: MessageCircle, color: '#3b82f6' },
    { name: 'Mon Profil', href: '/dashboard/profile', icon: User, color: CLIENT_THEME.colors.text },
];

export default function DashboardNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed left-6 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col gap-6">
            {navItems.map((item, i) => {
                const isActive = pathname === item.href;

                return (
                    <Link key={item.href} href={item.href} className="group relative">
                        {/* Tooltip Label (appear on hover) */}
                        <span className="absolute left-16 top-1/2 -translate-y-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 pointer-events-none">
                            {item.name}
                        </span>

                        {/* 3D Button Container */}
                        <div className="relative w-12 h-12 perspective-500">
                            <motion.div
                                className={cn(
                                    "w-full h-full rounded-xl flex items-center justify-center border transition-all duration-300 shadow-xl",
                                    isActive
                                        ? "bg-white/10 border-[#FCD116] shadow-[0_0_15px_rgba(252,209,22,0.3)]"
                                        : "bg-black/40 border-white/10 hover:border-white/30"
                                )}
                                whileHover={{
                                    scale: 1.1,
                                    rotateX: 10,
                                    rotateY: -10,
                                    z: 20
                                }}
                                style={{ transformStyle: 'preserve-3d' }}
                            >
                                <item.icon
                                    size={20}
                                    style={{ color: isActive ? item.color : '#8899a6' }}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />

                                {/* Inner Glow for active state */}
                                {isActive && (
                                    <div className="absolute inset-0 rounded-xl bg-[#FCD116]/10 blur-md -z-10" />
                                )}
                            </motion.div>
                        </div>
                    </Link>
                );
            })}
        </nav>
    );
}
