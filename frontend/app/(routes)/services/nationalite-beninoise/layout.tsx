import type { ReactNode } from 'react'
import { pageMeta, serviceLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Nationalité béninoise (afro-descendants) | Retour Gagnant", "Demande et accompagnement complet gratuits par une agence agréée pour obtenir la nationalité béninoise, passeport inclus et remis par l'État lors de la cérémonie officielle.", "/services/nationalite-beninoise")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([serviceLd("Nationalité béninoise", "Demande et accompagnement complet gratuits par une agence agréée pour obtenir la nationalité béninoise, passeport inclus et remis par l'État lors de la cérémonie officielle.", "/services/nationalite-beninoise"), breadcrumbLd([["Accueil","/"],["Services","/services"],["Nationalité béninoise","/services/nationalite-beninoise"]])]) }} />
        </>
    )
}
