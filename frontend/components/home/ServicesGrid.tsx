"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { ArrowUpRight, ArrowRight } from "@phosphor-icons/react"
import { useTranslation, T } from "@/lib/translation"

interface ServiceItem {
    id: string | number
    title: string
    description: string
    slug: string
    imageUrl: string
}

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
    autres: '/assets/icones/Autres Services.png',
}

const FALLBACK_SERVICES: ServiceItem[] = [
    { id: 'f-1', slug: 'passeport', title: 'Passeport & Documents', description: "Passeport, acte de naissance, légalisation et apostille : vos démarches officielles prises en charge de bout en bout.", imageUrl: '/assets/icones/icone_Passeport_Documents.png' },
    { id: 'f-2', slug: 'logement', title: 'Acheter ou Louer', description: "Acquisition, location longue durée et sécurisation foncière de vos biens au Bénin.", imageUrl: '/assets/icones/icone_Acheter_ou_louer.png' },
    { id: 'f-3', slug: 'business', title: "Création d'Entreprise", description: "Immatriculation RCCM, compte professionnel et formalités de création.", imageUrl: '/assets/icones/icone_Creation_d_Entreprise.png' },
    { id: 'f-4', slug: 'culture', title: 'Tourisme & Culture', description: "Circuits, visites patrimoniales et séjours dans le Bénin authentique.", imageUrl: '/assets/icones/icone_Guide_culturel.png' },
    { id: 'f-6', slug: 'investissement', title: 'Investissement', description: "Opportunités d'affaires, partenariats locaux et accompagnement stratégique.", imageUrl: '/assets/icones/icone_Investissement.png' },
    { id: 'f-7', slug: 'nationalite-vip', title: 'Nationalité VIP', description: "Obtention de la nationalité béninoise : dossier complet, suivi prioritaire.", imageUrl: '/assets/icones/Nationalité Béninoise VIP.png' },
]

export default function ServicesGrid() {
    const { t } = useTranslation()
    const [list, setList] = useState<ServiceItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const run = async () => {
            try {
                const res = await fetch('/api/services')
                const json = await res.json()
                if (json.services && json.services.length > 0) {
                    const mapped: ServiceItem[] = json.services.map((item: Record<string, unknown>) => {
                        const slug = (item.slug as string) || String(item.title).toLowerCase().replace(/\s+/g, '-')
                        return {
                            id: item.id,
                            title: item.title as string,
                            description: (item.description as string) || 'Découvrez ce service',
                            slug,
                            imageUrl: (item.image_url as string) || IMG_BY_SLUG[slug] || '',
                        }
                    })
                    setList(mapped)
                } else setList(FALLBACK_SERVICES)
            } catch {
                setList(FALLBACK_SERVICES)
            } finally {
                setLoading(false)
            }
        }
        run()
    }, [])

    if (loading) {
        return (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:auto-rows-[minmax(184px,auto)]">
                <div className="animate-pulse rounded-[1.6rem] bg-[#eceae3] md:col-span-2 md:row-span-2 md:min-h-[300px]" />
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-44 animate-pulse rounded-[1.25rem] bg-[#eceae3]" />
                ))}
            </div>
        )
    }

    const featured = list[0]
    const rest = list.slice(1, 6)
    const tints = ['bg-white', 'bg-[#f2f6f3]', 'bg-white', 'bg-[#fdf8ea]', 'bg-white']

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:auto-rows-[minmax(184px,auto)]">
            {/* ── Service phare ── */}
            {featured && (
                <Link
                    href={`/services/${featured.slug}`}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-[#00532f] via-[#008751] to-[#0a7d52] p-8 text-white md:col-span-2 md:row-span-2 md:min-h-[300px]"
                >
                    <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-56 w-56 rounded-full bg-[#FCD116]/20 blur-3xl" />
                    {featured.imageUrl && (
                        <Image src={featured.imageUrl} alt="" width={128} height={128} className="absolute right-6 top-6 h-24 w-24 object-contain opacity-90 drop-shadow-[0_14px_28px_rgba(0,0,0,0.35)] transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-105" />
                    )}
                    <span className="relative font-geistmono text-[11px] uppercase tracking-[0.28em] text-[#FCD116]"><T>Service phare</T></span>
                    <div className="relative mt-auto max-w-md">
                        <h3 className="font-fraunces text-3xl font-semibold leading-tight md:text-[2.4rem]">{t(featured.title)}</h3>
                        <p className="mt-3 font-geist text-[15px] leading-relaxed text-white/80 line-clamp-3">{t(featured.description)}</p>
                        <span className="mt-6 inline-flex items-center gap-2 font-geist text-sm font-semibold">
                            <T>Explorer ce service</T>
                            <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-1" />
                        </span>
                    </div>
                </Link>
            )}

            {/* ── Tuiles ── */}
            {rest.map((s, i) => (
                <Link
                    key={s.id}
                    href={`/services/${s.slug}`}
                    className={`group flex flex-col justify-between rounded-[1.25rem] border border-[#e7e4db] ${tints[i] || 'bg-white'} p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#008751]/40 hover:shadow-[0_24px_50px_-30px_rgba(13,26,18,0.5)]`}
                >
                    <div className="flex items-start justify-between">
                        {s.imageUrl ? (
                            <Image src={s.imageUrl} alt="" width={52} height={52} className="h-[52px] w-[52px] object-contain transition-transform duration-300 group-hover:scale-110" />
                        ) : <span className="h-[52px] w-[52px]" />}
                        <ArrowUpRight size={20} weight="bold" className="text-[#c8c3b6] transition-colors group-hover:text-[#008751]" />
                    </div>
                    <div className="mt-5">
                        <h3 className="font-geist text-[17px] font-semibold text-[#0d1a12] transition-colors group-hover:text-[#008751]">{t(s.title)}</h3>
                        <p className="mt-1.5 font-geist text-sm leading-relaxed text-[#6b756e] line-clamp-2">{t(s.description)}</p>
                    </div>
                </Link>
            ))}
        </div>
    )
}
