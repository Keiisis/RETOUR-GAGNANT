"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { motion, useReducedMotion, type Variants } from "framer-motion"
import { ArrowUpRight, CircleNotch } from "@phosphor-icons/react"
import { useTranslation, T } from "@/lib/translation"

interface ServiceItem {
    id: string | number
    title: string
    description: string
    slug: string
    imageUrl: string
}

// Images (icônes dorées) par slug — repli si la DB n'a pas d'image.
const IMG_BY_SLUG: Record<string, string> = {
    passeport: '/assets/icones/icone_Passeport_Documents.png',
    logement: '/assets/icones/icone_Acheter_ou_louer.png',
    business: '/assets/icones/icone_Creation_d_Entreprise.png',
    culture: '/assets/icones/icone_Guide_culturel.png',
    construction: '/assets/icones/icone_Construction.png',
    investissement: '/assets/icones/icone_Investissement.png',
    'nationalite-vip': '/assets/icones/Nationalité Béninoise VIP.png',
    'recherche-ancestrale': '/assets/icones/Recherche Ancestrale.png',
    'consultation-fa-racines': '/assets/icones/icone_Consultation_Fa_Racines.png',
    'langues-racines': '/assets/icones/icone_Langues_Racines.png',
    'permis-conduire': '/assets/icones/Permis de Conduire Service.png',
    autres: '/assets/icones/Autres Services.png',
}

// Liste de repli COMPLÈTE (affichée si l'API `services` est vide).
const FALLBACK_SERVICES: ServiceItem[] = [
    { id: 'f-7', slug: 'nationalite-vip', title: 'Nationalité VIP', description: "Obtention de la nationalité béninoise : dossier complet monté par nos experts, suivi prioritaire et accompagnement de bout en bout.", imageUrl: IMG_BY_SLUG['nationalite-vip'] },
    { id: 'f-1', slug: 'passeport', title: 'Passeport & Documents', description: "Passeport, acte de naissance, légalisation et apostille : vos démarches officielles prises en charge de bout en bout.", imageUrl: IMG_BY_SLUG.passeport },
    { id: 'f-2', slug: 'logement', title: 'Acheter ou Louer', description: "Acquisition, location longue durée et sécurisation foncière de vos biens au Bénin.", imageUrl: IMG_BY_SLUG.logement },
    { id: 'f-3', slug: 'business', title: "Création d'Entreprise", description: "Immatriculation RCCM, compte professionnel et formalités de création.", imageUrl: IMG_BY_SLUG.business },
    { id: 'f-4', slug: 'culture', title: 'Tourisme & Culture', description: "Circuits, visites patrimoniales et séjours dans le Bénin authentique.", imageUrl: IMG_BY_SLUG.culture },
    { id: 'f-5', slug: 'construction', title: 'Suivi de Chantier', description: "Maîtrise d'ouvrage déléguée, contrôle des travaux et coordination des entreprises locales.", imageUrl: IMG_BY_SLUG.construction },
    { id: 'f-6', slug: 'investissement', title: 'Investissement', description: "Opportunités d'affaires, partenariats locaux et accompagnement stratégique.", imageUrl: IMG_BY_SLUG.investissement },
    { id: 'f-8', slug: 'recherche-ancestrale', title: 'Recherche Ancestrale', description: "Retrouvez la trace de vos ancêtres : archives, bases spécialisées et accompagnement généalogique.", imageUrl: IMG_BY_SLUG['recherche-ancestrale'] },
    { id: 'f-9', slug: 'consultation-fa-racines', title: 'Consultation Fa & Racines', description: "Mise en relation avec un Bokonon pour une consultation traditionnelle, en présentiel ou à distance.", imageUrl: IMG_BY_SLUG['consultation-fa-racines'] },
    { id: 'f-10', slug: 'langues-racines', title: 'Langues & Racines', description: "Apprenez fon, yoruba, goun ou mina avec des locuteurs natifs, en présentiel ou en visio.", imageUrl: IMG_BY_SLUG['langues-racines'] },
    { id: 'f-12', slug: 'permis-conduire', title: 'Permis de Conduire Béninois', description: "Obtenez un permis béninois officiel via une auto-école partenaire : vous choisissez l'école, nous coordonnons tout le parcours.", imageUrl: IMG_BY_SLUG['permis-conduire'] },
    { id: 'f-11', slug: 'autres', title: 'Autres Services', description: "Transport, santé, scolarité et démarches complémentaires pour faciliter votre installation.", imageUrl: IMG_BY_SLUG.autres },
]

// Fond crème très léger en alternance (chaleur charte Bénin, sans surcharge).
const TINTS = ['bg-white', 'bg-white', 'bg-[#fdfaf0]', 'bg-white', 'bg-[#f5f8f6]', 'bg-white']

const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07 } },
}
const item: Variants = {
    hidden: { opacity: 0, y: 26 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
}

export default function ServicesGrid({ featuredSlug = 'nationalite-vip', limit }: { featuredSlug?: string; limit?: number }) {
    const { t } = useTranslation()
    const reduce = useReducedMotion()
    const [list, setList] = useState<ServiceItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const run = async () => {
            try {
                const res = await fetch('/api/services')
                const json = await res.json()
                if (json.services && json.services.length > 0) {
                    const mapped: ServiceItem[] = json.services.map((it: Record<string, unknown>) => {
                        const slug = (it.slug as string) || String(it.title).toLowerCase().replace(/\s+/g, '-')
                        return {
                            id: it.id as string | number,
                            title: it.title as string,
                            description: (it.description as string) || 'Découvrez ce service',
                            slug,
                            imageUrl: (it.image_url as string) || IMG_BY_SLUG[slug] || '',
                        }
                    })
                    setList(mapped)
                } else {
                    setList(FALLBACK_SERVICES)
                }
            } catch (err) {
                console.warn('ServicesGrid: API indisponible, repli.', err)
                setList(FALLBACK_SERVICES)
            } finally {
                setLoading(false)
            }
        }
        run()
    }, [])

    if (loading) {
        return (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
                {Array.from({ length: limit || 6 }).map((_, i) => (
                    <div key={i} className="h-64 animate-pulse rounded-2xl border border-[#eceae3] bg-[#f3f1ea]" />
                ))}
            </div>
        )
    }

    // Le service phare (nationalité VIP) ouvre la grille ; le reste suit.
    const featured = list.find((s) => s.slug === featuredSlug)
    const ordered = featured ? [featured, ...list.filter((s) => s.id !== featured.id)] : list
    const shown = limit ? ordered.slice(0, limit) : ordered

    return (
        <motion.div
            variants={container}
            initial={reduce ? undefined : 'hidden'}
            whileInView={reduce ? undefined : 'show'}
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 md:gap-6"
        >
            {shown.map((service, i) => (
                <motion.div key={service.id} variants={item}>
                    <Link
                        href={`/services/${service.slug}`}
                        className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#e7e4db] ${TINTS[i % TINTS.length]} p-7 transition-all duration-500 hover:-translate-y-1.5 hover:border-[#FCD116] hover:shadow-[0_26px_60px_-30px_rgba(0,135,81,0.5)]`}
                    >
                        {/* Filet tricolore révélé au survol (charte, discret) */}
                        <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] transition-transform duration-500 group-hover:scale-x-100" />

                        {/* Flèche d'angle */}
                        <ArrowUpRight
                            size={22}
                            weight="bold"
                            className="absolute right-5 top-5 text-[#cfd6cf] transition-all duration-500 group-hover:-translate-y-0.5 group-hover:text-[#008751]"
                        />

                        {/* Icône dorée illustrée */}
                        <div className="relative mb-6 h-24 w-24">
                            {service.imageUrl ? (
                                <Image
                                    src={service.imageUrl}
                                    alt={t(service.title)}
                                    fill
                                    sizes="96px"
                                    className="object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.14)] transition-all duration-500 group-hover:-translate-y-1.5 group-hover:scale-110 group-hover:drop-shadow-[0_16px_30px_rgba(252,209,22,0.45)]"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#f3f6f4] ring-1 ring-[#e7e4db]">
                                    <span className="font-fraunces text-3xl font-semibold text-[#008751]">{t(service.title).charAt(0)}</span>
                                </div>
                            )}
                        </div>

                        {/* Titre — Fraunces */}
                        <h3 className="font-fraunces text-[1.35rem] font-semibold leading-snug tracking-[-0.01em] text-[#111a15] transition-colors duration-300 group-hover:text-[#008751]">
                            {t(service.title)}
                        </h3>

                        {/* Description — Geist */}
                        <p className="mt-2.5 font-geist text-[15px] leading-relaxed text-[#5c665f] line-clamp-3">
                            {t(service.description)}
                        </p>

                        {/* CTA — lien souligné animé (anti-slop, pas de gros bouton) */}
                        <span className="mt-6 inline-flex items-center gap-1.5 font-geist text-[14px] font-semibold text-[#008751]">
                            <span className="bg-gradient-to-r from-[#008751] to-[#008751] bg-[length:0%_2px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-500 group-hover:bg-[length:100%_2px]">
                                <T>En savoir plus</T>
                            </span>
                            <ArrowUpRight size={15} weight="bold" className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </span>
                    </Link>
                </motion.div>
            ))}
        </motion.div>
    )
}

// Icône de chargement conservée pour cohérence si réintroduite ailleurs.
export const ServicesLoader = () => <CircleNotch className="animate-spin text-[#008751]" size={36} />
