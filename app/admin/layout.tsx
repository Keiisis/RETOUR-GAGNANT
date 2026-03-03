'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { Authenticated, useLogout, useGetIdentity } from '@refinedev/core'
import { usePathname, useRouter } from 'next/navigation'
import {
    LayoutDashboard, Settings, MessageSquare,
    ShieldCheck, LogOut, Bell,
    Menu, Globe, Sparkles, User, HelpCircle,
    ShoppingBag, Receipt, UserCog, Tag,
    Mail, FileText, Compass, X, PanelLeftClose, PanelLeft,
    BarChart3, FileSignature, FolderOpen, Palette
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { RefineContext } from '@/components/admin/refine-context'

function AdminLayoutContent({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    useRouter()
    const { mutate: logout } = useLogout()
    const { data: user } = useGetIdentity<{ email?: string }>()
    const [scrolled, setScrolled] = useState(false)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    const isLoginPage = pathname === '/admin/login'

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false)
    }, [pathname])

    const menuItems = [
        { title: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
        { title: 'Analytics', icon: BarChart3, href: '/admin/analytics' },
        { title: 'Frontend', icon: Palette, href: '/admin/frontend' },
        { title: 'Dossiers', icon: FileText, href: '/admin/dossiers' },
        { title: 'Leads Oracle', icon: Compass, href: '/admin/leads-oracle' },
        { title: 'Documents', icon: FolderOpen, href: '/admin/documents' },
        { title: 'Contrats', icon: FileSignature, href: '/admin/contrats' },
        { title: 'Demandes Nat.', icon: Globe, href: '/admin/nationalite' },
        { title: 'FAQ Nationalité', icon: HelpCircle, href: '/admin/nationalite/faq' },
        { title: 'Emails', icon: Mail, href: '/admin/email-templates' },
        { title: 'Boutique', icon: ShoppingBag, href: '/admin/boutique' },
        { title: 'Commandes', icon: Receipt, href: '/admin/orders' },
        { title: 'Coupons', icon: Tag, href: '/admin/coupons' },
        { title: 'Messages', icon: MessageSquare, href: '/admin/messages' },
        { title: 'Utilisateurs', icon: UserCog, href: '/admin/users' },
        { title: 'Réglages', icon: Settings, href: '/admin/settings' },
    ]

    if (isLoginPage) {
        return <>{children}</>
    }

    // ═══ Reusable Sidebar Content ═══
    const renderSidebarContent = (compact = false) => (
        <>
            {/* Header */}
            <div className={cn('relative', compact ? 'p-3 pb-4' : 'p-5 pb-6')}>
                <div className={cn('flex items-center', compact ? 'justify-center' : 'gap-3')}>
                    <div className="w-10 h-10 rounded-xl bg-benin-gradient p-0.5 flex-shrink-0 shadow-[0_0_20px_rgba(252,209,22,0.3)]">
                        <div className="w-full h-full bg-[#0a0f18] rounded-[10px] flex items-center justify-center">
                            <Globe size={20} className="text-[#FCD116]" />
                        </div>
                    </div>
                    {!compact && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="overflow-hidden whitespace-nowrap"
                        >
                            <h1 className="text-lg font-black font-heading tracking-tighter text-white">
                                KAGE <span className="text-[#FCD116]">ADMIN</span>
                            </h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em]">Secure Node</span>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-2.5 space-y-1 py-2 scrollbar-premium">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'group relative flex items-center gap-3 rounded-xl transition-all duration-200',
                                compact ? 'justify-center p-3' : 'px-3 py-2.5',
                                isActive
                                    ? 'bg-gradient-to-r from-[#FCD116]/15 to-transparent text-[#FCD116]'
                                    : 'text-gray-500 hover:bg-white/5 hover:text-white'
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="admin-sidebar-active"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-[#FCD116] shadow-[0_0_12px_rgba(252,209,22,0.6)]"
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                />
                            )}
                            <item.icon
                                size={18}
                                className={cn(
                                    'flex-shrink-0 transition-all',
                                    isActive ? 'text-[#FCD116]' : 'group-hover:text-[#FCD116]/70'
                                )}
                            />
                            {!compact && (
                                <span className="text-[13px] font-semibold truncate">
                                    {item.title}
                                </span>
                            )}
                        </Link>
                    )
                })}
            </nav>

            {/* Footer / User Profile */}
            <div className={cn('border-t border-white/5', compact ? 'p-2' : 'p-3')}>
                {!compact ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                            <div className="w-9 h-9 rounded-full bg-benin-gradient p-0.5 flex-shrink-0">
                                <div className="w-full h-full bg-[#0a0f18] rounded-full flex items-center justify-center">
                                    <User size={16} className="text-gray-400" />
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-xs font-bold text-white truncate">{user?.email?.split('@')[0] || 'Admin'}</p>
                                <p className="text-[9px] text-gray-400 font-mono uppercase truncate">Super User</p>
                            </div>
                        </div>
                        <button
                            onClick={() => logout()}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/8 rounded-lg transition-all group text-[11px] font-bold"
                        >
                            <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                            <span>DÉCONNEXION</span>
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-benin-gradient flex items-center justify-center text-white font-bold text-[10px]">
                            {user?.email?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <button onClick={() => logout()} title="Déconnexion" className="p-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/8 rounded-lg transition-all">
                            <LogOut size={16} />
                        </button>
                    </div>
                )}
            </div>
        </>
    )

    return (
        <Authenticated
            key="admin-auth"
            fallback={<LoginRedirect />}
        >
            <div className="flex h-screen bg-[#05080a] text-white font-sans overflow-hidden">
                {/* ═══════════ DESKTOP SIDEBAR ═══════════ */}
                <motion.aside
                    initial={false}
                    animate={{ width: isSidebarOpen ? 260 : 68 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="hidden lg:flex h-full bg-[#0a0f18] border-r border-white/5 flex-col relative z-50 overflow-hidden shadow-[10px_0_30px_rgba(0,0,0,0.5)]"
                >
                    <div className="absolute top-0 left-0 w-full h-[300px] bg-benin-gradient opacity-10 blur-[100px] pointer-events-none" />
                    {renderSidebarContent(!isSidebarOpen)}
                </motion.aside>

                {/* ═══════════ MOBILE SIDEBAR OVERLAY ═══════════ */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden"
                                onClick={() => setMobileMenuOpen(false)}
                            />
                            <motion.aside
                                initial={{ x: -320, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -320, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                className="fixed left-0 top-0 h-full w-[280px] bg-[#0a0f18] border-r border-white/5 flex flex-col z-[101] lg:hidden shadow-2xl"
                            >
                                <button
                                    onClick={() => setMobileMenuOpen(false)}
                                    title="Fermer le menu"
                                    className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5 text-gray-400 z-10"
                                >
                                    <X size={18} />
                                </button>
                                {renderSidebarContent(false)}
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                {/* ═══════════ MAIN CONTENT ═══════════ */}
                <main className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                        <div className="absolute top-[20%] left-[30%] w-[800px] h-[800px] bg-[#008751]/5 rounded-full blur-[150px]" />
                        <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-[#E8112D]/5 rounded-full blur-[120px]" />
                    </div>

                    {/* ═══ TOP NAVBAR ═══ */}
                    <header className={cn(
                        'h-14 lg:h-16 flex items-center px-4 lg:px-6 justify-between transition-all relative z-40',
                        'bg-[#05080a]/80 backdrop-blur-xl border-b border-white/5',
                        scrolled && 'shadow-[0_4px_30px_rgba(0,0,0,0.4)]'
                    )}>
                        <div className="flex items-center gap-3">
                            {/* Mobile hamburger */}
                            <button
                                onClick={() => setMobileMenuOpen(true)}
                                title="Ouvrir le menu"
                                className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 lg:hidden"
                            >
                                <Menu size={20} />
                            </button>

                            {/* Desktop sidebar toggle */}
                            <button
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="hidden lg:flex p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400"
                                title={isSidebarOpen ? 'Réduire' : 'Agrandir'}
                            >
                                {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                            </button>

                            <div className="hidden md:flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                Secure • 256-bit
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all">
                                <Bell size={17} />
                            </button>
                            <button className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all hidden sm:flex">
                                <HelpCircle size={17} />
                            </button>

                            {/* KAGE IA Button */}
                            <button className="flex items-center gap-1.5 bg-[#FCD116]/10 hover:bg-[#FCD116]/20 text-[#FCD116] border border-[#FCD116]/20 px-3 py-1.5 rounded-xl transition-all text-[10px] font-black tracking-widest">
                                <Sparkles size={14} className="animate-pulse" />
                                <span className="hidden sm:inline">KAGE IA</span>
                            </button>

                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full bg-benin-gradient flex items-center justify-center text-white font-bold text-[11px] shadow-lg cursor-pointer">
                                {user?.email?.charAt(0).toUpperCase() || 'A'}
                            </div>
                        </div>
                    </header>

                    {/* ═══ CONTENT ═══ */}
                    <div className="flex-1 overflow-y-auto relative z-10 scrollbar-premium">
                        <div className="p-4 lg:p-6 xl:p-8 max-w-[1600px] mx-auto pb-20">
                            <motion.div
                                key={pathname}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            >
                                {children}
                            </motion.div>
                        </div>
                    </div>
                </main>
            </div>
        </Authenticated>
    )
}

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
