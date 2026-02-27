'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { Authenticated, useLogout, useGetIdentity } from '@refinedev/core'
import { usePathname, useRouter } from 'next/navigation'
import {
    LayoutDashboard, Map, Settings, Users, MessageSquare,
    Image as ImageIcon, ShieldCheck, LogOut, Bell,
    Menu, Globe, Sparkles, User, HelpCircle,
    ShoppingBag, Receipt, UserCog, Tag,
    Flag, Mail, FileText, Compass
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { RefineContext } from '@/components/admin/refine-context'

function AdminLayoutContent({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const router = useRouter()
    const { mutate: logout } = useLogout()
    const { data: user } = useGetIdentity<any>()
    const [scrolled, setScrolled] = useState(false)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)

    const isLoginPage = pathname === '/admin/login'

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const menuItems = [
        { title: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
        { title: 'Dossiers', icon: FileText, href: '/admin/dossiers' },
        { title: 'Leads Oracle', icon: Compass, href: '/admin/leads-oracle' },
        { title: 'Patrimoine', icon: Map, href: '/admin/patrimoine' },
        { title: 'Services', icon: ShieldCheck, href: '/admin/services' },
        { title: 'Parcours', icon: Sparkles, href: '/admin/process-steps' },
        { title: 'Nationalité', icon: Flag, href: '/admin/nationality-requests' },
        { title: 'Emails', icon: Mail, href: '/admin/email-templates' },
        { title: 'Témoignages', icon: Users, href: '/admin/testimonials' },
        { title: 'Galerie', icon: ImageIcon, href: '/admin/gallery' },
        { title: 'Boutique', icon: ShoppingBag, href: '/admin/boutique' },
        { title: 'Commandes', icon: Receipt, href: '/admin/orders' },
        { title: 'Coupons', icon: Tag, href: '/admin/coupons' },
        { title: 'Messages', icon: MessageSquare, href: '/admin/messages' },
        { title: 'Utilisateurs', icon: UserCog, href: '/admin/users' },
        { title: 'Réglages', icon: Settings, href: '/admin/settings' },
    ]

    // Login page: render children directly (no sidebar/header)
    if (isLoginPage) {
        return <>{children}</>
    }

    // All other admin pages: protected with sidebar + header
    return (
        <Authenticated
            key="admin-auth"
            fallback={<LoginRedirect />}
        >
            <div className="flex h-screen bg-[#05080a] text-white font-sans overflow-hidden">
                {/* ═══════════════════════════════════════════ */}
                {/* SIDEBAR - KAGE CONTROL CENTER */}
                {/* ═══════════════════════════════════════════ */}
                <motion.aside
                    initial={false}
                    animate={{ width: isSidebarOpen ? 280 : 80 }}
                    className="h-full bg-[#0a0f18] border-r border-white/5 flex flex-col shadow-[10px_0_30px_rgba(0,0,0,0.5)] relative z-50 overflow-hidden"
                >
                    {/* Glow backgrounds */}
                    <div className="absolute top-0 left-0 w-full h-[300px] bg-benin-gradient opacity-10 blur-[100px] pointer-events-none" />

                    {/* Header */}
                    <div className="p-8 pb-10 relative">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-benin-gradient p-0.5 flex-shrink-0 shadow-[0_0_20px_rgba(252,209,22,0.3)]">
                                <div className="w-full h-full bg-[#0a0f18] rounded-[10px] flex items-center justify-center">
                                    <Globe size={20} className="text-[#FCD116]" />
                                </div>
                            </div>
                            {isSidebarOpen && (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="overflow-hidden whitespace-nowrap"
                                >
                                    <h1 className="text-xl font-black font-heading tracking-tighter text-white">
                                        KAGE <span className="text-[#FCD116]">ADMIN</span>
                                    </h1>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Secure Node</span>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto px-4 space-y-2 py-4">
                        {menuItems.map((item) => {
                            const isActive = pathname === item.href
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative',
                                        isActive
                                            ? 'bg-gradient-to-r from-[#FCD116]/20 to-transparent text-[#FCD116] border-l-2 border-[#FCD116]'
                                            : 'text-gray-500 hover:bg-white/5 hover:text-white'
                                    )}
                                >
                                    <item.icon size={22} className={cn('transition-transform duration-500 group-hover:scale-110', isActive && 'text-[#FCD116]')} />
                                    {isSidebarOpen && (
                                        <motion.span
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="font-bold tracking-wide text-sm"
                                        >
                                            {item.title}
                                        </motion.span>
                                    )}

                                    {isActive && isSidebarOpen && (
                                        <motion.div
                                            layoutId="active-pill"
                                            className="absolute right-4 w-1.5 h-1.5 rounded-full bg-[#FCD116] shadow-[0_0_10px_#FCD116]"
                                        />
                                    )}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Footer / User Profile */}
                    <div className="p-6 border-t border-white/5 bg-black/20">
                        {isSidebarOpen ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-benin-gradient p-0.5 flex-shrink-0">
                                        <div className="w-full h-full bg-[#0a0f18] rounded-[10px] flex items-center justify-center">
                                            <User size={18} className="text-gray-400" />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-sm font-bold text-white truncate">{user?.email?.split('@')[0] || 'Administrateur'}</p>
                                        <p className="text-[10px] text-gray-400 font-mono uppercase tracking-tighter truncate">Super User</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => logout()}
                                    className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all group font-bold text-xs"
                                >
                                    <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                                    <span>QUITTER LA SESSION</span>
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => logout()} className="w-full flex justify-center p-2 text-red-400 hover:bg-red-500/10 rounded-xl uppercase">
                                <LogOut size={20} />
                            </button>
                        )}
                    </div>
                </motion.aside>

                {/* ═══════════════════════════════════════════ */}
                {/* MAIN CONTENT AREA */}
                {/* ═══════════════════════════════════════════ */}
                <main className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Background Pattern and Ornaments */}
                    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                        <div className="absolute top-[20%] left-[30%] w-[800px] h-[800px] bg-[#008751]/5 rounded-full blur-[150px]" />
                        <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-[#E8112D]/5 rounded-full blur-[120px]" />
                        <div className="absolute inset-0 bg-[url('/images/pattern-benin.png')] bg-repeat opacity-[0.02]" />
                    </div>

                    {/* TOP NAVBAR */}
                    <header className={cn(
                        'h-20 border-b border-white/5 flex items-center px-10 justify-between transition-all relative z-40 bg-[#05080a]/80 backdrop-blur-xl',
                        scrolled && 'shadow-2xl'
                    )}>
                        <div className="flex items-center gap-8">
                            <button
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="p-2.5 rounded-xl hover:bg-white/5 transition-colors text-gray-400"
                            >
                                <Menu size={20} />
                            </button>

                            <div className="hidden md:flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/5">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                Connexion Chiffrée • 256-bit
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 group cursor-pointer mr-4">
                                <div className="p-2 rounded-full hover:bg-white/5 text-gray-400 group-hover:text-white transition-all">
                                    <Bell size={20} />
                                </div>
                                <div className="p-2 rounded-full hover:bg-white/5 text-gray-400 group-hover:text-white transition-all">
                                    <HelpCircle size={20} />
                                </div>
                            </div>

                            {/* IA Quick Access Action */}
                            <button className="flex items-center gap-2 bg-benin-gradient/10 hover:bg-benin-gradient/20 text-[#FCD116] border border-[#FCD116]/20 px-5 py-2.5 rounded-2xl transition-all shadow-lg hover:shadow-[#FCD116]/10">
                                <Sparkles size={18} className="animate-pulse" />
                                <span className="text-xs font-black tracking-widest">KAGE IA</span>
                            </button>
                        </div>
                    </header>

                    {/* CONTENT SCROLL AREA */}
                    <div className="flex-1 overflow-y-auto relative z-10 scrollbar-premium">
                        <div className="p-10 container mx-auto pb-20">
                            {children}
                        </div>
                    </div>
                </main>
            </div>
        </Authenticated>
    )
}

/**
 * Small component that redirects to /admin/login when user is not authenticated.
 * Used as the fallback for <Authenticated>.
 */
function LoginRedirect() {
    const router = useRouter()

    useEffect(() => {
        router.replace('/admin/login')
    }, [router])

    return (
        <div className="min-h-screen bg-[#05080a] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-benin-gradient p-0.5 shadow-[0_0_20px_rgba(252,209,22,0.3)]">
                    <div className="w-full h-full bg-[#05080a] rounded-[10px] flex items-center justify-center">
                        <ShieldCheck size={24} className="text-[#FCD116]" />
                    </div>
                </div>
                <p className="text-gray-500 text-sm font-bold uppercase tracking-widest animate-pulse">
                    Redirection...
                </p>
            </div>
        </div>
    )
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <Suspense fallback={null}>
            <RefineContext>
                <AdminLayoutContent>{children}</AdminLayoutContent>
            </RefineContext>
        </Suspense>
    )
}
