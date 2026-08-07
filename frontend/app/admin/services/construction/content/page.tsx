'use client'

import ServiceLandingEditor from '@/components/admin/ServiceLandingEditor'
import { DEFAULT_CONSTRUCTION } from '@/lib/content/construction'

export default function ConstructionContentAdmin() {
    return <ServiceLandingEditor page="construction" defaults={DEFAULT_CONSTRUCTION} title="Suivi de Chantier" frontendPath="/services/construction" />
}
