import type { ReactNode } from 'react'
import { pageMeta, serviceLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Nationalité béninoise (afro-descendants) | Retour Gagnant", "Accompagnement complet pour l'obtention de la nationalité béninoise : dossier complet, suivi prioritaire et pièces généalogiques, de A à Z.", "/services/nationalite-beninoise")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([serviceLd("Nationalité béninoise", "Accompagnement complet pour l'obtention de la nationalité béninoise : dossier complet, suivi prioritaire et pièces généalogiques, de A à Z.", "/services/nationalite-beninoise"), breadcrumbLd([["Accueil","/"],["Services","/services"],["Nationalité béninoise","/services/nationalite-beninoise"]])]) }} />
        </>
    )
}
