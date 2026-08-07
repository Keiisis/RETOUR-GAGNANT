'use client'

import ServiceLandingEditor from '@/components/admin/ServiceLandingEditor'
import { DEFAULT_PASSEPORT } from '@/lib/content/passeport'

export default function PasseportContentAdmin() {
    return <ServiceLandingEditor page="passeport" defaults={DEFAULT_PASSEPORT} title="Passeport & Documents" frontendPath="/services/passeport" />
}
