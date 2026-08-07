'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ServiceLanding from '@/components/services/ServiceLanding'
import LanguesRacinesChoice from '@/components/services/LanguesRacinesChoice'
import { DEFAULT_LANGUES } from '@/lib/content/langues'
import { mergeServiceLanding, type ServiceLandingContent } from '@/lib/content/serviceLanding'

export default function LanguesRacinesPage() {
    const [c, setC] = useState<ServiceLandingContent>(DEFAULT_LANGUES)
    useEffect(() => {
        (async () => {
            try {
                const { data } = await supabase.from('page_sections').select('content').eq('page', 'langues-racines').eq('section_key', 'page_content').eq('is_active', true).single()
                if (data?.content) setC(mergeServiceLanding(DEFAULT_LANGUES, data.content as Partial<ServiceLandingContent>))
            } catch { /* fallback defaults */ }
        })()
    }, [])
    return (
        <ServiceLanding
            content={c}
            slotBeforeFinal={
                <section id="choisir" className="max-w-6xl mx-auto px-5 md:px-8 py-8 scroll-mt-16">
                    <div className="mb-6">
                        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-2">Commencer</p>
                        <h2 className="font-display text-3xl md:text-4xl font-bold">Choisissez votre format d&apos;apprentissage</h2>
                    </div>
                    <LanguesRacinesChoice />
                </section>
            }
        />
    )
}
