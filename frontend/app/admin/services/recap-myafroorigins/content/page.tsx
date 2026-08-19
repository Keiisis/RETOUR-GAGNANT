'use client'

import ServiceLandingEditor from '@/components/admin/ServiceLandingEditor'
import { DEFAULT_RECAP_MYAFRO } from '@/lib/content/recapMyafro'

export default function RecapMyafroContentAdmin() {
    return (
        <ServiceLandingEditor
            page="recap-myafroorigins"
            defaults={DEFAULT_RECAP_MYAFRO}
            title="Récap de dossier MyAfroOrigins"
            frontendPath="/services/recap-myafroorigins"
        />
    )
}
