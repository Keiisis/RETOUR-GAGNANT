'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import {
    Target, Users, Heart, Shield, Compass,
    ArrowRight, Lightbulb, Star,
    Globe, Handshake, Award
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TimelineSection, TimelineItem } from '@/components/histoire/TimelineSection'
import { FounderCard, FounderData } from '@/components/histoire/FounderCard'
import { usePageSections } from '@/lib/hooks/usePageSections'

/* ═══════════════════════════════════════════════════════════════
   DONNÉES ÉDITABLES — Remplacez par le vrai contenu des promoteurs
   ═══════════════════════════════════════════════════════════════ */

const founders: FounderData[] = [
    {
        name: 'Fondateur Principal',
        role: 'Directeur Général',
        quote: 'Le Bénin est une terre de promesses. Nous avons créé Retour Gagnant pour transformer ces promesses en réalité, un retour à la fois.',
    },
    {
        name: 'Co-Fondateur',
        role: 'Directeur des Opérations',
        quote: 'Chaque membre de la diaspora qui revient enrichit notre nation. Notre mission est de rendre ce retour aussi fluide qu\'un rêve.',
    },
    {
        name: 'Co-Fondatrice',
        role: 'Directrice Clientèle',
        quote: 'L\'accompagnement humain est au cœur de tout. Derrière chaque dossier, il y a une famille, une histoire, un espoir.',
    },
]

const timelineItems: TimelineItem[] = [
    {
        year: '2019',
        title: 'L\'Idée Germe',
        description: 'Confrontés aux difficultés administratives du retour, les fondateurs identifient un besoin criant : un accompagnement professionnel pour la diaspora béninoise.',
    },
    {
        year: '2020',
        title: 'La Fondation',
        description: 'Retour Gagnant Bénin est officiellement créé à Cotonou. Les premiers clients font confiance à cette vision audacieuse malgré un contexte mondial incertain.',
        highlight: true,
    },
    {
        year: '2021',
        title: 'Les Premiers Succès',
        description: 'Plus de 50 familles accompagnées avec succès. L\'agence étend ses services à l\'investissement immobilier et à la création d\'entreprise.',
    },
    {
        year: '2022',
        title: 'L\'Expansion',
        description: 'Ouverture de partenariats stratégiques en France, en Belgique et au Canada. L\'équipe passe de 3 à 12 collaborateurs dédiés.',
    },
    {
        year: '2023',
        title: 'La Reconnaissance',
        description: 'Retour Gagnant devient une référence incontournable. Les témoignages affluent, et le bouche-à-oreille propulse la réputation de l\'agence.',
        highlight: true,
    },
    {
        year: '2024',
        title: 'L\'Innovation Digitale',
        description: 'Lancement de la plateforme numérique pour digitaliser l\'accompagnement. Intégration de l\'IA pour personnaliser chaque parcours de retour.',
    },
    {
        year: 'Aujourd\'hui',
        title: 'La Vision Continue',
        description: 'Des centaines de retours réussis, une communauté grandissante, et une ambition intacte : faire du retour au Bénin une expérience gagnante pour tous.',
        highlight: true,
    },
]

const values = [
    {
        icon: Heart,
        title: 'Humanité',
        description: 'Chaque client est unique. Nous plaçons l\'humain au centre de chaque décision et de chaque action.',
    },
    {
        icon: Shield,
        title: 'Intégrité',
        description: 'Transparence totale, honnêteté absolue. Nous construisons la confiance par nos actes, pas nos mots.',
    },
    {
        icon: Target,
        title: 'Excellence',
        description: 'Nous visons la perfection dans chaque accompagnement. Le détail fait la différence.',
    },
    {
        icon: Compass,
        title: 'Innovation',
        description: 'Nous repoussons les limites pour offrir des solutions toujours plus efficaces et modernes.',
    },
]

const stats = [
    { value: '500+', label: 'Familles Accompagnées', icon: Users },
    { value: '12', label: 'Pays Couverts', icon: Globe },
    { value: '98%', label: 'Taux de Satisfaction', icon: Star },
    { value: '5', label: 'Années d\'Expertise', icon: Award },
]

/* ═══════════════════════════════════════════════════════════════ */

export default function NotreHistoirePage() {
    const { sections } = usePageSections('notre-histoire')
    const dynFounders = (sections.founders || founders) as unknown as FounderData[]
    const dynTimeline = (sections.timeline || timelineItems) as unknown as TimelineItem[]
    const dynStats = (sections.stats || stats) as unknown as typeof stats
    const dynValues = (sections.values || values) as unknown as typeof values

    const heroRef = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({
        target: heroRef,
        offset: ['start start', 'end start'],
    })
    const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
    const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95])

    return (
        <main className="bg-[#05080a] text-white overflow-hidden">

            {/* ═══════════════════════════════════════════ */}
            {/* SECTION 1 — HERO CINÉMATIQUE */}
            {/* ═══════════════════════════════════════════ */}
            <motion.section
                ref={heroRef}
                style={{ opacity: heroOpacity, scale: heroScale }}
                className="relative min-h-screen flex items-center justify-center overflow-hidden"
            >
                {/* Background layers */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#05080a] via-[#05080a]/80 to-[#05080a]" />
                    <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[#008751]/10 rounded-full blur-[150px]" />
                    <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-[#FCD116]/8 rounded-full blur-[120px]" />
                    <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-[#E8112D]/5 rounded-full blur-[100px]" />
                </div>

                <div className="relative z-10 container mx-auto px-6 text-center py-32">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.2 }}
                    >
                        <div className="flex items-center justify-center gap-3 mb-8">
                            <span className="w-16 h-[2px] bg-[#FCD116]" />
                            <span className="text-[#FCD116] font-black tracking-[0.5em] uppercase text-[10px]">Notre Histoire</span>
                            <span className="w-16 h-[2px] bg-[#FCD116]" />
                        </div>

                        <h1 className="text-5xl sm:text-6xl md:text-8xl font-black font-heading tracking-tighter leading-[0.9] mb-8">
                            N&eacute;s d&apos;une{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]">
                                Vision
                            </span>
                            <br />
                            <span className="text-gray-400 text-3xl sm:text-4xl md:text-5xl font-light italic tracking-normal">
                                Port&eacute;s par une Mission
                            </span>
                        </h1>

                        <p className="text-gray-400 max-w-2xl mx-auto text-base md:text-lg leading-relaxed font-light mb-12">
                            Derrière Retour Gagnant, il y a des visionnaires qui ont transformé un rêve en réalité.
                            Découvrez le parcours de ceux qui œuvrent chaque jour pour rendre votre retour au Bénin inoubliable.
                        </p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.8 }}
                            className="flex items-center justify-center gap-6"
                        >
                            <a href="#origine" className="group flex items-center gap-3 text-[#FCD116] font-bold text-sm uppercase tracking-widest hover:gap-5 transition-all">
                                Découvrir notre parcours
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </a>
                        </motion.div>
                    </motion.div>
                </div>

                {/* Scroll indicator */}
                <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
                >
                    <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-1.5">
                        <motion.div
                            animate={{ y: [0, 12, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-1.5 h-1.5 rounded-full bg-[#FCD116]"
                        />
                    </div>
                </motion.div>
            </motion.section>

            {/* ═══════════════════════════════════════════ */}
            {/* SECTION 2 — LE MONDE AVANT (Origin Story 1) */}
            {/* ═══════════════════════════════════════════ */}
            <section id="origine" className="py-24 md:py-32 relative">
                <div className="container mx-auto px-6 max-w-4xl">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="space-y-8"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-[#E8112D]/10 border border-[#E8112D]/20 flex items-center justify-center">
                                <Lightbulb size={22} className="text-[#E8112D]" />
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#E8112D]">Le Constat</span>
                                <h2 className="text-3xl md:text-4xl font-black font-heading tracking-tight">
                                    Le Monde Avant Retour Gagnant
                                </h2>
                            </div>
                        </div>

                        <div className="space-y-6 text-gray-400 text-base md:text-lg leading-relaxed pl-0 md:pl-16">
                            <p>
                                Pendant des décennies, les membres de la diaspora béninoise faisaient face à un paradoxe cruel :
                                le désir profond de revenir enrichir leur terre natale, confronté à un mur de complexités administratives,
                                juridiques et logistiques.
                            </p>
                            <p>
                                Les d&eacute;marches &eacute;taient opaques, les interlocuteurs dispers&eacute;s, et les arnaques fr&eacute;quentes.
                                Combien de projets de retour ont &eacute;t&eacute; abandonn&eacute;s faute d&apos;accompagnement ? Combien de r&ecirc;ves
                                ont &eacute;t&eacute; bris&eacute;s par la bureaucratie ?
                            </p>
                            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 border-l-2 border-l-[#FCD116]">
                                <p className="text-white/80 italic font-medium">
                                    &quot;Il fallait que quelqu&apos;un se l&egrave;ve et dise : plus jamais un retour ne sera un parcours du combattant.
                                    C&apos;est cette conviction qui a tout d&eacute;clench&eacute;.&quot;
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════ */}
            {/* SECTION 3 — TIMELINE INTERACTIVE (Origin 2-4) */}
            {/* ═══════════════════════════════════════════ */}
            <section className="py-24 md:py-32 relative">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-[#008751]/5 rounded-full blur-[120px]" />
                </div>

                <div className="container mx-auto px-6 max-w-5xl relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                        className="text-center mb-20"
                    >
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <span className="w-12 h-[2px] bg-[#008751]" />
                            <span className="text-[#008751] font-black tracking-[0.5em] uppercase text-[10px]">Notre Parcours</span>
                            <span className="w-12 h-[2px] bg-[#008751]" />
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black font-heading tracking-tighter">
                            De l&apos;Id&eacute;e &agrave; la{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008751] to-[#FCD116]">
                                R&eacute;alit&eacute;
                            </span>
                        </h2>
                    </motion.div>

                    <TimelineSection items={dynTimeline} />
                </div>
            </section>

            {/* ═══════════════════════════════════════════ */}
            {/* SECTION 4 — CHIFFRES CLÉS ANIMÉS (Origin 5) */}
            {/* ═══════════════════════════════════════════ */}
            <section className="py-20 relative">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {dynStats.map((stat: (typeof stats)[number], i: number) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                className="text-center p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-[#FCD116]/20 transition-all group"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                    <stat.icon size={24} className="text-[#FCD116]" />
                                </div>
                                <div className="text-4xl md:text-5xl font-black text-white font-heading tracking-tighter mb-2">
                                    {stat.value}
                                </div>
                                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    {stat.label}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════ */}
            {/* SECTION 5 — LES VISIONNAIRES */}
            {/* ═══════════════════════════════════════════ */}
            <section className="py-24 md:py-32 relative">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-[#E8112D]/5 rounded-full blur-[150px]" />
                </div>

                <div className="container mx-auto px-6 max-w-6xl relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                        className="text-center mb-16"
                    >
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <span className="w-12 h-[2px] bg-[#FCD116]" />
                            <span className="text-[#FCD116] font-black tracking-[0.5em] uppercase text-[10px]">Les Visionnaires</span>
                            <span className="w-12 h-[2px] bg-[#FCD116]" />
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black font-heading tracking-tighter mb-4">
                            Les Architectes du{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#008751]">
                                Changement
                            </span>
                        </h2>
                        <p className="text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">
                            Rencontrez les promoteurs qui ont donn&eacute; vie &agrave; cette vision et qui continuent de porter
                            l&apos;ambition de Retour Gagnant chaque jour.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {dynFounders.map((founder: FounderData, i: number) => (
                            <FounderCard key={founder.name} founder={founder} index={i} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════ */}
            {/* SECTION 6 — NOS VALEURS */}
            {/* ═══════════════════════════════════════════ */}
            <section className="py-24 md:py-32 relative">
                <div className="container mx-auto px-6 max-w-5xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                        className="text-center mb-16"
                    >
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <span className="w-12 h-[2px] bg-[#008751]" />
                            <span className="text-[#008751] font-black tracking-[0.5em] uppercase text-[10px]">ADN</span>
                            <span className="w-12 h-[2px] bg-[#008751]" />
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black font-heading tracking-tighter">
                            Nos{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008751] to-[#FCD116]">
                                Valeurs
                            </span>
                        </h2>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {dynValues.map((val: (typeof values)[number], i: number) => {
                            const IconComp = val.icon && typeof val.icon !== 'string' ? val.icon : Target
                            return (
                                <motion.div
                                    key={val.title}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.5, delay: i * 0.1 }}
                                    className="flex gap-6 p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-[#008751]/20 transition-all group"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-[#008751]/10 border border-[#008751]/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                        <IconComp size={24} className="text-[#008751]" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white font-heading tracking-tight mb-2">
                                            {val.title}
                                        </h3>
                                        <p className="text-sm text-gray-400 leading-relaxed">
                                            {val.description}
                                        </p>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════ */}
            {/* SECTION 7 — CTA FINAL */}
            {/* ═══════════════════════════════════════════ */}
            <section className="py-24 md:py-32 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#FCD116]/5 rounded-full blur-[200px]" />
                </div>

                <div className="container mx-auto px-6 text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="max-w-3xl mx-auto space-y-8"
                    >
                        <Handshake size={48} className="text-[#FCD116] mx-auto" />
                        <h2 className="text-4xl md:text-6xl font-black font-heading tracking-tighter">
                            Votre Retour Gagnant{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]">
                                Commence Ici
                            </span>
                        </h2>
                        <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
                            Rejoignez les centaines de familles qui ont fait confiance à notre expertise.
                            Prenons 15 minutes pour discuter de votre projet de retour.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link href="/rendez-vous">
                                <Button className="h-16 px-10 text-lg font-black rounded-full bg-[#FCD116] text-[#0f141e] hover:bg-[#008751] hover:text-white transition-all shadow-xl shadow-[#FCD116]/20 hover:shadow-[#008751]/20">
                                    Prendre Rendez-vous
                                </Button>
                            </Link>
                            <Link href="/contact">
                                <Button variant="outline" className="h-16 px-10 text-lg font-bold rounded-full border-white/10 text-white hover:bg-white/5 transition-all">
                                    Nous Contacter
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>
        </main>
    )
}
