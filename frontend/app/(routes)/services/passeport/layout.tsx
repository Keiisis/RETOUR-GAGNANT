import type { ReactNode } from 'react'
import { pageMeta, serviceLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Passeport béninois — accompagnement diaspora | Retour Gagnant", "Obtenez ou renouvelez votre passeport biométrique béninois : dossier constitué, coordination avec les autorités et option express jour-J.", "/services/passeport")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([serviceLd("Passeport", "Obtenez ou renouvelez votre passeport biométrique béninois : dossier constitué, coordination avec les autorités et option express jour-J.", "/services/passeport"), breadcrumbLd([["Accueil","/"],["Services","/services"],["Passeport","/services/passeport"]])]) }} />
        </>
    )
}
