'use client'

// ══════════════════════════════════════════════════════════════
// Langues & Racines — choix Présentiel / Visio → prise de rendez-vous.
// Pas de prix affiché (sur devis) : chaque option mène au formulaire RDV
// avec le service pré-sélectionné. La demande alimente automatiquement
// l'Agenda agent (rdv_requests) + email équipe + notification in-app.
// ══════════════════════════════════════════════════════════════

import Link from 'next/link'
import { motion } from 'framer-motion'
import { MapPin, Video, Calendar, ArrowRight, MessageCircleHeart } from 'lucide-react'
import { useTranslation, T } from '@/lib/translation'

const OPTIONS = [
    {
        slug: 'langues-racines-presentiel',
        icon: MapPin,
        title: 'En Présentiel',
        text: 'Cours en immersion au Bénin, au contact direct des locuteurs natifs, de la rue et du marché : la langue vivante, dans son décor.',
    },
    {
        slug: 'langues-racines-visio',
        icon: Video,
        title: 'En Visio',
        text: 'Depuis chez vous, où que vous soyez dans le monde : des séances régulières en visioconférence avec votre professeur natif.',
    },
]

export default function LanguesRacinesChoice() {
    const { t } = useTranslation()
    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#0EA5E9]/10 flex items-center justify-center">
                    <MessageCircleHeart size={18} className="text-[#0EA5E9]" />
                </div>
                <div>
                    <p className="font-black text-[#1a2332]"><T>Choisissez votre format</T></p>
                    <p className="text-xs text-gray-400"><T>Le premier rendez-vous est gratuit : nous définissons ensemble votre parcours et votre devis.</T></p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {OPTIONS.map((o, i) => {
                    const Icon = o.icon
                    return (
                        <motion.div key={o.slug}
                            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5 }}>
                            <Link href={`/rendez-vous?service=${o.slug}`}
                                className="group block h-full rounded-3xl border-2 border-gray-100 bg-white p-6 hover:border-[#0EA5E9]/50 hover:shadow-[0_14px_40px_rgba(14,165,233,0.12)] transition-all">
                                <div className="w-11 h-11 rounded-2xl bg-gray-100 group-hover:bg-[#0EA5E9] group-hover:text-white text-gray-500 flex items-center justify-center transition-colors mb-4">
                                    <Icon size={20} />
                                </div>
                                <p className="font-black text-[#1a2332]">{t(o.title)}</p>
                                <p className="text-[13px] text-gray-500 leading-relaxed mt-2 mb-5">{t(o.text)}</p>
                                <span className="inline-flex items-center gap-2 text-sm font-black text-[#0EA5E9]">
                                    <Calendar size={15} /> <T>Prendre Rendez-vous</T>
                                    <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                                </span>
                            </Link>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}
