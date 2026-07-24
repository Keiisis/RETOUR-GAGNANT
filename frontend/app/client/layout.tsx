'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    LayoutDashboard, FileText, FolderOpen, MessageSquare,
    CalendarDays, UserCircle, LogOut, Menu, X, Bell,
    ChevronRight, CircleDot, Shield, Briefcase, FileSignature, GitFork, Receipt, Download
} from 'lucide-react'
import { ThemeProvider } from '@/lib/theme/ThemeContext'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

interface ClientProfile {
    id: string
    email: string
    nom: string | null
    prenom: string | null
    avatar_url: string | null
}

interface NavItem {
    title: string
    icon: React.ComponentType<{ size?: number; className?: string }>
    href: string
}

const NAV_ITEMS: NavItem[] = [
    { title: 'Tableau de Bord', icon: LayoutDashboard, href: '/client/dashboard' },
    { title: 'Mes Documents', icon: FileText, href: '/client/documents' },
    { title: 'Mon Dossier', icon: FolderOpen, href: '/client/dossier' },
    { title: 'Mon Plan de composition de Famille', icon: GitFork, href: '/client/genealogie' },
    { title: 'Mes Services', icon: Briefcase, href: '/client/services' },
    { title: 'Factures & Commandes', icon: Receipt, href: '/client/factures' },
    { title: 'Téléchargements', icon: Download, href: '/client/telechargements' },
    { title: 'Messages', icon: MessageSquare, href: '/client/messages' },
    { title: 'Notifications', icon: Bell, href: '/client/notifications' },
    { title: 'Rendez-vous', icon: CalendarDays, href: '/client/rendez-vous' },
    { title: 'Ma Signature', icon: FileSignature, href: '/client/signature' },
    { title: 'Mon Profil', icon: UserCircle, href: '/client/profil' },
    { title: 'Sécurité (2FA)', icon: Shield, href: '/client/securite' },
]

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const isAuthPage = pathname === '/client/login' || pathname === '/client/register' || pathname === '/client/reset-password' || pathname === '/client/auth-confirm'

    const [client, setClient] = useState<ClientProfile | null>(null)
    const [loading, setLoading] = useState(!isAuthPage)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [unreadMessages, setUnreadMessages] = useState(0)
    const [unreadNotifs, setUnreadNotifs] = useState(0)

    useEffect(() => {
        if (isAuthPage) return

        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) { window.location.href = '/client/login'; return }

            const { data: profile } = await supabase
                .from('client_profiles')
                .select('id, email, nom, prenom, avatar_url')
                .eq('id', session.user.id)
                .single()

            if (!profile) { window.location.href = '/client/login?error=no-profile'; return }

            setClient({ ...profile, email: session.user.email || profile.email || '' })
            setLoading(false)
        }

        checkAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') window.location.href = '/client/login'
        })
        return () => { subscription.unsubscribe() }
    }, [isAuthPage])

    // Fetch unread messages count + realtime subscription
    useEffect(() => {
        if (isAuthPage || !client) return

        const fetchUnread = async () => {
            const { count } = await supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .or(`client_id.eq.${client.id},email.eq.${client.email}`)
                .eq('lu', false)
            setUnreadMessages(count || 0)
        }

        fetchUnread()

        // Realtime: re-fetch unread count on any message change
        const channel = supabase
            .channel(`client-messages-${client.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages', filter: `client_id=eq.${client.id}` },
                () => fetchUnread()
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [client, isAuthPage])

    // Notifications non lues + realtime
    useEffect(() => {
        if (isAuthPage || !client) return
        const fetchNotifs = async () => {
            const { count } = await supabase
                .from('notifications')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', client.id)
                .eq('is_read', false)
            setUnreadNotifs(count || 0)
        }
        fetchNotifs()
        const channel = supabase
            .channel(`client-notifs-${client.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${client.id}` }, () => fetchNotifs())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [client, isAuthPage])

    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut()
        window.location.href = '/client/login'
    }, [])

    // Close mobile menu on route change
    useEffect(() => { setMobileOpen(false) }, [pathname])

    if (isAuthPage) return <>{children}</>

    if (loading) {
        return (
            <div className="min-h-screen bg-nexus-deep flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[2px]">
                        <div className="w-full h-full bg-nexus-deep rounded-[14px] flex items-center justify-center">
                            <Shield size={24} className="text-blue-400" />
                        </div>
                    </div>
                    <div className="h-1 w-28 rounded-full overflow-hidden bg-white/5">
                        <motion.div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                            initial={{ width: '0%' }} animate={{ width: '100%' }}
                            transition={{ duration: 1.8, ease: 'easeInOut' }} />
                    </div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-[0.3em] font-bold">Chargement...</p>
                </div>
            </div>
        )
    }

    const displayName = [client?.prenom, client?.nom].filter(Boolean).join(' ') || client?.email || 'Client'
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

    const SidebarContent = () => (
        <>
            {/* Header */}
            <div className="p-5 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-[0_0_16px_rgba(59,130,246,0.3)]">
                        <Shield size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-white">MON <span className="text-blue-400">ESPACE</span></h1>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em]">En ligne</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/client/dashboard' && pathname.startsWith(item.href))
                    const Icon = item.icon
                    const badge = item.href === '/client/messages' ? unreadMessages
                        : item.href === '/client/notifications' ? unreadNotifs : 0
                    return (
                        <Link key={item.href} href={item.href}
                            className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all duration-200 ${
                                isActive ? 'bg-blue-500/10 text-blue-400' : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-200'
                            }`}>
                            {isActive && (
                                <motion.div layoutId="client-sidebar-active"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.6)]"
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <Icon size={17} className={`flex-shrink-0 transition-colors ${isActive ? 'text-blue-400' : 'group-hover:text-blue-400/70'}`} />
                            <span className="text-[13px] font-semibold">{item.title}</span>
                            {badge > 0 && (
                                <span className="ml-auto min-w-[18px] h-[18px] text-[10px] font-bold rounded-full bg-blue-500 text-white flex items-center justify-center px-1">
                                    {badge}
                                </span>
                            )}
                        </Link>
                    )
                })}
            </nav>

            {/* Profile Footer */}
            <div className="p-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {initials}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-bold text-white truncate">{displayName}</p>
                        <p className="text-[9px] text-gray-500 truncate">{client?.email}</p>
                    </div>
                </div>
                <button onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-3 py-2 text-red-400/60 hover:text-red-400 hover:bg-red-500/8 rounded-lg transition-all text-[11px] font-bold">
                    <LogOut size={13} />
                    <span>DÉCONNEXION</span>
                </button>
            </div>
        </>
    )

    return (
        <ThemeProvider panel="client" defaultTheme="dark">
        <div className="flex h-screen text-white overflow-hidden" style={{ background: 'var(--panel-bg)', color: 'var(--panel-text)' }}>
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-[240px] h-full flex-col border-r relative z-40" style={{ background: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}>
                <div className="absolute top-0 left-0 w-full h-[200px] bg-gradient-to-b from-blue-500/[0.05] to-transparent pointer-events-none" />
                <SidebarContent />
            </aside>

            {/* Mobile overlay */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden"
                            onClick={() => setMobileOpen(false)} />
                        <motion.aside
                            initial={{ x: -280, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -280, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="fixed left-0 top-0 h-full w-[260px] border-r flex flex-col z-[101] lg:hidden"
                            style={{ background: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}>
                            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-gray-500">
                                <X size={17} />
                            </button>
                            <SidebarContent />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Main */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Topbar */}
                <header
                    className="h-14 flex items-center px-4 lg:px-6 justify-between backdrop-blur-xl border-b relative z-30"
                    style={{
                        background: 'color-mix(in srgb, var(--panel-bg) 80%, transparent)',
                        borderColor: 'var(--panel-border)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-white/5 text-gray-500 lg:hidden">
                            <Menu size={19} />
                        </button>
                        <div className="hidden md:flex items-center gap-1.5 text-xs">
                            <CircleDot size={10} className="text-blue-500" />
                            <span className="font-bold text-gray-500 uppercase tracking-[0.15em] text-[10px]">Espace Client</span>
                            <ChevronRight size={10} className="text-gray-600" />
                            <span className="text-gray-300 font-semibold text-[11px]">
                                {NAV_ITEMS.find(i => pathname === i.href || pathname.startsWith(i.href))?.title || 'Navigation'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <button className="relative p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-all">
                            <Bell size={16} />
                            {unreadMessages > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                        </button>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[11px]">
                            {initials}
                        </div>
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 lg:p-6 xl:p-8 max-w-[1400px] mx-auto">
                        <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                            {children}
                        </motion.div>
                    </div>
                </div>
            </main>
        </div>
        </ThemeProvider>
    )
}
