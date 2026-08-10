import type { ReactNode } from 'react'
import { pageMeta, serviceLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Créer son entreprise au Bénin (diaspora) | Retour Gagnant", "Création SARL/SA, immatriculation RCCM, compte bancaire pro et domiciliation à Cotonou : implantez votre activité au Bénin depuis l'étranger.", "/services/business")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([serviceLd("Création d'Entreprise", "Création SARL/SA, immatriculation RCCM, compte bancaire pro et domiciliation à Cotonou : implantez votre activité au Bénin depuis l'étranger.", "/services/business"), breadcrumbLd([["Accueil","/"],["Services","/services"],["Création d'Entreprise","/services/business"]])]) }} />
        </>
    )
}
