'use client'

import ServiceLandingEditor from '@/components/admin/ServiceLandingEditor'
import { DEFAULT_CULTURE } from '@/lib/content/culture'

export default function CultureContentAdmin() {
    return <ServiceLandingEditor page="culture" defaults={DEFAULT_CULTURE} title="Tourisme & Culture" frontendPath="/services/culture" />
}
