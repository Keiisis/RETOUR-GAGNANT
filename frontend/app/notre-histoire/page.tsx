'use client'

import { motion, useScroll, useTransform, useInView, useMotionValue, useSpring } from 'framer-motion'
import { useRef, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, CaretDown as ChevronDown } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button'
import { T, useTranslation } from '@/lib/translation'
import { usePageSections } from '@/lib/hooks/usePageSections'

/* ═══════════════════════════════════════════════════════════════
   DEFAULTS (fallback si base de données vide)
   ═══════════════════════════════════════════════════════════════ */

const D = {
    hero: {
        title_line1: "Là où l'histoire s'est interrompue,",
        title_line2: "nous réécrivons l'avenir.",
        subtitle: "RETOUR GAGNANT BENIN n'est pas qu'une agence. C'est le pont d'or jeté entre un passé retrouvé et un avenir à construire.",
        image: '/images/histoire/trio.jpeg',
    },
    rencontre: {
        image: '/images/histoire/rencontre-martinique.jpeg',
        image_caption_label: 'Martinique • Décembre 2023',
        image_caption_sub: 'Là où tout a commencé',
        block1_heading: "Une rencontre, une vision, une loi historique.",
        block1_text: "Tout commence par une détermination inébranlable. Mme NATHALIE RIFFERT GERMANY, femme engagée et passionnée, a porté en elle le rêve d'un retour au pays après 400 ans d'absence. Ce rêve est devenu réalité grâce à une rencontre décisive.",
        block2_quote: "Le 13 décembre 2023, en Martinique — un dialogue historique s'est noué entre trois acteurs majeurs : Mr GEORGES GERMANY, Mme NATHALIE RIFFERT GERMANY et le Chef de l'État béninois, S.E.M. PATRICE TALON.",
        block3_text1: "C'est lors de cet échange que l'idée de rendre à tous les afro-descendants leur identité originelle a pris corps. À la demande de Nathalie, cette vision s'est élargie à l'ensemble des Caraïbes.",
        block3_text2: "Aujourd'hui, le Président Patrice Talon entre dans l'histoire de l'humanité en ouvrant les bras à des milliers de frères et sœurs. Une nouvelle page s'écrit — avec lui, avec nous, et avec vous.",
    },
    fondatrice: {
        photo: '/images/histoire/nathalie-new.jpg',
        name: 'Mme NATHALIE RIFFERT GERMANY',
        title_label: 'Fondatrice',
        section_heading: 'Les Mots de la Fondatrice',
        quote: "Mon souhait le plus cher est que ce retour soit une empreinte indélébile de réussite. Je me suis pleinement investie pour que chaque afro-descendant retrouve non seulement sa terre, mais aussi sa place et sa dignité, dans le respect du vivre ensemble.",
        closing: 'Bonne arrivée à tous !',
    },
    architectes: {
        heading: 'Les architectes du changement',
        portraits: [
            { image: '/images/histoire/talon.jpeg', name: 'S.E.M. PATRICE TALON', role: 'Président de la République du Bénin', phrase: "Le visionnaire de l'accueil" },
            { image: '/images/histoire/georges-1.jpeg', name: 'Mr GEORGES GERMANY', role: 'Cofondateur', phrase: 'Le bâtisseur de ponts' },
            { image: '/images/histoire/nathalie-new.jpg', name: 'Mme NATHALIE RIFFERT GERMANY', role: 'Fondatrice', phrase: 'La flamme qui a tout allumé' },
        ],
    },
    logo: {
        heading: "L'Énigme du Symbole",
        logo_image: '/images/logo-transparent.png',
        symbols: [
            { title: 'La Porte Sculptée', text: "L'accès sécurisé et facilité au Bénin d'aujourd'hui. Elle symbolise l'Accueil, la Protection et l'Authenticité — des lignes rappelant l'artisanat local, signe de respect pour nos traditions séculaires." },
            { title: "L'Arbre de Vie", text: "La transformation de «l'Arbre de l'Oubli» en un Arbre de Vie. Il incarne la Solidité, la Prospérité et la Renaissance — la reconnexion spirituelle et physique avec la terre nourricière." },
            { title: 'Notre Signature', text: "L'harmonie de ces symboles forme une image puissante : celle de la maison retrouvée. Choisir Retour GAGNANT, c'est choisir la stabilité, la réussite et la fierté de bâtir le Bénin moderne." },
        ],
    },
    confiance: {
        heading: "L'appui des institutions",
        subtitle: "Une mission reconnue et soutenue. Chaque document est une pierre posée dans l'édifice de la confiance.",
        main_image: '/images/histoire/attestation-1.jpeg',
        main_title: "Ce document, c'est bien plus que du papier.",
        main_text1: "Il porte en lui des années de démarches, de doutes, de nuits blanches et de conversations qui n'en finissaient pas. Il porte surtout la preuve que quand on croit profondément en quelque chose, les murs finissent par céder.",
        main_text2: "Chaque tampon, chaque signature raconte une porte qui s'est ouverte. Chaque page est le témoignage silencieux d'un combat mené avec patience, avec cœur, sans jamais baisser les bras.",
        main_text3: "Voir ce rêve inscrit dans le marbre officiel, c'est la plus belle des récompenses. Pas pour nous — pour toutes les familles qui, demain, pourront dire : je suis rentré chez moi.",
        engagement_image: '/images/histoire/integre-causes.jpeg',
        carousel: [
            '/images/histoire/attestation-debut.jpeg',
            '/images/histoire/attestation-2.jpeg',
            '/images/histoire/attestation-3.jpeg',
            '/images/histoire/attestation-4.jpeg',
            '/images/histoire/attestation-5.jpeg',
            '/images/histoire/logo.jpeg',
        ],
    },
    cta: {
        heading_line1: "Une page s'écrit",
        heading_line2: 'avec vous.',
        subtitle: "Choisir Retour Gagnant, c'est choisir la maison retrouvée. Rejoignez les centaines de familles qui ont fait le voyage du retour en toute sécurité.",
        btn_primary_text: 'Je demande un Rendez-vous',
        btn_primary_href: '/rendez-vous',
        btn_secondary_text: 'Nous contacter',
        btn_secondary_href: '/contact',
    },
}

type SectionData = typeof D

/* ═══════════════════════════════════════════════════════════════
   COMPOSANT — LIGNE DE VIE DORÉE
   ═══════════════════════════════════════════════════════════════ */

function GoldenDivider() {
    const ref = useRef<HTMLDivElement>(null)
    const isInView = useInView(ref, { once: true, margin: '-50px' })

    return (
        <div ref={ref} className="flex justify-center py-12">
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={isInView ? { height: 80, opacity: 1 } : {}}
                transition={{ duration: 1.2, ease: 'easeOut' as const }}
                className="w-[1px] bg-gradient-to-b from-transparent via-[#D4A017] to-transparent"
            />
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   COMPOSANT — TYPEWRITER EFFECT
   ═══════════════════════════════════════════════════════════════ */

function TypewriterText({ text, className, delay = 0 }: { text: string, className?: string, delay?: number }) {
    const [displayed, setDisplayed] = useState('')
    const ref = useRef<HTMLSpanElement>(null)
    const isInView = useInView(ref, { once: true })

    useEffect(() => {
        if (!isInView) return
        let i = 0
        const timer = setTimeout(() => {
            const interval = setInterval(() => {
                if (i < text.length) {
                    setDisplayed(text.slice(0, i + 1))
                    i++
                } else {
                    clearInterval(interval)
                }
            }, 35)
            return () => clearInterval(interval)
        }, delay)
        return () => clearTimeout(timer)
    }, [isInView, text, delay])

    return (
        <span ref={ref} className={className}>
            {displayed}
            {displayed.length < text.length && (
                <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="inline-block w-[2px] h-[1em] bg-[#D4A017] ml-1 align-middle"
                />
            )}
        </span>
    )
}

/* ═══════════════════════════════════════════════════════════════
   COMPOSANT — TILT 3D CARD (pour attestations)
   ═══════════════════════════════════════════════════════════════ */

function TiltCard({ src, children }: { src: string, children?: React.ReactNode }) {
    const ref = useRef<HTMLDivElement>(null)
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 200, damping: 20 })
    const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 200, damping: 20 })

    const handleMouse = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return
        const rect = ref.current.getBoundingClientRect()
        x.set((e.clientX - rect.left) / rect.width - 0.5)
        y.set((e.clientY - rect.top) / rect.height - 0.5)
    }, [x, y])

    const handleLeave = useCallback(() => {
        x.set(0)
        y.set(0)
    }, [x, y])

    return (
        <motion.div
            ref={ref}
            style={{ rotateX, rotateY, transformPerspective: 800 }}
            onMouseMove={handleMouse}
            onMouseLeave={handleLeave}
            className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg shadow-gray-200/40 bg-white border border-gray-100 cursor-pointer group"
        >
            <Image src={src} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
            {children}
        </motion.div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 — HERO
   ═══════════════════════════════════════════════════════════════ */

function HeroSection({ data }: { data: SectionData['hero'] }) {
    const { t } = useTranslation()
    const ref = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
    const yImage = useTransform(scrollYProgress, [0, 1], [0, 150])
    const opacityContent = useTransform(scrollYProgress, [0, 0.6], [1, 0])
    const [curtainLifted, setCurtainLifted] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setCurtainLifted(true), 300)
        return () => clearTimeout(timer)
    }, [])

    return (
        <section ref={ref} className="relative min-h-screen flex flex-col items-center justify-end overflow-hidden bg-white">
            <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: curtainLifted ? 0 : 1 }}
                transition={{ duration: 1.8, ease: 'easeOut' as const }}
                className="absolute inset-0 bg-white z-30 pointer-events-none"
            />
            <motion.div style={{ y: yImage }} className="absolute inset-0 z-0">
                <motion.div
                    initial={{ scale: 1.05, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 2.5, ease: 'easeOut' as const }}
                    className="absolute inset-0"
                >
                    <Image
                        src={data.image}
                        alt={t("Nathalie Riffert Germany, Georges-Emmanuel Germany et S.E.M. Patrice Talon")}
                        fill
                        className="object-cover object-top"
                        priority
                    />
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
            </motion.div>

            <motion.div
                style={{ opacity: opacityContent }}
                className="relative z-10 text-center px-6 max-w-5xl mx-auto pb-20"
            >
                <motion.h1
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 1.5 }}
                    className="text-4xl sm:text-5xl md:text-7xl font-black font-heading tracking-tight leading-[1.05] text-gray-900 mb-8"
                >
                    <TypewriterText text={t(data.title_line1)} delay={1800} />
                    <br />
                    <span className="text-[#008751]">
                        <TypewriterText text={t(data.title_line2)} delay={3400} />
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 5 }}
                    className="text-xl md:text-2xl text-gray-900 max-w-3xl mx-auto leading-relaxed font-semibold mb-12"
                >
                    {t(data.subtitle)}
                </motion.p>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 5.5 }}>
                    <motion.a
                        href="#suite"
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' as const }}
                        className="inline-flex flex-col items-center gap-2 text-gray-400 hover:text-[#008751] transition-colors"
                    >
                        <span className="text-xs uppercase tracking-widest font-black"><T>Découvrir</T></span>
                        <ChevronDown className="w-5 h-5" />
                    </motion.a>
                </motion.div>
            </motion.div>
        </section>
    )
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 2 — LA RENCONTRE
   ═══════════════════════════════════════════════════════════════ */

function ChapitreRencontre({ data }: { data: SectionData['rencontre'] }) {
    const { t } = useTranslation()
    const containerRef = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start end', 'end start'] })
    const lineHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

    return (
        <section id="suite" className="relative bg-[#FAFBFC] overflow-hidden">
            <div ref={containerRef} className="container mx-auto px-6 max-w-7xl">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-[200vh] relative">

                    {/* Image Sticky desktop */}
                    <div className="hidden lg:block relative">
                        <div className="sticky top-0 h-screen flex items-center justify-center p-8">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 1.2, ease: 'easeOut' as const }}
                                className="relative w-full h-[80vh] overflow-hidden shadow-2xl shadow-gray-300/40 border border-gray-100"
                            >
                                <Image src={data.image} alt={t("Première rencontre en Martinique")} fill className="object-cover" />
                                <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-gray-900/90 to-transparent">
                                    <p className="text-white text-sm font-black uppercase tracking-widest">{t(data.image_caption_label)}</p>
                                    <p className="text-white/70 text-xs mt-1">{t(data.image_caption_sub)}</p>
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    {/* Texte + Timeline */}
                    <div className="relative py-16 lg:py-32 flex flex-col gap-16 md:gap-24">
                        <div className="absolute left-0 lg:left-8 top-0 bottom-0 w-[1px] bg-gray-200 overflow-hidden">
                            <motion.div style={{ height: lineHeight }} className="w-full bg-[#D4A017]" />
                        </div>

                        {/* Image mobile */}
                        <div className="block lg:hidden relative h-72 overflow-hidden shadow-xl border border-gray-100 ml-8">
                            <Image src={data.image} alt={t("Martinique")} fill className="object-cover" />
                        </div>

                        {/* Bloc 1 */}
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-100px' }}
                            transition={{ duration: 0.8, ease: 'easeOut' as const }}
                            className="ml-8 lg:ml-16 p-8 md:p-12 bg-white border border-gray-100 shadow-xl shadow-gray-200/30"
                        >
                            <h2 className="text-3xl md:text-5xl font-black font-heading text-gray-900 leading-tight mb-8">
                                {t(data.block1_heading).split(',').map((part, i, arr) => (
                                    <span key={i}>
                                        {part.trim()}{i < arr.length - 1 ? ',' : ''}
                                        {i < arr.length - 1 && <br />}
                                    </span>
                                ))}
                            </h2>
                            <p className="text-lg text-gray-600 leading-relaxed">{t(data.block1_text)}</p>
                        </motion.div>

                        {/* Bloc 2 — citation */}
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-100px' }}
                            transition={{ duration: 0.8, ease: 'easeOut' as const }}
                            className="ml-8 lg:ml-16 p-8 md:p-12 bg-gray-50 border-l-[3px] border-[#D4A017] shadow-xl shadow-gray-200/30"
                        >
                            <p className="text-xl text-gray-800 leading-relaxed font-serif italic">{t(data.block2_quote)}</p>
                        </motion.div>

                        {/* Bloc 3 */}
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-100px' }}
                            transition={{ duration: 0.8, ease: 'easeOut' as const }}
                            className="ml-8 lg:ml-16 p-8 md:p-12 bg-white border border-gray-100 shadow-xl shadow-gray-200/30"
                        >
                            <p className="text-lg text-gray-600 leading-relaxed mb-6">{t(data.block3_text1)}</p>
                            <p className="text-xl text-gray-900 font-semibold leading-snug">{t(data.block3_text2)}</p>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    )
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3 — MOT DE LA FONDATRICE
   ═══════════════════════════════════════════════════════════════ */

function ChapitreFondatrice({ data }: { data: SectionData['fondatrice'] }) {
    const { t } = useTranslation()
    return (
        <section className="relative bg-white border-y border-gray-100">
            <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
                <div className="relative h-[60vh] lg:h-auto w-full lg:sticky lg:top-0 overflow-hidden border-r border-gray-100">
                    <motion.div
                        animate={{ scale: [1, 1.08, 1.04] }}
                        transition={{ duration: 24, repeat: Infinity, ease: 'linear' as const }}
                        className="absolute inset-0"
                    >
                        <Image src={data.photo} alt={data.name} fill className="object-cover object-center" />
                    </motion.div>
                    <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-gray-900/60 to-transparent" />
                    <div className="absolute bottom-8 left-8 lg:bottom-12 lg:left-12">
                        <div className="text-white">
                            <p className="font-black text-2xl font-heading mb-1">{data.name}</p>
                            <p className="text-[#D4A017] text-xs font-bold uppercase tracking-widest">{t(data.title_label)}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-center p-6 py-10 md:py-16 lg:p-20 xl:p-32 bg-white">
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 1, ease: 'easeOut' as const }}
                        className="max-w-lg"
                    >
                        <h3 className="text-3xl md:text-4xl lg:text-5xl font-black font-heading text-gray-900 mb-8 md:mb-12 leading-tight">
                            {t(data.section_heading)}
                        </h3>
                        <div className="relative">
                            <blockquote className="text-lg md:text-xl lg:text-2xl text-gray-800 leading-relaxed font-serif italic border-l-[3px] border-gray-300 pl-6 md:pl-8">
                                {t(data.quote)}
                            </blockquote>
                        </div>
                        <motion.p
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' as const }}
                            className="mt-8 md:mt-12 text-xl md:text-2xl font-black text-[#008751] font-heading"
                        >
                            {t(data.closing)}
                        </motion.p>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4 — LES ARCHITECTES
   ═══════════════════════════════════════════════════════════════ */

function ChapitreArchitectes({ data }: { data: SectionData['architectes'] }) {
    const { t } = useTranslation()
    return (
        <section className="relative bg-[#FAFBFC] py-16 md:py-32 overflow-hidden">
            <div className="container mx-auto px-6 max-w-[1400px]">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.8, ease: 'easeOut' as const }}
                    className="text-center mb-10 md:mb-20"
                >
                    <h2 className="text-3xl md:text-4xl lg:text-6xl font-black font-heading text-gray-900">
                        {t(data.heading).split(' ').map((word, i, arr) => {
                            const isLast = i === arr.length - 1
                            return isLast
                                ? <span key={i} className="text-[#008751]">{word}</span>
                                : <span key={i}>{word} </span>
                        })}
                    </h2>
                </motion.div>

                <div className="flex flex-col lg:flex-row gap-[1px] lg:h-[85vh] bg-gray-200 border border-gray-200">
                    {data.portraits.map((p, i) => (
                        <motion.div
                            key={p.name}
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: i * 0.2, ease: 'easeOut' as const }}
                            className="relative w-full lg:w-auto lg:flex-1 h-[50vh] sm:h-[60vh] lg:h-full overflow-hidden group cursor-pointer bg-white"
                        >
                            <Image
                                src={p.image}
                                alt={p.name}
                                fill
                                className="object-cover object-top filter contrast-[1.05] group-hover:scale-105 transition-all duration-[1500ms] ease-out"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-700" />
                            <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-10 lg:translate-y-[20%] lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 transition-all duration-700 ease-out z-20">
                                <p className="text-[#D4A017] text-xs font-bold uppercase tracking-[0.2em] mb-2 lg:mb-3">{t(p.phrase)}</p>
                                <p className="text-white text-lg md:text-2xl lg:text-3xl font-black font-heading leading-tight mb-1">{p.name}</p>
                                <p className="text-white/80 text-xs sm:text-sm font-medium">{t(p.role)}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 5 — LE LOGO
   ═══════════════════════════════════════════════════════════════ */

function ChapitreLogo({ data }: { data: SectionData['logo'] }) {
    const { t } = useTranslation()
    return (
        <section className="relative bg-white py-16 md:py-32 overflow-hidden border-y border-gray-100">
            <div className="container mx-auto px-6 max-w-7xl">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.8, ease: 'easeOut' as const }}
                    className="text-center mb-12 md:mb-24"
                >
                    <h2 className="text-3xl md:text-4xl lg:text-6xl font-black font-heading text-gray-900 leading-tight">
                        {t(data.heading)}
                    </h2>
                </motion.div>

                <div className="flex flex-col lg:flex-row items-center gap-10 md:gap-16 lg:gap-24 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.5, ease: 'easeOut' as const }}
                        className="w-full lg:w-1/2 flex justify-center relative"
                    >
                        <Image
                            src={data.logo_image}
                            alt="Logo Retour Gagnant Bénin"
                            width={500}
                            height={500}
                            className="object-contain w-full max-w-[500px] h-auto"
                        />
                    </motion.div>

                    <div className="w-full lg:w-1/2 space-y-8 md:space-y-12">
                        {data.symbols.map((s, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: 40 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: '-50px' }}
                                transition={{ duration: 0.8, delay: i * 0.2, ease: 'easeOut' as const }}
                                className="pl-6 border-l-[3px] border-gray-200 hover:border-[#D4A017] transition-colors duration-500"
                            >
                                <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-3 font-heading">{t(s.title)}</h3>
                                <p className="text-gray-600 text-base md:text-lg leading-relaxed">{t(s.text)}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 6 — CONFIANCE
   ═══════════════════════════════════════════════════════════════ */

function ChapitreConfiance({ data }: { data: SectionData['confiance'] }) {
    const { t } = useTranslation()
    const scrollRef = useRef<HTMLDivElement>(null)

    return (
        <section className="relative bg-[#FAFBFC] py-16 md:py-32 overflow-hidden">
            <div className="container mx-auto px-6 max-w-7xl">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.8, ease: 'easeOut' as const }}
                    className="text-center mb-10 md:mb-20"
                >
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-black font-heading text-gray-900">
                        {t(data.heading)}
                    </h2>
                    <p className="text-gray-500 max-w-2xl mx-auto mt-4 md:mt-6 text-base md:text-lg leading-relaxed">
                        {t(data.subtitle)}
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: 'easeOut' as const }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center mb-10 md:mb-20"
                >
                    <div className="relative h-[280px] sm:h-[380px] md:h-[500px] overflow-hidden shadow-xl border border-gray-100">
                        <Image src={data.main_image} alt="Document officiel" fill className="object-cover" />
                    </div>
                    <div>
                        <p className="text-xl md:text-2xl lg:text-3xl text-gray-900 font-heading font-black leading-snug mb-4 md:mb-6">
                            {t(data.main_title)}
                        </p>
                        <p className="text-base md:text-lg text-gray-600 leading-relaxed mb-4 md:mb-6">{t(data.main_text1)}</p>
                        <p className="text-base md:text-lg text-gray-600 leading-relaxed mb-4 md:mb-6">{t(data.main_text2)}</p>
                        <p className="text-base md:text-lg lg:text-xl text-gray-900 font-semibold leading-relaxed">
                            {t(data.main_text3).split('je suis rentré chez moi').map((part, i, arr) => (
                                <span key={i}>
                                    {part}
                                    {i < arr.length - 1 && <em className="text-[#008751]">{t("je suis rentré chez moi")}</em>}
                                </span>
                            ))}
                        </p>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: 'easeOut' as const }}
                    className="relative h-[45vh] md:h-[60vh] lg:h-[70vh] w-full overflow-hidden mb-8 md:mb-16"
                >
                    <Image src={data.engagement_image} alt="Intégré dans les causes du pays" fill className="object-cover object-center" />
                </motion.div>

                <div
                    ref={scrollRef}
                    className="flex gap-8 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide [scrollbar-width:none] items-center justify-start xl:justify-center"
                >
                    {data.carousel.map((src, i) => (
                        <motion.div
                            key={src + i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeOut' as const }}
                            className="flex-shrink-0 w-64 md:w-80 snap-center"
                        >
                            <TiltCard src={src} />
                        </motion.div>
                    ))}
                </div>

                <p className="text-center text-gray-400 text-sm mt-10 font-bold tracking-widest uppercase">
                    <T>Glissez pour découvrir</T>
                </p>
            </div>
        </section>
    )
}

/* ═══════════════════════════════════════════════════════════════
   CTA FINAL
   ═══════════════════════════════════════════════════════════════ */

function CTAFinal({ data }: { data: SectionData['cta'] }) {
    const { t } = useTranslation()
    return (
        <section className="relative bg-white py-16 md:py-32 overflow-hidden border-t border-gray-100">
            <div className="container mx-auto px-6 text-center max-w-4xl relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: 'easeOut' as const }}
                >
                    <h2 className="text-3xl md:text-4xl lg:text-6xl font-black font-heading text-gray-900 leading-tight mb-6 md:mb-8">
                        {t(data.heading_line1)}<br />
                        <span className="text-[#008751]">{t(data.heading_line2)}</span>
                    </h2>

                    <p className="text-gray-500 text-base md:text-lg lg:text-xl leading-relaxed max-w-2xl mx-auto mb-10 md:mb-16">
                        {t(data.subtitle)}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6">
                        <Link href={data.btn_primary_href}>
                            <Button className="w-full sm:w-auto h-14 md:h-16 px-8 md:px-10 text-base md:text-lg font-black rounded-none bg-[#008751] text-white hover:bg-[#006B41] transition-all">
                                <T>{data.btn_primary_text}</T>
                                <ArrowRight className="ml-3 w-5 h-5 md:w-6 md:h-6" />
                            </Button>
                        </Link>
                        <Link href={data.btn_secondary_href}>
                            <Button variant="outline" className="w-full sm:w-auto h-14 md:h-16 px-8 md:px-10 text-base md:text-lg font-black rounded-none border-gray-900 text-gray-900 hover:bg-gray-100 transition-all">
                                <T>{data.btn_secondary_text}</T>
                            </Button>
                        </Link>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}

/* ═══════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
   ═══════════════════════════════════════════════════════════════ */

export default function NotreHistoirePage() {
    const { sections, loading } = usePageSections('notre-histoire')

    // Fusionner les données DB avec les defaults
    const data: SectionData = {
        hero: sections.hero ? { ...D.hero, ...sections.hero } : D.hero,
        rencontre: sections.rencontre ? { ...D.rencontre, ...sections.rencontre } : D.rencontre,
        fondatrice: sections.fondatrice ? { ...D.fondatrice, ...sections.fondatrice } : D.fondatrice,
        architectes: sections.architectes ? {
            ...D.architectes,
            ...sections.architectes,
            portraits: (sections.architectes as typeof D.architectes).portraits?.length
                ? (sections.architectes as typeof D.architectes).portraits
                : D.architectes.portraits
        } : D.architectes,
        logo: sections.logo ? {
            ...D.logo,
            ...sections.logo,
            symbols: (sections.logo as typeof D.logo).symbols?.length
                ? (sections.logo as typeof D.logo).symbols
                : D.logo.symbols
        } : D.logo,
        confiance: sections.confiance ? {
            ...D.confiance,
            ...sections.confiance,
            carousel: (sections.confiance as typeof D.confiance).carousel?.length
                ? (sections.confiance as typeof D.confiance).carousel
                : D.confiance.carousel
        } : D.confiance,
        cta: sections.cta ? { ...D.cta, ...sections.cta } : D.cta,
    }

    // Ne pas afficher tant que les données ne sont pas chargées (évite flash de contenu)
    if (loading) {
        return (
            <main className="bg-[#FAFBFC] min-h-screen flex items-center justify-center">
                <div className="w-1 h-20 bg-gradient-to-b from-transparent via-[#D4A017] to-transparent animate-pulse" />
            </main>
        )
    }

    return (
        <main className="bg-[#FAFBFC] text-gray-900 min-h-screen relative font-sans">
            <HeroSection data={data.hero} />
            <GoldenDivider />
            <ChapitreRencontre data={data.rencontre} />
            <GoldenDivider />
            <ChapitreFondatrice data={data.fondatrice} />
            <GoldenDivider />
            <ChapitreArchitectes data={data.architectes} />
            <GoldenDivider />
            <ChapitreLogo data={data.logo} />
            <GoldenDivider />
            <ChapitreConfiance data={data.confiance} />
            <CTAFinal data={data.cta} />
        </main>
    )
}
