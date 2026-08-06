'use client'

import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { CaretLeft as ChevronLeft, CaretRight as ChevronRight, House as Home } from '@phosphor-icons/react';

// Galerie photo Embla : swipe tactile, flèches, pastilles. Repli élégant si
// aucune image.
export default function Gallery({ images, alt }: { images: string[]; alt: string }) {
    const [ref, embla] = useEmblaCarousel({ loop: true, align: 'center' })
    const [sel, setSel] = useState(0)
    const [broken, setBroken] = useState<Set<number>>(new Set())

    const onSel = useCallback(() => { if (embla) setSel(embla.selectedScrollSnap()) }, [embla])
    useEffect(() => { if (!embla) return; onSel(); embla.on('select', onSel) }, [embla, onSel])

    const usable = images.filter((_, i) => !broken.has(i))
    if (usable.length === 0) {
        return <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-100"><Home size={48} /></div>
    }

    return (
        <div className="relative w-full h-full group">
            <div className="overflow-hidden h-full" ref={ref}>
                <div className="flex h-full">
                    {images.map((src, i) => (
                        <div key={i} className="relative flex-[0_0_100%] h-full">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={`${alt} ${i + 1}`} className="w-full h-full object-cover" onError={() => setBroken(p => new Set(p).add(i))} />
                        </div>
                    ))}
                </div>
            </div>
            {images.length > 1 && (
                <>
                    <button onClick={() => embla?.scrollPrev()} aria-label="Précédent" className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/85 backdrop-blur text-slate-800 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md"><ChevronLeft size={18} /></button>
                    <button onClick={() => embla?.scrollNext()} aria-label="Suivant" className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/85 backdrop-blur text-slate-800 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md"><ChevronRight size={18} /></button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {images.map((_, i) => <button key={i} onClick={() => embla?.scrollTo(i)} aria-label={`Photo ${i + 1}`} className={`h-2 rounded-full transition-all ${i === sel ? 'w-6 bg-white' : 'w-2 bg-white/55'}`} />)}
                    </div>
                </>
            )}
        </div>
    )
}
