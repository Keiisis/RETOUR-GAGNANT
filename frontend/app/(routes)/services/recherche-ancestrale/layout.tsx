import type { ReactNode } from 'react'
import { pageMeta, serviceLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Recherche ancestrale & généalogie afro | Retour Gagnant", "Reconstituez votre lignée africaine : archives officielles, bases de données spécialisées et associations expertes.", "/services/recherche-ancestrale")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([serviceLd("Recherche Ancestrale", "Reconstituez votre lignée africaine : archives officielles, bases de données spécialisées et associations expertes.", "/services/recherche-ancestrale"), breadcrumbLd([["Accueil","/"],["Services","/services"],["Recherche Ancestrale","/services/recherche-ancestrale"]])]) }} />
        </>
    )
}
