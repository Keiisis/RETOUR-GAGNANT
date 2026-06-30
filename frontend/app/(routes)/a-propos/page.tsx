'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Target, Heart, Globe, Users, Award, ArrowRight, type LucideIcon } from 'lucide-react';
import { usePageSections } from '@/lib/hooks/usePageSections';
import { useTranslation, T } from '@/lib/translation';

interface ValueItem {
    icon?: LucideIcon
    title: string
    desc?: string
    description?: string
}

const values: ValueItem[] = [
    { icon: Target, title: "Excellence", desc: "Un service irréprochable à chaque étape de votre retour." },
    { icon: Heart, title: "Engagement", desc: "Votre réussite est notre mission première." },
    { icon: Globe, title: "Proximité", desc: "Présents au Bénin et dans la diaspora." },
    { icon: Users, title: "Confiance", desc: "Plus de 500 familles nous ont fait confiance." },
];

interface TeamMember {
    name: string
    role: string
    emoji: string
}

const team: TeamMember[] = [
    { name: "Équipe Juridique", role: "Passeports & Documents", emoji: "⚖️" },
    { name: "Équipe Immobilier", role: "Logement & Construction", emoji: "🏠" },
    { name: "Équipe Business", role: "Investissement & Entreprise", emoji: "💼" },
    { name: "Équipe Culture", role: "Guide & Accompagnement", emoji: "🌍" },
];

export default function AProposPage() {
    const { t } = useTranslation()
    const { sections } = usePageSections('a-propos')
    const dynamicValues = (sections.values as unknown as ValueItem[]) || values
    const dynamicTeam = (sections.team as unknown as TeamMember[]) || team

    return (
        <div className="min-h-screen">
            {/* Hero */}
            <section className="relative py-24 bg-gradient-to-br from-[#0f141e] via-[#1a2a3a] to-[#0f141e] text-white overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-[#008751] blur-[120px]" />
                    <div className="absolute bottom-10 right-10 w-72 h-72 rounded-full bg-[#FCD116] blur-[120px]" />
                </div>

                <div className="container mx-auto px-4 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="max-w-3xl mx-auto text-center"
                    >
                        <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-[#FCD116] text-sm font-semibold tracking-widest uppercase mb-6 border border-white/10">
                            <T>À Propos</T>
                        </span>
                        <h1 className="text-4xl md:text-6xl font-bold font-heading mb-6">
                            <T>Votre Retour,</T>{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]">
                                <T>Notre Mission</T>
                            </span>
                        </h1>
                        <p className="text-xl text-white/70 leading-relaxed">
                            <T>Retour Gagnant accompagne la diaspora béninoise dans toutes les étapes de son retour.</T>
                            <br /><T>Du passeport à l&apos;investissement, nous transformons votre rêve de retour en réalité concrète.</T>
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Mission */}
            <section className="py-20 bg-white">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="space-y-6"
                        >
                            <span className="text-[#E8112D] font-bold tracking-widest uppercase text-sm"><T>Notre Histoire</T></span>
                            <h2 className="text-3xl md:text-4xl font-bold font-heading text-[#1a2332]">
                                <T>Née de la diaspora,</T><br /><T>pour la diaspora</T>
                            </h2>
                            <p className="text-gray-600 leading-relaxed text-lg">
                                <T>Fondée par des membres de la diaspora béninoise ayant eux-mêmes vécu l&apos;expérience du retour, Retour Gagnant est née d&apos;un constat simple : rentrer au pays ne devrait pas être un parcours du combattant.</T>
                            </p>
                            <p className="text-gray-600 leading-relaxed">
                                <T>Aujourd&apos;hui, nous avons accompagné plus de 500 projets de retour réussis. Des passeports aux investissements immobiliers, en passant par la création d&apos;entreprise, nous sommes le partenaire de confiance de la diaspora.</T>
                            </p>
                            <Link href="/rendez-vous">
                                <Button className="bg-[#008751] text-white hover:bg-[#006B40] mt-4 font-semibold px-8 py-6 text-base rounded-xl">
                                    <T>Planifier un appel gratuit</T> <ArrowRight className="ml-2" size={18} />
                                </Button>
                            </Link>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="relative h-[450px] rounded-2xl overflow-hidden shadow-2xl"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-[#008751] via-[#FCD116]/30 to-[#E8112D]/20 flex items-center justify-center">
                                <span className="text-8xl">🇧🇯</span>
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-8">
                                <p className="text-white font-heading font-bold text-xl"><T>Cotonou, Bénin</T></p>
                                <p className="text-white/70 text-sm"><T>Siège de Retour Gagnant</T></p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Values */}
            <section className="py-20 bg-gray-50">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <span className="text-[#E8112D] font-bold tracking-widest uppercase text-sm mb-2 block"><T>Nos Valeurs</T></span>
                        <h2 className="text-3xl md:text-4xl font-bold font-heading text-[#1a2332]">
                            <T>Ce qui nous</T> <span className="text-[#008751]"><T>anime</T></span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
                        {dynamicValues.map((v, i) => {
                            const IconComp = v.icon && typeof v.icon !== 'string' ? v.icon : null
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    className="bg-white rounded-2xl p-8 text-center shadow-sm hover:shadow-lg transition-shadow border border-gray-100"
                                >
                                    <div className="w-14 h-14 rounded-xl bg-[#008751]/10 flex items-center justify-center mx-auto mb-4">
                                        {IconComp ? <IconComp className="text-[#008751]" size={28} /> : <Target className="text-[#008751]" size={28} />}
                                    </div>
                                    <h3 className="font-bold text-lg text-[#1a2332] mb-2">{t(v.title)}</h3>
                                    <p className="text-gray-500 text-sm">{v.desc ? t(v.desc) : v.description ? t(v.description) : ''}</p>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* Team */}
            <section className="py-20 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <span className="text-[#E8112D] font-bold tracking-widest uppercase text-sm mb-2 block"><T>Notre Équipe</T></span>
                        <h2 className="text-3xl md:text-4xl font-bold font-heading text-[#1a2332]">
                            <T>Des experts</T> <span className="text-[#FCD116]"><T>dédiés</T></span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                        {dynamicTeam.map((m, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.95 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-gradient-to-br from-[#0f141e] to-[#1a2a3a] rounded-2xl p-6 text-center group hover:scale-105 transition-transform"
                            >
                                <div className="text-5xl mb-4">{m.emoji}</div>
                                <h3 className="font-bold text-white mb-1">{t(m.name)}</h3>
                                <p className="text-white/50 text-sm">{t(m.role)}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 bg-gradient-to-r from-[#008751] via-[#006B40] to-[#008751] text-white">
                <div className="container mx-auto px-4 text-center">
                    <Award className="mx-auto mb-6 text-[#FCD116]" size={48} />
                    <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4">
                        <T>Prêt à commencer votre retour ?</T>
                    </h2>
                    <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
                        <T>Rejoignez les centaines de membres de la diaspora qui nous ont fait confiance.</T>
                    </p>
                    <Link href="/rendez-vous">
                        <Button className="bg-[#FCD116] text-[#1a2332] hover:bg-[#e5c014] font-bold px-10 py-6 text-lg rounded-xl shadow-xl">
                            <T>Réserver un appel gratuit</T>
                        </Button>
                    </Link>
                </div>
            </section>
        </div>
    );
}
