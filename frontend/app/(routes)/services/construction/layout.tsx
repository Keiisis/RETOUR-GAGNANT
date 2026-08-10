import type { ReactNode } from 'react'
import { pageMeta, serviceLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Suivi de chantier au Bénin à distance | Retour Gagnant", "Construisez au Bénin sans y être : représentant sur place, contrôle qualité, rapports hebdo photos/vidéos et budget maîtrisé.", "/services/construction")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([serviceLd("Suivi de Chantier", "Construisez au Bénin sans y être : représentant sur place, contrôle qualité, rapports hebdo photos/vidéos et budget maîtrisé.", "/services/construction"), breadcrumbLd([["Accueil","/"],["Services","/services"],["Suivi de Chantier","/services/construction"]])]) }} />
        </>
    )
}
