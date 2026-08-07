'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ServiceLanding from '@/components/services/ServiceLanding'
import FaConsultationBooking from '@/components/services/FaConsultationBooking'
import FaPriestsDirectory from '@/components/services/FaPriestsDirectory'
import { DEFAULT_FA } from '@/lib/content/fa'
import { mergeServiceLanding, type ServiceLandingContent } from '@/lib/content/serviceLanding'

// Tarifs de repli (décision : 550 € présentiel / 780 € visio affichés directement).
const FALLBACK_FA_OPTIONS = [
    { label: 'Consultation en Présentiel — accueil, RDV avec le prêtre Fa, aide, hôtel, change', price: '550 €' },
    { label: 'Consultation en Visio — assistance et veille à distance de bout en bout', price: '780 €' },
]

export default function ConsultationFaPage() {
    const [c, setC] = useState<ServiceLandingContent>(DEFAULT_FA)
    const [options, setOptions] = useState(FALLBACK_FA_OPTIONS)
    useEffect(() => {
        (async () => {
            try {
                const { data } = await supabase.from('page_sections').select('content').eq('page', 'consultation-fa-racines').eq('section_key', 'page_content').eq('is_active', true).single()
                if (data?.content) setC(mergeServiceLanding(DEFAULT_FA, data.content as Partial<ServiceLandingContent>))
            } catch { /* fallback defaults */ }
            try {
                const res = await fetch('/api/services/consultation-fa-racines')
                const j = await res.json()
                if (Array.isArray(j.service?.pricing_options) && j.service.pricing_options.length) setOptions(j.service.pricing_options)
            } catch { /* fallback options */ }
        })()
    }, [])
    return (
        <ServiceLanding
            content={c}
            slotAfterFeatures={<div className="max-w-6xl mx-auto px-5 md:px-8 pt-2"><FaPriestsDirectory /></div>}
            slotBeforeFinal={
                <section id="reserver" className="max-w-6xl mx-auto px-5 md:px-8 py-8 scroll-mt-16">
                    <div className="mb-6">
                        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-2">Réservation</p>
                        <h2 className="font-display text-3xl md:text-4xl font-bold">Réserver votre consultation</h2>
                    </div>
                    <FaConsultationBooking options={options} />
                </section>
            }
        />
    )
}
