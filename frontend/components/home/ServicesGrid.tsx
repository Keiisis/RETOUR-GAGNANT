"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
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
    { id: 'f-7', slug: 'nationalite-vip', title: 'Nationalité VIP', description: "Obtention de la nationalité béninoise : dossier complet monté par nos experts, suivi prioritaire et accompagnement de bout en bout.", imageUrl: '/assets/icones/Nationalité Béninoise VIP.png' },
    { id: 'f-1', slug: 'passeport', title: 'Passeport & Documents', description: "Passeport, acte de naissance, légalisation et apostille : vos démarches officielles prises en charge de bout en bout.", imageUrl: '/assets/icones/icone_Passeport_Documents.png' },
    { id: 'f-2', slug: 'logement', title: 'Acheter ou Louer', description: "Acquisition, location longue durée et sécurisation foncière de vos biens au Bénin.", imageUrl: '/assets/icones/icone_Acheter_ou_louer.png' },
    { id: 'f-3', slug: 'business', title: "Création d'Entreprise", description: "Immatriculation RCCM, compte professionnel et formalités de création.", imageUrl: '/assets/icones/icone_Creation_d_Entreprise.png' },
    { id: 'f-4', slug: 'culture', title: 'Tourisme & Culture', description: "Circuits, visites patrimoniales et séjours dans le Bénin authentique.", imageUrl: '/assets/icones/icone_Guide_culturel.png' },
    { id: 'f-6', slug: 'investissement', title: 'Investissement', description: "Opportunités d'affaires, partenariats locaux et accompagnement stratégique.", imageUrl: '/assets/icones/icone_Investissement.png' },
]

const TINTS = ['bg-white', 'bg-[#f2f6f3]', 'bg-[#fdf8ea]', 'bg-white', 'bg-[#f7f3ee]', 'bg-white', 'bg-[#f2f6f3]', 'bg-[#fdf8ea]', 'bg-white', 'bg-[#f7f3ee]']

function spotlight(e: React.MouseEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
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
                    setList(json.services.map((item: Record<string, unknown>) => {
                        const slug = (item.slug as string) || String(item.title).toLowerCase().replace(/\s+/g, '-')
                        return {
                            id: item.id,
                            title: item.title as string,
                            description: (item.description as string) || 'Découvrez ce service',
                            slug,
                            imageUrl: (item.image_url as string) || IMG_BY_SLUG[slug] || '',
                        }
                    }))
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:auto-rows-[minmax(200px,auto)]">
                <div className="animate-pulse rounded-[1.75rem] bg-[#eceae3] md:col-span-2 md:row-span-2 md:min-h-[420px]" />
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 animate-pulse rounded-[1.5rem] bg-[#eceae3]" />)}
            </div>
        )
    }

    // Service phare = featuredSlug (défaut nationalite-vip), sinon 1er.
    const featured = list.find((s) => s.slug === featuredSlug) || list[0]
    let rest = list.filter((s) => s.id !== featured?.id)
    if (limit) rest = rest.slice(0, limit - 1)

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:auto-rows-[minmax(200px,auto)]">
            {/* ── Service phare ── */}
            {featured && (
                <motion.div
                    initial={reduce ? false : { opacity: 0, y: 26 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className="md:col-span-2 md:row-span-2"
                >
                    <Link
                        href={`/services/${featured.slug}`}
                        onMouseMove={spotlight}
                        className="group relative flex h-full min-h-[340px] flex-col justify-end overflow-hidden rounded-[1.75rem] bg-[#00351f] p-8 text-white md:min-h-[420px] md:p-10"
                    >
                        {/* décor : dégradé riche + glows + grain */}
                        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,#0a8a55_0%,#00623a_45%,#00301c_100%)]" />
                        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[#FCD116]/25 blur-3xl transition-all duration-700 group-hover:bg-[#FCD116]/35" />
                        <div className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-[#0fbf7a]/20 blur-3xl" />
                        {/* icône filigrane géante */}
                        {featured.imageUrl && (
                            <Image src={featured.imageUrl} alt="" width={360} height={360} className="pointer-events-none absolute -right-8 top-2 h-64 w-64 object-contain opacity-20 blur-[1px] transition-transform duration-700 group-hover:scale-105 md:h-80 md:w-80" />
                        )}
                        {/* spotlight curseur */}
                        <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: 'radial-gradient(340px circle at var(--mx) var(--my), rgba(252,209,22,0.16), transparent 60%)' }} />

                        <div className="relative">
                            <span className="inline-flex items-center gap-2 rounded-full border border-[#FCD116]/30 bg-[#FCD116]/10 px-3 py-1 font-geistmono text-[10px] uppercase tracking-[0.28em] text-[#FCD116]">
                                <T>Service phare</T>
                            </span>
                            {featured.imageUrl && (
                                <Image src={featured.imageUrl} alt="" width={96} height={96} className="mt-6 h-16 w-16 object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.4)] md:h-20 md:w-20" />
                            )}
                            <h3 className="mt-5 max-w-md font-fraunces text-3xl font-semibold leading-tight md:text-[2.7rem]">{t(featured.title)}</h3>
                            <p className="mt-3 max-w-md font-geist text-[15px] leading-relaxed text-white/80 line-clamp-3">{t(featured.description)}</p>
                            <span className="mt-7 inline-flex items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 font-geist text-sm font-semibold text-[#00532f] transition-all group-hover:bg-[#FCD116] group-hover:text-[#0d1a12]">
                                <T>Explorer ce service</T>
                                <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-1" />
                            </span>
                        </div>
                    </Link>
                </motion.div>
            )}

            {/* ── Tuiles ── */}
            {rest.map((s, i) => (
                <motion.div
                    key={s.id}
                    initial={reduce ? false : { opacity: 0, y: 22 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.55, delay: (i % 3) * 0.06, ease: [0.16, 1, 0.3, 1] }}
                >
                    <Link
                        href={`/services/${s.slug}`}
                        onMouseMove={spotlight}
                        className={`group relative flex h-full min-h-[200px] flex-col justify-between overflow-hidden rounded-[1.5rem] border border-[#e7e4db] ${TINTS[i % TINTS.length]} p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-[#008751]/40 hover:shadow-[0_28px_56px_-30px_rgba(13,26,18,0.55)]`}
                    >
                        <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: 'radial-gradient(220px circle at var(--mx) var(--my), rgba(0,135,81,0.09), transparent 60%)' }} />
                        <div className="relative flex items-start justify-between">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 shadow-sm ring-1 ring-[#eceae3]">
                                {s.imageUrl ? (
                                    <Image src={s.imageUrl} alt="" width={40} height={40} className="h-10 w-10 object-contain transition-transform duration-300 group-hover:scale-110" />
                                ) : <span className="h-10 w-10" />}
                            </div>
                            <ArrowUpRight size={20} weight="bold" className="text-[#c8c3b6] transition-all group-hover:-translate-y-0.5 group-hover:text-[#008751]" />
                        </div>
                        <div className="relative mt-5">
                            <h3 className="font-fraunces text-lg font-semibold text-[#0d1a12] transition-colors group-hover:text-[#008751]">{t(s.title)}</h3>
                            <p className="mt-1.5 font-geist text-sm leading-relaxed text-[#6b756e] line-clamp-2">{t(s.description)}</p>
                        </div>
                    </Link>
                </motion.div>
            ))}
        </div>
    )
}
