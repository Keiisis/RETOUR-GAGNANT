'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ExternalLink } from 'lucide-react'; import { useTranslation, T } from '@/lib/translation'

interface Sponsor {
    id: string
    name: string
    logo_url: string | null
    website_url: string | null
    sort_order: number
}

// Couleurs dégradé pour les badges initiales (cycle sur les couleurs du drapeau béninois)
const BADGE_GRADIENTS: [string, string][] = [
    ['#008751', '#006b40'],
    ['#FCD116', '#e6bc00'],
    ['#E8112D', '#c00d25'],
    ['#1a2332', '#2d3f58'],
    ['#008751', '#FCD116'],
]

function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function SponsorCard({ sponsor, index }: { sponsor: Sponsor; index: number }) {
    const [start, end] = BADGE_GRADIENTS[index % BADGE_GRADIENTS.length]
    const card = (
        <div className="group flex-shrink-0 w-48 flex flex-col items-center gap-3 px-6 py-5 mx-3
            rounded-2xl bg-white border border-gray-100
            hover:border-[#008751]/40 hover:shadow-[0_12px_40px_rgba(0,135,81,0.12)]
            hover:-translate-y-1 hover:scale-[1.03]
            transition-all duration-300 ease-out select-none">

            {/* Logo ou badge initiales */}
            <div className="w-full h-14 flex items-center justify-center">
                {sponsor.logo_url ? (
                    <div className="relative w-full h-full">
                        <Image
                            src={sponsor.logo_url}
                            alt={sponsor.name}
                            fill
                            className="object-contain grayscale group-hover:grayscale-0 opacity-60 group-hover:opacity-100 transition-all duration-500"
                            unoptimized
                        />
                    </div>
                ) : (
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300"
                        style={{ background: `linear-gradient(135deg, ${start}, ${end})` }}
                    >
                        <span className="text-white text-sm font-black tracking-wide">
                            {getInitials(sponsor.name)}
                        </span>
                    </div>
                )}
            </div>

            {/* Séparateur accent — visible au survol */}
            <div className="w-8 h-[2px] rounded-full bg-gradient-to-r from-[#008751] to-[#FCD116] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Nom */}
            <p className="text-[11px] font-bold text-gray-400 group-hover:text-[#1a2332] transition-colors text-center leading-tight">
                {sponsor.name}
            </p>
        </div>
    )

    if (sponsor.website_url) {
        return (
            <Link href={sponsor.website_url} target="_blank" rel="noopener noreferrer">
                {card}
            </Link>
        )
    }
    return card
}

function MarqueeRow({
    sponsors,
    direction = 'left',
    className = '',
}: {
    sponsors: Sponsor[]
    direction?: 'left' | 'right'
    className?: string
}) {
    const [paused, setPaused] = useState(false)
    // 4 copies pour garantir la continuité même sur très grands écrans
    const track = [...sponsors, ...sponsors, ...sponsors, ...sponsors]

    return (
        <div
            className={`overflow-hidden ${className}`}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            <div
                className={direction === 'left' ? 'animate-marquee-left' : 'animate-marquee-right'}
                style={{
                    display: 'flex',
                    width: 'max-content',
                    alignItems: 'center',
                    animationPlayState: paused ? 'paused' : 'running',
                }}
            >
                {track.map((s, i) => (
                    <SponsorCard key={`${s.id}-${i}`} sponsor={s} index={i % sponsors.length} />
                ))}
            </div>
        </div>
    )
}

export default function PartnersSection() {
    const { t } = useTranslation();
    const [sponsors, setSponsors] = useState<Sponsor[]>([])
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        fetch('/api/sponsors')
            .then(r => r.json())
            .then(d => { setSponsors(d.sponsors || []); setLoaded(true) })
            .catch(() => setLoaded(true))
    }, [])

    // Fallback statique pendant le chargement et si la table n'est pas encore créée
    const fallback: Sponsor[] = [
        { id: '1', name: 'Gouvernement du Bénin', logo_url: null, website_url: null, sort_order: 0 },
        { id: '2', name: 'APIEX', logo_url: null, website_url: null, sort_order: 1 },
        { id: '3', name: 'Chambre de Commerce', logo_url: null, website_url: null, sort_order: 2 },
        { id: '4', name: 'Ambassade de France', logo_url: null, website_url: null, sort_order: 3 },
        { id: '5', name: 'Diaspora Connect', logo_url: null, website_url: null, sort_order: 4 },
    ]

    const items = loaded && sponsors.length > 0 ? sponsors : fallback
    if (items.length === 0) return null

    // Deux rangs avec ordre inversé pour le second (effet miroir/parallaxe)
    const row1 = items
    const row2 = [...items].reverse()

    return (
        <section className="relative py-20 overflow-hidden"
            style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f0fdf8 50%, #ffffff 100%)' }}>

            {/* ── Orbs d'ambiance (background glow) ── */}
            <div className="absolute top-0 left-[10%] w-[600px] h-[600px] rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(0,135,81,0.06) 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 right-[5%] w-[500px] h-[500px] rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(252,209,22,0.07) 0%, transparent 70%)' }} />
            <div className="absolute top-1/2 right-[25%] w-[350px] h-[350px] -translate-y-1/2 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(232,17,45,0.04) 0%, transparent 70%)' }} />

            {/* ── Header ── */}
            <div className="relative z-10 text-center mb-14 px-4">
                {/* Barre drapeau décorative */}
                <div className="flex items-center justify-center gap-2 mb-5">
                    <div className="h-px w-20 bg-gradient-to-r from-transparent to-[#008751]/40 rounded-full" />
                    <div className="flex gap-1.5">
                        <span className="w-7 h-[3px] rounded-full bg-[#008751] inline-block" />
                        <span className="w-7 h-[3px] rounded-full bg-[#FCD116] inline-block" />
                        <span className="w-7 h-[3px] rounded-full bg-[#E8112D] inline-block" />
                    </div>
                    <div className="h-px w-20 bg-gradient-to-l from-transparent to-[#008751]/40 rounded-full" />
                </div>

                <p className="text-[11px] font-black tracking-[0.35em] text-gray-400 uppercase">
                    <T>Ils nous font confiance</T>{' '}
                    <span className="text-[#008751]"><T>&amp;</T></span>{' '}
                    <T>nous soutiennent</T>
                </p>
            </div>

            {/* ── Marquee lanes ── */}
            <div className="relative z-10">
                {/* Masques de fondu gauche / droite */}
                <div className="pointer-events-none absolute left-0 top-0 h-full w-32 z-20"
                    style={{ background: 'linear-gradient(to right, #f0fdf8, transparent)' }} />
                <div className="pointer-events-none absolute right-0 top-0 h-full w-32 z-20"
                    style={{ background: 'linear-gradient(to left, #f0fdf8, transparent)' }} />

                {/* Lane 1 — défile à gauche, 35s */}
                <MarqueeRow sponsors={row1} direction="left" className="mb-4" />

                {/* Lane 2 — défile à droite, 45s (vitesse différente = effet parallaxe) */}
                <MarqueeRow sponsors={row2} direction="right" />
            </div>

            {/* ── CTA ── */}
            <div className="relative z-10 mt-14 text-center">
                <Link
                    href="/partenaires"
                    className="group inline-flex items-center gap-2.5 px-6 py-3 rounded-full
                        border border-[#008751]/30 bg-white text-[#008751] text-sm font-bold
                        hover:bg-[#008751] hover:text-white hover:border-[#008751]
                        hover:shadow-[0_8px_28px_rgba(0,135,81,0.25)]
                        transition-all duration-300"
                >
                    <T>Découvrir nos partenaires privilégiés</T>
                    <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                    <ExternalLink size={11} className="opacity-40 group-hover:opacity-80" />
                </Link>
            </div>
        </section>
    )
}
