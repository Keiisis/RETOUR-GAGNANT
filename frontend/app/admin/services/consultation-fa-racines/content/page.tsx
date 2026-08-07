'use client'

import ServiceLandingEditor from '@/components/admin/ServiceLandingEditor'
import { DEFAULT_FA } from '@/lib/content/fa'

export default function FaContentAdmin() {
    return <ServiceLandingEditor page="consultation-fa-racines" defaults={DEFAULT_FA} title="Consultation Fa & Racines" frontendPath="/services/consultation-fa-racines" />
}
