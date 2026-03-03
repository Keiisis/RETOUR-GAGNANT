'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard, FileText, MessageSquare, Users as UsersIcon,
    Compass, CalendarDays, FolderOpen, Send, LogOut,
    Menu, Bell, Search, Headphones, X,
    TrendingUp, BookOpen, CircleDot, ChevronRight,
    Shield, PanelLeftClose, PanelLeft,
    Command, UserCog, Globe
} from 'lucide-react'

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

interface AgentProfile {
    id: string
    email: string
    full_name: string
    role: string
    avatar_url?: string
}

interface NavItem {
    title: string
    icon: React.ComponentType<{ size?: number; className?: string }>
    href: string
    badge?: number
}

interface NavSection {
    label: string
    items: NavItem[]
}

// ═══════════════════════════════════════════
// Animation variants
// ═══════════════════════════════════════════

const sidebarItemVariants = {
    hidden: { opacity: 0, x: -8 },
    visible: (i: number) => ({
        opacity: 1, x: 0,
        transition: { delay: i * 0.03, duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }
    }),
}

const mobileOverlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
}

const mobileSidebarVariants = {
    hidden: { x: -320, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
    exit: { x: -320, opacity: 0, transition: { duration: 0.2 } },
}

// ═══════════════════════════════════════════
// Inactivity auto-logout (30 min)
// ═══════════════════════════════════════════

const INACTIVITY_TIMEOUT = 30 * 60 * 1000

const useInactivityLogout = (onLogout: () => void) => {
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>

        const resetTimer = () => {
            clearTimeout(timeout)
            timeout = setTimeout(onLogout, INACTIVITY_TIMEOUT)
        }

        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
        events.forEach((e) => window.addEventListener(e, resetTimer))
        resetTimer()

        return () => {
            clearTimeout(timeout)
            events.forEach((e) => window.removeEventListener(e, resetTimer))
        }
    }, [onLogout])
}

// ═══════════════════════════════════════════
// Main Layout
// ═══════════════════════════════════════════

export default function AgentLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    const [agent, setAgent] = useState<AgentProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const [notifOpen, setNotifOpen] = useState(false)

    // Unread Counters
    const [unreadMessages, setUnreadMessages] = useState(0)
    const [unreadVoices, setUnreadVoices] = useState(0)

    const isLoginPage = pathname === '/agent/login'

    // ─── Scroll detection ───
    useEffect(() => {
        const el = document.getElementById('agent-content-scroll')
        if (!el) return
        const handleScroll = () => setScrolled(el.scrollTop > 20)
        el.addEventListener('scroll', handleScroll)
        return () => el.removeEventListener('scroll', handleScroll)
    }, [loading])

    // ─── Auth check ───
    useEffect(() => {
        if (isLoginPage) {
            setLoading(false)
            return
        }

        const checkAuth = async () => {
            // Utilise getSession() — lit les cookies locaux, rapide et fiable
            const { data: { session } } = await supabase.auth.getSession()

            if (!session || !session.user) {
                window.location.href = '/agent/login'
                return
            }

            const user = session.user

            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('id, role, full_name, avatar_url')
                .eq('id', user.id)
                .single()

            if (profileError || !profile) {
                // RLS bloque ou profil inexistant → fallback, le middleware a déjà validé
                setAgent({
                    id: user.id,
                    email: user.email || '',
                    full_name: 'Agent',
                    role: 'agent',
                })
                setLoading(false)
                return
            }

            // Agents et admins peuvent accéder à l'espace agent
            if (profile.role !== 'agent' && profile.role !== 'admin') {
                await supabase.auth.signOut()
                window.location.href = '/agent/login?error=unauthorized'
                return
            }

            setAgent({
                id: user.id,
                email: user.email || '',
                full_name: profile.full_name || 'Agent',
                role: profile.role,
                avatar_url: profile.avatar_url,
            })
            setLoading(false)
        }

        checkAuth()

        // Écoute les changements de session (expiration, déconnexion depuis un autre onglet)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                if (event === 'SIGNED_OUT') {
                    window.location.href = '/agent/login'
                }
            }
        })

        return () => { subscription.unsubscribe() }
    }, [isLoginPage])


    // ─── Heartbeat: real-time presence tracking ───
    useEffect(() => {
        if (isLoginPage || !agent?.id) return

        const agentId = agent.id

        const sendHeartbeat = async () => {
            // 1) Essai via l'API (Service Role Key → bypass RLS garanti)
            const apiOk = await fetch('/api/agent/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: agentId }),
            }).then(r => r.ok).catch(() => false)

            // 2) Fallback : client browser (si API indispo — dev local sans serveur)
            if (!apiOk) {
                const { error } = await supabase
                    .from('user_profiles')
                    .update({ last_seen_at: new Date().toISOString() })
                    .eq('id', agentId)
                if (error) {
                    console.warn('[Heartbeat] browser client également en échec:', error.message)
                }
            }
        }

        sendHeartbeat() // Send immediately on load
        const interval = setInterval(sendHeartbeat, 30_000) // Every 30s (était 60s)

        return () => clearInterval(interval)
    }, [isLoginPage, agent?.id])

    // ─── Realtime Unread Counts ───
    useEffect(() => {
        if (isLoginPage) return

        // Initial fetch
        const fetchUnread = async () => {
            const [msgRes, voiceRes] = await Promise.all([
                supabase.from('messages').select('id', { count: 'exact' }).eq('lu', false),
                supabase.from('voice_messages').select('id', { count: 'exact' }).eq('is_read', false)
            ])
            setUnreadMessages(msgRes.count || 0)
            setUnreadVoices(voiceRes.count || 0)
        }

        fetchUnread()

        // Realtime Subscription
        const channel = supabase.channel('agent_layout_badges')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchUnread)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_messages' }, fetchUnread)
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [isLoginPage])

    // ─── Logout ───
    const handleLogout = useCallback(async () => {
        // Clear last_seen_at on logout
        if (agent?.id) {
            await supabase
                .from('user_profiles')
                .update({ last_seen_at: null })
                .eq('id', agent.id)
        }
        await supabase.auth.signOut()
        window.location.href = '/agent/login'
    }, [agent?.id])


    // ─── Inactivity auto-logout ───
    useInactivityLogout(handleLogout)

    // ─── Keyboard shortcut (Ctrl+K for search) ───
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setSearchOpen((prev) => !prev)
            }
            if (e.key === 'Escape') {
                setSearchOpen(false)
                setNotifOpen(false)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // ─── Close mobile menu on route change ───
    useEffect(() => {
        setMobileMenuOpen(false)
    }, [pathname])

    // Login page: no shell
    if (isLoginPage) return <>{children}</>

    // Loading
    if (loading) {
        return (
            <div className="min-h-screen bg-nexus-deep flex items-center justify-center">
                <div className="flex flex-col items-center gap-5">
                    <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-[2px] animate-nexus-glow">
                            <div className="w-full h-full bg-nexus-deep rounded-[14px] flex items-center justify-center">
                                <Shield size={28} className="text-emerald-400" />
                            </div>
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 animate-nexus-pulse" />
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="h-1.5 w-32 rounded-full overflow-hidden bg-white/5">
                            <motion.div
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                                initial={{ width: '0%' }}
                                animate={{ width: '100%' }}
                                transition={{ duration: 2, ease: 'easeInOut' }}
                            />
                        </div>
                        <p className="text-nexus-text-muted text-xs font-bold uppercase tracking-[0.3em]">
                            Sécurisation...
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    const menuSections: NavSection[] = [
        {
            label: 'PRINCIPAL',
            items: [
                { title: 'Tableau de Bord', icon: LayoutDashboard, href: '/agent' },
                { title: 'Mes Dossiers', icon: FileText, href: '/agent/dossiers' },
                { title: 'Leads Oracle', icon: Compass, href: '/agent/leads' },
                { title: 'Demandes Nat.', icon: Globe, href: '/agent/nationalite' },
            ],
        },
        {
            label: 'COMMUNICATION',
            items: [
                { title: 'Messages', icon: MessageSquare, href: '/agent/messages', badge: unreadMessages },
                { title: 'Vocaux', icon: Headphones, href: '/agent/vocaux', badge: unreadVoices },
            ],
        },
        {
            label: 'ORGANISATION',
            items: [
                { title: 'Agenda', icon: CalendarDays, href: '/agent/agenda' },
                { title: 'Documents', icon: FolderOpen, href: '/agent/documents' },
                { title: 'Clients', icon: UsersIcon, href: '/agent/clients' },
            ],
        },
        {
            label: 'OUTILS',
            items: [
                { title: 'Devis & Paiements', icon: Send, href: '/agent/devis' },
                { title: 'Performances', icon: TrendingUp, href: '/agent/performances' },
                { title: 'Base de Connaissance', icon: BookOpen, href: '/agent/wiki' },
            ],
        },
        {
            label: 'COMPTE',
            items: [
                { title: 'Mon Profil', icon: UserCog, href: '/agent/profil' },
            ],
        },
    ]

    const currentPageTitle = menuSections.flatMap(s => s.items).find(i => i.href === pathname)?.title || 'Navigation'

    // ─── Sidebar Navigation Item ───
    const NavLink = ({ item, index, compact = false }: { item: NavItem; index: number; compact?: boolean }) => {
        const isActive = pathname === item.href
        const Icon = item.icon

        return (
            <motion.div
                custom={index}
                initial="hidden"
                animate="visible"
                variants={sidebarItemVariants}
            >
                <Link
                    href={item.href}
                    className={cn(
                        'group relative flex items-center gap-3 rounded-xl transition-all duration-200',
                        compact ? 'justify-center p-3' : 'px-3.5 py-2.5',
                        isActive
                            ? 'bg-nexus-accent-soft text-emerald-400'
                            : 'text-nexus-text-muted hover:bg-white/[0.04] hover:text-nexus-text-secondary'
                    )}
                    title={compact ? item.title : undefined}
                >
                    {/* Active glow line */}
                    {isActive && (
                        <motion.div
                            layoutId="agent-sidebar-active"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                    )}

                    <Icon
                        size={18}
                        className={cn(
                            'flex-shrink-0 transition-all duration-200',
                            isActive
                                ? 'text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                                : 'group-hover:text-emerald-400/70'
                        )}
                    />

                    {!compact && (
                        <span className="text-[13px] font-semibold truncate">
                            {item.title}
                        </span>
                    )}

                    {/* Badge */}
                    {item.badge && item.badge > 0 && (
                        <span className={cn(
                            'flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold rounded-full bg-emerald-500 text-white',
                            compact ? 'absolute -top-0.5 -right-0.5' : 'ml-auto'
                        )}>
                            {item.badge}
                        </span>
                    )}
                </Link>
            </motion.div>
        )
    }

    // ═══ Render Sidebar Content ═══
    const renderSidebarContent = (compact = false) => (
        <>
            {/* Header */}
            <div className={cn('relative', compact ? 'p-3 pb-4' : 'p-5 pb-6')}>
                <div className={cn('flex items-center', compact ? 'justify-center' : 'gap-3')}>
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-[1.5px] flex-shrink-0 shadow-nexus-glow">
                        <div className="w-full h-full bg-nexus-deep rounded-[10px] flex items-center justify-center">
                            <Shield size={18} className="text-emerald-400" />
                        </div>
                    </div>
                    {!compact && (
                        <motion.div
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="overflow-hidden"
                        >
                            <h1 className="text-sm font-black font-heading tracking-tight text-white leading-none">
                                BUREAU <span className="text-emerald-400">AGENT</span>
                            </h1>
                            <div className="flex items-center gap-1.5 mt-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-nexus-pulse" />
                                <span className="text-[9px] text-nexus-text-muted font-bold uppercase tracking-[0.2em]">
                                    En Ligne
                                </span>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-2.5 space-y-5 py-1 nexus-scrollbar">
                {menuSections.map((section) => (
                    <div key={section.label}>
                        {!compact && (
                            <p className="text-[9px] font-bold text-nexus-text-muted uppercase tracking-[0.25em] px-3.5 mb-1.5">
                                {section.label}
                            </p>
                        )}
                        {compact && <div className="h-px bg-nexus-border-subtle mx-2 my-2" />}
                        <div className="space-y-0.5">
                            {section.items.map((item, idx) => (
                                <NavLink key={item.href} item={item} index={idx} compact={compact} />
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Agent Profile Footer */}
            <div className={cn('border-t border-nexus-border-subtle', compact ? 'p-2' : 'p-3')}>
                {!compact ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-nexus-border-subtle">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow-nexus-glow">
                                {agent?.full_name?.charAt(0).toUpperCase() || 'A'}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-xs font-bold text-white truncate">
                                    {agent?.full_name || 'Agent'}
                                </p>
                                <p className="text-[9px] text-nexus-text-muted font-mono uppercase truncate">
                                    {agent?.role === 'admin' ? 'Admin / Agent' : 'Agent Terrain'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/8 rounded-lg transition-all group text-[11px] font-bold"
                        >
                            <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                            <span>DÉCONNEXION</span>
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2 flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-[10px]">
                            {agent?.full_name?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <button
                            onClick={handleLogout}
                            title="Déconnexion"
                            className="p-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/8 rounded-lg transition-all"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                )}
            </div>
        </>
    )

    return (
        <div className="flex h-screen bg-nexus-deep text-white font-sans overflow-hidden">
            {/* ═══════════ DESKTOP SIDEBAR ═══════════ */}
            <motion.aside
                initial={false}
                animate={{ width: sidebarOpen ? 260 : 68 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="hidden lg:flex h-full glass-nexus-sidebar flex-col relative z-50 overflow-hidden"
            >
                {/* Glow ambient light */}
                <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-emerald-500/[0.07] to-transparent blur-[60px] pointer-events-none" />

                {renderSidebarContent(!sidebarOpen)}
            </motion.aside>

            {/* ═══════════ MOBILE SIDEBAR OVERLAY ═══════════ */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        <motion.div
                            variants={mobileOverlayVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="fixed inset-0 glass-nexus-overlay z-[100] lg:hidden"
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        <motion.aside
                            variants={mobileSidebarVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="fixed left-0 top-0 h-full w-[280px] glass-nexus-sidebar flex flex-col z-[101] lg:hidden"
                        >
                            <button
                                onClick={() => setMobileMenuOpen(false)}
                                title="Fermer le menu"
                                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5 text-nexus-text-muted"
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
                {/* Background Ambiance */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-[10%] left-[20%] w-[800px] h-[800px] bg-emerald-500/[0.03] rounded-full blur-[200px] animate-orb-1" />
                    <div className="absolute bottom-[5%] right-[5%] w-[600px] h-[600px] bg-teal-500/[0.03] rounded-full blur-[180px] animate-orb-2" />
                </div>

                {/* ═══ TOP NAVBAR ═══ */}
                <header className={cn(
                    'h-14 flex items-center px-4 lg:px-6 justify-between transition-all relative z-40',
                    'bg-nexus-deep/80 backdrop-blur-xl border-b border-nexus-border-subtle',
                    scrolled && 'shadow-[0_4px_30px_rgba(0,0,0,0.4)]'
                )}>
                    <div className="flex items-center gap-3">
                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setMobileMenuOpen(true)}
                            title="Ouvrir le menu"
                            className="p-2 rounded-lg hover:bg-white/5 transition-colors text-nexus-text-muted lg:hidden"
                        >
                            <Menu size={20} />
                        </button>

                        {/* Desktop sidebar toggle */}
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="hidden lg:flex p-2 rounded-lg hover:bg-white/5 transition-colors text-nexus-text-muted"
                            title={sidebarOpen ? 'Réduire' : 'Agrandir'}
                        >
                            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                        </button>

                        {/* Breadcrumb */}
                        <div className="hidden md:flex items-center gap-1.5 text-xs">
                            <CircleDot size={10} className="text-emerald-500" />
                            <span className="font-bold text-nexus-text-muted uppercase tracking-[0.15em] text-[10px]">Bureau</span>
                            <ChevronRight size={10} className="text-nexus-text-muted" />
                            <span className="text-nexus-text-secondary font-semibold text-[11px]">
                                {currentPageTitle}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Search trigger */}
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-white/[0.03] border border-nexus-border-subtle hover:bg-white/[0.05] hover:border-nexus-border-default transition-all text-nexus-text-muted"
                        >
                            <Search size={13} />
                            <span className="hidden lg:inline text-[11px]">Rechercher...</span>
                            <kbd className="hidden lg:inline text-[9px] font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                                ⌘K
                            </kbd>
                        </button>

                        {/* Notifications */}
                        <div className="relative">
                            <button
                                onClick={() => setNotifOpen(!notifOpen)}
                                className="relative p-2 rounded-lg hover:bg-white/5 text-nexus-text-muted hover:text-white transition-all"
                                title="Notifications"
                            >
                                <Bell size={17} />
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                            </button>

                            {/* Notifications dropdown */}
                            <AnimatePresence>
                                {notifOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 top-full mt-2 w-72 glass-nexus-card p-4 shadow-nexus-elevated z-50"
                                    >
                                        <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                                            <Bell size={12} className="text-emerald-400" />
                                            Notifications
                                        </h4>
                                        <p className="text-[11px] text-nexus-text-muted text-center py-4">
                                            Aucune notification récente
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Agent Avatar */}
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-[11px] shadow-nexus-glow cursor-pointer">
                            {agent?.full_name?.charAt(0).toUpperCase() || 'A'}
                        </div>
                    </div>
                </header>

                {/* ═══ SEARCH OVERLAY ═══ */}
                <AnimatePresence>
                    {searchOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 glass-nexus-overlay z-[200]"
                                onClick={() => setSearchOpen(false)}
                            />
                            <motion.div
                                initial={{ opacity: 0, y: -20, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -20, scale: 0.96 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                className="fixed left-1/2 -translate-x-1/2 top-[15%] w-full max-w-lg z-[201]"
                            >
                                <div className="glass-nexus-card p-4 mx-4 shadow-nexus-elevated">
                                    <div className="flex items-center gap-3 mb-3">
                                        <Command size={16} className="text-emerald-400" />
                                        <input
                                            type="text"
                                            placeholder="Rechercher un dossier, client, commande..."
                                            autoFocus
                                            className="flex-1 bg-transparent text-sm text-white placeholder:text-nexus-text-muted focus:outline-none"
                                        />
                                        <kbd className="text-[9px] font-mono text-nexus-text-muted bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                                            ESC
                                        </kbd>
                                    </div>
                                    <div className="border-t border-nexus-border-subtle pt-3">
                                        <p className="text-[10px] text-nexus-text-muted uppercase tracking-wider font-bold mb-2">Accès rapide</p>
                                        <div className="space-y-1">
                                            {[
                                                { icon: FileText, label: 'Dossiers', href: '/agent/dossiers' },
                                                { icon: Compass, label: 'Leads Oracle', href: '/agent/leads' },
                                                { icon: MessageSquare, label: 'Messages', href: '/agent/messages' },
                                                { icon: CalendarDays, label: 'Agenda', href: '/agent/agenda' },
                                            ].map((item) => (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={() => setSearchOpen(false)}
                                                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-nexus-text-secondary hover:text-white transition-all text-[12px]"
                                                >
                                                    <item.icon size={14} className="text-emerald-400/60" />
                                                    <span>{item.label}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* ═══ CONTENT ═══ */}
                <div
                    id="agent-content-scroll"
                    className="flex-1 overflow-y-auto relative z-10 nexus-scrollbar"
                >
                    <div className="p-4 lg:p-6 xl:p-8 max-w-[1600px] mx-auto">
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
    )
}
