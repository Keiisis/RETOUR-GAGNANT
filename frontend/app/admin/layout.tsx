'use client'

import { useTranslation, T } from '@/lib/translation';
import { Suspense } from 'react'
import Link from 'next/link'
import { Authenticated, useLogout, useGetIdentity } from '@refinedev/core'
import { usePathname, useRouter } from 'next/navigation'
import { SquaresFour as LayoutDashboard, Gear as Settings, ChatText as MessageSquare, ShieldCheck, SignOut as LogOut, Bell, List as Menu, Globe, Sparkle as Sparkles, User, Question as HelpCircle, ShoppingBag, Receipt, UserGear as UserCog, Tag, Calculator, Envelope as Mail, FileText, Compass, X, Sidebar as PanelLeftClose, SidebarSimple as PanelLeft, ChartBar as BarChart3, FileText as FileSignature, FolderOpen, Palette, Calendar, Star, Translate as Languages, Crosshair as Radar, Cube as Box, Coins, Megaphone, Pulse as Activity, StackSimple as Layers, Bank as Landmark, Buildings as Building2, ShieldWarning as ShieldAlert, Key as KeyRound, GitFork, PaperPlaneTilt as Send, MagnifyingGlass as Search, Car } from '@phosphor-icons/react';
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { RefineContext } from '@/components/admin/refine-context'
import { supabase } from '@/lib/supabase'
import { ThemeProvider } from '@/lib/theme/ThemeContext'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

function AdminLayoutContent({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const router = useRouter()
    const { mutate: logout } = useLogout()
    const { data: user } = useGetIdentity<{ email?: string }>()
    const { t } = useTranslation()
    const [scrolled, setScrolled] = useState(false)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    const isLoginPage = pathname === '/admin/login'

    // ─── Vérification rôle côté client (défense en profondeur) ──────
    // Le middleware bloque déjà les non-admins, mais on revérifie ici
    // pour éviter toute fuite si le middleware est contourné.
    useEffect(() => {
        if (isLoginPage) return
        const checkRole = async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (!authUser) { router.push('/admin/login'); return }

            const { data: profile } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', authUser.id)
                .maybeSingle()

            const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin']
            if (!profile || !ADMIN_ROLES.includes(profile.role)) {
                await supabase.auth.signOut()
                router.push('/admin/login?error=unauthorized')
                return
            }

            // Mettre à jour last_seen_at (sans attendre)
            fetch('/api/admin/ping', { method: 'POST' }).catch(() => {})
        }
        checkRole()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoginPage])

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // (Removed useEffect that was closing menu to avoid cascading render warning. 
    // Now Handled directly in menu onClick below).

    // Unread Counters
    const [unreadMessages, setUnreadMessages] = useState(0)
    const [unreadNotifications, setUnreadNotifications] = useState(0)
    const [relancesDue, setRelancesDue] = useState(0)
    const [rdvEnAttente, setRdvEnAttente] = useState(0)

    useEffect(() => {
        if (isLoginPage) return

        // Initial fetch
        const fetchUnread = async () => {
            const [msgRes, notifRes] = await Promise.all([
                supabase.from('messages').select('id', { count: 'exact' }).eq('lu', false).neq('type', 'nationality'),
                supabase.from('messages').select('id', { count: 'exact' }).eq('lu', false).eq('type', 'nationality'),
            ])
            setUnreadMessages(msgRes.count || 0)
            setUnreadNotifications(notifRes.count || 0)
        }

        // RDV en attente de traitement (badge sur « Rendez-vous »)
        const fetchRdv = async () => {
            const { count } = await supabase
                .from('rdv_requests').select('id', { count: 'exact', head: true })
                .eq('statut', 'en_attente')
            setRdvEnAttente(count || 0)
        }

        // Relances Classement Client à faire (badge)
        const fetchRelances = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                const res = await fetch('/api/agent/classement/count', {
                    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
                    cache: 'no-store',
                })
                if (res.ok) { const j = await res.json(); setRelancesDue(j.due || 0) }
            } catch { /* silencieux */ }
        }

        fetchUnread()
        fetchRelances()
        fetchRdv()

        // Realtime Subscription
        const channel = supabase.channel('admin_layout_badges')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchUnread)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rdv_requests' }, fetchRdv)
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [isLoginPage])

    const menuItems = [
        { title: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
        { title: 'Recherche', icon: Search, href: '/admin/recherche' },
        { title: 'Radar IA', icon: Radar, href: '/admin/radar' },
        { title: 'Smart Slides', icon: Sparkles, href: '/admin/proposals' },
        { title: 'Événements', icon: Calendar, href: '/admin/evenements' },
        { title: 'Sponsors', icon: Star, href: '/admin/sponsors' },
        { title: 'Analytics', icon: BarChart3, href: '/admin/analytics' },
        { title: 'Visiteurs Live', icon: Activity, href: '/admin/analytics-live' },
        { title: 'Frontend', icon: Palette, href: '/admin/frontend' },
        { title: 'Grille Tarifaire', icon: Layers, href: '/admin/grille-tarifaire' },
        { title: 'Prêtres Fa', icon: Sparkles, href: '/admin/pretres-fa' },
        { title: 'Auto-écoles', icon: Car, href: '/admin/auto-ecoles' },
        { title: 'Rendez-vous', icon: Calendar, href: '/admin/rendez-vous', badge: rdvEnAttente },
        { title: 'Disponibilités', icon: Calendar, href: '/admin/disponibilites' },
        { title: 'Dossiers', icon: FileText, href: '/admin/dossiers' },
        { title: 'Leads Oracle', icon: Compass, href: '/admin/leads-oracle' },
        { title: 'Classement Client', icon: BarChart3, href: '/admin/classement-client', badge: relancesDue },
        { title: 'Documents', icon: FolderOpen, href: '/admin/documents' },
        { title: 'Contrats', icon: FileSignature, href: '/admin/contrats' },
        { title: 'Demandes Nat.', icon: Globe, href: '/admin/nationalite' },
        { title: 'Plan de composition de Famille', icon: GitFork, href: '/admin/genealogie' },
        { title: 'FAQ Nationalité', icon: HelpCircle, href: '/admin/nationalite/faq' },

        { title: 'Emails', icon: Mail, href: '/admin/email-templates' },
        { title: 'Newsletter', icon: Megaphone, href: '/admin/newsletter' },
        { title: 'Comptabilité', icon: Landmark, href: '/admin/comptabilite' },
        { title: 'Facturation (ERP)', icon: Calculator, href: '/admin/facturation' },
        { title: 'Liens de Paiement', icon: Send, href: '/admin/liens-paiement' },
        { title: 'Inventaire', icon: Box, href: '/admin/inventory' },
        { title: 'Boutique', icon: ShoppingBag, href: '/admin/boutique' },
        { title: 'Logements', icon: Building2, href: '/admin/logements' },
        { title: 'Commandes', icon: Receipt, href: '/admin/orders' },
        { title: 'Coupons', icon: Tag, href: '/admin/coupons' },
        { title: 'Messages', icon: MessageSquare, href: '/admin/messages', badge: unreadMessages },
        { title: 'Notifications', icon: Bell, href: '/admin/notifications', badge: unreadNotifications },
        { title: 'Community Mgr', icon: Megaphone, href: '/admin/community-manager' },
        { title: 'Traductions', icon: Languages, href: '/admin/traductions' },
        { title: 'Utilisateurs', icon: UserCog, href: '/admin/users' },
        { title: 'Réglages', icon: Settings, href: '/admin/settings' },
        { title: 'Devises (ERP)', icon: Coins, href: '/admin/settings/currency' },
        { title: 'Réglages ERP', icon: ShieldCheck, href: '/admin/settings/erp' },
        { title: 'Sécurité WAF', icon: ShieldAlert, href: '/admin/securite' },
        { title: '2FA — Auth Admin', icon: KeyRound, href: '/admin/settings/2fa' },
        { title: 'Centre RGPD', icon: ShieldCheck, href: '/admin/rgpd' },
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
                                KAGE <span className="text-[#FCD116]"><T>ADMIN</T></span>
                            </h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em]"><T>Secure Node</T></span>
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
                            onClick={() => setMobileMenuOpen(false)}
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
                                <span className="text-[13px] font-semibold truncate flex-1">
                                    {item.title}
                                </span>
                            )}
                            
                            {/* BADGE */}
                            {item.badge !== undefined && item.badge > 0 && (
                                <span className={cn(
                                    "bg-[#E8112D] text-white text-[10px] font-bold rounded-full flex items-center justify-center",
                                    compact ? "absolute top-1 right-1 w-4 h-4 text-[8px]" : "w-5 h-5 ml-auto"
                                )}>
                                    {item.badge > 99 ? '99+' : item.badge}
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
                                <p className="text-[9px] text-gray-400 font-mono uppercase truncate"><T>Super User</T></p>
                            </div>
                        </div>
                        <button
                            onClick={() => logout()}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/8 rounded-lg transition-all group text-[11px] font-bold"
                        >
                            <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                            <span><T>DÉCONNEXION</T></span>
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-benin-gradient flex items-center justify-center text-white font-bold text-[10px]">
                            {user?.email?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <button onClick={() => logout()} title={t("Déconnexion")} className="p-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/8 rounded-lg transition-all">
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
            <ThemeProvider panel="admin" defaultTheme="dark">
            <div className="flex h-screen text-white font-sans overflow-hidden" style={{ background: 'var(--panel-bg)', color: 'var(--panel-text)' }}>
                {/* ═══════════ DESKTOP SIDEBAR ═══════════ */}
                <motion.aside
                    initial={false}
                    animate={{ width: isSidebarOpen ? 260 : 68 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="hidden lg:flex h-full border-r flex-col relative z-50 overflow-hidden shadow-[10px_0_30px_rgba(0,0,0,0.5)]"
                    style={{ background: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
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
                                className="fixed left-0 top-0 h-full w-[280px] border-r flex flex-col z-[101] lg:hidden shadow-2xl"
                                style={{ background: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
                            >
                                <button
                                    onClick={() => setMobileMenuOpen(false)}
                                    title={t("Fermer le menu")}
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
                    {/* Background Pattern — halos décoratifs (quasi invisibles en
                        mode clair via .admin-bg-glow pour éviter toute sensation de voile) */}
                    <div className="admin-bg-glow absolute inset-0 z-0 pointer-events-none overflow-hidden">
                        <div className="absolute top-[20%] left-[30%] w-[800px] h-[800px] bg-[#008751]/5 rounded-full blur-[150px]" />
                        <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-[#E8112D]/5 rounded-full blur-[120px]" />
                    </div>

                    {/* ═══ TOP NAVBAR ═══ */}
                    <header
                        className={cn(
                            'h-14 lg:h-16 flex items-center px-4 lg:px-6 justify-between transition-all relative z-40',
                            'backdrop-blur-xl border-b',
                            scrolled && 'shadow-[0_4px_30px_rgba(0,0,0,0.4)]'
                        )}
                        style={{
                            background: 'color-mix(in srgb, var(--panel-bg) 80%, transparent)',
                            borderColor: 'var(--panel-border)',
                        }}
                    >
                        <div className="flex items-center gap-3">
                            {/* Mobile hamburger */}
                            <button
                                onClick={() => setMobileMenuOpen(true)}
                                title={t("Ouvrir le menu")}
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
                            <ThemeToggle />
                            <button title="Notifications" className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all">
                                <Bell size={17} />
                            </button>
                            <button title="Aide" className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all hidden sm:flex">
                                <HelpCircle size={17} />
                            </button>

                            {/* KAGE IA Button */}
                            <button className="flex items-center gap-1.5 bg-[#FCD116]/10 hover:bg-[#FCD116]/20 text-[#FCD116] border border-[#FCD116]/20 px-3 py-1.5 rounded-xl transition-all text-[10px] font-black tracking-widest">
                                <Sparkles size={14} className="animate-pulse" />
                                <span className="hidden sm:inline"><T>KAGE IA</T></span>
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
                            {/* Transition de page : léger glissement SANS fondu
                                d'opacité — le fondu restait parfois bloqué à mi-
                                course et donnait un voile « flou » sur tout le panel. */}
                            <motion.div
                                key={pathname}
                                initial={{ y: 8 }}
                                animate={{ y: 0 }}
                                style={{ opacity: 1 }}
                                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            >
                                {children}
                            </motion.div>
                        </div>
                    </div>
                </main>
            </div>
            </ThemeProvider>
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
