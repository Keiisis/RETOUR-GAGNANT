'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ServiceLanding from '@/components/services/ServiceLanding'
import PermisBooking from '@/components/services/PermisBooking'
import { DEFAULT_PERMIS } from '@/lib/content/permis'
import { mergeServiceLanding, type ServiceLandingContent } from '@/lib/content/serviceLanding'
import { T } from '@/lib/translation'

export default function PermisConduirePage() {
    const [c, setC] = useState<ServiceLandingContent>(DEFAULT_PERMIS)
    useEffect(() => {
        (async () => {
            try {
                const { data } = await supabase
                    .from('page_sections').select('content')
                    .eq('page', 'permis-conduire').eq('section_key', 'page_content').eq('is_active', true).single()
                if (data?.content) setC(mergeServiceLanding(DEFAULT_PERMIS, data.content as Partial<ServiceLandingContent>))
            } catch { /* fallback defaults */ }
        })()
    }, [])
    return (
        <ServiceLanding
            content={c}
            slotBeforeFinal={
                <section id="reserver" className="max-w-6xl mx-auto px-5 md:px-8 py-8 scroll-mt-16">
                    <div className="mb-6">
                        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-2"><T>Réservation</T></p>
                        <h2 className="font-display text-3xl md:text-4xl font-bold"><T>Choisir ma catégorie et lancer mon permis</T></h2>
                        <p className="mt-2 text-slate-600"><T>Sélectionnez votre catégorie de permis : le tarif s'affiche, puis réglez en ligne. Notre équipe prend le relais sous 24 h.</T></p>
                    </div>
                    <PermisBooking />
                </section>
            }
        />
    )
}
