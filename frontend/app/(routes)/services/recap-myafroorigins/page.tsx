'use client'

/**
 * Service « Récap de dossier MyAfroOrigins ».
 *
 * Même gabarit que les autres services (logement, business, permis…) :
 * `ServiceLanding` porte le hero, les piliers, le déroulé et la FAQ, et le
 * contenu reste surchargeable depuis l'admin via
 * page_sections(page='recap-myafroorigins', section_key='page_content').
 *
 * La page avait d'abord été écrite sur mesure : elle rendait bien, mais elle
 * sortait du gabarit — pas d'icône du service, pas d'édition en admin. Le
 * formulaire de dépôt s'insère donc dans le gabarit via `slotBeforeFinal`,
 * comme la réservation du permis.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ServiceLanding from '@/components/services/ServiceLanding'
import RecapMyafroForm from '@/components/services/RecapMyafroForm'
import { DEFAULT_RECAP_MYAFRO } from '@/lib/content/recapMyafro'
import { mergeServiceLanding, type ServiceLandingContent } from '@/lib/content/serviceLanding'

export default function RecapMyafroOriginsPage() {
    const [c, setC] = useState<ServiceLandingContent>(DEFAULT_RECAP_MYAFRO)

    useEffect(() => {
        (async () => {
            try {
                const { data } = await supabase
                    .from('page_sections').select('content')
                    .eq('page', 'recap-myafroorigins').eq('section_key', 'page_content')
                    .eq('is_active', true).single()
                if (data?.content) {
                    setC(mergeServiceLanding(DEFAULT_RECAP_MYAFRO, data.content as Partial<ServiceLandingContent>))
                }
            } catch { /* repli sur les valeurs par défaut */ }
        })()
    }, [])

    return <ServiceLanding content={c} slotBeforeFinal={<RecapMyafroForm />} />
}
