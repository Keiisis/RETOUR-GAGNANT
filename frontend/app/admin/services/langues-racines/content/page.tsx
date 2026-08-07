'use client'

import ServiceLandingEditor from '@/components/admin/ServiceLandingEditor'
import { DEFAULT_LANGUES } from '@/lib/content/langues'

export default function LanguesContentAdmin() {
    return <ServiceLandingEditor page="langues-racines" defaults={DEFAULT_LANGUES} title="Langues & Racines" frontendPath="/services/langues-racines" />
}
