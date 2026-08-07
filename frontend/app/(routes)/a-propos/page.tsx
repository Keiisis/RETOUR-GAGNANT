'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Target, Heart, Globe, Users, Medal as Award, ArrowRight, CaretRight as ChevronRight, type Icon as LucideIcon } from '@phosphor-icons/react';
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
    { name: "Équipe Juridique", role: "Passeports & Documents", emoji: "" },
    { name: "Équipe Immobilier", role: "Logement & Construction", emoji: "" },
    { name: "Équipe Business", role: "Investissement & Entreprise", emoji: "" },
    { name: "Équipe Culture", role: "Guide & Accompagnement", emoji: "" },
];

export default function AProposPage() {
    const { t } = useTranslation()
    const { sections } = usePageSections('a-propos')
    const dynamicValues = (sections.values as unknown as ValueItem[]) || values
    const dynamicTeam = (sections.team as unknown as TeamMember[]) || team

    return (
        <div className="min-h-screen bg-white text-slate-900">
            {/* Hero — clair, charte Bénin, Playfair */}
            <section className="relative overflow-hidden">
                <div className="absolute -inset-x-8 -top-24 h-[130%] bg-[radial-gradient(55%_55%_at_12%_0%,rgba(0,135,81,0.16),transparent),radial-gradient(42%_45%_at_92%_2%,rgba(252,209,22,0.16),transparent),linear-gradient(180deg,#FBFDFC,#FFFFFF)]" />
                <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-24 md:pt-28 pb-14 text-center">
                    <nav className="flex items-center justify-center gap-1.5 text-[13px] text-slate-400 mb-6">
                        <Link href="/" className="hover:text-[#008751]"><T>Accueil</T></Link><ChevronRight size={13} />
                        <span className="text-slate-600 font-medium"><T>Notre Histoire</T></span>
                    </nav>
                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-3xl mx-auto">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E6F3ED] text-[#00643C] text-[11px] font-black uppercase tracking-[0.15em] mb-5"><Heart size={13} weight="fill" /> <T>À Propos</T></span>
                        <h1 className="font-display text-4xl md:text-[3.7rem] font-bold leading-[1.04] tracking-[-0.02em]">
                            <T>Votre Retour,</T>{' '}
                            <span className="bg-gradient-to-br from-[#008751] via-[#0a7d52] to-[#00643C] bg-clip-text text-transparent italic"><T>Notre Mission</T></span>
                        </h1>
                        <p className="mt-5 text-[17px] md:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
                            <T>Retour Gagnant accompagne la diaspora béninoise dans toutes les étapes de son retour.</T> <T>Du passeport à l&apos;investissement, nous transformons votre rêve de retour en réalité concrète.</T>
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
                            <h2 className="text-3xl md:text-4xl font-bold font-display text-[#1a2332]">
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
                                <p className="text-white font-display font-bold text-xl"><T>Cotonou, Bénin</T></p>
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
                        <h2 className="text-3xl md:text-4xl font-bold font-display text-[#1a2332]">
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
                        <h2 className="text-3xl md:text-4xl font-bold font-display text-[#1a2332]">
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
                                className="bg-white rounded-2xl p-6 text-center group hover:-translate-y-1 hover:border-[#008751]/40 hover:shadow-[0_20px_50px_-24px_rgba(0,135,81,0.4)] border border-slate-200 transition-all"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-[#E6F3ED] text-[#008751] flex items-center justify-center mx-auto mb-4"><Users size={22} /></div>
                                <h3 className="font-display font-bold text-[#111a15] mb-1">{t(m.name)}</h3>
                                <p className="text-slate-500 text-sm">{t(m.role)}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 bg-gradient-to-r from-[#008751] via-[#006B40] to-[#008751] text-white">
                <div className="container mx-auto px-4 text-center">
                    <Award className="mx-auto mb-6 text-[#FCD116]" size={48} />
                    <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
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
