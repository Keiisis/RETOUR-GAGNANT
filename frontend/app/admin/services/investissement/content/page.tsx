'use client'

import ServiceLandingEditor from '@/components/admin/ServiceLandingEditor'
import { DEFAULT_INVESTISSEMENT } from '@/lib/content/investissement'

export default function InvestissementContentAdmin() {
    return <ServiceLandingEditor page="investissement" defaults={DEFAULT_INVESTISSEMENT} title="Investissement" frontendPath="/services/investissement" />
}
