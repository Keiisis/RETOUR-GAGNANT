'use client'

import ServiceLandingEditor from '@/components/admin/ServiceLandingEditor'
import { DEFAULT_AUTRES } from '@/lib/content/autres'

export default function AutresContentAdmin() {
    return <ServiceLandingEditor page="autres" defaults={DEFAULT_AUTRES} title="Autres Services" frontendPath="/services/autres" />
}
