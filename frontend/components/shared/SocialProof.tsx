'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Quotes, Star } from '@phosphor-icons/react'
import { T, useTranslation } from '@/lib/translation'

interface Testimonial {
    id: string | number
    name: string
    role?: string
    text: string
    location?: string
    rating?: number
    service?: string
    photoUrl?: string
}

/**
 * Preuve sociale RÉELLE uniquement : témoignages modérés depuis /api/testimonials
 * (mêmes données que l'admin). Ne rend RIEN s'il n'y en a aucun : aucune preuve
 * fictive n'est jamais affichée. Optionnellement priorise un service donné.
 */
export default function SocialProof({ service, title = "Ils nous ont fait confiance", max = 3 }: { service?: string; title?: string; max?: number }) {
    const { t } = useTranslation()
    const [items, setItems] = useState<Testimonial[]>([])

    useEffect(() => {
        let cancelled = false
        fetch('/api/testimonials')
            .then(r => r.json())
            .then((d) => {
                if (cancelled) return
                const raw: Testimonial[] = Array.isArray(d) ? d : (d.testimonials || d.data || [])
                const clean = (raw || []).filter(x => x && x.text && x.name)
                // priorise le service courant s'il existe, complète avec les autres
                const ordered = service
                    ? [...clean.filter(x => x.service === service), ...clean.filter(x => x.service !== service)]
                    : clean
                setItems(ordered.slice(0, max))
            })
            .catch(() => { /* silencieux : pas de section si erreur */ })
        return () => { cancelled = true }
    }, [service, max])

    if (items.length === 0) return null

    return (
        <section className="max-w-6xl mx-auto px-5 md:px-8 py-14">
            <div className="text-center max-w-2xl mx-auto mb-9">
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-2"><T>La preuve</T></p>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-[#111a15]"><T>{title}</T></h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
                {items.map((it) => (
                    <figure key={it.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.3)]">
                        <Quotes size={24} weight="fill" className="text-[#008751]/25 mb-3" aria-hidden="true" />
                        {typeof it.rating === 'number' && it.rating > 0 && (
                            <div className="flex gap-0.5 mb-2" aria-label={`${it.rating} / 5`}>
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Star key={i} size={14} weight="fill" className={i < it.rating! ? 'text-[#FCD116]' : 'text-slate-200'} aria-hidden="true" />
                                ))}
                            </div>
                        )}
                        <blockquote className="text-slate-700 leading-relaxed text-[15px]">« {t(it.text)} »</blockquote>
                        <figcaption className="mt-4 flex items-center gap-3">
                            {it.photoUrl && (
                                <span className="relative h-9 w-9 rounded-full overflow-hidden bg-slate-100 shrink-0">
                                    <Image src={it.photoUrl} alt="" fill sizes="36px" className="object-cover" />
                                </span>
                            )}
                            <span className="min-w-0">
                                <span className="block text-sm font-bold text-slate-900 truncate">{it.name}</span>
                                {(it.role || it.location) && (
                                    <span className="block text-xs text-slate-400 truncate">{[it.role, it.location].filter(Boolean).join(' · ')}</span>
                                )}
                            </span>
                        </figcaption>
                    </figure>
                ))}
            </div>
        </section>
    )
}
