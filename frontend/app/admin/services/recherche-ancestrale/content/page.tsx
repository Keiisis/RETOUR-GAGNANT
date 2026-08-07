'use client'

import ServiceLandingEditor from '@/components/admin/ServiceLandingEditor'
import { DEFAULT_RECHERCHE_ANCESTRALE } from '@/lib/content/rechercheAncestrale'

export default function RechercheAncestraleContentAdmin() {
    return <ServiceLandingEditor page="recherche-ancestrale" defaults={DEFAULT_RECHERCHE_ANCESTRALE} title="Recherche Ancestrale" frontendPath="/services/recherche-ancestrale" />
}
