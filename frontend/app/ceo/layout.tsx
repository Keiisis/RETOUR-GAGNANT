'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Crown, LayoutDashboard, ShieldCheck, Users, MessageSquare,
    ShoppingBag, Receipt, BarChart3, Settings, LogOut,
    Bell, Menu, X, ChevronRight, Activity, Globe,
    TrendingUp, Zap, Lock, FileText, Sparkles, type LucideProps,
    FolderOpen, UserCog, Calculator, Wrench, Package, BookOpen,
    Image, Star, Globe2, Handshake, Target, Boxes, Tag, Calendar,
    Share2, Search,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { ThemeProvider } from '@/lib/theme/ThemeContext'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

// ══════════════════════════════════════════════════════════════
// PALETTE CEO — Or · Vert · Jaune · Rouge · Drapeau Bénin
// ══════════════════════════════════════════════════════════════
const GOLD    = '#D4AF37'
const YELLOW  = '#FCD116'
const GREEN   = '#008751'
const GREEN_L = '#00A86B'
const RED     = '#E8112D'
const BG      = '#FFFFFF'   // Fond blanc
const PANEL   = '#F4FAF5'   // Sidebar très légère teinte verte
const TEXT    = '#1A2C1A'   // Texte vert forêt foncé
const BG_DARK = '#0B1F0D'   // Utilisé uniquement pour l'animation de bienvenue

interface NavSection { section?: string; items: NavItem[] }
interface NavItem { label: string; href: string; icon: React.ForwardRefExoticComponent<LucideProps> }

const CEO_NAV_SECTIONS: NavSection[] = [
    {
        section: 'CORE',
        items: [
            { label: 'Dashboard',    href: '/ceo/dashboard',   icon: LayoutDashboard },
            { label: 'Gemma 4 IA',   href: '/ceo/assistant',   icon: Sparkles },
            { label: 'Activité',     href: '/ceo/activite',    icon: Activity },
        ]
    },
    {
        section: 'FINANCE',
        items: [
            { label: 'Revenus',      href: '/ceo/revenus',     icon: TrendingUp },
            { label: 'Comptabilité', href: '/ceo/comptabilite',icon: Calculator },
            { label: 'Commandes',    href: '/ceo/commandes',   icon: ShoppingBag },
            { label: 'Facturation',  href: '/ceo/facturation', icon: Receipt },
        ]
    },
    {
        section: 'GESTION',
        items: [
            { label: 'Dossiers',     href: '/ceo/dossiers',    icon: FolderOpen },
            { label: 'Clients',      href: '/ceo/clients',     icon: Users },
            { label: 'Utilisateurs', href: '/ceo/utilisateurs',icon: UserCog },
            { label: 'Messages',     href: '/ceo/messages',    icon: MessageSquare },
            { label: 'Leads',        href: '/ceo/leads',       icon: Target },
        ]
    },
    {
        section: 'CATALOGUE',
        items: [
            { label: 'Services',     href: '/ceo/services',    icon: Wrench },
            { label: 'Boutique',     href: '/ceo/boutique',    icon: Package },
            { label: 'Inventaire',   href: '/ceo/inventaire',  icon: Boxes },
            { label: 'Coupons',      href: '/ceo/coupons',     icon: Tag },
        ]
    },
    {
        section: 'CONTENU',
        items: [
            { label: 'Blog',         href: '/ceo/blog',        icon: BookOpen },
            { label: 'Galerie',      href: '/ceo/galerie',     icon: Image },
            { label: 'Témoignages',  href: '/ceo/temoignages', icon: Star },
            { label: 'Événements',   href: '/ceo/evenements',  icon: Calendar },
        ]
    },
    {
        section: 'PARTENAIRES',
        items: [
            { label: 'Nationalité',  href: '/ceo/nationalite', icon: Globe2 },
            { label: 'Partenaires',  href: '/ceo/partenaires', icon: Handshake },
        ]
    },
    {
        section: 'SYSTÈME',
        items: [
            { label: 'Community Mgr',href: '/ceo/community-manager', icon: Share2 },
            { label: 'Site Web',     href: '/ceo/site',        icon: Globe },
            { label: 'Sécurité',     href: '/ceo/securite',    icon: ShieldCheck },
            { label: 'Rapports',     href: '/ceo/rapports',    icon: BarChart3 },
        ]
    },
    {
        section: 'CONFIG',
        items: [
            { label: 'Documents',    href: '/ceo/documents',   icon: FileText },
            { label: 'Paramètres',   href: '/ceo/parametres',  icon: Settings },
            { label: '2FA',          href: '/ceo/2fa',         icon: Lock },
        ]
    },
]

// Flat list for active detection
const CEO_NAV = CEO_NAV_SECTIONS.flatMap(s => s.items)

// ── Animation de bienvenue plein écran ───────────────────────
function WelcomeAnimation({ name, onDone }: { name: string; onDone: () => void }) {
    const firstName = name?.split(' ')[0] || 'BOSS'

    useEffect(() => {
        const t = setTimeout(onDone, 4500)
        return () => clearTimeout(t)
    }, [onDone])

    return (
        <motion.div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center cursor-pointer select-none overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${BG} 0%, #0F2E18 40%, #142010 100%)` }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            onClick={onDone}
        >
            {/* Halos tricolores */}
            <motion.div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[150px]"
                style={{ background: GREEN }}
                initial={{ opacity: 0 }} animate={{ opacity: 0.12 }} transition={{ duration: 1.2 }} />
            <motion.div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[140px]"
                style={{ background: RED }}
                initial={{ opacity: 0 }} animate={{ opacity: 0.15 }} transition={{ duration: 1.2, delay: 0.3 }} />
            <motion.div className="absolute top-[30%] right-[20%] w-[400px] h-[400px] rounded-full blur-[130px]"
                style={{ background: GOLD }}
                initial={{ opacity: 0 }} animate={{ opacity: 0.1 }} transition={{ duration: 1.2, delay: 0.6 }} />

            {/* Éclats de particules */}
            {[...Array(24)].map((_, i) => {
                const colors = [GOLD, YELLOW, GREEN_L, RED]
                return (
                    <motion.div key={i}
                        className="absolute rounded-full"
                        style={{
                            width: 2 + (i % 4),
                            height: 2 + (i % 4),
                            background: colors[i % 4],
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                        }}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0], y: [0, -100 - Math.random() * 80], x: [(Math.random() - 0.5) * 80] }}
                        transition={{ delay: 0.2 + i * 0.08, duration: 2.8, ease: 'easeOut' }}
                    />
                )
            })}

            {/* Bannière drapeau Bénin */}
            <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: 0.1, duration: 0.7 }}
                className="flex rounded-2xl overflow-hidden mb-8 shadow-2xl"
                style={{ height: 6, width: 120 }}
            >
                <div className="flex-1" style={{ background: GREEN }} />
                <div className="flex-1" style={{ background: YELLOW }} />
                <div className="flex-1" style={{ background: RED }} />
            </motion.div>

            {/* Couronne animée */}
            <motion.div
                initial={{ scale: 0, rotate: -90, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 160, damping: 12, delay: 0.2 }}
                className="w-32 h-32 rounded-3xl flex items-center justify-center mb-8 shadow-2xl relative"
                style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #9A7A00 40%, ${YELLOW} 70%, ${GOLD} 100%)` }}
            >
                <Crown size={60} style={{ color: BG }} />
                <motion.div className="absolute inset-0 rounded-3xl"
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 55%)' }}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                />
            </motion.div>

            {/* Texte animé séquencé */}
            <div className="text-center px-6">
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.7 }}
                    className="text-sm font-black uppercase tracking-[0.6em] mb-4"
                    style={{ color: `${GREEN_L}CC` }}
                >
                    RETOUR GAGNANT BÉNIN
                </motion.p>

                <motion.h1
                    initial={{ opacity: 0, y: 30, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.8, type: 'spring', stiffness: 120 }}
                    className="text-5xl sm:text-7xl font-black tracking-wider mb-3"
                    style={{
                        background: `linear-gradient(135deg, ${GOLD}, ${YELLOW}, #FFE066, ${GOLD})`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontFamily: 'serif',
                    }}
                >
                    BIENVENUE BOSS
                </motion.h1>

                {/* Ligne tricolore */}
                <motion.div
                    className="h-[3px] rounded-full mx-auto my-5"
                    style={{ background: `linear-gradient(90deg, ${GREEN}, ${YELLOW}, ${RED})` }}
                    initial={{ width: 0 }}
                    animate={{ width: '80%' }}
                    transition={{ delay: 1.1, duration: 0.8 }}
                />

                <motion.p
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.3, duration: 0.6 }}
                    className="text-2xl sm:text-3xl font-light mb-3"
                    style={{ color: `${TEXT}CC` }}
                >
                    content de vous revoir,
                </motion.p>

                <motion.p
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.8, type: 'spring', stiffness: 180, damping: 14 }}
                    className="text-3xl sm:text-5xl font-black"
                    style={{ color: GOLD }}
                >
                    {firstName}
                </motion.p>
            </div>

            {/* Hint */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.8 }}
                className="absolute bottom-10 text-[10px] uppercase tracking-[0.5em]"
                style={{ color: `${GREEN}60` }}
            >
                Cliquez pour continuer
            </motion.p>
        </motion.div>
    )
}

// ── Nav Item ──────────────────────────────────────────────────
function NavItem({ href, icon: Icon, label, active, collapsed, onClick }: {
    href: string; icon: React.ForwardRefExoticComponent<LucideProps>; label: string
    active: boolean; collapsed: boolean; onClick?: () => void
}) {
    return (
        <Link
            href={href} onClick={onClick}
            className={cn('flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all group relative overflow-hidden')}
            style={active ? {
                background: `linear-gradient(135deg, ${GOLD}, #9A7A00)`,
                boxShadow: `0 4px 15px ${GOLD}35`,
                color: BG,
            } : { color: `${TEXT}60` }}
        >
            {!active && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                    style={{ background: `${GREEN}18` }} />
            )}
            <Icon size={18} className="shrink-0 relative z-10"
                style={{ color: active ? BG : `${GREEN_L}80` }} />
            <AnimatePresence>
                {!collapsed && (
                    <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="overflow-hidden whitespace-nowrap font-semibold tracking-wide text-xs uppercase relative z-10"
                        style={{ color: active ? BG : undefined }}
                    >
                        {label}
                    </motion.span>
                )}
            </AnimatePresence>
            {active && !collapsed && (
                <ChevronRight size={14} className="ml-auto relative z-10" style={{ color: BG }} />
            )}
        </Link>
    )
}

// ── Layout Principal ──────────────────────────────────────────
export default function CeoLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router   = useRouter()
    const [profile, setProfile]     = useState<{ full_name?: string } | null>(null)
    const [showWelcome, setShowWelcome] = useState(false)
    const [collapsed, setCollapsed]     = useState(false)
    const [mobileOpen, setMobileOpen]   = useState(false)
    const [scrolled, setScrolled]       = useState(false)
    const initialized = useRef(false)

    const isLoginPage = pathname === '/ceo/login' || pathname === '/ceo/reset-password'

    useEffect(() => {
        if (isLoginPage || initialized.current) return
        initialized.current = true
        const check = async () => {
            const { data: { user }, error } = await supabase.auth.getUser()
            if (error || !user) { router.push('/ceo/login'); return }
            const { data: prof } = await supabase.from('user_profiles').select('full_name, role').eq('id', user.id).single()
            if (!prof || prof.role !== 'ceo') { await supabase.auth.signOut(); router.push('/ceo/login?error=unauthorized'); return }
            setProfile(prof)
            if (!sessionStorage.getItem('ceo_welcomed')) setShowWelcome(true)
        }
        check()
    }, [isLoginPage, router])

    useEffect(() => {
        const h = () => setScrolled(window.scrollY > 10)
        window.addEventListener('scroll', h, { passive: true })
        return () => window.removeEventListener('scroll', h)
    }, [])

    const handleWelcomeDone = () => {
        sessionStorage.setItem('ceo_welcomed', '1')
        setShowWelcome(false)
    }

    const handleLogout = async () => {
        sessionStorage.removeItem('ceo_welcomed')
        await supabase.auth.signOut()
        router.push('/ceo/login')
    }

    if (isLoginPage) return <>{children}</>

    const firstName  = profile?.full_name?.split(' ')[0] || 'CEO'
    const activeLabel = CEO_NAV.find(n => pathname === n.href || pathname.startsWith(n.href + '/'))?.label || 'CEO Panel'

    return (
        <ThemeProvider panel="ceo" defaultTheme="light">
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--panel-bg)', color: 'var(--panel-text)' }}>

            {/* Welcome animation */}
            <AnimatePresence>
                {showWelcome && <WelcomeAnimation name={profile?.full_name || ''} onDone={handleWelcomeDone} />}
            </AnimatePresence>

            {/* ── SIDEBAR DESKTOP ─────────────────────────── */}
            <motion.aside
                animate={{ width: collapsed ? 68 : 252 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="hidden lg:flex flex-col h-full shrink-0 z-20"
                style={{ background: PANEL, borderRight: `1px solid ${GREEN}25` }}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: `${GREEN}20` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
                        style={{ background: `linear-gradient(135deg, ${GOLD}, #9A7A00, ${YELLOW})` }}>
                        <Crown size={20} style={{ color: BG }} />
                    </div>
                    <AnimatePresence>
                        {!collapsed && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <p className="font-black text-sm tracking-widest" style={{ color: GOLD }}>CEO PANEL</p>
                                <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: `${GREEN_L}80` }}>
                                    Retour Gagnant
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Bannière drapeau */}
                {!collapsed && (
                    <div className="flex mx-4 mt-3 rounded-lg overflow-hidden" style={{ height: 3 }}>
                        <div className="flex-1" style={{ background: GREEN }} />
                        <div className="flex-1" style={{ background: YELLOW }} />
                        <div className="flex-1" style={{ background: RED }} />
                    </div>
                )}

                {/* Profil */}
                <AnimatePresence>
                    {!collapsed && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="px-4 py-4 border-b overflow-hidden" style={{ borderColor: `${GREEN}15` }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                                    style={{ background: `${GOLD}20`, color: GOLD, border: `1px solid ${GOLD}35` }}>
                                    {firstName[0]?.toUpperCase()}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-xs font-bold truncate" style={{ color: TEXT }}>{profile?.full_name || 'CEO'}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: GOLD }}>
                                        ◆ CHIEF EXECUTIVE
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-3 px-2.5">
                    {CEO_NAV_SECTIONS.map(section => (
                        <div key={section.section} className="mb-2">
                            {section.section && !collapsed && (
                                <p className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] mb-0.5"
                                    style={{ color: `${GREEN}60` }}>
                                    {section.section}
                                </p>
                            )}
                            <div className="space-y-0.5">
                                {section.items.map(item => (
                                    <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label}
                                        active={pathname === item.href || pathname.startsWith(item.href + '/')}
                                        collapsed={collapsed} />
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Bas */}
                <div className="p-2.5 border-t space-y-1" style={{ borderColor: `${GREEN}15` }}>
                    <button onClick={() => setCollapsed(!collapsed)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                        style={{ color: `${TEXT}40` }}
                        onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
                        onMouseLeave={e => (e.currentTarget.style.color = `${TEXT}40`)}
                    >
                        <Zap size={16} className="shrink-0" />
                        {!collapsed && <span className="text-xs font-medium">Réduire</span>}
                    </button>
                    <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                        style={{ color: `${TEXT}40` }}
                        onMouseEnter={e => (e.currentTarget.style.color = RED)}
                        onMouseLeave={e => (e.currentTarget.style.color = `${TEXT}40`)}
                    >
                        <LogOut size={16} className="shrink-0" />
                        {!collapsed && <span className="text-xs font-medium">Déconnexion</span>}
                    </button>
                </div>
            </motion.aside>

            {/* ── Colonne droite ───────────────────────────── */}
            <div className="flex flex-col flex-1 overflow-hidden">

                {/* TOPBAR MOBILE */}
                <header className={cn('flex items-center justify-between px-4 h-14 shrink-0 z-10 lg:hidden transition-all')}
                    style={{
                        background: scrolled ? `${PANEL}F0` : 'transparent',
                        borderBottom: scrolled ? `1px solid ${GREEN}20` : '1px solid transparent',
                        backdropFilter: scrolled ? 'blur(12px)' : 'none',
                    }}>
                    <button onClick={() => setMobileOpen(true)}
                        className="p-2 rounded-xl transition-colors"
                        style={{ background: `${GREEN}20`, color: GREEN_L }}>
                        <Menu size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow"
                            style={{ background: `linear-gradient(135deg, ${GOLD}, #9A7A00)` }}>
                            <Crown size={14} style={{ color: BG }} />
                        </div>
                        <span className="font-black text-sm tracking-widest" style={{ color: GOLD }}>CEO</span>
                    </div>
                    <button onClick={handleLogout} className="p-2 rounded-xl transition-colors"
                        style={{ color: `${TEXT}40` }}
                        onMouseEnter={e => (e.currentTarget.style.color = RED)}
                        onMouseLeave={e => (e.currentTarget.style.color = `${TEXT}40`)}>
                        <LogOut size={18} />
                    </button>
                </header>

                {/* TOPBAR DESKTOP */}
                <header className={cn('hidden lg:flex items-center justify-between px-6 h-14 shrink-0 z-10 transition-all')}
                    style={{
                        background: scrolled ? `${PANEL}F0` : 'transparent',
                        borderBottom: scrolled ? `1px solid ${GREEN}20` : '1px solid transparent',
                        backdropFilter: scrolled ? 'blur(12px)' : 'none',
                    }}>
                    <div>
                        <h2 className="text-sm font-black" style={{ color: TEXT }}>{activeLabel}</h2>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: `${GREEN_L}70` }}>
                            Retour Gagnant Bénin
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <button className="relative p-2 rounded-xl transition-colors"
                            style={{ background: `${GREEN}15`, color: `${GREEN_L}80` }}
                            onMouseEnter={e => (e.currentTarget.style.color = GREEN_L)}
                            onMouseLeave={e => (e.currentTarget.style.color = `${GREEN_L}80`)}>
                            <Bell size={17} />
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black"
                            style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}30`, color: GOLD }}>
                            <Crown size={13} />
                            {firstName}
                        </div>
                    </div>
                </header>

                {/* Contenu */}
                <main className="flex-1 overflow-y-auto">{children}</main>
            </div>

            {/* ── DRAWER MOBILE ────────────────────────────── */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-30 lg:hidden"
                            style={{ background: 'rgba(0,20,5,0.75)', backdropFilter: 'blur(6px)' }}
                            onClick={() => setMobileOpen(false)}
                        />
                        <motion.div
                            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                            className="fixed inset-y-0 left-0 z-40 w-72 flex flex-col lg:hidden"
                            style={{ background: PANEL, borderRight: `1px solid ${GREEN}25` }}
                        >
                            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: `${GREEN}20` }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                        style={{ background: `linear-gradient(135deg, ${GOLD}, #9A7A00, ${YELLOW})` }}>
                                        <Crown size={18} style={{ color: BG }} />
                                    </div>
                                    <div>
                                        <p className="font-black text-sm tracking-wider" style={{ color: GOLD }}>CEO PANEL</p>
                                        <p className="text-[9px] uppercase font-bold" style={{ color: `${GREEN_L}80` }}>{profile?.full_name}</p>
                                    </div>
                                </div>
                                <button onClick={() => setMobileOpen(false)} className="p-1 transition-colors"
                                    style={{ color: `${TEXT}50` }}
                                    onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
                                    onMouseLeave={e => (e.currentTarget.style.color = `${TEXT}50`)}>
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Bannière */}
                            <div className="flex mx-4 mt-3 rounded-lg overflow-hidden" style={{ height: 3 }}>
                                <div className="flex-1" style={{ background: GREEN }} />
                                <div className="flex-1" style={{ background: YELLOW }} />
                                <div className="flex-1" style={{ background: RED }} />
                            </div>

                            <nav className="flex-1 overflow-y-auto py-3 px-3">
                                {CEO_NAV_SECTIONS.map(section => (
                                    <div key={section.section} className="mb-2">
                                        {section.section && (
                                            <p className="px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] mb-0.5"
                                                style={{ color: `${GREEN}60` }}>
                                                {section.section}
                                            </p>
                                        )}
                                        <div className="space-y-0.5">
                                            {section.items.map(item => (
                                                <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label}
                                                    active={pathname === item.href || pathname.startsWith(item.href + '/')}
                                                    collapsed={false} onClick={() => setMobileOpen(false)} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </nav>

                            <div className="p-3 border-t" style={{ borderColor: `${GREEN}15` }}>
                                <button onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all"
                                    style={{ color: `${TEXT}50` }}
                                    onMouseEnter={e => (e.currentTarget.style.color = RED)}
                                    onMouseLeave={e => (e.currentTarget.style.color = `${TEXT}50`)}>
                                    <LogOut size={16} />
                                    <span className="text-xs font-medium">Déconnexion</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
        </ThemeProvider>
    )
}
