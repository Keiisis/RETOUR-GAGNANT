'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
    Globe, Map, ShieldCheck, Sparkles, Users,
    Image as ImageIcon, Flag, BookOpen, ArrowRight,
    FileText, Palette
} from 'lucide-react'

const frontendSections = [
    {
        title: 'Contenu des Pages',
        description: 'Modifiez les textes, valeurs, équipes et informations affichés sur les pages À Propos, Notre Histoire, Contact et Simulateur.',
        icon: FileText,
        href: '/admin/page-content',
        color: '#008751',
        count: 'Textes & Données',
    },
    {
        title: 'Patrimoine & Culture',
        description: 'Gérez les sites culturels et historiques du Bénin affichés dans la section Patrimoine.',
        icon: Map,
        href: '/admin/patrimoine',
        color: '#E8112D',
        count: 'Sites & Lieux',
    },
    {
        title: 'Services',
        description: 'Créez et modifiez les services proposés par Retour Gagnant affichés sur la page Services.',
        icon: ShieldCheck,
        href: '/admin/services',
        color: '#008751',
        count: 'Offres & Prestations',
    },
    {
        title: 'Parcours Client',
        description: 'Configurez les étapes du parcours d\'accompagnement affichées sur la page d\'accueil.',
        icon: Sparkles,
        href: '/admin/process-steps',
        color: '#FCD116',
        count: 'Étapes & Processus',
    },
    {
        title: 'Témoignages',
        description: 'Gérez les avis et témoignages clients affichés sur le site pour renforcer la confiance.',
        icon: Users,
        href: '/admin/testimonials',
        color: '#008751',
        count: 'Avis Clients',
    },
    {
        title: 'Galerie Photos',
        description: 'Ajoutez, modifiez ou supprimez les images de la galerie photo du site.',
        icon: ImageIcon,
        href: '/admin/gallery',
        color: '#E8112D',
        count: 'Images & Médias',
    },
    {
        title: 'Partenaires',
        description: 'Gérez le répertoire des partenaires et entreprises alliées affichés sur la page Partenaires.',
        icon: Flag,
        href: '/admin/partenaires',
        color: '#FCD116',
        count: 'Réseau & Alliés',
    },
    {
        title: 'Blog / Articles',
        description: 'Rédigez et publiez des articles de blog pour informer et engager votre audience.',
        icon: BookOpen,
        href: '/admin/blog',
        color: '#008751',
        count: 'Rédaction & SEO',
    },
]

export default function AdminFrontendHub() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#008751]/20 via-[#0f141e] to-[#E8112D]/10 border border-white/10 p-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#FCD116]/5 rounded-full blur-[100px]" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-[#008751]/20 border border-[#008751]/30 flex items-center justify-center">
                            <Palette size={24} className="text-[#008751]" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Gestion du Frontend</h1>
                            <p className="text-gray-400 text-sm">Tout le contenu visible sur votre site public</p>
                        </div>
                    </div>
                    <p className="text-gray-500 text-sm max-w-2xl mt-4">
                        Cette section regroupe tous les éléments modifiables de votre site web.
                        Chaque modification est instantanément reflétée sur le site sans toucher au code source.
                    </p>
                </div>
            </div>

            {/* Grid of sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {frontendSections.map((section, index) => (
                    <motion.div
                        key={section.href}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.05 }}
                    >
                        <Link href={section.href} className="block group">
                            <div className="h-full bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:border-white/15 hover:bg-white/[0.05] transition-all duration-300">
                                {/* Top row */}
                                <div className="flex items-start justify-between mb-4">
                                    <div
                                        className={`w-11 h-11 rounded-xl flex items-center justify-center border ${section.color === '#008751' ? 'bg-[#008751]/10 border-[#008751]/30' :
                                                section.color === '#E8112D' ? 'bg-[#E8112D]/10 border-[#E8112D]/30' :
                                                    'bg-[#FCD116]/10 border-[#FCD116]/30'
                                            }`}
                                    >
                                        <section.icon size={20} className={
                                            section.color === '#008751' ? 'text-[#008751]' :
                                                section.color === '#E8112D' ? 'text-[#E8112D]' :
                                                    'text-[#FCD116]'
                                        } />
                                    </div>
                                    <ArrowRight
                                        size={16}
                                        className="text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all"
                                    />
                                </div>

                                {/* Content */}
                                <h3 className="font-bold text-white text-sm mb-1.5 group-hover:text-[#FCD116] transition-colors">
                                    {section.title}
                                </h3>
                                <p className="text-gray-500 text-xs leading-relaxed mb-3 line-clamp-2">
                                    {section.description}
                                </p>

                                {/* Badge */}
                                <span
                                    className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${section.color === '#008751' ? 'bg-[#008751]/10 text-[#008751]' :
                                            section.color === '#E8112D' ? 'bg-[#E8112D]/10 text-[#E8112D]' :
                                                'bg-[#FCD116]/10 text-[#FCD116]'
                                        }`}
                                >
                                    {section.count}
                                </span>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>

            {/* Quick tip */}
            <div className="bg-[#FCD116]/5 border border-[#FCD116]/10 rounded-xl p-4 flex items-start gap-3">
                <Globe size={18} className="text-[#FCD116] mt-0.5 flex-shrink-0" />
                <div>
                    <p className="text-sm text-gray-300 font-medium">Astuce</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Toutes les modifications effectuées ici sont appliquées en temps réel sur le site.
                        Les données en cache sont automatiquement rafraîchies à chaque visite.
                    </p>
                </div>
            </div>
        </div>
    )
}
