'use client'

import React, { useRef, useState, useEffect } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { ArrowUpRight, Phone, Mail, MapPin, Globe, CheckCircle2, ChevronRight, Languages } from 'lucide-react'
import { useTranslation } from '@/lib/translation/useTranslation'
import { SUPPORTED_LANGUAGES } from '@/lib/translation/constants'

// ---  Selecteur de Langue Mobile-First (Dynamic Island Style) ---
const MinimalLanguageSelector = () => {
    const { lang, setLang } = useTranslation()
    const [isOpen, setIsOpen] = useState(false)

    const activeLang = SUPPORTED_LANGUAGES.find(l => l.code === lang) || SUPPORTED_LANGUAGES[0]

    return (
        <div className="fixed top-4 right-4 z-[100]">
            <motion.div
                initial={false}
                animate={isOpen ? "open" : "closed"}
                variants={{
                    open: { height: 'auto', borderRadius: 24, padding: "4px" },
                    closed: { height: 44, borderRadius: 24, padding: "0px" }
                }}
                className="bg-white/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/60 overflow-hidden flex flex-col w-[160px]"
            >
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full h-[44px] px-4 flex items-center justify-between gap-3 bg-transparent hover:bg-black/5 transition-colors rounded-full rounded-b-none"
                    style={{ borderRadius: isOpen ? '20px 20px 0 0' : '22px' }}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{activeLang.flag}</span>
                        <span className="text-[11px] font-black uppercase tracking-widest text-gray-800">{activeLang.code}</span>
                    </div>
                    <Languages className="w-4 h-4 text-gray-400" />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col gap-1 px-1 pb-1 pt-1"
                        >
                            <div className="w-full h-px bg-gray-100 my-1" />
                            {SUPPORTED_LANGUAGES.map(l => {
                                const isActive = lang === l.code
                                return (
                                    <button
                                        key={l.code}
                                        onClick={() => { setLang(l.code); setIsOpen(false); }}
                                        className={`
                                            flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-200 w-full
                                            ${isActive ? 'bg-[#008751]/10 text-[#008751] font-bold' : 'hover:bg-gray-50 text-gray-600 font-medium'}
                                        `}
                                    >
                                        <span className="text-lg">{l.flag}</span>
                                        <span className="text-[13px]">{l.nativeLabel}</span>
                                        {isActive && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-[#008751]" />}
                                    </button>
                                )
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    )
}

// ---  Interaction Card (Ultra Premium Light Glass) ---------------------------
interface InteractionCardProps {
    children: React.ReactNode;
    href: string;
    isPrimary?: boolean;
    delay?: number;
}

const InteractionCard = ({ children, href, isPrimary = false, delay = 0 }: InteractionCardProps) => {
    return (
        <motion.a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay, type: "spring", bounce: 0.5 }}
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.98 }}
            className={`
                group relative flex w-full max-w-sm mx-auto items-center justify-between p-4 rounded-[2rem] transition-all duration-500 overflow-hidden
                ${isPrimary
                    ? 'bg-gradient-to-r from-[#008751] to-[#00a664] text-white shadow-[0_20px_40px_-15px_rgba(0,135,81,0.5)] border border-white/40'
                    : 'bg-white/70 backdrop-blur-2xl text-gray-900 shadow-[0_15px_35px_-10px_rgba(0,0,0,0.08)] border border-white hover:bg-white hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.12)]'
                }
            `}
        >
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${isPrimary ? 'bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.3),transparent)]' : 'bg-[radial-gradient(circle_at_50%_120%,rgba(0,135,81,0.1),transparent)]'}`} />
            <div className={`absolute inset-0 -translate-x-[150%] skew-x-[-20deg] group-hover:animate-[shimmer_2s_infinite] w-1/2 bg-gradient-to-r from-transparent ${isPrimary ? 'via-white/30' : 'via-white/80'} to-transparent pointer-events-none`} />

            <div className="flex items-center gap-4 relative z-10 w-full pl-2">
                {children}
            </div>

            <div className={`
                w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full transition-all duration-500 relative z-10 shadow-sm
                ${isPrimary ? 'bg-white text-[#008751]' : 'bg-gray-100 text-[#008751] group-hover:bg-[#008751] group-hover:text-white group-hover:rotate-45'}
            `}>
                <ArrowUpRight className="w-5 h-5 transition-transform" />
            </div>
        </motion.a>
    )
}

// ---  Composant Principal -----------------------------------------
export default function PortfolioImmersivePage() {
    const { t } = useTranslation()
    const containerRef = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({ target: containerRef })

    const blob1Y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"])
    const blob2Y = useTransform(scrollYProgress, [0, 1], ["0%", "-50%"])
    const blob3Y = useTransform(scrollYProgress, [0, 1], ["0%", "80%"])

    const [showIntro, setShowIntro] = useState(true)
    const videoRef = useRef<HTMLVideoElement>(null)

    // Stratégie autoplay robuste :
    // 1. Tentative immédiate de play() dès que la vidéo est montée
    // 2. Retry automatique au premier événement utilisateur (autorisé par tous les navigateurs)
    // 3. Filet de secours : ferme l'intro si rien n'a démarré sous 12s (fichier totalement inaccessible)
    useEffect(() => {
        if (!showIntro) return
        const v = videoRef.current
        if (!v) return

        const tryPlay = () => { v.play().catch(() => { /* silencieux — on retentera */ }) }

        // Tentative immédiate (dès que <video> est dans le DOM)
        tryPlay()
        // Re-tentative sur n'importe quelle interaction utilisateur
        const events: (keyof WindowEventMap)[] = ['pointerdown', 'touchstart', 'keydown', 'scroll']
        events.forEach(e => window.addEventListener(e, tryPlay, { once: true, passive: true }))

        // Filet de secours absolu : si readyState < 2 après 12s, le fichier est inaccessible → on ferme
        const failsafe = setTimeout(() => {
            if (v.readyState < 2) setShowIntro(false)
        }, 12000)

        return () => {
            clearTimeout(failsafe)
            events.forEach(e => window.removeEventListener(e, tryPlay))
        }
    }, [showIntro])

    const services = [
        { id: '01', slug: 'passeport', title: t("Passeport & Documents"), desc: t("Passeport, acte de naissance, apostille"), bg: "bg-[#008751]", text: "text-white", iconBg: "bg-white/20" },
        { id: '02', slug: 'logement', title: t("Acheter ou Louer"), desc: t("Immobilier, foncier, sécurisation"), bg: "bg-white", text: "text-gray-900", iconBg: "bg-[#008751]/10 text-[#008751]" },
        { id: '03', slug: 'business', title: t("Création d'Entreprise"), desc: t("RCCM, compte pro, fiscalité"), bg: "bg-[#FCD116]", text: "text-gray-900", iconBg: "bg-white/40" },
        { id: '04', slug: 'culture', title: t("Tourisme & Culture"), desc: t("Circuits, patrimoine, séjours"), bg: "bg-white", text: "text-gray-900", iconBg: "bg-[#008751]/10 text-[#008751]" },
        { id: '05', slug: 'construction', title: t("Suivi de Chantier"), desc: t("Maîtrise d'ouvrage, coordination"), bg: "bg-[#E8112D]", text: "text-white", iconBg: "bg-white/20" },
        { id: '06', slug: 'investissement', title: t("Investissement"), desc: t("Opportunités, partenariats locaux"), bg: "bg-white", text: "text-gray-900", iconBg: "bg-[#008751]/10 text-[#008751]" },
        { id: '07', slug: 'nationalite-vip', title: t("Nationalité VIP"), desc: t("Reconnaissance prioritaire"), bg: "bg-[#008751]", text: "text-white", iconBg: "bg-white/20" },
        { id: '08', slug: 'recherche-ancestrale', title: t("Recherche Ancestrale"), desc: t("Plan de composition de Famille, archives d'esclavage"), bg: "bg-[#FCD116]", text: "text-gray-900", iconBg: "bg-white/40" },
        { id: '09', slug: 'autres', title: t("Autres Services"), desc: t("Transport, santé, scolarité"), bg: "bg-white", text: "text-gray-900", iconBg: "bg-[#008751]/10 text-[#008751]" },
    ]

    return (
        <div ref={containerRef} className="relative min-h-screen bg-[#F0F2F5] text-gray-900 font-sans selection:bg-[#008751] selection:text-white overflow-x-hidden pt-10 pb-28">

            {/* ---  Splash Screen Video Intro --- */}
            <AnimatePresence>
                {showIntro && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed inset-0 z-[200] bg-[#050505] flex flex-col items-center justify-center overflow-hidden"
                    >
                        <video
                            ref={videoRef}
                            src="https://ywvsfhqdtkgzavxsumnk.supabase.co/storage/v1/object/public/videos/portfolio/video-cut.mp4"
                            poster="https://ywvsfhqdtkgzavxsumnk.supabase.co/storage/v1/object/public/gallery/portfolio/image_RGB.jpg"
                            autoPlay
                            muted
                            playsInline
                            preload="auto"
                            onEnded={() => setShowIntro(false)}
                            onError={() => setShowIntro(false)}
                            className="absolute inset-0 w-full h-full object-cover opacity-90 scale-105"
                        />
                        {/* Voile assombrissant pour faire ressortir le bouton */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                        <div className="relative z-10 flex flex-col items-center justify-end h-full w-full pb-12">
                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4, duration: 0.6 }}
                                onClick={() => setShowIntro(false)}
                                className="px-6 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white tracking-widest text-xs font-bold border border-white/20 transition-all uppercase"
                            >
                                {t("Passer l'introduction")}
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sélecteur de langue accessible par dessus tout mais sous l'intro */}
            <div className="relative z-[150]">
                <MinimalLanguageSelector />
            </div>

            <style jsx global>{`
                @keyframes shimmer {
                    100% { transform: translateX(200%) skewX(-20deg); }
                }
                .mesh-bg {
                    background-color: #f8fafc;
                    background-image: 
                        radial-gradient(at 0% 0%, rgba(0, 135, 81, 0.08) 0px, transparent 50%),
                        radial-gradient(at 100% 0%, rgba(252, 209, 22, 0.12) 0px, transparent 50%),
                        radial-gradient(at 100% 100%, rgba(232, 17, 45, 0.08) 0px, transparent 50%),
                        radial-gradient(at 0% 100%, rgba(0, 135, 81, 0.08) 0px, transparent 50%);
                }
                .grid-bg {
                    background-image: 
                        linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px);
                    background-size: 20px 20px;
                }
            `}</style>

            <div className="fixed inset-0 z-0 mesh-bg pointer-events-none" />
            <div className="fixed inset-0 z-0 grid-bg opacity-50 pointer-events-none mix-blend-multiply" />

            <motion.div
                style={{ y: blob1Y }}
                className="fixed top-[-10%] right-[-20%] w-[70vw] h-[70vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-br from-[#008751]/20 to-[#008751]/5 blur-[80px] pointer-events-none mix-blend-multiply"
                animate={{ x: [0, 80, 0], y: [0, -50, 0], rotate: [0, 45, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                style={{ y: blob2Y }}
                className="fixed bottom-[10%] left-[-20%] w-[80vw] h-[80vw] max-w-[700px] max-h-[700px] rounded-[40%_60%_70%_30%] bg-gradient-to-tr from-[#FCD116]/25 to-[#fde047]/10 blur-[90px] pointer-events-none mix-blend-multiply"
                animate={{ x: [0, -60, 0], y: [0, 60, 0], rotate: [0, -45, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            />
            <motion.div
                style={{ y: blob3Y }}
                className="fixed top-[40%] right-[10%] w-[40vw] h-[40vw] max-w-[400px] max-h-[400px] rounded-full bg-gradient-to-l from-[#E8112D]/15 to-transparent blur-[70px] pointer-events-none mix-blend-multiply"
                animate={{ scale: [1, 1.3, 1], x: [0, -40, 0] }}
                transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="relative z-10 max-w-[420px] mx-auto w-full px-4 flex flex-col justify-center">

                <motion.div
                    initial={{ scale: 0.8, opacity: 0, y: -40 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ duration: 1, type: "spring", bounce: 0.5 }}
                    className="flex flex-col items-center mb-8 pt-6 relative"
                >
                    <div className="relative w-36 h-36 mb-6 group">
                        <div className="absolute -inset-6 bg-gradient-to-tr from-[#008751] via-[#FCD116] to-[#E8112D] rounded-[2.5rem] blur-2xl opacity-30 group-hover:opacity-60 transition-opacity duration-1000 animate-[spin_12s_linear_infinite]" />

                        <div className="absolute inset-0 bg-white/80 backdrop-blur-3xl rounded-[2rem] shadow-[0_15px_40px_rgba(0,0,0,0.1)] p-2 transform group-hover:scale-105 transition-transform duration-500 border border-white z-10">
                            <Image src="/logo.jpg" alt="Logo RGB" fill className="object-cover rounded-[1.6rem]" priority />
                        </div>

                        <div className="absolute -bottom-2 -right-2 bg-blue-500 rounded-full p-1 z-20 shadow-lg border-2 border-white animate-bounce">
                            <CheckCircle2 className="w-5 h-5 text-white" />
                        </div>
                    </div>

                    <h1 className="text-4xl font-black tracking-tighter text-[#1a1a1a] leading-tight text-center uppercase drop-shadow-sm">
                        {t('Retour Gagnant')}
                    </h1>
                    <div className="inline-flex items-center gap-3 mt-2 px-4 py-1.5 rounded-full bg-white/50 backdrop-blur-md border border-white/50 shadow-sm">
                        <div className="h-2 w-2 rounded-full bg-[#008751] animate-pulse" />
                        <span className="text-xs font-black tracking-[0.3em] text-[#008751] uppercase">
                            {t('Bénin')}
                        </span>
                        <div className="h-2 w-2 rounded-full bg-[#FCD116] animate-pulse" style={{ animationDelay: "200ms" }} />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ y: 20, opacity: 0, scale: 0.95 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
                    className="text-center mb-10 relative bg-white/60 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)]"
                >
                    <h2 className="text-base font-bold text-gray-800 leading-relaxed mx-auto">
                        <span className="block mb-2 text-transparent bg-clip-text bg-gradient-to-r from-[#008751] to-[#00a664]">{t("L'Agence d'Accompagnement")}</span>
                        <span className="font-medium text-gray-500 text-sm">{t("à la Nationalité et au Retour des")}</span><br />
                        <span className="text-lg font-black text-[#1a1a1a] uppercase tracking-wide mt-1 inline-block">{t("Afro-descendants")}</span>
                    </h2>
                </motion.div>

                {/* --- Image Immersion (Team / Brand) ---------------------------------------- */}
                <motion.div
                    initial={{ y: 30, opacity: 0, scale: 0.95 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.25, type: "spring" }}
                    className="relative w-full max-w-sm mx-auto h-[200px] mb-10 group rounded-[2rem] overflow-hidden shadow-[0_15px_40px_-10px_rgba(0,0,0,0.15)] border-4 border-white"
                >
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#008751]/20 to-[#FCD116]/20 z-10 mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                    <Image
                        src="https://ywvsfhqdtkgzavxsumnk.supabase.co/storage/v1/object/public/gallery/portfolio/image_RGB.jpg"
                        alt="Retour Gagnant Bénin"
                        fill
                        className="object-cover transform group-hover:scale-110 transition-transform duration-1000 ease-out"
                    />
                </motion.div>

                <div className="flex flex-col gap-5 mb-14 w-full">
                    <InteractionCard href="/" isPrimary delay={0.3}>
                        <div className="p-3.5 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner border border-white/30">
                            <Globe className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="font-bold text-xl text-white tracking-tight">{t("Portail Officiel")}</span>
                            <span className="text-white/80 text-xs font-medium uppercase tracking-wider mt-0.5">{t("Visiter notre plateforme")}</span>
                        </div>
                    </InteractionCard>

                    <InteractionCard href="https://wa.me/2290160322121" delay={0.4}>
                        <div className="relative p-3.5 bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] border border-white/80 rounded-2xl shadow-sm overflow-hidden group-hover:scale-110 transition-transform">
                            <div className="absolute inset-0 bg-[#008751]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Phone className="w-7 h-7 text-[#008751] relative z-10" />
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="font-bold text-gray-900 text-lg tracking-tight">{t("Direct WhatsApp 1")}</span>
                            <span className="text-[#008751] text-sm font-bold mt-0.5">+229 01 60 32 21 21</span>
                        </div>
                    </InteractionCard>

                    <InteractionCard href="https://wa.me/2290194355050" delay={0.5}>
                        <div className="relative p-3.5 bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] border border-white/80 rounded-2xl shadow-sm overflow-hidden group-hover:scale-110 transition-transform">
                            <div className="absolute inset-0 bg-[#008751]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Phone className="w-7 h-7 text-[#008751] relative z-10" />
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="font-bold text-gray-900 text-lg tracking-tight">{t("Direct WhatsApp 2")}</span>
                            <span className="text-[#008751] text-sm font-bold mt-0.5">+229 01 94 35 50 50</span>
                        </div>
                    </InteractionCard>

                    <InteractionCard href="mailto:contact@retourgagnantbenin.bj" delay={0.6}>
                        <div className="relative p-3.5 bg-gradient-to-br from-[#FFF9E6] to-[#FFE082] border border-white/80 rounded-2xl shadow-sm overflow-hidden group-hover:scale-110 transition-transform">
                            <div className="absolute inset-0 bg-[#FCD116]/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Mail className="w-7 h-7 text-[#D4AC0D] relative z-10" />
                        </div>
                        <div className="flex flex-col text-left w-full overflow-hidden">
                            <span className="font-bold text-gray-900 text-lg tracking-tight">{t("Support Email")}</span>
                            <span className="text-gray-500 text-xs font-semibold truncate w-full mt-0.5">contact@retourgagnantbenin.bj</span>
                        </div>
                    </InteractionCard>
                </div>

                <motion.div
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.7, type: "spring" }}
                    className="w-full relative"
                >
                    <div className="flex items-center justify-center gap-4 mb-8">
                        <div className="h-[2px] w-8 bg-gradient-to-r from-transparent to-[#008751]/50 rounded-full" />
                        <h3 className="text-xs font-black text-[#008751] uppercase tracking-[0.3em] px-4 py-2 bg-white/80 backdrop-blur-md rounded-full shadow-sm border border-white">
                            {t("Nos 9 Expertises")}
                        </h3>
                        <div className="h-[2px] w-8 bg-gradient-to-l from-transparent to-[#008751]/50 rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {services.map((service, index) => (
                            <motion.a
                                key={index}
                                href={`/services/${service.slug}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.8 + (index * 0.1) }}
                                whileHover={{ scale: 1.03, y: -2 }}
                                whileTap={{ scale: 0.97 }}
                                className={`
                                    group relative flex items-center gap-4 p-5 rounded-[2rem] border transition-all cursor-pointer overflow-hidden no-underline
                                    ${service.bg} ${service.text}
                                    ${service.bg === 'bg-white' ? 'border-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.06)]' : 'border-white/20 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.15)]'}
                                `}
                            >
                                {service.bg !== 'bg-white' && (
                                    <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-white to-transparent pointer-events-none" />
                                )}

                                <div className={`w-14 h-14 shrink-0 rounded-[1.2rem] ${service.iconBg} flex items-center justify-center font-black text-lg shadow-inner ring-1 ring-white/30 relative z-10`}>
                                    {service.id}
                                </div>
                                <div className="flex-1 min-w-0 relative z-10">
                                    <h4 className="font-extrabold text-base truncate mb-0.5 tracking-tight">
                                        {service.title}
                                    </h4>
                                    <p className={`text-xs font-semibold truncate ${service.bg === 'bg-white' ? 'text-gray-500' : 'text-white/80'}`}>
                                        {service.desc}
                                    </p>
                                </div>
                                <div className="shrink-0 relative z-10">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:translate-x-0.5 ${service.bg === 'bg-white' ? 'bg-gray-50 text-gray-400 group-hover:bg-[#008751] group-hover:text-white' : 'bg-white/10 text-white/70 group-hover:bg-white/30'}`}>
                                        <ChevronRight className="w-5 h-5" />
                                    </div>
                                </div>
                            </motion.a>
                        ))}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 1.5 }}
                    className="mt-20 text-center pb-8"
                >
                    <motion.a
                        href="https://maps.google.com/maps?q=6.3572222,2.3953333(Retour+Gagnant+Bénin)"
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="inline-flex items-center justify-center gap-3 py-3.5 px-8 rounded-full bg-white/90 border border-white shadow-[0_10px_30px_rgb(0,0,0,0.08)] backdrop-blur-xl group"
                    >
                        <MapPin className="w-5 h-5 text-[#E8112D] group-hover:animate-bounce" />
                        <span className="font-extrabold text-sm text-[#1a1a1a]">{t("Haie Vive, Cotonou, Bénin")}</span>
                    </motion.a>

                    <div className="mt-10 flex flex-col items-center justify-center gap-2">
                        <div className="w-12 h-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent rounded-full" />
                        <p className="text-[9px] text-gray-400 uppercase tracking-[0.3em] font-black">
                            © {new Date().getFullYear()} {t('Retour Gagnant Bénin')}
                        </p>
                    </div>
                </motion.div>

            </div>
        </div>
    )
}
