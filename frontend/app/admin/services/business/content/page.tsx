'use client'

import ServiceLandingEditor from '@/components/admin/ServiceLandingEditor'
import { DEFAULT_BUSINESS } from '@/lib/content/business'

export default function BusinessContentAdmin() {
    return <ServiceLandingEditor page="business" defaults={DEFAULT_BUSINESS} title="Création d'Entreprise" frontendPath="/services/business" />
}
