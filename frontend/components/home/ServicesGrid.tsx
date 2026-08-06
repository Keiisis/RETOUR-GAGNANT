"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
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

// Liste de repli COMPLETE (affichée si l'API `services` est vide).
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
    { id: 'f-11', slug: 'autres', title: 'Autres Services', description: "Transport, santé, scolarité et démarches complémentaires pour faciliter votre installation.", imageUrl: IMG_BY_SLUG.autres },
]

const TINTS = ['bg-white', 'bg-[#f2f6f3]', 'bg-[#fdf8ea]', 'bg-white', 'bg-[#f7f3ee]', 'bg-white', 'bg-[#f2f6f3]', 'bg-[#fdf8ea]', 'bg-white', 'bg-[#f7f3ee]', 'bg-white']

// Motif traditionnel bespoke (losanges kente/bogolan, or) — data URI.
const MOTIF = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cg fill='none' stroke='%23FCD116' stroke-width='1.4' opacity='0.6'%3E%3Cpath d='M32 3 L61 32 L32 61 L3 32 Z'/%3E%3Cpath d='M32 19 L45 32 L32 45 L19 32 Z' fill='%23FCD116' stroke='none' opacity='0.5'/%3E%3Cpath d='M0 0 L9 9 M55 55 L64 64 M64 0 L55 9 M9 55 L0 64'/%3E%3C/g%3E%3C/svg%3E"

export default function ServicesGrid({ featuredSlug = 'nationalite-vip', limit }: { featuredSlug?: string; limit?: number }) {
    const { t } = useTranslation()
    const reduce = useReducedMotion()
    const [list, setList] = useState<ServiceItem[]>([])
    const [loading, setLoading] = useState(true)
    const ref = useRef<HTMLDivElement>(null)

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

    // ═══ GSAP : reveal tissé + parallaxe multi-couches + magnétisme + bob ═══
    useEffect(() => {
        if (reduce || loading || !ref.current || list.length === 0) return
        let cleanup = () => { }
        let cancelled = false
        ;(async () => {
            const gsap = (await import('gsap')).default
            const { ScrollTrigger } = await import('gsap/ScrollTrigger')
            gsap.registerPlugin(ScrollTrigger)
            if (cancelled || !ref.current) return
            const ctx = gsap.context((self) => {
                const q = self.selector!
                // Reveal en cascade (depuis le bas, avec profondeur)
                gsap.from(q('.svc-cell'), {
                    y: 60, opacity: 0, rotateX: 10, transformOrigin: 'center bottom',
                    duration: 0.9, ease: 'power3.out', stagger: 0.09,
                    scrollTrigger: { trigger: ref.current, start: 'top 82%' },
                })
                // Parallaxe multi-couches dans la carte phare (scrub)
                const st = { trigger: ref.current, start: 'top bottom', end: 'bottom top', scrub: 1 }
                gsap.to(q('.svc-motif'), { yPercent: -18, ease: 'none', scrollTrigger: st })
                gsap.to(q('.svc-glow'), { yPercent: 16, ease: 'none', scrollTrigger: st })
                gsap.to(q('.svc-flag'), { yPercent: -10, ease: 'none', scrollTrigger: st })
                // Motif qui dérive en continu
                gsap.to(q('.svc-motif'), { backgroundPositionX: '+=64', duration: 12, ease: 'none', repeat: -1 })
                // Icônes qui flottent
                gsap.to(q('.svc-ico'), { y: -6, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: { each: 0.2, from: 'random' } })
                // Tuiles magnétiques (suivi curseur + tilt)
                const tiles = gsap.utils.toArray<HTMLElement>(q('.svc-tile'))
                tiles.forEach((tile) => {
                    const xTo = gsap.quickTo(tile, 'x', { duration: 0.5, ease: 'power3' })
                    const yTo = gsap.quickTo(tile, 'y', { duration: 0.5, ease: 'power3' })
                    const rxTo = gsap.quickTo(tile, 'rotateX', { duration: 0.5, ease: 'power3' })
                    const ryTo = gsap.quickTo(tile, 'rotateY', { duration: 0.5, ease: 'power3' })
                    const move = (e: MouseEvent) => {
                        const r = tile.getBoundingClientRect()
                        const px = (e.clientX - r.left) / r.width - 0.5
                        const py = (e.clientY - r.top) / r.height - 0.5
                        xTo(px * 12); yTo(py * 12); ryTo(px * 9); rxTo(-py * 9)
                    }
                    const leave = () => { xTo(0); yTo(0); rxTo(0); ryTo(0) }
                    tile.addEventListener('mousemove', move)
                    tile.addEventListener('mouseleave', leave)
                })
                // Parallaxe à la souris sur la carte phare (couches à profondeurs différentes)
                const feat = ref.current!.querySelector<HTMLElement>('.svc-featured')
                if (feat) {
                    const qt = (sel: string, prop: string) => gsap.quickTo(q(sel), prop, { duration: 0.7, ease: 'power3' })
                    const mX = qt('.svc-motif', 'x'), mY = qt('.svc-motif', 'y')
                    const fX = qt('.svc-flag', 'x'), fY = qt('.svc-flag', 'y')
                    const gX = qt('.svc-glow', 'x'), gY = qt('.svc-glow', 'y')
                    const onMove = (e: MouseEvent) => {
                        const r = feat.getBoundingClientRect()
                        const px = (e.clientX - r.left) / r.width - 0.5
                        const py = (e.clientY - r.top) / r.height - 0.5
                        mX(px * 22); mY(py * 16); fX(px * -16); fY(py * -12); gX(px * 28); gY(py * 20)
                    }
                    const onLeave = () => { mX(0); mY(0); fX(0); fY(0); gX(0); gY(0) }
                    feat.addEventListener('mousemove', onMove)
                    feat.addEventListener('mouseleave', onLeave)
                }
            }, ref)
            cleanup = () => ctx.revert()
        })()
        return () => { cancelled = true; cleanup() }
    }, [reduce, loading, list])

    if (loading) {
        return (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:auto-rows-[minmax(200px,auto)]">
                <div className="animate-pulse rounded-[1.75rem] bg-[#eceae3] md:col-span-2 md:row-span-2 md:min-h-[420px]" />
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 animate-pulse rounded-[1.5rem] bg-[#eceae3]" />)}
            </div>
        )
    }

    const featured = list.find((s) => s.slug === featuredSlug) || list[0]
    let rest = list.filter((s) => s.id !== featured?.id)
    if (limit) rest = rest.slice(0, limit - 1)

    return (
        <div ref={ref} className="grid grid-cols-1 gap-4 md:grid-cols-3 md:auto-rows-[minmax(200px,auto)]" style={{ perspective: 1200 }}>
            {/* ── Service phare (parallaxe + motif traditionnel) ── */}
            {featured && (
                <div className="svc-cell md:col-span-2 md:row-span-2">
                    <Link
                        href={`/services/${featured.slug}`}
                        className="svc-featured group relative flex h-full min-h-[340px] flex-col justify-end overflow-hidden rounded-[1.75rem] bg-[#00351f] p-8 text-white md:min-h-[420px] md:p-10"
                    >
                        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,#0a8a55_0%,#00623a_45%,#00301c_100%)]" />
                        {/* mesh vivant + reflet qui balaie (animation continue) */}
                        <div className="svc-mesh pointer-events-none absolute inset-0" />
                        <div className="svc-sheen pointer-events-none absolute inset-0" />
                        {/* motif traditionnel qui dérive + parallaxe */}
                        <div className="svc-motif pointer-events-none absolute -inset-y-16 inset-x-0 opacity-[0.16] mix-blend-screen" style={{ backgroundImage: `url("${MOTIF}")`, backgroundSize: '64px 64px' }} />
                        <div className="svc-glow pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-[#FCD116]/25 blur-3xl" />
                        {featured.imageUrl && (
                            <Image src={featured.imageUrl} alt="" width={360} height={360} className="svc-flag pointer-events-none absolute -right-6 top-2 h-64 w-64 object-contain opacity-25 blur-[1px] md:h-80 md:w-80" />
                        )}
                        <div className="relative">
                            <span className="inline-flex items-center gap-2 rounded-full border border-[#FCD116]/30 bg-[#FCD116]/10 px-3 py-1 font-geistmono text-[10px] uppercase tracking-[0.28em] text-[#FCD116]"><T>Service phare</T></span>
                            {featured.imageUrl && <Image src={featured.imageUrl} alt="" width={96} height={96} className="svc-ico mt-6 h-16 w-16 object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.4)] md:h-20 md:w-20" />}
                            <h3 className="mt-5 max-w-md font-fraunces text-3xl font-semibold leading-tight md:text-[2.7rem]">{t(featured.title)}</h3>
                            <p className="mt-3 max-w-md font-geist text-[15px] leading-relaxed text-white/80 line-clamp-3">{t(featured.description)}</p>
                            <span className="mt-7 inline-flex items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 font-geist text-sm font-semibold text-[#00532f] transition-all group-hover:bg-[#FCD116] group-hover:text-[#0d1a12]">
                                <T>Explorer ce service</T><ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-1" />
                            </span>
                        </div>
                    </Link>
                </div>
            )}

            {/* ── Tuiles magnétiques ── */}
            {rest.map((s, i) => (
                <div key={s.id} className="svc-cell [perspective:900px]">
                    <Link
                        href={`/services/${s.slug}`}
                        className={`svc-tile group relative flex h-full min-h-[200px] flex-col justify-between overflow-hidden rounded-[1.5rem] border border-[#e7e4db] ${TINTS[i % TINTS.length]} p-6 [transform-style:preserve-3d] will-change-transform`}
                    >
                        <div className="relative flex items-start justify-between">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 shadow-sm ring-1 ring-[#eceae3]">
                                {s.imageUrl ? <Image src={s.imageUrl} alt="" width={40} height={40} className="svc-ico h-10 w-10 object-contain transition-transform duration-300 group-hover:scale-110" /> : <span className="h-10 w-10" />}
                            </div>
                            <ArrowUpRight size={20} weight="bold" className="text-[#c8c3b6] transition-all group-hover:-translate-y-0.5 group-hover:text-[#008751]" />
                        </div>
                        <div className="relative mt-5">
                            <h3 className="font-fraunces text-lg font-semibold text-[#0d1a12] transition-colors group-hover:text-[#008751]">{t(s.title)}</h3>
                            <p className="mt-1.5 font-geist text-sm leading-relaxed text-[#6b756e] line-clamp-2">{t(s.description)}</p>
                        </div>
                    </Link>
                </div>
            ))}

            <style jsx>{`
                .svc-mesh {
                    background:
                        radial-gradient(55% 55% at 18% 22%, rgba(15,191,122,0.38), transparent 62%),
                        radial-gradient(50% 55% at 82% 78%, rgba(0,135,81,0.42), transparent 62%);
                    mix-blend-mode: screen;
                    animation: svc-mesh 11s ease-in-out infinite alternate;
                }
                @keyframes svc-mesh { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(4%,-4%) scale(1.1); } }
                .svc-sheen {
                    background: linear-gradient(105deg, transparent 32%, rgba(255,255,255,0.10) 46%, rgba(255,255,255,0.04) 54%, transparent 66%);
                    background-size: 220% 100%;
                    animation: svc-sheen 7.5s ease-in-out infinite;
                }
                @keyframes svc-sheen { 0% { background-position: 160% 0; } 55%,100% { background-position: -60% 0; } }
                .svc-tile::after {
                    content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
                    background: linear-gradient(115deg, transparent 40%, rgba(0,135,81,0.10) 50%, transparent 60%);
                    background-size: 220% 100%; background-position: 160% 0;
                    transition: background-position 0.8s ease;
                }
                .svc-tile:hover::after { background-position: -60% 0; }
                @media (prefers-reduced-motion: reduce) { .svc-mesh, .svc-sheen { animation: none; } }
            `}</style>
        </div>
    )
}
